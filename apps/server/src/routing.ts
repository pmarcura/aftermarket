import type { World, Route, Position } from '../../../packages/simulation/src/model';
import { roadNeeds } from '../../../packages/simulation/src/routing-needs';

type Store = { read(): World; route(key: string, route: Route): void };
export function parseRoadRoute(input: unknown, at = Date.now()): Route | undefined {
  const j = input as {
    code?: string;
    routes?: {
      distance: number;
      duration: number;
      geometry?: { coordinates?: Position[] };
      legs?: {
        steps?: {
          name?: string;
          ref?: string;
          distance: number;
          duration: number;
          maneuver?: { location?: Position };
        }[];
      }[];
    }[];
  };
  const r = j?.routes?.[0],
    coordinates = r?.geometry?.coordinates;
  if (
    j?.code !== 'Ok' ||
    !r ||
    !Number.isFinite(r.distance) ||
    r.distance <= 0 ||
    !Number.isFinite(r.duration) ||
    r.duration <= 0 ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.length > 100000 ||
    coordinates.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every(Number.isFinite) ||
        Math.abs(p[0]) > 180 ||
        Math.abs(p[1]) > 90,
    )
  )
    return;
  return {
    coordinates,
    distanceKm: r.distance / 1000,
    durationSeconds: r.duration,
    source: 'osrm',
    profile: 'driving',
    fetchedAt: at,
    steps:
      r.legs?.flatMap((l) =>
        (l.steps ?? [])
          .filter(
            (s) =>
              s.maneuver?.location && Number.isFinite(s.distance) && Number.isFinite(s.duration),
          )
          .map((s) => ({
            name: s.ref ? `${s.name || 'Rodovia'} (${s.ref})` : s.name || 'Via de acesso',
            distanceM: s.distance,
            durationSeconds: s.duration,
            location: s.maneuver!.location!,
          })),
      ) ?? [],
  };
}
export function createRoutingService(
  store: Store,
  options: { baseUrl?: string; intervalMs?: number; fetcher?: typeof fetch } = {},
) {
  const base =
    options.baseUrl ?? process.env.AFTERMARKET_ROUTER_URL ?? 'https://router.project-osrm.org';
  const interval = options.intervalMs ?? 1200,
    fetcher = options.fetcher ?? fetch;
  const queue = new Map<
    string,
    {
      origin: string;
      destination: string;
      priority: number;
      finish: (r?: Route) => void;
      promise: Promise<Route | undefined>;
    }
  >();
  const retryAt = new Map<string, number>();
  let running = false,
    stopped = false,
    lastRequest = 0;
  async function drain() {
    if (running || stopped) return;
    running = true;
    while (queue.size && !stopped) {
      const [key, task] = [...queue].sort((a, b) => a[1].priority - b[1].priority)[0];
      const w = store.read(),
        a = w.properties.find((p) => p.id === task.origin),
        b = w.properties.find((p) => p.id === task.destination);
      let result = w.routes[key]?.source === 'osrm' ? w.routes[key] : undefined;
      if ((!result || !Array.isArray(result.steps)) && a && b) {
        const delay = Math.max(0, interval - (Date.now() - lastRequest));
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          lastRequest = Date.now();
          const url = `${base.replace(/\/$/, '')}/route/v1/driving/${a.coordinates.join(',')};${b.coordinates.join(',')}?overview=full&geometries=geojson&steps=true`;
          const response = await fetcher(url, {
            signal: AbortSignal.timeout(12000),
            headers: { 'User-Agent': 'AFTERMARKET-local-lab/0.4 (OpenStreetMap road routing)' },
          });
          const updated = response.ok ? parseRoadRoute(await response.json()) : undefined;
          if (updated) {
            result = updated;
            if (!stopped) store.route(key, updated);
          } else retryAt.set(key, Date.now() + 60000);
        } catch {
          /* Sem geometria válida, a remessa aguarda: nunca contratar linha reta. */
          retryAt.set(key, Date.now() + 60000);
        }
      }
      if (!result) retryAt.set(key, Date.now() + 60000);
      task.finish(result);
      queue.delete(key);
    }
    running = false;
  }
  function request(origin: string, destination: string, priority = 0, snapshot?: World) {
    const key = `${origin}:${destination}`,
      w = snapshot ?? store.read();
    if (w.routes[key]?.source === 'osrm' && Array.isArray(w.routes[key].steps))
      return Promise.resolve(w.routes[key]);
    const existing = queue.get(key);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      return existing.promise;
    }
    if (stopped || queue.size >= 64 || (retryAt.get(key) ?? 0) > Date.now())
      return Promise.resolve(undefined);
    let finish!: (r?: Route) => void;
    const promise = new Promise<Route | undefined>((resolve) => {
      finish = resolve;
    });
    queue.set(key, { origin, destination, priority, finish, promise });
    void drain();
    return promise;
  }
  return {
    request,
    prepare(w: World) {
      if (!w.requireRoadRoutes) return;
      for (const [key] of Object.entries(w.routes)
        .filter(([, r]) => r.source === 'osrm' && !Array.isArray(r.steps))
        .slice(0, 4)) {
        const [origin, destination] = key.split(':');
        void request(origin, destination, 5, w);
      }
      for (const n of roadNeeds(w)) void request(n.origin, n.destination, n.priority, w);
    },
    status() {
      return {
        pending: queue.size,
        provider: 'OSRM / OpenStreetMap',
        profile: 'driving',
        strict: true,
      };
    },
    stop() {
      stopped = true;
      for (const q of queue.values()) q.finish();
      queue.clear();
    },
  };
}
