import {
  ECONOMIC_INTERVAL,
  products,
  recipes,
  TIME_SCALE,
  type World,
  type Command,
  type ProductId,
  type Position,
  type Establishment,
  type Entry,
} from './model';
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
function transfer(
  w: World,
  from: string,
  to: string,
  amount: number,
  description: string,
  kind: Entry['kind'],
  at: number,
  establishmentId?: string,
) {
  ensure(Number.isSafeInteger(amount) && amount >= 0, 'Valor financeiro inválido.');
  const sender = company(w, from),
    receiver = company(w, to);
  ensure(sender.balance >= amount, 'Saldo insuficiente para concluir esta operação.');
  sender.balance -= amount;
  receiver.balance += amount;
  w.ledger.push({ id: randomUUID(), at, from, to, amount, description, kind, establishmentId });
}
export function distanceKm(a: Position, b: Position) {
  const rad = Math.PI / 180,
    lat = (b[1] - a[1]) * rad,
    lon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(lat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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
    for (const [p, q] of Object.entries(recipes.find((x) => x.id === j.recipeId)!.output))
      inv[p as ProductId] = (inv[p as ProductId] ?? 0) + q! * j.cycles;
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
  const vehicle = w.vehicles.find(
    (x) =>
      x.companyId === carrierId &&
      x.status === 'available' &&
      x.capacityT >= load.mass &&
      x.capacityM3 >= load.volume,
  );
  const relocation = vehicle
    ? distanceKm(
        w.properties.find((x) => x.id === vehicle.propertyId)!.coordinates,
        op.coordinates,
      ) * 1.3
    : 0;
  const rate = carrierId === 'rodoleste' ? 680 : carrierId === 'expresso' ? 780 : 590;
  return {
    carrierId,
    vehicleId: vehicle?.id,
    compatible: Boolean(vehicle),
    price: Math.round(35000 + km * rate + relocation * 200 + load.mass * 900),
    distanceKm: Math.round(km * 10) / 10,
    durationMs: Math.max(
      15000,
      (((route?.durationSeconds ?? (km / 55) * 3600) + (relocation / 55) * 3600 + 1800) * 1000) /
        TIME_SCALE,
    ),
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
      break;
    }
    case 'trade': {
      integer(command.quantity, 'Quantidade');
      const offer = w.offers.find((x) => x.id === command.offerId);
      ensure(offer, 'Oferta não encontrada. Atualize o mercado.');
      const origin = establishment(w, offer.establishmentId),
        dest = owned(w, command.destinationId, actor);
      ensure(origin.companyId !== actor, 'Selecione um fornecedor de outra empresa.');
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
      const cost = offer.price * command.quantity;
      ensure(
        company(w, actor).balance >= cost + q.price,
        'Saldo insuficiente para mercadoria e frete.',
      );
      transfer(
        w,
        actor,
        origin.companyId,
        cost,
        `Compra · ${command.quantity} ${products[offer.product].unit} de ${products[offer.product].name}`,
        'trade',
        now,
        dest.id,
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
      origin.inventory[offer.product] = origin.inventory[offer.product]! - command.quantity;
      origin.revenue += cost;
      origin.expenses += Math.round((origin.unitCosts[offer.product] ?? 0) * command.quantity);
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
      });
      break;
    }
    case 'produce': {
      integer(command.cycles, 'Ciclos', 100);
      const e = owned(w, command.establishmentId, actor),
        recipe = recipes.find((x) => x.id === command.recipeId);
      ensure(
        recipe && recipe.category === e.category,
        'Esta instalação não é compatível com a receita.',
      );
      ensure(e.enabled, 'Retome a operação antes de iniciar uma produção.');
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
        Object.fromEntries(Object.entries(recipe.output).map(([p, q]) => [p, q! * command.cycles])),
      );
      transfer(
        w,
        actor,
        'treasury',
        recipe.cost * command.cycles,
        `Produção · ${recipe.name} · ${command.cycles} ciclo(s)`,
        'operation',
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
      w.jobs.push({
        id: randomUUID(),
        establishmentId: e.id,
        recipeId: recipe.id,
        cycles: command.cycles,
        startedAt: previous,
        finishesAt: previous + recipe.duration * command.cycles,
        completed: false,
        cost: inputCost + recipe.cost * command.cycles,
      });
      break;
    }
    case 'extract': {
      integer(command.quantity, 'Quantidade', 100);
      const e = owned(w, command.establishmentId, actor);
      ensure(e.category === 'mine' && e.enabled, 'A extração exige uma mineradora em operação.');
      ensure((e.reserve ?? 0) >= command.quantity, 'A reserva virtual não comporta essa extração.');
      capacity(w, e, { iron: command.quantity });
      const cost = 14500 * command.quantity;
      transfer(
        w,
        actor,
        'treasury',
        cost,
        `Extração · ${command.quantity} t de minério`,
        'operation',
        now,
        e.id,
      );
      e.reserve! -= command.quantity;
      const previous = w.jobs
        .filter((x) => x.establishmentId === e.id && !x.completed)
        .reduce((n, j) => Math.max(n, j.finishesAt), now);
      w.jobs.push({
        id: randomUUID(),
        establishmentId: e.id,
        recipeId: 'iron-extraction',
        cycles: command.quantity,
        startedAt: previous,
        finishesAt: previous + command.quantity * 3000,
        completed: false,
        cost,
      });
      break;
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
  // Um orçamento finito disputa as lojas; preços mais altos capturam menos demanda.
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
      const score = (e: Establishment) => products[product].basePrice / e.prices[product]!;
      const totalScore = stores.reduce((n, e) => n + score(e), 0);
      for (const e of stores) {
        const quantity = Math.min(
          e.inventory[product]!,
          Math.floor(((35 * score(e)) / totalScore) * Math.min(1.4, score(e))),
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
        );
        e.inventory[product]! -= quantity;
        e.revenue += amount;
        e.expenses += Math.round((e.unitCosts[product] ?? 0) * quantity);
      }
    }
  for (const e of w.establishments.filter((x) => x.enabled)) {
    const cost = Math.round(e.dailyCost / 12); // dois horários virtuais por tick
    if (company(w, e.companyId).balance >= cost) {
      transfer(
        w,
        e.companyId,
        'treasury',
        cost,
        `Custos operacionais · ${e.name}`,
        'operation',
        at,
        e.id,
      );
      e.expenses += cost;
    } else e.enabled = false;
  }
  for (const e of w.establishments.filter(
    (x) =>
      company(w, x.companyId).bot &&
      x.enabled &&
      x.category === 'mine' &&
      (x.inventory.iron ?? 0) < 200,
  )) {
    try {
      execute(
        w,
        e.companyId,
        { type: 'extract', establishmentId: e.id, quantity: Math.min(20, e.reserve ?? 0) },
        at,
      );
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
    }
  }
  const botFactory = w.establishments.find((e) => e.id === 'e-botfactory');
  if (
    botFactory &&
    !w.jobs.some((j) => j.establishmentId === botFactory.id && !j.completed) &&
    (botFactory.inventory.oil ?? 0) < 11500
  ) {
    try {
      execute(
        w,
        botFactory.companyId,
        { type: 'produce', establishmentId: botFactory.id, recipeId: 'soy-oil', cycles: 1 },
        at,
      );
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
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
    );
    if (next > now) break;
    for (const s of w.shipments.filter((x) => !x.delivered && x.arrivesAt <= next)) {
      const dest = establishment(w, s.destinationId),
        previous = dest.inventory[s.product] ?? 0;
      dest.unitCosts[s.product] =
        ((dest.unitCosts[s.product] ?? 0) * previous + s.cost + s.freight) /
        (previous + s.quantity);
      dest.inventory[s.product] = previous + s.quantity;
      const vehicle = w.vehicles.find((x) => x.id === s.vehicleId)!;
      vehicle.status = 'available';
      vehicle.propertyId = dest.propertyId;
      s.delivered = true;
    }
    for (const j of w.jobs.filter((x) => !x.completed && x.finishesAt <= next)) {
      const e = establishment(w, j.establishmentId),
        r = recipes.find((x) => x.id === j.recipeId)!;
      const outputCount = Object.keys(r.output).length;
      for (const [p, q] of Object.entries(r.output)) {
        const previous = e.inventory[p as ProductId] ?? 0,
          quantity = q! * j.cycles;
        e.unitCosts[p as ProductId] =
          ((e.unitCosts[p as ProductId] ?? 0) * previous + j.cost / outputCount) /
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
