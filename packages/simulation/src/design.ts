import { products, type World, type ProductId } from './model';
import { GAME_DAY, treasuryAvailable } from './operations';

export const designRules = {
  loanFee: 0.02,
  loanDays: 30,
  collateralRatio: 0.45,
  treasuryCreditShare: 0.2,
  referenceDailyChange: 0.05,
  referenceWindowDays: 7,
  mothballMaintenance: 0.1,
  equipmentCost: {
    retail: 3500000,
    industry: 35000000,
    farm: 12000000,
    mine: 42000000,
    warehouse: 8000000,
    logistics: 10000000,
  },
  storageMassPerM2: {
    retail: 0.35,
    industry: 0.15,
    farm: 0.01,
    mine: 0.1,
    warehouse: 0.5,
    logistics: 0.1,
  },
  storageVolumePerM2: {
    retail: 1.4,
    industry: 0.4,
    farm: 0.02,
    mine: 0.15,
    warehouse: 2,
    logistics: 0.15,
  },
};
const institution = (id: string) =>
  id === 'consumers' || id === 'treasury' || id.startsWith('treasury:');
export function initializeDesign(w: World, at = w.updatedAt) {
  w.season.config.design ??= structuredClone(designRules);
  const cfg = w.season.config.design as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(designRules))
    if (cfg[key] === undefined) cfg[key] = structuredClone(value);
  if (w.designVersion === 2) return;
  w.obligations ??= [];
  w.loans ??= [];
  w.publicBenchmarks ??= {};
  for (const e of w.establishments.filter(
    (e) => !e.supplyPolicy && ['industry', 'farm', 'mine'].includes(e.category),
  )) {
    const recipe = w.season.config.recipes.find((r) => r.id === e.specialization);
    if (recipe)
      e.supplyPolicy = {
        enabled:
          Boolean(w.companies.find((c) => c.id === e.companyId)?.bot) &&
          Object.keys(recipe.input).length > 0,
        dailyBudget: e.automationDailyBudget ?? 10000000,
        cashReserve: 2000000,
        source: 'internal-first',
        purchaseMode: 'immediate',
        maxDistanceKm: 1500,
        minQuality: 40,
        maxFreightPerUnit: 0,
        carrierId: 'auto',
        rules: Object.entries(recipe.input).map(([product, q]) => ({
          product: product as ProductId,
          minimum: Math.ceil(q! * 2),
          target: Math.ceil(q! * 4),
          maxBuy: Math.ceil(q! * 4),
          maxPrice: Math.round(w.season.config.basePrices[product as ProductId] * 1.5),
        })),
      };
  }
  for (const id of Object.keys(products) as ProductId[])
    w.publicBenchmarks[id] ??= {
      price: w.season.config.basePrices[id],
      at,
      trades: 0,
      buyers: 0,
      sellers: 0,
      source: 'opening',
    };
  for (const s of w.shipments.filter((s) => s.routeSource !== 'osrm')) {
    const a = w.establishments.find((e) => e.id === s.originId),
      b = w.establishments.find((e) => e.id === s.destinationId);
    const r = a && b ? w.routes[`${a.propertyId}:${b.propertyId}`] : undefined;
    if (r?.source === 'osrm' && a && b) {
      s.mapRouteKey = `${a.propertyId}:${b.propertyId}`;
      s.mapRouteSource = 'osrm';
    }
  }
  w.designVersion = 2;
}
export function reservedCash(w: World, actor: string, exceptOrder?: string) {
  return w.orders
    .filter((o) => o.buyerId === actor && o.status === 'pending' && o.id !== exceptOrder)
    .reduce((n, o) => n + (o.escrowReserved ?? 0), 0);
}
export function freeCash(w: World, actor: string, exceptOrder?: string) {
  return Math.max(
    0,
    (w.companies.find((c) => c.id === actor)?.balance ?? 0) - reservedCash(w, actor, exceptOrder),
  );
}
export function arrears(w: World, actor: string) {
  return (w.obligations ?? [])
    .filter((o) => o.companyId === actor)
    .reduce((n, o) => n + o.amount - o.paid, 0);
}
export function outstandingLoans(w: World, actor: string) {
  return (w.loans ?? [])
    .filter((l) => l.companyId === actor)
    .reduce((n, l) => n + l.principal - l.repaid, 0);
}
export function collateral(w: World, actor: string) {
  const property = w.properties.filter((p) => p.ownerId === actor).reduce((n, p) => n + p.price, 0);
  const fleet = w.vehicles
    .filter((v) => v.companyId === actor)
    .reduce((n, v) => n + (v.purchasePrice ?? 28000000), 0);
  const equipment = w.establishments
    .filter((e) => e.companyId === actor)
    .reduce((n, e) => n + (e.installationValue ?? 0), 0);
  return Math.floor((property + fleet + equipment) * w.season.config.design.collateralRatio);
}
export function recoveryQuote(w: World, actor: string, state: string, amount: number) {
  const lender = `treasury:${state}`,
    balance = w.companies.find((c) => c.id === lender)?.balance ?? 0;
  const lent = (w.loans ?? [])
    .filter((l) => l.treasuryId === lender)
    .reduce((n, l) => n + l.principal - l.repaid, 0);
  const pool = Math.max(
    0,
    Math.floor((balance + lent) * w.season.config.design.treasuryCreditShare) - lent,
  );
  const assetLimit = Math.max(0, collateral(w, actor) - outstandingLoans(w, actor));
  const maximum = Math.min(assetLimit, pool, treasuryAvailable(w, state));
  const fee = Math.ceil(amount * w.season.config.design.loanFee);
  return {
    maximum,
    assetLimit,
    pool,
    fee,
    proceeds: amount - fee,
    installment: Math.ceil(amount / w.season.config.design.loanDays),
    days: w.season.config.design.loanDays,
    lender,
  };
}
export function updatePublicBenchmarks(w: World, at: number) {
  initializeDesign(w, at);
  for (const id of Object.keys(products) as ProductId[]) {
    const old = w.publicBenchmarks![id]!;
    if (at - old.at < GAME_DAY) continue;
    const trades = w.ledger.filter(
      (l) =>
        l.kind === 'trade' &&
        l.channel === 'wholesale' &&
        l.product === id &&
        l.at >= at - GAME_DAY * w.season.config.design.referenceWindowDays &&
        l.at <= at &&
        l.from !== l.to &&
        !institution(l.from) &&
        !institution(l.to) &&
        (l.quantity ?? 0) > 0 &&
        (l.unitPrice ?? 0) > 0,
    );
    const buyers = new Set(trades.map((l) => l.from)),
      sellers = new Set(trades.map((l) => l.to));
    const pairs = new Map<string, number[]>();
    for (const t of trades) {
      const key = `${t.from}:${t.to}`;
      pairs.set(key, [...(pairs.get(key) ?? []), t.unitPrice!]);
    }
    const values = [...pairs.values()]
      .map((a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)])
      .sort((a, b) => a - b);
    if (buyers.size >= 3 && sellers.size >= 3 && values.length >= 3) {
      const median = values[Math.floor(values.length / 2)];
      const price = Math.max(
        Math.ceil(old.price * (1 - w.season.config.design.referenceDailyChange)),
        Math.min(Math.floor(old.price * (1 + w.season.config.design.referenceDailyChange)), median),
      );
      w.publicBenchmarks![id] = {
        price,
        at,
        trades: trades.length,
        buyers: buyers.size,
        sellers: sellers.size,
        source: 'trades',
      };
    } else
      w.publicBenchmarks![id] = {
        ...old,
        at,
        trades: trades.length,
        buyers: buyers.size,
        sellers: sellers.size,
        source: old.source === 'opening' ? 'opening' : 'retained',
      };
  }
}
export function economyHealth(w: World, at = w.updatedAt, product?: ProductId) {
  const since = at - GAME_DAY * 7,
    recent = w.ledger.filter((l) => l.at >= since && l.at <= at && l.kind !== 'budget');
  const all = w.companies.reduce((n, c) => n + c.balance, 0);
  const families = w.companies.find((c) => c.id === 'consumers')?.balance ?? 0;
  const governments = w.companies
    .filter((c) => c.id.startsWith('treasury'))
    .reduce((n, c) => n + c.balance, 0);
  const privateCash = all - families - governments;
  const turnover = recent
    .filter((l) => l.kind === 'trade' || l.kind === 'retail')
    .reduce((n, l) => n + l.amount, 0);
  const obligations = (w.obligations ?? []).reduce((n, o) => n + o.amount - o.paid, 0);
  const revenues = new Map<string, number>();
  for (const l of recent.filter(
    (l) => (l.kind === 'trade' || l.kind === 'retail') && (!product || l.product === product),
  ))
    revenues.set(l.to, (revenues.get(l.to) ?? 0) + l.amount);
  const marketRevenue = [...revenues.values()].reduce((n, v) => n + v, 0),
    hhi = marketRevenue
      ? [...revenues.values()].reduce((n, v) => n + (v / marketRevenue) ** 2 * 10000, 0)
      : null;
  const demand = w.consumptionHistory.filter((h) => h.at >= since),
    desired = demand.reduce((n, h) => n + h.desired, 0),
    sold = demand.reduce((n, h) => n + h.sold, 0);
  return {
    all,
    families,
    governments,
    privateCash,
    turnover,
    velocity: all ? turnover / all : 0,
    obligations,
    hhi,
    retailFulfillment: desired ? sold / desired : null,
    active: w.establishments.filter((e) => e.enabled && !institution(e.companyId)).length,
    mothballed: w.establishments.filter((e) => e.mothballed).length,
  };
}
