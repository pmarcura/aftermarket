import { describe, expect, it } from 'vitest';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { economyHealth } from '../packages/simulation/src/design';
import { marketView } from '../packages/simulation/src/metrics';
import { simplifyPath } from '../packages/simulation/src/geometry';
import { worldView } from '../apps/server/src/view';

// Pacote enxuto do navegador: pequeno, mas com os mesmos números das telas.
const AT = Date.UTC(2026, 9, 26, 12);
describe('pacote do navegador', () => {
  const w = createScenario(AT, 'economy-2');
  for (let d = 1; d <= 9; d++) advance(w, AT + d * GAME_DAY);
  const view = worldView(w, 'player');

  it('fica muito menor que o mundo e só leva o extrato recente do jogador', () => {
    const full = JSON.stringify(w).length,
      slim = JSON.stringify(view).length;
    expect(slim).toBeLessThan(full / 8);
    for (const l of view.ledger) {
      expect(l.from === 'player' || l.to === 'player').toBe(true);
      expect(l.at).toBeGreaterThanOrEqual(w.updatedAt - GAME_DAY * 7);
    }
    expect(view.jobs.every((j) => !j.completed || j.finishesAt >= w.updatedAt - GAME_DAY * 2)).toBe(
      true,
    );
  });

  it('mantém totais desde a abertura, saúde da economia e mercado iguais aos do mundo completo', () => {
    const paid = w.ledger.filter((l) => l.from === 'player').reduce((n, l) => n + l.amount, 0);
    const out = Object.values(view.view!.totals).reduce((n, t) => n + (t?.out ?? 0), 0);
    expect(out).toBe(paid);
    expect(economyHealth(view)).toEqual(economyHealth(w));
    expect(economyHealth(view, view.updatedAt, 'milk')).toEqual(
      economyHealth(w, w.updatedAt, 'milk'),
    );
    for (const id of ['milk', 'steel', 'rice'] as const) {
      expect(marketView(view, id).tradedQuantity).toBeCloseTo(marketView(w, id).tradedQuantity, 6);
      expect(marketView(view, id).tradedValue).toBe(marketView(w, id).tradedValue);
    }
  });

  it('simplifica estradas sem perder início e fim', () => {
    const line = Array.from(
      { length: 4000 },
      (_, i) => [i / 1000, Math.sin(i / 300)] as [number, number],
    );
    const short = simplifyPath(line, 150);
    expect(short.length).toBeLessThanOrEqual(150);
    expect(short[0]).toEqual(line[0]);
    expect(short.at(-1)).toEqual(line.at(-1));
  });
});
