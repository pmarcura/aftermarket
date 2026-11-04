import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createWorld } from '../../../packages/simulation/src/seed';
import { createScenario, type ScenarioName } from '../../../packages/simulation/src/scenarios';
import { advance, execute, RuleError } from '../../../packages/simulation/src/engine';
import type { Command, World } from '../../../packages/simulation/src/model';
import { migrateWorld, needsMigration } from '../../../packages/simulation/src/migrate';
import { archiveHistory } from '../../../packages/simulation/src/history';
import { gameDay } from '../../../packages/simulation/src/clock';
import type { RoadAccessUpdate } from './road-access';
import { readWorldSnapshot, rollbackSnapshot, createSnapshotWriter } from './world-storage';

const SAVE_INTERVAL_MS = 5000;

/** Tempo de cada etapa do último comando, em ms. */
export interface Etapas {
  copia: number;
  avanco: number;
  comando: number;
  gravacao: number;
}

export function createStore(
  path: string,
  options: {
    requireRoadRoutes?: boolean;
    roadAccess?: boolean;
    scenario?: ScenarioName;
    scale?: number;
    timeScale?: number;
    /** Parar o relógio do mundo depois deste tempo real sem ninguém jogando (spec 013). */
    pauseWhenIdleMs?: number;
  } = {},
) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA journal_mode=WAL; PRAGMA journal_size_limit=67108864; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS worlds (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, actor TEXT NOT NULL, command TEXT NOT NULL);',
  );
  const existed = Boolean(db.prepare('SELECT id FROM worlds WHERE id=1').get());
  let backedUp = false;
  if (!existed)
    db.prepare('INSERT INTO worlds VALUES(1, ?)').run(
      JSON.stringify(
        options.scenario
          ? createScenario(Date.now(), options.scenario, 0, {
              scale: options.scale,
              timeScale: options.timeScale,
            })
          : createWorld(Date.now(), { timeScale: options.timeScale }),
      ),
    );
  const existing = readWorldSnapshot(db);
  if (needsMigration(existing)) {
    // Mundo que o motor não aceita mais (economia 1) é recusado antes de qualquer escrita:
    // nem backup nem conversão; o arquivo fica como está (D-042).
    if ((existing as { version?: number }).version !== 2) {
      db.close();
      migrateWorld(existing);
    }
    if (path !== ':memory:') {
      const backup = resolve(dirname(path), 'backups', `pre-operations-${Date.now()}.sqlite`);
      mkdirSync(dirname(backup), { recursive: true });
      db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
      backedUp = true;
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      const latest = readWorldSnapshot(db);
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
  let world = needsMigration(existing) ? readWorldSnapshot(db) : existing;
  const format = db
    .prepare("SELECT json_extract(state, '$.storageFormat') AS format FROM worlds WHERE id=1")
    .get()?.format;
  // Formato 2 guarda registros encerrados à parte; mundos 0 e 1 migram uma vez, com backup antes.
  const packed = format === 2;
  if (!packed && existed && !backedUp && path !== ':memory:') {
    const nome = format === 1 ? 'pre-frozen-storage' : 'pre-ledger-storage';
    const backup = resolve(dirname(path), 'backups', `${nome}-${Date.now()}.sqlite`);
    mkdirSync(dirname(backup), { recursive: true });
    db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  }
  const saveSnapshot = createSnapshotWriter(db);
  saveSnapshot.conhecer(world);
  let committed: (() => void)[] = [];
  let rolledBack: (() => void)[] = [];
  // A velocidade é da temporada (spec 004): trocar a de um mundo existente não é suportado.
  if (options.timeScale !== undefined && options.timeScale !== world.season.config.clock.timeScale)
    console.warn(
      `Este mundo roda a ${world.season.config.clock.timeScale}×; AFTERMARKET_TIME_SCALE=${options.timeScale} vale só para mundo novo (use outro AFTERMARKET_DB_FILE).`,
    );
  let ultimoClique: Etapas | null = null;
  let dirty = false,
    lastSave = Date.now(),
    lastArchive = 0;
  const archiveRows = {
    ledger: db.prepare('INSERT OR IGNORE INTO history_ledger VALUES(?,?,?)'),
    jobs: db.prepare('INSERT OR IGNORE INTO history_jobs VALUES(?,?,?)'),
    shipments: db.prepare('INSERT OR IGNORE INTO history_shipments VALUES(?,?,?)'),
  };
  const writeWorld = () => {
    // O que passou do prazo do histórico vai para o arquivo, na mesma transação da gravação:
    // nada é apagado.
    const keepDays = world.season.config.history.keepDays;
    if (world.updatedAt - lastArchive >= gameDay(world) / 4) {
      const previous = {
        ledger: world.ledger,
        jobs: world.jobs,
        shipments: world.shipments,
        history: structuredClone(world.history),
      };
      rolledBack.push(() => Object.assign(world, previous));
      const old = archiveHistory(world, world.updatedAt, keepDays);
      for (const l of old.ledger) archiveRows.ledger.run(l.id, l.at, JSON.stringify(l));
      for (const j of old.jobs) archiveRows.jobs.run(j.id, j.finishesAt, JSON.stringify(j));
      for (const sh of old.shipments)
        archiveRows.shipments.run(sh.id, sh.arrivesAt, JSON.stringify(sh));
      const archivedAt = world.updatedAt;
      committed.push(() => {
        lastArchive = archivedAt;
      });
    }
    committed.push(saveSnapshot(world));
    committed.push(() => {
      dirty = false;
      lastSave = Date.now();
    });
  };
  const transaction = <T>(fn: () => T) => {
    committed = [];
    rolledBack = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      for (const commit of committed) commit();
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      for (const rollback of rolledBack.reverse()) rollback();
      throw error;
    }
  };
  // Storage migration must preserve the exact simulation state, including history windows.
  if (!packed) transaction(() => committed.push(saveSnapshot(world)));
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
  // Relógio do mundo = relógio real menos o tempo parado. Vale sempre, mesmo com a pausa desligada,
  // para um mundo que já pausou não "pular" o tempo em que ficou parado.
  const relogio = (real: number) => real - (world.pausedMs ?? 0);
  const pausa = options.pauseWhenIdleMs;
  let ultimaAtividade = Date.now(),
    paradoDesde: number | null = null;
  const parar = (desde: number) => {
    paradoDesde = desde;
    flush();
  };
  const retomar = (real: number) => {
    if (paradoDesde === null) return;
    world.pausedMs = (world.pausedMs ?? 0) + Math.max(0, real - paradoDesde);
    paradoDesde = null;
    world.revision++;
    dirty = true;
  };
  // Servidor desligado também é mundo parado: ao abrir, o mundo segue de onde ficou.
  if (pausa !== undefined) {
    paradoDesde = (world.pausedMs ?? 0) + world.updatedAt;
    retomar(Math.max(Date.now(), paradoDesde));
  }
  /** Alguém está jogando: se o mundo estava parado, volta a andar a partir de agora. */
  const atividade = (real = Date.now()) => {
    ultimaAtividade = real;
    retomar(real);
  };
  return {
    read: () => world,
    /** Etapas do último comando aceito ou recusado (ms). */
    ultimoClique: () => ultimoClique,
    atividade,
    parado: () => paradoDesde !== null,
    roadAccess(updates: RoadAccessUpdate[]) {
      const applicable = updates.filter((u) => {
        const p = world.properties.find((p) => p.id === u.id);
        return p && p.coordinates.every((n, i) => n === u.expectedCoordinates[i]);
      });
      if (!applicable.length) return;
      const before = rollbackSnapshot(world);
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
              saveSnapshot.reabrir('shipments', [s.id]);
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
        dirty = true;
      } catch (error) {
        world = before;
        throw error;
      }
    },
    tick(real = Date.now()) {
      if (pausa !== undefined && paradoDesde === null && real - ultimaAtividade >= pausa)
        parar(real);
      if (paradoDesde !== null) return world;
      if (advance(world, relogio(real))) dirty = true;
      if (dirty && Date.now() - lastSave >= SAVE_INTERVAL_MS) transaction(writeWorld);
      return world;
    },
    command(actor: string, command: Command, key: string, real = Date.now()) {
      if (pausa !== undefined) atividade(real);
      ultimoClique = null;
      const now = relogio(real);
      const receipt = db.prepare('SELECT actor,command FROM receipts WHERE id=?').get(key) as
        { actor: string; command: string } | undefined;
      const serialized = JSON.stringify(command);
      if (receipt) {
        if (receipt.actor !== actor || receipt.command !== serialized)
          throw new RuleError('O identificador da operação já foi usado em outra solicitação.');
        return world;
      }
      // Etapas do clique em ms (spec 013, fase 0): régua `perf:click` e cabeçalho Server-Timing.
      const etapas: Etapas = { copia: 0, avanco: 0, comando: 0, gravacao: 0 };
      ultimoClique = etapas;
      let t = performance.now();
      const marcar = (nome: keyof Etapas) => {
        const agora = performance.now();
        etapas[nome] = agora - t;
        t = agora;
      };
      // Um comando recusado no meio do caminho não pode deixar o mundo pela metade.
      const before = rollbackSnapshot(world);
      marcar('copia');
      try {
        advance(world, now);
        marcar('avanco');
        execute(world, actor, command, now);
        marcar('comando');
        transaction(() => {
          writeWorld();
          db.prepare('INSERT INTO receipts VALUES(?,?,?)').run(key, actor, serialized);
        });
        marcar('gravacao');
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
          // Carga entregue também recebe o desenho: o registro gravado precisa ser refeito.
          saveSnapshot.reabrir('shipments', [s.id]);
        }
      }
      world.revision++;
      dirty = true;
    },
    flush,
    close: () => {
      flush();
      db.close();
    },
  };
}
