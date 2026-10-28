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
// Simplificação de Douglas-Peucker com no máximo `maxPoints` pontos, preservando início e fim.
// Uma rota rodoviária tem milhares de pontos; o mapa precisa de algumas centenas.
export function simplifyPath(route: Position[], maxPoints = 150): Position[] {
  if (route.length <= maxPoints) return route;
  const keep = new Uint8Array(route.length);
  keep[0] = keep[route.length - 1] = 1;
  const distance = (p: Position, a: Position, b: Position) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = dx || dy ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy) : 0;
    const c = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + c * dx), p[1] - (a[1] + c * dy));
  };
  // Mantém sempre o ponto mais distante do trecho com maior desvio até atingir o limite.
  const spans: { from: number; to: number; index: number; gap: number }[] = [];
  const measure = (from: number, to: number) => {
    let index = -1,
      gap = 0;
    for (let i = from + 1; i < to; i++) {
      const d = distance(route[i], route[from], route[to]);
      if (d > gap) {
        gap = d;
        index = i;
      }
    }
    if (index > 0) spans.push({ from, to, index, gap });
  };
  measure(0, route.length - 1);
  let kept = 2;
  while (kept < maxPoints && spans.length) {
    let best = 0;
    for (let i = 1; i < spans.length; i++) if (spans[i].gap > spans[best].gap) best = i;
    const { from, to, index } = spans.splice(best, 1)[0];
    keep[index] = 1;
    kept++;
    measure(from, index);
    measure(index, to);
  }
  return route.filter((_, i) => keep[i]);
}
