import type { Category } from './model';
import {
  calibration,
  monthlyConsumption,
  monthlyMaintenance,
  salaryByCategory,
} from './calibration';
import { stateFactors } from './competition';
import { designRules } from './design';
import { regions } from '../../world/src/regions';

// Proposta 1 da etapa B (D-028/D-029). Fonte única dos números do redesenho até o motor adotá-los.
// Valores em centavos; quantidades por ciclo de uma linha; tempo em horas de jogo.

export type DesignItemId =
  | 'iron'
  | 'coal'
  | 'scrap'
  | 'steel'
  | 'utensils'
  | 'truckHeavy'
  | 'truckLight'
  | 'soySeed'
  | 'soy'
  | 'soymeal'
  | 'oil'
  | 'feed'
  | 'cow'
  | 'milk'
  | 'riceSeed'
  | 'rice'
  | 'beanSeed'
  | 'beans'
  | 'caneSeedling'
  | 'sugar';

export type PriceRule =
  | { kind: 'band'; position: number } // ponto da faixa de referência; consumo final usa a faixa de varejo
  | { kind: 'fixed'; price: number } // âncora de mercado (coproduto ou ativo)
  | { kind: 'premium'; of: DesignItemId; factor: number; unitRatio: number }; // ex.: semente = grão × prêmio

export interface DesignItem {
  name: string;
  unit: string;
  massKg: number;
  volumeM3: number;
  isNew: boolean;
  // Faixa de referência por unidade. Consumo final: faixa de varejo; demais: faixa de porta da fábrica.
  band: [number, number];
  bandSource: 'real' | 'jogo';
  price: PriceRule;
  monthlyPerPerson?: number;
}

export interface DesignRecipe {
  id: string;
  name: string;
  category: Category;
  input: Partial<Record<DesignItemId, number>>;
  output: Partial<Record<DesignItemId, number>>;
  requires?: Partial<Record<DesignItemId, number>>; // presentes na linha, não consumidos
  priced?: DesignItemId; // saída cujo preço é derivado desta receita
  hours: number;
  workers: number;
  areaM2: number;
  processing: number; // insumos agregados por ciclo: embalagem, diesel, fertilizante, veterinário
  energyKwh: number;
  waterM3: number;
  lossKg: number; // massa que sai do processo sem virar item (escória, gases, umidade)
  note: string;
}

export const designItems: Record<DesignItemId, DesignItem> = {
  iron: {
    name: 'Minério de ferro',
    unit: 't',
    massKg: 1000,
    volumeM3: 0.45,
    isNew: false,
    band: [35000, 65000],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
  },
  coal: {
    name: 'Carvão mineral',
    unit: 't',
    massKg: 1000,
    volumeM3: 1.3,
    isNew: false,
    band: [130000, 240000],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
  },
  scrap: {
    name: 'Sucata de aço',
    unit: 't',
    massKg: 1000,
    volumeM3: 2.5,
    isNew: true,
    band: [90000, 160000],
    bandSource: 'real',
    price: { kind: 'fixed', price: 120000 },
  },
  steel: {
    name: 'Aço em barras',
    unit: 't',
    massKg: 1000,
    volumeM3: 0.15,
    isNew: false,
    band: [380000, 620000],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
  },
  utensils: {
    name: 'Utensílios de aço (kit)',
    unit: 'un',
    massKg: 5,
    volumeM3: 0.02,
    isNew: true,
    band: [4000, 9000],
    bandSource: 'jogo',
    price: { kind: 'band', position: 0.5 },
    monthlyPerPerson: 0.25,
  },
  truckHeavy: {
    name: 'Caminhão pesado 30 t',
    unit: 'un',
    massKg: 9000,
    volumeM3: 60,
    isNew: true,
    band: [22000000, 36000000],
    bandSource: 'jogo',
    price: { kind: 'band', position: 0.5 },
  },
  truckLight: {
    name: 'Caminhão leve 8 t',
    unit: 'un',
    massKg: 3500,
    volumeM3: 25,
    isNew: true,
    band: [10000000, 18000000],
    bandSource: 'jogo',
    price: { kind: 'band', position: 0.5 },
  },
  soySeed: {
    name: 'Semente de soja',
    unit: 't',
    massKg: 1000,
    volumeM3: 1.4,
    isNew: true,
    band: [500000, 900000],
    bandSource: 'real',
    price: { kind: 'premium', of: 'soy', factor: 2.5, unitRatio: 1 },
  },
  soy: {
    name: 'Soja em grão',
    unit: 't',
    massKg: 1000,
    volumeM3: 1.4,
    isNew: false,
    band: [210000, 270000],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
  },
  soymeal: {
    name: 'Farelo de soja',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0017,
    isNew: false,
    band: [170, 280],
    bandSource: 'real',
    price: { kind: 'fixed', price: 220 },
  },
  oil: {
    name: 'Óleo de soja 1 L',
    unit: 'un',
    massKg: 0.92,
    volumeM3: 0.0013,
    isNew: false,
    band: [650, 1050],
    bandSource: 'real',
    price: { kind: 'band', position: 0.6 },
    monthlyPerPerson: monthlyConsumption.oil,
  },
  feed: {
    name: 'Ração para gado',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0016,
    isNew: true,
    band: [200, 330],
    bandSource: 'real',
    price: { kind: 'band', position: 0.6 },
  },
  cow: {
    name: 'Vaca leiteira',
    unit: 'un',
    massKg: 550,
    volumeM3: 3,
    isNew: true,
    band: [200000, 400000],
    bandSource: 'jogo',
    price: { kind: 'fixed', price: 250000 },
  },
  milk: {
    name: 'Leite 1 L',
    unit: 'un',
    massKg: 1.03,
    volumeM3: 0.0012,
    isNew: false,
    band: [400, 750],
    bandSource: 'real',
    price: { kind: 'band', position: 0.6 },
    monthlyPerPerson: monthlyConsumption.milk,
  },
  riceSeed: {
    name: 'Semente de arroz',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0017,
    isNew: true,
    band: [350, 900],
    bandSource: 'real',
    price: { kind: 'premium', of: 'rice', factor: 1.8, unitRatio: 1 / 5 },
  },
  rice: {
    name: 'Arroz 5 kg',
    unit: 'un',
    massKg: 5,
    volumeM3: 0.007,
    isNew: false,
    band: [1900, 3000],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
    monthlyPerPerson: monthlyConsumption.rice,
  },
  beanSeed: {
    name: 'Semente de feijão',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0015,
    isNew: true,
    band: [800, 1600],
    bandSource: 'real',
    price: { kind: 'premium', of: 'beans', factor: 1.8, unitRatio: 1 },
  },
  beans: {
    name: 'Feijão 1 kg',
    unit: 'un',
    massKg: 1,
    volumeM3: 0.0015,
    isNew: false,
    band: [650, 1200],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
    monthlyPerPerson: monthlyConsumption.beans,
  },
  caneSeedling: {
    name: 'Muda de cana',
    unit: 't',
    massKg: 1000,
    volumeM3: 1.6,
    isNew: true,
    band: [15000, 40000],
    bandSource: 'real',
    price: { kind: 'fixed', price: 25000 },
  },
  sugar: {
    name: 'Açúcar 5 kg',
    unit: 'un',
    massKg: 5,
    volumeM3: 0.006,
    isNew: false,
    band: [1400, 2300],
    bandSource: 'real',
    price: { kind: 'band', position: 0.5 },
    monthlyPerPerson: monthlyConsumption.sugar,
  },
};

export const designRecipes: DesignRecipe[] = [
  {
    id: 'iron-extraction',
    name: 'Extração de minério',
    category: 'mine',
    input: {},
    output: { iron: 1.5 },
    priced: 'iron',
    hours: 2,
    workers: 4,
    areaM2: 90000,
    processing: 7000,
    energyKwh: 30,
    waterM3: 0.5,
    lossKg: 0,
    note: 'Reserva finita da concessão.',
  },
  {
    id: 'coal-extraction',
    name: 'Extração de carvão',
    category: 'mine',
    input: {},
    output: { coal: 0.5 },
    priced: 'coal',
    hours: 2,
    workers: 4,
    areaM2: 90000,
    processing: 12000,
    energyKwh: 30,
    waterM3: 0.5,
    lossKg: 0,
    note: 'Reserva finita da concessão.',
  },
  {
    id: 'steel-bars',
    name: 'Aço em alto-forno',
    category: 'industry',
    input: { iron: 1.6, coal: 0.5 },
    output: { steel: 1 },
    priced: 'steel',
    hours: 4,
    workers: 10,
    areaM2: 6000,
    processing: 25000,
    energyKwh: 500,
    waterM3: 4,
    lossKg: 1100,
    note: '1,1 t sai como escória e gases, declarada como perda.',
  },
  {
    id: 'steel-recycling',
    name: 'Aço reciclado',
    category: 'industry',
    input: { scrap: 1.1, coal: 0.05 },
    output: { steel: 1 },
    hours: 4,
    workers: 10,
    areaM2: 6000,
    processing: 25000,
    energyKwh: 650,
    waterM3: 2,
    lossKg: 150,
    note: 'Alternativa do mesmo alto-forno quando há sucata; mais barata e não gasta reserva.',
  },
  {
    id: 'utensils',
    name: 'Utensílios de aço',
    category: 'industry',
    input: { steel: 0.32 },
    output: { utensils: 60 },
    priced: 'utensils',
    hours: 4,
    workers: 8,
    areaM2: 3000,
    processing: 60000,
    energyKwh: 120,
    waterM3: 1,
    lossKg: 20,
    note: 'Corte e estampagem; 6% de retalho.',
  },
  {
    id: 'truck-heavy',
    name: 'Montagem de caminhão pesado',
    category: 'industry',
    input: { steel: 8 },
    output: { truckHeavy: 1 },
    priced: 'truckHeavy',
    hours: 24,
    workers: 20,
    areaM2: 12000,
    processing: 21500000,
    energyKwh: 2500,
    waterM3: 10,
    lossKg: 0,
    note: 'Motor, pneus e eletrônica entram como processamento agregado.',
  },
  {
    id: 'truck-light',
    name: 'Montagem de caminhão leve',
    category: 'industry',
    input: { steel: 3 },
    output: { truckLight: 1 },
    priced: 'truckLight',
    hours: 12,
    workers: 20,
    areaM2: 12000,
    processing: 10800000,
    energyKwh: 1200,
    waterM3: 5,
    lossKg: 0,
    note: 'Mesma montadora, outra linha de produto.',
  },
  {
    id: 'soy-harvest',
    name: 'Colheita de soja',
    category: 'farm',
    input: { soySeed: 0.6 },
    output: { soy: 30, soySeed: 0.66 },
    priced: 'soy',
    hours: 96,
    workers: 5,
    areaM2: 200000,
    processing: 2600000,
    energyKwh: 400,
    waterM3: 100,
    lossKg: 0,
    note: 'A colheita devolve 10% a mais de semente do que foi plantado.',
  },
  {
    id: 'soy-oil',
    name: 'Esmagamento de soja',
    category: 'industry',
    input: { soy: 1 },
    output: { oil: 200, soymeal: 760 },
    priced: 'oil',
    hours: 2,
    workers: 6,
    areaM2: 1800,
    processing: 12000,
    energyKwh: 100,
    waterM3: 0.5,
    lossKg: 56,
    note: 'Envase incluído. 56 kg de umidade e casca saem como perda.',
  },
  {
    id: 'feed-mill',
    name: 'Fábrica de ração',
    category: 'industry',
    input: { soymeal: 1000 },
    output: { feed: 990 },
    priced: 'feed',
    hours: 2,
    workers: 4,
    areaM2: 1500,
    processing: 4000,
    energyKwh: 60,
    waterM3: 0.4,
    lossKg: 10,
    note: 'Moagem e mistura; sal mineral entra como processamento.',
  },
  {
    id: 'dairy',
    name: 'Ordenha',
    category: 'farm',
    input: { feed: 1687.5, cow: 0.21 },
    output: { milk: 4500, cow: 0.3 },
    requires: { cow: 150 },
    priced: 'milk',
    hours: 24,
    workers: 7,
    areaM2: 45000,
    processing: 150000,
    energyKwh: 180,
    waterM3: 12,
    lossKg: 0,
    note: 'Rebanho de 150 vacas: 30 L e 11,25 kg de ração por vaca por dia. Nascem 0,3 bezerra/dia e 0,21 vaca/dia se aposenta.',
  },
  {
    id: 'rice-harvest',
    name: 'Colheita de arroz',
    category: 'farm',
    input: { riceSeed: 100 },
    output: { rice: 1200, riceSeed: 110 },
    priced: 'rice',
    hours: 96,
    workers: 5,
    areaM2: 200000,
    processing: 700000,
    energyKwh: 200,
    waterM3: 120,
    lossKg: 0,
    note: 'Beneficiamento e pacote de 5 kg incluídos.',
  },
  {
    id: 'beans-harvest',
    name: 'Colheita de feijão',
    category: 'farm',
    input: { beanSeed: 100 },
    output: { beans: 2000, beanSeed: 110 },
    priced: 'beans',
    hours: 72,
    workers: 5,
    areaM2: 200000,
    processing: 550000,
    energyKwh: 150,
    waterM3: 50,
    lossKg: 0,
    note: 'Pacote de 1 kg incluído.',
  },
  {
    id: 'sugar-harvest',
    name: 'Colheita de cana e açúcar',
    category: 'farm',
    input: { caneSeedling: 8 },
    output: { sugar: 1800, caneSeedling: 8.8 },
    priced: 'sugar',
    hours: 120,
    workers: 6,
    areaM2: 200000,
    processing: 900000,
    energyKwh: 600,
    waterM3: 60,
    lossKg: 0,
    note: 'Moagem e pacote de 5 kg incluídos; parte da cana volta como muda.',
  },
];

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
  freightPerTonne: 3500, // caminhão pesado, ~110 km, retorno vazio incluso
  government: { steelTonnesPerDay: 16 },
  // Compras de caminhão na semana de playtest: frota crescendo; só uma parte repõe caminhões aposentados.
  fleet: { heavyPerDay: 0.8, lightPerDay: 0.8, replacementShare: 0.25, scrapShare: 0.9 },
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

export function priceList(): Record<DesignItemId, number> {
  const { markup } = storeEconomics();
  const ids = Object.keys(designItems) as DesignItemId[];
  const price = {} as Record<DesignItemId, number>;
  for (const id of ids) {
    const item = designItems[id],
      rule = item.price;
    if (rule.kind === 'fixed') price[id] = rule.price;
    if (rule.kind === 'band')
      // Consumo final: a faixa é de varejo; a porta da fábrica desconta a margem da loja e o frete.
      price[id] = item.monthlyPerPerson
        ? retailTarget(item) / (1 + markup) - (item.massKg / 1000) * designWorld.freightPerTonne
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
    inputs.reduce((n, [id, q]) => n + (q * designItems[id].massKg) / 1000, 0) *
    designWorld.freightPerTonne *
    cycles;
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
  need('dairy', 'milk', finalDemand.milk!);
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
  lines['feed-mill'] = use('dairy', 'feed') / made(byId('feed-mill'), 'feed');
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
    cows: (byId('dairy').requires!.cow ?? 0) * lines.dairy,
    herdSurplus: make('dairy', 'cow') - use('dairy', 'cow'),
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
      (price[id] + (i.massKg / 1000) * designWorld.freightPerTonne) * (1 + store.markup),
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
