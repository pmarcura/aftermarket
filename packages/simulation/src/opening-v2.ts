import {
  products,
  type Category,
  type Establishment,
  type ProductId,
  type Property,
  type Recipe,
  type SupplyPolicy,
  type World,
} from './model';
import { regions } from '../../world/src/regions';
import { designWorld, storeEconomics, vehicleModels, type VehicleModel } from './economy-design';
import { openingTransfer, rivalNames, treasuryId } from './competition';
import { equipmentCostFor } from './design';
import { householdDemand, operatingCosts, productionCharges, regionFor } from './metrics';
import { GAME_DAY, automationCyclesPerDay } from './operations';
import { householdItems } from './channels';

// Abertura do mundo versão 2 (etapa B, fatia 8): rivais em todas as especialidades da economia
// alvo, com linhas, equipamento, rebanho e sementes declarados e pagos. Nada nasce de graça:
// o capital sai do orçamento dos consumidores e cada compra inaugural vai ao tesouro estadual.

// Linhas por rival: cobrem cerca de 75 a 90% das linhas da calculadora, deixando espaço aos jogadores.
export const v2Portfolio: { recipe?: string; lines: number }[] = [
  { recipe: 'steel-bars', lines: 2 },
  { recipe: 'soy-harvest', lines: 2 },
  { lines: 1 }, // loja: cidade e equipe definidas pela procura (retailSites)
  { recipe: 'utensils', lines: 2 },
  { recipe: 'milk-production', lines: 4 },
  { recipe: 'iron-extraction', lines: 1 },
  { recipe: 'rice-harvest', lines: 4 },
  { recipe: 'coal-extraction', lines: 2 },
  { recipe: 'feed-mill', lines: 1 },
  { recipe: 'beans-harvest', lines: 6 },
  { recipe: 'truck-heavy', lines: 1 },
  { lines: 1 },
  { recipe: 'soy-oil', lines: 1 },
  { recipe: 'steel-bars', lines: 2 },
  { recipe: 'milk-production', lines: 4 },
  { recipe: 'sugar-harvest', lines: 4 },
  { recipe: 'utensils', lines: 2 },
  { recipe: 'coal-extraction', lines: 1 },
  { lines: 1 },
  { recipe: 'soy-harvest', lines: 2 },
  { recipe: 'truck-light', lines: 1 },
  { recipe: 'rice-harvest', lines: 4 },
  { recipe: 'feed-mill', lines: 1 },
  { recipe: 'milk-production', lines: 4 },
  { recipe: 'beans-harvest', lines: 6 },
  { lines: 1 },
  { recipe: 'steel-bars', lines: 2 },
  { recipe: 'utensils', lines: 2 },
  { recipe: 'soy-oil', lines: 1 },
  { lines: 1 },
];
// Lojas-bot atendem 60% da procura das famílias da sua cidade (produção dos bots cobre algo parecido).
const RETAIL_COVERAGE = 0.6;
const RETAIL_STOCK_DAYS = 3;
const WORKING_CAPITAL_DAYS = 7;

const isSeed = (r: Recipe, id: string) => Boolean(r.output[id as ProductId]);
// Insumos que a unidade compra: os da receita e das alternativas, menos a semente que a colheita devolve.
export function purchasedInputs(w: World, r: Recipe) {
  const alternatives = w.season.config.recipes.filter((x) => x.alternativeOf === r.id);
  const ids = new Set<ProductId>();
  for (const x of [r, ...alternatives])
    for (const id of Object.keys(x.input) as ProductId[]) if (!isSeed(x, id)) ids.add(id);
  return [...ids].map((product) => ({
    product,
    perCycle: Math.max(...[r, ...alternatives].map((x) => x.input[product] ?? 0)),
  }));
}

export function v2SupplyPolicy(w: World, e: Establishment): SupplyPolicy {
  const r = w.season.config.recipes.find((x) => x.id === e.specialization);
  const cycles = e.automationCycles ?? 1;
  const site = w.properties.find((p) => p.id === e.propertyId)!;
  const region = regionFor(site.coordinates, site.city);
  const retailDaily = (product: ProductId) =>
    householdDemand(w, region.id, product) * RETAIL_COVERAGE;
  const rules: SupplyPolicy['rules'] = r
    ? purchasedInputs(w, r).map(({ product, perCycle }) => {
        // Compra em dias de uso, não em lotes: lotes curtos comprados aos poucos pagam frete demais.
        const batch = perCycle * cycles,
          daily = perCycle * automationCyclesPerDay(w, e, r);
        const target = Math.ceil(Math.max(batch * 4, daily * 3));
        return {
          product,
          minimum: Math.ceil(Math.max(batch * 2, daily)),
          target,
          maxBuy: target,
          maxPrice: Math.round(w.season.config.basePrices[product] * 1.5),
        };
      })
    : e.category === 'retail'
      ? householdItems(w).map((product) => {
          const target = Math.ceil(retailDaily(product) * RETAIL_STOCK_DAYS);
          return {
            product,
            minimum: Math.ceil(target / 3),
            target,
            maxBuy: target,
            maxPrice: Math.round(w.season.config.basePrices[product] * 1.5),
          };
        })
      : [];
  const dailyInputs = r
    ? purchasedInputs(w, r).reduce(
        (n, { product, perCycle }) =>
          n + perCycle * automationCyclesPerDay(w, e, r) * w.season.config.basePrices[product],
        0,
      )
    : rules.reduce(
        (n, rule) =>
          n + (rule.target / RETAIL_STOCK_DAYS) * w.season.config.basePrices[rule.product],
        0,
      );
  // Teto de frete: 30% do preço do item mais barato; cargas pequenas esperam juntar volume.
  const freightCap = Math.round(
    0.3 * Math.min(...rules.map((rule) => w.season.config.basePrices[rule.product])),
  );
  return {
    enabled: rules.length > 0,
    dailyBudget: Math.max(2000000, Math.ceil(dailyInputs * 1.5)),
    cashReserve: 500000,
    source: 'internal-first',
    purchaseMode: 'immediate',
    maxDistanceKm: 1500,
    minQuality: 40,
    maxFreightPerUnit: rules.length ? freightCap : 0,
    carrierId: 'auto',
    rules,
  };
}

const roundFor = (id: ProductId, q: number) =>
  products[id].unit === 'un' ? Math.ceil(q) : Math.round(q * 1000) / 1000;

export function openV2Rivals(w: World, at: number) {
  if (!w.season.config.economyVersion || w.companies.some((c) => c.id.startsWith('rival-'))) return;
  const config = w.season.config;
  const wholesaleShare = 1 - storeEconomics().grossMargin;
  // Lojas vão às cidades ainda sem loja, da mais populosa para a menor.
  const served = new Set(
    w.establishments
      .filter((e) => e.category === 'retail')
      .map((e) => {
        const p = w.properties.find((x) => x.id === e.propertyId)!;
        return regionFor(p.coordinates, p.city).id;
      }),
  );
  const retailSites = regions
    .filter((r) => !served.has(r.id))
    .sort((a, b) => b.population - a.population);
  let stores = 0;
  v2Portfolio.forEach((template, i) => {
    const region = template.recipe
        ? regions[(i + Math.floor(i / 10) * 4) % regions.length]
        : retailSites[stores++ % retailSites.length],
      recipe = config.recipes.find((r) => r.id === template.recipe),
      profile = recipe ? config.operations.profiles[recipe.id] : undefined,
      category: Category = recipe?.category ?? 'retail',
      lines = template.lines,
      cid = `rival-${i + 1}`,
      pid = `site-${cid}`;
    const regionUnits = householdItems(w).reduce(
      (n, id) => n + householdDemand(w, region.id, id),
      0,
    );
    const employees = profile
      ? profile.workers * lines
      : Math.max(
          designWorld.retail.workersPerStore,
          Math.ceil((regionUnits * RETAIL_COVERAGE) / designWorld.retail.unitsPerWorkerDay),
        );
    const area = profile
      ? profile.areaM2 * lines
      : designWorld.retail.storeAreaM2 * Math.ceil(employees / designWorld.retail.workersPerStore);
    const name = `${rivalNames[i]} ${category === 'industry' ? 'Industrial' : category === 'mine' ? 'Recursos' : category === 'farm' ? 'Agro' : 'Comercial'}`;
    w.companies.push({
      id: cid,
      name,
      bot: true,
      balance: 0,
      homeState: region.state,
      strategy: (['regional', 'quality', 'value'] as const)[i % 3],
      behaviorVersion: 1,
    });
    const sitePrice = Math.round(area * designWorld.landPerM2[category]);
    w.properties.push({
      id: pid,
      name: `Unidade ${rivalNames[i]}`,
      city: region.name,
      state: region.state,
      coordinates: [
        region.coordinates[0] + ((i % 3) - 1) * 0.018 - 0.012,
        region.coordinates[1] + 0.015 + Math.floor(i / 10) * 0.008,
      ],
      category,
      ownerId: cid,
      area,
      price: sitePrice,
      road: 'Via regional',
      roadDistance: 1 + (i % 5),
      water: true,
      energyConnected: true,
    });
    const equipment = equipmentCostFor(w, category, recipe?.id) * lines;
    const e: Establishment = {
      id: `e-${cid}`,
      propertyId: pid,
      name,
      companyId: cid,
      category,
      inventory: {},
      prices: {},
      unitCosts: {},
      quality: {},
      capacityT: 5000,
      capacityM3: 10000,
      employees,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
      installed: true,
      equipmentLines: recipe ? lines : undefined,
      installationValue: equipment,
      education: i % 3,
      specialization: recipe?.id,
      reserve: category === 'mine' ? 15000 : undefined,
      automation: Boolean(recipe),
      automationCycles: recipe ? lines : undefined,
    };
    w.establishments.push(e);
    // Estoque inaugural: rebanho das linhas, três lotes de insumo, duas plantas de semente e
    // produto acabado para cobrir o primeiro ciclo (uma colheita leva dias).
    const stock: Partial<Record<ProductId, number>> = {};
    let perDay = 0;
    if (recipe) {
      for (const [id, q] of Object.entries(recipe.requires ?? {}) as [ProductId, number][])
        stock[id] = roundFor(id, q * lines);
      e.inventory = { ...stock };
      perDay = automationCyclesPerDay(w, e, recipe, lines);
      for (const [id, q] of Object.entries(recipe.input) as [ProductId, number][])
        stock[id] = roundFor(id, q * lines * (isSeed(recipe, id) ? 2 : 3));
      const primary = Object.keys(recipe.output)[0] as ProductId;
      stock[primary] = roundFor(
        primary,
        recipe.output[primary]! * perDay * (1 + recipe.duration / GAME_DAY),
      );
    } else
      for (const id of householdItems(w))
        stock[id] = roundFor(
          id,
          householdDemand(w, region.id, id) * RETAIL_COVERAGE * RETAIL_STOCK_DAYS,
        );
    e.inventory = {};
    // Produtor custeia o estoque inicial na porta da fábrica; a loja, no preço de loja sem a margem.
    const unitCost = (id: ProductId) =>
      Math.round(
        category === 'retail'
          ? config.basePrices[id] * wholesaleShare
          : (config.wholesalePrices?.[id] ?? config.basePrices[id]),
      );
    const stockCost = (Object.entries(stock) as [ProductId, number][]).reduce(
      (n, [id, q]) => n + Math.round(unitCost(id) * q),
      0,
    );
    const model: VehicleModel = category === 'retail' ? 'truckLight' : 'truckHeavy',
      // Usado entre 5% e 95% da vida útil, variando por rival: as trocas começam já na abertura.
      odometerKm = Math.round(vehicleModels[model].lifeKm * (0.05 + ((i * 9973) % 900) / 1000)),
      vehiclePrice = Math.round(
        config.basePrices[model] * (1 - (0.5 * odometerKm) / vehicleModels[model].lifeKm),
      );
    const production = recipe ? productionCharges(w, e, recipe.id, 1).total * perDay : 0;
    // Lotes longos (colheitas) pagam o processamento no início: o limite cobre ao menos um lote inteiro.
    e.automationDailyBudget = recipe
      ? Math.max(
          2000000,
          Math.ceil(production * 1.5),
          Math.ceil(productionCharges(w, e, recipe.id, lines).total * 1.2),
        )
      : undefined;
    e.supplyPolicy = v2SupplyPolicy(w, e);
    const purchases = recipe ? e.supplyPolicy.dailyBudget / 1.5 : stockCost / RETAIL_STOCK_DAYS;
    const reserve =
      (operatingCosts(w, e).total + production + purchases) * WORKING_CAPITAL_DAYS +
      e.supplyPolicy.cashReserve;
    const capital = Math.ceil(sitePrice + equipment + stockCost + vehiclePrice + reserve);
    const state = treasuryId(region.state);
    openingTransfer(w, 'consumers', cid, capital, 'Capital finito de abertura · concorrente', at);
    openingTransfer(w, cid, state, sitePrice, 'Instalação inaugural paga · concorrente', at);
    openingTransfer(w, cid, state, equipment, 'Equipamentos inaugurais pagos · concorrente', at);
    for (const [id, q] of Object.entries(stock) as [ProductId, number][]) {
      if (!q) continue;
      openingTransfer(
        w,
        cid,
        state,
        Math.round(unitCost(id) * q),
        `Estoque inaugural finito · ${products[id].name}`,
        at,
      );
      e.inventory[id] = q;
      e.unitCosts[id] = unitCost(id);
      e.quality![id] = 65 + (i % 20);
      if (category === 'retail') e.prices[id] = config.basePrices[id];
    }
    w.vehicles.push({
      id: `truck-${cid}`,
      name: `RIVAL-${i + 1}`,
      companyId: cid,
      propertyId: pid,
      capacityT: vehicleModels[model].capacityT,
      capacityM3: vehicleModels[model].capacityM3,
      status: 'available',
      purchasePrice: vehiclePrice,
      model,
      odometerKm,
    });
    openingTransfer(w, cid, state, vehiclePrice, 'Veículo inaugural usado · concorrente', at);
    e.dailyCost = operatingCosts(w, e).total;
  });
}

// Transportadoras-bot ganham pátio próprio para receber, guardar e desmontar caminhões.
const carrierYards: [string, string, string, [number, number]][] = [
  ['transbrasil', 'Pátio TransBrasil', 'Campinas', [-47.12, -22.94]],
  ['rodoleste', 'Pátio RodoLeste', 'São José dos Campos', [-45.93, -23.21]],
  ['expresso', 'Pátio Expresso Paulista', 'Sorocaba', [-47.44, -23.47]],
];
export function prepareV2Fleet(w: World) {
  for (const [companyId, name, city, coordinates] of carrierYards) {
    const pid = `yard-${companyId}`;
    w.properties.push({
      id: pid,
      name,
      city,
      state: 'SP',
      coordinates,
      category: 'logistics',
      ownerId: companyId,
      area: 15000,
      price: 15000 * designWorld.landPerM2.logistics,
      road: 'SP-330',
      roadDistance: 1,
      water: true,
      energyConnected: true,
    });
    w.establishments.push({
      id: `e-${pid}`,
      name,
      companyId,
      propertyId: pid,
      category: 'logistics',
      inventory: {},
      unitCosts: {},
      prices: {},
      capacityT: 2000,
      capacityM3: 4000,
      employees: 4,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
    });
    for (const v of w.vehicles.filter((v) => v.companyId === companyId)) v.propertyId = pid;
  }
  // Frota inicial vira modelos fabricados com quilometragem variada: a reposição chega aos poucos.
  w.vehicles.forEach((v, i) => {
    const model: VehicleModel = v.capacityT >= 30 ? 'truckHeavy' : 'truckLight';
    const spec = vehicleModels[model];
    v.model = model;
    v.capacityT = spec.capacityT;
    v.capacityM3 = spec.capacityM3;
    // Frota espalhada até 95% da vida útil, para a reposição não começar só depois de meses.
    v.odometerKm = (i * 23003) % Math.round(spec.lifeKm * 0.95);
    v.purchasePrice = Math.round(
      w.season.config.basePrices[model] * (1 - (0.5 * v.odometerKm) / spec.lifeKm),
    );
  });
}

// Unidades produtivas das empresas antigas (minas, fazenda e fábrica de óleo da versão 1) entram no
// mundo versão 2 com as mesmas regras dos rivais: uma linha de equipamento, a equipe do perfil e
// estoque inicial de um ciclo. Sem isso produziam sem limite de linhas e abriam com estoques de
// semanas, derrubando o preço de ferro, soja e óleo (prova da fatia 10).
export function alignLegacyProducers(w: World) {
  if (!w.season.config.economyVersion) return;
  for (const e of w.establishments) {
    const c = w.companies.find((x) => x.id === e.companyId)!;
    if (!c.bot || c.id.startsWith('rival-') || c.id.startsWith('treasury')) continue;
    const recipe = w.season.config.recipes.find((r) => r.id === e.specialization);
    const profile = recipe && w.season.config.operations.profiles[recipe.id];
    if (!recipe || !profile) continue;
    Object.assign(e, {
      installed: true,
      equipmentLines: 1,
      employees: profile.workers,
      automationCycles: 1,
    });
    const perDay = automationCyclesPerDay(w, e, recipe, 1);
    for (const [id, q] of Object.entries(recipe.output) as [ProductId, number][])
      e.inventory[id] = Math.min(
        e.inventory[id] ?? 0,
        roundFor(id, q * perDay * (1 + recipe.duration / GAME_DAY)),
      );
    for (const [id, q] of Object.entries(recipe.input) as [ProductId, number][])
      if (!recipe.output[id]) e.inventory[id] = Math.min(e.inventory[id] ?? 0, roundFor(id, q * 3));
    e.dailyCost = operatingCosts(w, e).total;
  }
}

// Lotes livres do mundo versão 2 (D-033): tamanho para poucas linhas e preço da terra da
// calculadora. Os imóveis herdados da versão 1 tinham áreas de centenas de hectares e preços sem
// relação com a economia alvo; um jogador com o capital inicial não abria nenhuma produção.
export const v2LotArea: Record<Property['category'], number> = {
  farm: 800000,
  mine: 180000,
  industry: 12000,
  retail: 600,
  warehouse: 15000,
  logistics: 15000,
};
export function normalizeV2Lot(w: World, p: Property) {
  if (!w.season.config.economyVersion || p.ownerId !== null) return;
  p.area = v2LotArea[p.category];
  p.price = Math.round(p.area * designWorld.landPerM2[p.category]);
}
