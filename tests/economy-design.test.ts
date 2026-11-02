import { describe, expect, it } from 'vitest';
import {
  analyzeDesign,
  designItems,
  designRecipes,
  designWorld,
  equipmentByRecipe,
  type DesignItemId,
} from '../packages/simulation/src/economy-design';

const massKg = (items: Partial<Record<DesignItemId, number>>) =>
  (Object.entries(items) as [DesignItemId, number][]).reduce(
    (n, [id, q]) => n + q * designItems[id].massKg,
    0,
  );

// Dívida de balanceamento conhecida (spec 003, baseline de 01/11/2026): verificações da calculadora
// realista (utilização 0,7, preço realizado 0,95) que falham hoje. A lista tem de ser exatamente a das
// falhas: nova falha quebra o teste, e falha resolvida também, até alguém atualizar a lista. A spec
// 006 esvazia a lista.
const knownBalanceDebt = [
  'retorno:iron-extraction',
  'retorno:coal-extraction',
  'retorno:steel-bars',
  'retorno:steel-recycling',
  'margem:utensils',
  'lucro:utensils',
  'retorno:utensils',
  'margem:truck-heavy',
  'lucro:truck-heavy',
  'retorno:truck-heavy',
  'margem:truck-light',
  'lucro:truck-light',
  'retorno:truck-light',
  'margem:soy-oil',
  'lucro:soy-oil',
  'retorno:soy-oil',
  'margem:feed-mill',
  'retorno:feed-mill',
  'lucro:rice-harvest',
  'retorno:rice-harvest',
  'lucro:beans-harvest',
  'retorno:beans-harvest',
  'lucro:sugar-harvest',
  'retorno:sugar-harvest',
];

describe('proposta de economia da etapa B', () => {
  const result = analyzeDesign();

  it('falha exatamente nas verificações da dívida de balanceamento conhecida', () => {
    const failed = result.checks.filter((c) => !c.ok);
    expect(failed.map((c) => c.id).sort(), failed.map((c) => c.detail).join('\n')).toEqual(
      [...knownBalanceDebt].sort(),
    );
  });

  it('exige margem, lucro sobre o custo fixo e prazo de retorno em toda receita', () => {
    expect(designWorld.targets.operatingMargin).toBe(0.15);
    expect(designWorld.targets.profitOverFixed).toBe(1.5);
    expect(designWorld.targets.paybackDays).toEqual([20, 60]);
    for (const r of result.recipes) {
      const check = (kind: string) => result.checks.find((c) => c.id === `${kind}:${r.id}`);
      expect(check('margem')?.ok, r.id).toBe(r.margin >= 0.15);
      expect(check('lucro')?.ok, r.id).toBe(r.profit >= 1.5 * r.fixed);
      expect(check('retorno')?.ok, r.id).toBe(r.paybackDays >= 20 && r.paybackDays <= 60);
    }
  });

  it('calcula o lucro de projeto com utilização e preço realizado, e o retorno como saída', () => {
    expect(designWorld.utilization).toBe(0.7);
    expect(designWorld.realizedPrice).toBe(0.95);
    for (const r of result.recipes) {
      const variable = r.materials + r.freight + r.variable;
      expect(r.profit, r.id).toBeCloseTo((r.revenue * 0.95 - variable) * 0.7 - r.fixed, 6);
      expect(r.profitAtCapacity, r.id).toBeCloseTo(r.revenue - variable - r.fixed, 6);
      expect(r.margin, r.id).toBeCloseTo(r.profit / (r.revenue * 0.95 * 0.7), 9);
      // O equipamento é parâmetro do catálogo, não deriva do lucro.
      expect(r.equipment, r.id).toBe(equipmentByRecipe[r.id]);
      expect(r.paybackDays, r.id).toBeCloseTo(r.capex / r.profit, 9);
    }
  });

  it('conta as vacas do rebanho de referência', () => {
    expect(Number.isFinite(result.flows.cows)).toBe(true);
    expect(result.flows.cows).toBeCloseTo(
      150 * (result.flows.lines['milk-production'] ?? Number.NaN),
      9,
    );
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
