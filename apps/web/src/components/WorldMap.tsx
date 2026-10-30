import { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { LocateFixed, RefreshCw, Truck } from 'lucide-react';
import { useGame, CategoryIcon } from '../lib/game';
import {
  categoryInfo,
  products,
  type Position,
  type ProductId,
  type Shipment,
  seasonProducts,
} from '../../../../packages/simulation/src/model';
import { createMapStyle } from '../lib/map-style';
import { positionAlongRoute, routeLengths } from '../../../../packages/simulation/src/geometry';
import { shipmentRoadPath, shipmentRoute } from '../../../../packages/simulation/src/road-path';
import { shipmentStatus } from '../../../../packages/simulation/src/shipment';
import { marketView, regionsOf } from '../../../../packages/simulation/src/metrics';
maplibregl.setWorkerUrl(workerUrl);
// Peças em pixel art desenhadas uma vez como imagens de alta nitidez para o mapa:
// - Negócios construídos usam as miniaturas isométricas reais (/arte/*.png) sobre um pedestal
//   tático chanfrado (com destaque em lavoura/ouro para unidades do próprio jogador).
// - Terrenos disponíveis usam um marco chanfrado compacto com o ícone da vocação.
const categories = ['farm', 'mine', 'industry', 'retail', 'logistics', 'warehouse'] as const;
const categorySpriteUrl: Record<(typeof categories)[number], string> = {
  farm: '/arte/lavoura.png',
  mine: '/arte/mina.png',
  industry: '/arte/siderurgica.png',
  retail: '/arte/loja.png',
  logistics: '/arte/caminhao.png',
  warehouse: '/arte/silos.png',
};

function loadSprite(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadCategoryIcon(category: (typeof categories)[number]): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const markup = renderToStaticMarkup(<CategoryIcon category={category} size={28} />).replaceAll(
      'currentColor',
      '#f3e7cc',
    );
    const svg = markup.includes('xmlns=')
      ? markup
      : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const image = new Image(28, 28);
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function drawChamferedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

const pinImages = Promise.all(
  categories.map(async (category) => {
    const [sprite, icon] = await Promise.all([
      loadSprite(categorySpriteUrl[category]),
      loadCategoryIcon(category),
    ]);
    const color = categoryInfo[category].color;

    const buildBusinessPin = (own: boolean) => {
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      // Sombra dura no chão e ponteiro tático inferior
      ctx.fillStyle = 'rgba(5, 6, 4, 0.65)';
      drawChamferedRect(ctx, 18, 56, 64, 24, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(42, 78);
      ctx.lineTo(54, 78);
      ctx.lineTo(48, 88);
      ctx.closePath();
      ctx.fill();

      // Base chanfrada (pedestal do negócio)
      const borderColor = own ? '#a6e05a' : '#f3e7cc';
      ctx.fillStyle = '#121410';
      drawChamferedRect(ctx, 14, 52, 68, 24, 6);
      ctx.fill();

      ctx.fillStyle = color;
      drawChamferedRect(ctx, 17, 55, 62, 18, 4);
      ctx.fill();

      // Brilho superior do pedestal
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(21, 56, 54, 3);

      // Contorno nítido do pedestal
      ctx.lineWidth = own ? 3 : 2;
      ctx.strokeStyle = borderColor;
      drawChamferedRect(ctx, 15.5, 53.5, 65, 21, 5);
      ctx.stroke();

      // Ponteiro inferior
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.moveTo(41, 75);
      ctx.lineTo(55, 75);
      ctx.lineTo(48, 85);
      ctx.closePath();
      ctx.fill();

      // Miniatura isométrica em pixel art
      if (sprite) {
        const scale = Math.min(68 / sprite.width, 56 / sprite.height);
        const w = Math.round(sprite.width * scale);
        const h = Math.round(sprite.height * scale);
        const x = Math.round((size - w) / 2);
        const y = Math.round(64 - h);
        ctx.drawImage(sprite, x, y, w, h);
      } else if (icon) {
        ctx.drawImage(icon, 34, 36, 28, 28);
      }

      // Flâmula/insígnia para as unidades da própria empresa
      if (own) {
        ctx.fillStyle = '#121410';
        drawChamferedRect(ctx, 62, 10, 24, 16, 3);
        ctx.fill();
        ctx.fillStyle = '#a6e05a';
        drawChamferedRect(ctx, 64, 12, 20, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#121410';
        ctx.font = '700 9px Archivo, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SEU', 74, 18.5);
      }

      return ctx.getImageData(0, 0, size, size);
    };

    const buildAvailablePin = () => {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      // Sombra dura
      ctx.fillStyle = 'rgba(5, 6, 4, 0.6)';
      drawChamferedRect(ctx, 14, 14, 40, 36, 6);
      ctx.fill();

      // Moldura chanfrada escura com barra da cor da vocação
      ctx.fillStyle = '#1a1d17';
      drawChamferedRect(ctx, 11, 11, 40, 36, 6);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.fillRect(14, 39, 34, 5);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#cfc6b4';
      drawChamferedRect(ctx, 12, 12, 38, 34, 5);
      ctx.stroke();

      // Ponteiro inferior
      ctx.fillStyle = '#cfc6b4';
      ctx.beginPath();
      ctx.moveTo(26, 46);
      ctx.lineTo(36, 46);
      ctx.lineTo(31, 54);
      ctx.closePath();
      ctx.fill();

      if (icon) {
        ctx.drawImage(icon, 19, 15, 24, 24);
      }
      return ctx.getImageData(0, 0, size, size);
    };

    return [
      [`pin-${category}-own`, buildBusinessPin(true)],
      [`pin-${category}-rival`, buildBusinessPin(false)],
      [`pin-${category}-available`, buildAvailablePin()],
    ] as const;
  }),
);
export interface Layers {
  companies: boolean;
  available: boolean;
  resources: boolean;
  demand: boolean;
  zoning: boolean;
  routes: boolean;
}
export const defaultLayers: Layers = {
  companies: true,
  available: true,
  resources: true,
  demand: false,
  zoning: false,
  routes: false,
};
export function WorldMap({
  mini = false,
  propertyId,
  layers = defaultLayers,
  route,
  center,
  onSelect,
  ownership = '',
  shipment,
  shipments: shipmentGroup,
  highlightShipmentId,
  economic,
  onRegionSelect,
}: {
  mini?: boolean;
  propertyId?: string;
  layers?: Layers;
  route?: Position[];
  center?: Position[] | Position;
  onSelect?: (id: string) => void;
  ownership?: '' | 'mine' | 'others' | 'available';
  shipment?: Shipment;
  shipments?: Shipment[];
  highlightShipmentId?: string;
  economic?: {
    product?: ProductId;
    metric: 'price' | 'demand' | 'stock' | 'coverage';
    radiusKm?: number;
    state?: string;
  };
  onRegionSelect?: (id: string) => void;
}) {
  const { world, actor, selectedId, select, focus, consumeFocus } = useGame();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const callback = useRef(onSelect);
  const framedRoute = useRef('');
  const framedEconomy = useRef<string | undefined>(undefined);
  const drawnKey = useRef('');
  const selectRef = useRef(select);
  callback.current = onSelect;
  selectRef.current = select;
  const visible = useMemo(
    () =>
      (economic ? [] : world.properties)
        .filter((p) =>
          ownership === 'mine'
            ? p.ownerId === actor
            : ownership === 'others'
              ? Boolean(p.ownerId) && p.ownerId !== actor
              : ownership === 'available'
                ? !p.ownerId
                : true,
        )
        .filter((p) =>
          p.ownerId
            ? layers.companies &&
              (layers.resources || (p.category !== 'farm' && p.category !== 'mine'))
            : layers.available,
        ),
    [
      world.properties,
      ownership,
      actor,
      layers.companies,
      layers.resources,
      layers.available,
      Boolean(economic),
    ],
  );
  useEffect(() => {
    let saved: { center?: Position; zoom?: number } = {};
    try {
      saved = JSON.parse(localStorage.getItem('aftermarket.camera') ?? '{}');
    } catch {
      /* posição padrão */
    }
    const p = world.properties.find((x) => x.id === propertyId);
    const initial = center && typeof center[0] === 'number' ? (center as Position) : p?.coordinates;
    const instance = new maplibregl.Map({
      container: container.current!,
      style: createMapStyle(),
      center: initial ?? (!mini ? saved.center : undefined) ?? [-47.31, -22.88],
      zoom: p ? (mini ? 13.3 : 10.65) : !mini ? (saved.zoom ?? 10.05) : 9.5,
      minZoom: 3.5,
      maxZoom: 17,
      attributionControl: { compact: true },
      interactive: !mini,
      renderWorldCopies: false,
    });
    map.current = instance;
    // Inspeção em desenvolvimento (laboratório e testes de navegador); não existe no build final.
    if (import.meta.env.DEV && !mini)
      (window as unknown as { aftermarketMap?: maplibregl.Map }).aftermarketMap = instance;
    const timeout = setTimeout(() => {
      if (!instance.isStyleLoaded()) setFailed(true);
    }, 15000);
    // Placas chanfradas de agrupamento (clusters) em alta definição com estética de jogo.
    const countImage = (label: string) => {
      const size = 76;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d')!;
      context.imageSmoothingEnabled = false;
      // Sombra dura
      context.fillStyle = 'rgba(5, 6, 4, 0.7)';
      drawChamferedRect(context, 12, 14, 54, 52, 8);
      context.fill();
      // Placa tática grafite com chanfro
      context.fillStyle = '#1a1d17';
      drawChamferedRect(context, 9, 10, 54, 52, 8);
      context.fill();
      context.fillStyle = '#282d23';
      context.fillRect(14, 14, 44, 5);
      // Aro duplo dourado
      context.lineWidth = 2.5;
      context.strokeStyle = '#f2bd3c';
      drawChamferedRect(context, 10.5, 11.5, 51, 49, 7);
      context.stroke();
      // Número nítido
      context.fillStyle = '#f3e7cc';
      context.font = `700 ${label.length > 2 ? 20 : 24}px "Geist Pixel Square", Archivo, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 36, 37);
      return context.getImageData(0, 0, size, size);
    };
    // Placas táticas com o nome das cidades do mundo para orientar a leitura das estradas.
    const cityImage = (name: string) => {
      const canvas = document.createElement('canvas');
      const padX = 16;
      const font = '700 22px Archivo, "Segoe UI", sans-serif';
      const probe = canvas.getContext('2d')!;
      probe.font = font;
      const textW = Math.ceil(probe.measureText(name).width);
      const w = textW + padX * 2 + 16;
      const h = 42;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(12, 14, 10, 0.82)';
      drawChamferedRect(ctx, 2, 4, w - 4, h - 8, 5);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(242, 189, 60, 0.55)';
      drawChamferedRect(ctx, 2.75, 4.75, w - 5.5, h - 9.5, 4);
      ctx.stroke();
      // Quadradinho de mira dourado
      ctx.fillStyle = '#f2bd3c';
      ctx.fillRect(11, Math.round(h / 2) - 4, 8, 8);
      ctx.fillStyle = '#f3e7cc';
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 25, Math.round(h / 2) + 1);
      return ctx.getImageData(0, 0, w, h);
    };
    // Texturas pixel-art nítidas (escala inteira) para água e florestas, sem borrar as estradas.
    const createWaterPattern = () => {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#122932';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#1a3b47';
      ctx.fillRect(4, 6, 8, 2);
      ctx.fillRect(2, 8, 4, 2);
      ctx.fillRect(12, 8, 4, 2);
      ctx.fillRect(20, 22, 8, 2);
      ctx.fillRect(18, 24, 4, 2);
      ctx.fillRect(28, 24, 4, 2);
      return ctx.getImageData(0, 0, size, size);
    };
    const createWoodPattern = () => {
      const size = 24;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#202a19';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#2a3821';
      ctx.fillRect(3, 3, 4, 4);
      ctx.fillRect(5, 1, 2, 2);
      ctx.fillRect(15, 13, 4, 4);
      ctx.fillRect(17, 11, 2, 2);
      ctx.fillStyle = '#192113';
      ctx.fillRect(3, 7, 4, 2);
      ctx.fillRect(15, 17, 4, 2);
      return ctx.getImageData(0, 0, size, size);
    };
    instance.on('load', async () => {
      clearTimeout(timeout);
      setFailed(false);
      if (!instance.hasImage('water-pixel'))
        instance.addImage('water-pixel', createWaterPattern(), { pixelRatio: 1 });
      if (!instance.hasImage('wood-pixel'))
        instance.addImage('wood-pixel', createWoodPattern(), { pixelRatio: 1 });
      if (instance.getLayer('water'))
        instance.setPaintProperty('water', 'fill-pattern', 'water-pixel');
      if (instance.getLayer('natural-landcover'))
        instance.setPaintProperty('natural-landcover', 'fill-pattern', 'wood-pixel');
      for (const group of await pinImages)
        for (const [id, image] of group)
          if (!instance.hasImage(id)) instance.addImage(id, image, { pixelRatio: 2 });
      for (let n = 2; n <= 100; n++) {
        const label = n === 100 ? '99+' : String(n);
        if (!instance.hasImage(`count-${label}`))
          instance.addImage(`count-${label}`, countImage(label), { pixelRatio: 2 });
      }
      const regions = regionsOf(world);
      for (const r of regions) {
        const key = `city-${r.id}`;
        if (!instance.hasImage(key)) instance.addImage(key, cityImage(r.name), { pixelRatio: 2 });
      }
      instance.addSource('cities', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: regions.map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: r.coordinates },
            properties: { id: r.id, name: r.name },
          })),
        },
      });
      instance.addLayer({
        id: 'city-labels',
        type: 'symbol',
        source: 'cities',
        minzoom: mini ? 20 : 5.2,
        layout: {
          'icon-image': ['concat', 'city-', ['get', 'id']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5.2, 0.72, 9, 0.88, 13, 1],
          'icon-offset': [0, -18],
          'icon-allow-overlap': false,
          'icon-padding': 6,
        },
      });
      instance.addSource('territories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // Terrenos só aparecem de perto; de longe são milhares de polígonos sem leitura.
      instance.addLayer({
        id: 'territories-fill',
        type: 'fill',
        source: 'territories',
        minzoom: mini ? 0 : 11,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
      });
      instance.addLayer({
        id: 'territories-line',
        type: 'line',
        source: 'territories',
        minzoom: mini ? 0 : 11,
        paint: {
          'line-color': ['case', ['get', 'selected'], '#a6e05a', ['get', 'color']],
          'line-width': ['case', ['get', 'selected'], 3, 1.4],
          'line-opacity': 0.9,
        },
      });
      instance.addSource('demand', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: regions.map((r) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: r.coordinates },
            properties: { demand: 0 },
          })),
        },
      });
      instance.addLayer({
        id: 'demand-circles',
        type: 'circle',
        source: 'demand',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'demand'], 0, 8, 1, 80],
          'circle-color': '#f2bd3c',
          'circle-opacity': 0.28,
          'circle-blur': 0.6,
        },
      });
      instance.addSource('routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        paint: { 'line-color': '#0c0e0a', 'line-width': mini ? 7 : 9 },
      });
      instance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'routes',
        paint: { 'line-color': '#6cb8e8', 'line-width': mini ? 3.5 : 4.5 },
      });
      instance.addSource('traveled', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: 'traveled-line',
        type: 'line',
        source: 'traveled',
        paint: { 'line-color': '#a6e05a', 'line-width': 5 },
      });
      // Negócios: miniaturas pixel-art nítidas sobre o mapa, agrupadas em placas quando o zoom é baixo.
      instance.addSource('properties', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: !mini,
        clusterRadius: 44,
        clusterMaxZoom: 8,
      });
      instance.addLayer({
        id: 'property-clusters',
        type: 'circle',
        source: 'properties',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': 20,
          'circle-color': '#1a1d17',
          'circle-opacity': 0.01,
        },
      });
      instance.addLayer({
        id: 'property-cluster-count',
        type: 'symbol',
        source: 'properties',
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': [
            'case',
            ['>', ['get', 'point_count'], 99],
            'count-99+',
            ['concat', 'count-', ['to-string', ['get', 'point_count']]],
          ],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      instance.addLayer({
        id: 'property-halo',
        type: 'circle',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': mini ? 14 : ['case', ['get', 'selected'], 28, 22],
          'circle-color': [
            'case',
            ['get', 'selected'],
            '#a6e05a',
            ['get', 'own'],
            '#f2bd3c',
            '#0c0e0a',
          ],
          'circle-opacity': ['case', ['get', 'selected'], 0.45, ['get', 'own'], 0.25, 0],
          'circle-stroke-width': ['case', ['get', 'selected'], 2.5, 0],
          'circle-stroke-color': '#a6e05a',
        },
      });
      instance.addLayer({
        id: 'property-dots',
        type: 'circle',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': mini ? 12 : 20,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.01,
        },
      });
      instance.addLayer({
        id: 'property-icons',
        type: 'symbol',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': [
            'concat',
            'pin-',
            ['get', 'category'],
            '-',
            ['case', ['get', 'available'], 'available', ['get', 'own'], 'own', 'rival'],
          ],
          'icon-size': mini
            ? 0.72
            : [
                'interpolate',
                ['linear'],
                ['zoom'],
                6,
                ['case', ['get', 'available'], 0.7, 0.78],
                10,
                ['case', ['get', 'selected'], 1.12, ['get', 'available'], 0.88, 0.96],
                14,
                ['case', ['get', 'selected'], 1.22, ['get', 'available'], 1.0, 1.08],
              ],
          'icon-offset': [0, -10],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });
      if (!mini) {
        const pick = (event: maplibregl.MapLayerMouseEvent) => {
          const id = event.features?.[0]?.properties?.id as string | undefined;
          if (!id) return;
          event.originalEvent.stopPropagation();
          callback.current ? callback.current(id) : selectRef.current(id);
        };
        const expandCluster = async (event: maplibregl.MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const zoom = await (
            instance.getSource('properties') as GeoJSONSource
          ).getClusterExpansionZoom(feature.properties!.cluster_id as number);
          instance.easeTo({
            center: (feature.geometry as { coordinates: [number, number] }).coordinates,
            zoom,
            duration: 500,
          });
        };
        instance.on('click', 'property-dots', pick);
        instance.on('click', 'property-icons', pick);
        instance.on('click', 'property-clusters', expandCluster);
        instance.on('click', 'property-cluster-count', expandCluster);
        for (const layer of [
          'property-dots',
          'property-icons',
          'property-clusters',
          'property-cluster-count',
        ]) {
          instance.on('mouseenter', layer, () => (instance.getCanvas().style.cursor = 'pointer'));
          instance.on('mouseleave', layer, () => (instance.getCanvas().style.cursor = ''));
        }
      }
      setReady(true);
    });
    if (!mini) {
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      instance.addControl(
        new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }),
        'bottom-right',
      );
      instance.on('moveend', () =>
        localStorage.setItem(
          'aftermarket.camera',
          JSON.stringify({ center: instance.getCenter().toArray(), zoom: instance.getZoom() }),
        ),
      );
    }
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current!);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const selectedProperty = propertyId ?? selectedId;
    // Só reenvia ao mapa quando algo visível mudou (dono, seleção, filtro), não a cada rodada.
    const key = JSON.stringify([
      visible.map((p) => [p.id, p.ownerId, p.area]),
      selectedProperty,
      layers.zoning,
    ]);
    if (drawnKey.current === key) return;
    drawnKey.current = key;
    (m.getSource('territories') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: visible.map((p) => {
        const side = Math.sqrt(p.area) / 111320,
          x = side / Math.cos((p.coordinates[1] * Math.PI) / 180) / 2,
          y = side / 2;
        return {
          type: 'Feature',
          properties: {
            color: layers.zoning
              ? p.ownerId
                ? '#6ba075'
                : '#799ac0'
              : categoryInfo[p.category].color,
            selected: p.id === selectedProperty,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [p.coordinates[0] - x, p.coordinates[1] - y],
                [p.coordinates[0] + x, p.coordinates[1] - y],
                [p.coordinates[0] + x, p.coordinates[1] + y],
                [p.coordinates[0] - x, p.coordinates[1] + y],
                [p.coordinates[0] - x, p.coordinates[1] - y],
              ],
            ],
          },
        };
      }),
    });
    (m.getSource('properties') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: visible.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: p.coordinates },
        properties: {
          id: p.id,
          category: p.category,
          color: categoryInfo[p.category].color,
          available: !p.ownerId,
          own: p.ownerId === actor,
          selected: p.id === selectedProperty,
        },
      })),
    });
  }, [ready, visible, layers.zoning, selectedId, propertyId, actor]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty('demand-circles', 'visibility', layers.demand ? 'visible' : 'none');
    if (!layers.demand) return;
    const values = regionsOf(world).map((r) => ({
      r,
      amount: seasonProducts(world).reduce(
        (n, id) => n + marketView(world, id, r.id).demand * world.season.config.basePrices[id],
        0,
      ),
    }));
    const max = Math.max(1, ...values.map((v) => v.amount));
    (m.getSource('demand') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: values.map(({ r, amount }) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: r.coordinates },
        properties: { demand: amount / max },
      })),
    });
  }, [ready, layers.demand, world.revision]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const lines: Position[][] =
      route && route.length > 1
        ? [route]
        : layers.routes
          ? world.shipments
              .filter(
                (s) =>
                  !s.delivered &&
                  // D-036: só caminho de estrada confirmado; a estimativa riscaria retas no mapa.
                  Boolean(shipmentRoadPath(world, s)) &&
                  (ownership !== 'mine' ||
                    s.buyerId === actor ||
                    s.sellerId === actor ||
                    s.carrierId === actor),
              )
              .map((s) => shipmentRoute(world, s))
          : [];
    (m.getSource('routes') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: lines.map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
    });
    if (lines.length) {
      const key = JSON.stringify(lines.map((path) => [path[0], path.at(-1), path.length]));
      if (framedRoute.current !== key) {
        const bounds = new maplibregl.LngLatBounds();
        lines.forEach((path) => path.forEach((p) => bounds.extend(p)));
        m.fitBounds(bounds, {
          padding: mini ? 30 : shipmentGroup ? 90 : 65,
          maxZoom: 12,
          duration: 500,
        });
        framedRoute.current = key;
      }
    }
  }, [ready, route, layers.routes, world.shipments, ownership, actor, Boolean(shipmentGroup)]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || mini || economic) return;
    const items =
      shipmentGroup ??
      (shipment
        ? [shipment]
        : layers.routes
          ? world.shipments.filter(
              (s) =>
                !s.delivered &&
                (ownership !== 'mine' || [s.buyerId, s.sellerId, s.carrierId].includes(actor)),
            )
          : []);
    const moving = items
      .filter((s) => Boolean(shipmentRoadPath(world, s)))
      .map((s) => {
        const path = shipmentRoute(world, s);
        const element = document.createElement('div');
        element.className = `shipment-truck${shipmentGroup ? ' grouped' : ''}`;
        element.tabIndex = 0;
        element.setAttribute('role', 'img');
        element.dataset.shipmentId = s.id;
        element.innerHTML = renderToStaticMarkup(<Truck size={20} />);
        const marker = new maplibregl.Marker({ element }).setLngLat(path[0]).addTo(m);
        return { s, path, lengths: routeLengths(path), element, marker };
      });
    if (highlightShipmentId) {
      const selected = moving.find((item) => item.s.id === highlightShipmentId);
      if (selected)
        m.flyTo({
          center: positionAlongRoute(
            selected.path,
            shipmentStatus(selected.s, Date.now()).progress,
            selected.lengths,
          ).position,
          zoom: Math.max(m.getZoom(), 11),
          duration: 500,
        });
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0,
      last = 0;
    const draw = (timestamp: number) => {
      // Cinco quadros por segundo bastam para o caminhão andar liso na escala do mapa.
      if (timestamp - last >= (reduced ? 1000 : 200) && !document.hidden) {
        const features: {
          type: 'Feature';
          properties: Record<string, never>;
          geometry: { type: 'LineString'; coordinates: Position[] };
        }[] = [];
        for (const item of moving) {
          const status = shipmentStatus(item.s, Date.now()),
            point = positionAlongRoute(item.path, status.progress, item.lengths);
          item.marker.setLngLat(point.position);
          item.element.classList.toggle('focused', item.s.id === highlightShipmentId);
          const icon = item.element.querySelector('svg');
          if (icon)
            (icon as SVGElement).style.transform = 'rotate(' + (point.bearing - 90) + 'deg)';
          item.element.dataset.progress = status.progress.toFixed(4);
          item.element.dataset.longitude = String(point.position[0]);
          item.element.dataset.latitude = String(point.position[1]);
          item.element.dataset.routeSource =
            item.s.mapRouteSource ?? item.s.routeSource ?? 'estimate';
          item.element.classList.toggle('delivered', item.s.delivered);
          item.element.title = `${world.vehicles.find((v) => v.id === item.s.vehicleId)?.name ?? item.s.vehicleId} · ${status.phase} · ${Math.round(status.progress * 100)}% do trajeto · ${item.s.quantity} ${products[item.s.product].unit} de ${products[item.s.product].name}`;
          item.element.setAttribute('aria-label', item.element.title);
          if (point.completed.length > 1)
            features.push({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: point.completed },
            });
        }
        (m.getSource('traveled') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
        last = timestamp;
      }
      frame = requestAnimationFrame(draw);
    };
    if (moving.length) frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      moving.forEach((item) => item.marker.remove());
      if (map.current === m)
        (m.getSource('traveled') as GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: [],
        });
    };
  }, [
    ready,
    shipment,
    shipmentGroup,
    highlightShipmentId,
    world.shipments,
    layers.routes,
    ownership,
    actor,
    Boolean(economic),
    mini,
  ]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !economic) return;
    const values = regionsOf(world)
      .filter((r) => !economic.state || r.state === economic.state)
      .map((r) => {
        const rows = economic.product
          ? [marketView(world, economic.product, r.id, economic.radiusKm)]
          : seasonProducts(world).map((id) => marketView(world, id, r.id, economic.radiusKm));
        const value =
          economic.metric === 'price'
            ? rows[0].price
            : economic.metric === 'stock'
              ? economic.product
                ? rows[0].stock
                : rows.reduce((n, x) => n + x.stock * (x.price ?? 0), 0)
              : economic.metric === 'coverage'
                ? rows
                    .filter((x) => x.coverageDays !== null)
                    .reduce((n, x) => n + Math.min(30, x.coverageDays!), 0) /
                  Math.max(1, rows.filter((x) => x.coverageDays !== null).length)
                : economic.product
                  ? rows[0].demand
                  : rows.reduce(
                      (n, x) =>
                        n + x.demand * (x.price ?? world.season.config.basePrices[x.product]),
                      0,
                    );
        return { region: r, value: value ?? 0, missing: value === null };
      });
    const max = Math.max(...values.map((v) => v.value), 1);
    const frameKey = economic.state ?? '';
    if (framedEconomy.current !== frameKey && values.length) {
      const bounds = new maplibregl.LngLatBounds();
      values.forEach((v) => bounds.extend(v.region.coordinates));
      m.fitBounds(bounds, { padding: 65, maxZoom: 10, duration: 0 });
      framedEconomy.current = frameKey;
    }
    const format = (value: number, missing = false) => {
      const money =
        economic.metric === 'price' || (!economic.product && economic.metric !== 'coverage');
      return missing
        ? 'Sem oferta'
        : money
          ? (value / 100).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 2,
            })
          : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${economic.metric === 'coverage' ? 'dias' : products[economic.product!].unit}`;
    };
    let bubbles: maplibregl.Marker[] = [];
    const draw = () => {
      bubbles.forEach((b) => b.remove());
      const groups: { items: typeof values; point: maplibregl.Point }[] = [];
      for (const item of [...values].sort((a, b) => b.value - a.value)) {
        const point = m.project(item.region.coordinates);
        const near = groups.find(
          (g) => Math.abs(g.point.x - point.x) < 135 && Math.abs(g.point.y - point.y) < 60,
        );
        if (near) near.items.push(item);
        else groups.push({ items: [item], point });
      }
      bubbles = groups.map(({ items }) => {
        const first = items[0],
          element = document.createElement('button');
        element.className = 'economic-bubble';
        element.style.setProperty('--intensity', String(0.2 + (0.75 * first.value) / max));
        const name = document.createElement('strong'),
          label = document.createElement('span');
        name.textContent =
          items.length === 1
            ? first.region.name
            : `${first.region.name} +${items.length - 1} praças`;
        label.textContent =
          items.length === 1 ? format(first.value, first.missing) : 'Aproximar para comparar';
        element.append(name, label);
        element.title = items
          .map((i) => `${i.region.name}: ${format(i.value, i.missing)}`)
          .join('\n');
        element.setAttribute('aria-label', `${name.textContent}: ${label.textContent}`);
        element.addEventListener('click', () => {
          if (items.length === 1) onRegionSelect?.(first.region.id);
          else {
            const bounds = new maplibregl.LngLatBounds();
            items.forEach((i) => bounds.extend(i.region.coordinates));
            m.fitBounds(bounds, {
              padding: 80,
              maxZoom: Math.min(12, m.getZoom() + 2.5),
              duration: 500,
            });
          }
        });
        return new maplibregl.Marker({ element }).setLngLat(first.region.coordinates).addTo(m);
      });
    };
    draw();
    m.on('moveend', draw);
    return () => {
      m.off('moveend', draw);
      bubbles.forEach((b) => b.remove());
    };
  }, [
    ready,
    economic?.product,
    economic?.metric,
    economic?.radiusKm,
    economic?.state,
    world.revision,
  ]);
  useEffect(() => {
    if (ready && focus && !mini) {
      map.current?.flyTo({ center: focus, zoom: 11, duration: 900 });
      consumeFocus();
    }
  }, [focus, ready, mini, consumeFocus]);
  return (
    <div className={`world-map ${mini ? 'mini-map' : ''}`} data-map-ready={ready}>
      <div ref={container} className="map-canvas" />
      {/* Acesso por teclado e leitor de tela: os ícones são desenhados pelo mapa, então cada
          negócio também é um botão que só aparece quando recebe foco. */}
      {!mini && !economic && (
        <div className="map-access" role="group" aria-label="Negócios no mapa">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              data-property={p.id}
              data-owner={p.ownerId ?? 'available'}
              onClick={() => (callback.current ? callback.current(p.id) : select(p.id))}
            >
              {p.name} · {p.city}
              {p.ownerId ? '' : ' · disponível'}
            </button>
          ))}
        </div>
      )}
      {!ready && !failed && (
        <div className="map-loading" role="status">
          Carregando cartografia…
        </div>
      )}
      {!mini && (
        <button
          className="map-recenter"
          aria-label={
            route || shipmentGroup || layers.routes
              ? 'Ver rota inteira'
              : 'Voltar à região de Campinas'
          }
          title={
            route || shipmentGroup || layers.routes
              ? 'Ver rota inteira'
              : 'Voltar à região de Campinas'
          }
          onClick={() => {
            const selected =
              shipmentGroup ??
              (shipment
                ? [shipment]
                : layers.routes
                  ? world.shipments.filter(
                      (s) =>
                        !s.delivered &&
                        (ownership !== 'mine' ||
                          [s.buyerId, s.sellerId, s.carrierId].includes(actor)),
                    )
                  : []);
            const points = route ?? selected.flatMap((s) => shipmentRoute(world, s));
            if (points.length > 1) {
              const bounds = new maplibregl.LngLatBounds();
              points.forEach((p) => bounds.extend(p));
              map.current?.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 500 });
            } else map.current?.flyTo({ center: [-47.31, -22.88], zoom: 10.05 });
          }}
        >
          <LocateFixed size={19} />
        </button>
      )}
      {failed && (
        <div className="map-error">
          <p>Não foi possível carregar a cartografia.</p>
          <small>A economia continua disponível. Verifique a conexão com a internet.</small>
          <button
            onClick={() => {
              setFailed(false);
              window.location.reload();
            }}
          >
            <RefreshCw size={14} /> Recarregar mapa
          </button>
        </div>
      )}
    </div>
  );
}
