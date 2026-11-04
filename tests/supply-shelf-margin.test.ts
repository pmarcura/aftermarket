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
    // Só fornecedores do mercado: o caso interno (custo do estoque na origem) é o teste abaixo.
    const policy = {
      ...defaultSupplyPolicy(w, loja),
      source: 'market' as const,
      maxDistanceKm: 6000,
    };
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

  it('abastecer de outra unidade própria conta o custo do estoque na origem, não só o frete', () => {
    const w = createWorld(NOW);
    const loja = w.establishments.find((e) => e.category === 'retail' && e.companyId === 'player')!;
    const origem = w.establishments.find(
      (e) => e.category === 'warehouse' && e.companyId === 'player',
    )!;
    const produto = Object.keys(loja.inventory)[0] as ProductId;
    origem.inventory[produto] = 500;
    const policy = {
      ...defaultSupplyPolicy(w, loja),
      source: 'internal-only' as const,
      maxDistanceKm: 6000,
    };
    const livre = supplyCandidates(w, loja, produto, 20, policy);
    expect(livre.length).toBeGreaterThan(0);
    // Preço de venda folgado para o frete sozinho passar na trava de 10%.
    loja.prices[produto] = Math.ceil((livre[0].total / livre[0].quantity) * 3) + 100;
    const travada = { ...policy, shelfMargin: 0.1 };
    origem.unitCosts[produto] = 0;
    expect(supplyCandidates(w, loja, produto, 20, travada).length).toBeGreaterThan(0);
    // O estoque na origem custou o dobro do preço de venda: trazer daria prejuízo.
    origem.unitCosts[produto] = loja.prices[produto]! * 2;
    expect(supplyCandidates(w, loja, produto, 20, travada)).toHaveLength(0);
  });
});
