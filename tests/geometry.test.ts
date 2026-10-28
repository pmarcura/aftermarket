import { describe, expect, it } from 'vitest';
import {
  distanceKm,
  positionAlongRoute,
  routeLengths,
  simplifyPath,
} from '../packages/simulation/src/geometry';
import type { Position } from '../packages/simulation/src/model';

function segmentDistanceM(point: Position, a: Position, b: Position) {
  const scale = Math.cos((point[1] * Math.PI) / 180),
    x = (b[0] - a[0]) * scale,
    y = b[1] - a[1],
    denominator = x * x + y * y,
    fraction = denominator
      ? Math.max(
          0,
          Math.min(1, ((point[0] - a[0]) * scale * x + (point[1] - a[1]) * y) / denominator),
        )
      : 0;
  return distanceKm(point, [a[0] + fraction * (b[0] - a[0]), a[1] + fraction * y]) * 1000;
}

describe('geometria rodoviária no mapa', () => {
  it.each([-23, 65])('limita erro local em rota longa à latitude %s, sem teto de pontos', (lat) => {
    const route: Position[] = Array.from({ length: 10000 }, (_, i) => [
      -47 + i * 0.00005,
      lat + Math.sin(i / 12) * 0.0003,
    ]);
    const simplified = simplifyPath(route, 2);
    expect(simplified.length).toBeGreaterThan(150);
    expect(simplified.length).toBeLessThan(route.length);
    expect(simplified[0]).toBe(route[0]);
    expect(simplified.at(-1)).toBe(route.at(-1));
    let segment = 0,
      maxDeviation = 0;
    for (const point of route) {
      if (point === simplified[segment + 1] && segment < simplified.length - 2) segment++;
      maxDeviation = Math.max(
        maxDeviation,
        segmentDistanceM(point, simplified[segment], simplified[segment + 1]),
      );
    }
    expect(maxDeviation).toBeLessThanOrEqual(2.000001);
  });

  it('preserva curvas urbanas, ordem, distância e posição do caminhão ao longo da viagem', () => {
    const corners: Position[] = Array.from({ length: 401 }, (_, i) => [
      -47 + i * 0.0005,
      -23 + (i % 2) * 0.0004,
    ]);
    const route = corners.flatMap((point, i): Position[] =>
      i
        ? [[(corners[i - 1][0] + point[0]) / 2, (corners[i - 1][1] + point[1]) / 2], point]
        : [point],
    );
    const simplified = simplifyPath(route),
      originalLengths = routeLengths(route),
      simplifiedLengths = routeLengths(simplified);
    expect(simplified.length).toBeGreaterThan(150);
    expect(simplifiedLengths.at(-1)).toBeCloseTo(originalLengths.at(-1)!, 5);
    for (let i = 0; i <= 100; i++) {
      const original = positionAlongRoute(route, i / 100, originalLengths),
        drawn = positionAlongRoute(simplified, i / 100, simplifiedLengths);
      expect(distanceKm(original.position, drawn.position) * 1000).toBeLessThan(0.01);
    }
    expect(positionAlongRoute(simplified, 0).position).toEqual(route[0]);
    expect(positionAlongRoute(simplified, 1).position).toEqual(route.at(-1));
  });

  it('mantém geometria difícil inteira quando necessário e aceita trajetos curtos/repetidos', () => {
    const zigzag: Position[] = Array.from({ length: 100000 }, (_, i) => [
      -47 + i * 0.000005,
      -23 + (i % 2) * 0.0004,
    ]);
    // Cada ponta muda de direção muito mais que 2 m: não pode sumir para caber no pacote.
    expect(simplifyPath(zigzag)).toEqual(zigzag);
    expect(simplifyPath([])).toEqual([]);
    expect(simplifyPath([[0, 0]])).toEqual([[0, 0]]);
    expect(
      simplifyPath([
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
