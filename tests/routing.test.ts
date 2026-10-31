import { describe, it, expect, vi } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, quote } from '../packages/simulation/src/engine';
import { createStore } from '../apps/server/src/store';
import { createRoutingService, parseRoadRoute } from '../apps/server/src/routing';
import { roadNeeds } from '../packages/simulation/src/routing-needs';
import { positionAlongRoute } from '../packages/simulation/src/geometry';
import { shipmentRoute } from '../packages/simulation/src/road-path';
import type { Position, World } from '../packages/simulation/src/model';
import { routeMatchesProperties } from '../packages/simulation/src/road-access';
const NOW = Date.UTC(2026, 9, 27, 4),
  // Distribuidora Aurora (Americana) → Indústria de Aço (Piracicaba), imóveis que seguem no
  // mundo da economia 2 (as minas foram para os polos de Minas).
  coordinates: Position[] = [
    [-47.32, -22.731],
    [-47.45, -22.7],
    [-47.586, -22.73],
  ];
const response = {
  code: 'Ok',
  waypoints: [coordinates[0], coordinates.at(-1)!].map((location) => ({ location, distance: 0 })),
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
function connect(w: World, ids = w.properties.map((p) => p.id)) {
  for (const p of w.properties.filter((p) => ids.includes(p.id)))
    p.roadAccess = {
      status: 'connected',
      originalCoordinates: [...p.coordinates],
      checkedAt: NOW,
      network: 'test-network',
    };
  return w;
}
function connectedStore() {
  const store = createStore(':memory:');
  connect(store.read());
  return store;
}
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
    const w = connect(createWorld(NOW));
    w.requireRoadRoutes = true;
    const before = structuredClone(w),
      cmd = {
        type: 'trade' as const,
        offerId: 'offer-aurora',
        destinationId: 'e-industry',
        quantity: 1,
        carrierId: 'transbrasil',
      };
    expect(quote(w, 'e-supplier', 'e-industry', 'iron', 1, 'transbrasil').routeRequired).toBe(true);
    expect(() => execute(w, 'player', cmd, NOW)).toThrow(/Rota rodoviária pendente/);
    expect(w).toEqual(before);
    const a = w.establishments.find((e) => e.id === 'e-supplier')!,
      b = w.establishments.find((e) => e.id === 'e-industry')!;
    w.routes[`${a.propertyId}:${b.propertyId}`] = parseRoadRoute(response)!;
    execute(w, 'player', cmd, NOW);
    expect(shipmentRoute(w, w.shipments[0])).toEqual(coordinates);
    expect(w.shipments[0].routeSource).toBe('osrm');
  });
  it('deduplica consultas, persiste cache e recupera só a geometria visual do legado', async () => {
    const store = connectedStore();
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      const [a, b] = await Promise.all([
        routing.request('supplier', 'industry'),
        routing.request('supplier', 'industry'),
      ]);
      expect(a).toEqual(b);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(store.read().routes['supplier:industry'].coordinates).toEqual(coordinates);
      await routing.request('supplier', 'industry');
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('falha do provedor não salva uma rota aproximada e aplica espera de tentativa', async () => {
    const store = connectedStore(),
      fetcher = vi.fn(async () => {
        throw Error('offline');
      }) as unknown as typeof fetch,
      routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(store.read().routes['supplier:industry']).toBeUndefined();
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('cache reconstrói trajeto visual sem mudar custo, quantidade ou datas', () => {
    const store = connectedStore();
    try {
      store.command(
        'player',
        {
          type: 'trade',
          offerId: 'offer-aurora',
          destinationId: 'e-industry',
          quantity: 1,
          carrierId: 'transbrasil',
        },
        crypto.randomUUID(),
      );
      // Cópia: o servidor mantém o mundo vivo na memória.
      const before = structuredClone(store.read().shipments[0]);
      store.route('supplier:industry', parseRoadRoute(response)!);
      const after = store.read().shipments[0];
      expect(shipmentRoute(store.read(), after)).toEqual(coordinates);
      const { mapRouteKey: _, mapRouteSource: __, ...rest } = after;
      expect(rest).toEqual(before);
    } finally {
      store.close();
    }
  });
  it('necessidades incluem pedidos abertos e automações; interpolação acompanha curva', () => {
    const w = connect(createWorld(NOW));
    expect(roadNeeds(w).length).toBeGreaterThan(0);
    const p = positionAlongRoute(coordinates, 0.5);
    expect(p.position).not.toEqual([
      (coordinates[0][0] + coordinates[2][0]) / 2,
      (coordinates[0][1] + coordinates[2][1]) / 2,
    ]);
    expect(p.completed.length).toBeGreaterThan(1);
  });
  it('cache novo não modifica a geometria já contratada', () => {
    const w = connect(createWorld(NOW));
    w.requireRoadRoutes = true;
    w.routes['supplier:industry'] = { ...parseRoadRoute(response)!, fetchedAt: NOW };
    execute(
      w,
      'player',
      {
        type: 'trade',
        offerId: 'offer-aurora',
        destinationId: 'e-industry',
        quantity: 1,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    const shipment = w.shipments[0],
      before = structuredClone(shipmentRoute(w, shipment));
    w.routes['supplier:industry'] = {
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
    const store = connectedStore();
    const old = { ...parseRoadRoute(response)!, steps: undefined };
    store.route('supplier:industry', old);
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect((await routing.request('supplier', 'industry'))?.steps?.length).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      routing.stop();
    }
    store.route('supplier:industry', old);
    const offline = createRoutingService(store, {
      fetcher: vi.fn(async () => {
        throw Error('offline');
      }) as unknown as typeof fetch,
      intervalMs: 0,
    });
    try {
      expect((await offline.request('supplier', 'industry'))?.coordinates).toEqual(coordinates);
    } finally {
      offline.stop();
      store.close();
    }
  });
  it('recusa snapping distante, waypoints ausentes e extremos fora dos acessos', () => {
    const endpoints: [Position, Position] = [coordinates[0], coordinates.at(-1)!];
    expect(parseRoadRoute(response, NOW, endpoints)).toBeDefined();
    expect(parseRoadRoute({ ...response, waypoints: [] }, NOW, endpoints)).toBeUndefined();
    const distant = structuredClone(response);
    distant.waypoints[1].distance = 900;
    expect(parseRoadRoute(distant, NOW, endpoints)).toBeUndefined();
    const wrongEnd = structuredClone(response);
    wrongEnd.routes[0].geometry.coordinates[2] = [-47.6, -22.75];
    expect(parseRoadRoute(wrongEnd, NOW, endpoints)).toBeUndefined();
    const reversed = structuredClone(response);
    reversed.waypoints.reverse();
    expect(parseRoadRoute(reversed, NOW, endpoints)).toBeUndefined();
  });
  it('cache OSRM não autoriza frete com acesso desconhecido nem coordenadas desatualizadas', () => {
    const w = createWorld(NOW);
    w.requireRoadRoutes = true;
    w.routes['supplier:industry'] = parseRoadRoute(response)!;
    const command = {
      type: 'trade' as const,
      offerId: 'offer-aurora',
      destinationId: 'e-industry',
      quantity: 1,
      carrierId: 'transbrasil',
    };
    const before = structuredClone(w);
    expect(() => execute(w, 'player', command, NOW)).toThrow(/Rota rodoviária pendente/);
    expect(w).toEqual(before);
    connect(w);
    const origin = w.properties.find((p) => p.id === 'supplier')!;
    const destination = w.properties.find((p) => p.id === 'industry')!;
    expect(routeMatchesProperties(w.routes['supplier:industry'], origin, destination)).toBe(true);
    destination.coordinates = [-47.8, -22.9];
    const moved = structuredClone(w);
    expect(quote(w, 'e-supplier', 'e-industry', 'iron', 1, 'transbrasil').routeRequired).toBe(true);
    expect(() => execute(w, 'player', command, NOW)).toThrow(/Rota rodoviária pendente/);
    expect(w).toEqual(moved);
    w.orders.push({
      id: 'needs-new-route',
      buyerId: 'player',
      sellerId: 'aurora',
      originId: 'e-supplier',
      destinationId: 'e-industry',
      product: 'iron',
      quantity: 1,
      unitPrice: 100,
      carrierId: 'transbrasil',
      maxFreight: 100000,
      createdAt: NOW,
      deadline: NOW + 100000,
      status: 'pending',
    });
    expect(roadNeeds(w).some((n) => n.origin === 'supplier' && n.destination === 'industry')).toBe(
      true,
    );
  });
  it('imóvel sem acesso confirmado não pode ser comprado no mundo rodoviário', () => {
    const w = createWorld(NOW);
    w.requireRoadRoutes = true;
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player',
        {
          type: 'buyProperty',
          propertyId: w.properties.find((p) => p.ownerId === null && p.category === 'industry')!.id,
          name: 'Minha fábrica',
        },
        NOW,
      ),
    ).toThrow(/acesso rodoviário/);
    expect(w).toEqual(before);
  });
  it('confirma os acessos antes do par e limita o ajuste do provedor a 25 metros', async () => {
    const store = createStore(':memory:');
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response)),
    ) as unknown as typeof fetch;
    const ensureAccess = vi.fn(async (ids: string[]) => {
      connect(store.read(), ids);
    });
    const routing = createRoutingService(store, { fetcher, ensureAccess, intervalMs: 0 });
    try {
      expect(await routing.request('supplier', 'industry')).toBeDefined();
      expect(ensureAccess).toHaveBeenCalledWith(['supplier', 'industry']);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(vi.mocked(fetcher).mock.calls[0][0]).toContain('radiuses=25;25');
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('acesso pendente não consulta rota nem ocupa a fila de pares', async () => {
    const store = createStore(':memory:');
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(response)),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      store.read().requireRoadRoutes = true;
      routing.prepare(store.read());
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(fetcher).not.toHaveBeenCalled();
      expect(routing.status().pending).toBe(0);
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('NoRoute entre dois acessos conhecidos não permite contratação ou fallback', async () => {
    const store = connectedStore();
    store.read().requireRoadRoutes = true;
    const before = structuredClone(store.read());
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ code: 'NoRoute' })),
    ) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(store.read()).toEqual(before);
      expect(
        quote(store.read(), 'e-supplier', 'e-industry', 'iron', 1, 'transbrasil').routeRequired,
      ).toBe(true);
    } finally {
      routing.stop();
      store.close();
    }
  });
  it('descarta resposta se o imóvel mudar durante a consulta', async () => {
    const store = connectedStore();
    const fetcher = vi.fn(async () => {
      // Até uma alteração menor que a tolerância invalida esta resposta em andamento.
      store.read().properties.find((p) => p.id === 'industry')!.coordinates[0] += 0.00001;
      return new Response(JSON.stringify(response));
    }) as unknown as typeof fetch;
    const routing = createRoutingService(store, { fetcher, intervalMs: 0 });
    try {
      expect(await routing.request('supplier', 'industry')).toBeUndefined();
      expect(store.read().routes['supplier:industry']).toBeUndefined();
    } finally {
      routing.stop();
      store.close();
    }
  });
});
