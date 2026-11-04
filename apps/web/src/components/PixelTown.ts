/**
 * Spec 009 · cidade de perto com as peças do pacote (MODERN TOWN SET), sobre a geometria real.
 *
 * Nos zooms altos, cada contorno real de prédio (camada `building` do OSM) recebe um sprite do
 * pacote escolhido pelo tamanho e pela forma do lote (casinha, sobrado, prédio, galpão), girado
 * no eixo do terreno; carros do pacote circulam pelas ruas reais. É um canvas por cima do mapa,
 * desenhado em meia resolução e ampliado sem suavização, como o próprio mapa.
 *
 * As peças ficam em /arte/town (fora do Git, licença do pacote). Sem elas, nada é desenhado e o
 * mapa segue com os telhados de textura.
 */
import type { Map as MapLibreMap } from 'maplibre-gl';

type Ring = [number, number][];

const MIN_ZOOM = 15.2;
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
  car: [
    ['Cars Type 1 (regular)', 'Red'],
    ['Cars Type 1 (regular)', 'Blue'],
    ['Cars Type 1 (regular)', 'Black'],
    ['Cars Type 2 (beetle)', 'Yellow'],
    ['Cars Type 2 (beetle)', 'Green'],
    ['Cars Type 3 (minivan)', 'Orange'],
    ['Cars Type 4 (jeep)', 'Crimson'],
    ['Cars Type 5 (lightweight Truck)', 'Violet'],
  ].map(([t, c]) => `Cars and People/CARS (all 16x16)/${t}/${c}/Right.png`),
};
type Group = keyof typeof CATALOG;

const cache = new Map<string, HTMLImageElement | null>();
let loading: Promise<void> | undefined;
function load(path: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BASE + path;
  });
}
async function preload() {
  const all = (Object.keys(CATALOG) as Group[]).flatMap((g) => CATALOG[g]);
  await Promise.all(
    all.map(async (p) => {
      if (!cache.has(p)) cache.set(p, await load(p));
    }),
  );
}
function pick(group: Group, seed: number) {
  const list = CATALOG[group].map((p) => cache.get(p)).filter(Boolean) as HTMLImageElement[];
  return list.length ? list[Math.abs(seed) % list.length] : null;
}
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
  return {
    cx: cu * c - cv * s,
    cy: cu * s + cv * c,
    w: maxU - minU,
    h: maxV - minV,
    angle,
  };
}

export function attachPixelTown(map: MapLibreMap, host: HTMLElement, pixelRatio: number) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-town';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let raf = 0,
    stopped = false;
  loading ??= preload();

  const draw = () => {
    raf = 0;
    if (stopped) return;
    const rect = host.getBoundingClientRect();
    const W = Math.max(1, Math.round(rect.width * pixelRatio)),
      H = Math.max(1, Math.round(rect.height * pixelRatio));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const zoom = map.getZoom();
    const on = zoom >= MIN_ZOOM;
    canvas.style.display = on ? '' : 'none';
    if (map.getLayer('buildings'))
      map.setLayoutProperty('buildings', 'visibility', on ? 'none' : 'visible');
    if (!on) return;
    // metros por pixel de tela no centro da vista
    const center = map.getCenter();
    const mpp = (40075016.686 * Math.cos((center.lat * Math.PI) / 180)) / 256 / Math.pow(2, zoom);
    const scale = pixelRatio; // px do canvas por px de tela
    const buildings = map.queryRenderedFeatures(undefined, { layers: ['building-outline'] });
    const seen = new Set<string>();
    for (const f of buildings) {
      const g = f.geometry;
      const rings: Ring[] =
        g.type === 'Polygon'
          ? [g.coordinates[0] as Ring]
          : g.type === 'MultiPolygon'
            ? (g.coordinates as Ring[][]).map((p) => p[0])
            : [];
      for (const ring of rings) {
        const pts = ring.map(([lng, lat]) => {
          const p = map.project([lng, lat]);
          return [p.x * scale, p.y * scale] as [number, number];
        });
        const box = orientedBox(pts);
        const key = `${Math.round(box.cx)}:${Math.round(box.cy)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const wM = (box.w / scale) * mpp,
          hM = (box.h / scale) * mpp;
        const long = Math.max(wM, hM),
          short = Math.min(wM, hM);
        const seed = hash(Math.round(ring[0][0] * 1e5), Math.round(ring[0][1] * 1e5));
        let group: Group;
        if (long < 9) group = 'tiny';
        else if (long < 16) group = 'small';
        else if (long < 26) group = seed % 7 === 0 ? 'shop' : 'medium';
        else if (long < 40) group = short > 18 ? 'big' : 'tower';
        else group = short > 30 ? 'huge' : 'big';
        const img = pick(group, seed);
        if (!img) continue;
        // encaixe: a peça cobre o retângulo do lote; se o lote for muito comprido, repete a
        // peça ao longo do eixo (galpões e fileiras de sobrados) em vez de esticar.
        const targetW = Math.max(box.w, box.h),
          targetH = Math.min(box.w, box.h);
        const k = Math.max(
          targetH / img.height,
          Math.min(targetW / img.width, (targetH / img.height) * 1.4),
        );
        const drawW = img.width * k,
          drawH = img.height * k;
        const repeats = Math.max(1, Math.round(targetW / drawW));
        const angle = box.w >= box.h ? box.angle : box.angle + Math.PI / 2;
        ctx.save();
        ctx.translate(Math.round(box.cx), Math.round(box.cy));
        ctx.rotate(angle);
        const startX = -(repeats * drawW) / 2;
        for (let r = 0; r < repeats; r++)
          ctx.drawImage(
            img,
            Math.round(startX + r * drawW),
            Math.round(-drawH / 2),
            Math.round(drawW),
            Math.round(drawH),
          );
        ctx.restore();
      }
    }
    // carros: pontos ao longo das ruas reais, deslocados pelo tempo (vida na cidade)
    const roads = map.queryRenderedFeatures(undefined, { layers: ['roads-pixel'] });
    const t = (performance.now() / 1000) % 1000;
    for (const f of roads) {
      const g = f.geometry;
      const lines: Ring[] =
        g.type === 'LineString'
          ? [g.coordinates as Ring]
          : g.type === 'MultiLineString'
            ? (g.coordinates as Ring[])
            : [];
      for (const line of lines) {
        const pts = line.map(([lng, lat]) => {
          const p = map.project([lng, lat]);
          return [p.x * scale, p.y * scale] as [number, number];
        });
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i],
            [x1, y1] = pts[i + 1];
          const len = Math.hypot(x1 - x0, y1 - y0);
          if (len < 40) continue;
          const seed = hash(Math.round(line[i][0] * 1e4), Math.round(line[i][1] * 1e4));
          const n = Math.min(3, Math.floor(len / 90));
          for (let c = 0; c < n; c++) {
            const speed = 18 + ((seed >> (c * 3)) % 12);
            const u = ((((seed % 97) / 97 + c / n + (t * speed) / len) % 1) + 1) % 1;
            const img = pick('car', seed + c);
            if (!img) continue;
            const side = c % 2 ? 1 : -1;
            const ang = Math.atan2(y1 - y0, x1 - x0) + (side > 0 ? 0 : Math.PI);
            const nx = -(y1 - y0) / len,
              ny = (x1 - x0) / len;
            const px = x0 + (x1 - x0) * (side > 0 ? u : 1 - u) + nx * side * 4,
              py = y0 + (y1 - y0) * (side > 0 ? u : 1 - u) + ny * side * 4;
            ctx.save();
            ctx.translate(Math.round(px), Math.round(py));
            ctx.rotate(ang);
            ctx.drawImage(img, -8, -8, 16, 16);
            ctx.restore();
          }
        }
      }
    }
    if (roads.length) schedule();
  };
  const schedule = () => {
    if (!raf && !stopped) raf = requestAnimationFrame(draw);
  };
  const onMove = () => schedule();
  map.on('move', onMove);
  map.on('moveend', onMove);
  map.on('idle', onMove);
  loading.then(schedule);
  schedule();
  return () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    map.off('move', onMove);
    map.off('moveend', onMove);
    map.off('idle', onMove);
    canvas.remove();
  };
}
