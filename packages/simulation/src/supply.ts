import { execute, quote, RuleError } from './engine';
import {
  products,
  type World,
  type Establishment,
  type SupplyPolicy,
  type ProductId,
  type Command,
  type Position,
} from './model';
import { distanceKm } from './geometry';
import { emitDecisionTrace, hasDecisionTrace, withDecisionSource } from './decision-trace';
import {
  GAME_DAY,
  automationCyclesPerDay,
  inventoryQuality,
  retailCapacity,
  availableStock,
} from './operations';
import {
  householdDemand,
  regionFor,
  operatingCosts,
  productionCharges,
  propertyOf,
} from './metrics';
import { freeCash } from './design';
import { storageQuantity } from './transport';

// Busca de fornecedor em escala: transportadoras profissionais sempre cotam; das demais, só as
// mais próximas da carga. Estimativa grosseira de frete (centavos por tonelada-km) só ordena.
const CARRIERS = ['transbrasil', 'rodoleste', 'expresso'];
// Transportadoras regionais (carrier-*) entram pela proximidade, como qualquer frota.
const SEARCH_CARRIERS = 4;
const SEARCH_OFFERS = 6;
const ROUGH_FREIGHT_PER_TKM = 15;
const nearbyByRound = new WeakMap<
  World,
  { at: number; map: Map<string, string[]>; fleets: Map<string, Position[]> | undefined }
>();
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
      !int(r.maxPrice) ||
      (r.maxFreightPerUnit !== undefined && !int(r.maxFreightPerUnit))
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
  traceAt = w.updatedAt,
) {
  const tracing = hasDecisionTrace(w);
  const trace = (code: string, message: string, targetId?: string) => {
    if (tracing)
      emitDecisionTrace(w, {
        at: traceAt,
        companyId: e.companyId,
        source: 'supply',
        outcome: 'blocked',
        action: 'select-source',
        code,
        message,
        establishmentId: e.id,
        productId: product,
        targetId,
      });
  };
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
  // Escala (500 bots): todo bot com caminhão pode fazer frete, mas quem está longe da carga
  // nunca é o mais barato, porque paga o deslocamento até a origem. Para cada origem, cotam a
  // própria empresa, as transportadoras, o vendedor e as SEARCH_CARRIERS empresas com caminhão
  // livre mais perto. Antes eram cotadas todas, dezenas de milhares de cotações por rodada.
  // Transportadoras próximas de cada origem valem para a rodada inteira; a cotação ainda confere
  // se há caminhão livre no momento.
  // Só nos mundos da versão 2: o mundo principal salvo (versão 1) mantém a busca completa para
  // não mudar a temporada em andamento.
  const scaled = Boolean(w.season.config.economyVersion);
  let round = nearbyByRound.get(w);
  if (!round || round.at !== traceAt) {
    round = { at: traceAt, map: new Map(), fleets: undefined };
    nearbyByRound.set(w, round);
  }
  const nearby = round.map,
    companies = new Map(w.companies.map((c) => [c.id, c]));
  const carriersFor = (origin: Establishment) => {
    if (policy.carrierId === 'own') return [e.companyId];
    if (policy.carrierId !== 'auto') return [policy.carrierId];
    if (!scaled)
      return [
        e.companyId,
        ...w.companies
          .filter(
            (c) =>
              c.bot && w.vehicles.some((v) => v.companyId === c.id) && !c.id.startsWith('treasury'),
          )
          .map((c) => c.id),
      ];
    const cached = nearby.get(origin.propertyId);
    if (cached) return [e.companyId, ...cached];
    const at = propertyOf(w, origin.propertyId)!.coordinates;
    if (!round!.fleets) {
      round!.fleets = new Map<string, Position[]>();
      for (const v of w.vehicles)
        if (v.status === 'available' && !v.companyId.startsWith('treasury')) {
          const spot = propertyOf(w, v.propertyId)?.coordinates;
          if (spot)
            round!.fleets.set(v.companyId, [...(round!.fleets.get(v.companyId) ?? []), spot]);
        }
    }
    const near = [...round!.fleets]
      .map(([company, spots]) => ({
        company,
        km: Math.min(...spots.map((spot) => distanceKm(spot, at))),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, SEARCH_CARRIERS)
      .map((x) => x.company);
    const shared = [...CARRIERS, origin.companyId, ...near].filter((id) => companies.get(id)?.bot);
    nearby.set(origin.propertyId, shared);
    return [e.companyId, ...shared];
  };
  const room = storageQuantity(w, e, product);
  // Teto de frete do produto: o da regra, se houver; senão o da política inteira.
  const freightCap =
    policy.rules.find((r) => r.product === product)?.maxFreightPerUnit ?? policy.maxFreightPerUnit;
  // Só as ofertas mais baratas contando uma estimativa de frete recebem cotação completa.
  const destination = propertyOf(w, e.propertyId)!.coordinates;
  const rough = (o: (typeof options)[number]) =>
    o.price +
    distanceKm(propertyOf(w, o.origin.propertyId)!.coordinates, destination) *
      products[product].massT *
      ROUGH_FREIGHT_PER_TKM;
  const market = options
    .filter((o) => !o.internal)
    .sort((a, b) => rough(a) - rough(b))
    .slice(0, SEARCH_OFFERS);
  if (scaled) options.splice(0, options.length, ...options.filter((o) => o.internal), ...market);
  if (tracing && !options.length)
    trace(
      pinned ? 'pinned-origin-unavailable' : 'no-stock-source',
      pinned
        ? 'A origem fixa não produziu opção com a titularidade e o estoque exigidos.'
        : 'Nenhuma origem passou pelos filtros de origem, estoque e teto de preço da política.',
    );
  return options
    .filter((o) => {
      const eligible = inventoryQuality(o.origin, product) >= policy.minQuality;
      if (!eligible)
        trace(
          'source-quality-below-minimum',
          'A qualidade da origem ficou abaixo do mínimo configurado.',
          o.origin.id,
        );
      return eligible;
    })
    .flatMap((o) => {
      // Cotação e compra só aceitam quantidade inteira: estoque em toneladas fica quebrado
      // depois de produzir (o aço consome 1,6 t de minério), e uma compra de 199,2 t era sempre
      // recusada como carga incompatível.
      const amount = Math.floor(Math.min(quantity, availableStock(w, o.origin, product), room));
      if (tracing && amount <= 0)
        trace(
          room <= 0 ? 'destination-storage-full' : 'source-stock-unavailable',
          'A quantidade admissível após estoque disponível e espaço comprometido é zero.',
          o.origin.id,
        );
      const quotes = [...new Set(carriersFor(o.origin))]
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
        .filter(({ q, quantity }) => {
          const eligible =
            q.compatible &&
            q.distanceKm <= policy.maxDistanceKm &&
            quantity > 0 &&
            (!freightCap || q.price / quantity <= freightCap);
          if (!eligible && tracing) {
            if (q.routeRequired)
              trace(
                'road-route-pending',
                'A cotação exige rota rodoviária ainda indisponível.',
                q.carrierId,
              );
            else if (!q.compatible)
              trace(
                q.fleet.available === 0 ? 'fleet-unavailable' : 'load-incompatible',
                `Cotação incompatível: ${q.unallocated} unidades não alocadas; ${q.fleet.available} veículos disponíveis.`,
                q.carrierId,
              );
            else if (q.distanceKm > policy.maxDistanceKm)
              trace(
                'distance-limit',
                'A distância cotada excedeu o máximo da política.',
                o.origin.id,
              );
            else if (quantity <= 0)
              trace(
                'zero-load-quantity',
                'A cotação não disponibilizou quantidade positiva.',
                o.origin.id,
              );
            else
              trace(
                'freight-unit-limit',
                'O frete por unidade excedeu o teto configurado.',
                q.carrierId,
              );
          }
          return eligible;
        })
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
  if (recipe?.input[product]) return recipe.input[product]! * automationCyclesPerDay(w, e, recipe);
  if (e.category === 'retail') {
    const p = w.properties.find((p) => p.id === e.propertyId)!;
    const stores = w.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        w.properties.find((p) => p.id === x.propertyId)!.city === p.city,
    ).length;
    const model =
      householdDemand(w, regionFor(w, p.coordinates, p.city).id, product) / Math.max(1, stores);
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
      automationCyclesPerDay(w, e, recipe);
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
  const tracing = hasDecisionTrace(w);
  const trace = (
    e: Establishment,
    code: string,
    message: string,
    productId?: ProductId,
    outcome: 'blocked' | 'idle' = 'blocked',
  ) => {
    if (tracing)
      emitDecisionTrace(w, {
        at,
        companyId: e.companyId,
        source: 'supply',
        outcome,
        action: 'replenish',
        code,
        message,
        establishmentId: e.id,
        productId,
      });
  };
  const executeSupply = (actor: string, command: Command) =>
    withDecisionSource(w, 'supply', () => execute(w, actor, command, at));
  if (tracing)
    for (const e of w.establishments) {
      if (e.supplyPolicy?.enabled && !e.enabled)
        trace(e, 'operation-paused', 'A reposição não foi rodada porque a operação está pausada.');
      else if (e.supplyPolicy && !e.supplyPolicy.enabled && e.supplyPolicy.rules.length)
        trace(
          e,
          'supply-policy-disabled',
          'A política de reposição está desativada; a automação produtiva é avaliada separadamente.',
          undefined,
          'idle',
        );
    }
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
        trace(
          e,
          'supply-target-covered',
          'Estoque, remessas e pedidos pendentes já cobrem o alvo da regra.',
          rule.product,
          'idle',
        );
        continue;
      }
      if (position > rule.minimum && !e.supplyReorder.includes(rule.product)) {
        trace(
          e,
          'above-reorder-minimum',
          'A posição de estoque está acima do mínimo e não há reposição em curso.',
          rule.product,
          'idle',
        );
        continue;
      }
      if (!e.supplyReorder.includes(rule.product)) e.supplyReorder.push(rule.product);
      const want = Math.min(rule.maxBuy, Math.max(0, rule.target - position));
      if (want <= 0) {
        trace(
          e,
          'no-replenishment-quantity',
          'O limite de compra e o alvo não produziram quantidade positiva.',
          rule.product,
          'idle',
        );
        continue;
      }
      let best = supplyCandidates(w, e, rule.product, want, policy, at)[0];
      if (!best) {
        e.supplyStatus = `Sem origem elegível para ${products[rule.product].name}`;
        trace(e, 'no-eligible-source', e.supplyStatus, rule.product);
        continue;
      }
      const cash = freeCash(w, e.companyId) - policy.cashReserve;
      const limit = Math.min(cash, policy.dailyBudget - supplySpent(w, e, at).total);
      if (best.total > limit && best.price > 0) {
        const affordable = Math.min(best.quantity, Math.floor((limit - best.q.price) / best.price));
        if (affordable > 0) best = supplyCandidates(w, e, rule.product, affordable, policy, at)[0];
      }
      if (!best || best.total > limit) {
        e.supplyStatus = 'Orçamento diário ou reserva de caixa impede a compra';
        if (tracing)
          trace(
            e,
            cash <= policy.dailyBudget - supplySpent(w, e, at).total
              ? 'cash-reserve'
              : 'supply-daily-budget',
            e.supplyStatus,
            rule.product,
          );
        continue;
      }
      try {
        if (best.internal)
          executeSupply(e.companyId, {
            type: 'transferStock',
            originId: best.origin.id,
            destinationId: e.id,
            product: rule.product,
            quantity: best.quantity,
            carrierId: best.q.carrierId,
            expectedFreight: best.q.price,
          });
        else if (
          policy.purchaseMode === 'request' ||
          !w.companies.find((c) => c.id === best.origin.companyId)!.bot
        ) {
          executeSupply(e.companyId, {
            type: 'requestOrder',
            reserveFunds: policy.reserveOrders,
            offerId: best.offerId!,
            destinationId: e.id,
            quantity: best.quantity,
            carrierId: best.q.carrierId,
            maxFreight: Math.max(1, best.q.price),
            deliveryDays: 3,
            expectedUnitPrice: best.price,
          });
          w.orders.at(-1)!.supplyManaged = true;
          e.supplyStatus = 'Pedido enviado; aguardando aceitação';
          trace(e, 'awaiting-counterparty', e.supplyStatus, rule.product, 'idle');
          continue;
        } else
          executeSupply(e.companyId, {
            type: 'trade',
            offerId: best.offerId!,
            destinationId: e.id,
            quantity: best.quantity,
            carrierId: best.q.carrierId,
            expectedTotal: best.total,
          });
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
