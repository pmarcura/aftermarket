import {
  ECONOMIC_INTERVAL,
  products,
  TIME_SCALE,
  type World,
  type Command,
  type ProductId,
  type Establishment,
  type Entry,
} from './model';
import { distanceKm } from './geometry';
import { householdItems, infrastructurePrograms } from './channels';
import { committedStorage, fleetAvailability } from './transport';
import {
  actorState,
  treasuryId,
  institutional,
  updateWages,
  regionalizeTreasury,
  trainingQuote,
  publicReference,
  defaultSupplyPolicy,
} from './competition';
import { runSupplyPolicies, validateSupplyPolicy } from './supply';
import { runBotDirector } from './director';
import {
  emitDecisionTrace,
  hasDecisionTrace,
  traceCommand,
  withDecisionSource,
} from './decision-trace';
import {
  equipmentCostFor,
  freeCash,
  recoveryQuote,
  arrears,
  outstandingLoans,
  collateral,
  updatePublicBenchmarks,
} from './design';
import {
  GAME_DAY,
  gameCalendar,
  inventoryQuality,
  availableStock,
  openingWorkers,
  productionCapacity,
  productionQuality,
  retailCapacity,
  treasuryAvailable,
} from './operations';
import {
  householdDemand,
  marketView,
  operatingCosts,
  productionCharges,
  recordMarket,
  regionFor,
  seasonPrice,
} from './metrics';
export { distanceKm } from './geometry';
const randomUUID = () => globalThis.crypto.randomUUID();

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
function integer(value: number, label: string, max = 1000000) {
  ensure(
    Number.isSafeInteger(value) && value > 0 && value <= max,
    `${label} deve ser um inteiro positivo de até ${max}.`,
  );
}
function company(w: World, id: string) {
  const c = w.companies.find((x) => x.id === id);
  ensure(c, 'Empresa não encontrada.');
  return c;
}
function establishment(w: World, id: string) {
  const e = w.establishments.find((x) => x.id === id);
  ensure(e, 'Estabelecimento não encontrado.');
  return e;
}
function owned(w: World, id: string, actor: string) {
  const e = establishment(w, id);
  ensure(e.companyId === actor, 'Este estabelecimento pertence a outra empresa.');
  return e;
}
const dpOf = (w: World, e: Establishment) => w.properties.find((p) => p.id === e.propertyId)!;
function transfer(
  w: World,
  from: string,
  to: string,
  amount: number,
  description: string,
  kind: Entry['kind'],
  at: number,
  establishmentId?: string,
  metadata: Partial<
    Pick<Entry, 'product' | 'quantity' | 'unitPrice' | 'regionId' | 'channel'>
  > = {},
) {
  ensure(Number.isSafeInteger(amount) && amount >= 0, 'Valor financeiro inválido.');
  if (to === 'treasury') to = treasuryId(actorState(w, from, establishmentId));
  const sender = company(w, from),
    receiver = company(w, to);
  ensure(
    freeCash(w, from) >= amount,
    'Saldo insuficiente ou vinculado a pedidos. Libere a reserva ou reduza a operação.',
  );
  sender.balance -= amount;
  receiver.balance += amount;
  w.ledger.push({
    id: randomUUID(),
    at,
    from,
    to,
    amount,
    description,
    kind,
    establishmentId,
    ...metadata,
  });
}
export function loadOf(inventory: Partial<Record<ProductId, number>>) {
  let mass = 0,
    volume = 0;
  for (const [key, quantity] of Object.entries(inventory)) {
    const p = products[key as ProductId];
    mass += p.massT * quantity!;
    volume += p.volumeM3 * quantity!;
  }
  return { mass, volume };
}
function capacity(w: World, e: Establishment, extra: Partial<Record<ProductId, number>>) {
  const inv = committedStorage(w, e);
  for (const [p, q] of Object.entries(extra)) inv[p as ProductId] = (inv[p as ProductId] ?? 0) + q!;
  const load = loadOf(inv);
  ensure(
    load.mass <= e.capacityT + 1e-8 && load.volume <= e.capacityM3 + 1e-8,
    'O destino não tem espaço. Considere também cargas a caminho e produção reservada.',
  );
}
export function quote(
  w: World,
  originId: string,
  destinationId: string,
  product: ProductId,
  quantity: number,
  carrierId: string,
) {
  const origin = establishment(w, originId),
    dest = establishment(w, destinationId);
  const op = w.properties.find((x) => x.id === origin.propertyId)!,
    dp = w.properties.find((x) => x.id === dest.propertyId)!;
  const route = w.routes[`${op.id}:${dp.id}`];
  const km = route?.distanceKm ?? Math.max(3, distanceKm(op.coordinates, dp.coordinates) * 1.3);
  const load = loadOf({ [product]: quantity });
  const cfg = w.season.config.parameters;
  const available = w.vehicles
    .filter((x) => x.companyId === carrierId && x.status === 'available')
    .sort(
      (a, b) =>
        distanceKm(w.properties.find((p) => p.id === a.propertyId)!.coordinates, op.coordinates) -
        distanceKm(w.properties.find((p) => p.id === b.propertyId)!.coordinates, op.coordinates),
    );
  let remaining = quantity;
  const ownFleet = carrierId === dest.companyId || carrierId === origin.companyId;
  const parts = [];
  for (const vehicle of available) {
    const units = Math.min(
      remaining,
      Math.floor((vehicle.capacityT + 1e-9) / products[product].massT),
      Math.floor((vehicle.capacityM3 + 1e-9) / products[product].volumeM3),
    );
    if (units <= 0) continue;
    const relocation =
      distanceKm(
        w.properties.find((x) => x.id === vehicle.propertyId)!.coordinates,
        op.coordinates,
      ) * 1.3;
    const totalKm = km + relocation;
    const relocationMs = ((relocation / cfg.averageSpeedKmH) * 3600000) / TIME_SCALE;
    const loadingMs = (cfg.loadingMinutes * 60000) / TIME_SCALE;
    const roadMs =
      ((route?.durationSeconds ?? (km / cfg.averageSpeedKmH) * 3600) * 1000) / TIME_SCALE;
    const fuel = Math.round((totalKm / cfg.kmPerLiter) * cfg.dieselPerLiter);
    const maintenance = Math.round(totalKm * cfg.maintenancePerKm);
    const driver = Math.round(
      (totalKm / cfg.averageSpeedKmH + cfg.loadingMinutes / 60) * cfg.driverPerHour,
    );
    const tolls = Math.round(totalKm * cfg.estimatedTollPerKm);
    const handling = Math.round(18000 + units * products[product].massT * 500);
    const operatingCost = fuel + maintenance + driver + tolls + handling;
    const markup = carrierId === 'expresso' ? 1.3 : carrierId === 'rodoleste' ? 1.2 : 1.15;
    const price = ownFleet ? operatingCost : Math.max(28000, Math.round(operatingCost * markup));
    parts.push({
      vehicleId: vehicle.id,
      quantity: units,
      price,
      relocationMs,
      loadingMs,
      roadMs,
      durationMs: Math.max(15000, relocationMs + loadingMs + roadMs),
      costs: { fuel, maintenance, driver, tolls, handling, operatingCost },
    });
    remaining -= units;
    if (remaining <= 0) break;
  }
  const costs = { fuel: 0, maintenance: 0, driver: 0, tolls: 0, handling: 0, operatingCost: 0 };
  for (const part of parts)
    for (const key of Object.keys(costs) as (keyof typeof costs)[]) costs[key] += part.costs[key];
  return {
    carrierId,
    fleet: fleetAvailability(w, carrierId, product),
    vehicleId: parts[0]?.vehicleId,
    compatible:
      Number.isSafeInteger(quantity) &&
      quantity > 0 &&
      remaining === 0 &&
      (!w.requireRoadRoutes || route?.source === 'osrm'),
    routeRequired: Boolean(w.requireRoadRoutes && route?.source !== 'osrm'),
    price: parts.reduce((n, p) => n + p.price, 0),
    distanceKm: Math.round(km * 10) / 10,
    durationMs: Math.max(0, ...parts.map((p) => p.durationMs)),
    relocationMs: parts[0]?.relocationMs ?? 0,
    loadingMs: parts[0]?.loadingMs ?? 0,
    roadMs: parts[0]?.roadMs ?? 0,
    costs,
    parts,
    ownFleet,
    load,
    unallocated: remaining,
    source: route?.source ?? 'estimate',
    coordinates: route?.coordinates ?? [op.coordinates, dp.coordinates],
  };
}

function dispatch(
  w: World,
  buyerId: string,
  origin: Establishment,
  dest: Establishment,
  product: ProductId,
  quantity: number,
  unitPrice: number,
  carrierId: string,
  now: number,
  expectedTotal?: number,
  orderId?: string,
  infrastructureId?: string,
) {
  integer(quantity, 'Quantidade');
  ensure(origin.id !== dest.id, 'Escolha um destino diferente da origem.');
  ensure(
    availableStock(w, origin, product) >= quantity,
    'Estoque insuficiente no fornecedor. Reduza a quantidade.',
  );
  capacity(w, dest, { [product]: quantity });
  const q = quote(w, origin.id, dest.id, product, quantity, carrierId);
  ensure(
    !q.routeRequired,
    'Rota rodoviária pendente. Aguarde o cálculo pelas estradas antes de contratar; nada foi cobrado.',
  );
  ensure(
    company(w, carrierId).bot ||
      carrierId === buyerId ||
      (Boolean(infrastructureId || orderId) && carrierId === origin.companyId),
    'A frota de outra empresa humana exige autorização do proprietário.',
  );
  ensure(
    q.compatible,
    'Nenhum conjunto de veículos disponíveis comporta a massa e o volume desta carga.',
  );
  const internal = origin.companyId === buyerId;
  const cost = internal
    ? Math.round((origin.unitCosts[product] ?? 0) * quantity)
    : unitPrice * quantity;
  const total = (internal ? 0 : cost) + q.price;
  ensure(
    expectedTotal === undefined || expectedTotal === total,
    'A cotação mudou. Revise o novo total antes de confirmar; nenhum pagamento foi feito.',
  );
  ensure(
    freeCash(w, buyerId, orderId) >= total,
    'Saldo insuficiente para mercadoria e frete, considerando pedidos com reserva.',
  );
  // Obras possuem verba previamente comprometida; outros pagamentos do Tesouro não podem gastá-la.
  if (buyerId === 'treasury' && !infrastructureId)
    ensure(treasuryAvailable(w) >= total, 'Caixa do Tesouro já comprometido.');
  ensure(
    q.ownFleet || freeCash(w, carrierId) + q.price >= q.costs.operatingCost,
    'Transportador sem caixa para os custos da viagem.',
  );
  if (orderId) {
    const order = w.orders.find((o) => o.id === orderId);
    if (order) order.escrowReserved = 0;
  }
  if (!internal)
    transfer(
      w,
      buyerId,
      origin.companyId,
      cost,
      `Compra · ${quantity} ${products[product].unit} de ${products[product].name}`,
      'trade',
      now,
      dest.id,
      {
        product,
        quantity,
        unitPrice,
        regionId: regionFor(dpOf(w, dest).coordinates).id,
        channel: 'wholesale',
      },
    );
  if (!q.ownFleet)
    transfer(
      w,
      buyerId,
      carrierId,
      q.price,
      `Frete · ${origin.name} → ${dest.name}`,
      'freight',
      now,
      dest.id,
    );
  const payer = q.ownFleet ? buyerId : carrierId;
  const carrierUnit = w.establishments.find(
    (e) => e.companyId === carrierId && e.category === 'logistics',
  );
  transfer(
    w,
    payer,
    'consumers',
    q.costs.driver,
    'Motorista · remuneração do frete',
    'payroll',
    now,
    q.ownFleet ? dest.id : carrierUnit?.id,
  );
  transfer(
    w,
    payer,
    'treasury',
    q.costs.operatingCost - q.costs.driver,
    'Combustível, manutenção, pedágios e manuseio',
    q.ownFleet ? 'freight' : 'operation',
    now,
    q.ownFleet ? dest.id : carrierUnit?.id,
  );
  if (carrierUnit && !q.ownFleet) {
    carrierUnit.revenue += q.price;
    carrierUnit.expenses += q.costs.operatingCost;
  }
  origin.inventory[product] = origin.inventory[product]! - quantity;
  if (!internal) {
    origin.revenue += cost;
    origin.expenses += Math.round((origin.unitCosts[product] ?? 0) * quantity);
  }
  const batchId = randomUUID();
  const routeKey = w.requireRoadRoutes
    ? `${origin.propertyId}:${dest.propertyId}@${w.routes[`${origin.propertyId}:${dest.propertyId}`]?.fetchedAt ?? 'frozen'}`
    : undefined;
  if (routeKey) {
    w.roadPaths ??= {};
    w.roadPaths[routeKey] ??= structuredClone(q.coordinates);
  }
  let allocated = 0;
  q.parts.forEach((part, index) => {
    const partCost =
      index === q.parts.length - 1
        ? cost - allocated
        : Math.round((cost * part.quantity) / quantity);
    allocated += partCost;
    w.vehicles.find((v) => v.id === part.vehicleId)!.status = 'route';
    w.shipments.push({
      id: randomUUID(),
      batchId,
      buyerId,
      sellerId: origin.companyId,
      originId: origin.id,
      destinationId: dest.id,
      product,
      quantity: part.quantity,
      cost: partCost,
      freight: part.price,
      carrierId,
      vehicleId: part.vehicleId,
      departedAt: now,
      arrivesAt: now + part.durationMs,
      delivered: false,
      distance: q.distanceKm,
      route: routeKey ? undefined : structuredClone(q.coordinates),
      routeKey,
      routeSource: q.source,
      pickupAt: now + part.relocationMs,
      roadDepartureAt: now + part.relocationMs + part.loadingMs,
      roadArrivalAt: now + part.durationMs,
      quality: inventoryQuality(origin, product),
      orderId,
      infrastructureId,
    });
  });
  return q;
}

// O chamador envolve cada comando em uma transação. Bots usam esta mesma função.
export function execute(w: World, actor: string, command: Command, now = Date.now()): void {
  if (!hasDecisionTrace(w)) return executeCommand(w, actor, command, now);
  try {
    executeCommand(w, actor, command, now);
  } catch (error) {
    if (error instanceof RuleError) traceCommand(w, actor, command, now, error);
    throw error;
  }
  traceCommand(w, actor, command, now);
}

function executeCommand(w: World, actor: string, command: Command, now: number): void {
  company(w, actor);
  // Mundos da versão 1 não têm os itens novos do catálogo: a temporada define os produtos.
  const product = (command as { product?: string }).product;
  ensure(
    product === undefined || product in w.season.config.basePrices,
    'Esta mercadoria não existe nesta temporada.',
  );
  switch (command.type) {
    case 'installBusiness': {
      const e = owned(w, command.establishmentId, actor),
        p = dpOf(w, e);
      integer(command.lines, 'Linhas de equipamento', 100);
      const productive = ['industry', 'farm', 'mine'].includes(e.category);
      const r = w.season.config.recipes.find(
        (r) => r.id === command.recipeId && r.category === e.category,
      );
      ensure(!productive || r, 'Escolha uma especialidade compatível com a unidade.');
      ensure(
        !w.jobs.some((j) => j.establishmentId === e.id && !j.completed),
        'Conclua os lotes antes de alterar equipamentos.',
      );
      const maximum = r ? Math.floor(p.area / w.season.config.operations.profiles[r.id].areaM2) : 1;
      const current = e.installed === false ? 0 : (e.equipmentLines ?? maximum);
      ensure(
        command.lines > current && command.lines <= maximum,
        'Equipamento precisa aumentar as linhas e caber na área.',
      );
      ensure(
        current === 0 || !productive || e.specialization === r!.id,
        'Troca de tecnologia exige nova unidade neste laboratório.',
      );
      const cost = (command.lines - current) * equipmentCostFor(w, e.category, r?.id);
      transfer(
        w,
        actor,
        treasuryId(p.state),
        cost,
        'Equipamento e instalação capitalizados',
        'property',
        now,
        e.id,
      );
      e.installationValue = (e.installationValue ?? 0) + cost;
      e.installed = true;
      e.equipmentLines = command.lines;
      e.specialization = r?.id;
      e.capacityT = Math.max(
        1,
        Math.floor(p.area * w.season.config.design.storageMassPerM2[e.category]),
      );
      e.capacityM3 = Math.max(
        1,
        Math.floor(p.area * w.season.config.design.storageVolumePerM2[e.category]),
      );
      e.supplyPolicy = defaultSupplyPolicy(w, e);
      e.dailyCost = operatingCosts(w, e).total;
      break;
    }
    case 'takeRecoveryLoan': {
      integer(command.amount, 'Principal do crédito', 1e9);
      ensure(
        w.properties.some((p) => p.ownerId === actor && p.state === command.state),
        'Escolha um estado em que sua empresa possui imóvel.',
      );
      ensure(!institutional(actor), 'Crédito disponível apenas para empresas privadas.');
      const q = recoveryQuote(w, actor, command.state, command.amount);
      ensure(
        command.amount >= 100000 && command.amount <= q.maximum,
        'Crédito excede garantia ou verba estadual livre. O mínimo é R$ 1.000.',
      );
      ensure(
        !w.loans!.some(
          (l) =>
            l.companyId === actor && l.principal > l.repaid && now - l.createdAt > GAME_DAY * 30,
        ),
        'Regularize o crédito vencido antes de tomar outro.',
      );
      transfer(
        w,
        q.lender,
        actor,
        command.amount,
        'Crédito de recuperação com garantia',
        'loan',
        now,
      );
      transfer(
        w,
        actor,
        q.lender,
        q.fee,
        'Custo de financiamento de 2% pago na contratação',
        'finance',
        now,
      );
      company(w, actor).financingExpense = (company(w, actor).financingExpense ?? 0) + q.fee;
      w.loans!.push({
        id: randomUUID(),
        companyId: actor,
        treasuryId: q.lender,
        principal: command.amount,
        repaid: 0,
        fee: q.fee,
        createdAt: now,
        nextDueAt: now + GAME_DAY,
        installment: q.installment,
        durationDays: q.days,
      });
      break;
    }
    case 'repayLoan': {
      const loan = w.loans!.find((l) => l.id === command.loanId && l.companyId === actor);
      ensure(loan, 'Crédito não encontrado.');
      integer(command.amount, 'Amortização', 1e9);
      ensure(
        command.amount <= loan.principal - loan.repaid,
        'Amortização supera o principal restante.',
      );
      transfer(
        w,
        actor,
        loan.treasuryId,
        command.amount,
        'Amortização antecipada de principal',
        'repayment',
        now,
      );
      loan.repaid += command.amount;
      break;
    }
    case 'payObligations': {
      integer(command.amount, 'Pagamento de atrasados', 1e9);
      ensure(
        command.amount <= arrears(w, actor) && command.amount <= freeCash(w, actor),
        'Revise o total devido e o caixa livre.',
      );
      let remaining = command.amount;
      for (const due of w
        .obligations!.filter((o) => o.companyId === actor && o.amount > o.paid)
        .sort(
          (a, b) =>
            (a.kind === 'payroll' ? 0 : 1) - (b.kind === 'payroll' ? 0 : 1) || a.dueAt - b.dueAt,
        )) {
        const amount = Math.min(remaining, due.amount - due.paid);
        if (!amount) continue;
        transfer(
          w,
          actor,
          due.to,
          amount,
          `Regularização · ${due.description}`,
          due.kind,
          now,
          due.establishmentId,
        );
        due.paid += amount;
        remaining -= amount;
      }
      break;
    }
    case 'mothball': {
      const e = owned(w, command.establishmentId, actor);
      ensure(
        !w.jobs.some((j) => j.establishmentId === e.id && !j.completed) &&
          !w.training?.some((t) => t.establishmentId === e.id && !t.completed),
        'Conclua produção e educação antes de suspender a estrutura.',
      );
      e.mothballed = command.enabled;
      if (command.enabled) {
        e.enabled = false;
        e.employees = 0;
        e.education = 0;
        e.automation = false;
        if (e.supplyPolicy) e.supplyPolicy.enabled = false;
      }
      e.dailyCost = operatingCosts(w, e).total;
      break;
    }
    case 'sellVehicle': {
      const v = w.vehicles.find((v) => v.id === command.vehicleId && v.companyId === actor);
      ensure(v && v.status === 'available', 'Somente veículo próprio e livre pode ser vendido.');
      const state = w.properties.find((p) => p.id === v.propertyId)!.state,
        buyer = treasuryId(state);
      const price = Math.floor((v.purchasePrice ?? 28000000) * 0.65);
      ensure(
        price > 0 && treasuryAvailable(w, state) >= price,
        'Fundo estadual sem verba livre para comprar o veículo.',
      );
      ensure(
        outstandingLoans(w, actor) <=
          collateral(w, actor) -
            Math.ceil((v.purchasePrice ?? 28000000) * w.season.config.design.collateralRatio),
        'O veículo garante crédito ativo; amortize antes de vender.',
      );
      transfer(w, buyer, actor, price, `Venda de veículo usado · ${v.name}`, 'asset-sale', now);
      company(w, actor).financingExpense =
        (company(w, actor).financingExpense ?? 0) + (v.purchasePrice ?? 28000000) - price;
      v.companyId = buyer;
      v.status = 'maintenance';
      break;
    }
    case 'buyProperty': {
      const p = w.properties.find((x) => x.id === command.propertyId);
      ensure(p, 'Propriedade não encontrada.');
      ensure(p.ownerId === null, 'Esta propriedade já foi adquirida por outra empresa.');
      ensure(
        command.name.trim().length >= 3 && command.name.trim().length <= 70,
        'Informe um nome entre 3 e 70 caracteres.',
      );
      transfer(w, actor, treasuryId(p.state), p.price, `Aquisição · ${p.name}`, 'property', now);
      p.ownerId = actor;
      w.establishments.push({
        id: `e-${p.id}`,
        name: command.name.trim(),
        companyId: actor,
        propertyId: p.id,
        category: p.category,
        inventory: {},
        unitCosts: {},
        prices: {},
        capacityT: 0,
        capacityM3: 0,
        employees: 0,
        dailyCost: 85000,
        revenue: 0,
        expenses: 0,
        enabled: false,
        installed: false,
        ...(p.category === 'mine' ? { reserve: 12000 } : {}),
      });
      const opened = w.establishments.at(-1)!;
      opened.quality = {};
      opened.specialization =
        p.category === 'industry'
          ? 'steel-bars'
          : p.category === 'mine'
            ? 'iron-extraction'
            : p.category === 'farm'
              ? 'soy-harvest'
              : undefined;
      opened.dailyCost = operatingCosts(w, opened).total;
      break;
    }
    case 'trade': {
      const offer = w.offers.find((o) => o.id === command.offerId);
      ensure(offer, 'Oferta não encontrada. Atualize o mercado.');
      const origin = establishment(w, offer.establishmentId),
        dest = owned(w, command.destinationId, actor);
      dispatch(
        w,
        actor,
        origin,
        dest,
        offer.product,
        command.quantity,
        offer.price,
        command.carrierId,
        now,
        command.expectedTotal,
      );
      break;
    }
    case 'produce': {
      integer(command.cycles, 'Ciclos', 100);
      const e = owned(w, command.establishmentId, actor),
        recipe = w.season.config.recipes.find((x) => x.id === command.recipeId);
      ensure(
        recipe && recipe.category === e.category,
        'Esta instalação não é compatível com a receita.',
      );
      ensure(e.enabled, 'Retome a operação antes de iniciar uma produção.');
      const line = productionCapacity(w, e, recipe, command.cycles);
      ensure(
        line.lines > 0,
        `${line.bottleneck}. Esta receita exige ${line.workers} funcionários e ${line.areaM2} m² por linha.`,
      );
      const property = dpOf(w, e);
      ensure(
        property.energyConnected !== false || recipe.energyKwh === 0,
        'A instalação não tem conexão de energia.',
      );
      ensure(property.water || recipe.waterM3 === 0, 'A receita exige abastecimento de água.');
      if (recipe.category === 'mine')
        ensure((e.reserve ?? 0) >= command.cycles, 'Reserva mineral insuficiente.');
      for (const [product, q] of Object.entries(recipe.input))
        ensure(
          (e.inventory[product as ProductId] ?? 0) >= q! * command.cycles,
          `Insumo insuficiente: ${products[product as ProductId].name}.`,
        );
      capacity(
        w,
        e,
        Object.fromEntries(
          [...new Set([...Object.keys(recipe.output), ...Object.keys(recipe.input)])].map((p) => [
            p,
            ((recipe.output[p as ProductId] ?? 0) - (recipe.input[p as ProductId] ?? 0)) *
              command.cycles,
          ]),
        ),
      );
      const charges = productionCharges(w, e, recipe.id, command.cycles);
      ensure(
        freeCash(w, actor) >= charges.total,
        'Saldo insuficiente para processamento, energia e água.',
      );
      transfer(
        w,
        actor,
        'treasury',
        charges.processing,
        `Produção · ${recipe.name} · ${command.cycles} ciclo(s)`,
        'operation',
        now,
        e.id,
      );
      transfer(
        w,
        actor,
        'treasury',
        charges.energy,
        `Energia da produção · ${charges.energyKwh} kWh`,
        'energy',
        now,
        e.id,
      );
      transfer(
        w,
        actor,
        'treasury',
        charges.water,
        `Água e esgoto da produção · ${charges.waterM3} m³`,
        'water',
        now,
        e.id,
      );
      let inputCost = 0;
      for (const [p, q] of Object.entries(recipe.input)) {
        inputCost += Math.round((e.unitCosts[p as ProductId] ?? 0) * q! * command.cycles);
        e.inventory[p as ProductId] = e.inventory[p as ProductId]! - q! * command.cycles;
      }
      if (recipe.category === 'mine') e.reserve! -= command.cycles;
      const previous = w.jobs
        .filter((x) => x.establishmentId === e.id && !x.completed)
        .reduce((n, j) => Math.max(n, j.finishesAt), now);
      const output = Object.fromEntries(
        Object.entries(recipe.output).map(([id, q]) => [id, q! * command.cycles]),
      );
      const weights = Object.entries(output).map(
        ([id, q]) =>
          q! *
          (marketView(w, id as ProductId).price ??
            seasonPrice(w, id as ProductId) * (products[id as ProductId].unit === 'un' ? 0.82 : 1)),
      );
      const jobCost = inputCost + charges.total,
        sumWeights = weights.reduce((n, q) => n + q, 0);
      let allocated = 0;
      const outputCosts = Object.fromEntries(
        Object.keys(output).map((id, i, ids) => {
          const cost =
            i === ids.length - 1
              ? jobCost - allocated
              : Math.round((jobCost * weights[i]) / sumWeights);
          allocated += cost;
          return [id, cost];
        }),
      );
      w.jobs.push({
        id: randomUUID(),
        establishmentId: e.id,
        recipeId: recipe.id,
        cycles: command.cycles,
        startedAt: previous,
        finishesAt: previous + line.durationMs,
        completed: false,
        cost: jobCost,
        output,
        outputCosts,
        quality: productionQuality(w, e, recipe),
        lines: line.lines,
        charges,
      });
      break;
    }
    case 'extract': {
      return executeCommand(
        w,
        actor,
        {
          type: 'produce',
          establishmentId: command.establishmentId,
          recipeId: 'iron-extraction',
          cycles: command.quantity,
        },
        now,
      );
    }
    case 'setPrice': {
      integer(command.price, 'Preço em centavos', 100000000);
      const e = owned(w, command.establishmentId, actor);
      ensure(e.category === 'retail', 'Somente lojas possuem preço de varejo.');
      ensure(command.product in e.inventory, 'Este produto não faz parte do estoque da loja.');
      e.prices[command.product] = command.price;
      break;
    }
    case 'publishOffer': {
      integer(command.price, 'Preço em centavos', 100000000);
      const e = owned(w, command.establishmentId, actor);
      ensure(
        (e.inventory[command.product] ?? 0) > 0,
        'Receba ou produza estoque antes de anunciar.',
      );
      const existing = w.offers.find(
        (x) => x.establishmentId === e.id && x.product === command.product,
      );
      if (existing) existing.price = command.price;
      else
        w.offers.push({
          id: randomUUID(),
          establishmentId: e.id,
          product: command.product,
          price: command.price,
        });
      break;
    }
    case 'toggleOperation': {
      const e = owned(w, command.establishmentId, actor);
      ensure(!e.mothballed, 'Reative a estrutura e contrate a equipe antes de operar.');
      ensure(e.installed !== false, 'Instale equipamentos antes de operar.');
      e.enabled = !e.enabled;
      break;
    }
    case 'setAutomation': {
      const e = owned(w, command.establishmentId, actor);
      ensure(e.category === 'retail', 'A reposição automática está disponível para lojas.');
      e.supplyPolicy ??= defaultSupplyPolicy(w, e);
      e.supplyPolicy.enabled = command.enabled;
      e.automation = false;
      break;
    }
    case 'configureProduction': {
      const e = owned(w, command.establishmentId, actor);
      ensure(
        !e.mothballed || !command.enabled,
        'Reative a estrutura antes de automatizar a produção.',
      );
      const r = w.season.config.recipes.find(
        (r) => r.id === command.recipeId && r.category === e.category,
      );
      ensure(r, 'Receita incompatível com esta unidade.');
      integer(command.cycles, 'Ciclos automáticos', 100);
      integer(command.dailyBudget, 'Orçamento diário', 1000000000);
      ensure(
        !w.jobs.some((j) => j.establishmentId === e.id && !j.completed) ||
          e.specialization === r.id,
        'Conclua os lotes antes de trocar a especialidade.',
      );
      e.specialization = r.id;
      e.automationCycles = command.cycles;
      e.automationDailyBudget = command.dailyBudget;
      e.automation = command.enabled;
      e.automationStatus = command.enabled ? 'Aguardando a próxima rodada' : 'Automação desativada';
      break;
    }
    case 'setWorkforce': {
      const e = owned(w, command.establishmentId, actor);
      ensure(!e.mothballed || command.employees === 0, 'Reative a estrutura antes de contratar.');
      ensure(
        Number.isSafeInteger(command.employees) &&
          command.employees >= 0 &&
          command.employees <= 1000,
        'Informe de 0 a 1.000 funcionários.',
      );
      ensure(
        command.employees >= e.employees ||
          !w.jobs.some((j) => j.establishmentId === e.id && !j.completed),
        'Conclua os lotes reservados antes de reduzir a equipe.',
      );
      ensure(
        !w.training?.some((t) => t.establishmentId === e.id && !t.completed),
        'Conclua o treinamento antes de alterar a equipe.',
      );
      // Novos contratados chegam sem a formação paga para a equipe anterior.
      if (command.employees > e.employees)
        e.education = ((e.education ?? 0) * e.employees) / command.employees;
      if (command.employees === 0) e.education = 0;
      e.employees = command.employees;
      e.dailyCost = operatingCosts(w, e).total;
      break;
    }
    case 'requestOrder': {
      integer(command.quantity, 'Quantidade');
      integer(command.maxFreight, 'Teto de frete', 1000000000);
      integer(command.deliveryDays, 'Prazo em dias', 14);
      const offer = w.offers.find((o) => o.id === command.offerId);
      ensure(offer, 'Oferta não encontrada.');
      ensure(
        command.expectedUnitPrice === undefined || command.expectedUnitPrice === offer.price,
        'O preço da oferta mudou. Revise antes de enviar o pedido.',
      );
      const dest = owned(w, command.destinationId, actor),
        origin = establishment(w, offer.establishmentId);
      ensure(
        company(w, command.carrierId).bot || command.carrierId === actor,
        'Escolha sua frota ou uma transportadora automatizada.',
      );
      ensure(
        origin.companyId !== actor,
        'Pedidos comerciais exigem outra empresa. Use a compra para transferir entre suas unidades.',
      );
      ensure(origin.enabled && dest.enabled, 'Origem e destino precisam estar em operação.');
      const q = quote(w, origin.id, dest.id, offer.product, command.quantity, command.carrierId);
      ensure(
        q.compatible && q.price <= command.maxFreight,
        'Frete indisponível ou acima do teto autorizado.',
      );
      ensure(
        q.durationMs <= command.deliveryDays * GAME_DAY,
        'Prazo menor que o tempo estimado de transporte.',
      );
      ensure(
        freeCash(w, actor) >= offer.price * command.quantity + command.maxFreight,
        'Saldo insuficiente para autorizar o pedido.',
      );
      capacity(w, dest, { [offer.product]: command.quantity });
      w.orders.push({
        id: randomUUID(),
        buyerId: actor,
        sellerId: origin.companyId,
        originId: origin.id,
        destinationId: dest.id,
        product: offer.product,
        quantity: command.quantity,
        unitPrice: offer.price,
        carrierId: command.carrierId,
        maxFreight: command.maxFreight,
        createdAt: now,
        deadline: now + command.deliveryDays * GAME_DAY,
        status: 'pending',
        escrowReserved: command.reserveFunds
          ? command.quantity * offer.price + command.maxFreight
          : 0,
      });
      break;
    }
    case 'acceptOrder': {
      const order = w.orders.find((o) => o.id === command.orderId);
      ensure(
        order && order.sellerId === actor,
        'Pedido não encontrado ou pertence a outra empresa.',
      );
      ensure(
        order.status === 'pending' && order.deadline > now && !order.proposals?.length,
        'Este pedido já foi atendido, recusado ou expirou.',
      );
      const origin = owned(w, order.originId, actor),
        dest = establishment(w, order.destinationId);
      const q = quote(w, origin.id, dest.id, order.product, order.quantity, order.carrierId);
      ensure(
        q.price <= order.maxFreight,
        'O frete supera o teto do comprador. Recuse para que ele refaça o pedido.',
      );
      ensure(now + q.durationMs <= order.deadline, 'Não há tempo para entregar até o prazo.');
      dispatch(
        w,
        order.buyerId,
        origin,
        dest,
        order.product,
        order.quantity,
        order.unitPrice,
        order.carrierId,
        now,
        undefined,
        order.id,
      );
      order.status = 'accepted';
      if (order.supplyManaged)
        w.supplyHistory!.push({
          at: now,
          establishmentId: order.destinationId,
          product: order.product,
          quantity: order.quantity,
          cost: order.quantity * order.unitPrice + q.price,
          source: 'Pedido aceito',
        });
      break;
    }
    case 'rejectOrder': {
      const order = w.orders.find((o) => o.id === command.orderId);
      ensure(
        order && (order.sellerId === actor || order.buyerId === actor),
        'Pedido de outra empresa.',
      );
      ensure(
        order.status === 'pending',
        'Somente pedidos pendentes podem ser recusados ou cancelados.',
      );
      order.status = 'rejected';
      break;
    }
    case 'fulfillInfrastructure': {
      const c = w.infrastructure.find((c) => c.id === command.contractId);
      ensure(
        c && c.status === 'open' && c.deadline > now,
        'Contrato público indisponível ou já contratado por outra empresa.',
      );
      ensure(!c.biddingEndsAt, 'Envie uma proposta; o contrato será adjudicado ao fim da disputa.');
      fulfillPublicContract(
        w,
        c,
        owned(w, command.establishmentId, actor),
        command.carrierId,
        c.unitPrice,
        now,
        command.expectedFreight,
      );
      break;
    }

    case 'configureSupply': {
      const e = owned(w, command.establishmentId, actor);
      validateSupplyPolicy(command.policy);
      for (const rule of command.policy.rules)
        if (rule.originId) {
          const origin = owned(w, rule.originId, actor);
          ensure(origin.id !== e.id, 'A conexão de reposição precisa de outra unidade de origem.');
        }
      e.supplyPolicy = structuredClone(command.policy);
      if (e.category === 'retail') e.automation = false;
      e.supplyStatus = command.policy.enabled ? 'Aguardando avaliação' : 'Reposição desativada';
      break;
    }
    case 'transferStock': {
      const origin = owned(w, command.originId, actor),
        dest = owned(w, command.destinationId, actor);
      const q = quote(w, origin.id, dest.id, command.product, command.quantity, command.carrierId);
      ensure(
        command.expectedFreight === undefined || command.expectedFreight === q.price,
        'A cotação do transporte mudou. Revise o frete.',
      );
      dispatch(
        w,
        actor,
        origin,
        dest,
        command.product,
        command.quantity,
        0,
        command.carrierId,
        now,
        q.price,
      );
      break;
    }
    case 'createPurchaseRequest': {
      integer(command.quantity, 'Quantidade');
      integer(command.unitPrice, 'Preço máximo');
      integer(command.maxFreight, 'Verba de frete', 1e9);
      integer(command.deliveryDays, 'Prazo', 14);
      const dest = owned(w, command.destinationId, actor);
      const authorized = w.orders
        .filter((o) => o.buyerId === actor && o.status === 'pending')
        .reduce((n, o) => n + o.quantity * o.unitPrice + o.maxFreight, 0);
      ensure(
        company(w, actor).balance - authorized >=
          command.quantity * command.unitPrice + command.maxFreight,
        'O caixa livre não comporta mais este pedido.',
      );
      capacity(w, dest, { [command.product]: command.quantity });
      w.orders.push({
        id: randomUUID(),
        buyerId: actor,
        sellerId: '',
        originId: '',
        destinationId: dest.id,
        product: command.product,
        quantity: command.quantity,
        unitPrice: command.unitPrice,
        carrierId: 'transbrasil',
        maxFreight: command.maxFreight,
        createdAt: now,
        deadline: now + command.deliveryDays * GAME_DAY,
        status: 'pending',
        escrowReserved: command.reserveFunds
          ? command.quantity * command.unitPrice + command.maxFreight
          : 0,
        proposals: [],
      });
      break;
    }
    case 'proposeOrder': {
      const o = w.orders.find((o) => o.id === command.orderId);
      ensure(o && o.status === 'pending' && o.deadline > now, 'Pedido encerrado ou expirado.');
      integer(command.quantity, 'Quantidade');
      integer(command.unitPrice, 'Preço');
      integer(command.maxFreight, 'Frete máximo', 1e9);
      integer(command.deliveryDays, 'Prazo', 14);
      const buying = o.buyerId === actor;
      const origin = buying
        ? establishment(w, command.establishmentId ?? o.proposals?.at(-1)?.originId ?? o.originId)
        : owned(w, command.establishmentId ?? o.originId, actor);
      if (o.sellerId)
        ensure(origin.companyId === o.sellerId, 'Este pedido negocia com outro fornecedor.');
      ensure(
        buying || !o.sellerId || o.sellerId === actor,
        'Este pedido negocia com outra empresa.',
      );
      ensure(origin.companyId !== o.buyerId, 'Transferências internas não são pedidos comerciais.');
      ensure(!buying || (o.proposals ?? []).length > 0, 'Aguarde uma proposta do fornecedor.');
      const q = quote(
        w,
        origin.id,
        o.destinationId,
        o.product,
        command.quantity,
        command.carrierId,
      );
      ensure(
        q.compatible && q.price <= command.maxFreight,
        'Frota ou teto de frete incompatível com a proposta.',
      );
      ensure(command.deliveryDays * GAME_DAY >= q.durationMs, 'O prazo não comporta o transporte.');
      o.proposals ??= [];
      o.proposals.push({
        id: randomUUID(),
        proposedBy: actor,
        sellerId: origin.companyId,
        originId: origin.id,
        unitPrice: command.unitPrice,
        quantity: command.quantity,
        maxFreight: command.maxFreight,
        carrierId: command.carrierId,
        deadline: now + command.deliveryDays * GAME_DAY,
        createdAt: now,
      });
      break;
    }
    case 'acceptProposal': {
      const o = w.orders.find((o) => o.id === command.orderId),
        p = o?.proposals?.find((p) => p.id === command.proposalId);
      ensure(
        o && p && o.status === 'pending' && o.deadline > now && p.deadline > now,
        'Proposta encerrada.',
      );
      ensure(
        p.proposedBy !== actor && (actor === o.buyerId || actor === p.sellerId),
        'A contraparte precisa aceitar estes termos.',
      );
      ensure(
        p.proposedBy === o.buyerId || p.proposedBy === p.sellerId,
        'Proposta sem autorização.',
      );
      if (o.sellerId)
        ensure(o.proposals!.at(-1)!.id === p.id, 'Existe uma contraproposta mais recente.');
      const q = quote(w, p.originId, o.destinationId, o.product, p.quantity, p.carrierId);
      ensure(
        q.price <= p.maxFreight && now + q.durationMs <= p.deadline,
        'Frete ou prazo da proposta deixou de ser viável.',
      );
      dispatch(
        w,
        o.buyerId,
        establishment(w, p.originId),
        establishment(w, o.destinationId),
        o.product,
        p.quantity,
        p.unitPrice,
        p.carrierId,
        now,
        undefined,
        o.id,
      );
      o.sellerId = p.sellerId;
      o.originId = p.originId;
      o.quantity = p.quantity;
      o.unitPrice = p.unitPrice;
      o.carrierId = p.carrierId;
      o.maxFreight = p.maxFreight;
      o.deadline = p.deadline;
      o.acceptedProposalId = p.id;
      o.status = 'accepted';
      if (o.supplyManaged)
        w.supplyHistory!.push({
          at: now,
          establishmentId: o.destinationId,
          product: o.product,
          quantity: o.quantity,
          cost: o.quantity * o.unitPrice + q.price,
          source: 'Pedido aceito',
        });
      break;
    }
    case 'bidInfrastructure': {
      const c = w.infrastructure.find((c) => c.id === command.contractId);
      ensure(
        c && c.status === 'open' && c.biddingEndsAt && now < c.biddingEndsAt,
        'A janela de propostas está encerrada.',
      );
      const e = owned(w, command.establishmentId, actor);
      integer(command.unitPrice, 'Preço proposto');
      ensure(
        !institutional(actor) && command.unitPrice <= c.unitPrice,
        'Proposta acima do teto de referência + 25%.',
      );
      ensure(
        inventoryQuality(e, c.product) >= c.minQuality &&
          (e.inventory[c.product] ?? 0) >= c.quantity,
        'Separe estoque e qualidade suficientes para participar.',
      );
      ensure(
        command.carrierId === actor || company(w, command.carrierId).bot,
        'Frota de outro jogador exige autorização.',
      );
      const q = quote(w, e.id, c.destinationId, c.product, c.quantity, command.carrierId);
      ensure(
        q.compatible && q.price <= c.maxFreight && c.biddingEndsAt + q.durationMs <= c.deadline,
        'Transporte não atende verba, capacidade ou prazo.',
      );
      const score = Math.round(
        Math.min(25, Math.max(0, (c.unitPrice - command.unitPrice) / (c.unitPrice * 0.25)) * 25) +
          inventoryQuality(e, c.product) * 0.45 +
          Math.max(0, 1 - q.durationMs / (c.deadline - c.biddingEndsAt)) * 20 +
          Math.max(0, 1 - q.price / c.maxFreight) * 10,
      );
      c.bids ??= [];
      c.bids = c.bids.filter((b) => b.supplierId !== actor);
      c.bids.push({
        id: randomUUID(),
        supplierId: actor,
        originId: e.id,
        carrierId: command.carrierId,
        unitPrice: command.unitPrice,
        quality: inventoryQuality(e, c.product),
        deliveryMs: q.durationMs,
        freight: q.price,
        score,
        createdAt: now,
        status: 'valid',
      });
      break;
    }
    case 'trainWorkforce': {
      const e = owned(w, command.establishmentId, actor),
        t = trainingQuote(w, e);
      ensure(
        ['industry', 'farm', 'mine'].includes(e.category),
        'Educação produtiva está disponível nas unidades que fabricam ou extraem produtos.',
      );
      ensure(
        e.employees > 0 && t.targetLevel <= w.season.config.competition.educationMaxLevel,
        'Contrate equipe ou verifique o nível máximo de educação.',
      );
      ensure(
        !w.training!.some((t) => t.establishmentId === e.id && !t.completed),
        'A equipe já está em treinamento.',
      );
      transfer(
        w,
        actor,
        'treasury',
        t.cost,
        `Educação da equipe · nível ${t.targetLevel}`,
        'education',
        now,
        e.id,
      );
      e.expenses += t.cost;
      w.training!.push({
        id: randomUUID(),
        establishmentId: e.id,
        cost: t.cost,
        targetLevel: t.targetLevel,
        finishesAt: now + t.durationMs,
        completed: false,
      });
      break;
    }

    case 'buyVehicle': {
      const depot = w.establishments.find(
        (x) => x.companyId === actor && (x.category === 'logistics' || x.category === 'warehouse'),
      );
      ensure(depot, 'Adquira uma propriedade logística ou um armazém para receber o veículo.');
      transfer(
        w,
        actor,
        'treasury',
        28000000,
        'Aquisição de caminhão pesado · 30 t',
        'vehicle',
        now,
      );
      w.vehicles.push({
        id: randomUUID(),
        companyId: actor,
        name: `TRK-${String(w.vehicles.length + 100)}`,
        capacityT: 30,
        capacityM3: 85,
        propertyId: depot.propertyId,
        status: 'available',
      });
      break;
    }
    default:
      throw new RuleError('Operação desconhecida.');
  }
  w.revision++;
  w.updatedAt = now;
}

function economicTick(w: World, at: number) {
  // Demanda do mundo: população representada na temporada, orçamento e preços internos.
  const retail = w.establishments.filter((e) => e.category === 'retail' && e.enabled);
  const cities = new Set(retail.map((e) => w.properties.find((p) => p.id === e.propertyId)!.city));
  const calendar = gameCalendar(w, at);
  const carry = (w.retailCarry ??= {});
  // Primeiro a procura de cada loja e produto; depois a capacidade de atendimento é repartida.
  const wanted: { e: Establishment; product: ProductId; regionId: string; desired: number }[] = [];
  for (const city of cities)
    for (const product of householdItems(w)) {
      const stores = retail.filter(
        (e) =>
          w.properties.find((p) => p.id === e.propertyId)!.city === city &&
          product in e.inventory &&
          (e.prices[product] ?? 0) > 0,
      );
      const region = regionFor(
        dpOf(w, stores[0] ?? retail.find((e) => dpOf(w, e).city === city)!).coordinates,
        city,
      );
      const demand = (householdDemand(w, region.id, product) * calendar.factor) / 12;
      const score = (e: Establishment) =>
        Math.pow(seasonPrice(w, product) / e.prices[product]!, 1.4) *
        (0.5 + inventoryQuality(e, product) / 100);
      const totalScore = stores.reduce((n, e) => n + score(e), 0);
      for (const e of stores) {
        // Auditoria M04: a fração que não forma uma unidade fica para a próxima rodada.
        const key = `${e.id}:${product}`;
        const exact =
          ((demand * score(e)) / totalScore) * Math.min(1.2, score(e)) + (carry[key] ?? 0);
        const desired = Math.max(0, Math.floor(exact));
        carry[key] = Math.max(0, exact - desired);
        wanted.push({ e, product, regionId: region.id, desired });
      }
    }
  // Auditoria M05: sem capacidade para tudo, cada produto recebe parte proporcional à procura.
  const service = new Map<string, number>();
  for (const e of retail) {
    const rows = wanted.filter((x) => x.e === e && x.desired > 0);
    const asked = rows.reduce((n, x) => n + Math.min(x.desired, x.e.inventory[x.product]!), 0);
    const capacity = retailCapacity(w, e);
    if (asked <= capacity) {
      for (const x of rows) service.set(`${e.id}:${x.product}`, x.desired);
      continue;
    }
    const shares = rows.map((x) => {
      const exact = (capacity * Math.min(x.desired, x.e.inventory[x.product]!)) / asked;
      return { x, units: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    let left = capacity - shares.reduce((n, s) => n + s.units, 0);
    for (const s of [...shares].sort(
      (a, b) => b.rest - a.rest || a.x.product.localeCompare(b.x.product),
    ))
      if (left-- > 0) s.units++;
    for (const s of shares) service.set(`${e.id}:${s.x.product}`, s.units);
  }
  for (const { e, product, regionId, desired } of wanted) {
    const quantity = Math.min(
      e.inventory[product]!,
      desired,
      service.get(`${e.id}:${product}`) ?? 0,
      Math.floor(company(w, 'consumers').balance / e.prices[product]!),
    );
    w.consumptionHistory.push({
      at,
      establishmentId: e.id,
      product,
      desired,
      sold: quantity,
      weekday: calendar.weekday,
      quality: inventoryQuality(e, product),
    });
    if (!quantity) continue;
    const amount = quantity * e.prices[product]!;
    transfer(
      w,
      'consumers',
      e.companyId,
      amount,
      `Varejo · ${e.name} · ${quantity} ${products[product].unit} de ${products[product].name}`,
      'retail',
      at,
      e.id,
      {
        product,
        quantity,
        unitPrice: e.prices[product]!,
        regionId,
        channel: 'retail',
      },
    );
    e.inventory[product]! -= quantity;
    e.revenue += amount;
    e.expenses += Math.round((e.unitCosts[product] ?? 0) * quantity);
  }
  // Pausar a produção não encerra contratos de trabalho nem manutenção.
  for (const e of w.establishments) {
    if (institutional(e.companyId)) continue;
    const costs = operatingCosts(w, e);
    e.dailyCost = costs.total;
    const parts: { kind: Entry['kind']; amount: number; to: string; description: string }[] = [
      {
        kind: 'payroll',
        amount: Math.round(costs.payroll / 12),
        to: 'consumers',
        description: 'Salários e encargos do cenário',
      },
      {
        kind: 'maintenance',
        amount: Math.round(costs.maintenance / 12),
        to: 'treasury',
        description: 'Manutenção da instalação',
      },
      {
        kind: 'energy',
        amount: Math.round(costs.energy / 12),
        to: 'treasury',
        description: `Energia da instalação · ${(costs.energyKwh / 12).toFixed(2)} kWh`,
      },
      {
        kind: 'water',
        amount: Math.round(costs.water / 12),
        to: 'treasury',
        description: `Água e esgoto · ${(costs.waterM3 / 12).toFixed(2)} m³`,
      },
    ];
    const total = parts.reduce((n, p) => n + p.amount, 0);
    if (freeCash(w, e.companyId) < total) {
      e.enabled = false;
      const day = Math.floor((at - w.season.startedAt) / GAME_DAY);
      for (const part of parts.filter((p) => p.amount > 0)) {
        const id = `${e.id}:${part.kind}:${day}`,
          prior = w.obligations!.find((o) => o.id === id);
        if (prior) prior.amount += part.amount;
        else
          w.obligations!.push({
            id,
            companyId: e.companyId,
            establishmentId: e.id,
            to: part.to === 'treasury' ? treasuryId(dpOf(w, e).state) : part.to,
            kind: part.kind as 'payroll' | 'maintenance' | 'energy' | 'water',
            amount: part.amount,
            paid: 0,
            description: `${part.description} · ${e.name}`,
            dueAt: at,
          });
      }
      e.expenses += total;
      continue;
    }
    for (const part of parts)
      transfer(
        w,
        e.companyId,
        part.to,
        part.amount,
        `${part.description} · ${e.name}`,
        part.kind,
        at,
        e.id,
      );
    e.expenses += total;
  }
  w.consumptionHistory = w.consumptionHistory.slice(-20000);
  for (const order of w.orders)
    if (order.status === 'pending' && order.deadline <= at) order.status = 'expired';
  for (const c of w.infrastructure)
    if (c.status === 'open' && c.deadline <= at) c.status = 'expired';
  updateWages(w, at);
  updatePublicBenchmarks(w, at);
  for (const loan of w.loans ?? []) {
    if (loan.repaid >= loan.principal || at < loan.nextDueAt) continue;
    const days = Math.min(loan.durationDays, Math.floor((at - loan.createdAt) / GAME_DAY));
    const due = Math.max(0, Math.floor((loan.principal * days) / loan.durationDays) - loan.repaid);
    const amount = Math.min(due, freeCash(w, loan.companyId));
    if (amount > 0) {
      transfer(
        w,
        loan.companyId,
        loan.treasuryId,
        amount,
        'Parcela de principal do crédito de recuperação',
        'repayment',
        at,
      );
      loan.repaid += amount;
    }
    loan.nextDueAt = loan.createdAt + (days + 1) * GAME_DAY;
  }
  regionalizeTreasury(w, at);
  openInfrastructure(w, at);
  runSupplyPolicies(w, at);
  runAutomations(w, at);
  runBotDirector(w, at);
  recordMarket(w, at);
}

function fulfillPublicContract(
  w: World,
  c: World['infrastructure'][number],
  e: Establishment,
  carrierId: string,
  price: number,
  at: number,
  expectedFreight?: number,
) {
  ensure(!institutional(e.companyId), 'O governo contrata fornecedores externos.');
  ensure(inventoryQuality(e, c.product) >= c.minQuality, 'Qualidade abaixo do mínimo do contrato.');
  const q = quote(w, e.id, c.destinationId, c.product, c.quantity, carrierId),
    payer = c.treasuryId ?? 'treasury';
  ensure(
    (expectedFreight === undefined || q.price === expectedFreight) &&
      q.compatible &&
      q.price <= c.maxFreight,
    'Cotação mudou ou ultrapassou a verba de frete do contrato.',
  );
  ensure(at + q.durationMs <= c.deadline, 'O transporte não chega dentro do prazo contratado.');
  const reserved = w.infrastructure
    .filter((x) => x.status === 'open' && (x.treasuryId ?? 'treasury') === payer && x.id !== c.id)
    .reduce((n, x) => n + x.reserved, 0);
  ensure(
    company(w, payer).balance - reserved >= c.quantity * price + q.price,
    'Verba pública comprometida por outra obrigação.',
  );
  dispatch(
    w,
    payer,
    e,
    establishment(w, c.destinationId),
    c.product,
    c.quantity,
    price,
    carrierId,
    at,
    c.quantity * price + q.price,
    undefined,
    c.id,
  );
  c.supplierId = e.companyId;
  c.originId = e.id;
  c.status = 'delivering';
  c.paid = c.quantity * price + q.price;
  c.unitPrice = price;
}
function openInfrastructure(w: World, at: number) {
  for (const c of w.infrastructure.filter(
    (c) => c.status === 'open' && c.biddingEndsAt && c.biddingEndsAt <= at,
  )) {
    // A pontuação final usa estoque, qualidade e frota vigentes no fechamento.
    for (const b of c.bids ?? []) {
      if (b.status !== 'valid') continue;
      const e = establishment(w, b.originId),
        q = quote(w, e.id, c.destinationId, c.product, c.quantity, b.carrierId),
        quality = inventoryQuality(e, c.product);
      if (
        availableStock(w, e, c.product) < c.quantity ||
        quality < c.minQuality ||
        !q.compatible ||
        q.price > c.maxFreight ||
        at + q.durationMs > c.deadline
      ) {
        b.status = 'invalid';
        b.reason = 'Estoque, qualidade, frota, frete ou prazo deixaram de atender ao edital.';
        continue;
      }
      b.quality = quality;
      b.freight = q.price;
      b.deliveryMs = q.durationMs;
      b.score = Math.round(
        Math.min(25, Math.max(0, (c.unitPrice - b.unitPrice) / (c.unitPrice * 0.25)) * 25) +
          quality * 0.45 +
          Math.max(0, 1 - q.durationMs / (c.deadline - c.biddingEndsAt!)) * 20 +
          Math.max(0, 1 - q.price / c.maxFreight) * 10,
      );
    }
    for (const b of [...(c.bids ?? [])]
      .filter((b) => b.status === 'valid')
      .sort((a, b) => b.score - a.score || a.createdAt - b.createdAt)) {
      try {
        fulfillPublicContract(w, c, establishment(w, b.originId), b.carrierId, b.unitPrice, at);
        b.status = 'won';
        for (const other of c.bids!)
          if (other.id !== b.id && other.status === 'valid') other.status = 'lost';
        break;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        b.status = 'invalid';
        b.reason = error.message;
      }
    }
    if (c.status === 'open') c.status = 'expired';
  }
  for (const state of [...new Set(w.properties.map((p) => p.state))]) {
    const available = treasuryAvailable(w, state),
      active = w.infrastructure.filter((c) => c.state === state && c.status === 'open').length;
    const last = w.infrastructure.filter((c) => c.state === state).at(-1);
    if (
      active >=
        Math.min(
          w.season.config.competition.maxOpenContracts,
          Math.floor(available / 20000000) + 1,
        ) ||
      (last && at - last.createdAt < GAME_DAY / 2)
    )
      continue;
    const cities = w.establishments.filter(
      (e) => e.companyId === treasuryId(state) && e.propertyId.startsWith('municipal-'),
    );
    if (!cities.length) continue;
    const sequence = w.infrastructure.filter((c) => c.state === state).length,
      program = infrastructurePrograms[sequence % infrastructurePrograms.length],
      destination = cities[sequence % cities.length],
      place = dpOf(w, destination);
    const referencePrice = publicReference(w, program.product),
      unitPrice = Math.round(referencePrice * w.season.config.competition.governmentBonus);
    const quantity = program.quantity,
      maxFreight = Math.max(250000, Math.round(unitPrice * quantity * 0.2)),
      reserved = unitPrice * quantity + maxFreight;
    if (available < reserved) continue;
    w.infrastructure.push({
      id: randomUUID(),
      title: program.name,
      program: program.name,
      product: program.product,
      quantity,
      unitPrice,
      referencePrice,
      referenceSource: w.publicBenchmarks?.[program.product]?.source ?? 'opening',
      minQuality: program.quality,
      maxFreight,
      reserved,
      createdAt: at,
      biddingEndsAt: at + (w.season.config.competition.biddingHours * 3600000) / TIME_SCALE,
      deadline: at + GAME_DAY * 4,
      destinationId: destination.id,
      status: 'open',
      deliveredQuantity: 0,
      state,
      municipality: place.city,
      treasuryId: treasuryId(state),
      bids: [],
    });
  }
}
function runAutomations(w: World, at: number) {
  const tracing = hasDecisionTrace(w);
  const trace = (
    e: Establishment,
    code: string,
    message: string,
    action = 'produce',
    outcome: 'blocked' | 'idle' = 'blocked',
    targetId?: string,
  ) => {
    if (tracing)
      emitDecisionTrace(w, {
        at,
        companyId: e.companyId,
        source: 'production',
        outcome,
        action,
        code,
        message,
        establishmentId: e.id,
        targetId,
        productId: targetId && targetId in products ? (targetId as ProductId) : undefined,
      });
  };
  const attempt = (actor: string, command: Command) => {
    try {
      withDecisionSource(w, 'production', () => execute(w, actor, command, at));
      return true;
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      return e.message;
    }
  };
  const restock = (e: Establishment, product: ProductId, target: number) => {
    const dayLength = 86400000 / TIME_SCALE,
      dayStart = w.createdAt + Math.floor((at - w.createdAt) / dayLength) * dayLength;
    const budget = e.automationDailyBudget ?? (e.category === 'industry' ? 10000000 : 3000000);
    const spent =
      w.ledger
        .filter(
          (l) =>
            l.from === e.companyId &&
            l.establishmentId === e.id &&
            l.at >= dayStart &&
            (l.kind === 'trade' || l.kind === 'freight'),
        )
        .reduce((n, l) => n + l.amount, 0) +
      (e.category === 'retail'
        ? 0
        : w.jobs
            .filter((j) => j.establishmentId === e.id && j.startedAt >= dayStart)
            .reduce(
              (n, j) =>
                n + (j.charges ? j.charges.processing + j.charges.energy + j.charges.water : 0),
              0,
            ));
    const incoming = w.shipments
      .filter((s) => s.destinationId === e.id && s.product === product && !s.delivered)
      .reduce((n, s) => n + s.quantity, 0);
    const ordered = w.orders
      .filter((o) => o.destinationId === e.id && o.product === product && o.status === 'pending')
      .reduce((n, o) => n + o.quantity, 0);
    const shortage = Math.floor(target - (e.inventory[product] ?? 0) - incoming - ordered);
    if (shortage <= 0) {
      trace(
        e,
        'replenishment-covered',
        'Estoque, remessas e pedidos pendentes já cobrem o alvo da reposição.',
        'restock',
        'idle',
        product,
      );
      return;
    }
    const options = w.offers
      .filter((o) => o.product === product && o.establishmentId !== e.id)
      .map((o) => ({ o, origin: establishment(w, o.establishmentId) }))
      .filter((x) => x.origin.enabled && (x.origin.inventory[product] ?? 0) > 0)
      .map(({ o, origin }) => {
        const quantity = Math.min(
          shortage,
          origin.inventory[product]!,
          Math.floor(30 / products[product].massT),
          Math.floor(85 / products[product].volumeM3),
        );
        const q = [e.companyId, 'transbrasil', 'rodoleste', 'expresso']
          .map((c) => quote(w, origin.id, e.id, product, quantity, c))
          .filter((q) => {
            if (tracing && !q.compatible)
              trace(
                e,
                q.routeRequired
                  ? 'road-route-pending'
                  : q.fleet.available === 0
                    ? 'fleet-unavailable'
                    : 'load-incompatible',
                `Cotação de reposição incompatível: ${q.unallocated} unidades não alocadas; ${q.fleet.available} veículos disponíveis.`,
                'restock',
                'blocked',
                product,
              );
            return q.compatible;
          })
          .sort((a, b) => a.price - b.price)[0];
        return {
          o,
          origin,
          quantity,
          q,
          total: q
            ? (origin.companyId === e.companyId ? 0 : o.price * quantity) + q.price
            : Infinity,
        };
      })
      .filter((x) => {
        const eligible =
          x.q &&
          x.quantity > 0 &&
          x.total <= Math.min(company(w, e.companyId).balance * 0.25, budget - spent);
        if (tracing && x.q && x.quantity > 0 && !eligible)
          trace(
            e,
            'replenishment-spending-limit',
            'O custo cotado excedeu o menor limite entre 25% do saldo e o orçamento restante da reposição.',
            'restock',
            'blocked',
            product,
          );
        return eligible;
      })
      .sort((a, b) => a.total / a.quantity - b.total / b.quantity);
    const best = options[0];
    if (best) {
      const sellerIsHuman =
        !company(w, best.origin.companyId).bot && best.origin.companyId !== e.companyId;
      attempt(e.companyId, {
        type: sellerIsHuman ? 'requestOrder' : 'trade',
        offerId: best.o.id,
        destinationId: e.id,
        quantity: best.quantity,
        carrierId: best.q!.carrierId,
        ...(sellerIsHuman
          ? { maxFreight: best.q!.price, deliveryDays: 3, expectedUnitPrice: best.o.price }
          : {}),
      } as Command);
    } else
      trace(
        e,
        'no-replenishment-candidate',
        'Nenhuma oferta passou pelos filtros de origem ativa, estoque, frete compatível e limite de gasto desta reposição.',
        'restock',
        'blocked',
        product,
      );
  };
  if (tracing)
    for (const e of w.establishments) {
      if (e.automation && !e.enabled)
        trace(e, 'operation-paused', 'A automação não foi rodada porque a operação está pausada.');
      else if (!e.automation && ['industry', 'farm', 'mine'].includes(e.category))
        trace(
          e,
          'production-automation-disabled',
          'A produção automática está desativada nesta unidade.',
          'produce',
          'idle',
        );
    }
  for (const e of w.establishments.filter((e) => e.enabled && e.automation)) {
    const bot = company(w, e.companyId).bot;
    if (e.category === 'retail' && !e.supplyPolicy?.enabled)
      for (const product of householdItems(w)) {
        const region = regionFor(dpOf(w, e).coordinates, dpOf(w, e).city);
        const competitors = Math.max(
          1,
          w.establishments.filter(
            (x) => x.enabled && x.category === 'retail' && dpOf(w, x).city === dpOf(w, e).city,
          ).length,
        );
        const target = Math.ceil((householdDemand(w, region.id, product) / competitors) * 3);
        if ((e.inventory[product] ?? 0) < target / 3) restock(e, product, target);
        if (bot && (e.inventory[product] ?? 0) > 0)
          e.prices[product] = Math.round(
            Math.max((e.unitCosts[product] ?? 0) * 1.25, seasonPrice(w, product) * 0.9),
          );
      }
    if (e.category === 'retail') continue;
    if (w.jobs.some((j) => j.establishmentId === e.id && !j.completed)) {
      e.automationStatus = 'Lote em processamento';
      trace(e, 'batch-in-progress', e.automationStatus, 'produce', 'idle');
      continue;
    }
    {
      const r = w.season.config.recipes.find(
        (r) => r.id === e.specialization && r.category === e.category,
      );
      if (!r) {
        trace(
          e,
          'recipe-unavailable',
          'Nenhuma receita corresponde à especialidade e categoria desta unidade.',
        );
        continue;
      }
      const outputProduct = Object.keys(r.output)[0] as ProductId;
      // Auditoria M07: três dias da demanda das famílias, repartidos entre os produtores ativos.
      const producers = w.establishments.filter(
        (x) => x.enabled && !x.mothballed && x.specialization === r.id,
      ).length;
      const target =
        outputProduct === 'oil'
          ? Math.max(600, (marketView(w, 'oil').householdDemand * 3) / Math.max(1, producers))
          : e.category === 'industry'
            ? Math.max(
                64,
                ...w.infrastructure
                  .filter((c) => c.status === 'open' && c.product === outputProduct)
                  .map((c) => c.quantity),
              )
            : 200;
      if (!bot || (e.inventory[outputProduct] ?? 0) < target) {
        const cycles = Math.min(
          e.automationCycles ?? 1,
          e.category === 'mine' ? (e.reserve ?? 0) : 100,
        );
        if (!cycles) {
          e.automationStatus = 'Reserva mineral esgotada';
          trace(e, 'mineral-depleted', e.automationStatus);
          continue;
        }
        const dayStart = w.createdAt + Math.floor((at - w.createdAt) / GAME_DAY) * GAME_DAY;
        const productionSpent = w.jobs
          .filter((j) => j.establishmentId === e.id && j.startedAt >= dayStart)
          .reduce(
            (n, j) =>
              n + (j.charges ? j.charges.processing + j.charges.energy + j.charges.water : 0),
            0,
          );
        const purchasingSpent = 0; // orçamento de reposição é configurado separadamente
        const charges = productionCharges(w, e, r.id, cycles);
        if (
          productionSpent + purchasingSpent + charges.total >
          (e.automationDailyBudget ?? 10000000)
        ) {
          e.automationStatus = 'Limite diário de automação atingido';
          trace(e, 'production-daily-budget', e.automationStatus);
          continue;
        }
        let ready = true;
        for (const [id, q] of Object.entries(r.input))
          if ((e.inventory[id as ProductId] ?? 0) < q! * cycles) {
            // Automação humana produz estoque existente; reposição industrial automática é uma escolha dos bots.
            if (bot && !e.supplyPolicy?.enabled) restock(e, id as ProductId, q! * cycles * 4);
            ready = false;
            trace(
              e,
              'inputs-missing',
              `${products[id as ProductId].name}: estoque ${e.inventory[id as ProductId] ?? 0}; lote exige ${q! * cycles}.`,
              'produce',
              'blocked',
              id,
            );
          }
        if (ready) {
          const result = attempt(e.companyId, {
            type: 'produce',
            establishmentId: e.id,
            recipeId: r.id,
            cycles,
          });
          e.automationStatus = result === true ? 'Lote iniciado' : result;
        } else e.automationStatus = 'Aguardando insumos no estoque';
      } else
        trace(
          e,
          'target-stock-reached',
          'O estoque do produto principal atingiu o alvo usado pela automação do bot.',
          'produce',
          'idle',
          outputProduct,
        );
    }
  }
  for (const e of w.establishments.filter((e) => e.enabled && company(w, e.companyId).bot))
    for (const [id, quantity] of Object.entries(e.inventory) as [ProductId, number][]) {
      if (
        quantity <= 0 ||
        e.category === 'retail' ||
        (e.category === 'industry' && ['soy', 'iron', 'coal'].includes(id))
      )
        continue;
      const daily = marketView(w, id).demand;
      const scarce = daily > 0 ? Math.max(0, 1 - quantity / Math.max(daily * 3, 1)) : 0;
      const price = Math.max(
        1,
        Math.round((e.unitCosts[id] ?? seasonPrice(w, id) * 0.75) * (1.12 + scarce * 0.18)),
      );
      const offer = w.offers.find((o) => o.establishmentId === e.id && o.product === id);
      if (offer) offer.price = price;
      else w.offers.push({ id: randomUUID(), establishmentId: e.id, product: id, price });
    }
  for (const contract of w.infrastructure.filter((c) => c.status === 'open' && !c.biddingEndsAt)) {
    const candidates = w.establishments
      .filter(
        (e) =>
          company(w, e.companyId).bot &&
          e.companyId !== 'treasury' &&
          (e.inventory.steel ?? 0) >= contract.quantity &&
          contract.unitPrice >= (e.unitCosts.steel ?? 0) * 1.05,
      )
      .flatMap((e) =>
        [e.companyId, 'transbrasil', 'rodoleste', 'expresso'].map((carrier) => ({
          e,
          q: quote(w, e.id, contract.destinationId, 'steel', contract.quantity, carrier),
        })),
      )
      .filter(({ q }) => q.compatible && q.price <= contract.maxFreight)
      .sort((a, b) => a.q.price - b.q.price);
    for (const { e, q } of candidates)
      if (
        attempt(e.companyId, {
          type: 'fulfillInfrastructure',
          contractId: contract.id,
          establishmentId: e.id,
          carrierId: q.carrierId,
          expectedFreight: q.price,
        }) === true
      )
        break;
  }
  // Demanda pública pode justificar uma fábrica, sem ofertar estoque inicial gratuito.
  if (
    w.infrastructure.some((c) => c.status === 'open') &&
    !w.establishments.some((e) => company(w, e.companyId).bot && e.specialization === 'steel-bars')
  ) {
    const investor = w.companies
      .filter(
        (c) =>
          c.bot && w.establishments.some((e) => e.companyId === c.id && e.category === 'industry'),
      )
      .sort((a, b) => b.balance - a.balance)[0];
    const property = w.properties
      .filter((p) => p.ownerId === null && p.category === 'industry')
      .sort((a, b) => a.price - b.price)[0];
    if (investor && property) {
      const preview: Establishment = {
        ...w.establishments.find((e) => e.companyId === investor.id)!,
        employees: openingWorkers('industry'),
        propertyId: property.id,
        category: 'industry',
      };
      const reserve =
        operatingCosts(w, preview).total * w.season.config.operations.expansionReserveDays +
        20000000;
      const r = w.season.config.recipes.find((r) => r.id === 'steel-bars')!;
      const inputCost = Object.entries(r.input).reduce(
        (n, [id, quantity]) => n + (marketView(w, id as ProductId).price ?? Infinity) * quantity!,
        0,
      );
      const cycleCost = inputCost + productionCharges(w, preview, r.id, 1).total;
      const contract = w.infrastructure.find((c) => c.status === 'open')!;
      if (
        cycleCost < contract.unitPrice * r.output.steel! * 0.9 &&
        freeCash(w, investor.id) >=
          property.price + reserve + w.season.config.design.equipmentCost[property.category] &&
        attempt(investor.id, {
          type: 'buyProperty',
          propertyId: property.id,
          name: `${investor.name} · Aço para infraestrutura`,
        }) === true
      ) {
        investor.lastExpansionAt = at;
        attempt(investor.id, {
          type: 'configureProduction',
          establishmentId: w.establishments.at(-1)!.id,
          recipeId: 'steel-bars',
          cycles: 1,
          dailyBudget: 25000000,
          enabled: true,
        });
      }
    }
  }
  for (const c of w.companies.filter((c) => c.bot && !['treasury', 'consumers'].includes(c.id))) {
    const units = w.establishments.filter((e) => e.companyId === c.id);
    if (units.length >= 5 || (c.lastExpansionAt !== undefined && at - c.lastExpansionAt < GAME_DAY))
      continue;
    const template = units.find(
      (e) =>
        e.enabled &&
        e.revenue > e.expenses &&
        ['retail', 'farm', 'mine', 'industry'].includes(e.category),
    );
    if (!template) continue;
    const property = w.properties
      .filter((p) => p.ownerId === null && p.category === template.category)
      .sort((a, b) => a.price - b.price)[0];
    if (
      !property ||
      c.balance <
        property.price +
          w.season.config.design.equipmentCost[property.category] +
          Math.max(template.dailyCost, 100000) * w.season.config.operations.expansionReserveDays
    )
      continue;
    if (
      attempt(c.id, {
        type: 'buyProperty',
        propertyId: property.id,
        name: `${c.name} · ${property.city}`,
      }) === true
    ) {
      c.lastExpansionAt = at;
      const opened = w.establishments.at(-1)!;
      opened.automation = true;
      opened.specialization = template.specialization;
      opened.automationDailyBudget = template.automationDailyBudget;
    }
  }
}

export function advance(w: World, now = Date.now()) {
  ensure(now >= w.updatedAt, 'O relógio não pode retroceder.');
  let changed = false;
  // Eventos ordenados asseguram o mesmo resultado online e offline, com limite por lote.
  for (let count = 0; count < 5000; count++) {
    const next = Math.min(
      w.nextEconomicAt,
      ...w.shipments.filter((x) => !x.delivered).map((x) => x.arrivesAt),
      ...w.jobs.filter((x) => !x.completed).map((x) => x.finishesAt),
      ...(w.training ?? []).filter((t) => !t.completed).map((t) => t.finishesAt),
    );
    if (next > now) break;
    for (const s of w.shipments.filter((x) => !x.delivered && x.arrivesAt <= next)) {
      const dest = establishment(w, s.destinationId),
        previous = dest.inventory[s.product] ?? 0;
      if (s.infrastructureId) {
        const contract = w.infrastructure.find((c) => c.id === s.infrastructureId)!;
        contract.deliveredQuantity += s.quantity;
        w.consumedMaterials[s.product] = (w.consumedMaterials[s.product] ?? 0) + s.quantity;
        if (contract.deliveredQuantity === contract.quantity) contract.status = 'completed';
      } else {
        dest.quality ??= {};
        dest.quality[s.product] =
          (inventoryQuality(dest, s.product) * previous + (s.quality ?? 70) * s.quantity) /
          (previous + s.quantity);
        dest.unitCosts[s.product] =
          ((dest.unitCosts[s.product] ?? 0) * previous + s.cost + s.freight) /
          (previous + s.quantity);
        dest.inventory[s.product] = previous + s.quantity;
        if (dest.category === 'retail' && dest.prices[s.product] === undefined)
          dest.prices[s.product] = seasonPrice(w, s.product);
      }
      const vehicle = w.vehicles.find((x) => x.id === s.vehicleId)!;
      vehicle.status = 'available';
      vehicle.propertyId = dest.propertyId;
      s.delivered = true;
      if (s.orderId) {
        const order = w.orders.find((o) => o.id === s.orderId)!;
        if (w.shipments.filter((x) => x.orderId === order.id).every((x) => x.delivered))
          order.status = 'delivered';
      }
    }
    for (const j of w.jobs.filter((x) => !x.completed && x.finishesAt <= next)) {
      const e = establishment(w, j.establishmentId),
        r = w.season.config.recipes.find((x) => x.id === j.recipeId)!;
      const output =
        j.output ??
        Object.fromEntries(Object.entries(r.output).map(([p, q]) => [p, q! * j.cycles]));
      const outputCount = Object.keys(output).length;
      for (const [p, q] of Object.entries(output)) {
        const previous = e.inventory[p as ProductId] ?? 0,
          quantity = q!;
        e.quality ??= {};
        e.quality[p as ProductId] =
          (inventoryQuality(e, p as ProductId) * previous + (j.quality ?? 70) * quantity) /
          (previous + quantity);
        e.unitCosts[p as ProductId] =
          ((e.unitCosts[p as ProductId] ?? 0) * previous +
            (j.outputCosts?.[p as ProductId] ?? j.cost / outputCount)) /
          (previous + quantity);
        e.inventory[p as ProductId] = previous + quantity;
      }
      j.completed = true;
    }
    for (const t of (w.training ?? []).filter((t) => !t.completed && t.finishesAt <= next)) {
      establishment(w, t.establishmentId).education = t.targetLevel;
      t.completed = true;
    }
    if (w.nextEconomicAt <= next) {
      economicTick(w, next);
      w.nextEconomicAt += ECONOMIC_INTERVAL;
    }
    changed = true;
  }
  if (changed) {
    w.updatedAt = now;
    w.revision++;
  }
  return changed;
}
