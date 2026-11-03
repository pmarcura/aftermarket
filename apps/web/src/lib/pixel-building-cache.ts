import {
  buildBuildingMesh,
  type BuildingFeature,
  type BuildingMesh,
} from './pixel-buildings-geometry';

const MAX_ENTRIES = 3;
const MAX_BYTES = 16 * 1024 * 1024;

/** The geometry generator drops exact duplicate footprints, taking the first
 * eligible feature's height. Keep that same rule before sorting content keys. */
function contentKey(features: readonly BuildingFeature[]) {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    const properties = feature.properties ?? {};
    if (
      !geometry ||
      !['Polygon', 'MultiPolygon'].includes(geometry.type) ||
      [true, 1, 'true'].includes(properties.hide_3d as boolean | number | string)
    )
      continue;
    const id = feature.id ?? properties.osm_id;
    const geometryText = JSON.stringify(geometry);
    const identity = `${id ?? ''}:${geometryText}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    entries.push(
      JSON.stringify([
        identity,
        // Missing IDs and an empty ID produce different decorative palettes.
        id === null || id === undefined ? null : String(id),
        properties.render_height,
        properties.render_min_height,
      ]),
    );
  }
  entries.sort();
  // Full keys avoid treating a 32-bit hash collision as unchanged geography.
  return JSON.stringify(entries);
}

export interface CachedBuildingMesh {
  mesh: BuildingMesh;
  cacheHit: boolean;
  buildMs: number;
  lookupMs: number;
  contentKey: string;
}

/** Small LRU of CPU meshes. Cache hits never project or triangulate footprints.
 * The byte budget counts vertex buffers and retained UTF-16 keys. A mesh larger
 * than the budget is rendered normally without retaining an extra CPU copy. */
export class BuildingMeshCache {
  private readonly entries = new Map<string, { mesh: BuildingMesh; bytes: number }>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private builds = 0;
  private readonly maxEntries: number;
  private readonly maxBytes: number;

  constructor(options: { maxEntries?: number; maxBytes?: number } = {}) {
    this.maxEntries = Math.max(
      0,
      Math.min(MAX_ENTRIES, Math.floor(options.maxEntries ?? MAX_ENTRIES)),
    );
    this.maxBytes = Math.max(0, Math.min(MAX_BYTES, Math.floor(options.maxBytes ?? MAX_BYTES)));
  }

  get stats() {
    return {
      hits: this.hits,
      misses: this.misses,
      builds: this.builds,
      entries: this.entries.size,
      bytes: this.bytes,
    };
  }

  get(features: readonly BuildingFeature[]): CachedBuildingMesh {
    const started = performance.now();
    const key = contentKey(features);
    const cached = this.entries.get(key);
    if (cached) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      this.hits++;
      return {
        mesh: cached.mesh,
        cacheHit: true,
        buildMs: 0,
        lookupMs: performance.now() - started,
        contentKey: key,
      };
    }
    const lookupMs = performance.now() - started;
    this.misses++;
    const buildStarted = performance.now();
    const mesh = buildBuildingMesh(features);
    const buildMs = performance.now() - buildStarted;
    this.builds++;
    const bytes = mesh.vertices.byteLength + key.length * 2 + 64;
    if (this.maxEntries > 0 && bytes <= this.maxBytes) {
      while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined) break;
        this.bytes -= this.entries.get(oldest)!.bytes;
        this.entries.delete(oldest);
      }
      this.entries.set(key, { mesh, bytes });
      this.bytes += bytes;
    }
    return { mesh, cacheHit: false, buildMs, lookupMs, contentKey: key };
  }

  clear() {
    this.entries.clear();
    this.bytes = 0;
    this.hits = this.misses = this.builds = 0;
  }
}

export interface BuildingBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** A coverage gate, not a claim that unqueried neighbouring tiles are loaded.
 * Reuse needs both unchanged source data and the same source-tile range. */
export class BuildingViewportCache {
  private covered: BuildingBounds | undefined;
  private tiles = '';
  private revision = -1;

  private tileRange(bounds: BuildingBounds) {
    const size = 2 ** 14; // OpenFreeMap's canonical building source ends at z14.
    const x = (lng: number) =>
      Math.floor(Math.max(0, Math.min(size - 1, ((lng + 180) / 360) * size)));
    const y = (lat: number) => {
      const radians = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
      return Math.floor(
        Math.max(0, Math.min(size - 1, ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * size)),
      );
    };
    return `${x(bounds.west)}:${x(bounds.east)}:${y(bounds.north)}:${y(bounds.south)}`;
  }

  canReuse(bounds: BuildingBounds, sourceRevision: number) {
    const covered = this.covered;
    return Boolean(
      covered &&
      this.revision === sourceRevision &&
      this.tiles === this.tileRange(bounds) &&
      bounds.west >= covered.west &&
      bounds.east <= covered.east &&
      bounds.south >= covered.south &&
      bounds.north <= covered.north,
    );
  }

  cover(bounds: BuildingBounds, sourceRevision: number): BuildingBounds {
    const longitude = (bounds.east - bounds.west) * 0.3;
    const latitude = (bounds.north - bounds.south) * 0.3;
    this.covered = {
      west: bounds.west - longitude,
      east: bounds.east + longitude,
      south: bounds.south - latitude,
      north: bounds.north + latitude,
    };
    this.tiles = this.tileRange(bounds);
    this.revision = sourceRevision;
    return this.covered;
  }

  clear() {
    this.covered = undefined;
    this.tiles = '';
    this.revision = -1;
  }
}

/** Bounds include every ring, preserving courtyards and multipart footprints.
 * Intersection also retains a large footprint surrounding the entire view. */
export function intersectsBuildingBounds(feature: BuildingFeature, bounds: BuildingBounds) {
  const geometry = feature.geometry;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return false;
  if (!Array.isArray(geometry.coordinates)) return false;
  const rings = (
    geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()
  ) as unknown[];
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const ring of rings) {
    if (!Array.isArray(ring)) continue;
    for (const point of ring) {
      if (!Array.isArray(point)) continue;
      const [lng, lat] = point;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return (
    west <= bounds.east && east >= bounds.west && south <= bounds.north && north >= bounds.south
  );
}
