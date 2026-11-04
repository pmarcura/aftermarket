import type { DatabaseSync } from 'node:sqlite';
import type { Command, World } from '../../../packages/simulation/src/model';
import type { RoadAccessUpdate } from './road-access';
import { gameDay } from '../../../packages/simulation/src/clock';

/**
 * Registros encerrados não mudam mais: carga entregue, lote concluído, pedido encerrado e
 * contrato fechado. Eles vão uma vez para `world_frozen` e o snapshot guarda só `{ $f: id }` no
 * mesmo lugar da lista, preservando a ordem. Formato 2 = formato 1 (extrato à parte) + isto.
 */
const ENCERRADO = {
  shipments: (s: World['shipments'][number]) => s.delivered,
  jobs: (j: World['jobs'][number]) => j.completed,
  orders: (o: World['orders'][number]) =>
    o.status === 'delivered' || o.status === 'rejected' || o.status === 'expired',
  infrastructure: (c: World['infrastructure'][number]) =>
    c.status === 'completed' || c.status === 'expired',
} as const;
type Lista = keyof typeof ENCERRADO;
const LISTAS = Object.keys(ENCERRADO) as Lista[];
const encerrado = (lista: Lista, item: unknown) =>
  (ENCERRADO[lista] as (x: unknown) => boolean)(item);

/**
 * Lê a foto original e os formatos de armazenamento 1, 2 e 3 sem gravar nem migrar.
 * 1: extrato em tabela própria. 2: + registros encerrados à parte (spec 013). 3: + diário (spec 014).
 * Código antigo, que lê até o 2, recusa um mundo com diário em vez de gravar uma foto por cima dele.
 */
export function readWorldSnapshot(db: DatabaseSync): World {
  const row = db.prepare('SELECT state FROM worlds WHERE id=1').get() as
    { state: string } | undefined;
  if (!row) throw new Error('Mundo não encontrado.');
  const stored = JSON.parse(row.state);
  if (stored.storageFormat !== undefined && ![1, 2, STORAGE_FORMAT].includes(stored.storageFormat))
    throw new Error('Formato de armazenamento não suportado.');
  if (stored.storageFormat >= 1) {
    stored.ledger = [];
    for (const entry of db.prepare('SELECT payload FROM world_ledger ORDER BY seq').iterate())
      stored.ledger.push(JSON.parse(entry.payload as string));
  }
  if (stored.storageFormat >= 2) {
    const congelados = new Map<string, string>();
    for (const r of db.prepare('SELECT kind, id, payload FROM world_frozen').iterate())
      congelados.set(`${r.kind}:${r.id}`, r.payload as string);
    for (const lista of LISTAS)
      stored[lista] = (stored[lista] ?? []).map((item: { $f?: string }) => {
        if (item.$f === undefined) return item;
        const payload = congelados.get(`${lista}:${item.$f}`);
        if (payload === undefined)
          throw new Error(`Registro encerrado ausente no armazenamento: ${lista} ${item.$f}.`);
        return JSON.parse(payload);
      });
  }
  delete stored.storageFormat;
  delete stored.journalSeq;
  return stored as World;
}

/** Uma linha do diário (spec 014): o que entrou no mundo vindo de fora, na ordem em que entrou. */
export type JournalEntry =
  | { kind: 'command'; actor: string; command: Command; key: string; now: number }
  | { kind: 'advance'; now: number }
  | { kind: 'route'; key: string; route: World['routes'][string] }
  | { kind: 'roadAccess'; updates: RoadAccessUpdate[] }
  | { kind: 'pause'; pausedMs: number };
/** Linha gravada: a mudança e a revisão do mundo logo antes dela (continuidade com a foto). */
export type JournalLine = JournalEntry & { rev?: number };

/** Formato gravado por este código: 3 = formato 2 + diário. */
export const STORAGE_FORMAT = 3;

export const JOURNAL_TABLE =
  'CREATE TABLE IF NOT EXISTS world_journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL)';

/** Até que linha do diário a foto gravada já cobre (0 = nenhuma). */
export function readJournalSeq(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT json_extract(state, '$.journalSeq') AS seq FROM worlds WHERE id=1")
    .get() as { seq: number | null } | undefined;
  return row?.seq ?? 0;
}

/** Linhas do diário que a foto ainda não cobre, em ordem. */
export function readJournal(db: DatabaseSync, after: number): JournalLine[] {
  // Ler nunca cria a tabela: ela só nasce na migração explícita, depois do backup.
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_journal'").get())
    return [];
  return (
    db.prepare('SELECT entry FROM world_journal WHERE seq > ? ORDER BY seq').all(after) as {
      entry: string;
    }[]
  ).map((r) => JSON.parse(r.entry) as JournalLine);
}

/**
 * Cópia para desfazer um comando recusado. Lançamentos do extrato e registros encerrados não
 * mudam: entram por referência, e só o que ainda pode mudar é clonado.
 */
export function rollbackSnapshot(world: World): World {
  const base = structuredClone({
    ...world,
    ledger: [],
    shipments: [],
    jobs: [],
    orders: [],
    infrastructure: [],
    marketHistory: [],
    consumptionHistory: [],
    supplyHistory: [],
    botActivity: [],
    routes: {},
  }) as World;
  for (const lista of LISTAS)
    (base[lista] as unknown[]) = (world[lista] as unknown[]).map((item) =>
      encerrado(lista, item) ? item : structuredClone(item),
    );
  base.ledger = world.ledger.slice();
  // Históricos que só crescem (spec 014): o motor acrescenta itens ou corta o começo, nunca altera
  // um item antigo. A cópia do array basta; os itens são os mesmos. Rotas são trocadas inteiras.
  base.marketHistory = world.marketHistory.slice();
  base.consumptionHistory = world.consumptionHistory.slice();
  if (world.supplyHistory) base.supplyHistory = world.supplyHistory.slice();
  else delete base.supplyHistory;
  if (world.botActivity) base.botActivity = world.botActivity.slice();
  else delete base.botActivity;
  base.routes = { ...world.routes };
  return base;
}

/** Called inside the same transaction as the world and the command receipt. */
export function createSnapshotWriter(db: DatabaseSync) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS world_ledger (seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, at INTEGER NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS world_ledger_at ON world_ledger(at); CREATE TABLE IF NOT EXISTS world_frozen (kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (kind, id))',
  );
  const insert = db.prepare('INSERT INTO world_ledger(id,at,payload) VALUES(?,?,?)');
  const regravar = db.prepare('UPDATE world_ledger SET payload=? WHERE id=?');
  // Linhas do dia (custos fixos, spec 013) são trocadas por um objeto novo a cada rodada. O
  // gravador lembra o objeto gravado de cada lançamento recente e regrava o que foi trocado.
  let recentes = new Map<string, World['ledger'][number]>();
  const janela = (world: World) => world.updatedAt - 2 * gameDay(world);
  const congelar = db.prepare('INSERT OR REPLACE INTO world_frozen(kind,id,payload) VALUES(?,?,?)');
  const descongelar = db.prepare('DELETE FROM world_frozen WHERE kind=? AND id=?');
  let saved = db.prepare('SELECT id FROM world_ledger ORDER BY seq DESC LIMIT 1').get()?.id as
    string | undefined;
  // O que já está gravado em world_frozen: só entra de novo o que ainda não está aqui.
  const gravados = new Set<string>();
  for (const r of db.prepare('SELECT kind, id FROM world_frozen').iterate())
    gravados.add(`${r.kind}:${r.id}`);
  const salvar = (world: World, journalSeq = 0) => {
    // Looking backwards normally finds the previous commit within the latest few entries.
    let first = saved ? world.ledger.findLastIndex((entry) => entry.id === saved) + 1 : 0;
    if (saved && first === 0) db.exec('DELETE FROM world_ledger');
    const desde = janela(world),
      vistos = new Map(recentes);
    for (let i = first - 1; i >= 0; i--) {
      const entry = world.ledger[i];
      if (entry.at < desde) break;
      const gravado = vistos.get(entry.id);
      if (gravado === entry) continue;
      regravar.run(JSON.stringify(entry), entry.id);
      vistos.set(entry.id, entry);
    }
    for (; first < world.ledger.length; first++) {
      const entry = world.ledger[first];
      insert.run(entry.id, entry.at, JSON.stringify(entry));
      if (entry.at >= desde) vistos.set(entry.id, entry);
    }
    for (const [id, entry] of vistos) if (entry.at < desde) vistos.delete(id);
    if (world.history?.archivedUntil)
      db.prepare('DELETE FROM world_ledger WHERE at < ?').run(world.history.archivedUntil);
    const novos: string[] = [];
    const presentes = new Set<string>();
    const listas = {} as Record<Lista, unknown[]>;
    for (const lista of LISTAS)
      listas[lista] = (world[lista] as { id: string }[]).map((item) => {
        if (!encerrado(lista, item)) return item;
        const chave = `${lista}:${item.id}`;
        presentes.add(chave);
        if (!gravados.has(chave)) {
          congelar.run(lista, item.id, JSON.stringify(item));
          novos.push(chave);
        }
        return { $f: item.id };
      });
    // O que saiu das listas (foi para o histórico arquivado) sai também daqui.
    const sairam = [...gravados].filter((chave) => !presentes.has(chave));
    for (const chave of sairam) {
      const [lista, id] = chave.split(/:(.*)/s);
      descongelar.run(lista, id);
    }
    db.prepare('UPDATE worlds SET state=? WHERE id=1').run(
      JSON.stringify({
        ...world,
        ...listas,
        ledger: [],
        storageFormat: STORAGE_FORMAT,
        journalSeq,
      }),
    );
    // Advance the cursors only AFTER the caller commits. A failed receipt must roll it back too.
    const last = world.ledger.at(-1)?.id;
    return () => {
      saved = last;
      recentes = vistos;
      for (const chave of novos) gravados.add(chave);
      for (const chave of sairam) gravados.delete(chave);
    };
  };
  /**
   * Um registro encerrado que ainda for alterado (o desenho da rota de uma carga entregue, por
   * exemplo) precisa ser regravado: some do cache e volta na próxima gravação.
   */
  /** O mundo acabou de ser lido do banco: os lançamentos recentes estão gravados como estão. */
  salvar.conhecer = (world: World) => {
    const desde = janela(world);
    recentes = new Map();
    for (let i = world.ledger.length - 1; i >= 0 && world.ledger[i].at >= desde; i--)
      recentes.set(world.ledger[i].id, world.ledger[i]);
  };
  salvar.reabrir = (lista: Lista, ids: Iterable<string>) => {
    for (const id of ids) gravados.delete(`${lista}:${id}`);
  };
  return salvar;
}
