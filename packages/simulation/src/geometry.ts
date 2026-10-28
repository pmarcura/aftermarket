import type { Position } from './model';

export function distanceKm(a: Position, b: Position) {
  const rad = Math.PI / 180,
    lat = (b[1] - a[1]) * rad,
    lon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(lat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function routeLengths(route: Position[]) {
  const lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(lengths[i - 1] + distanceKm(route[i - 1], route[i]));
  return lengths;
}
export function positionAlongRoute(
  route: Position[],
  progress: number,
  lengths = routeLengths(route),
): { position: Position; completed: Position[]; bearing: number } {
  if (!route.length) return { position: [0, 0], completed: [], bearing: 0 };
  if (route.length === 1) return { position: route[0], completed: [route[0]], bearing: 0 };
  const target = Math.max(0, Math.min(1, progress)) * lengths[lengths.length - 1];
  let low = 1,
    high = route.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lengths[mid] < target) low = mid + 1;
    else high = mid;
  }
  const i = low,
    span = lengths[i] - lengths[i - 1],
    fraction = span ? (target - lengths[i - 1]) / span : 0;
  const a = route[i - 1],
    b = route[i];
  const position: Position = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
  const bearing =
    (Math.atan2((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 180) / Math.PI;
  return { position, completed: [...route.slice(0, i), position], bearing };
}
// Douglas-Peucker por erro espacial, sem teto de pontos que corte ruas em trajetos longos.
// Usa a maior escala longitudinal da rota: o desvio em metros é conservador em toda ela.
export function simplifyPath(route: Position[], toleranceM = 2): Position[] {
  if (route.length < 3 || !Number.isFinite(toleranceM) || toleranceM <= 0) return route;
  const radians = Math.PI / 180,
    metersPerDegree = 6371000 * radians;
  let minLatitude = 90,
    maxLatitude = -90;
  for (const [, latitude] of route) {
    minLatitude = Math.min(minLatitude, latitude);
    maxLatitude = Math.max(maxLatitude, latitude);
  }
  const nearestEquator =
      minLatitude <= 0 && maxLatitude >= 0
        ? 0
        : Math.min(Math.abs(minLatitude), Math.abs(maxLatitude)),
    longitudeScale = metersPerDegree * Math.cos(nearestEquator * radians),
    toleranceSquared = toleranceM ** 2;
  const keep = new Uint8Array(route.length);
  keep[0] = keep[route.length - 1] = 1;
  const spans: [number, number][] = [[0, route.length - 1]];
  // Douglas-Peucker pode ser quadrático. Ao esgotar o orçamento, mantém o trecho completo,
  // preservando a precisão; trabalho e memória permanecem proporcionais ao tamanho da rota.
  let budget = route.length * 32;
  while (spans.length) {
    const [from, to] = spans.pop()!;
    const count = to - from - 1;
    if (count <= 0) continue;
    if (count > budget) {
      keep.fill(1, from + 1, to);
      continue;
    }
    budget -= count;
    const a = route[from],
      b = route[to],
      dx = (b[0] - a[0]) * longitudeScale,
      dy = (b[1] - a[1]) * metersPerDegree,
      squaredLength = dx * dx + dy * dy;
    let index = -1,
      gap = toleranceSquared;
    for (let i = from + 1; i < to; i++) {
      const x = (route[i][0] - a[0]) * longitudeScale,
        y = (route[i][1] - a[1]) * metersPerDegree,
        fraction = squaredLength ? Math.max(0, Math.min(1, (x * dx + y * dy) / squaredLength)) : 0,
        squaredDistance = (x - fraction * dx) ** 2 + (y - fraction * dy) ** 2;
      if (squaredDistance > gap) {
        gap = squaredDistance;
        index = i;
      }
    }
    if (index >= 0) {
      keep[index] = 1;
      spans.push([from, index], [index, to]);
    }
  }
  const simplified = route.filter((_, i) => keep[i]);
  return simplified.length === route.length ? route : simplified;
}
