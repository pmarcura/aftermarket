import type { DatabaseSync } from 'node:sqlite';
import type { World } from '../../../packages/simulation/src/model';

/** Read both the original snapshot and storage format 1 without writing or migrating. */
export function readWorldSnapshot(db: DatabaseSync): World {
  const row = db.prepare('SELECT state FROM worlds WHERE id=1').get() as
    { state: string } | undefined;
  if (!row) throw new Error('Mundo não encontrado.');
  const stored = JSON.parse(row.state);
  if (stored.storageFormat !== undefined && stored.storageFormat !== 1)
    throw new Error('Formato de armazenamento não suportado.');
  if (stored.storageFormat === 1) {
    stored.ledger = [];
    for (const entry of db.prepare('SELECT payload FROM world_ledger ORDER BY seq').iterate())
      stored.ledger.push(JSON.parse(entry.payload as string));
    delete stored.storageFormat;
  }
  return stored as World;
}

/** Ledger entries are append-only. Never copy their immutable payloads for rollback. */
export function rollbackSnapshot(world: World): World {
  return { ...structuredClone({ ...world, ledger: [] }), ledger: world.ledger.slice() };
}

/** Called inside the same transaction as the world and the command receipt. */
export function createSnapshotWriter(db: DatabaseSync) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS world_ledger (seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS world_ledger_at ON world_ledger(at)',
  );
  const insert = db.prepare('INSERT INTO world_ledger(id,at,payload) VALUES(?,?,?)');
  let saved = db.prepare('SELECT id FROM world_ledger ORDER BY seq DESC LIMIT 1').get()?.id as
    string | undefined;
  return (world: World) => {
    // Looking backwards normally finds the previous commit within the latest few entries.
    let first = saved ? world.ledger.findLastIndex((entry) => entry.id === saved) + 1 : 0;
    if (saved && first === 0) db.exec('DELETE FROM world_ledger');
    for (; first < world.ledger.length; first++) {
      const entry = world.ledger[first];
      insert.run(entry.id, entry.at, JSON.stringify(entry));
    }
    if (world.history?.archivedUntil)
      db.prepare('DELETE FROM world_ledger WHERE at < ?').run(world.history.archivedUntil);
    db.prepare('UPDATE worlds SET state=? WHERE id=1').run(
      JSON.stringify({ ...world, ledger: [], storageFormat: 1 }),
    );
    // Advance the cursor only AFTER the caller commits. A failed receipt must roll it back too.
    const last = world.ledger.at(-1)?.id;
    return () => {
      saved = last;
    };
  };
}
