import { describe, it, expect, vi } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, quote } from '../packages/simulation/src/engine';
import { createStore } from '../apps/server/src/store';
import { createRoutingService, parseRoadRoute } from '../apps/server/src/routing';
import { roadNeeds } from '../packages/simulation/src/routing-needs';
import { positionAlongRoute } from '../packages/simulation/src/geometry';
import { shipmentRoute } from '../packages/simulation/src/road-path';
import type { Position } from '../packages/simulation/src/model';
const NOW = Date.UTC(2026, 9, 27, 4),
  coordinates: Position[] = [
    [-47.4, -22.8],
    [-47.35, -22.78],
    [-47.3, -22.9],
  ];
const response = {
  code: 'Ok',
  routes: [
    {
      distance: 32000,
      duration: 1800,
      geometry: { coordinates },
      legs: [
        {
          steps: [
            {
              name: 'Rodovia teste',
              distance: 32000,
              duration: 1800,
              maneuver: { location: coordinates[0] },
            },
          ],
        },
      ],
    },
  ],
};
describe('roteamento autoritativo', () => {
  it('valida a geometria completa e recusa resposta inválida', () => {
    expect(parseRoadRoute(response)?.coordinates).toEqual(coordinates);
    expect(parseRoadRoute({ ...response, code: 'NoRoute' })).toBeUndefined();
    expect(
      parseRoadRoute({
        code: 'Ok',
        routes: [
          {
            distance: 1,
            duration: 1,
            geometry: {
              coordinates: [
                [Infinity, 1],
                [2, 3],
              ],
            },
          },
        ],
      }),
    ).toBeUndefined();
  });
  it('novas remessas em modo rodoviário não contratam linha reta nem cobram', () => {
    const w = createWorld(NOW);
    w.requireRoadRoutes = true;
    const before = structuredClone(w),
      cmd = {
        type: 'trade' as const,
        offerId: 'offer-ferrovale',
        destinationId: 'e-industry',
        quantity: 1,
        carrierId: 'transbrasil',
      };
    expect(quote(w, 'e-ferrovale', 'e-industry', 'iron', 1, 'transbrasil').routeRequired).toBe(
      true,
    );
    expect(() => execute(w, 'player', cmd, NOW)).toThrow(/Rota rodoviária pendente/);
    expect(w).toEqual(before);
    const a = w.establishments.find((e) => e.id === 'e-ferrovale')!,
      b = w.establishments.find((e) => e.id === 'e-industry')!;
    w.routes[`${a.propertyId}:${b.propertyId}`] = parseRoadRoute(response)!;
    execute(w, 'player', cmd, NOW);
    expect(shipmentRoute(w, w.shipments[0])).toEqual(coordinates);
    expect(w.shipments[0].routeSource).toBe('osrm');
  });
  it('deduplica consultas, persiste cache e recupera só a geometria visual do legado', async () => {
    const store = createStore(':memory:');
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      const [a, b] = await Promise.all([
        routing.request('ferrovale', 'industry'),
        routing.request('ferrovale', 'industry'),
      ]);
      expect(a).toEqual(b);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(store.read().routes['ferrovale:industry'].coordinates).toEqual(coordinates);
      await routing.request('ferrovale', 'industry');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('falha do provedor não salva uma rota aproximada e aplica espera de tentativa', async () => {
    const store = createStore(':memory:'),
      fetcher = vi.fn(async () => {
        throw Error('offline');
      }) as unknown as typeof fetch,
      routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect(await routing.request('ferrovale', 'industry')).toBeUndefined();
      expect(await routing.request('ferrovale', 'industry')).toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(store.read().routes['ferrovale:industry']).toBeUndefined();
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('cache reconstrói trajeto visual sem mudar custo, quantidade ou datas', () => {
    const store = createStore(':memory:');
    try {
      store.command(
        'player',
        {
          type: 'trade',
          offerId: 'offer-ferrovale',
          destinationId: 'e-industry',
          quantity: 1,
          carrierId: 'transbrasil',
        },
        crypto.randomUUID(),
      );
      // Cópia: o servidor mantém o mundo vivo na memória.
      const before = structuredClone(store.read().shipments[0]);
      store.route('ferrovale:industry', parseRoadRoute(response)!);
      const after = store.read().shipments[0];
      expect(shipmentRoute(store.read(), after)).toEqual(coordinates);
      const { mapRouteKey: _, mapRouteSource: __, ...rest } = after;
      expect(rest).toEqual(before);
    } finally {
      store.close();
    }
  });
  it('necessidades incluem pedidos abertos e automações; interpolação acompanha curva', () => {
    const w = createWorld(NOW);
    expect(roadNeeds(w).length).toBeGreaterThan(0);
    const p = positionAlongRoute(coordinates, 0.5);
    expect(p.position).not.toEqual([
      (coordinates[0][0] + coordinates[2][0]) / 2,
      (coordinates[0][1] + coordinates[2][1]) / 2,
    ]);
    expect(p.completed.length).toBeGreaterThan(1);
  });
  it('cache novo não modifica a geometria já contratada', () => {
    const w = createWorld(NOW);
    w.requireRoadRoutes = true;
    w.routes['ferrovale:industry'] = { ...parseRoadRoute(response)!, fetchedAt: NOW };
    execute(
      w,
      'player',
      {
        type: 'trade',
        offerId: 'offer-ferrovale',
        destinationId: 'e-industry',
        quantity: 1,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    const shipment = w.shipments[0],
      before = structuredClone(shipmentRoute(w, shipment));
    w.routes['ferrovale:industry'] = {
      ...parseRoadRoute(response)!,
      fetchedAt: NOW + 100,
      coordinates: [
        [-47.1, -22.8],
        [-47.2, -22.9],
      ],
    };
    expect(shipment.routeKey).toBeTruthy();
    expect(shipmentRoute(w, shipment)).toEqual(before);
  });
  it('enriquece cache antigo com ruas e mantém geometria utilizável se provedor falha', async () => {
    const store = createStore(':memory:');
    const old = { ...parseRoadRoute(response)!, steps: undefined };
    store.route('ferrovale:industry', old);
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect((await routing.request('ferrovale', 'industry'))?.steps?.length).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      routing.stop();
    }
    store.route('ferrovale:industry', old);
    const offline = createRoutingService(store, {
      fetcher: vi.fn(async () => {
        throw Error('offline');
      }) as unknown as typeof fetch,
      intervalMs: 0,
    });
    try {
      expect((await offline.request('ferrovale', 'industry'))?.coordinates).toEqual(coordinates);
    } finally {
      offline.stop();
      store.close();
    }
  });
});
