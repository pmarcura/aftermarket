import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';
import { createStore } from '../apps/server/src/store';
import {
  createRoadAccessService,
  parseAccessTable,
  ROAD_NETWORK_ANCHOR,
} from '../apps/server/src/road-access';
import type { Property, Position } from '../packages/simulation/src/model';

function table(properties: Property[]) {
  const points = [
    ROAD_NETWORK_ANCHOR,
    ...properties.map((p) => [p.coordinates[0] + 0.0001, p.coordinates[1]] as Position),
  ];
  const waypoints = points.map((location) => ({ location, name: 'Rua verificada', distance: 10 }));
  return {
    code: 'Ok',
    sources: waypoints,
    destinations: structuredClone(waypoints),
    durations: points.map((_, i) => points.map((_, j): number | null => (i === j ? 0 : 50))),
  };
}
describe('acessos rodoviários dos imóveis', () => {
  it('exige ida e volta à mesma rede e recusa deslocamentos maiores que 5 km', () => {
    const properties = createWorld().properties.slice(0, 3),
      data = table(properties);
    data.durations[2][0] = null;
    data.sources[3].location = [0, 0];
    data.destinations[3].location = [0, 0];
    const result = parseAccessTable(data, properties, 'test-network')!;
    expect(result.map((r) => r.access.status)).toEqual(['connected', 'unreachable', 'unreachable']);
    expect(result[0].coordinates).toEqual(data.sources[1].location);
    expect(result[0].access.originalCoordinates).toEqual(properties[0].coordinates);
    expect(result[1].coordinates).toEqual(properties[1].coordinates);
    expect(
      parseAccessTable({ ...data, fallback_speed_cells: [[0, 1]] }, properties, 'test'),
    ).toBeUndefined();
    expect(parseAccessTable({ ...data, durations: [[10]] }, properties, 'test')).toBeUndefined();
    data.destinations[1].location = [0, 0];
    expect(parseAccessTable(data, properties, 'test')).toBeUndefined();
  });
  it('migra com backup, preserva economia/viagens e invalida apenas cache de posições movidas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aftermarket-road-')),
      path = join(dir, 'world.sqlite');
    try {
      const first = createStore(path);
      const w = first.read(),
        p = w.properties[0],
        before = structuredClone(w);
      first.route(`${p.id}:other`, {
        source: 'osrm',
        coordinates: [p.coordinates, [-47, -22]],
        distanceKm: 10,
        durationSeconds: 50,
      });
      first.close();
      const store = createStore(path, { requireRoadRoutes: true });
      const access = parseAccessTable(table([p]), [p], 'test')!;
      store.roadAccess(access);
      expect(store.read().properties[0].coordinates).toEqual(access[0].coordinates);
      expect(store.read().routes[`${p.id}:other`]).toBeUndefined();
      for (const key of [
        'companies',
        'establishments',
        'jobs',
        'shipments',
        'vehicles',
        'ledger',
        'season',
      ] as const)
        expect(store.read()[key]).toEqual(before[key]);
      expect(store.read().properties.map((p) => p.ownerId)).toEqual(
        before.properties.map((p) => p.ownerId),
      );
      const revision = store.read().revision;
      store.roadAccess(access); // resposta atrasada para a coordenada antiga
      expect(store.read().revision).toBe(revision);
      store.close();
      const again = createStore(path, { requireRoadRoutes: true });
      again.close();
      const backups = readdirSync(join(dir, 'backups')).filter((name) =>
        name.startsWith('pre-road-access-'),
      );
      expect(backups).toHaveLength(1);
      const backup = new DatabaseSync(join(dir, 'backups', backups[0]), { readOnly: true });
      const original = JSON.parse(
        (backup.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
      );
      expect(original.properties[0].coordinates).toEqual(p.coordinates);
      expect(original.roadAccessVersion).toBeUndefined();
      backup.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('valida imóveis em lotes, deduplica, persiste e reutiliza o acesso', async () => {
    const store = createStore(':memory:', { requireRoadRoutes: true });
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const points = String(input)
        .split('/')
        .at(-1)!
        .split('?')[0]
        .split(';')
        .slice(1)
        .map((x) => x.split(',').map(Number));
      const properties = points.map((coordinates, i) => ({
        ...store.read().properties[i],
        coordinates: coordinates as Position,
      }));
      return new Response(JSON.stringify(table(properties)), { status: 200 });
    }) as unknown as typeof fetch;
    const service = createRoadAccessService(store, { fetcher });
    const ids = store
      .read()
      .properties.slice(0, 12)
      .map((p) => p.id);
    await Promise.all([service.ensure(ids), service.ensure(ids)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      store
        .read()
        .properties.slice(0, 12)
        .every((p) => p.roadAccess?.status === 'connected'),
    ).toBe(true);
    await service.ensure(ids);
    expect(fetcher).toHaveBeenCalledTimes(1);
    service.stop();
    store.close();
  });
  it('indisponibilidade deixa localização pendente e não cobra nem esgota tentativas', async () => {
    const store = createStore(':memory:', { requireRoadRoutes: true }),
      before = structuredClone(store.read());
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const service = createRoadAccessService(store, { fetcher });
    await service.ensure([before.properties[0].id]);
    await service.ensure([before.properties[0].id]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.read()).toEqual(before);
    service.stop();
    store.close();
  });
});
