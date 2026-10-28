import { describe, expect, it } from 'vitest';
import { createStore } from '../apps/server/src/store';
import { createWorld } from '../packages/simulation/src/seed';
import { shipmentRoadPath, shipmentRoute } from '../packages/simulation/src/road-path';
import type { Position, Shipment, World } from '../packages/simulation/src/model';

const NOW = Date.UTC(2026, 9, 27, 12);

// D-036: o mundo versão 2 valida o acesso dos imóveis e desenha rotas reais, sem exigir rota no frete.
describe('rotas no mundo versão 2', () => {
  it('liga o acesso rodoviário sem bloquear o frete pela distância estimada', () => {
    const store = createStore(':memory:', {
      scenario: 'economy-2',
      requireRoadRoutes: false,
      roadAccess: true,
    });
    expect(store.read().roadAccessVersion).toBe(1);
    expect(store.read().requireRoadRoutes).toBe(false);
    store.close();
  });

  it('só entrega ao mapa caminho de estrada confirmado entre as entradas dos imóveis', () => {
    const w = createWorld(NOW, { economy: 2 }) as World;
    const [a, b] = w.establishments.filter((e) => e.companyId.startsWith('rival-'));
    const pa = w.properties.find((p) => p.id === a.propertyId)!,
      pb = w.properties.find((p) => p.id === b.propertyId)!;
    const shipment = {
      id: 's',
      originId: a.id,
      destinationId: b.id,
      route: [pa.coordinates, pb.coordinates],
      routeSource: 'estimate',
    } as unknown as Shipment;
    // Só a estimativa: nada de reta no mapa, mas a animação ainda tem por onde andar.
    expect(shipmentRoadPath(w, shipment)).toBeUndefined();
    expect(shipmentRoute(w, shipment)).toHaveLength(2);
    // Acesso confirmado e rota que começa e termina nas entradas: vira o desenho.
    for (const p of [pa, pb])
      p.roadAccess = {
        status: 'connected',
        originalCoordinates: [...p.coordinates] as Position,
        checkedAt: NOW,
        network: 'teste',
      };
    const middle: Position = [
      (pa.coordinates[0] + pb.coordinates[0]) / 2 + 0.01,
      (pa.coordinates[1] + pb.coordinates[1]) / 2,
    ];
    w.routes[`${pa.id}:${pb.id}`] = {
      source: 'osrm',
      coordinates: [pa.coordinates, middle, pb.coordinates],
      distanceKm: 50,
      durationSeconds: 3600,
    } as World['routes'][string];
    expect(shipmentRoadPath(w, shipment)).toHaveLength(3);
    // Rota que não chega à entrada do destino não serve.
    w.routes[`${pa.id}:${pb.id}`].coordinates = [pa.coordinates, middle];
    expect(shipmentRoadPath(w, shipment)).toBeUndefined();
  });
});
