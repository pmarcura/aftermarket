import {
  products,
  TIME_SCALE,
  type ProductId,
  type World,
  type Property,
  type Establishment,
  type Position,
} from './model';
import { regions } from '../../world/src/regions';
import { distanceKm } from './geometry';
import { productionCapacity, availableStock } from './operations';

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
export function regionFor(position: Position, city?: string) {
  return (
    regions.find((r) => r.name === city) ??
    [...regions].sort(
      (a, b) => distanceKm(a.coordinates, position) - distanceKm(b.coordinates, position),
    )[0]
  );
}
export function seasonPrice(w: World, product: ProductId) {
  return w.season.config.basePrices[product];
}
export function utilityTariff(w: World, p: Property) {
  return w.season.config.utilities[p.state] ?? w.season.config.utilities.SP;
}
export function laborMarket(w: World, p: Property) {
  const region = regionFor(p.coordinates, p.city),
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
  const payroll = Math.round(
    (e.employees * labor.monthlySalary * w.season.config.parameters.payrollBurden) / 30,
  );
  const maintenance = Math.round(w.season.config.maintenance[e.category] / 30);
  const energyKwh = e.employees * rates.standingKwhPerEmployee;
  const waterM3 = e.employees * rates.standingM3PerEmployee;
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
  const region = regions.find((r) => r.id === regionId)!;
  return (
    (w.season.config.population[region.id] *
      w.season.config.parameters.playableConsumerShare *
      (w.season.config.consumption[product] ?? 0)) /
    30
  );
}
function activeRecipe(w: World, e: Establishment) {
  return w.season.config.recipes.find((r) => r.id === e.specialization);
}
export function marketView(w: World, product: ProductId, regionId = '', radiusKm = 120) {
  const region = regions.find((r) => r.id === regionId);
  const state = regionId.startsWith('state:') ? regionId.slice(6) : '';
  const within = (e: Establishment) =>
    region
      ? distanceKm(
          w.properties.find((p) => p.id === e.propertyId)!.coordinates,
          region.coordinates,
        ) <= radiusKm
      : !state || w.properties.find((p) => p.id === e.propertyId)!.state === state;
  const offers = w.offers
    .filter((o) => o.product === product)
    .map((o) => ({
      ...o,
      establishment: w.establishments.find((e) => e.id === o.establishmentId)!,
    }))
    .filter(
      (o) =>
        o.establishment.enabled &&
        within(o.establishment) &&
        (o.establishment.inventory[product] ?? 0) > 0,
    )
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
    : regions
        .filter((r) => !state || r.state === state)
        .reduce((n, r) => n + householdDemand(w, r.id, product), 0);
  const industrial = w.establishments
    .filter((e) => e.enabled && within(e))
    .reduce((n, e) => {
      const r = activeRecipe(w, e);
      if (!r) return n;
      const cycles =
        Math.min(24, 86400000 / TIME_SCALE / r.duration) * productionCapacity(w, e, r).lines;
      return n + (r.input[product] ?? 0) * cycles;
    }, 0);
  const demand = household + industrial;
  const entries = w.ledger.filter(
    (e) =>
      e.product === product &&
      e.channel === 'wholesale' &&
      (!region || e.regionId === region.id) &&
      (!state || regions.find((r) => r.id === e.regionId)?.state === state),
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
    tradedQuantity: entries.reduce((n, e) => n + (e.quantity ?? 0), 0),
    tradedValue: entries.reduce((n, e) => n + e.amount, 0),
    variation: price === null ? null : (price / seasonPrice(w, product) - 1) * 100,
  };
}
export function recordMarket(w: World, at: number) {
  for (const product of Object.keys(products) as ProductId[])
    for (const regionId of [
      '',
      ...regions.map((r) => r.id),
      ...[...new Set(regions.map((r) => r.state))].map((s) => `state:${s}`),
    ]) {
      const row = marketView(w, product, regionId);
      w.marketHistory.push({
        at,
        product,
        regionId,
        price: row.price,
        stock: row.stock,
        offerCount: row.offers.length,
        tradedQuantity: row.tradedQuantity,
        tradedValue: row.tradedValue,
      });
    }
  if (w.marketHistory.length > 33000) w.marketHistory.splice(0, w.marketHistory.length - 33000);
}
