import { TIME_SCALE, products, type ProductId, type Recipe } from './model';
import { createSeasonConfig, type SeasonConfig } from './calibration';
import { designItems, designRecipes, referencePrice, type DesignItemId } from './catalog';
import { analyzeDesign, designWorld } from './economy-design';

// Mundo versão 2 (etapa B): configuração congelada a partir do catálogo da economia alvo.
export const ECONOMY_V2 = 2;

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

export function v2SeasonConfig(): SeasonConfig {
  const ids = Object.keys(products) as ProductId[];
  const config = createSeasonConfig(
    Object.fromEntries(ids.map((id) => [id, referencePrice(id as DesignItemId)])) as Record<
      ProductId,
      number
    >,
    v2Recipes(),
  );
  config.economyVersion = ECONOMY_V2;
  config.recycling = {
    urbanScrapShare: designWorld.urbanScrapShare,
    scrapPrice: referencePrice('scrap'),
  };
  config.parameters.playableConsumerShare = designWorld.consumerShare;
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
  // Equipamento por receita, arredondado a R$ 1.000: é o botão que faz cada linha se pagar no prazo.
  config.design.equipmentByRecipe = Object.fromEntries(
    analyzeDesign().recipes.map((r) => [r.id, Math.round(r.equipment / 100000) * 100000]),
  );
  return config;
}
