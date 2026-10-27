import { execute, quote, RuleError } from './engine';
import {
  products,
  type World,
  type Establishment,
  type SupplyPolicy,
  type ProductId,
} from './model';
import {
  GAME_DAY,
  inventoryQuality,
  productionCapacity,
  retailCapacity,
  availableStock,
} from './operations';
import { householdDemand, regionFor, operatingCosts, productionCharges } from './metrics';
import { freeCash } from './design';
import { storageQuantity } from './transport';

export function validateSupplyPolicy(policy: SupplyPolicy) {
  const int = (n: number, min = 0, max = 1e9) => Number.isSafeInteger(n) && n >= min && n <= max;
  if (
    !int(policy.dailyBudget, 1) ||
    !int(policy.cashReserve) ||
    !Number.isFinite(policy.maxDistanceKm) ||
    policy.maxDistanceKm < 1 ||
    policy.maxDistanceKm > 6000 ||
    !int(policy.minQuality, 0, 100) ||
    !int(policy.maxFreightPerUnit)
  )
    throw new RuleError('Revise orçamento, reserva, distância, qualidade e teto de frete.');
  if (
    !['internal-first', 'internal-only', 'market'].includes(policy.source) ||
    !['immediate', 'request'].includes(policy.purchaseMode)
  )
    throw new RuleError('Modo de abastecimento inválido.');
  if (
    new Set(policy.rules.map((r) => r.product)).size !== policy.rules.length ||
    policy.rules.length > Object.keys(products).length
  )
    throw new RuleError('Cada produto deve ter uma única regra.');
  for (const r of policy.rules)
    if (
      (r.originId !== undefined &&
        (typeof r.originId !== 'string' || !r.originId.length || r.originId.length > 100)) ||
      !products[r.product] ||
      !int(r.minimum) ||
      !int(r.target, 1, 1000000) ||
      r.minimum >= r.target ||
      !int(r.maxBuy, 1, 1000000) ||
      !int(r.maxPrice)
    )
      throw new RuleError(
        'Use mínimo menor que alvo, quantidade por compra positiva e preços em centavos.',
      );
}
export function supplySpent(w: World, e: Establishment, at: number) {
  const start = w.season.startedAt + Math.floor((at - w.season.startedAt) / GAME_DAY) * GAME_DAY;
  const executed = (w.supplyHistory ?? [])
    .filter((h) => h.establishmentId === e.id && h.at >= start)
    .reduce((n, h) => n + h.cost, 0);
  const promised = w.orders
    .filter((o) => o.destinationId === e.id && o.status === 'pending')
    .reduce((n, o) => n + o.quantity * o.unitPrice + o.maxFreight, 0);
  return { executed, promised, total: executed + promised };
}
export function supplyCandidates(
  w: World,
  e: Establishment,
  product: ProductId,
  quantity: number,
  policy: SupplyPolicy,
) {
  const options: { origin: Establishment; price: number; offerId?: string; internal: boolean }[] =
    [];
  const pinned = policy.rules.find((r) => r.product === product)?.originId;
  if (pinned || policy.source !== 'market')
    for (const origin of w.establishments.filter(
      (x) =>
        x.companyId === e.companyId &&
        x.id !== e.id &&
        (!pinned || x.id === pinned) &&
        (x.inventory[product] ?? 0) > 0,
    ))
      options.push({ origin, price: 0, internal: true });
  if (!pinned && policy.source !== 'internal-only')
    for (const o of w.offers.filter((o) => o.product === product)) {
      const origin = w.establishments.find((x) => x.id === o.establishmentId)!;
      if (
        origin.companyId !== e.companyId &&
        (origin.inventory[product] ?? 0) > 0 &&
        (!policy.rules.find((r) => r.product === product)?.maxPrice ||
          o.price <= policy.rules.find((r) => r.product === product)!.maxPrice)
      )
        options.push({ origin, price: o.price, offerId: o.id, internal: false });
    }
  const carriers =
    policy.carrierId === 'own'
      ? [e.companyId]
      : policy.carrierId === 'auto'
        ? [
            e.companyId,
            ...w.companies
              .filter(
                (c) =>
                  c.bot &&
                  w.vehicles.some((v) => v.companyId === c.id) &&
                  !c.id.startsWith('treasury'),
              )
              .map((c) => c.id),
          ]
        : [policy.carrierId];
  return options
    .filter((o) => inventoryQuality(o.origin, product) >= policy.minQuality)
    .flatMap((o) => {
      const amount = Math.min(
        quantity,
        availableStock(w, o.origin, product),
        storageQuantity(w, e, product),
      );
      const quotes = [...new Set(carriers)]
        .filter((c) => w.companies.some((x) => x.id === c))
        .map((c) => quote(w, o.origin.id, e.id, product, amount, c))
        .map((q) => {
          const allocated = amount - q.unallocated;
          return {
            q: q.compatible
              ? q
              : allocated > 0
                ? quote(w, o.origin.id, e.id, product, allocated, q.carrierId)
                : q,
            quantity: q.compatible ? amount : allocated,
          };
        })
        .filter(
          ({ q, quantity }) =>
            q.compatible &&
            q.distanceKm <= policy.maxDistanceKm &&
            quantity > 0 &&
            (!policy.maxFreightPerUnit || q.price / quantity <= policy.maxFreightPerUnit),
        )
        .sort(
          (a, b) =>
            (o.price * a.quantity + a.q.price) / a.quantity -
            (o.price * b.quantity + b.q.price) / b.quantity,
        );
      const best = quotes[0];
      return best ? [{ ...o, ...best, total: o.price * best.quantity + best.q.price }] : [];
    })
    .sort((a, b) =>
      policy.source === 'internal-first' && a.internal !== b.internal
        ? a.internal
          ? -1
          : 1
        : a.total / a.quantity - b.total / b.quantity,
    );
}
export function dailyNeed(w: World, e: Establishment, product: ProductId) {
  const recipe = w.season.config.recipes.find((r) => r.id === e.specialization);
  if (recipe?.input[product]) {
    const capacity = productionCapacity(w, e, recipe);
    return (
      recipe.input[product]! *
      Math.min(12 * (e.automationCycles ?? 1), (capacity.lines * 86400000) / 120 / recipe.duration)
    );
  }
  if (e.category === 'retail') {
    const p = w.properties.find((p) => p.id === e.propertyId)!;
    const stores = w.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        w.properties.find((p) => p.id === x.propertyId)!.city === p.city,
    ).length;
    const model =
      householdDemand(w, regionFor(p.coordinates, p.city).id, product) / Math.max(1, stores);
    const count = Math.max(
      1,
      new Set([...Object.keys(e.prices), ...(e.supplyPolicy?.rules.map((r) => r.product) ?? [])])
        .size,
    );
    return Math.min(model, (retailCapacity(w, e) * 12) / count);
  }
  return 0;
}
// Consumo perdido durante ruptura não é descontado de mercadoria que ainda vai chegar.
export function supplyProjection(
  w: World,
  e: Establishment,
  product: ProductId,
  need: number,
  extra?: { quantity: number; arrivalAt: number },
) {
  const events = w.shipments
    .filter((s) => s.destinationId === e.id && s.product === product && !s.delivered)
    .map((s) => ({
      quantity: s.quantity,
      day: Math.max(0, (s.arrivesAt - w.updatedAt) / GAME_DAY),
    }));
  if (extra)
    events.push({
      quantity: extra.quantity,
      day: Math.max(0, (extra.arrivalAt - w.updatedAt) / GAME_DAY),
    });
  events.sort((a, b) => a.day - b.day);
  let stock = e.inventory[product] ?? 0,
    previous = 0,
    index = 0;
  return Array.from({ length: 8 }, (_, day) => {
    while (index < events.length && events[index].day <= day) {
      const event = events[index++];
      stock = Math.max(0, stock - need * (event.day - previous)) + event.quantity;
      previous = event.day;
    }
    stock = Math.max(0, stock - need * (day - previous));
    previous = day;
    return stock;
  });
}
export function supplyForecast(w: World, e: Establishment, policy: SupplyPolicy) {
  const rows = policy.rules.map((rule) => {
    const current = e.inventory[rule.product] ?? 0,
      incoming = w.shipments
        .filter((s) => s.destinationId === e.id && s.product === rule.product && !s.delivered)
        .reduce((n, s) => n + s.quantity, 0),
      promised = w.orders
        .filter(
          (o) => o.destinationId === e.id && o.product === rule.product && o.status === 'pending',
        )
        .reduce((n, o) => n + o.quantity, 0);
    const need = dailyNeed(w, e, rule.product),
      want =
        current + incoming + promised <= rule.minimum ||
        (e.supplyReorder ?? []).includes(rule.product)
          ? Math.min(rule.maxBuy, Math.max(0, rule.target - current - incoming - promised))
          : 0;
    const best = want ? supplyCandidates(w, e, rule.product, want, policy)[0] : undefined;
    const unitCost = best
      ? (best.internal ? (best.origin.unitCosts[rule.product] ?? 0) : best.price) +
        best.q.price / best.quantity
      : (e.unitCosts[rule.product] ?? w.season.config.basePrices[rule.product]);
    const sell = e.prices[rule.product] ?? w.season.config.basePrices[rule.product];
    return {
      product: rule.product,
      current,
      incoming,
      promised,
      need,
      want,
      best,
      unitCost,
      coverage: need ? (current + incoming) / need : null,
      contribution:
        e.category === 'retail'
          ? (sell - unitCost) * Math.min(need, current + incoming + (best?.quantity ?? 0))
          : 0,
    };
  });
  const cashNeeded = rows.reduce((n, r) => n + (r.best?.total ?? 0), 0),
    fixed = operatingCosts(w, e).total;
  const recipe = w.season.config.recipes.find((r) => r.id === e.specialization);
  let contribution = rows.reduce((n, r) => n + r.contribution, 0);
  if (recipe) {
    const input = Object.entries(recipe.input).reduce(
      (n, [id, q]) =>
        n +
        (rows.find((r) => r.product === id)?.unitCost ??
          e.unitCosts[id as ProductId] ??
          w.season.config.basePrices[id as ProductId]) *
          q!,
      0,
    );
    const output = Object.entries(recipe.output).reduce(
      (n, [id, q]) =>
        n +
        (w.offers.find((o) => o.establishmentId === e.id && o.product === id)?.price ??
          w.season.config.basePrices[id as ProductId]) *
          q!,
      0,
    );
    contribution =
      (output - input - productionCharges(w, e, recipe.id, 1).total) *
      Math.min(
        12 * (e.automationCycles ?? 1),
        (productionCapacity(w, e, recipe).lines * GAME_DAY) / recipe.duration,
      );
  }
  const highFactor =
    e.category === 'retail'
      ? Math.min(
          1.2,
          (retailCapacity(w, e) * 12) /
            Math.max(
              1,
              rows.reduce((n, r) => n + r.need, 0),
            ),
        )
      : 1;
  return {
    rows,
    highFactor,
    lowResult: contribution * 0.8 - fixed,
    highResult: contribution * highFactor - fixed,
    cashNeeded,
    fixed,
    contribution,
    estimatedResult: contribution - fixed,
    spent: supplySpent(w, e, w.updatedAt),
  };
}
export function runSupplyPolicies(w: World, at: number) {
  for (const e of w.establishments.filter((e) => e.enabled && e.supplyPolicy?.enabled)) {
    const policy = e.supplyPolicy!;
    e.supplyStatus = 'Estoque acima dos mínimos';
    for (const rule of policy.rules) {
      const incoming = w.shipments
          .filter((s) => s.destinationId === e.id && s.product === rule.product && !s.delivered)
          .reduce((n, s) => n + s.quantity, 0),
        ordered = w.orders
          .filter(
            (o) => o.destinationId === e.id && o.product === rule.product && o.status === 'pending',
          )
          .reduce((n, o) => n + o.quantity, 0),
        position = (e.inventory[rule.product] ?? 0) + incoming + ordered;
      e.supplyReorder ??= [];
      if (position >= rule.target) {
        e.supplyReorder = e.supplyReorder.filter((p) => p !== rule.product);
        continue;
      }
      if (position > rule.minimum && !e.supplyReorder.includes(rule.product)) continue;
      if (!e.supplyReorder.includes(rule.product)) e.supplyReorder.push(rule.product);
      const want = Math.min(rule.maxBuy, Math.max(0, rule.target - position));
      if (want <= 0) continue;
      let best = supplyCandidates(w, e, rule.product, want, policy)[0];
      if (!best) {
        e.supplyStatus = `Sem origem elegível para ${products[rule.product].name}`;
        continue;
      }
      const cash = freeCash(w, e.companyId) - policy.cashReserve;
      const limit = Math.min(cash, policy.dailyBudget - supplySpent(w, e, at).total);
      if (best.total > limit && best.price > 0) {
        const affordable = Math.min(best.quantity, Math.floor((limit - best.q.price) / best.price));
        if (affordable > 0) best = supplyCandidates(w, e, rule.product, affordable, policy)[0];
      }
      if (!best || best.total > limit) {
        e.supplyStatus = 'Orçamento diário ou reserva de caixa impede a compra';
        continue;
      }
      try {
        if (best.internal)
          execute(
            w,
            e.companyId,
            {
              type: 'transferStock',
              originId: best.origin.id,
              destinationId: e.id,
              product: rule.product,
              quantity: best.quantity,
              carrierId: best.q.carrierId,
              expectedFreight: best.q.price,
            },
            at,
          );
        else if (
          policy.purchaseMode === 'request' ||
          !w.companies.find((c) => c.id === best.origin.companyId)!.bot
        ) {
          execute(
            w,
            e.companyId,
            {
              type: 'requestOrder',
              reserveFunds: policy.reserveOrders,
              offerId: best.offerId!,
              destinationId: e.id,
              quantity: best.quantity,
              carrierId: best.q.carrierId,
              maxFreight: Math.max(1, best.q.price),
              deliveryDays: 3,
              expectedUnitPrice: best.price,
            },
            at,
          );
          w.orders.at(-1)!.supplyManaged = true;
          e.supplyStatus = 'Pedido enviado; aguardando aceitação';
          continue;
        } else
          execute(
            w,
            e.companyId,
            {
              type: 'trade',
              offerId: best.offerId!,
              destinationId: e.id,
              quantity: best.quantity,
              carrierId: best.q.carrierId,
              expectedTotal: best.total,
            },
            at,
          );
        w.supplyHistory!.push({
          at,
          establishmentId: e.id,
          product: rule.product,
          quantity: best.quantity,
          cost: best.total,
          source: best.internal ? 'Transferência interna' : 'Compra',
        });
        e.supplyStatus = `${best.quantity} ${products[rule.product].unit} em transporte`;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        e.supplyStatus = error.message;
      }
    }
  }
  w.supplyHistory = w.supplyHistory!.slice(-5000);
}
