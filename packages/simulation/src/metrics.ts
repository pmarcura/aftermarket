import {
  type ProductId,
  type World,
  type Property,
  type Establishment,
  type Position,
  seasonProducts,
} from './model';
import { regions } from '../../world/src/regions';
import { distanceKm } from './geometry';
import { automationCyclesPerDay, availableStock } from './operations';

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
// Municípios do mundo: os da temporada na versão 2 (Centro-Sul real), senão as 10 praças piloto.
export function regionsOf(w: Pick<World, 'season'>) {
  return w.season.config.regions ?? regions;
}
export function regionFor(w: Pick<World, 'season'>, position: Position, city?: string) {
  const regions = regionsOf(w);
  const named = regions.find((region) => region.name === city);
  if (named) return named;
  // Stable nearest-neighbour lookup: one distance per region instead of sorting
  // the complete catalog and recalculating distances for every comparator.
  let nearest = regions[0];
  let nearestDistance = nearest ? distanceKm(nearest.coordinates, position) : Infinity;
  for (let index = 1; index < regions.length; index++) {
    const distance = distanceKm(regions[index].coordinates, position);
    if (distance < nearestDistance) {
      nearest = regions[index];
      nearestDistance = distance;
    }
  }
  return nearest;
}
export function seasonPrice(w: World, product: ProductId) {
  return w.season.config.basePrices[product];
}
// Preço de referência entre empresas: porta da fábrica na versão 2; na versão 1, o da temporada.
export function wholesaleReference(w: World, product: ProductId) {
  return w.season.config.wholesalePrices?.[product] ?? w.season.config.basePrices[product];
}
export function utilityTariff(w: World, p: Property) {
  return w.season.config.utilities[p.state] ?? w.season.config.utilities.SP;
}
export function laborMarket(w: World, p: Property) {
  const region = regionFor(w, p.coordinates, p.city),
    cfg = w.season.config;
  const factor = cfg.competition.stateFactors[p.state] ?? 1,
    index = w.stateWages?.[p.state]?.index ?? 1;
  const monthlySalary = Math.round(
    Math.max(cfg.parameters.minimumWage, cfg.salaries[p.category] * factor * index),
  );
  return {
    region,
    state: p.state,
    factor,
    index,
    monthlySalary,
    label: 'Contratação disponível',
    formula:
      'salário da atividade × multiplicador estadual × índice salarial interno; contratação sem limite regional',
  };
}
export function operatingCosts(w: World, e: Establishment) {
  const p = w.properties.find((p) => p.id === e.propertyId)!,
    labor = laborMarket(w, p),
    rates = utilityTariff(w, p);
  const payroll = e.mothballed
    ? 0
    : Math.round(
        (e.employees * labor.monthlySalary * w.season.config.parameters.payrollBurden) / 30,
      );
  const maintenance = Math.round(
    (w.season.config.maintenance[e.category] / 30) *
      (e.mothballed || e.installed === false
        ? (w.season.config.design?.mothballMaintenance ?? 0.1)
        : 1),
  );
  const energyKwh = e.mothballed ? 0 : e.employees * rates.standingKwhPerEmployee;
  const waterM3 = e.mothballed ? 0 : e.employees * rates.standingM3PerEmployee;
  const energy = Math.round(energyKwh * rates.electricity),
    water = Math.round(waterM3 * rates.water);
  return {
    payroll,
    maintenance,
    energy,
    water,
    energyKwh,
    waterM3,
    total: payroll + maintenance + energy + water,
    monthlySalary: labor.monthlySalary,
  };
}
export function productionCharges(w: World, e: Establishment, recipeId: string, cycles: number) {
  const recipe = w.season.config.recipes.find((r) => r.id === recipeId)!,
    p = w.properties.find((p) => p.id === e.propertyId)!,
    tariff = utilityTariff(w, p);
  const energyKwh = recipe.energyKwh * cycles,
    waterM3 = recipe.waterM3 * cycles;
  const energy = Math.round(energyKwh * tariff.electricity),
    water = Math.round(waterM3 * tariff.water),
    processing = recipe.cost * cycles;
  return { processing, energy, water, energyKwh, waterM3, total: processing + energy + water };
}
export function logisticsQuality(w: World, p: Property) {
  const nearbyVehicles = w.vehicles.filter(
    (v) =>
      v.status === 'available' &&
      distanceKm(w.properties.find((x) => x.id === v.propertyId)!.coordinates, p.coordinates) <=
        150,
  );
  const suppliers = w.offers
    .map((o) => ({ o, e: w.establishments.find((e) => e.id === o.establishmentId)! }))
    .filter(({ o, e }) => e.enabled && (e.inventory[o.product] ?? 0) > 0)
    .map(
      ({ e }) =>
        distanceKm(w.properties.find((x) => x.id === e.propertyId)!.coordinates, p.coordinates) *
        1.3,
    )
    .sort((a, b) => a - b);
  const nearestSupplierKm = suppliers[0] ?? null;
  const access = clamp(100 - p.roadDistance * 12),
    fleet = clamp((nearbyVehicles.length / 5) * 100),
    supplier = nearestSupplierKm === null ? 0 : clamp(100 - nearestSupplierKm / 3);
  const score = Math.round(0.35 * access + 0.35 * fleet + 0.3 * supplier);
  return {
    score,
    label: score >= 70 ? 'Favorável' : score >= 40 ? 'Intermediária' : 'Limitada',
    access,
    fleet,
    supplier,
    nearbyVehicles: nearbyVehicles.length,
    nearestSupplierKm,
    formula:
      '35% acesso à rodovia + 35% veículos livres até 150 km + 30% proximidade do fornecedor com estoque',
  };
}
export function householdDemand(w: World, regionId: string, product: ProductId) {
  const region = regionsOf(w).find((r) => r.id === regionId)!;
  return (
    (w.season.config.population[region.id] *
      w.season.config.parameters.playableConsumerShare *
      (w.season.config.consumption[product] ?? 0)) /
    30
  );
}
// Procura diária do mundo inteiro: famílias mais insumos das linhas ativas (sem ler o razão).
export function dailyDemand(w: World, product: ProductId) {
  const household = regionsOf(w).reduce((n, r) => n + householdDemand(w, r.id, product), 0);
  return w.establishments.reduce((n, e) => {
    if (!e.enabled) return n;
    const r = activeRecipe(w, e);
    const q = r?.input[product] ?? 0;
    return q ? n + q * automationCyclesPerDay(w, e, r!) : n;
  }, household);
}
function activeRecipe(w: World, e: Establishment) {
  return w.season.config.recipes.find((r) => r.id === e.specialization);
}

type TradeTotals = { tradedQuantity: number; tradedValue: number };
type LedgerReadIndex = {
  ledger: World['ledger'];
  processed: number;
  products: Map<ProductId, Map<string, TradeTotals>>;
  regionStates: Map<string, string>;
};
const scopedLedgerIndexes = new WeakMap<World, LedgerReadIndex>();
// Índice permanente do jogo: o extrato só recebe registros novos no fim, então os totais de
// atacado somam apenas o que entrou desde a última leitura. Substituição ou corte do extrato
// reconstrói o índice. Antes, cada consulta de mercado percorria o extrato inteiro (36% do
// tempo da simulação aos 30 dias).
const liveLedgerIndexes = new WeakMap<World, LedgerReadIndex>();
// Buscas por id sem varrer a lista a cada chamada; refeitas quando a lista muda de
// identidade ou de tamanho.
const idIndexes = new WeakMap<object, { length: number; map: Map<string, unknown> }>();
function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  const cached = idIndexes.get(list);
  if (cached && cached.length === list.length) return cached.map as Map<string, T>;
  const map = new Map(list.map((item) => [item.id, item]));
  idIndexes.set(list, { length: list.length, map });
  return map;
}
// Caminhões por empresa: refeito quando a lista muda de tamanho ou o mundo muda de revisão
// (cada comando, inclusive venda de caminhão, avança a revisão).
const fleetIndexes = new WeakMap<
  World,
  { length: number; revision: number; map: Map<string, World['vehicles']> }
>();
export function vehiclesOf(w: World, companyId: string): World['vehicles'] {
  let index = fleetIndexes.get(w);
  if (!index || index.length !== w.vehicles.length || index.revision !== w.revision) {
    const map = new Map<string, World['vehicles']>();
    for (const v of w.vehicles) map.set(v.companyId, [...(map.get(v.companyId) ?? []), v]);
    index = { length: w.vehicles.length, revision: w.revision, map };
    fleetIndexes.set(w, index);
  }
  return index.map.get(companyId) ?? [];
}
export function propertyOf(w: World, id: string) {
  return byId(w.properties).get(id);
}
export function establishmentOf(w: World, id: string) {
  return byId(w.establishments).get(id);
}

/**
 * Internal laboratory optimization for a synchronous, isolated append-only run.
 * Existing ledger entries and the region catalog must remain immutable inside the callback.
 * Replacement/truncation rebuilds the index; in-place edits of old entries are not supported.
 * The index never enters world state and is removed even when the callback throws.
 * Outside this scope the permanent live index below gives the same totals.
 */
export function withAppendOnlyMarketLedger<T>(world: World, run: () => T): T {
  if (scopedLedgerIndexes.has(world)) return run();
  scopedLedgerIndexes.set(world, {
    ledger: world.ledger,
    processed: 0,
    products: new Map(),
    regionStates: new Map(regionsOf(world).map((region) => [region.id, region.state])),
  });
  try {
    return run();
  } finally {
    scopedLedgerIndexes.delete(world);
  }
}

function indexedTradeTotals(world: World, product: ProductId, scope: string): TradeTotals {
  // No navegador o extrato chega resumido; os totais vêm prontos do servidor.
  if (world.view)
    return world.view.tradeTotals[product]?.[scope] ?? { tradedQuantity: 0, tradedValue: 0 };
  let index = scopedLedgerIndexes.get(world) ?? liveLedgerIndexes.get(world);
  if (!index) {
    index = {
      ledger: world.ledger,
      processed: 0,
      products: new Map(),
      regionStates: new Map(regionsOf(world).map((region) => [region.id, region.state])),
    };
    liveLedgerIndexes.set(world, index);
  }
  if (world.ledger !== index.ledger || world.ledger.length < index.processed) {
    index.ledger = world.ledger;
    index.processed = 0;
    index.products.clear();
  }
  for (; index.processed < world.ledger.length; index.processed++) {
    const entry = world.ledger[index.processed];
    if (!entry.product || entry.channel !== 'wholesale') continue;
    const state = index.regionStates.get(entry.regionId ?? '');
    const scopes = ['', ...(state ? [entry.regionId!, `state:${state}`] : [])];
    const scopesForProduct = index.products.get(entry.product) ?? new Map<string, TradeTotals>();
    for (const scopeId of scopes) {
      const totals = scopesForProduct.get(scopeId) ?? { tradedQuantity: 0, tradedValue: 0 };
      totals.tradedQuantity += entry.quantity ?? 0;
      totals.tradedValue += entry.amount;
      scopesForProduct.set(scopeId, totals);
    }
    index.products.set(entry.product, scopesForProduct);
  }
  const live = index.products.get(product)?.get(scope) ?? { tradedQuantity: 0, tradedValue: 0 };
  // Registros arquivados no banco (history.ts) entram pelos totais guardados no mundo.
  const archived = world.history?.trade[product]?.[scope];
  return archived
    ? {
        tradedQuantity: archived.tradedQuantity + live.tradedQuantity,
        tradedValue: archived.tradedValue + live.tradedValue,
      }
    : live;
}

export function marketView(w: World, product: ProductId, regionId = '', radiusKm = 120) {
  const region = regionsOf(w).find((r) => r.id === regionId);
  const state = regionId.startsWith('state:') ? regionId.slice(6) : '';
  const within = (e: Establishment) =>
    region
      ? distanceKm(propertyOf(w, e.propertyId)!.coordinates, region.coordinates) <= radiusKm
      : !state || propertyOf(w, e.propertyId)!.state === state;
  const offers = w.offers
    .filter((o) => o.product === product)
    .map((o) => ({
      ...o,
      establishment: establishmentOf(w, o.establishmentId)!,
    }))
    .filter((o) => within(o.establishment) && (o.establishment.inventory[product] ?? 0) > 0)
    .map((o) => ({ ...o, quantity: availableStock(w, o.establishment, product) }))
    .filter((o) => o.quantity > 0);
  const stock = offers.reduce((n, o) => n + o.quantity, 0),
    price = stock ? Math.round(offers.reduce((n, o) => n + o.price * o.quantity, 0) / stock) : null;
  const retailers = w.establishments.filter(
    (e) =>
      e.category === 'retail' &&
      e.enabled &&
      within(e) &&
      (e.inventory[product] ?? 0) > 0 &&
      (e.prices[product] ?? 0) > 0,
  );
  const retailPrice = retailers.length
    ? Math.round(retailers.reduce((n, e) => n + e.prices[product]!, 0) / retailers.length)
    : null;
  const household = region
    ? householdDemand(w, region.id, product)
    : regionsOf(w)
        .filter((r) => !state || r.state === state)
        .reduce((n, r) => n + householdDemand(w, r.id, product), 0);
  const industrial = w.establishments
    .filter((e) => e.enabled && within(e))
    .reduce((n, e) => {
      const r = activeRecipe(w, e);
      if (!r) return n;
      // A configured recipe with no consumption of this product contributes
      // exactly zero; capacity computation has no side effects.
      if (!(r.input[product] ?? 0) && w.season.config.operations.profiles[r.id]) return n;
      return n + (r.input[product] ?? 0) * automationCyclesPerDay(w, e, r);
    }, 0);
  const demand = household + industrial;
  const { tradedQuantity, tradedValue } = indexedTradeTotals(
    w,
    product,
    region?.id ?? (state ? `state:${state}` : ''),
  );
  return {
    product,
    regionId,
    offers,
    stock,
    price,
    retailPrice,
    demand,
    householdDemand: household,
    industrialDemand: industrial,
    coverageDays: demand ? stock / demand : null,
    suppliers: new Set(offers.map((o) => o.establishment.companyId)).size,
    low: offers.length ? Math.min(...offers.map((o) => o.price)) : null,
    high: offers.length ? Math.max(...offers.map((o) => o.price)) : null,
    tradedQuantity,
    tradedValue,
    variation: price === null ? null : (price / seasonPrice(w, product) - 1) * 100,
  };
}
// Totais de atacado de todos os produtos em todos os recortes (mundo, praça e estado).
export function tradeTotalsByScope(w: World) {
  const scopes = [
    '',
    ...regionsOf(w).map((region) => region.id),
    ...[...new Set(regionsOf(w).map((region) => region.state))].map((state) => `state:${state}`),
  ];
  return Object.fromEntries(
    seasonProducts(w).map((product) => [
      product,
      Object.fromEntries(scopes.map((scope) => [scope, indexedTradeTotals(w, product, scope)])),
    ]),
  );
}
export function recordMarket(w: World, at: number) {
  // Tick-local aggregation: recording a history sample does not need retail/demand
  // calculations or a full ledger scan for every product × geographical scope.
  // marketView remains the query contract; no cache survives a mutation of the world.
  const productIds = seasonProducts(w);
  const scopeIds = [
    '',
    ...regionsOf(w).map((region) => region.id),
    ...[...new Set(regionsOf(w).map((region) => region.state))].map((state) => `state:${state}`),
  ];
  const samples = new Map(
    productIds.map((product) => [
      product,
      new Map(
        scopeIds.map((regionId) => [
          regionId,
          { stock: 0, weightedPrice: 0, offerCount: 0, tradedQuantity: 0, tradedValue: 0 },
        ]),
      ),
    ]),
  );
  const establishments = new Map(
    w.establishments.map((establishment) => [establishment.id, establishment]),
  );
  const properties = new Map(w.properties.map((property) => [property.id, property]));
  const offerScopes = new Map<string, string[]>();
  for (const offer of w.offers) {
    const establishment = establishments.get(offer.establishmentId)!;
    if ((establishment.inventory[offer.product] ?? 0) <= 0) continue;
    const quantity = availableStock(w, establishment, offer.product);
    if (quantity <= 0) continue;
    let scopes = offerScopes.get(establishment.propertyId);
    if (!scopes) {
      const property = properties.get(establishment.propertyId)!;
      scopes = [
        '',
        ...regionsOf(w)
          .filter((region) => distanceKm(property.coordinates, region.coordinates) <= 120)
          .map((region) => region.id),
        `state:${property.state}`,
      ];
      offerScopes.set(establishment.propertyId, scopes);
    }
    for (const scope of scopes) {
      const sample = samples.get(offer.product)?.get(scope);
      if (!sample) continue;
      sample.stock += quantity;
      sample.weightedPrice += offer.price * quantity;
      sample.offerCount++;
    }
  }
  for (const product of productIds)
    for (const regionId of scopeIds) {
      const row = samples.get(product)!.get(regionId)!;
      const indexed = indexedTradeTotals(w, product, regionId);
      w.marketHistory.push({
        at,
        product,
        regionId,
        price: row.stock ? Math.round(row.weightedPrice / row.stock) : null,
        stock: row.stock,
        offerCount: row.offerCount,
        tradedQuantity: indexed.tradedQuantity,
        tradedValue: indexed.tradedValue,
      });
    }
  if (w.marketHistory.length > 33000) w.marketHistory.splice(0, w.marketHistory.length - 33000);
}
