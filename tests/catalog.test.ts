import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, RuleError } from '../packages/simulation/src/engine';
import {
  legacyProducts,
  newProductIds,
  products,
  seasonProducts,
} from '../packages/simulation/src/model';
import { designItems, referencePrice } from '../packages/simulation/src/catalog';

const NOW = Date.UTC(2026, 9, 27, 12);

describe('catálogo da economia alvo', () => {
  it('descreve os itens novos com os números do catálogo', () => {
    for (const id of newProductIds) {
      expect(products[id].name).toBe(designItems[id].name);
      expect(products[id].massT).toBeCloseTo(designItems[id].massKg / 1000, 9);
      expect(products[id].volumeM3).toBe(designItems[id].volumeM3);
      expect(products[id].basePrice).toBe(referencePrice(id));
      expect(products[id].basePrice).toBeGreaterThanOrEqual(designItems[id].band[0]);
      expect(products[id].basePrice).toBeLessThanOrEqual(designItems[id].band[1]);
    }
  });

  it('mantém o mundo da versão 1 com os dez produtos originais', () => {
    const w = createWorld(NOW);
    expect(seasonProducts(w).sort()).toEqual(Object.keys(legacyProducts).sort());
    expect(Object.keys(w.publicBenchmarks ?? {}).sort()).toEqual(
      Object.keys(legacyProducts).sort(),
    );
  });

  it('recusa sem alterar o mundo um comando com item que a temporada não tem', () => {
    const w = createWorld(NOW);
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
