import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { seasonProducts, products, TIME_SCALE } from '../packages/simulation/src/model';
import { householdItems } from '../packages/simulation/src/channels';
import { equipmentCostFor } from '../packages/simulation/src/design';
import { householdDemand } from '../packages/simulation/src/metrics';
import {
  analyzeDesign,
  designRecipes,
  designWorld,
} from '../packages/simulation/src/economy-design';

const NOW = Date.UTC(2026, 9, 27, 12);

describe('mundo versão 2 · configuração da economia alvo', () => {
  const v1 = createWorld(NOW);
  const v2 = createWorld(NOW, { economy: 2 });
  const design = analyzeDesign();

  it('congela os vinte itens e as receitas do catálogo', () => {
    expect(v2.season.config.economyVersion).toBe(2);
    expect(seasonProducts(v2).sort()).toEqual(Object.keys(products).sort());
    for (const r of designRecipes) {
      const recipe = v2.season.config.recipes.find((x) => x.id === r.id)!;
      // Vacas exigidas na linha saem dos insumos e viram nascimentos/aposentadorias do rebanho.
      const herd = Object.keys(r.requires ?? {})[0];
      const without = (q: Record<string, number | undefined>) =>
        Object.fromEntries(Object.entries(q).filter(([id]) => id !== herd));
      expect(recipe.input).toEqual(without(r.input));
      expect(recipe.output).toEqual(without(r.output));
      if (herd)
        expect(recipe.herd).toEqual({
          product: herd,
          births: r.output[herd as keyof typeof r.output],
          retirements: r.input[herd as keyof typeof r.input],
        });
      expect(recipe.cost).toBe(r.processing);
      expect(recipe.duration).toBe((r.hours * 3_600_000) / TIME_SCALE);
      expect(v2.season.config.operations.profiles[r.id]).toEqual({
        workers: r.workers,
        areaM2: r.areaM2,
      });
    }
  });

  it('usa a calibração da calculadora: consumo, loja e equipamento por receita', () => {
    // Centro-Sul real: a parcela de consumidores reparte pela população a procura do mundo de
    // referência vezes a escala.
    const population = Object.values(v2.season.config.population).reduce((n, p) => n + p, 0);
    expect(population * v2.season.config.parameters.playableConsumerShare).toBeCloseTo(
      designWorld.consumers * (v2.season.config.worldScale ?? 1),
      3,
    );
    expect(householdItems(v2)).toContain('utensils');
    expect(v2.season.config.operations.retailUnitsPerWorker * 12).toBe(
      designWorld.retail.unitsPerWorkerDay,
    );
    for (const r of design.recipes) {
      const cost = equipmentCostFor(v2, r.category, r.id);
      expect(Math.abs(cost - r.equipment)).toBeLessThanOrEqual(50000);
    }
    // Procura total de leite do mundo: consumidores de referência vezes o consumo mensal / 30.
    const milk = Object.keys(v2.season.config.population).reduce(
      (n, region) => n + householdDemand(v2, region, 'milk'),
      0,
    );
    expect(milk).toBeCloseTo(
      (designWorld.consumers *
        (v2.season.config.worldScale ?? 1) *
        v2.season.config.consumption.milk!) /
        30,
      3,
    );
  });

  it('não altera o mundo da versão 1', () => {
    expect(v1.season.config.economyVersion).toBeUndefined();
    expect(v1.season.config.design.equipmentByRecipe).toBeUndefined();
    expect(householdItems(v1)).toEqual(['oil', 'rice', 'beans', 'sugar', 'milk']);
    expect(equipmentCostFor(v1, 'industry', 'steel-bars')).toBe(
      v1.season.config.design.equipmentCost.industry,
    );
  });
});
