import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { gameDay } from '../packages/simulation/src/clock';
import { createStore } from '../apps/server/src/store';
import { DatabaseSync } from 'node:sqlite';
import { readWorldSnapshot } from '../apps/server/src/world-storage';

// Spec 013: custos fixos viram uma linha por estabelecimento, natureza e dia, sem mudar o dinheiro.
const FIXOS = new Set(['payroll', 'maintenance', 'energy', 'water']);
const AT = Date.UTC(2026, 9, 26, 12);

describe('custos fixos em uma linha por dia', () => {
  it('3 dias: no máximo uma linha por estabelecimento, natureza e dia, e o extrato fecha com os saldos', () => {
    const w = createScenario(AT, 'baseline', 0);
    const antes = new Map(w.companies.map((c) => [c.id, c.balance])),
      inicio = w.ledger.length;
    const dia = gameDay(w);
    advance(w, AT + 3 * dia);
    const linhas = new Map<string, number>();
    for (const l of w.ledger) {
      if (!l.daily) continue;
      const chave = `${l.establishmentId}|${l.kind}|${l.from}|${l.to}|${l.product ?? ''}|${Math.floor((l.at - w.season.startedAt) / dia)}`;
      linhas.set(chave, (linhas.get(chave) ?? 0) + 1);
    }
    expect(linhas.size).toBeGreaterThan(0);
    expect(Math.max(...linhas.values())).toBe(1);
    // Saldo final de cada empresa = saldo inicial + entradas − saídas do extrato.
    const mov = new Map<string, number>();
    for (const l of w.ledger.slice(inicio)) {
      mov.set(l.from, (mov.get(l.from) ?? 0) - l.amount);
      mov.set(l.to, (mov.get(l.to) ?? 0) + l.amount);
    }
    for (const c of w.companies) expect(c.balance).toBe(antes.get(c.id)! + (mov.get(c.id) ?? 0));
  });

  it('a linha do dia que cresce é regravada no banco e volta igual ao reabrir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aftermarket-custos-'));
    const path = join(dir, 'mundo.sqlite');
    let store = createStore(path, { scenario: 'baseline' });
    try {
      const t0 = store.read().updatedAt,
        dia = gameDay(store.read());
      // Várias gravações no mesmo dia: cada rodada soma na linha que já está no banco.
      for (let h = 1; h <= 10; h++) {
        store.tick(t0 + (h * dia) / 12 + 1);
        store.flush();
      }
      const memoria = store.read().ledger;
      store.close();
      const db = new DatabaseSync(path, { readOnly: true });
      const banco = readWorldSnapshot(db).ledger;
      db.close();
      expect(banco).toEqual(memoria);
      const fixos = banco.filter((l) => FIXOS.has(l.kind));
      expect(fixos.length).toBeGreaterThan(0);
      store = createStore(path, { scenario: 'baseline' });
      expect(store.read().ledger).toEqual(memoria);
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
