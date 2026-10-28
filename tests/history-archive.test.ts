import { describe, expect, it } from 'vitest';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { marketView } from '../packages/simulation/src/metrics';
import { archiveHistory } from '../packages/simulation/src/history';
import { worldView } from '../apps/server/src/view';

// Histórico resumido: o que sai para o arquivo continua contando nos totais.
const AT = Date.UTC(2026, 9, 26, 12);
describe('histórico resumido', () => {
  it('arquiva o que passou do prazo sem mudar totais de atacado nem do jogador', () => {
    const w = createScenario(AT, 'economy-2');
    for (let d = 1; d <= 6; d++) advance(w, AT + d * GAME_DAY);
    const trade = marketView(w, 'rice');
    const totals = worldView(w, 'player').view!.totals;
    const sizeBefore = w.ledger.length;
    const old = archiveHistory(w, w.updatedAt, 3);
    expect(old.ledger.length).toBeGreaterThan(0);
    expect(w.ledger.length).toBe(sizeBefore - old.ledger.length);
    expect(w.ledger.every((l) => l.at >= w.updatedAt - GAME_DAY * 3)).toBe(true);
    expect(old.jobs.every((j) => j.completed)).toBe(true);
    expect(old.shipments.every((s) => s.delivered)).toBe(true);
    const after = marketView(w, 'rice');
    expect(after.tradedValue).toBe(trade.tradedValue);
    expect(after.tradedQuantity).toBeCloseTo(trade.tradedQuantity, 6);
    expect(worldView(w, 'player').view!.totals).toEqual(totals);
    // E o mundo segue rodando normalmente depois de arquivar.
    const money = w.companies.reduce((n, c) => n + c.balance, 0);
    advance(w, AT + 7 * GAME_DAY);
    expect(w.companies.reduce((n, c) => n + c.balance, 0)).toBe(money);
  });
});
