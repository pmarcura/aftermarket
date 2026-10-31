import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';
import { createStore } from '../apps/server/src/store';

function openDatabase(state: unknown) {
  const dir = resolve('.runtime/migration-tests', crypto.randomUUID());
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'world.sqlite'),
    db = new DatabaseSync(path);
  db.exec(
    'CREATE TABLE worlds(id INTEGER PRIMARY KEY,state TEXT NOT NULL);CREATE TABLE receipts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,command TEXT NOT NULL)',
  );
  db.prepare('INSERT INTO worlds VALUES(1,?)').run(JSON.stringify(state));
  db.close();
  return { dir, path };
}
const stored = (path: string) => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return (db.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state;
  } finally {
    db.close();
  }
};

describe('migração do banco', () => {
  it('recusa um mundo da economia 1 sem criar backup nem alterar o arquivo (A5)', () => {
    const world = createWorld();
    const legacy = JSON.stringify({
      ...world,
      version: 1,
      season: undefined,
      marketHistory: undefined,
      currency: undefined,
    });
    const { dir, path } = openDatabase(JSON.parse(legacy));
    expect(() => createStore(path)).toThrow('Mundo da economia 1 não é mais suportado');
    expect(existsSync(resolve(dir, 'backups'))).toBe(false);
    expect(stored(path)).toBe(legacy);
  });

  it('completa um snapshot intermediário da economia 2 com backup e preserva recibos idempotentes', () => {
    const world = createWorld();
    const partial = structuredClone(world) as unknown as Record<string, unknown>;
    delete partial.designVersion;
    delete (partial.season as { config: Record<string, unknown> }).config.history;
    const key = crypto.randomUUID(),
      command = {
        type: 'buyProperty' as const,
        propertyId: world.properties.find((p) => p.ownerId === null)!.id,
        name: 'Solicitação antiga',
      };
    const { dir, path } = openDatabase(partial);
    const db = new DatabaseSync(path);
    db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key, 'player', JSON.stringify(command));
    db.close();
    const store = createStore(path);
    try {
      expect(store.read().version).toBe(2);
      expect(store.read().designVersion).toBe(2);
      expect(store.read().season.config.history).toEqual(world.season.config.history);
      expect(store.read().companies).toEqual(world.companies);
      const before = store.read();
      expect(store.command('player', command, key)).toEqual(before);
      expect(store.read().properties.find((p) => p.id === command.propertyId)!.ownerId).toBeNull();
      const backups = readdirSync(resolve(dir, 'backups'));
      expect(backups).toHaveLength(1);
      const backup = new DatabaseSync(resolve(dir, 'backups', backups[0]), { readOnly: true });
      expect(backup.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
      expect(
        JSON.parse((backup.prepare('SELECT state FROM worlds').get() as { state: string }).state)
          .designVersion,
      ).toBeUndefined();
      backup.close();
    } finally {
      store.close();
    }
  });
});
