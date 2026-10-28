import type { Category } from './model';

// Catálogo da economia alvo (D-028 a D-030): fonte única de itens e receitas do mundo versão 2,
// lida pelo motor (model.ts) e pela calculadora (economy-design.ts). Dados puros, sem regras.
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
  alternativeOf?: string; // receita que a mesma instalação pode trocar lote a lote
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
    price: { kind: 'band', position: 0.4 }, // porta da fazenda no Centro-Oeste, longe do porto (D-036)
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
    monthlyPerPerson: 0.8,
  },
  feed: {
    name: 'Ração para gado',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0016,
    isNew: true,
    band: [200, 330],
    bandSource: 'real',
    price: { kind: 'band', position: 0.85 }, // paga o farelo de ~580 km em cargas reais (D-036, D-039)
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
    price: { kind: 'band', position: 0.62 }, // leite viaja ~430 km até as cidades (D-036)
    monthlyPerPerson: 8,
  },
  riceSeed: {
    name: 'Semente de arroz',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0017,
    isNew: true,
    band: [350, 900],
    bandSource: 'real',
    price: { kind: 'fixed', price: 730 }, // ~1,8× o grão na porta da fazenda
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
    monthlyPerPerson: 0.3,
  },
  beanSeed: {
    name: 'Semente de feijão',
    unit: 'kg',
    massKg: 1,
    volumeM3: 0.0015,
    isNew: true,
    band: [800, 1600],
    bandSource: 'real',
    price: { kind: 'fixed', price: 1390 }, // ~1,8× o grão na porta da fazenda
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
    monthlyPerPerson: 1,
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
    monthlyPerPerson: 0.2,
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
    alternativeOf: 'steel-bars',
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
    id: 'milk-production',
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

// Rótulo de categoria exibido nas telas.
export const itemCategory: Record<DesignItemId, string> = {
  iron: 'Matérias-primas',
  coal: 'Matérias-primas',
  scrap: 'Matérias-primas',
  steel: 'Materiais',
  utensils: 'Bens de consumo',
  truckHeavy: 'Veículos',
  truckLight: 'Veículos',
  soySeed: 'Sementes',
  soy: 'Agricultura',
  soymeal: 'Agricultura',
  oil: 'Alimentos',
  feed: 'Pecuária',
  cow: 'Pecuária',
  milk: 'Bebidas',
  riceSeed: 'Sementes',
  rice: 'Alimentos',
  beanSeed: 'Sementes',
  beans: 'Alimentos',
  caneSeedling: 'Sementes',
  sugar: 'Alimentos',
};

// Preço de referência do catálogo: varejo para consumo final, porta da fábrica para os demais.
export function referencePrice(id: DesignItemId): number {
  const item = designItems[id],
    rule = item.price;
  if (rule.kind === 'fixed') return rule.price;
  if (rule.kind === 'band')
    return Math.round(item.band[0] + (item.band[1] - item.band[0]) * rule.position);
  return Math.round(referencePrice(rule.of) * rule.factor * rule.unitRatio);
}

// Caminhões fabricados (D-028): capacidade, vida útil para o desgaste e sucata ao desmontar.
// Vida útil comprimida (parâmetro simulado, D-033): no jogo um caminhão roda ~190 km/dia, e a
// vida real (~1 milhão de km) nunca chegaria ao fim numa temporada; assim dura ~130 dias de uso.
export const vehicleModels = {
  truckHeavy: { label: 'Caminhão pesado', capacityT: 30, capacityM3: 85, lifeKm: 25000 },
  truckLight: { label: 'Caminhão leve', capacityT: 8, capacityM3: 25, lifeKm: 15000 },
} as const;
export type VehicleModel = keyof typeof vehicleModels;
// Concessionária institucional (D-030): importado 30% acima do preço de referência.
export const dealershipMarkup = 1.3;
export const scrapRecovery = 0.9; // fração da massa do caminhão que vira sucata
