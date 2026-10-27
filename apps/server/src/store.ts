import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createWorld } from '../../../packages/simulation/src/seed';
import { createScenario, type ScenarioName } from '../../../packages/simulation/src/scenarios';
import { advance, execute, RuleError } from '../../../packages/simulation/src/engine';
import type { Command, World } from '../../../packages/simulation/src/model';
import { migrateWorld, needsMigration } from '../../../packages/simulation/src/migrate';

export function createStore(
  path: string,
  options: { requireRoadRoutes?: boolean; scenario?: ScenarioName } = {},
) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS worlds (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor TEXT NOT NULL, command TEXT NOT NULL);',
  );
  if (!db.prepare('SELECT id FROM worlds WHERE id=1').get())
    db.prepare('INSERT INTO worlds VALUES(1, ?)').run(
      JSON.stringify(
        options.scenario ? createScenario(Date.now(), options.scenario) : createWorld(),
      ),
    );
  const existing = JSON.parse(
    (db.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
  );
  if (needsMigration(existing)) {
    if (path !== ':memory:') {
      const backup = resolve(dirname(path), 'backups', `pre-operations-${Date.now()}.sqlite`);
      mkdirSync(dirname(backup), { recursive: true });
      db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const latest = JSON.parse(
        (db.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
      );
      const migrated = migrateWorld(latest);
      if (migrated.changed)
        db.prepare('UPDATE worlds SET state=? WHERE id=1').run(JSON.stringify(migrated.world));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
  const read = () =>
    JSON.parse(
      (db.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
    ) as World;
  const save = (w: World) =>
    db.prepare('UPDATE worlds SET state=? WHERE id=1').run(JSON.stringify(w));
  if (options.requireRoadRoutes !== undefined) {
    const w = read();
    if (w.requireRoadRoutes !== options.requireRoadRoutes) {
      w.requireRoadRoutes = options.requireRoadRoutes;
      w.revision++;
      save(w);
    }
  }
  const transaction = <T>(fn: () => T) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  return {
    read,
    tick(now = Date.now()) {
      return transaction(() => {
        const w = read();
        if (advance(w, now)) save(w);
        return w;
      });
    },
    command(actor: string, command: Command, key: string, now = Date.now()) {
      return transaction(() => {
        const receipt = db.prepare('SELECT actor,command FROM receipts WHERE id=?').get(key) as
          { actor: string; command: string } | undefined;
        const serialized = JSON.stringify(command);
        if (receipt) {
          if (receipt.actor !== actor || receipt.command !== serialized)
            throw new RuleError('O identificador da operação já foi usado em outra solicitação.');
          return read();
        }
        const w = read();
        advance(w, now);
        execute(w, actor, command, now);
        save(w);
        db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key, actor, serialized);
        return w;
      });
    },
    route(key: string, route: World['routes'][string]) {
      return transaction(() => {
        const w = read();
        w.routes[key] = route;
        for (const s of w.shipments) {
          const a = w.establishments.find((e) => e.id === s.originId),
            b = w.establishments.find((e) => e.id === s.destinationId);
          if (
            route.source === 'osrm' &&
            a &&
            b &&
            `${a.propertyId}:${b.propertyId}` === key &&
            s.routeSource !== 'osrm'
          ) {
            s.mapRouteKey = key;
            s.mapRouteSource = 'osrm';
          }
        }
        w.revision++;
        save(w);
      });
    },
    close: () => db.close(),
  };
}
