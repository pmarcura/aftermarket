import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../apps/server/src/store';

// Spec 013: mundo de teste para quando ninguém joga e volta de onde parou, sem recuperar o tempo
// parado (era isso que fazia um mundo esquecido crescer ~1,6 GB por dia).
const MIN = 60_000,
  HORA = 60 * MIN;

describe('pausa de mundo ocioso', () => {
  it('para sem atividade, não pula o tempo parado e segue assim depois de reabrir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aftermarket-pausa-'));
    const path = join(dir, 'mundo.sqlite');
    let store = createStore(path, { scenario: 'baseline', pauseWhenIdleMs: MIN });
    try {
      const t0 = Date.now();
      // Abrir já desconta os milissegundos entre criar o mundo e ligar o servidor.
      const p0 = store.read().pausedMs ?? 0;
      store.tick(t0 + 30_000);
      expect(store.parado()).toBe(false);
      const andou = store.read().updatedAt;
      // O mundo marca o instante do último evento, nunca à frente do relógio.
      expect(andou).toBeLessThanOrEqual(t0 + 30_000);

      // Um minuto sem ninguém: para. Dez horas depois, o mundo não andou nada.
      store.tick(t0 + 70_000);
      expect(store.parado()).toBe(true);
      store.tick(t0 + 10 * HORA);
      expect(store.read().updatedAt).toBe(andou);

      // Alguém volta: o relógio do mundo continua de onde parou, não 10 h à frente.
      store.atividade(t0 + 10 * HORA);
      expect(store.parado()).toBe(false);
      expect(store.read().pausedMs).toBe(p0 + 10 * HORA - 70_000);
      store.tick(t0 + 10 * HORA + 1_000);
      expect(store.read().updatedAt).toBeLessThanOrEqual(t0 + 71_000);
      const revisao = store.read().revision;
      store.close();

      // Reaberto: o tempo parado fica gravado e o mundo não recupera horas de uma vez.
      store = createStore(path, { scenario: 'baseline', pauseWhenIdleMs: MIN });
      expect(store.read().pausedMs).toBe(p0 + 10 * HORA - 70_000);
      expect(store.read().revision).toBeGreaterThanOrEqual(revisao);
      store.atividade(t0 + 10 * HORA + 2_000);
      store.tick(t0 + 10 * HORA + 3_000);
      expect(store.read().updatedAt).toBeLessThanOrEqual(t0 + 73_000);
      store.close();
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sem a opção, o mundo nunca para (mundo principal)', () => {
    const store = createStore(':memory:', { scenario: 'baseline' });
    const t0 = Date.now();
    store.tick(t0 + 10 * HORA);
    expect(store.parado()).toBe(false);
    expect(store.read().updatedAt).toBeGreaterThan(t0 + 9 * HORA);
    expect(store.read().pausedMs).toBeUndefined();
    store.close();
  });
});
