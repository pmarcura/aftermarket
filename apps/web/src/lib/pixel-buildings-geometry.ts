import earcut from 'earcut';

export const BUILDING_VERTEX_STRIDE = 10;
const EARTH_CIRCUMFERENCE = 40075016.68557849;
const MAX_LATITUDE = 85.05112878;
const MAX_HEIGHT = 600;
type Point = [number, number];

export interface BuildingFeature {
  id?: string | number;
  geometry: { type: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

export interface BuildingMesh {
  /** x/y relative to origin, z in Mercator units, u/v in metres, material,
   * palette variant, directional shade, facade width/height in metres. */
  vertices: Float32Array;
  origin: Point;
  buildingCount: number;
  key: string;
}

interface Polygon {
  rings: Point[][];
  height: number;
  base: number;
  scale: number;
  variant: number;
  featureKey: string;
}

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++)
    value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

function mercator([longitude, latitude]: Point): Point {
  const radians = (latitude * Math.PI) / 180;
  return [
    (longitude + 180) / 360,
    (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2,
  ];
}

function signedArea(points: Point[]) {
  // Relative coordinates avoid cancellation at the small size of a building.
  const anchor = points[0];
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index],
      b = points[(index + 1) % points.length];
    area += (a[0] - anchor[0]) * (b[1] - anchor[1]) - (b[0] - anchor[0]) * (a[1] - anchor[1]);
  }
  return area / 2;
}

function parseRing(value: unknown): { points: Point[]; latitude: number } | null {
  if (!Array.isArray(value)) return null;
  const coordinates: Point[] = [];
  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const [longitude, latitude] = raw;
    if (
      typeof longitude !== 'number' ||
      typeof latitude !== 'number' ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      Math.abs(longitude) > 180 ||
      Math.abs(latitude) > MAX_LATITUDE
    )
      return null;
    const previous = coordinates.at(-1);
    if (!previous || previous[0] !== longitude || previous[1] !== latitude)
      coordinates.push([longitude, latitude]);
  }
  const first = coordinates[0],
    last = coordinates.at(-1);
  if (first && last && first[0] === last[0] && first[1] === last[1]) coordinates.pop();
  if (coordinates.length < 3) return null;
  const points = coordinates.map(mercator);
  if (Math.abs(signedArea(points)) < 1e-18) return null;
  return { points, latitude: coordinates.reduce((sum, p) => sum + p[1], 0) / coordinates.length };
}

function number(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tileBoundaryEdge(a: Point, b: Point) {
  // OpenFreeMap's source ends at z14. A polygon ending exactly on this grid
  // may be a clipped fragment, so its roof must not acquire an invented ridge.
  return [0, 1].some((axis) => {
    const first = a[axis] * 16384,
      last = b[axis] * 16384;
    return (
      Math.abs(first - Math.round(first)) < 1e-6 &&
      Math.abs(last - Math.round(last)) < 1e-6 &&
      Math.round(first) === Math.round(last)
    );
  });
}

function rectangle(rings: Point[][], scale: number): Point[] | null {
  if (rings.length !== 1) return null;
  if (
    rings[0].some((point, index) =>
      tileBoundaryEdge(point, rings[0][(index + 1) % rings[0].length]),
    )
  )
    return null;
  // Roof recognition ignores collinear survey points within two centimetres.
  // Original rings remain untouched for the walls and triangulated fallback.
  const points = [...rings[0]];
  let changed = true;
  while (points.length > 4 && changed) {
    changed = false;
    for (let index = 0; index < points.length; index++) {
      const a = points[(index + points.length - 1) % points.length];
      const b = points[index],
        c = points[(index + 1) % points.length];
      const dx = c[0] - a[0],
        dy = c[1] - a[1],
        lengthSquared = dx * dx + dy * dy;
      if (!lengthSquared) continue;
      const position = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / lengthSquared;
      const distance = Math.abs(dx * (b[1] - a[1]) - dy * (b[0] - a[0])) / Math.sqrt(lengthSquared);
      if (position >= 0 && position <= 1 && distance / scale <= 0.02) {
        points.splice(index, 1);
        changed = true;
        break;
      }
    }
  }
  if (points.length !== 4) return null;
  const lengths = points.map((p, i) =>
    Math.hypot(points[(i + 1) % 4][0] - p[0], points[(i + 1) % 4][1] - p[1]),
  );
  if (lengths.some((length) => length / scale < 0.5)) return null;
  for (let index = 0; index < 4; index++) {
    const a = points[index],
      b = points[(index + 1) % 4],
      c = points[(index + 2) % 4];
    const cosine =
      ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) /
      (lengths[index] * lengths[(index + 1) % 4]);
    if (Math.abs(cosine) > 0.25) return null;
  }
  if (
    Math.max(lengths[0], lengths[2]) / Math.min(lengths[0], lengths[2]) > 1.25 ||
    Math.max(lengths[1], lengths[3]) / Math.min(lengths[1], lengths[3]) > 1.25
  )
    return null;
  const start = lengths.indexOf(Math.max(...lengths));
  return points.map((_, index) => points[(start + index) % 4]);
}

/** Geographic footprints remain exact. Roof forms, palettes and the six-metre
 * height fallback are illustrative; nothing here changes simulation data. */
export function buildBuildingMesh(features: readonly BuildingFeature[]): BuildingMesh {
  const seen = new Set<string>();
  const polygons: Polygon[] = [];
  for (const feature of features) {
    const geometry = feature.geometry,
      properties = feature.properties ?? {};
    if (
      !geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.type) ||
      [true, 1, 'true'].includes(properties.hide_3d as boolean | number | string)
    )
      continue;
    const rawPolygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(rawPolygons)) continue;
    const geometryText = JSON.stringify(geometry);
    // An id may have several clipped parts. Only identical geometry is dropped.
    const stableId = feature.id ?? properties.osm_id;
    const featureKey = `${stableId ?? ''}:${geometryText}`;
    if (seen.has(featureKey)) continue;
    seen.add(featureKey);
    const height = Math.min(MAX_HEIGHT, Math.max(1, number(properties.render_height, 6)));
    const base = Math.min(height, Math.max(0, number(properties.render_min_height, 0)));
    // Tile fragments of the same building must share a facade palette.
    const variant =
      hash(stableId === undefined || stableId === null ? geometryText : String(stableId)) % 4;
    for (const rawPolygon of rawPolygons) {
      if (!Array.isArray(rawPolygon) || !rawPolygon.length) continue;
      const rings = rawPolygon.map(parseRing);
      if (rings.some((ring) => !ring)) continue;
      const valid = rings as { points: Point[]; latitude: number }[];
      const scale = 1 / (EARTH_CIRCUMFERENCE * Math.cos((valid[0].latitude * Math.PI) / 180));
      polygons.push({
        rings: valid.map((ring) => ring.points),
        height,
        base,
        scale,
        variant,
        featureKey,
      });
    }
  }
  polygons.sort((a, b) => a.featureKey.localeCompare(b.featureKey));
  if (!polygons.length)
    return { vertices: new Float32Array(), origin: [0, 0], buildingCount: 0, key: 'empty' };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const polygon of polygons)
    for (const ring of polygon.rings)
      for (const [x, y] of ring) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  const origin: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
  const vertices: number[] = [];
  for (const polygon of polygons) {
    const { rings, height, base, scale, variant } = polygon;
    const outer = rings[0];
    const vertex = (
      point: Point,
      z: number,
      u: number,
      v: number,
      material: number,
      shade: number,
      width: number,
      wallHeight: number,
    ) => {
      vertices.push(
        point[0] - origin[0],
        point[1] - origin[1],
        z * scale,
        u,
        v,
        material,
        variant,
        shade,
        width,
        wallHeight,
      );
    };
    for (const [ringIndex, ring] of rings.entries()) {
      const orientation = Math.sign(signedArea(ring)) * (ringIndex === 0 ? 1 : -1);
      for (let index = 0; index < ring.length; index++) {
        const a = ring[index],
          b = ring[(index + 1) % ring.length];
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          edge = Math.hypot(dx, dy),
          width = edge / scale;
        const shade = 0.65 + 0.3 * Math.max(0, (orientation * (-dy + dx)) / (edge * Math.SQRT2));
        for (const [point, z, u, v] of [
          [a, base, 0, 0],
          [b, base, width, 0],
          [b, height, width, height - base],
          [a, base, 0, 0],
          [b, height, width, height - base],
          [a, height, 0, height - base],
        ] as [Point, number, number, number][])
          vertex(point, z, u, v, 0, shade, width, height - base);
      }
    }

    const roof = height <= 16 && base === 0 ? rectangle(rings, scale) : null;
    if (roof) {
      const [a, b, c, d] = roof;
      const r0: Point = [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2];
      const r1: Point = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) / scale;
      const width = Math.hypot(d[0] - a[0], d[1] - a[1]) / scale;
      const rise = Math.min(3, Math.max(0.6, width * 0.25));
      const ux = (b[0] - a[0]) / (length * scale),
        uy = (b[1] - a[1]) / (length * scale);
      const vx = (d[0] - a[0]) / (width * scale),
        vy = (d[1] - a[1]) / (width * scale);
      const roofVertex = (point: Point, z: number, shade: number) =>
        vertex(
          point,
          z,
          ((point[0] - a[0]) * ux + (point[1] - a[1]) * uy) / scale,
          ((point[0] - a[0]) * vx + (point[1] - a[1]) * vy) / scale,
          1,
          shade,
          length,
          width,
        );
      for (const [points, shade] of [
        [
          [
            [a, height],
            [b, height],
            [r1, height + rise],
            [a, height],
            [r1, height + rise],
            [r0, height + rise],
          ],
          1,
        ],
        [
          [
            [r0, height + rise],
            [r1, height + rise],
            [c, height],
            [r0, height + rise],
            [c, height],
            [d, height],
          ],
          0.8,
        ],
      ] as [[Point, number][], number][])
        for (const [point, z] of points) roofVertex(point, z, shade);
      for (const [left, right, ridge] of [
        [d, a, r0],
        [b, c, r1],
      ]) {
        vertex(left, height, 0, height - base, 0, 0.8, width, height + rise - base);
        vertex(right, height, width, height - base, 0, 0.8, width, height + rise - base);
        vertex(
          ridge,
          height + rise,
          width / 2,
          height + rise - base,
          0,
          0.8,
          width,
          height + rise - base,
        );
      }
    } else {
      const points = rings.flat();
      const holes: number[] = [];
      let count = outer.length;
      for (const ring of rings.slice(1)) {
        holes.push(count);
        count += ring.length;
      }
      const indices = earcut(points.flat(), holes, 2);
      const roofMinX = Math.min(...outer.map((point) => point[0]));
      const roofMinY = Math.min(...outer.map((point) => point[1]));
      const roofWidth = (Math.max(...outer.map((point) => point[0])) - roofMinX) / scale;
      const roofDepth = (Math.max(...outer.map((point) => point[1])) - roofMinY) / scale;
      for (const index of indices) {
        const point = points[index];
        vertex(
          point,
          height,
          (point[0] - roofMinX) / scale,
          (point[1] - roofMinY) / scale,
          2,
          1,
          roofWidth,
          roofDepth,
        );
      }
    }
  }
  const keys = [...new Set(polygons.map((polygon) => polygon.featureKey))];
  return {
    vertices: new Float32Array(vertices),
    origin,
    buildingCount: keys.length,
    key: hash(
      polygons
        .map((polygon) => `${polygon.featureKey}/${polygon.height}/${polygon.base}`)
        .join('|'),
    ).toString(16),
  };
}
