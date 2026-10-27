import { describe, expect, it } from 'vitest';
import {
  analyzeDesign,
  designItems,
  designRecipes,
  type DesignItemId,
} from '../packages/simulation/src/economy-design';

const massKg = (items: Partial<Record<DesignItemId, number>>) =>
  (Object.entries(items) as [DesignItemId, number][]).reduce(
    (n, [id, q]) => n + q * designItems[id].massKg,
    0,
  );

describe('proposta de economia da etapa B', () => {
  const result = analyzeDesign();

  it('passa em todas as verificações de balanceamento', () => {
    expect(result.checks.filter((c) => !c.ok).map((c) => c.detail)).toEqual([]);
  });

  it('conserva massa nas indústrias, declarando a perda', () => {
    // Fazendas e minas criam massa (cultivo, extração); a montadora agrega componentes ao aço.
    for (const r of designRecipes.filter(
      (r) => r.category === 'industry' && !r.id.startsWith('truck'),
    ))
      expect(massKg(r.input), r.id).toBeCloseTo(massKg(r.output) + r.lossKg, 6);
  });

  it('dá destino a todo item produzido', () => {
    const consumed = new Set(designRecipes.flatMap((r) => Object.keys(r.input)));
    const final = (Object.keys(designItems) as DesignItemId[]).filter(
      (id) => designItems[id].monthlyPerPerson || id.startsWith('truck') || id === 'steel',
    );
    for (const id of Object.keys(designItems) as DesignItemId[])
      expect(consumed.has(id) || final.includes(id), id).toBe(true);
  });

  it('mantém cada negócio rentável antes do investimento', () => {
    for (const r of result.recipes) expect(r.profit, r.id).toBeGreaterThan(0);
  });

  it('absorve o farelo e deixa o governo com menos da metade do aço', () => {
    expect(result.flows.soymeal.absorption).toBeGreaterThan(0.9);
    expect(result.flows.steel.government / result.flows.steel.demand).toBeLessThanOrEqual(0.5);
  });
});
