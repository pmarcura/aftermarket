import type { Category } from './model';
import { calibration, monthlyMaintenance, salaryByCategory } from './calibration';
import { stateFactors } from './competition';
import { designRules } from './design';
import { regions } from '../../world/src/regions';
import { cities, hubCity, hubs } from '../../world/src/geography-v2';
import { distanceKm } from './geometry';

import {
  designItems,
  designRecipes,
  type DesignItem,
  type DesignItemId,
  type DesignRecipe,
} from './catalog';

export * from './catalog';

// Mundo de referência do playtest: dez praças, 4–5 humanos e cerca de 40 empresas-bot.
export const designWorld = {
  // Dobro da parcela atual (1%): demanda para cerca de 45 empresas em vez de 37 negócios.
  consumerShare: 0.02,
  consumers: regions.reduce((n, r) => n + r.population, 0) * 0.02,
  servedShare: 0.7, // parte da demanda atendida em regime
  state: 'SP',
  linesPerSite: 2, // manutenção do estabelecimento rateada entre linhas
  landPerM2: {
    retail: 22000,
    industry: 580,
    farm: 15,
    mine: 53,
    warehouse: 300,
    logistics: 300,
  } as Record<Category, number>,
  paybackDays: {
    industry: 35,
    mine: 35,
    farm: 30,
    retail: 40,
    warehouse: 30,
    logistics: 30,
  } as Record<Category, number>,
  // Frete de projeto no Centro-Sul real (D-036): caminhão pesado cheio, 30 t, a R$ 4,87/km de
  // diesel, desgaste médio, motorista e pedágio, margem de 15% da transportadora e metade da volta
  // vazia; mais carga e descarga. Produto de consumo ainda paga a entrega da cidade em carga pequena.
  freight: { perTonneKm: 28, handlingPerTonne: 1100, localDeliveryPerTonne: 4000, minKm: 30 },
  // Margem do atacadista regional sobre o custo posto: compra caminhão cheio e revende às lojas.
  wholesaleMargin: 0.04,
  government: { steelTonnesPerDay: 16 },
  // Compras de caminhão na semana de playtest: frota crescendo; só uma parte repõe caminhões aposentados.
  fleet: { heavyPerDay: 0.8, lightPerDay: 0.2, replacementShare: 0.25, scrapShare: 0.9 }, // leve: 4/dia no mundo de 500 bots (D-041)
  urbanScrapShare: 0.3, // parte da massa de utensílios que volta como sucata pela coleta
  retail: {
    unitsPerWorkerDay: 600,
    workersPerStore: 8,
    storeAreaM2: 840,
    storeEquipment: designRules.equipmentCost.retail,
  },
  targets: {
    minLines: 2,
    maxLines: 20,
    absorption: [0.9, 1.1] as [number, number],
    equipment: [2000000, 300000000] as [number, number],
    operatingMargin: 0.08,
  },
};

const TICK_HOURS = 2;
const electricity = 92,
  water = 2000;
export const cyclesPerDay = (r: DesignRecipe) =>
  24 / (TICK_HOURS * Math.ceil(r.hours / TICK_HOURS));

function payrollPerDay(category: Category, workers: number) {
  const factor = stateFactors[designWorld.state] ?? 1;
  return (
    (workers *
      Math.max(calibration.minimumWage, salaryByCategory[category] * factor) *
      calibration.payrollBurden) /
    30
  );
}
const standingPerWorker = 5 * electricity + 0.12 * water;
const bandPoint = (item: DesignItem, position: number) =>
  item.band[0] + (item.band[1] - item.band[0]) * position;
const consumerItems = () =>
  (Object.entries(designItems) as [DesignItemId, DesignItem][]).filter(
    ([, i]) => i.monthlyPerPerson,
  );
const retailTarget = (item: DesignItem) =>
  item.price.kind === 'band'
    ? bandPoint(item, item.price.position)
    : (item.band[0] + item.band[1]) / 2;

// Loja de referência: margem percentual que paga equipe, manutenção e investimento no prazo alvo.
export function storeEconomics() {
  const { unitsPerWorkerDay, workersPerStore, storeAreaM2, storeEquipment } = designWorld.retail;
  const capex = storeEquipment + storeAreaM2 * designWorld.landPerM2.retail;
  const fixed =
    payrollPerDay('retail', workersPerStore) +
    workersPerStore * standingPerWorker +
    monthlyMaintenance.retail / 30;
  const unitsPerDay = unitsPerWorkerDay * workersPerStore;
  const consumer = consumerItems();
  const weight = consumer.reduce((n, [, i]) => n + i.monthlyPerPerson!, 0);
  const averageRetail =
    consumer.reduce((n, [, i]) => n + retailTarget(i) * i.monthlyPerPerson!, 0) / weight;
  // markup = x/(1−x), x = custo diário da loja ÷ faturamento diário a preço de varejo
  const x = (fixed + capex / designWorld.paybackDays.retail) / (unitsPerDay * averageRetail);
  return { capex, fixed, unitsPerDay, averageRetail, grossMargin: x, markup: x / (1 - x) };
}

// Distância média de cada item no mapa real: cada polo produtor manda para o comprador mais perto
// que ainda precisa (atribuição gulosa), com a estrada 30% mais longa que a linha reta. Consumo
// final, caminhões e aço do governo vão às cidades conforme a população.
let haulCache: Record<DesignItemId, number> | undefined;
export function haulKm(): Record<DesignItemId, number> {
  if (haulCache) return haulCache;
  const flows = dailyFlows();
  const sites = (recipe: string) =>
    hubs[recipe]
      ? hubs[recipe].map(([city, weight]) => ({ city, weight }))
      : [{ city: hubCity(recipe, 0), weight: 1 }];
  const spread = (list: { city: (typeof cities)[number]; weight: number }[], quantity: number) => {
    const total = list.reduce((n, x) => n + x.weight, 0);
    return list.map((x) => ({ at: x.city.coordinates, quantity: (quantity * x.weight) / total }));
  };
  const people = cities.map((city) => ({ city, weight: city.population }));
  const result = {} as Record<DesignItemId, number>;
  for (const id of Object.keys(designItems) as DesignItemId[]) {
    const supply = designRecipes.flatMap((r) =>
      r.output[id] ? spread(sites(r.id), (flows.lines[r.id] ?? 0) * r.output[id]!) : [],
    );
    const demand = designRecipes.flatMap((r) =>
      r.input[id] ? spread(sites(r.id), (flows.lines[r.id] ?? 0) * r.input[id]!) : [],
    );
    const final =
      (flows.finalDemand[id] ?? 0) +
      (id === 'steel' ? designWorld.government.steelTonnesPerDay : 0);
    if (final) demand.push(...spread(people, final));
    if (id === 'scrap') supply.push(...spread(people, flows.steel.scrapSupply));
    const pairs = supply
      .flatMap((s) =>
        demand.map((d) => ({
          s,
          d,
          km: Math.max(designWorld.freight.minKm, distanceKm(s.at, d.at) * 1.3),
        })),
      )
      .sort((a, b) => a.km - b.km);
    let moved = 0,
      tonneKm = 0;
    for (const { s, d, km } of pairs) {
      const q = Math.min(s.quantity, d.quantity);
      if (q <= 0) continue;
      s.quantity -= q;
      d.quantity -= q;
      moved += q;
      tonneKm += q * km;
    }
    result[id] = moved ? tonneKm / moved : designWorld.freight.minKm;
  }
  return (haulCache = result);
}
// Frete de projeto por tonelada de cada item, pela distância média do mapa real.
export function freightPerTonne(id: DesignItemId) {
  const f = designWorld.freight;
  return (
    f.handlingPerTonne +
    f.perTonneKm * haulKm()[id] +
    (designItems[id].monthlyPerPerson ? f.localDeliveryPerTonne : 0)
  );
}

export function priceList(): Record<DesignItemId, number> {
  const { markup } = storeEconomics();
  const ids = Object.keys(designItems) as DesignItemId[];
  const price = {} as Record<DesignItemId, number>;
  for (const id of ids) {
    const item = designItems[id],
      rule = item.price;
    if (rule.kind === 'fixed') price[id] = rule.price;
    if (rule.kind === 'band')
      // Consumo final: a faixa é de varejo; a porta da fábrica desconta a margem da loja, a do
      // atacadista e o frete até a cidade.
      price[id] = item.monthlyPerPerson
        ? retailTarget(item) / (1 + markup) / (1 + designWorld.wholesaleMargin) -
          (item.massKg / 1000) * freightPerTonne(id)
        : retailTarget(item);
  }
  for (const id of ids) {
    const rule = designItems[id].price;
    if (rule.kind === 'premium') price[id] = price[rule.of] * rule.factor * rule.unitRatio;
  }
  return price;
}

export function lineEconomics(r: DesignRecipe, price: Record<DesignItemId, number>) {
  const cycles = cyclesPerDay(r);
  const inputs = Object.entries(r.input) as [DesignItemId, number][];
  const outputs = Object.entries(r.output) as [DesignItemId, number][];
  const materials = inputs.reduce((n, [id, q]) => n + q * price[id], 0) * cycles;
  const freight =
    inputs.reduce(
      (n, [id, q]) => n + ((q * designItems[id].massKg) / 1000) * freightPerTonne(id),
      0,
    ) * cycles;
  const variable = (r.processing + r.energyKwh * electricity + r.waterM3 * water) * cycles;
  const fixed =
    payrollPerDay(r.category, r.workers) +
    r.workers * standingPerWorker +
    monthlyMaintenance[r.category] / 30 / designWorld.linesPerSite;
  const revenue = outputs.reduce((n, [id, q]) => n + q * price[id], 0) * cycles;
  const cost = materials + freight + variable + fixed;
  const profit = revenue - cost;
  const land = r.areaM2 * designWorld.landPerM2[r.category];
  const livestock = (Object.entries(r.requires ?? {}) as [DesignItemId, number][]).reduce(
    (n, [id, q]) => n + q * price[id],
    0,
  );
  // Botão de balanceamento: o equipamento que faz a linha se pagar no prazo alvo da categoria.
  const equipment = profit * designWorld.paybackDays[r.category] - land - livestock;
  return {
    cycles,
    materials,
    freight,
    variable,
    fixed,
    revenue,
    cost,
    profit,
    margin: revenue ? profit / revenue : 0,
    land,
    livestock,
    equipment,
    capex: equipment + land + livestock,
  };
}

// Demanda diária em regime, de trás para frente a partir do consumo final, do governo e das frotas.
export function dailyFlows() {
  const served = designWorld.consumers * designWorld.servedShare;
  const finalDemand: Partial<Record<DesignItemId, number>> = {};
  for (const [id, item] of consumerItems())
    finalDemand[id] = (served * item.monthlyPerPerson!) / 30;
  finalDemand.truckHeavy = designWorld.fleet.heavyPerDay;
  finalDemand.truckLight = designWorld.fleet.lightPerDay;
  const byId = (id: string) => designRecipes.find((r) => r.id === id)!;
  const made = (r: DesignRecipe, id: DesignItemId) => (r.output[id] ?? 0) * cyclesPerDay(r);
  const used = (r: DesignRecipe, id: DesignItemId) => (r.input[id] ?? 0) * cyclesPerDay(r);
  const lines: Record<string, number> = {};
  const need = (recipe: string, item: DesignItemId, quantity: number) => {
    const r = byId(recipe);
    lines[recipe] = (lines[recipe] ?? 0) + quantity / (made(r, item) - used(r, item));
  };
  const use = (recipe: string, item: DesignItemId) =>
    used(byId(recipe), item) * (lines[recipe] ?? 0);
  const make = (recipe: string, item: DesignItemId) =>
    made(byId(recipe), item) * (lines[recipe] ?? 0);
  need('milk-production', 'milk', finalDemand.milk!);
  need('soy-oil', 'oil', finalDemand.oil!);
  need('rice-harvest', 'rice', finalDemand.rice!);
  need('beans-harvest', 'beans', finalDemand.beans!);
  need('sugar-harvest', 'sugar', finalDemand.sugar!);
  need('utensils', 'utensils', finalDemand.utensils!);
  need('truck-heavy', 'truckHeavy', finalDemand.truckHeavy);
  need('truck-light', 'truckLight', finalDemand.truckLight);
  // Aço: governo + utensílios + caminhões; a sucata disponível vai primeiro para a reciclagem.
  const steelDemand =
    use('utensils', 'steel') +
    use('truck-heavy', 'steel') +
    use('truck-light', 'steel') +
    designWorld.government.steelTonnesPerDay;
  const scrapSupply =
    ((finalDemand.truckHeavy * designItems.truckHeavy.massKg +
      finalDemand.truckLight * designItems.truckLight.massKg) /
      1000) *
      designWorld.fleet.replacementShare *
      designWorld.fleet.scrapShare +
    (finalDemand.utensils! * designItems.utensils.massKg * designWorld.urbanScrapShare) / 1000;
  lines['steel-recycling'] = scrapSupply / used(byId('steel-recycling'), 'scrap');
  const recycled = make('steel-recycling', 'steel');
  need('steel-bars', 'steel', Math.max(0, steelDemand - recycled));
  need('iron-extraction', 'iron', use('steel-bars', 'iron'));
  need('coal-extraction', 'coal', use('steel-bars', 'coal') + use('steel-recycling', 'coal'));
  // Alimentos: soja para o óleo; o farelo vira ração; a ração necessária vem do rebanho.
  need('soy-harvest', 'soy', use('soy-oil', 'soy'));
  const soymealMade = make('soy-oil', 'soymeal');
  lines['feed-mill'] = use('milk-production', 'feed') / made(byId('feed-mill'), 'feed');
  const soymealUsed = use('feed-mill', 'soymeal');
  const seedSurplus = (
    ['soy-harvest', 'rice-harvest', 'beans-harvest', 'sugar-harvest'] as const
  ).map((id) => {
    const seed = (Object.keys(byId(id).input) as DesignItemId[])[0];
    return {
      recipe: id,
      item: seed,
      perDay: make(id, seed) - use(id, seed),
      planted: use(id, seed),
    };
  });
  const retailUnits = consumerItems().reduce((n, [id]) => n + finalDemand[id]!, 0);
  const retailWorkers = retailUnits / designWorld.retail.unitsPerWorkerDay;
  return {
    served,
    finalDemand,
    lines,
    steel: {
      demand: steelDemand,
      government: designWorld.government.steelTonnesPerDay,
      utensils: use('utensils', 'steel'),
      trucks: use('truck-heavy', 'steel') + use('truck-light', 'steel'),
      recycled,
      scrapSupply,
    },
    soymeal: { made: soymealMade, used: soymealUsed, absorption: soymealUsed / soymealMade },
    cows: (byId('milk-production').requires!.cow ?? 0) * lines.dairy,
    herdSurplus: make('milk-production', 'cow') - use('milk-production', 'cow'),
    seedSurplus,
    retailUnits,
    retailWorkers,
    stores: retailWorkers / designWorld.retail.workersPerStore,
  };
}

const reais = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function analyzeDesign() {
  const store = storeEconomics();
  const price = priceList();
  const flows = dailyFlows();
  const recipes = designRecipes.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    priced: r.priced,
    lines: flows.lines[r.id] ?? 0,
    ...lineEconomics(r, price),
  }));
  const retail = Object.fromEntries(
    consumerItems().map(([id, i]) => [
      id,
      (price[id] + (i.massKg / 1000) * freightPerTonne(id)) *
        (1 + designWorld.wholesaleMargin) *
        (1 + store.markup),
    ]),
  ) as Partial<Record<DesignItemId, number>>;
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const [eqMin, eqMax] = designWorld.targets.equipment;
  for (const r of recipes) {
    checks.push({
      id: `margem:${r.id}`,
      ok: r.margin >= designWorld.targets.operatingMargin,
      detail: `${r.name}: lucro operacional ${reais(r.profit)}/dia por linha, margem ${(r.margin * 100).toFixed(0)}%`,
    });
    checks.push({
      id: `equipamento:${r.id}`,
      ok: r.equipment >= eqMin && r.equipment <= eqMax,
      detail: `${r.name}: equipamento ${reais(r.equipment)} por linha`,
    });
  }
  checks.push({
    id: 'loja:margem',
    ok: store.grossMargin <= 0.35,
    detail: `Margem bruta da loja de referência: ${(store.grossMargin * 100).toFixed(0)}%`,
  });
  const [lo, hi] = designWorld.targets.absorption;
  checks.push({
    id: 'coproduto:farelo',
    ok: flows.soymeal.absorption >= lo && flows.soymeal.absorption <= hi,
    detail: `Farelo absorvido pela ração: ${(flows.soymeal.absorption * 100).toFixed(1)}%`,
  });
  for (const s of flows.seedSurplus)
    checks.push({
      id: `semente:${s.item}`,
      ok: s.perDay >= 0 && s.perDay <= s.planted * 0.15,
      detail: `${designItems[s.item].name}: sobram ${s.perDay.toFixed(2)} ${designItems[s.item].unit}/dia para novas fazendas`,
    });
  const perTonne = (id: string) => {
    const r = recipes.find((x) => x.id === id)!;
    return r.cost / r.cycles;
  };
  checks.push({
    id: 'sucata:preferida',
    ok: perTonne('steel-recycling') < perTonne('steel-bars'),
    detail: `Tonelada de aço reciclado custa ${reais(perTonne('steel-recycling'))} contra ${reais(perTonne('steel-bars'))} no alto-forno`,
  });
  const govShare = flows.steel.government / flows.steel.demand;
  checks.push({
    id: 'aco:governo',
    ok: govShare <= 0.5,
    detail: `Governo compra ${(govShare * 100).toFixed(0)}% do aço`,
  });
  for (const r of recipes.filter((r) => r.priced && !r.id.startsWith('truck')))
    checks.push({
      id: `linhas:${r.id}`,
      ok: r.lines >= designWorld.targets.minLines && r.lines <= designWorld.targets.maxLines,
      detail: `${r.name}: ${r.lines.toFixed(1)} linhas atendem o mundo`,
    });
  for (const [id, item] of Object.entries(designItems) as [DesignItemId, DesignItem][]) {
    const value = item.monthlyPerPerson ? retail[id]! : price[id];
    checks.push({
      id: `preco:${id}`,
      ok: value >= item.band[0] - 0.5 && value <= item.band[1] + 0.5,
      detail: `${item.name}: ${reais(value)}${item.monthlyPerPerson ? ' na loja' : `/${item.unit}`} (faixa ${reais(item.band[0])} a ${reais(item.band[1])})`,
    });
  }
  return { store, price, retail, flows, recipes, checks };
}
