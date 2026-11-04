import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { retailCapacity } from '../packages/simulation/src/operations';
import { contaDaPrateleira, equipeDaLoja } from '../apps/web/src/features/business/precificacao';

// Alertas do Início (spec 011, R2): a equipe curta aparece com a mesma conta da aba Equipe.
describe('equipe da loja no Início', () => {
  const world = createWorld(Date.UTC(2026, 0, 5, 12));
  const loja = world.establishments.find(
    (e) => e.companyId === 'player' && e.category === 'retail',
  )!;
  // Estoque de sobra em tudo o que a cidade procura, para a procura não depender do armazém.
  for (const id of Object.keys(loja.inventory))
    loja.inventory[id as keyof typeof loja.inventory] = 100_000;

  it('com uma pessoa só, falta gente e a loja perde dinheiro por dia', () => {
    loja.employees = 1;
    const e = equipeDaLoja(world, loja);
    expect(e.procura).toBeGreaterThan(e.atende);
    expect(e.ideal).toBeGreaterThan(1);
    expect(e.atende).toBe(retailCapacity(world, loja));
    expect(e.perdaDia).toBeGreaterThan(0);
    expect(e.perdaDia).toBeLessThanOrEqual(contaDaPrateleira(world, loja).agora);
  });

  it('com a equipe ideal, não há perda por falta de gente', () => {
    loja.employees = equipeDaLoja(world, { ...loja, employees: 1 }).ideal;
    const e = equipeDaLoja(world, loja);
    expect(e.ideal).toBeLessThanOrEqual(loja.employees);
    expect(e.perdaDia).toBe(0);
  });
});
