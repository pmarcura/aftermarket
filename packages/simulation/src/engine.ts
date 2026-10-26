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
import {
  householdDemand,
  laborMarket,
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
  const sender = company(w, from),
    receiver = company(w, to);
  ensure(sender.balance >= amount, 'Saldo insuficiente para concluir esta operação.');
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
  const inv = { ...e.inventory };
  for (const s of w.shipments.filter((x) => x.destinationId === e.id && !x.delivered))
    inv[s.product] = (inv[s.product] ?? 0) + s.quantity;
  for (const j of w.jobs.filter((x) => x.establishmentId === e.id && !x.completed))
    for (const [p, q] of Object.entries(
      j.output ??
        Object.fromEntries(
          Object.entries(w.season.config.recipes.find((x) => x.id === j.recipeId)!.output).map(
            ([p, q]) => [p, q! * j.cycles],
          ),
        ),
    ))
      inv[p as ProductId] = (inv[p as ProductId] ?? 0) + q!;
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
  const vehicle = w.vehicles
    .filter(
      (x) =>
        x.companyId === carrierId &&
        x.status === 'available' &&
        x.capacityT >= load.mass &&
        x.capacityM3 >= load.volume,
    )
    .sort(
      (a, b) =>
        distanceKm(w.properties.find((p) => p.id === a.propertyId)!.coordinates, op.coordinates) -
        distanceKm(w.properties.find((p) => p.id === b.propertyId)!.coordinates, op.coordinates),
    )[0];
  const relocation = vehicle
    ? distanceKm(
        w.properties.find((x) => x.id === vehicle.propertyId)!.coordinates,
        op.coordinates,
      ) * 1.3
    : 0;
  const totalKm = km + relocation,
    roadSeconds = route?.durationSeconds ?? (km / cfg.averageSpeedKmH) * 3600;
  const relocationMs = ((relocation / cfg.averageSpeedKmH) * 3600 * 1000) / TIME_SCALE;
  const loadingMs = (cfg.loadingMinutes * 60000) / TIME_SCALE,
    roadMs = (roadSeconds * 1000) / TIME_SCALE;
  const fuel = Math.round((totalKm / cfg.kmPerLiter) * cfg.dieselPerLiter),
    maintenance = Math.round(totalKm * cfg.maintenancePerKm);
  const driver = Math.round(
      (totalKm / cfg.averageSpeedKmH + cfg.loadingMinutes / 60) * cfg.driverPerHour,
    ),
    tolls = Math.round(totalKm * cfg.estimatedTollPerKm);
  const handling = Math.round(18000 + load.mass * 500),
    operatingCost = fuel + maintenance + driver + tolls + handling;
  const markup = carrierId === 'expresso' ? 1.3 : carrierId === 'rodoleste' ? 1.2 : 1.15;
  return {
    carrierId,
    vehicleId: vehicle?.id,
    compatible: Boolean(vehicle),
    price: Math.max(28000, Math.round(operatingCost * markup)),
    distanceKm: Math.round(km * 10) / 10,
    durationMs: Math.max(15000, relocationMs + loadingMs + roadMs),
    relocationMs,
    loadingMs,
    roadMs,
    costs: { fuel, maintenance, driver, tolls, handling, operatingCost },
    source: route?.source ?? 'estimate',
    coordinates: route?.coordinates ?? [op.coordinates, dp.coordinates],
  };
}

// O chamador envolve cada comando em uma transação. Bots usam esta mesma função.
export function execute(w: World, actor: string, command: Command, now = Date.now()) {
  company(w, actor);
  switch (command.type) {
    case 'buyProperty': {
      const p = w.properties.find((x) => x.id === command.propertyId);
      ensure(p, 'Propriedade não encontrada.');
      ensure(p.ownerId === null, 'Esta propriedade já foi adquirida por outra empresa.');
      ensure(
        laborMarket(w, p).available >= 12,
        'O mercado de trabalho local não comporta os 12 contratos necessários para abrir esta unidade.',
      );
      ensure(
        command.name.trim().length >= 3 && command.name.trim().length <= 70,
        'Informe um nome entre 3 e 70 caracteres.',
      );
      transfer(w, actor, 'treasury', p.price, `Aquisição · ${p.name}`, 'property', now);
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
        capacityT: 1000,
        capacityM3: 2000,
        employees: 12,
        dailyCost: 85000,
        revenue: 0,
        expenses: 0,
        enabled: true,
        ...(p.category === 'mine' ? { reserve: 12000 } : {}),
      });
      const opened = w.establishments.at(-1)!;
      opened.dailyCost = operatingCosts(w, opened).total;
      break;
    }
    case 'trade': {
      integer(command.quantity, 'Quantidade');
      const offer = w.offers.find((x) => x.id === command.offerId);
      ensure(offer, 'Oferta não encontrada. Atualize o mercado.');
      const origin = establishment(w, offer.establishmentId),
        dest = owned(w, command.destinationId, actor);
      const internal = origin.companyId === actor;
      ensure(
        (origin.inventory[offer.product] ?? 0) >= command.quantity,
        'Estoque insuficiente no fornecedor. Reduza a quantidade.',
      );
      capacity(w, dest, { [offer.product]: command.quantity });
      const q = quote(w, origin.id, dest.id, offer.product, command.quantity, command.carrierId);
      ensure(
        q.compatible && q.vehicleId,
        'Nenhum veículo disponível comporta a massa e o volume desta carga.',
      );
      ensure(command.carrierId !== actor, 'Use uma transportadora externa neste fluxo.');
      const cost = internal
        ? Math.round((origin.unitCosts[offer.product] ?? 0) * command.quantity)
        : offer.price * command.quantity;
      ensure(
        command.expectedTotal === undefined ||
          command.expectedTotal === (internal ? 0 : cost) + q.price,
        'A cotação mudou. Revise o novo total antes de confirmar; nenhum pagamento foi feito.',
      );
      ensure(
        company(w, actor).balance >= (internal ? 0 : cost) + q.price,
        'Saldo insuficiente para mercadoria e frete.',
      );
      if (!internal)
        transfer(
          w,
          actor,
          origin.companyId,
          cost,
          `Compra · ${command.quantity} ${products[offer.product].unit} de ${products[offer.product].name}`,
          'trade',
          now,
          dest.id,
          {
            product: offer.product,
            quantity: command.quantity,
            unitPrice: offer.price,
            regionId: regionFor(dpOf(w, dest).coordinates).id,
            channel: 'wholesale',
          },
        );
      transfer(
        w,
        actor,
        command.carrierId,
        q.price,
        `Frete · ${origin.name} → ${dest.name}`,
        'freight',
        now,
        dest.id,
      );
      const carrierUnit = w.establishments.find(
        (e) => e.companyId === command.carrierId && e.category === 'logistics',
      );
      transfer(
        w,
        command.carrierId,
        'consumers',
        q.costs.driver,
        'Motorista · remuneração do frete',
        'payroll',
        now,
        carrierUnit?.id,
      );
      transfer(
        w,
        command.carrierId,
        'treasury',
        q.costs.operatingCost - q.costs.driver,
        'Combustível, manutenção, pedágios e manuseio',
        'operation',
        now,
        carrierUnit?.id,
      );
      if (carrierUnit) {
        carrierUnit.revenue += q.price;
        carrierUnit.expenses += q.costs.operatingCost;
      }
      origin.inventory[offer.product] = origin.inventory[offer.product]! - command.quantity;
      if (!internal) {
        origin.revenue += cost;
        origin.expenses += Math.round((origin.unitCosts[offer.product] ?? 0) * command.quantity);
      }
      w.vehicles.find((x) => x.id === q.vehicleId)!.status = 'route';
      w.shipments.push({
        id: randomUUID(),
        buyerId: actor,
        sellerId: origin.companyId,
        originId: origin.id,
        destinationId: dest.id,
        product: offer.product,
        quantity: command.quantity,
        cost,
        freight: q.price,
        carrierId: command.carrierId,
        vehicleId: q.vehicleId,
        departedAt: now,
        arrivesAt: now + q.durationMs,
        delivered: false,
        distance: q.distanceKm,
        route: structuredClone(q.coordinates),
        routeSource: q.source,
        pickupAt: now + q.relocationMs,
        roadDepartureAt: now + q.relocationMs + q.loadingMs,
        roadArrivalAt: now + q.durationMs,
      });
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
        company(w, actor).balance >= charges.total,
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
        finishesAt: previous + recipe.duration * command.cycles,
        completed: false,
        cost: jobCost,
        output,
        outputCosts,
        charges,
      });
      break;
    }
    case 'extract': {
      return execute(
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
      e.enabled = !e.enabled;
      break;
    }
    case 'setAutomation': {
      const e = owned(w, command.establishmentId, actor);
      ensure(e.category === 'retail', 'A reposição automática está disponível para lojas.');
      e.automation = command.enabled;
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
  for (const city of cities)
    for (const product of ['oil', 'rice', 'beans', 'sugar', 'milk'] as ProductId[]) {
      const stores = retail.filter(
        (e) =>
          w.properties.find((p) => p.id === e.propertyId)!.city === city &&
          (e.inventory[product] ?? 0) > 0 &&
          (e.prices[product] ?? 0) > 0,
      );
      const region = regionFor(
        dpOf(w, stores[0] ?? retail.find((e) => dpOf(w, e).city === city)!).coordinates,
        city,
      );
      const demand = householdDemand(w, region.id, product) / 12;
      const score = (e: Establishment) =>
        Math.pow(seasonPrice(w, product) / e.prices[product]!, 1.4);
      const totalScore = stores.reduce((n, e) => n + score(e), 0);
      for (const e of stores) {
        const quantity = Math.min(
          e.inventory[product]!,
          Math.floor(((demand * score(e)) / totalScore) * Math.min(1.2, score(e))),
          e.employees * 20,
          Math.floor(company(w, 'consumers').balance / e.prices[product]!),
        );
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
            regionId: region.id,
            channel: 'retail',
          },
        );
        e.inventory[product]! -= quantity;
        e.revenue += amount;
        e.expenses += Math.round((e.unitCosts[product] ?? 0) * quantity);
      }
    }
  // Pausar a produção não encerra contratos de trabalho nem manutenção.
  for (const e of w.establishments) {
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
    if (company(w, e.companyId).balance < total) {
      e.enabled = false;
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
  runAutomations(w, at);
  recordMarket(w, at);
}

function runAutomations(w: World, at: number) {
  const attempt = (actor: string, command: Command) => {
    try {
      execute(w, actor, command, at);
      return true;
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      return false;
    }
  };
  const restock = (e: Establishment, product: ProductId, target: number) => {
    const dayLength = 86400000 / TIME_SCALE,
      dayStart = w.createdAt + Math.floor((at - w.createdAt) / dayLength) * dayLength;
    const budget = e.automationDailyBudget ?? (e.category === 'industry' ? 10000000 : 3000000);
    const spent = w.ledger
      .filter(
        (l) =>
          l.from === e.companyId &&
          l.establishmentId === e.id &&
          l.at >= dayStart &&
          (l.kind === 'trade' || l.kind === 'freight'),
      )
      .reduce((n, l) => n + l.amount, 0);
    const incoming = w.shipments
      .filter((s) => s.destinationId === e.id && s.product === product && !s.delivered)
      .reduce((n, s) => n + s.quantity, 0);
    const shortage = Math.floor(target - (e.inventory[product] ?? 0) - incoming);
    if (shortage <= 0) return;
    const options = w.offers
      .filter((o) => o.product === product && o.establishmentId !== e.id)
      .map((o) => ({ o, origin: establishment(w, o.establishmentId) }))
      .filter((x) => (x.origin.inventory[product] ?? 0) > 0)
      .map(({ o, origin }) => {
        const quantity = Math.min(
          shortage,
          origin.inventory[product]!,
          Math.floor(30 / products[product].massT),
          Math.floor(85 / products[product].volumeM3),
        );
        const q = ['transbrasil', 'rodoleste', 'expresso']
          .map((c) => quote(w, origin.id, e.id, product, quantity, c))
          .filter((q) => q.compatible)
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
      .filter(
        (x) =>
          x.q &&
          x.quantity > 0 &&
          x.total <= Math.min(company(w, e.companyId).balance * 0.25, budget - spent),
      )
      .sort((a, b) => a.total / a.quantity - b.total / b.quantity);
    const best = options[0];
    if (best)
      attempt(e.companyId, {
        type: 'trade',
        offerId: best.o.id,
        destinationId: e.id,
        quantity: best.quantity,
        carrierId: best.q!.carrierId,
      });
  };
  for (const e of w.establishments.filter((e) => e.enabled && e.automation)) {
    const bot = company(w, e.companyId).bot;
    if (e.category === 'retail')
      for (const product of ['oil', 'rice', 'beans', 'sugar', 'milk'] as ProductId[]) {
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
    if (!bot || w.jobs.some((j) => j.establishmentId === e.id && !j.completed)) continue;
    if (e.category === 'mine' && (e.inventory.iron ?? 0) < 200 && (e.reserve ?? 0) > 0)
      attempt(e.companyId, {
        type: 'extract',
        establishmentId: e.id,
        quantity: Math.min(20, e.reserve!),
      });
    if (e.category === 'farm' && (e.inventory.soy ?? 0) < 200 && (e.inventory.soy ?? 0) >= 1)
      attempt(e.companyId, {
        type: 'produce',
        establishmentId: e.id,
        recipeId: 'soy-harvest',
        cycles: 1,
      });
    if (e.category === 'industry') {
      const r = w.season.config.recipes.find(
        (r) => r.id === (/óleo|oleo/i.test(e.name) ? 'soy-oil' : 'steel-bars'),
      )!;
      const outputProduct = Object.keys(r.output)[0] as ProductId;
      const target =
        outputProduct === 'oil' ? Math.max(600, marketView(w, 'oil').householdDemand * 3) : 64;
      if ((e.inventory[outputProduct] ?? 0) < target) {
        let ready = true;
        for (const [id, q] of Object.entries(r.input))
          if ((e.inventory[id as ProductId] ?? 0) < q!) {
            restock(e, id as ProductId, q! * 4);
            ready = false;
          }
        if (ready)
          attempt(e.companyId, {
            type: 'produce',
            establishmentId: e.id,
            recipeId: r.id,
            cycles: 1,
          });
      }
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
    );
    if (next > now) break;
    for (const s of w.shipments.filter((x) => !x.delivered && x.arrivesAt <= next)) {
      const dest = establishment(w, s.destinationId),
        previous = dest.inventory[s.product] ?? 0;
      dest.unitCosts[s.product] =
        ((dest.unitCosts[s.product] ?? 0) * previous + s.cost + s.freight) /
        (previous + s.quantity);
      dest.inventory[s.product] = previous + s.quantity;
      if (dest.category === 'retail' && dest.prices[s.product] === undefined)
        dest.prices[s.product] = seasonPrice(w, s.product);
      const vehicle = w.vehicles.find((x) => x.id === s.vehicleId)!;
      vehicle.status = 'available';
      vehicle.propertyId = dest.propertyId;
      s.delivered = true;
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
        e.unitCosts[p as ProductId] =
          ((e.unitCosts[p as ProductId] ?? 0) * previous +
            (j.outputCosts?.[p as ProductId] ?? j.cost / outputCount)) /
          (previous + quantity);
        e.inventory[p as ProductId] = previous + quantity;
      }
      j.completed = true;
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
