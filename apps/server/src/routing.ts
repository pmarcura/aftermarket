import type { World, Route, Position } from '../../../packages/simulation/src/model';
import { roadNeeds } from '../../../packages/simulation/src/routing-needs';
import { distanceKm } from '../../../packages/simulation/src/geometry';
import {
  hasRoadAccess,
  routeMatchesProperties,
  validRoadPosition,
  ROAD_ENDPOINT_TOLERANCE_M,
} from '../../../packages/simulation/src/road-access';

type Store = { read(): World; route(key: string, route: Route): void };
export function parseRoadRoute(
  input: unknown,
  at = Date.now(),
  endpoints?: [Position, Position],
): Route | undefined {
  const j = input as {
    code?: string;
    waypoints?: { location?: Position; distance?: number }[];
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
    coordinates.some((p) => !validRoadPosition(p))
  )
    return;
  if (
    endpoints &&
    (!Array.isArray(j.waypoints) ||
      j.waypoints.length !== 2 ||
      j.waypoints.some((waypoint, index) => {
        const point = waypoint?.location;
        const end = index === 0 ? coordinates[0] : coordinates.at(-1)!;
        return (
          !validRoadPosition(point) ||
          !Number.isFinite(waypoint.distance) ||
          waypoint.distance! < 0 ||
          waypoint.distance! > ROAD_ENDPOINT_TOLERANCE_M ||
          distanceKm(point, endpoints[index]) * 1000 > ROAD_ENDPOINT_TOLERANCE_M ||
          distanceKm(end, endpoints[index]) * 1000 > ROAD_ENDPOINT_TOLERANCE_M ||
          distanceKm(end, point) * 1000 > ROAD_ENDPOINT_TOLERANCE_M
        );
      }))
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
  options: {
    baseUrl?: string;
    intervalMs?: number;
    fetcher?: typeof fetch;
    ensureAccess?: (ids: string[]) => Promise<void>;
  } = {},
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
      let result = routeMatchesProperties(w.routes[key], a, b) ? w.routes[key] : undefined;
      if ((!result || !Array.isArray(result.steps)) && hasRoadAccess(a) && hasRoadAccess(b)) {
        const endpoints: [Position, Position] = [[...a.coordinates], [...b.coordinates]];
        const networks = [a.roadAccess!.network, b.roadAccess!.network];
        const delay = Math.max(0, interval - (Date.now() - lastRequest));
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          if (stopped) break;
          lastRequest = Date.now();
          const url = `${base.replace(/\/$/, '')}/route/v1/driving/${endpoints.map((p) => p.join(',')).join(';')}?overview=full&geometries=geojson&steps=true&radiuses=${ROAD_ENDPOINT_TOLERANCE_M};${ROAD_ENDPOINT_TOLERANCE_M}`;
          const response = await fetcher(url, {
            signal: AbortSignal.timeout(12000),
            headers: { 'User-Agent': 'AFTERMARKET-local-lab/0.4 (OpenStreetMap road routing)' },
          });
          const updated = response.ok
            ? parseRoadRoute(await response.json(), Date.now(), endpoints)
            : undefined;
          const latest = store.read();
          const current = [task.origin, task.destination].map((id) =>
            latest.properties.find((p) => p.id === id),
          );
          const unchanged = current.every(
            (p, i) =>
              hasRoadAccess(p) &&
              p.roadAccess!.network === networks[i] &&
              p.coordinates.every((coordinate, axis) => coordinate === endpoints[i][axis]),
          );
          if (!unchanged) result = undefined;
          if (updated && unchanged && routeMatchesProperties(updated, current[0], current[1])) {
            result = updated;
            if (!stopped) store.route(key, updated);
          } else retryAt.set(key, Date.now() + 60000);
        } catch {
          /* Sem geometria válida, a remessa aguarda: nunca contratar linha reta. */
          retryAt.set(key, Date.now() + 60000);
        }
      }
      const latest = store.read();
      if (
        !routeMatchesProperties(
          result,
          latest.properties.find((p) => p.id === task.origin),
          latest.properties.find((p) => p.id === task.destination),
        )
      )
        result = undefined;
      if (!result) retryAt.set(key, Date.now() + 60000);
      task.finish(result);
      queue.delete(key);
    }
    running = false;
  }
  async function request(origin: string, destination: string, priority = 0, snapshot?: World) {
    if (stopped || origin === destination) return;
    const key = `${origin}:${destination}`;
    let w = snapshot ?? store.read();
    const ready = () =>
      routeMatchesProperties(
        w.routes[key],
        w.properties.find((p) => p.id === origin),
        w.properties.find((p) => p.id === destination),
      );
    if (ready() && Array.isArray(w.routes[key].steps)) return w.routes[key];
    try {
      await options.ensureAccess?.([origin, destination]);
    } catch {
      return;
    }
    w = store.read();
    if (
      !hasRoadAccess(w.properties.find((p) => p.id === origin)) ||
      !hasRoadAccess(w.properties.find((p) => p.id === destination))
    )
      return;
    if (ready() && Array.isArray(w.routes[key].steps)) return w.routes[key];
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
      if (!w.requireRoadRoutes) {
        // Mundo versão 2 (D-036): o frete usa a distância estimada; a rota real só desenha.
        // Busca as dos caminhões dos jogadores: as dos ~500 bots esgotariam o serviço público.
        if (w.roadAccessVersion !== 1) return;
        const bots = new Set(w.companies.filter((c) => c.bot).map((c) => c.id));
        const at = (id: string) => w.establishments.find((e) => e.id === id)?.propertyId;
        let asked = 0;
        for (const s of w.shipments) {
          if (asked >= 8) break;
          if (s.delivered || ![s.buyerId, s.sellerId, s.carrierId].some((id) => !bots.has(id)))
            continue;
          const origin = at(s.originId),
            destination = at(s.destinationId);
          if (!origin || !destination || origin === destination) continue;
          const a = w.properties.find((p) => p.id === origin),
            b = w.properties.find((p) => p.id === destination);
          if (routeMatchesProperties(w.routes[`${origin}:${destination}`], a, b)) continue;
          if (!hasRoadAccess(a) || !hasRoadAccess(b)) continue;
          asked++;
          void request(origin, destination, 1, w);
        }
        return;
      }
      for (const [key] of Object.entries(w.routes)
        .filter(([, r]) => r.source === 'osrm' && !Array.isArray(r.steps))
        .slice(0, 4)) {
        const [origin, destination] = key.split(':');
        if (
          hasRoadAccess(w.properties.find((p) => p.id === origin)) &&
          hasRoadAccess(w.properties.find((p) => p.id === destination))
        )
          void request(origin, destination, 5, w);
      }
      for (const n of roadNeeds(w))
        if (
          hasRoadAccess(w.properties.find((p) => p.id === n.origin)) &&
          hasRoadAccess(w.properties.find((p) => p.id === n.destination))
        )
          void request(n.origin, n.destination, n.priority, w);
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
