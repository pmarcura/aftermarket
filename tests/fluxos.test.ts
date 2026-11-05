import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import type { Property, Shipment, World } from '../packages/simulation/src/model';
import { precoCurto, zoomDoTerreno } from '../apps/web/src/features/mapa/terreno';
import {
  cadeiaDo,
  cargasDoFluxo,
  espessura,
  resumoPorProduto,
  trajetosDoFluxo,
} from '../apps/web/src/features/mapa/fluxos';

function comCargas(): World {
  const w = createWorld(Date.UTC(2026, 10, 5));
  const loja = w.establishments.find((e) => e.companyId === 'player' && e.category === 'retail')!;
  const fora = w.establishments.filter((e) => e.companyId !== 'player').slice(0, 3);
  const carga = (
    id: string,
    origem: string,
    destino: string,
    produto: Shipment['product'],
    quantidade: number,
    extra: Partial<Shipment> = {},
  ): Shipment =>
    ({
      id,
      buyerId: w.establishments.find((e) => e.id === destino)!.companyId,
      sellerId: w.establishments.find((e) => e.id === origem)!.companyId,
      originId: origem,
      destinationId: destino,
      product: produto,
      quantity: quantidade,
      cost: 0,
      freight: 0,
      carrierId: 'x',
      vehicleId: 'v',
      departedAt: 0,
      arrivesAt: 1,
      delivered: false,
      distance: 10,
      route: [
        [-47, -23],
        [-47.1, -23.1],
      ],
      routeSource: 'osrm',
      ...extra,
    }) as Shipment;
  w.shipments = [
    carga('a', fora[0].id, loja.id, 'milk', 2000),
    carga('b', fora[0].id, loja.id, 'rice', 500),
    carga('c', loja.id, fora[1].id, 'rice', 300),
    carga('d', fora[1].id, fora[2].id, 'steel', 40),
    // estimativa sem estrada confirmada e carga entregue não entram (D-036)
    carga('e', fora[2].id, fora[1].id, 'iron', 10, { routeSource: 'estimate' }),
    carga('f', fora[2].id, fora[0].id, 'iron', 10, { delivered: true }),
  ];
  return w;
}

describe('fluxo de recursos no mapa', () => {
  it('só cargas na estrada com caminho confirmado', () => {
    const w = comCargas();
    expect(cargasDoFluxo(w, 'player', { sentido: 'todos' }).map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('filtra por sentido, por produto e pelo que é do jogador', () => {
    const w = comCargas();
    const ids = (o: Parameters<typeof cargasDoFluxo>[2]) =>
      cargasDoFluxo(w, 'player', o).map((s) => s.id);
    expect(ids({ sentido: 'entrando' })).toEqual(['a', 'b']);
    expect(ids({ sentido: 'saindo' })).toEqual(['c']);
    expect(ids({ sentido: 'todos', produto: 'rice' })).toEqual(['b', 'c']);
    expect(ids({ sentido: 'todos', soMeus: true })).toEqual(['a', 'b', 'c']);
  });

  it('agrupa por trajeto, com a cadeia da carga mais pesada', () => {
    const w = comCargas();
    const trajetos = trajetosDoFluxo(w, cargasDoFluxo(w, 'player', { sentido: 'todos' }));
    expect(trajetos).toHaveLength(3);
    const leiteEArroz = trajetos.find((t) => t.produtos.includes('milk'))!;
    expect(leiteEArroz.cargas).toBe(2);
    expect(leiteEArroz.produtos.sort()).toEqual(['milk', 'rice']);
    expect(leiteEArroz.cadeia).toBe('alimentos');
    expect(trajetos.find((t) => t.produtos.includes('steel'))!.cadeia).toBe('metal');
  });

  it('resumo por produto e espessura crescem com o peso', () => {
    const w = comCargas();
    const r = resumoPorProduto(cargasDoFluxo(w, 'player', { sentido: 'todos' }));
    expect(r[0].produto).toBe('rice'); // 2 cargas
    expect(cadeiaDo('utensils')).toBe('metal');
    expect(cadeiaDo('milk')).toBe('alimentos');
    expect(espessura(10, 10)).toBeGreaterThan(espessura(1, 10));
    expect(espessura(0, 10)).toBe(2);
  });
});

describe('terreno no mapa', () => {
  it('preço curto na etiqueta (recebe centavos)', () => {
    expect(precoCurto(18_500_000)).toBe('R$ 185 mil');
    expect(precoCurto(120_000_000)).toBe('R$ 1,2 mi');
    expect(precoCurto(90_000)).toBe('R$ 900');
  });

  it('zoom do atalho: loja de bem perto, fazenda de mais longe, dentro dos limites', () => {
    const lote = (area: number) => ({ area }) as Property;
    expect(zoomDoTerreno(lote(600))).toBeCloseTo(17.6, 5);
    expect(zoomDoTerreno(lote(14_400))).toBeCloseTo(15.6, 1);
    expect(zoomDoTerreno(lote(4_800_000))).toBe(14.5);
    expect(zoomDoTerreno(lote(100))).toBe(17.6);
  });
});
