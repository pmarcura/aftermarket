import type { Category, LegacyProductId, ProductId, Recipe } from './model';
import { designItems } from './catalog';
import { competitionRules } from './competition';
import { designRules } from './design';
import { regions } from '../../world/src/regions';
import { operationRules } from './operations';

export const calibration = {
  version: '2026-10-26',
  // Parâmetros de simulação. As referências nacionais não são estatísticas municipais.
  minimumWage: 162100,
  participation: 0.621,
  unemployment: 0.054,
  workingAgeShare: 0.75,
  playableLaborShare: 0.1,
  playableConsumerShare: 0.01,
  payrollBurden: 1.65,
  dieselPerLiter: 650,
  kmPerLiter: 2.5,
  maintenancePerKm: 95,
  driverPerHour: 3000,
  estimatedTollPerKm: 30,
  averageSpeedKmH: 55,
  loadingMinutes: 30,
};
export const salaryByCategory: Record<Category, number> = {
  retail: 240000,
  industry: 380000,
  farm: 260000,
  mine: 420000,
  warehouse: 280000,
  logistics: 320000,
};
export const monthlyMaintenance: Record<Category, number> = {
  retail: 90000,
  industry: 3000000,
  farm: 600000,
  mine: 4500000,
  warehouse: 600000,
  logistics: 700000,
};
export const utilityRates: Record<
  string,
  {
    electricity: number;
    water: number;
    standingKwhPerEmployee: number;
    standingM3PerEmployee: number;
  }
> = {
  SP: { electricity: 92, water: 2000, standingKwhPerEmployee: 5, standingM3PerEmployee: 0.12 },
  MG: { electricity: 96, water: 1800, standingKwhPerEmployee: 5, standingM3PerEmployee: 0.12 },
  PR: { electricity: 88, water: 1700, standingKwhPerEmployee: 5, standingM3PerEmployee: 0.12 },
};
export const monthlyConsumption: Partial<Record<ProductId, number>> = {
  oil: 0.8,
  rice: 0.3,
  beans: 1,
  sugar: 0.2,
  milk: 8,
};
type PriceReference = {
  low: number;
  high: number;
  note: string;
  source: string;
  date: string;
  level: string;
};
const legacyPriceReferences: Record<LegacyProductId, PriceReference> = {
  iron: {
    low: 35000,
    high: 65000,
    note: 'Faixa de calibração do minério a granel; teor, umidade e frete mudam o preço.',
    source: 'https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas',
    date: '2026-10-26',
    level: 'Insumo a granel · estimativa',
  },
  coal: {
    low: 130000,
    high: 240000,
    note: 'Carvão metalúrgico: faixa estimada, sem equiparar tipos térmicos e coque.',
    source: 'https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas',
    date: '2026-10-26',
    level: 'Insumo a granel · estimativa',
  },
  steel: {
    low: 380000,
    high: 620000,
    note: 'Barras industriais. Tipo, norma e acabamento não são diferenciados nesta versão.',
    source:
      'https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9270-sistema-nacional-de-pesquisa-de-custos-e-indices-da-construcao-civil.html',
    date: '2026-10-26',
    level: 'Material industrial · estimativa',
  },
  soy: {
    low: 210000,
    high: 270000,
    note: 'R$ 2.500/t equivale a R$ 150 por saca de 60 kg. Âncora de jogo, não cotação ao vivo.',
    source: 'https://www.cepea.org.br/br/indicador/soja.aspx',
    date: '2026-10-26',
    level: 'Soja em grão · calibração por saca',
  },
  soymeal: {
    low: 170,
    high: 280,
    note: 'Farelo em kg; faixa de calibração do coproduto do esmagamento.',
    source: 'https://www.cepea.org.br/upload/revista/pdf/0705703001775841088.pdf',
    date: '2026-03',
    level: 'Farelo a granel · estimativa',
  },
  oil: {
    low: 650,
    high: 1050,
    note: 'Embalagem de 1 litro; comparar embalagem e canal antes de comparar preços.',
    source: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios',
    date: '2026-10-26',
    level: 'Varejo · parâmetro de calibração',
  },
  rice: {
    low: 1900,
    high: 3000,
    note: 'Pacote de 5 kg. Faixa estimada para o varejo do cenário.',
    source: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios',
    date: '2026-10-26',
    level: 'Varejo · pacote 5 kg',
  },
  beans: {
    low: 650,
    high: 1200,
    note: 'Pacote de 1 kg; variedade e praça alteram o preço.',
    source: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios',
    date: '2026-10-26',
    level: 'Varejo · pacote 1 kg',
  },
  sugar: {
    low: 1400,
    high: 2300,
    note: 'Pacote de 5 kg; parâmetro, sem pretensão de cotação local.',
    source: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios',
    date: '2026-10-26',
    level: 'Varejo · pacote 5 kg',
  },
  milk: {
    low: 400,
    high: 750,
    note: 'Leite embalado de 1 litro, distinto do preço pago ao produtor.',
    source: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/precos-agropecuarios',
    date: '2026-10-26',
    level: 'Varejo · 1 litro',
  },
};
// Itens da versão 2: faixas do catálogo da economia alvo (D-029).
export const priceReferences: Record<ProductId, PriceReference> = {
  ...legacyPriceReferences,
  ...(Object.fromEntries(
    (
      [
        'scrap',
        'utensils',
        'truckHeavy',
        'truckLight',
        'soySeed',
        'feed',
        'cow',
        'riceSeed',
        'beanSeed',
        'caneSeedling',
      ] as const
    ).map((id) => [
      id,
      {
        low: designItems[id].band[0],
        high: designItems[id].band[1],
        note: 'Faixa do catálogo da economia alvo.',
        source: 'docs/product/ECONOMIA-ALVO.md',
        date: '2026-10-27',
        level:
          designItems[id].bandSource === 'real'
            ? 'Referência real · estimativa'
            : 'Parâmetro de jogo',
      },
    ]),
  ) as Record<Exclude<ProductId, LegacyProductId>, PriceReference>),
};
export const economicSources = [
  {
    name: 'Salário mínimo nacional · R$ 1.621 em 2026',
    url: 'https://www.gov.br/esocial/pt-br/noticias/novo-salario-minimo-2026-veja-como-registrar-o-reajuste-no-esocial-domestico',
  },
  {
    name: 'PNAD nacional · participação 62,1% / desocupação 5,4% como âncoras',
    url: 'https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/45989-pnad-continua-taxa-de-desocupacao-e-de-5-4-e-taxa-de-subutilizacao-e-de-13-8-no-trimestre-encerrado-em-janeiro',
  },
  { name: 'ANEEL · tarifas e componentes', url: 'https://www.gov.br/aneel/pt-br/assuntos/tarifas' },
  { name: 'SANASA · estrutura tarifária 2026', url: 'https://www.sanasa.com.br/servicos/tarifa/' },
  {
    name: 'ANP · acompanhamento dos combustíveis',
    url: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/sintese-semanal-do-comportamento-dos-precos-dos-combustiveis',
  },
];

export interface SeasonConfig {
  // Ausente nos mundos da versão 1; 2 = economia alvo da etapa B.
  economyVersion?: number;
  // Versão 2: sucata urbana devolvida pelos utensílios vendidos e preço da coleta municipal.
  recycling?: { urbanScrapShare: number; scrapPrice: number };
  // Versão 2: editais menores e espaçados, dimensionados pelo aço público da economia alvo.
  government?: { lotScale: number; contractIntervalMs: number };
  // Versão 2: preço de referência na porta da fábrica; basePrices dos itens de consumo é o de loja.
  wholesalePrices?: Record<string, number>;
  // Versão 2: o servidor arquiva extrato, lotes e entregas com mais de keepDays dias de jogo.
  history?: { keepDays: number };
  // Versão 2: municípios do mundo (geography-v2.ts) e escala da economia (1 = mundo de
  // referência da calculadora; 10 = cerca de 500 empresas-bot). Ausente: 10 praças piloto.
  regions?: import('../../world/src/geography-v2').City[];
  worldScale?: number;
  design: typeof designRules & { equipmentByRecipe?: Record<string, number> };
  competition: typeof competitionRules;
  operations: typeof operationRules;
  version: string;
  parameters: typeof calibration;
  salaries: typeof salaryByCategory;
  maintenance: typeof monthlyMaintenance;
  utilities: typeof utilityRates;
  consumption: typeof monthlyConsumption;
  priceBands: typeof priceReferences;
  basePrices: Record<ProductId, number>;
  recipes: Recipe[];
  population: Record<string, number>;
  qualification: Record<Category, number>;
}
// Cópia persistida na abertura da temporada. Nenhuma cotação externa é consultada pelo motor.
export function createSeasonConfig(
  basePrices: Record<ProductId, number>,
  recipes: Recipe[],
): SeasonConfig {
  return structuredClone({
    competition: competitionRules,
    design: designRules,
    operations: operationRules,
    version: calibration.version,
    parameters: calibration,
    salaries: salaryByCategory,
    maintenance: monthlyMaintenance,
    utilities: utilityRates,
    consumption: monthlyConsumption,
    priceBands: priceReferences,
    basePrices,
    recipes,
    population: Object.fromEntries(regions.map((r) => [r.id, r.population])),
    qualification: {
      industry: 0.3,
      mine: 0.3,
      logistics: 0.4,
      warehouse: 0.6,
      farm: 0.6,
      retail: 0.6,
    },
  });
}
