import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { defaultSupplyPolicy } from '../packages/simulation/src/competition';
import { retailCeiling, supplyCandidates } from '../packages/simulation/src/supply';
import type { ProductId } from '../packages/simulation/src/model';

const NOW = Date.UTC(2026, 9, 27, 4);

describe('trava de lucro da reposição da loja', () => {
  it('sem trava nada muda; com trava recusa o que chega acima do preço de venda menos a margem', () => {
    const w = createWorld(NOW);
    const loja = w.establishments.find((e) => e.category === 'retail')!;
    const policy = { ...defaultSupplyPolicy(w, loja), maxDistanceKm: 6000 };
    const produto = (Object.keys(w.season.config.basePrices) as ProductId[]).find(
      (p) => supplyCandidates(w, loja, p, 20, policy).length > 0,
    );
    expect(produto).toBeDefined();
    const livre = supplyCandidates(w, loja, produto!, 20, policy);
    expect(retailCeiling(w, loja, produto!, policy)).toBe(0);

    const travada = { ...policy, shelfMargin: 0.1 };
    const melhor = livre[0].total / livre[0].quantity;
    // Preço de venda alto: o melhor fornecedor ainda passa.
    loja.prices[produto!] = Math.ceil(melhor * 2);
    expect(supplyCandidates(w, loja, produto!, 20, travada)[0]?.total).toBe(livre[0].total);
    // Preço de venda abaixo do custo entregue: nada é comprado.
    loja.prices[produto!] = Math.floor(melhor);
    for (const c of supplyCandidates(w, loja, produto!, 20, travada))
      expect(c.total / c.quantity).toBeLessThanOrEqual(retailCeiling(w, loja, produto!, travada));
    loja.prices[produto!] = 1;
    expect(supplyCandidates(w, loja, produto!, 20, travada)).toHaveLength(0);
  });
});
