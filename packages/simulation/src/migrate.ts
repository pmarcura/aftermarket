import { createSeasonConfig } from './calibration';
import { products, recipes, ECONOMIC_INTERVAL, type World, type ProductId } from './model';
import { calibrateProperty } from './seed';
import { operatingCosts, recordMarket } from './metrics';
import { initializeOperations } from './operations';
import { initializeCompetition } from './competition';

export function needsMigration(input: unknown) {
  const w = input as World;
  return (
    w.operationsVersion !== 3 ||
    w.competitionVersion !== 1 ||
    !w.orders ||
    !w.infrastructure ||
    !w.season?.config?.operations ||
    w.version !== 2 ||
    !w.season?.config?.recipes ||
    !w.season.config.population ||
    !w.season.config.qualification
  );
}

export function migrateWorld(input: unknown, now = Date.now()): { world: World; changed: boolean } {
  const raw = input as World & { version: number };
  if (raw.version === 2) {
    if (!needsMigration(raw)) return { world: raw, changed: false };
    // Completa somente campos ausentes de snapshots intermediários de desenvolvimento.
    // Parâmetros que já pertencem à temporada permanecem exatamente como foram salvos.
    const w = structuredClone(raw),
      cfg = w.season.config;
    const defaults = createSeasonConfig(cfg.basePrices, recipes);
    cfg.recipes ??= defaults.recipes;
    cfg.population ??= defaults.population;
    cfg.qualification ??= defaults.qualification;
    initializeOperations(w);
    initializeCompetition(w, now);
    // Atualização de regras não deve cobrar retroativamente manutenção/automação nova.
    // Entregas, lotes e treinamentos mantêm seus horários e são liquidados normalmente.
    w.nextEconomicAt = Math.max(w.nextEconomicAt, now);
    w.revision++;
    w.updatedAt = now;
    return { world: w, changed: true };
  }
  if (raw.version !== 1) throw new Error('Versão de mundo não suportada. O banco foi preservado.');
  const w = structuredClone(raw) as World;
  w.version = 2;
  w.currency = 'BRL';
  w.economyStartedAt = now;
  w.marketHistory = [];
  w.season = {
    id: `migrated-${now}`,
    name: 'Temporada local',
    startedAt: now,
    config: createSeasonConfig(
      Object.fromEntries(Object.entries(products).map(([id, p]) => [id, p.basePrice])) as Record<
        ProductId,
        number
      >,
      recipes,
    ),
  };
  // A regra nova não cobra retroativamente períodos anteriores à migração.
  w.nextEconomicAt = Math.max(w.nextEconomicAt, now + ECONOMIC_INTERVAL);
  const oldOutputs: Record<string, Partial<Record<ProductId, number>>> = {
    'steel-bars': { steel: 8 },
    'soy-oil': { oil: 200 },
    'soy-harvest': { soy: 26 },
    'iron-extraction': { iron: 1 },
  };
  for (const job of w.jobs)
    if (!job.completed)
      job.output = Object.fromEntries(
        Object.entries(oldOutputs[job.recipeId] ?? {}).map(([p, q]) => [p, q! * job.cycles]),
      );
  for (const s of w.shipments) {
    const origin = w.establishments.find((e) => e.id === s.originId)!,
      dest = w.establishments.find((e) => e.id === s.destinationId)!;
    const a = w.properties.find((p) => p.id === origin.propertyId)!,
      b = w.properties.find((p) => p.id === dest.propertyId)!;
    s.route ??= w.routes[`${a.id}:${b.id}`]?.coordinates ?? [a.coordinates, b.coordinates];
    s.routeSource ??= w.routes[`${a.id}:${b.id}`]?.source ?? 'estimate';
    s.pickupAt ??= s.departedAt;
    s.roadDepartureAt ??= s.departedAt;
    s.roadArrivalAt ??= s.arrivesAt;
  }
  for (const p of w.properties) {
    p.energyConnected ??= true;
    if (!p.ownerId) calibrateProperty(p);
  }
  for (const e of w.establishments) {
    e.automation = w.companies.find((c) => c.id === e.companyId)!.bot;
    e.dailyCost = operatingCosts(w, e).total;
  }
  for (const offer of w.offers)
    if (
      w.companies.find(
        (c) => c.id === w.establishments.find((e) => e.id === offer.establishmentId)!.companyId,
      )?.bot
    )
      offer.price = Math.round(
        products[offer.product].basePrice * (products[offer.product].unit === 'un' ? 0.78 : 1),
      );
  w.revision++;
  w.updatedAt = now;
  initializeOperations(w);
  initializeCompetition(w, now);
  recordMarket(w, now);
  return { world: w, changed: true };
}
