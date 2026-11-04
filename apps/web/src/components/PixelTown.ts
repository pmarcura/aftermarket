/**
 * Spec 009 · cidade de perto com as peças do pacote (MODERN TOWN SET), sobre a geometria real.
 *
 * Arquitetura (04/11, depois do teste do John): os prédios são uma **camada de símbolos do
 * próprio MapLibre**. Quando os tiles de `building` chegam, cada contorno real vira um ponto com
 * a peça escolhida (pelo tamanho e forma do lote), o ângulo do terreno e a escala; o mapa desenha
 * na GPU, com arraste, zoom e inércia iguais ao resto. Nada de canvas por cima nem redesenho.
 *
 * As peças ficam em /arte/town (fora do Git, licença do pacote). Sem elas, a camada não existe.
 */
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Feature } from 'geojson';

type Ring = [number, number][];
const SOURCE = 'town-buildings';
const LAYER = 'town-buildings';
const MIN_ZOOM = 15;
const BASE = '/arte/town/';
const HB = 'Houses and Buildings/';
const CATALOG = {
  tiny: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${HB}Houses (very small (all 16x16)/${n}.png`),
  small: [1, 2, 3].flatMap((t) =>
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${HB}Houses (small (all 24x24)/Type ${t}/${n}.png`),
  ),
  medium: [1, 2, 3, 4, 5].flatMap((t) =>
    [1, 2, 3, 4, 5, 6, 7, 8].map(
      (n) => `${HB}Houses (medium and big) (all 32x32)/Type ${t}/${n}.png`,
    ),
  ),
  tower: [11, 13, 14, 15, 16, 24, 32, 37].map(
    (n) => `${HB}Houses (medium and big) (all 32x32)/Type 6/${n}.png`,
  ),
  big: [1, 2, 3, 4, 5].map((n) => `${HB}Buildings (all 48x48)/${n}.png`),
  huge: [1, 2, 3].map((n) => `${HB}Buildings (all 64x64)/${n}.png`),
  shop: [1, 2, 3, 4, 5, 6, 7].map((n) => `${HB}Special buildings (all 32x32)/${n}.png`),
};
type Group = keyof typeof CATALOG;
const groups = Object.keys(CATALOG) as Group[];

const hash = (x: number, y: number) => {
  const h = Math.imul((x * 73856093) ^ (y * 19349663), 2654435761);
  return (h ^ (h >>> 15)) >>> 0;
};

/** Retângulo orientado aproximado: eixo da aresta mais longa, extremos projetados nele. */
function orientedBox(pts: [number, number][]) {
  let best = 0,
    angle = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0],
      dy = pts[i + 1][1] - pts[i][1],
      d = dx * dx + dy * dy;
    if (d > best) {
      best = d;
      angle = Math.atan2(dy, dx);
    }
  }
  const cos = Math.cos(-angle),
    sin = Math.sin(-angle);
  let minU = Infinity,
    maxU = -Infinity,
    minV = Infinity,
    maxV = -Infinity;
  for (const [x, y] of pts) {
    const u = x * cos - y * sin,
      v = x * sin + y * cos;
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const cu = (minU + maxU) / 2,
    cv = (minV + maxV) / 2;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return { cx: cu * c - cv * s, cy: cu * s + cv * c, w: maxU - minU, h: maxV - minV, angle };
}

export async function attachPixelTown(map: MapLibreMap) {
  // 1 · peças no mapa (uma imagem por peça; pixelRatio 1 = 1 px da peça por px CSS, que o canvas
  //     em meia resolução amplia para 2×, a crocância 16-bit).
  const sizes = new Map<string, { w: number; h: number }>();
  const loaded: Record<Group, string[]> = {
    tiny: [],
    small: [],
    medium: [],
    tower: [],
    big: [],
    huge: [],
    shop: [],
  };
  await Promise.all(
    groups.flatMap((g) =>
      CATALOG[g].map(async (path, i) => {
        const id = `town-${g}-${i}`;
        try {
          if (!map.hasImage(id)) {
            const res = await map.loadImage(BASE + path);
            map.addImage(id, res.data, { pixelRatio: 1 });
          }
          const img = map.getImage(id);
          if (img) sizes.set(id, { w: img.data.width, h: img.data.height });
          loaded[g].push(id);
        } catch {
          /* peça ausente: segue sem ela */
        }
      }),
    ),
  );
  if (!loaded.small.length) return () => {};
  for (const g of groups) loaded[g].sort();

  // 2 · fonte de pontos e camada de símbolos. icon-size = (largura do lote em px no zoom 15 ÷
  //     largura da peça) × 2^(zoom−15): a peça acompanha o lote em qualquer zoom.
  if (!map.getSource(SOURCE))
    map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  if (!map.getLayer(LAYER))
    map.addLayer(
      {
        id: LAYER,
        type: 'symbol',
        source: SOURCE,
        minzoom: MIN_ZOOM,
        layout: {
          'icon-image': ['get', 'sprite'],
          'icon-size': [
            '*',
            ['get', 'k15'],
            ['interpolate', ['exponential', 2], ['zoom'], 15, 1, 22, 128],
          ],
          'icon-rotate': ['get', 'angle'],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'order'],
        },
      },
      map.getLayer('property-halo') ? 'property-halo' : undefined,
    );

  // 3 · dos contornos reais aos pontos. Roda quando os tiles chegam ou o mapa para; cada prédio
  //     é calculado uma vez (cache por posição).
  const cache = new Map<string, Feature[]>();
  let pending = 0;
  const rebuild = () => {
    pending = 0;
    const zoom = map.getZoom();
    const vis = zoom >= MIN_ZOOM;
    if (map.getLayer('buildings'))
      map.setLayoutProperty('buildings', 'visibility', vis ? 'none' : 'visible');
    if (!vis) return;
    const lat = map.getCenter().lat;
    // metros por px CSS no zoom 15
    const mpp15 = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 256 / Math.pow(2, 15);
    const feats = map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' });
    const out: Feature[] = [];
    const seen = new Set<string>();
    for (const f of feats) {
      const g = f.geometry;
      const rings: Ring[] =
        g.type === 'Polygon'
          ? [g.coordinates[0] as Ring]
          : g.type === 'MultiPolygon'
            ? (g.coordinates as Ring[][]).map((p) => p[0])
            : [];
      for (const ring of rings) {
        if (ring.length < 4) continue;
        const key = `${ring[0][0].toFixed(6)},${ring[0][1].toFixed(6)},${ring.length}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let built = cache.get(key);
        if (!built) {
          built = [];
          // projeção local em metros (equiretangular no centro do lote)
          const lat0 = ring[0][1],
            kx = 111320 * Math.cos((lat0 * Math.PI) / 180),
            ky = 110540;
          const pts = ring.map(([lng, la]) => [lng * kx, -la * ky] as [number, number]);
          const box = orientedBox(pts);
          const long = Math.max(box.w, box.h),
            short = Math.min(box.w, box.h);
          if (long >= 3) {
            const seed = hash(Math.round(ring[0][0] * 1e5), Math.round(ring[0][1] * 1e5));
            let group: Group;
            if (long < 9) group = 'tiny';
            else if (long < 16) group = 'small';
            else if (long < 26) group = seed % 7 === 0 ? 'shop' : 'medium';
            else if (long < 40) group = short > 18 ? 'big' : 'tower';
            else group = short > 30 ? 'huge' : 'big';
            const list = loaded[group].length ? loaded[group] : loaded.small;
            const sprite = list[seed % list.length];
            const size = sizes.get(sprite) ?? { w: 24, h: 24 };
            // encaixe: cobre a largura menor do lote; em lotes compridos repete ao longo do eixo
            const shortPx = short / mpp15,
              longPx = long / mpp15;
            const k15 = Math.max(
              shortPx / size.h,
              Math.min(longPx / size.w, (shortPx / size.h) * 1.4),
            );
            const drawW = size.w * k15;
            const repeats = Math.max(1, Math.min(6, Math.round(longPx / drawW)));
            const angleRad = box.w >= box.h ? box.angle : box.angle + Math.PI / 2;
            const angle = (angleRad * 180) / Math.PI;
            const ux = Math.cos(angleRad),
              uy = Math.sin(angleRad);
            for (let r = 0; r < repeats; r++) {
              const off = (r - (repeats - 1) / 2) * drawW * mpp15; // metros ao longo do eixo
              const mx = box.cx + ux * off,
                my = box.cy + uy * off;
              built.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [mx / kx, -my / ky] },
                properties: { sprite, k15, angle, order: my },
              });
            }
          }
          cache.set(key, built);
        }
        for (const b of built) out.push(b);
      }
    }
    (map.getSource(SOURCE) as GeoJSONSource).setData({ type: 'FeatureCollection', features: out });
  };
  const schedule = () => {
    if (pending) return;
    pending = window.setTimeout(rebuild, 120);
  };
  const onData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId === 'openmaptiles' && e.isSourceLoaded) schedule();
  };
  map.on('sourcedata', onData);
  map.on('moveend', schedule);
  map.on('zoomend', schedule);
  schedule();
  return () => {
    map.off('sourcedata', onData);
    map.off('moveend', schedule);
    map.off('zoomend', schedule);
    if (pending) clearTimeout(pending);
    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    if (map.getLayer('buildings')) map.setLayoutProperty('buildings', 'visibility', 'visible');
  };
}
