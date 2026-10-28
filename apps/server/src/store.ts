import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createWorld } from '../../../packages/simulation/src/seed';
import { createScenario, type ScenarioName } from '../../../packages/simulation/src/scenarios';
import { advance, execute, RuleError } from '../../../packages/simulation/src/engine';
import type { Command, World } from '../../../packages/simulation/src/model';
import { migrateWorld, needsMigration } from '../../../packages/simulation/src/migrate';
import { archiveHistory } from '../../../packages/simulation/src/history';
import { GAME_DAY } from '../../../packages/simulation/src/operations';
import type { RoadAccessUpdate } from './road-access';

const SAVE_INTERVAL_MS = 5000;

export function createStore(
  path: string,
  options: {
    requireRoadRoutes?: boolean;
    roadAccess?: boolean;
    scenario?: ScenarioName;
    scale?: number;
  } = {},
) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS worlds (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor TEXT NOT NULL, command TEXT NOT NULL);',
  );
  if (!db.prepare('SELECT id FROM worlds WHERE id=1').get())
    db.prepare('INSERT INTO worlds VALUES(1, ?)').run(
      JSON.stringify(
        options.scenario
          ? createScenario(Date.now(), options.scenario, 0, { scale: options.scale })
          : createWorld(),
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
  db.exec(
    'CREATE TABLE IF NOT EXISTS history_ledger (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS history_jobs (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS history_shipments (id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL);',
  );
  // O mundo vive na memória do servidor: ler e decodificar o JSON inteiro a cada pedido do
  // navegador custava centenas de milissegundos por pedido aos 30 dias. Grava no disco a cada
  // SAVE_INTERVAL_MS e sempre junto com o recibo de cada comando.
  let world = JSON.parse(
    (db.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
  ) as World;
  let dirty = false,
    lastSave = Date.now(),
    lastArchive = 0;
  const archiveRows = {
    ledger: db.prepare('INSERT OR IGNORE INTO history_ledger VALUES(?,?,?)'),
    jobs: db.prepare('INSERT OR IGNORE INTO history_jobs VALUES(?,?,?)'),
    shipments: db.prepare('INSERT OR IGNORE INTO history_shipments VALUES(?,?,?)'),
  };
  const writeWorld = () => {
    // Mundos com histórico resumido (versão 2) levam o que passou do prazo para o arquivo,
    // na mesma transação da gravação: nada é apagado.
    const keepDays = world.season.config.history?.keepDays;
    if (keepDays && world.updatedAt - lastArchive >= GAME_DAY / 4) {
      const old = archiveHistory(world, world.updatedAt, keepDays);
      for (const l of old.ledger) archiveRows.ledger.run(l.id, l.at, JSON.stringify(l));
      for (const j of old.jobs) archiveRows.jobs.run(j.id, j.finishesAt, JSON.stringify(j));
      for (const sh of old.shipments)
        archiveRows.shipments.run(sh.id, sh.arrivesAt, JSON.stringify(sh));
      lastArchive = world.updatedAt;
    }
    db.prepare('UPDATE worlds SET state=? WHERE id=1').run(JSON.stringify(world));
    dirty = false;
    lastSave = Date.now();
  };
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
  const flush = () => {
    if (dirty) transaction(writeWorld);
  };
  // Migração geográfica explícita e idempotente. O backup antecede inclusive a ativação
  // do bloqueio de fretes; a rede externa só preencherá os acessos depois de validá-los.
  // O acesso vale em todo mundo jogável; o bloqueio de fretes, só onde o servidor exige rotas.
  if ((options.roadAccess ?? options.requireRoadRoutes) && world.roadAccessVersion !== 1) {
    if (path !== ':memory:') {
      const backup = resolve(dirname(path), 'backups', `pre-road-access-${Date.now()}.sqlite`);
      mkdirSync(dirname(backup), { recursive: true });
      db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    }
    world.roadAccessVersion = 1;
    if (options.requireRoadRoutes) world.requireRoadRoutes = true;
    world.revision++;
    transaction(writeWorld);
  }
  if (
    options.requireRoadRoutes !== undefined &&
    world.requireRoadRoutes !== options.requireRoadRoutes
  ) {
    world.requireRoadRoutes = options.requireRoadRoutes;
    world.revision++;
    transaction(writeWorld);
  }
  return {
    read: () => world,
    roadAccess(updates: RoadAccessUpdate[]) {
      const applicable = updates.filter((u) => {
        const p = world.properties.find((p) => p.id === u.id);
        return p && p.coordinates.every((n, i) => n === u.expectedCoordinates[i]);
      });
      if (!applicable.length) return;
      const before = structuredClone(world);
      try {
        const moved = new Set(
          applicable
            .filter((u) => u.coordinates.some((n, i) => n !== u.expectedCoordinates[i]))
            .map((u) => u.id),
        );
        for (const [key, route] of Object.entries(world.routes)) {
          if (!key.split(':').some((id) => moved.has(id))) continue;
          // Remessas antigas podem apontar para o cache visual: congelar antes de invalidar.
          for (const s of world.shipments)
            if (s.mapRouteKey === key) {
              s.mapRoute = structuredClone(route.coordinates);
              delete s.mapRouteKey;
            }
          delete world.routes[key];
        }
        for (const update of applicable) {
          const p = world.properties.find((p) => p.id === update.id)!;
          p.roadAccess = structuredClone(update.access);
          if (update.access.status === 'connected') {
            p.coordinates = [...update.coordinates];
            p.road = update.road;
            p.roadDistance = 0;
          }
        }
        world.revision++;
        transaction(writeWorld);
      } catch (error) {
        world = before;
        throw error;
      }
    },
    tick(now = Date.now()) {
      if (advance(world, now)) dirty = true;
      if (dirty && Date.now() - lastSave >= SAVE_INTERVAL_MS) transaction(writeWorld);
      return world;
    },
    command(actor: string, command: Command, key: string, now = Date.now()) {
      const receipt = db.prepare('SELECT actor,command FROM receipts WHERE id=?').get(key) as
        { actor: string; command: string } | undefined;
      const serialized = JSON.stringify(command);
      if (receipt) {
        if (receipt.actor !== actor || receipt.command !== serialized)
          throw new RuleError('O identificador da operação já foi usado em outra solicitação.');
        return world;
      }
      // Um comando recusado no meio do caminho não pode deixar o mundo pela metade.
      const before = structuredClone(world);
      try {
        advance(world, now);
        execute(world, actor, command, now);
        transaction(() => {
          writeWorld();
          db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key, actor, serialized);
        });
      } catch (error) {
        world = before;
        throw error;
      }
      return world;
    },
    route(key: string, route: World['routes'][string]) {
      world.routes[key] = route;
      for (const s of world.shipments) {
        const a = world.establishments.find((e) => e.id === s.originId),
          b = world.establishments.find((e) => e.id === s.destinationId);
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
      world.revision++;
      transaction(writeWorld);
    },
    flush,
    close: () => {
      flush();
      db.close();
    },
  };
}
