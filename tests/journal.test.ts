import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../apps/server/src/store';
import { readJournalSeq } from '../apps/server/src/world-storage';
import { archiveHistory } from '../packages/simulation/src/history';
import { gameDay } from '../packages/simulation/src/clock';
import type { Command, World } from '../packages/simulation/src/model';

// Spec 014: cada clique grava só uma linha de diário; foto + diário reconstroem o mundo idêntico.
const hash = (w: unknown) => createHash('sha256').update(JSON.stringify(w)).digest('hex');

function abrirPasta() {
  const dir = mkdtempSync(join(tmpdir(), 'aftermarket-diario-'));
  return { dir, path: join(dir, 'mundo.sqlite') };
}
function linhasDoDiario(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  const n = (db.prepare('SELECT count(*) AS n FROM world_journal').get() as { n: number }).n;
  const seq = readJournalSeq(db);
  db.close();
  return { n, seq };
}
/** Comandos reais do jogador e passagem do tempo com rodadas econômicas e bots. */
function jogar(store: ReturnType<typeof createStore>, t0: number) {
  const w = store.read();
  const loja = w.establishments.find((e) => e.companyId === 'player' && e.category === 'retail')!;
  const produto = Object.keys(loja.inventory)[0] as keyof typeof loja.inventory;
  const lote = w.properties.find((p) => p.ownerId === null)!;
  const dia = gameDay(w);
  const comandos: Command[] = [
    { type: 'setPrice', establishmentId: loja.id, product: produto, price: 1234 },
    { type: 'buyProperty', propertyId: lote.id, name: 'Depósito do diário' },
  ];
  let t = t0;
  for (let i = 0; i < 6; i++) {
    t += dia / 5;
    store.tick(t);
    const c = comandos[i % comandos.length];
    try {
      store.command('player', c, crypto.randomUUID(), t + 1);
    } catch {
      // Comando recusado (o lote já foi comprado): não entra no diário.
    }
  }
  const chave = Object.keys(store.read().routes)[0] ?? 'a:b';
  store.route(chave, {
    coordinates: [
      [-47, -23],
      [-46.9, -22.9],
    ],
    distanceKm: 15,
    durationSeconds: 900,
    source: 'osrm',
    fetchedAt: t,
  });
  return t;
}

describe('diário + foto', () => {
  it('queda sem foto: reabrir repete o diário e reconstrói o mundo idêntico', () => {
    const { dir, path } = abrirPasta();
    let store = createStore(path, { scenario: 'baseline', snapshotEveryEntries: 1e9 });
    try {
      const t0 = store.read().updatedAt;
      jogar(store, t0);
      const antes = structuredClone(store.read());
      const { n } = linhasDoDiario(path);
      expect(n).toBeGreaterThan(5);
      // Queda: fecha sem foto.
      store.abandonar();
      store = createStore(path, { scenario: 'baseline' });
      // Ao reabrir, o servidor repete o diário e tira uma foto (que arquiva o histórico vencido).
      const esperado = structuredClone(antes) as World;
      archiveHistory(esperado, esperado.updatedAt, esperado.season.config.history.keepDays);
      expect(hash(store.read())).toBe(hash(esperado));
      expect(linhasDoDiario(path).n).toBe(0);
      expect(linhasDoDiario(path).seq).toBeGreaterThan(0);
      // E a foto nova reabre igual.
      store.close();
      store = createStore(path, { scenario: 'baseline' });
      expect(hash(store.read())).toBe(hash(esperado));
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('o mesmo recibo depois da queda não executa de novo; comando recusado não deixa linha', () => {
    const { dir, path } = abrirPasta();
    let store = createStore(path, { scenario: 'baseline', snapshotEveryEntries: 1e9 });
    try {
      const w = store.read();
      const lote = w.properties.find((p) => p.ownerId === null)!;
      const compra: Command = { type: 'buyProperty', propertyId: lote.id, name: 'Lote' };
      const chave = crypto.randomUUID();
      store.command('player', compra, chave, w.updatedAt + 1);
      const linhas = linhasDoDiario(path).n;
      // Recusado: comprar de novo o mesmo lote (já é do jogador).
      expect(() => store.command('player', compra, crypto.randomUUID(), w.updatedAt + 2)).toThrow();
      expect(linhasDoDiario(path).n).toBe(linhas);
      const saldo = store.read().companies.find((c) => c.id === 'player')!.balance;
      store.abandonar();
      store = createStore(path, { scenario: 'baseline' });
      store.command('player', compra, chave);
      expect(store.read().companies.find((c) => c.id === 'player')!.balance).toBe(saldo);
      expect(store.read().properties.find((p) => p.id === lote.id)!.ownerId).toBe('player');
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('o clique não regrava o mundo; a foto vem a cada N linhas e limpa o diário', () => {
    const { dir, path } = abrirPasta();
    let store = createStore(path, { scenario: 'baseline', snapshotEveryEntries: 4 });
    try {
      const estado = () => {
        const db = new DatabaseSync(path, { readOnly: true });
        const s = (db.prepare('SELECT state FROM worlds').get() as { state: string }).state;
        db.close();
        return hash(s);
      };
      const w = store.read();
      const loja = w.establishments.find(
        (e) => e.companyId === 'player' && e.category === 'retail',
      )!;
      const produto = Object.keys(loja.inventory)[0] as keyof typeof loja.inventory;
      const foto = estado();
      store.command(
        'player',
        { type: 'setPrice', establishmentId: loja.id, product: produto, price: 999 },
        crypto.randomUUID(),
        w.updatedAt + 1,
      );
      expect(estado()).toBe(foto);
      expect(linhasDoDiario(path).n).toBe(1);
      jogar(store, store.read().updatedAt);
      expect(estado()).not.toBe(foto);
      // A foto é decidida na passagem do tempo: sobram no máximo N linhas desde a última.
      expect(linhasDoDiario(path).n).toBeLessThanOrEqual(4);
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('foto mais nova que o diário (código sem diário gravou por cima): descarta o diário velho', () => {
    const { dir, path } = abrirPasta();
    let store = createStore(path, { scenario: 'baseline', snapshotEveryEntries: 1e9 });
    try {
      jogar(store, store.read().updatedAt);
      expect(linhasDoDiario(path).n).toBeGreaterThan(0);
      store.abandonar();
      // Simula um servidor antigo: gravou uma foto mais nova e não apagou o diário.
      const db = new DatabaseSync(path);
      db.exec(
        "UPDATE worlds SET state = json_set(state, '$.revision', json_extract(state, '$.revision') + 1000)",
      );
      const foto = JSON.parse(
        (db.prepare('SELECT state FROM worlds').get() as { state: string }).state,
      );
      db.close();
      store = createStore(path, { scenario: 'baseline' });
      // Nada repetido por cima: o mundo é o da foto, e o diário velho foi apagado.
      expect(store.read().revision).toBe(foto.revision);
      expect(store.read().updatedAt).toBe(foto.updatedAt);
      expect(linhasDoDiario(path).n).toBe(0);
    } finally {
      try {
        store.close();
      } catch {}
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
