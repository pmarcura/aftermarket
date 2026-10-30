import { productIds, type Category, type ProductId, type Recipe } from './model';
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
// Faixas de referência de cada item: do catálogo da economia alvo (D-029), com a proveniência
// anotada nele quando a faixa vem de uma referência real.
export const priceReferences: Record<ProductId, PriceReference> = Object.fromEntries(
  productIds.map((id) => {
    const item = designItems[id];
    return [
      id,
      {
        low: item.band[0],
        high: item.band[1],
        ...(item.provenance ?? {
          note: 'Faixa do catálogo da economia alvo.',
          source: 'docs/product/ECONOMIA-ALVO.md',
          date: '2026-10-27',
          level: item.bandSource === 'real' ? 'Referência real · estimativa' : 'Parâmetro de jogo',
        }),
      },
    ];
  }),
) as Record<ProductId, PriceReference>;
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
  // Sucata urbana devolvida pelos utensílios vendidos e preço da coleta municipal.
  recycling: { urbanScrapShare: number; scrapPrice: number };
  // Editais menores e espaçados, dimensionados pelo aço público da economia alvo.
  government: { lotScale: number; contractIntervalMs: number };
  // Preço de referência na porta da fábrica; basePrices dos itens de consumo é o de loja.
  wholesalePrices: Record<ProductId, number>;
  // O servidor arquiva extrato, lotes e entregas com mais de keepDays dias de jogo.
  history: { keepDays: number };
  // Municípios do mundo (geography-v2.ts) e escala da economia (1 = mundo de referência da
  // calculadora; 20 = cerca de 500 empresas-bot).
  regions: import('../../world/src/geography-v2').City[];
  worldScale: number;
  design: typeof designRules & {
    equipmentByRecipe: Record<string, number>;
    wholesaleMargin: number; // margem do atacadista sobre o custo posto
  };
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
// Parâmetros gerais da temporada; a parte derivada do catálogo (preços de fábrica, editais,
// municípios, escala) entra em `v2SeasonConfig` (economy-v2.ts).
export type SeasonBase = Omit<
  SeasonConfig,
  'recycling' | 'government' | 'wholesalePrices' | 'history' | 'regions' | 'worldScale' | 'design'
> & { design: typeof designRules };
// Cópia persistida na abertura da temporada. Nenhuma cotação externa é consultada pelo motor.
export function createSeasonConfig(
  basePrices: Record<ProductId, number>,
  recipes: Recipe[],
): SeasonBase {
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
