import { describe, expect, it } from 'vitest';
import {
  BuildingMeshCache,
  BuildingViewportCache,
  intersectsBuildingBounds,
} from '../apps/web/src/lib/pixel-building-cache';
import {
  buildBuildingMesh,
  type BuildingFeature,
} from '../apps/web/src/lib/pixel-buildings-geometry';

function building(id = 1, height = 8, offset = 0): BuildingFeature {
  const x = -47.06 + offset,
    y = -22.9;
  return {
    id,
    properties: { render_height: height },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, y],
          [x + 0.0002, y],
          [x + 0.0002, y + 0.0002],
          [x, y + 0.0002],
          [x, y],
        ],
      ],
    },
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

describe('cache de malhas de construções', () => {
  it('reutiliza conteúdo clonado e reordenado sem triangular outra vez nem alterar entradas', () => {
    const features = freeze([building(1), building(2, 24, 0.001)]);
    const before = JSON.stringify(features);
    const cache = new BuildingMeshCache();
    const first = cache.get(features);
    expect(first.cacheHit).toBe(false);
    expect(first.mesh).toEqual(buildBuildingMesh(features));
    const again = cache.get(structuredClone(features).reverse());
    expect(again.cacheHit).toBe(true);
    expect(again.mesh).toBe(first.mesh);
    expect(again.buildMs).toBe(0);
    expect(cache.stats.builds).toBe(1);
    expect(JSON.stringify(features)).toBe(before);
  });

  it('invalida altura, base, geometria e hide_3d, mantendo a malha canônica', () => {
    const cache = new BuildingMeshCache();
    const feature = building();
    cache.get([feature]);
    for (const properties of [
      { render_height: 30 },
      { render_height: 30, render_min_height: 12 },
      { render_height: 30, render_min_height: 12, hide_3d: true },
    ]) {
      feature.properties = properties;
      const result = cache.get([feature]);
      expect(result.cacheHit).toBe(false);
      expect(result.mesh).toEqual(buildBuildingMesh([feature]));
    }
    feature.properties = { render_height: 30, render_min_height: 12 };
    const rings = feature.geometry!.coordinates as number[][][];
    rings.push([
      [-47.05996, -22.89996],
      [-47.05986, -22.89996],
      [-47.05986, -22.89986],
      [-47.05996, -22.89986],
      [-47.05996, -22.89996],
    ]);
    const courtyard = cache.get([feature]);
    expect(courtyard.cacheHit).toBe(false);
    expect(courtyard.mesh).toEqual(buildBuildingMesh([feature]));
    expect(cache.stats.builds).toBe(5);
  });

  it('preserva a primeira altura de cópias conflitantes e fragmentos distintos do mesmo ID', () => {
    const cache = new BuildingMeshCache();
    const low = building(1, 8);
    const high = building(1, 30);
    const lowFirst = cache.get([low, high]);
    const highFirst = cache.get([high, low]);
    expect(highFirst.cacheHit).toBe(false);
    expect(lowFirst.mesh).toEqual(buildBuildingMesh([low, high]));
    expect(highFirst.mesh).toEqual(buildBuildingMesh([high, low]));
    expect(highFirst.mesh.vertices).not.toEqual(lowFirst.mesh.vertices);
    const fragments = [low, building(1, 8, 0.001)];
    const fragmented = cache.get(fragments);
    expect(fragmented.mesh).toEqual(buildBuildingMesh(fragments));
    expect(fragmented.mesh.buildingCount).toBe(2);
    expect(cache.get(structuredClone(fragments).reverse()).mesh).toBe(fragmented.mesh);
  });

  it('não confunde ID ausente com ID vazio nem invalida por propriedade econômica irrelevante', () => {
    const feature = building();
    delete feature.id;
    const cache = new BuildingMeshCache();
    const missing = cache.get([feature]);
    feature.id = '';
    const empty = cache.get([feature]);
    expect(empty.cacheHit).toBe(false);
    expect(empty.mesh).toEqual(buildBuildingMesh([feature]));
    expect(empty.mesh.vertices).not.toEqual(missing.mesh.vertices);
    feature.properties!.ownerId = 'player';
    feature.properties!.stock = 500;
    expect(cache.get([feature]).mesh).toBe(empty.mesh);
  });

  it('limita a três malhas e remove a menos usada, não a última consultada', () => {
    const cache = new BuildingMeshCache();
    const a = [building(1)],
      b = [building(2)],
      c = [building(3)],
      d = [building(4)];
    const meshA = cache.get(a).mesh;
    cache.get(b);
    cache.get(c);
    expect(cache.get(a).mesh).toBe(meshA);
    cache.get(d);
    expect(cache.stats.entries).toBe(3);
    expect(cache.get(a).cacheHit).toBe(true);
    expect(cache.get(b).cacheHit).toBe(false);
    expect(cache.stats.entries).toBe(3);
    expect(cache.stats.bytes).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it('respeita o orçamento de bytes e desenha malhas maiores sem retê-las', () => {
    const cache = new BuildingMeshCache({ maxBytes: 1 });
    const features = [building()];
    expect(cache.get(features).mesh).toEqual(buildBuildingMesh(features));
    expect(cache.get(features).cacheHit).toBe(false);
    expect(cache.stats).toMatchObject({ entries: 0, bytes: 0, builds: 2 });
    const reference = new BuildingMeshCache();
    reference.get(features);
    const budget = reference.stats.bytes + 32;
    const bounded = new BuildingMeshCache({ maxBytes: budget });
    bounded.get(features);
    bounded.get([building(2)]);
    expect(bounded.stats.entries).toBe(1);
    expect(bounded.stats.bytes).toBeLessThanOrEqual(budget);
    bounded.clear();
    expect(bounded.stats).toEqual({ entries: 0, bytes: 0, hits: 0, misses: 0, builds: 0 });
  });
});

describe('cobertura de construções consultadas', () => {
  const bounds = { west: 0.001, east: 0.002, south: 0.001, north: 0.002 };

  it('reutiliza pequenos movimentos e zoom para dentro, mas exige nova consulta ao sair da margem', () => {
    const cache = new BuildingViewportCache();
    expect(cache.canReuse(bounds, 1)).toBe(false);
    cache.cover(bounds, 1);
    expect(cache.canReuse({ ...bounds, west: 0.0011, east: 0.0021 }, 1)).toBe(true);
    expect(cache.canReuse({ west: 0.0012, east: 0.0018, south: 0.0012, north: 0.0018 }, 1)).toBe(
      true,
    );
    expect(cache.canReuse({ ...bounds, west: 0.0015, east: 0.0025 }, 1)).toBe(false);
    expect(cache.canReuse(bounds, 2)).toBe(false);
    cache.clear();
    expect(cache.canReuse(bounds, 1)).toBe(false);
  });

  it('não declara tiles vizinhos como consultados só porque estão dentro do overscan', () => {
    const cache = new BuildingViewportCache();
    const edge = { west: 0.0215, east: 0.0219, south: 0.001, north: 0.002 };
    const coverage = cache.cover(edge, 1);
    expect(coverage.east).toBeGreaterThan(0.022);
    expect(cache.canReuse({ ...edge, west: 0.0216, east: 0.022 }, 1)).toBe(false);
  });

  it('conserva galpão envolvendo o viewport, furos e partes de um multipolígono', () => {
    const feature = freeze(building());
    const before = JSON.stringify(feature);
    const inside = { west: -47.05996, east: -47.05994, south: -22.89996, north: -22.89994 };
    expect(intersectsBuildingBounds(feature, inside)).toBe(true);
    expect(intersectsBuildingBounds(feature, bounds)).toBe(false);
    const multi: BuildingFeature = {
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          building().geometry!.coordinates,
          building(2, 8, 0.001).geometry!.coordinates,
        ],
      },
    };
    expect(
      intersectsBuildingBounds(multi, {
        ...inside,
        west: inside.west + 0.001,
        east: inside.east + 0.001,
      }),
    ).toBe(true);
    expect(JSON.stringify(feature)).toBe(before);
  });
});
