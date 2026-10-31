import { TIME_SCALE, products, type ProductId, type Recipe } from './model';
import { createSeasonConfig, type SeasonConfig } from './calibration';
import { designItems, designRecipes, referencePrice, type DesignItemId } from './catalog';
import { analyzeDesign, designWorld, priceList } from './economy-design';
import { infrastructurePrograms } from './channels';
import { GAME_DAY } from './operations';
import { cities } from '../../world/src/geography-v2';

// Configuração da temporada congelada a partir do catálogo da economia alvo (etapa B, D-042).

export function v2Recipes(): Recipe[] {
  return designRecipes.map((r) => {
    // Itens exigidos na linha (vacas) não entram como insumo: nascem e se aposentam pelo rebanho.
    const herdItem = Object.keys(r.requires ?? {})[0] as DesignItemId | undefined;
    const strip = (q: Partial<Record<DesignItemId, number>>) =>
      Object.fromEntries(Object.entries(q).filter(([id]) => id !== herdItem)) as Recipe['input'];
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      input: strip(r.input),
      output: strip(r.output),
      ...(r.requires ? { requires: { ...r.requires } as Recipe['input'] } : {}),
      ...(herdItem
        ? {
            herd: {
              product: herdItem as ProductId,
              births: r.output[herdItem] ?? 0,
              retirements: r.input[herdItem] ?? 0,
            },
          }
        : {}),
      cost: r.processing,
      duration: (r.hours * 3_600_000) / TIME_SCALE,
      energyKwh: r.energyKwh,
      waterM3: r.waterM3,
      lossKg: r.lossKg,
      ...(r.alternativeOf ? { alternativeOf: r.alternativeOf } : {}),
    };
  });
}

export function v2SeasonConfig(scale = 1): SeasonConfig {
  const ids = Object.keys(products) as ProductId[];
  const base = createSeasonConfig(
    Object.fromEntries(ids.map((id) => [id, referencePrice(id as DesignItemId)])) as Record<
      ProductId,
      number
    >,
    v2Recipes(),
  );
  // Editais a 1/4 do tamanho original, para caber no estoque de uma siderúrgica, e oferta de
  // 2,2× o aço público alvo: na prova de 90 dias cerca de metade expira sem proposta válida.
  const lotScale = 0.25,
    states = new Set(cities.map((r) => r.state)).size;
  const steelPerContract =
    (infrastructurePrograms
      .filter((p) => p.product === 'steel')
      .reduce((n, p) => n + p.quantity, 0) /
      infrastructurePrograms.length) *
    lotScale;
  // A obra pública cresce com a escala do mundo, como as siderúrgicas (D-036); antes ficava no
  // tamanho da escala 1 e, com 20×, o governo pedia 1/20 do aço da calculadora.
  const contractsPerDay =
    (designWorld.government.steelTonnesPerDay * 2.2 * scale) / steelPerContract;
  // Centro-Sul real: a procura de jogo é a do mundo de referência vezes a escala, repartida
  // pelos municípios conforme a população.
  const population = cities.reduce((n, city) => n + city.population, 0);
  const config: SeasonConfig = {
    ...base,
    history: { keepDays: 15 },
    wholesalePrices: Object.fromEntries(
      Object.entries(priceList()).map(([id, price]) => [id, Math.round(price)]),
    ) as Record<ProductId, number>,
    recycling: {
      urbanScrapShare: designWorld.urbanScrapShare,
      scrapPrice: referencePrice('scrap'),
    },
    government: {
      lotScale,
      contractIntervalMs: Math.round((GAME_DAY * states) / contractsPerDay),
    },
    regions: cities,
    worldScale: scale,
    design: {
      ...base.design,
      wholesaleMargin: designWorld.wholesaleMargin,
      // Equipamento por receita, arredondado a R$ 1.000: é o botão que faz cada linha se pagar no prazo.
      equipmentByRecipe: Object.fromEntries(
        analyzeDesign().recipes.map((r) => [r.id, Math.round(r.equipment / 100000) * 100000]),
      ),
    },
  };
  config.population = Object.fromEntries(cities.map((city) => [city.id, city.population]));
  config.parameters.playableConsumerShare = (designWorld.consumers * scale) / population;
  config.consumption = Object.fromEntries(
    (Object.entries(designItems) as [DesignItemId, (typeof designItems)[DesignItemId]][])
      .filter(([, item]) => item.monthlyPerPerson)
      .map(([id, item]) => [id, item.monthlyPerPerson]),
  );
  config.operations.profiles = Object.fromEntries(
    designRecipes.map((r) => [r.id, { workers: r.workers, areaM2: r.areaM2 }]),
  );
  // A loja de referência da calculadora atende por dia; o motor conta por rodada de duas horas.
  config.operations.retailUnitsPerWorker = designWorld.retail.unitsPerWorkerDay / 12;
  return config;
}
