import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, RuleError } from '../packages/simulation/src/engine';
import { productIds, products, seasonProducts } from '../packages/simulation/src/model';
import { designItems, referencePrice } from '../packages/simulation/src/catalog';

const NOW = Date.UTC(2026, 9, 27, 12);

describe('catálogo da economia alvo', () => {
  it('descreve todos os itens com os números do catálogo', () => {
    const w = createWorld(NOW);
    expect(productIds).toHaveLength(20);
    for (const id of productIds) {
      expect(products[id].name).toBe(designItems[id].name);
      expect(products[id].massT).toBeCloseTo(designItems[id].massKg / 1000, 9);
      expect(products[id].volumeM3).toBe(designItems[id].volumeM3);
      expect(w.season.config.basePrices[id]).toBe(referencePrice(id));
      expect(referencePrice(id)).toBeGreaterThanOrEqual(designItems[id].band[0]);
      expect(referencePrice(id)).toBeLessThanOrEqual(designItems[id].band[1]);
    }
  });

  it('a temporada congela os vinte itens e abre uma referência pública para cada um', () => {
    const w = createWorld(NOW);
    expect(seasonProducts(w).sort()).toEqual([...productIds].sort());
    expect(Object.keys(w.publicBenchmarks ?? {}).sort()).toEqual([...productIds].sort());
  });

  it('recusa sem alterar o mundo um comando com item que a temporada não tem', () => {
    const w = createWorld(NOW);
    delete (w.season.config.basePrices as Partial<Record<string, number>>).utensils;
    const store = w.establishments.find((e) => e.id === 'e-retail')!;
    const before = JSON.stringify(w);
    expect(() =>
      execute(
        w,
        store.companyId,
        { type: 'setPrice', establishmentId: store.id, product: 'utensils', price: 6500 },
        NOW,
      ),
    ).toThrow(RuleError);
    expect(JSON.stringify(w)).toBe(before);
  });
});
