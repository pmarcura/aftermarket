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
import { cities, hubCity, hubs, siteNear, type City } from '../../world/src/geography-v2';
import {
  dailyFlows,
  designWorld,
  freightPerTonne,
  storeEconomics,
  type DesignItemId,
  vehicleModels,
  type VehicleModel,
} from './economy-design';
import { openingTransfer, rivalNames, treasuryId } from './competition';
import { equipmentCostFor } from './design';
import {
  householdDemand,
  operatingCosts,
  productionCharges,
  regionFor,
  regionsOf,
} from './metrics';
import { GAME_DAY, automationCyclesPerDay } from './operations';
import { householdItems } from './channels';

// Abertura do mundo versão 2 (etapa B, fatia 8): rivais em todas as especialidades da economia
// alvo, com linhas, equipamento, rebanho e sementes declarados e pagos. Nada nasce de graça:
// o capital sai do orçamento dos consumidores e cada compra inaugural vai ao tesouro estadual.

// Abertura gerada pela calculadora (etapa 2): as linhas que a economia alvo pede para cada
// receita, vezes a escala do mundo, divididas em empresas pequenas de 1 a 4 linhas, cada uma num
// polo real da atividade. Os bots ficam com BOT_SHARE das linhas; o resto é espaço dos jogadores.
const BOT_SHARE = 0.8;
const STORE_STAFF = 40; // equipe máxima de uma loja-bot; cidades grandes recebem várias lojas
export interface RivalTemplate {
  recipe?: string;
  lines: number;
  city: City;
  employees?: number;
  share?: number; // parte da procura da cidade que a loja atende
  kind?: Category; // 'warehouse': distribuidor regional de produtos de mercado
}
export function v2PortfolioFor(w: World): RivalTemplate[] {
  const flows = dailyFlows(),
    scale = w.season.config.worldScale ?? 1;
  const out: RivalTemplate[] = [];
  for (const r of w.season.config.recipes.filter((x) => !x.alternativeOf)) {
    const total = Math.max(1, Math.round((flows.lines[r.id] ?? 0) * scale * BOT_SHARE));
    const per = r.id.startsWith('truck') ? 1 : r.category === 'farm' ? 4 : 2;
    const count = Math.ceil(total / per);
    for (let n = 0; n < count; n++)
      out.push({
        recipe: r.id,
        lines: Math.floor(total / count) + (n < total % count ? 1 : 0),
        city: hubCity(r.id, n),
      });
  }
  for (const city of [...regionsOf(w)].sort((x, y) => y.population - x.population)) {
    const units = householdItems(w).reduce((n, id) => n + householdDemand(w, city.id, id), 0);
    const staff = (units * RETAIL_COVERAGE) / designWorld.retail.unitsPerWorkerDay;
    // Cidade pequena demais para uma loja-bot fica para os jogadores.
    if (staff < designWorld.retail.workersPerStore / 2) continue;
    const stores = Math.max(1, Math.round(staff / STORE_STAFF));
    for (let n = 0; n < stores; n++)
      out.push({
        lines: 1,
        city,
        employees: Math.max(designWorld.retail.workersPerStore, Math.ceil(staff / stores)),
        share: 1 / stores,
      });
    // Atacadista regional nas cidades grandes: traz caminhões cheios dos polos e revende em
    // pequenas cargas às lojas da cidade (frete longo de carga pequena não fecha a conta).
    if (city.population >= DISTRIBUTOR_POPULATION)
      out.push({ lines: 1, city, employees: 6, share: 1, kind: 'warehouse' });
  }
  return out;
}
// Lojas-bot atendem 60% da procura das famílias da sua cidade (produção dos bots cobre algo parecido).
const RETAIL_COVERAGE = 0.6;
const RETAIL_STOCK_DAYS = 3;
const DISTRIBUTOR_POPULATION = 600000;
const DISTRIBUTOR_STOCK_DAYS = 7;
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

// Teto de frete por unidade: 30% do preço do item ou o dobro do frete de projeto no mapa real, o
// que for maior (D-036). Com 30% fixos, o carvão de Criciúma (~1.700 km) nunca chegava às usinas.
function freightCap(w: World, product: ProductId) {
  return Math.round(
    Math.max(
      0.3 * w.season.config.basePrices[product],
      2 * freightPerTonne(product as DesignItemId) * products[product].massT,
    ),
  );
}
export function v2SupplyPolicy(w: World, e: Establishment): SupplyPolicy {
  const r = w.season.config.recipes.find((x) => x.id === e.specialization);
  const cycles = e.automationCycles ?? 1;
  const site = w.properties.find((p) => p.id === e.propertyId)!;
  const region = regionFor(w, site.coordinates, site.city);
  // Lojas-bot da mesma cidade repartem a procura; antes cada uma estocava a cidade inteira.
  const peers = Math.max(
    1,
    w.establishments.filter(
      (x) =>
        x.category === e.category &&
        x.companyId.startsWith('rival-') &&
        w.properties.find((p) => p.id === x.propertyId)?.city === site.city,
    ).length,
  );
  const retailDaily = (product: ProductId) =>
    (householdDemand(w, region.id, product) * RETAIL_COVERAGE) / peers;
  const rules: SupplyPolicy['rules'] = r
    ? purchasedInputs(w, r).map(({ product, perCycle }) => {
        // Compra em dias de uso, não em lotes: lotes curtos comprados aos poucos pagam frete demais.
        const batch = perCycle * cycles,
          daily = perCycle * automationCyclesPerDay(w, e, r);
        // Frete longo custa o mesmo com o caminhão meio vazio: se a carga cheia de um caminhão
        // pesado cabe em até uma semana de uso, compra a carga cheia.
        const truckload = Math.floor(vehicleModels.truckHeavy.capacityT / products[product].massT);
        const target = Math.ceil(Math.max(batch * 4, daily * 3, Math.min(truckload, daily * 7)));
        return {
          product,
          minimum: Math.ceil(Math.max(batch * 2, daily)),
          target,
          maxBuy: target,
          maxPrice: Math.round(w.season.config.basePrices[product] * 1.5),
          // Teto de frete por produto: 30% do preço do próprio item (carvão distante segue viável).
          maxFreightPerUnit: freightCap(w, product),
        };
      })
    : e.category === 'retail' || e.category === 'warehouse'
      ? householdItems(w).map((product) => {
          const days = e.category === 'warehouse' ? DISTRIBUTOR_STOCK_DAYS : RETAIL_STOCK_DAYS;
          // Atacadista (D-036) repõe em caminhão pesado cheio: pede quando falta uma carga para o
          // alvo. Antes pedia o que faltava, às vezes 4 t para 1.300 km, e o frete passava do teto.
          const truckload = Math.floor(
            vehicleModels.truckHeavy.capacityT / products[product].massT,
          );
          const target = Math.ceil(
            e.category === 'warehouse'
              ? Math.max(retailDaily(product) * days, truckload * 1.5)
              : retailDaily(product) * days,
          );
          return {
            product,
            minimum:
              e.category === 'warehouse'
                ? Math.max(0, Math.min(target - truckload, Math.ceil(target / 3)))
                : Math.ceil(target / 3),
            target,
            maxBuy: target,
            maxPrice: Math.round(w.season.config.basePrices[product] * 1.5),
            maxFreightPerUnit: freightCap(w, product),
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
  // Teto geral: o menor teto por produto; cargas pequenas esperam juntar volume.
  const policyCap = Math.min(...rules.map((rule) => rule.maxFreightPerUnit ?? Infinity));
  return {
    enabled: rules.length > 0,
    // Cabe ao menos o maior pedido da regra com frete (D-036): com 1,5 dia de insumos, o caminhão
    // cheio de carvão (até uma semana de uso) era sempre barrado pelo orçamento.
    dailyBudget: Math.max(
      2000000,
      Math.ceil(dailyInputs * 1.5),
      ...rules.map((rule) =>
        Math.ceil(
          rule.target * w.season.config.basePrices[rule.product] +
            (rule.maxFreightPerUnit ?? 0) * rule.target,
        ),
      ),
    ),
    cashReserve: 500000,
    source: 'internal-first',
    purchaseMode: 'immediate',
    // Centro-Sul real: carvão de SC e RS abastece siderúrgicas de MG e RJ; o teto de frete limita o resto.
    maxDistanceKm: 3500,
    minQuality: 40,
    maxFreightPerUnit: rules.length ? policyCap : 0,
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
  const used = new Set(w.companies.map((c) => c.name));
  v2PortfolioFor(w).forEach((template, i) => {
    const region = template.city,
      recipe = config.recipes.find((r) => r.id === template.recipe),
      profile = recipe ? config.operations.profiles[recipe.id] : undefined,
      category: Category = recipe?.category ?? template.kind ?? 'retail',
      lines = template.lines,
      cid = `rival-${i + 1}`,
      pid = `site-${cid}`;
    const employees = profile
      ? profile.workers * lines
      : (template.employees ?? designWorld.retail.workersPerStore);
    const area = profile
      ? profile.areaM2 * lines
      : designWorld.retail.storeAreaM2 * Math.ceil(employees / designWorld.retail.workersPerStore);
    const word =
      category === 'industry'
        ? 'Industrial'
        : category === 'mine'
          ? 'Recursos'
          : category === 'farm'
            ? 'Agro'
            : 'Comercial';
    // Nomes sem repetição: com centenas de bots, o nome leva a cidade e, se preciso, um número.
    let name = `${rivalNames[i % rivalNames.length]} ${word}`;
    if (used.has(name)) name = `${name} ${region.name}`;
    for (let n = 2; used.has(name); n++)
      name = `${rivalNames[i % rivalNames.length]} ${word} ${region.name} ${n}`;
    used.add(name);
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
      name: `Unidade ${name}`,
      city: region.name,
      state: region.state,
      coordinates: siteNear(region, i, Boolean(recipe)),
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
          householdDemand(w, region.id, id) *
            RETAIL_COVERAGE *
            RETAIL_STOCK_DAYS *
            (template.share ?? 1),
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
  // Com todas as lojas e distribuidores abertos, cada um reparte a procura da cidade com os pares.
  for (const e of w.establishments)
    if (e.companyId.startsWith('rival-') && (e.category === 'retail' || e.category === 'warehouse'))
      e.supplyPolicy = v2SupplyPolicy(w, e);
}

// Transportadoras-bot ganham pátio próprio para receber, guardar e desmontar caminhões.
const carrierYards: [string, string, string, [number, number]][] = [
  ['transbrasil', 'Pátio TransBrasil', 'Campinas', [-47.12, -22.94]],
  // Pátios espalhados pelo Centro-Sul: caminhão longe da carga paga o deslocamento até ela.
  ['rodoleste', 'Pátio RodoLeste', 'Belo Horizonte', [-44.01, -19.88]],
  ['expresso', 'Pátio Expresso Sul', 'Curitiba', [-49.33, -25.47]],
];
export function prepareV2Fleet(w: World) {
  for (const [companyId, name, city, coordinates] of carrierYards) {
    const pid = `yard-${companyId}`;
    w.properties.push({
      id: pid,
      name,
      city,
      state: cities.find((c) => c.name === city)?.state ?? 'SP',
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

// Geografia real do mundo versão 2: unidades produtivas das empresas antigas vão para o polo da
// sua atividade, e os lotes livres herdados da versão 1 (todos em volta de Campinas) dão lugar
// a lotes em cada polo e em cada cidade, para os jogadores escolherem onde crescer.
const LOTS_PER_HUB = 2;
export function placeV2Geography(w: World) {
  if (!w.season.config.regions) return;
  const legacy = (id: string) =>
    !id.startsWith('rival-') &&
    !id.startsWith('treasury') &&
    !['player', 'player2', 'consumers'].includes(id);
  const placed = new Map<string, number>();
  for (const e of w.establishments) {
    if (!legacy(e.companyId) || !e.specialization) continue;
    const n = placed.get(e.specialization) ?? 0;
    placed.set(e.specialization, n + 1);
    const hub = hubCity(e.specialization, n + 7);
    const p = w.properties.find((x) => x.id === e.propertyId)!;
    Object.assign(p, {
      city: hub.name,
      state: hub.state,
      coordinates: siteNear(hub, 400 + w.establishments.indexOf(e), true),
    });
  }
  w.properties = w.properties.filter((p) => p.ownerId !== null);
  const lot = (category: Category, base: City, n: number): Property => ({
    id: `lot-${category}-${base.id}-${n}`,
    name: `${category === 'farm' ? 'Área rural' : category === 'mine' ? 'Concessão' : category === 'industry' ? 'Terreno industrial' : category === 'retail' ? 'Ponto comercial' : category === 'warehouse' ? 'Galpão' : 'Pátio'} ${base.name}${n ? ` ${n + 1}` : ''}`,
    city: base.name,
    state: base.state,
    category,
    coordinates: siteNear(base, 900 + w.properties.length, category !== 'retail'),
    area: 0,
    price: 0,
    ownerId: null,
    road: 'Rodovia regional',
    roadDistance: 1 + (n % 4),
    water: true,
    energyConnected: true,
  });
  const seen = new Set<string>();
  for (const r of w.season.config.recipes.filter((x) => !x.alternativeOf))
    for (const [hub] of (hubs[r.id] ?? []) as [City, number][]) {
      const key = `${r.category}:${hub.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (let n = 0; n < LOTS_PER_HUB; n++) w.properties.push(lot(r.category, hub, n));
    }
  for (const city of cities) {
    const shops = Math.min(4, 1 + Math.floor(city.population / 2000000));
    for (let n = 0; n < shops; n++) w.properties.push(lot('retail', city, n));
    if (city.population >= 600000) {
      w.properties.push(lot('warehouse', city, 0));
      w.properties.push(lot('logistics', city, 0));
    }
  }
}

// Transportadoras regionais (etapa 2): com os polos espalhados pelo Centro-Sul, o caminhão mais
// perto da carga decide o frete. Três pátios em SP, MG e PR deixavam carvão de SC e minério de
// MG sem transporte a preço viável. Cada base tem frota que acompanha a escala do mundo.
const carrierBases = [
  'São Paulo',
  'Campinas',
  'Rio de Janeiro',
  'Belo Horizonte',
  'Ipatinga',
  'Uberlândia',
  'Patos de Minas',
  'Curitiba',
  'Ponta Grossa',
  'Cascavel',
  'Criciúma',
  'Porto Alegre',
  'Caxias do Sul',
  'Uruguaiana',
  'Goiânia',
  'Rio Verde',
  'Rondonópolis',
  'Sorriso',
  'Campo Grande',
  'Ribeirão Preto',
  'Brasília',
  'Vitória',
];
export function openV2Carriers(w: World, at: number) {
  if (!w.season.config.regions || w.companies.some((c) => c.id.startsWith('carrier-'))) return;
  const scale = w.season.config.worldScale ?? 1;
  const trucks = Math.min(10, Math.max(2, Math.round(scale / 2)));
  carrierBases.forEach((name, i) => {
    const base = cities.find((c) => c.name === name)!;
    const cid = `carrier-${i + 1}`,
      pid = `yard-${cid}`;
    const label = `Transportes ${base.name}`;
    w.companies.push({
      id: cid,
      name: label,
      bot: true,
      balance: 0,
      homeState: base.state,
      strategy: (['regional', 'quality', 'value'] as const)[i % 3],
      behaviorVersion: 1,
    });
    const area = 15000,
      sitePrice = area * designWorld.landPerM2.logistics;
    w.properties.push({
      id: pid,
      name: `Pátio ${label}`,
      city: base.name,
      state: base.state,
      coordinates: siteNear(base, 700 + i, true),
      category: 'logistics',
      ownerId: cid,
      area,
      price: sitePrice,
      road: 'Rodovia federal',
      roadDistance: 1,
      water: true,
      energyConnected: true,
    });
    const e: Establishment = {
      id: `e-${pid}`,
      name: label,
      companyId: cid,
      propertyId: pid,
      category: 'logistics',
      inventory: {},
      unitCosts: {},
      prices: {},
      capacityT: 2000,
      capacityM3: 4000,
      employees: 2 + trucks,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
      installed: true,
    };
    w.establishments.push(e);
    e.dailyCost = operatingCosts(w, e).total;
    const fleet = Array.from({ length: trucks }, (_, n) => {
      const model: VehicleModel = n % 4 === 3 ? 'truckLight' : 'truckHeavy';
      const spec = vehicleModels[model];
      const odometerKm = Math.round(spec.lifeKm * (0.05 + (((i * 31 + n) * 9973) % 900) / 1000));
      return {
        model,
        odometerKm,
        price: Math.round(
          w.season.config.basePrices[model] * (1 - (0.5 * odometerKm) / spec.lifeKm),
        ),
      };
    });
    const vehicles = fleet.reduce((n, v) => n + v.price, 0);
    const capital = sitePrice + vehicles + e.dailyCost * WORKING_CAPITAL_DAYS * 3 + 500000;
    const state = treasuryId(base.state);
    openingTransfer(
      w,
      'consumers',
      cid,
      capital,
      'Capital finito de abertura · transportadora',
      at,
    );
    openingTransfer(w, cid, state, sitePrice, 'Pátio inaugural pago · transportadora', at);
    fleet.forEach((v, n) => {
      w.vehicles.push({
        id: `truck-${cid}-${n + 1}`,
        name: `${base.name.slice(0, 3).toUpperCase()}-${i + 1}${String(n + 1).padStart(2, '0')}`,
        companyId: cid,
        propertyId: pid,
        capacityT: vehicleModels[v.model].capacityT,
        capacityM3: vehicleModels[v.model].capacityM3,
        status: 'available',
        purchasePrice: v.price,
        model: v.model,
        odometerKm: v.odometerKm,
      });
      openingTransfer(w, cid, state, v.price, 'Caminhão inaugural usado · transportadora', at);
    });
  });
}
