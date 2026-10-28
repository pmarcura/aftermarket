import type { Category, Establishment, ProductId, Recipe, World } from './model';
import { ECONOMIC_INTERVAL, TIME_SCALE } from './model';

// Parâmetros de jogo, copiados para a temporada. Não são estatísticas reais.
export const operationRules = {
  profiles: {
    'steel-bars': { workers: 18, areaM2: 6000 },
    'soy-oil': { workers: 8, areaM2: 1800 },
    'soy-harvest': { workers: 6, areaM2: 200000 },
    'iron-extraction': { workers: 12, areaM2: 90000 },
    'coal-extraction': { workers: 12, areaM2: 90000 },
    'rice-harvest': { workers: 6, areaM2: 200000 },
    'beans-harvest': { workers: 6, areaM2: 200000 },
    'sugar-harvest': { workers: 6, areaM2: 200000 },
    'milk-production': { workers: 6, areaM2: 20000 },
  } as Record<string, { workers: number; areaM2: number }>,
  weekday: [0.85, 0.85, 0.9, 0.95, 1, 1.15, 1.3], // domingo a sábado; média = 1
  retailUnitsPerWorker: 20,
  retailUnitsPerM2: 2,
  expansionReserveDays: 30,
};
export const GAME_DAY = 86400000 / TIME_SCALE;
export const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export function gameCalendar(w: World, at: number) {
  const date = new Date(w.season.startedAt + (at - w.season.startedAt) * TIME_SCALE);
  const weekday = date.getUTCDay();
  return {
    date,
    weekday,
    label: weekdayNames[weekday],
    factor: w.season.config.operations.weekday[weekday],
  };
}
export function inventoryQuality(e: Establishment, id: ProductId) {
  return e.quality?.[id] ?? 70;
}
export function availableStock(w: World, e: Establishment, id: ProductId) {
  const r = w.season.config.recipes.find((r) => r.id === e.specialization);
  const seed =
    e.automation && e.category === 'farm' && r?.input[id] && r.output[id]
      ? r.input[id]! * (e.automationCycles ?? 1)
      : 0;
  // O rebanho que mantém as linhas instaladas não fica disponível para venda automática.
  const herd = (r?.requires?.[id] ?? 0) * (e.equipmentLines ?? 0);
  return Math.max(0, (e.inventory[id] ?? 0) - seed - herd);
}
export function siteQuality(propertyId: string) {
  return 60 + ([...propertyId].reduce((n, c) => n + c.charCodeAt(0), 0) % 26);
}
export function defaultSpecialization(e: Establishment) {
  return e.category === 'mine'
    ? 'iron-extraction'
    : e.category === 'farm'
      ? 'soy-harvest'
      : e.category === 'industry'
        ? /óleo|oleo/i.test(e.name)
          ? 'soy-oil'
          : 'steel-bars'
        : undefined;
}
export function productionCapacity(w: World, e: Establishment, r: Recipe, cycles = 1) {
  const rule = w.season.config.operations.profiles[r.id];
  const p = w.properties.find((p) => p.id === e.propertyId)!;
  if (!rule)
    return {
      workers: 0,
      areaM2: 0,
      areaLines: 0,
      laborLines: 0,
      lines: 0,
      durationMs: Infinity,
      bottleneck: 'Receita sem perfil de capacidade',
    };
  const areaLines = Math.floor(p.area / rule.areaM2),
    laborLines = Math.floor(e.employees / rule.workers);
  // Rebanho: cada linha exige seus animais presentes, que não são consumidos.
  const herdLines = Math.min(
    Infinity,
    ...(Object.entries(r.requires ?? {}) as [ProductId, number][]).map(([id, q]) =>
      Math.floor((e.inventory[id] ?? 0) / q),
    ),
  );
  // Um lote ocupa as linhas até terminar; lotes seguintes aguardam na fila.
  const lines =
    e.installed === false
      ? 0
      : Math.max(0, Math.min(areaLines, laborLines, herdLines, e.equipmentLines ?? Infinity));
  return {
    ...rule,
    areaLines,
    laborLines,
    lines,
    durationMs: lines ? r.duration * Math.ceil(cycles / lines) : Infinity,
    bottleneck:
      lines === 0
        ? herdLines === 0
          ? 'Rebanho insuficiente'
          : laborLines === 0
            ? 'Equipe insuficiente'
            : 'Área insuficiente'
        : herdLines < Math.min(areaLines, laborLines, e.equipmentLines ?? Infinity)
          ? 'Rebanho limita as linhas'
          : lines < Math.min(areaLines, laborLines)
            ? 'Equipamentos limitam as linhas'
            : laborLines < areaLines
              ? 'Equipe limita as linhas'
              : 'Área limita as linhas',
  };
}
// Cadência da automação em regime (auditoria M03): o lote de c ciclos ocupa as linhas por
// teto(c/l) durações e só recomeça na rodada econômica seguinte ao término.
export function automationCyclesPerDay(
  w: World,
  e: Establishment,
  r: Recipe,
  batch = e.automationCycles ?? 1,
) {
  const { lines } = productionCapacity(w, e, r, batch);
  if (!lines || batch <= 0) return 0;
  const batchMs = r.duration * Math.ceil(batch / lines);
  const period = ECONOMIC_INTERVAL * Math.ceil(batchMs / ECONOMIC_INTERVAL);
  return (batch * GAME_DAY) / period;
}
export function productionQuality(w: World, e: Establishment, r: Recipe) {
  const site = w.properties.find((p) => p.id === e.propertyId)!;
  const input = Object.entries(r.input) as [ProductId, number][];
  const mass = input.reduce((n, [, q]) => n + q, 0);
  const quality = mass
    ? input.reduce((n, [id, q]) => n + inventoryQuality(e, id) * q, 0) / mass
    : siteQuality(site.id);
  return Math.min(
    100,
    Math.round(quality * 0.8 + siteQuality(site.id) * 0.2 + (e.education ?? 0) * 3),
  );
}
export function retailCapacity(w: World, e: Establishment) {
  const p = w.properties.find((p) => p.id === e.propertyId)!;
  return Math.floor(
    Math.min(
      e.employees * w.season.config.operations.retailUnitsPerWorker,
      p.area * w.season.config.operations.retailUnitsPerM2,
    ),
  );
}
export function treasuryReserved(w: World, state?: string) {
  return w.infrastructure
    .filter(
      (c) =>
        c.status === 'open' && (!state || (c.treasuryId ?? 'treasury') === `treasury:${state}`),
    )
    .reduce((n, c) => n + c.reserved, 0);
}
export function treasuryAvailable(w: World, state?: string) {
  return Math.max(
    0,
    w.companies
      .filter((c) =>
        state ? c.id === `treasury:${state}` : c.id === 'treasury' || c.id.startsWith('treasury:'),
      )
      .reduce((n, c) => n + c.balance, 0) - treasuryReserved(w, state),
  );
}
export function openingWorkers(category: Category) {
  return category === 'industry' ? 18 : category === 'farm' ? 6 : 12;
}
export function initializeOperations(w: World) {
  w.operationsVersion = 1;
  w.orders ??= [];
  w.infrastructure ??= [];
  w.consumptionHistory ??= [];
  w.retailCarry ??= {};
  w.consumedMaterials ??= {};
  w.season.config.operations ??= structuredClone(operationRules);
  for (const [id, profile] of Object.entries(operationRules.profiles))
    w.season.config.operations.profiles[id] ??= structuredClone(profile);
  for (const r of expansionRecipes)
    if (!w.season.config.recipes.some((x) => x.id === r.id))
      w.season.config.recipes.push(structuredClone(r));
  for (const e of w.establishments) {
    e.quality ??= Object.fromEntries(Object.keys(e.inventory).map((id) => [id, 70]));
    e.specialization ??= defaultSpecialization(e);
    e.automationCycles ??= 1;
  }
  if (!w.properties.some((p) => p.id === 'public-works'))
    w.properties.push({
      id: 'public-works',
      name: 'Obras de infraestrutura',
      city: 'Campinas',
      state: 'SP',
      category: 'warehouse',
      coordinates: [-47.13, -22.94],
      area: 50000,
      price: 0,
      ownerId: 'treasury',
      road: 'SP-330',
      roadDistance: 1,
      water: true,
      energyConnected: true,
    });
  if (w.season.config.recycling) initializeScrapCollection(w);
  if (!w.establishments.some((e) => e.id === 'e-public-works'))
    w.establishments.push({
      id: 'e-public-works',
      name: 'Canteiro de obras públicas',
      companyId: 'treasury',
      propertyId: 'public-works',
      category: 'warehouse',
      inventory: {},
      unitCosts: {},
      prices: {},
      quality: {},
      capacityT: 100000,
      capacityM3: 100000,
      employees: 0,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
    });
}
// Coleta municipal: vende a sucata urbana dos utensílios descartados a preço fixo (versão 2).
export const SCRAP_COLLECTION = 'e-scrap-collection';
function initializeScrapCollection(w: World) {
  if (!w.properties.some((p) => p.id === 'scrap-collection'))
    w.properties.push({
      id: 'scrap-collection',
      name: 'Coleta municipal de recicláveis',
      city: 'Campinas',
      state: 'SP',
      category: 'warehouse',
      coordinates: [-47.08, -22.93],
      area: 20000,
      price: 0,
      ownerId: 'treasury',
      road: 'SP-330',
      roadDistance: 1,
      water: true,
      energyConnected: true,
    });
  if (!w.establishments.some((e) => e.id === SCRAP_COLLECTION))
    w.establishments.push({
      id: SCRAP_COLLECTION,
      name: 'Coleta municipal de recicláveis',
      companyId: 'treasury',
      propertyId: 'scrap-collection',
      category: 'warehouse',
      inventory: { scrap: 0 },
      unitCosts: { scrap: 0 },
      prices: {},
      quality: { scrap: 60 },
      capacityT: 100000,
      capacityM3: 300000,
      employees: 0,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
    });
  if (!w.offers.some((o) => o.establishmentId === SCRAP_COLLECTION))
    w.offers.push({
      id: 'offer-scrap-collection',
      establishmentId: SCRAP_COLLECTION,
      product: 'scrap',
      price: w.season.config.recycling!.scrapPrice,
    });
}
// Cadeias agregadas do laboratório: cultivo e processamento local no mesmo estabelecimento.
export const expansionRecipes: Recipe[] = [
  {
    id: 'coal-extraction',
    name: 'Extração de carvão',
    category: 'mine',
    input: {},
    output: { coal: 1 },
    cost: 70000,
    duration: 6000,
    energyKwh: 50,
    waterM3: 1,
  },
  {
    id: 'rice-harvest',
    name: 'Cultivo e beneficiamento de arroz',
    category: 'farm',
    input: { rice: 1 },
    output: { rice: 160 },
    cost: 190000,
    duration: GAME_DAY * 3,
    energyKwh: 160,
    waterM3: 50,
  },
  {
    id: 'beans-harvest',
    name: 'Cultivo e embalagem de feijão',
    category: 'farm',
    input: { beans: 1 },
    output: { beans: 400 },
    cost: 160000,
    duration: GAME_DAY * 3,
    energyKwh: 90,
    waterM3: 25,
  },
  {
    id: 'sugar-harvest',
    name: 'Cana e processamento integrado',
    category: 'farm',
    input: { sugar: 1 },
    output: { sugar: 180 },
    cost: 150000,
    duration: GAME_DAY * 3,
    energyKwh: 160,
    waterM3: 30,
  },
  {
    id: 'milk-production',
    name: 'Produção e envase de leite',
    category: 'farm',
    input: { soymeal: 50 },
    output: { milk: 300 },
    cost: 70000,
    duration: GAME_DAY,
    energyKwh: 90,
    waterM3: 4,
  },
];
