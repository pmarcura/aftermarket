import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';
import { createStore } from '../apps/server/src/store';
it('migra um SQLite anterior com backup e preserva recibos idempotentes', () => {
  const dir = resolve('.runtime/migration-tests', crypto.randomUUID());
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'world.sqlite'),
    db = new DatabaseSync(path),
    world = createWorld();
  const legacy = {
    ...world,
    version: 1,
    season: undefined,
    marketHistory: undefined,
    currency: undefined,
  };
  const key = crypto.randomUUID(),
    command = {
      type: 'buyProperty' as const,
      propertyId: 'hortolandia',
      name: 'Solicitação antiga',
    };
  db.exec(
    'CREATE TABLE worlds(id INTEGER PRIMARY KEY,state TEXT NOT NULL);CREATE TABLE receipts(id TEXT PRIMARY KEY,actor TEXT NOT NULL,command TEXT NOT NULL)',
  );
  db.prepare('INSERT INTO worlds VALUES(1,?)').run(JSON.stringify(legacy));
  db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key, 'player', JSON.stringify(command));
  db.close();
  const store = createStore(path);
  try {
    expect(store.read().version).toBe(2);
    expect(store.read().companies).toEqual(world.companies);
    const before = store.read();
    expect(store.command('player', command, key)).toEqual(before);
    expect(store.read().properties[0].ownerId).toBeNull();
    const backups = readdirSync(resolve(dir, 'backups'));
    expect(backups).toHaveLength(1);
    const backup = new DatabaseSync(resolve(dir, 'backups', backups[0]), { readOnly: true });
    expect(backup.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');
    expect(
      JSON.parse((backup.prepare('SELECT state FROM worlds').get() as { state: string }).state)
        .version,
    ).toBe(1);
    backup.close();
  } finally {
    store.close();
  }
});
