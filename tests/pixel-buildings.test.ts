import { describe, expect, it } from 'vitest';
import {
  BUILDING_VERTEX_STRIDE,
  buildBuildingMesh,
  type BuildingFeature,
} from '../apps/web/src/lib/pixel-buildings-geometry';

type Point = [number, number];
const origin: Point = [-47.06, -22.9];
function square(x = 0, y = 0, size = 0.0002): Point[] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ].map(([dx, dy]) => [origin[0] + dx, origin[1] + dy]);
}
function building(
  rings = [square()],
  properties: Record<string, unknown> = {},
  id = 1,
): BuildingFeature {
  return { id, geometry: { type: 'Polygon', coordinates: rings }, properties };
}
function rows(vertices: Float32Array) {
  return Array.from({ length: vertices.length / BUILDING_VERTEX_STRIDE }, (_, index) =>
    Array.from(
      vertices.slice(index * BUILDING_VERTEX_STRIDE, (index + 1) * BUILDING_VERTEX_STRIDE),
    ),
  );
}
function area(vertices: number[][]) {
  let total = 0;
  for (let index = 0; index < vertices.length; index += 3) {
    const [a, b, c] = vertices.slice(index, index + 3);
    total += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  }
  return total;
}

describe('construções pixel a partir de geometrias reais', () => {
  it('preserva o contorno, eleva a cumeeira e mantém coordenadas relativas precisas', () => {
    const ring = square();
    const mesh = buildBuildingMesh([building([ring], { render_height: 8 })]);
    const vertices = rows(mesh.vertices);
    expect(mesh.buildingCount).toBe(1);
    expect(mesh.vertices.length % (BUILDING_VERTEX_STRIDE * 3)).toBe(0);
    expect(vertices.some((vertex) => vertex[5] === 1)).toBe(true);
    expect(vertices.some((vertex) => vertex[5] === 2)).toBe(false);
    const xMin = (ring[0][0] + 180) / 360;
    const xMax = (ring[1][0] + 180) / 360;
    for (const vertex of vertices) {
      expect(vertex[0] + mesh.origin[0]).toBeGreaterThanOrEqual(xMin - 1e-12);
      expect(vertex[0] + mesh.origin[0]).toBeLessThanOrEqual(xMax + 1e-12);
      expect(vertex.every(Number.isFinite)).toBe(true);
      expect(Math.abs(vertex[0])).toBeLessThan(0.001);
      expect(vertex[6]).toBeGreaterThanOrEqual(0);
      expect(vertex[6]).toBeLessThan(4);
    }
    const wallTops = vertices.filter((vertex) => vertex[5] === 0 && vertex[4] === 8);
    const ridge = vertices.filter((vertex) => vertex[5] === 1).map((vertex) => vertex[2]);
    expect(Math.max(...ridge)).toBeGreaterThan(wallTops[0][2]);
    expect(Math.min(...ridge)).toBeCloseTo(wallTops[0][2], 10);
  });

  it('triangula o telhado com pátio vazio sem cobrir o furo', () => {
    const outer = square(0, 0, 0.0004);
    const hole = square(0.0001, 0.0001, 0.0002);
    const full = rows(
      buildBuildingMesh([building([outer], { render_height: 24 })]).vertices,
    ).filter((vertex) => vertex[5] === 2);
    const hollow = rows(
      buildBuildingMesh([building([outer, hole], { render_height: 24 })]).vertices,
    ).filter((vertex) => vertex[5] === 2);
    expect(area(hollow) / area(full)).toBeCloseTo(0.75, 4);
    const mesh = rows(buildBuildingMesh([building([outer, hole], { render_height: 24 })]).vertices);
    expect(mesh.filter((vertex) => vertex[5] === 0)).toHaveLength(8 * 6);
    for (const vertex of hollow) {
      expect(vertex[3]).toBeGreaterThanOrEqual(0);
      expect(vertex[4]).toBeGreaterThanOrEqual(0);
      expect(vertex[3]).toBeLessThanOrEqual(vertex[8] + 1e-4);
      expect(vertex[4]).toBeLessThanOrEqual(vertex[9] + 1e-4);
    }
  });

  it('elimina cópias exatas, conserva partes distintas e gera ordem determinística', () => {
    const a = building(),
      b = building([square(0.0004)], {}, 1);
    const single = buildBuildingMesh([a]);
    expect(buildBuildingMesh([a, a]).vertices).toEqual(single.vertices);
    const forward = buildBuildingMesh([a, b]);
    const reverse = buildBuildingMesh([b, a]);
    expect(forward.vertices.length).toBe(single.vertices.length * 2);
    expect(reverse).toEqual(forward);
    expect(new Set(rows(forward.vertices).map((vertex) => vertex[6])).size).toBe(1);
    expect(buildBuildingMesh([{ ...a, properties: { render_height: 30 } }]).key).not.toBe(
      single.key,
    );
  });

  it('reconhece colinearidade sem alterar paredes e evita cumeeiras em cortes de tiles', () => {
    const ring = square();
    const midpoint: Point = [(ring[0][0] + ring[1][0]) / 2, ring[0][1]];
    const surveyed = buildBuildingMesh([building([[ring[0], midpoint, ...ring.slice(1)]])]);
    const surveyedRows = rows(surveyed.vertices);
    expect(surveyedRows.some((vertex) => vertex[5] === 1)).toBe(true);
    // Five original sides, six wall vertices each, plus six gable vertices.
    expect(surveyedRows.filter((vertex) => vertex[5] === 0)).toHaveLength(5 * 6 + 6);
    const longitude = (6050 / 16384) * 360 - 180;
    const clipped = square().map(([lng, lat]) => [lng - origin[0] + longitude, lat] as Point);
    const boundary = rows(buildBuildingMesh([building([clipped])]).vertices);
    expect(boundary.some((vertex) => vertex[5] === 1)).toBe(false);
    expect(boundary.some((vertex) => vertex[5] === 2)).toBe(true);
  });

  it('aceita anéis abertos e multipolígonos sem criar caminhos de fechamento extras', () => {
    const ring = square();
    const closed = buildBuildingMesh([building([ring])]);
    const open = buildBuildingMesh([building([ring.slice(0, -1)])]);
    expect(open.vertices.length).toBe(closed.vertices.length);
    expect(rows(open.vertices).filter((vertex) => vertex[5] === 0).length).toBe(
      rows(closed.vertices).filter((vertex) => vertex[5] === 0).length,
    );
    const multi = buildBuildingMesh([
      {
        id: 'multi',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[ring], [square(0.001)]],
        },
      },
    ]);
    expect(multi.buildingCount).toBe(1);
    expect(multi.vertices.length).toBe(closed.vertices.length * 2);
  });

  it('recusa geometrias inválidas e esconde contornos auxiliares, com limites finitos de altura', () => {
    const invalid: BuildingFeature[] = [
      { geometry: null },
      { geometry: { type: 'Point', coordinates: origin } },
      building([
        [
          [NaN, 0],
          [0, 1],
          [1, 0],
        ],
      ]),
      building([
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ]),
      building([
        [
          [0, 90],
          [1, 90],
          [1, 89],
        ],
      ]),
      building([square()], { hide_3d: true }),
      building([square()], { hide_3d: 1 }),
      building([
        square(),
        [
          [NaN, 0],
          [0, 1],
          [1, 0],
        ],
      ]),
    ];
    expect(buildBuildingMesh(invalid)).toEqual({
      vertices: new Float32Array(),
      origin: [0, 0],
      buildingCount: 0,
      key: 'empty',
    });
    const elevated = rows(
      buildBuildingMesh([building([square()], { render_height: 30, render_min_height: 12 })])
        .vertices,
    );
    const walls = elevated.filter((vertex) => vertex[5] === 0);
    expect(Math.min(...walls.map((vertex) => vertex[4]))).toBe(0);
    expect(Math.max(...walls.map((vertex) => vertex[4]))).toBe(18);
    expect(walls.every((vertex) => vertex[9] === 18 && vertex[2] > 0)).toBe(true);
    const clamped = rows(
      buildBuildingMesh([building([square()], { render_height: 100000, render_min_height: -10 })])
        .vertices,
    );
    expect(clamped.every((vertex) => vertex.every(Number.isFinite))).toBe(true);
    expect(
      Math.max(...clamped.filter((vertex) => vertex[5] === 0).map((vertex) => vertex[9])),
    ).toBe(600);
  });
});
