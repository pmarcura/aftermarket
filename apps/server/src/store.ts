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
import { totalMoney } from '../../../packages/simulation/src/invariants';
import type { RoadAccessUpdate } from './road-access';
import {
  JOURNAL_TABLE,
  STORAGE_FORMAT,
  readJournal,
  readJournalSeq,
  readWorldSnapshot,
  rollbackSnapshot,
  createSnapshotWriter,
  type JournalEntry,
} from './world-storage';

// Foto do mundo inteiro (spec 014): a cada 5 min, a cada 2.000 linhas de diário, ao pausar e ao
// desligar. Entre fotos, cada mudança vira uma linha pequena no diário.
const FOTO_MS = 5 * 60_000;
const FOTO_LINHAS = 2000;

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
    /** Intervalo entre fotos do mundo inteiro (spec 014; testes usam valores menores). */
    snapshotEveryMs?: number;
    /** Linhas de diário que forçam uma foto. */
    snapshotEveryEntries?: number;
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
  // O mundo vive na memória do servidor. No disco ficam a última foto do mundo inteiro e o diário
  // do que mudou desde então (spec 014): cada comando grava só a sua linha, junto com o recibo.
  let world = needsMigration(existing) ? readWorldSnapshot(db) : existing;
  const format = db
    .prepare("SELECT json_extract(state, '$.storageFormat') AS format FROM worlds WHERE id=1")
    .get()?.format;
  // Formato 3 = registros encerrados à parte + diário. Mundos nos formatos 0, 1 e 2 migram uma vez,
  // depois de validados (acima) e com backup antes da primeira mudança de esquema (AGENTS.md).
  const packed = format === STORAGE_FORMAT;
  if (!packed && existed && !backedUp && path !== ':memory:') {
    const nome =
      format === 2
        ? 'pre-journal-storage'
        : format === 1
          ? 'pre-frozen-storage'
          : 'pre-ledger-storage';
    const backup = resolve(dirname(path), 'backups', `${nome}-${Date.now()}.sqlite`);
    mkdirSync(dirname(backup), { recursive: true });
    db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  }
  // Migração explícita do diário: a tabela só nasce aqui, depois da validação e do backup.
  db.exec(JOURNAL_TABLE);
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
  const fotoMs = options.snapshotEveryMs ?? FOTO_MS,
    fotoLinhas = options.snapshotEveryEntries ?? FOTO_LINHAS;
  // `sujo`: mudança fora do diário (migrações na abertura). `linhas`: diário desde a última foto.
  let sujo = false,
    linhas = 0,
    ultimaFoto = Date.now(),
    lastArchive = 0;
  const archiveRows = {
    ledger: db.prepare('INSERT OR IGNORE INTO history_ledger VALUES(?,?,?)'),
    jobs: db.prepare('INSERT OR IGNORE INTO history_jobs VALUES(?,?,?)'),
    shipments: db.prepare('INSERT OR IGNORE INTO history_shipments VALUES(?,?,?)'),
  };
  const journal = {
    insert: db.prepare('INSERT INTO world_journal(entry) VALUES(?)'),
    last: db.prepare('SELECT max(seq) AS seq FROM world_journal'),
    trim: db.prepare('DELETE FROM world_journal WHERE seq <= ?'),
  };
  /** Foto do mundo inteiro: cobre todo o diário gravado até aqui, que então é apagado. */
  const writeWorld = () => {
    // O que passou do prazo do histórico vai para o arquivo, na mesma transação da gravação:
    // nada é apagado. Acontece só na foto, então repetir o diário depois dela não arquiva de novo.
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
    // Toda linha gravada no diário já foi aplicada ao mundo da memória: a foto cobre todas.
    const journalSeq = (journal.last.get() as { seq: number | null }).seq ?? readJournalSeq(db);
    committed.push(saveSnapshot(world, journalSeq));
    journal.trim.run(journalSeq);
    committed.push(() => {
      sujo = false;
      linhas = 0;
      ultimaFoto = Date.now();
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
  // `rev`: revisão do mundo logo antes da mudança. Ao reabrir, só repete o que continua da foto.
  const anotar = (entry: JournalEntry, rev: number) => {
    journal.insert.run(JSON.stringify({ ...entry, rev }));
    linhas++;
  };
  /** Linha do diário fora de um comando: se o disco falhar, a foto inteira a substitui. */
  const anotarFora = (entry: JournalEntry, rev: number) => {
    try {
      anotar(entry, rev);
    } catch (error) {
      console.error('Falha ao gravar o diário; gravando o mundo inteiro.', error);
      transaction(writeWorld);
    }
  };

  // Mudanças que vêm de fora do motor: aplicadas igual ao vivo e ao repetir o diário.
  const aplicarRota = (key: string, route: World['routes'][string]) => {
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
  };
  const aplicarAcesso = (updates: RoadAccessUpdate[]) => {
    const applicable = updates.filter((u) => {
      const p = world.properties.find((p) => p.id === u.id);
      return p && p.coordinates.every((n, i) => n === u.expectedCoordinates[i]);
    });
    if (!applicable.length) return false;
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
    return true;
  };
  const aplicar = (entry: JournalEntry) => {
    switch (entry.kind) {
      case 'command':
        advance(world, entry.now);
        execute(world, entry.actor, entry.command, entry.now);
        return;
      case 'advance':
        // Ao vivo, um erro no meio da rodada é registrado e o mundo segue com o que já andou;
        // repetir faz o mesmo.
        try {
          advance(world, entry.now);
        } catch (error) {
          console.error('Falha ao repetir a passagem do tempo (igual ao vivo).', error);
        }
        return;
      case 'route':
        return aplicarRota(entry.key, entry.route);
      case 'roadAccess':
        aplicarAcesso(entry.updates);
        return;
      case 'pause':
        world.pausedMs = entry.pausedMs;
        world.revision++;
        return;
    }
  };

  // Queda ou desligamento sem foto: repete o diário sobre a última foto, na ordem gravada.
  // Cada linha guarda a revisão do mundo logo antes dela: só repete o que continua exatamente da
  // foto. Foto mais nova que o diário (gravada por um código que não conhece o diário) descarta o
  // diário velho em vez de repeti-lo por cima.
  const pendente = readJournal(db, readJournalSeq(db));
  const primeira = pendente[0]?.rev;
  if (primeira !== undefined && primeira < world.revision) {
    console.warn(
      `Diário antigo descartado: a foto (revisão ${world.revision}) é mais nova que as ${pendente.length} linhas pendentes (desde a revisão ${primeira}).`,
    );
    sujo = true;
  } else if (pendente.length) {
    for (const linha of pendente) {
      if (linha.rev !== undefined && linha.rev !== world.revision)
        throw new Error(
          `Diário fora de sequência (linha da revisão ${linha.rev}, mundo na ${world.revision}); nada foi gravado.`,
        );
      aplicar(linha);
    }
    // Conferência sempre ligada aqui: o mundo repetido tem de fechar centavo por centavo.
    if (world.invariants && totalMoney(world) !== world.invariants.totalMoney)
      throw new Error('O diário repetido não fecha o dinheiro do mundo; nada foi gravado.');
    sujo = true;
  }
  // Storage migration must preserve the exact simulation state, including history windows.
  if (!packed) transaction(() => committed.push(saveSnapshot(world, readJournalSeq(db))));
  const flush = () => {
    if (sujo || linhas > 0) transaction(writeWorld);
  };
  if (sujo) flush();
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
    const entry: JournalEntry = {
      kind: 'pause',
      pausedMs: (world.pausedMs ?? 0) + Math.max(0, real - paradoDesde),
    };
    paradoDesde = null;
    const rev = world.revision;
    aplicar(entry);
    anotarFora(entry, rev);
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
      const before = rollbackSnapshot(world),
        rev = world.revision;
      try {
        if (aplicarAcesso(updates)) anotarFora({ kind: 'roadAccess', updates }, rev);
      } catch (error) {
        world = before;
        throw error;
      }
    },
    tick(real = Date.now()) {
      if (pausa !== undefined && paradoDesde === null && real - ultimaAtividade >= pausa)
        parar(real);
      if (paradoDesde !== null) return world;
      const now = relogio(real),
        rev = world.revision;
      let mudou = false,
        falhou = true;
      try {
        mudou = advance(world, now);
        falhou = false;
      } finally {
        // Também anota a rodada que falhou no meio: o que já andou precisa andar igual ao repetir.
        if (mudou || falhou) anotarFora({ kind: 'advance', now }, rev);
      }
      if (linhas >= fotoLinhas || (linhas > 0 && Date.now() - ultimaFoto >= fotoMs)) flush();
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
      const before = rollbackSnapshot(world),
        rev = world.revision;
      marcar('copia');
      try {
        advance(world, now);
        marcar('avanco');
        execute(world, actor, command, now);
        marcar('comando');
        // Só a linha do diário e o recibo, na mesma transação: a compra está gravada antes de a
        // tela confirmar (spec 012), sem regravar o mundo inteiro.
        transaction(() => {
          anotar({ kind: 'command', actor, command, key, now }, rev);
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
      const rev = world.revision;
      aplicarRota(key, route);
      anotarFora({ kind: 'route', key, route }, rev);
    },
    flush,
    close: () => {
      flush();
      db.close();
    },
    /** Só para testes: fecha sem foto, como uma queda do servidor. */
    abandonar: () => db.close(),
  };
}
