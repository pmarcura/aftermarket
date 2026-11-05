import { expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';
import { createStore } from '../apps/server/src/store';
import {
  createSnapshotWriter,
  readWorldSnapshot,
  rollbackSnapshot,
} from '../apps/server/src/world-storage';
import { createCommandConnection } from '../apps/web/src/lib/command-connection';

it('migra o histórico com backup, conserva o mundo e persiste recibos após reabrir', () => {
  const dir = resolve('.runtime/storage-tests', crypto.randomUUID());
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'world.sqlite');
  const original = createWorld();
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE worlds(id INTEGER PRIMARY KEY,state TEXT NOT NULL);');
  db.prepare('INSERT INTO worlds VALUES(1,?)').run(JSON.stringify(original));
  db.close();
  const store = createStore(path);
  expect(store.read()).toEqual(original);
  expect(readdirSync(resolve(dir, 'backups'))).toHaveLength(1);
  const command = {
    type: 'buyProperty' as const,
    propertyId: original.properties.find((p) => p.ownerId === null)!.id,
    name: 'Teste',
  };
  const key = crypto.randomUUID();
  store.command('player', command, key, original.updatedAt);
  // A foto (spec 014) também arquiva o histórico vencido; o mundo reaberto é o da foto.
  store.flush();
  const bought = structuredClone(store.read());
  store.close();
  const reopened = createStore(path);
  expect(reopened.read()).toEqual(bought);
  expect(reopened.command('player', command, key)).toEqual(bought);
  reopened.close();
});

it('persistência incremental reverte falha e não perde lançamentos na próxima tentativa', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE worlds(id INTEGER PRIMARY KEY,state TEXT NOT NULL); INSERT INTO worlds VALUES(1,'{}')",
  );
  const world = createWorld();
  const save = createSnapshotWriter(db);
  db.exec('BEGIN');
  const commit = save(world);
  db.exec('COMMIT');
  commit();
  const before = structuredClone(world);
  const entry = {
    id: crypto.randomUUID(),
    at: world.updatedAt,
    from: 'player',
    to: 'player2',
    amount: 1,
    description: 'teste',
    kind: 'budget' as const,
  };
  world.ledger.push(entry);
  db.exec('BEGIN');
  save(world);
  db.exec('ROLLBACK');
  expect(readWorldSnapshot(db)).toEqual(before);
  db.exec('BEGIN');
  const committed = save(world);
  db.exec('COMMIT');
  committed();
  expect(readWorldSnapshot(db)).toEqual(world);
  db.exec('BEGIN');
  const repeated = save(world);
  db.exec('COMMIT');
  repeated();
  expect(readWorldSnapshot(db).ledger).toEqual(world.ledger);
  db.close();
});

it('rollback copia estado mutável e isola append no histórico imutável', () => {
  const world = createWorld();
  const before = structuredClone(world);
  const backup = rollbackSnapshot(world);
  world.companies[0].balance--;
  world.ledger.push({
    id: 'extra',
    at: world.updatedAt,
    from: 'a',
    to: 'b',
    amount: 1,
    kind: 'budget',
    description: 'teste',
  });
  expect(backup).toEqual(before);
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

it('perda de resposta repete a mesma chave, bloqueia clique simultâneo e recupera após recarregar', async () => {
  const storage = memoryStorage();
  const keys: string[] = [];
  const fetcher = vi.fn(async (_url, init) => {
    keys.push((init!.headers as Record<string, string>)['Idempotency-Key']);
    throw new TypeError('conexão perdida depois de gravar');
  }) as unknown as typeof fetch;
  const send = createCommandConnection(fetcher, storage, 100);
  const command = { type: 'buyProperty' as const, propertyId: 'p', name: 'Teste' };
  const first = send('player', command);
  expect(await send('player', command)).toBeNull();
  await expect(first).rejects.toThrow('sem cobrança duplicada');
  expect(new Set(keys).size).toBe(1);
  const recovery = createCommandConnection(
    (async (_url, init) => {
      keys.push((init!.headers as Record<string, string>)['Idempotency-Key']);
      return new Response(JSON.stringify(createWorld()));
    }) as typeof fetch,
    storage,
  );
  expect(recovery.unconfirmed('player')).toEqual(command);
  await recovery('player', command);
  expect(new Set(keys).size).toBe(1);
  expect(recovery.unconfirmed('player')).toBeNull();
});

it('recusa definitiva libera a operação e não tenta cobrar de novo automaticamente', async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ error: 'Estoque insuficiente' }), { status: 409 }),
  );
  const send = createCommandConnection(fetcher, memoryStorage());
  await expect(
    send('player', { type: 'buyProperty', propertyId: 'p', name: 'Teste' }),
  ).rejects.toThrow('Estoque insuficiente');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(send.unconfirmed('player')).toBeNull();
});
