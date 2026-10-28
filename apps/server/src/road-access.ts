import type { Position, Property, World } from '../../../packages/simulation/src/model';
import { distanceKm } from '../../../packages/simulation/src/geometry';

// Uma âncora comum prova que todos os acessos pertencem à mesma rede, nas duas direções.
// A tabela nunca usa fallback_speed: null significa que não há caminho comprovado.
export const ROAD_NETWORK_ANCHOR: Position = [-47.061, -22.905];
export const MAX_ACCESS_SNAP_KM = 5;
const BATCH_SIZE = 24;
export interface RoadAccessUpdate {
  id: string;
  expectedCoordinates: Position;
  coordinates: Position;
  road: string;
  access: NonNullable<Property['roadAccess']>;
}
type Store = { read(): World; roadAccess(updates: RoadAccessUpdate[]): void };
type Waypoint = { location?: Position; name?: string; distance?: number };
const position = (p: unknown): p is Position =>
  Array.isArray(p) &&
  p.length === 2 &&
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= 180 &&
  Math.abs(p[1]) <= 90;

export function parseAccessTable(
  input: unknown,
  properties: Property[],
  network: string,
  at = Date.now(),
): RoadAccessUpdate[] | undefined {
  const j = input as {
    code?: string;
    sources?: Waypoint[];
    destinations?: Waypoint[];
    durations?: (number | null)[][];
    fallback_speed_cells?: unknown[];
  };
  const count = properties.length + 1;
  if (
    j?.code !== 'Ok' ||
    j.fallback_speed_cells?.length ||
    j.sources?.length !== count ||
    j.destinations?.length !== count ||
    j.durations?.length !== count ||
    j.durations.some((row) => !Array.isArray(row) || row.length !== count)
  )
    return;
  const sources = j.sources,
    destinations = j.destinations,
    durations = j.durations;
  for (let i = 0; i < count; i++) {
    const a = sources[i]?.location,
      b = destinations[i]?.location;
    if (!position(a) || !position(b) || distanceKm(a, b) > 0.001) return;
  }
  if (distanceKm(ROAD_NETWORK_ANCHOR, sources[0].location!) > MAX_ACCESS_SNAP_KM) return;
  return properties.map((p, index) => {
    const i = index + 1,
      point = sources[i].location!;
    const outbound = durations[0][i],
      inbound = durations[i][0];
    const tooFar = distanceKm(p.coordinates, point) > MAX_ACCESS_SNAP_KM;
    const connected =
      !tooFar &&
      typeof outbound === 'number' &&
      Number.isFinite(outbound) &&
      outbound >= 0 &&
      typeof inbound === 'number' &&
      Number.isFinite(inbound) &&
      inbound >= 0;
    return {
      id: p.id,
      expectedCoordinates: [...p.coordinates],
      coordinates: connected ? [...point] : [...p.coordinates],
      road: sources[i].name?.trim() || 'Via sem nome no OpenStreetMap',
      access: {
        status: connected ? 'connected' : 'unreachable',
        originalCoordinates: p.roadAccess?.originalCoordinates ?? [...p.coordinates],
        checkedAt: at,
        network,
        ...(!connected
          ? {
              reason: tooFar
                ? 'Nenhuma via conectada encontrada a até 5 km. Este local não aceita novos transportes.'
                : 'Não há caminho de ida e volta até a rede rodoviária do mundo. Este local não aceita novos transportes.',
            }
          : {}),
      },
    };
  });
}

// O mesmo limitador atende localização e rotas, inclusive quando duas filas têm trabalho.
export function createRoadFetcher(fetcher: typeof fetch = fetch, intervalMs = 1200): typeof fetch {
  let tail = Promise.resolve(),
    last = 0;
  return ((...args: Parameters<typeof fetch>) => {
    const result = tail.then(async () => {
      const wait = Math.max(0, intervalMs - (Date.now() - last));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      last = Date.now();
      return fetcher(...args);
    });
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }) as typeof fetch;
}

export function createRoadAccessService(
  store: Store,
  options: {
    baseUrl?: string;
    fetcher?: typeof fetch;
  } = {},
) {
  const base = (
    options.baseUrl ??
    process.env.AFTERMARKET_ROUTER_URL ??
    'https://router.project-osrm.org'
  ).replace(/\/$/, '');
  const network = `osrm-driving-access-v1:${base}:${ROAD_NETWORK_ANCHOR.join(',')}`;
  const fetcher = options.fetcher ?? createRoadFetcher();
  const queue = new Map<string, { priority: number; finish: () => void; promise: Promise<void> }>();
  const retryAt = new Map<string, number>();
  let running = false,
    stopped = false;

  async function locate(properties: Property[]): Promise<void> {
    if (!properties.length || stopped) return;
    const points = [ROAD_NETWORK_ANCHOR, ...properties.map((p) => p.coordinates)];
    try {
      const response = await fetcher(
        `${base}/table/v1/driving/${points.map((p) => p.join(',')).join(';')}?annotations=duration&generate_hints=false`,
        {
          signal: AbortSignal.timeout(12000),
          headers: { 'User-Agent': 'AFTERMARKET-local-lab/0.4 (OpenStreetMap road access)' },
        },
      );
      const data = (await response.json()) as { code?: string };
      // Um ponto sem segmento não impede validar os demais locais do lote.
      if ((data.code === 'NoSegment' || data.code === 'TooBig') && properties.length > 1) {
        const split = Math.ceil(properties.length / 2);
        await locate(properties.slice(0, split));
        await locate(properties.slice(split));
        return;
      }
      const updates = response.ok ? parseAccessTable(data, properties, network) : undefined;
      if (updates && !stopped) store.roadAccess(updates);
      else if (data.code === 'NoSegment' && properties.length === 1 && !stopped) {
        const p = properties[0];
        store.roadAccess([
          {
            id: p.id,
            expectedCoordinates: p.coordinates,
            coordinates: p.coordinates,
            road: p.road,
            access: {
              status: 'unreachable',
              originalCoordinates: p.roadAccess?.originalCoordinates ?? p.coordinates,
              checkedAt: Date.now(),
              network,
              reason:
                'Não foi encontrado acesso rodoviário. Este local não aceita novos transportes.',
            },
          },
        ]);
      }
    } catch {
      /* Indisponibilidade não é evidência de isolamento; manter pendente. */
    }
    for (const p of properties) retryAt.set(p.id, Date.now() + 60000);
  }
  async function drain() {
    if (running || stopped) return;
    running = true;
    try {
      while (queue.size && !stopped) {
        const tasks = [...queue].sort((a, b) => a[1].priority - b[1].priority).slice(0, BATCH_SIZE);
        const w = store.read();
        const properties = tasks
          .map(([id]) => w.properties.find((p) => p.id === id))
          .filter((p): p is Property => Boolean(p));
        // Captura evita que uma resposta tardia seja aplicada a uma posição alterada.
        await locate(structuredClone(properties));
        for (const [id, task] of tasks) {
          queue.delete(id);
          task.finish();
        }
      }
    } finally {
      running = false;
    }
  }
  function ensure(ids: string[], priority = 0): Promise<void> {
    const w = store.read();
    const pending: Promise<void>[] = [];
    for (const id of ids) {
      const p = w.properties.find((p) => p.id === id);
      if (
        !p ||
        stopped ||
        (p.roadAccess?.status === 'connected' && p.roadAccess.network === network)
      )
        continue;
      const existing = queue.get(id);
      if (existing) {
        existing.priority = Math.min(existing.priority, priority);
        pending.push(existing.promise);
        continue;
      }
      if ((retryAt.get(id) ?? 0) > Date.now()) continue;
      let finish!: () => void;
      const promise = new Promise<void>((resolve) => {
        finish = resolve;
      });
      queue.set(id, { priority, finish, promise });
      pending.push(promise);
    }
    void drain();
    return Promise.all(pending).then(() => undefined);
  }
  return {
    ensure,
    prepare() {
      const w = store.read();
      if (w.roadAccessVersion !== 1) return;
      const pending = w.properties
        .filter((p) => !p.roadAccess || p.roadAccess.network !== network)
        .sort(
          (a, b) =>
            Number(!a.ownerId?.startsWith('player')) - Number(!b.ownerId?.startsWith('player')),
        );
      void ensure(
        pending.map((p) => p.id),
        5,
      );
    },
    status() {
      const properties = store.read().properties;
      return {
        total: properties.length,
        connected: properties.filter((p) => p.roadAccess?.status === 'connected').length,
        unreachable: properties.filter((p) => p.roadAccess?.status === 'unreachable').length,
        pending: queue.size,
      };
    },
    stop() {
      stopped = true;
      for (const task of queue.values()) task.finish();
      queue.clear();
    },
  };
}
