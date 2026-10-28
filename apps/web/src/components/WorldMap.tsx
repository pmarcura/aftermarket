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
import { shipmentRoute } from '../../../../packages/simulation/src/road-path';
import { shipmentStatus } from '../../../../packages/simulation/src/shipment';
import { marketView, regionsOf } from '../../../../packages/simulation/src/metrics';
maplibregl.setWorkerUrl(workerUrl);
// Ícones das categorias desenhados uma vez como imagens do mapa (traço branco sobre o círculo
// colorido da camada). Antes cada negócio era um elemento de página recriado a cada rodada e
// reposicionado a cada quadro do zoom.
const categories = ['farm', 'mine', 'industry', 'retail', 'logistics', 'warehouse'] as const;
const iconImages = Promise.all(
  categories.map(
    (category) =>
      new Promise<[string, HTMLImageElement]>((resolve) => {
        const svg = renderToStaticMarkup(<CategoryIcon category={category} size={44} />)
          .replaceAll('currentColor', '#ffffff')
          .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        const image = new Image(44, 44);
        image.onload = () => resolve([category, image]);
        image.onerror = () => resolve([category, image]);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      }),
  ),
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
    // Números das bolhas de agrupamento: o estilo não carrega fontes, então cada número vira
    // uma pequena imagem. Gerados de antemão: criados sob demanda, os de dois algarismos
    // chegavam depois do desenho e a bolha ficava sem número.
    const countImage = (label: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#f4ead7';
      context.font = `700 ${label.length > 2 ? 21 : 26}px Figtree, Inter, Arial, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 32, 34);
      return context.getImageData(0, 0, 64, 64);
    };
    instance.on('load', async () => {
      clearTimeout(timeout);
      setFailed(false);
      for (const [category, image] of await iconImages)
        if (!instance.hasImage(`cat-${category}`))
          instance.addImage(`cat-${category}`, image, { pixelRatio: 2 });
      for (let n = 2; n <= 100; n++) {
        const label = n === 100 ? '99+' : String(n);
        if (!instance.hasImage(`count-${label}`))
          instance.addImage(`count-${label}`, countImage(label), { pixelRatio: 2 });
      }
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
          'line-color': ['case', ['get', 'selected'], '#238cd3', ['get', 'color']],
          'line-width': ['case', ['get', 'selected'], 3, 1.2],
          'line-opacity': 0.85,
        },
      });
      instance.addSource('demand', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: regionsOf(world).map((r) => ({
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
          'circle-color': '#e8ac54',
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
        paint: { 'line-color': '#ffffff', 'line-width': mini ? 6 : 8 },
      });
      instance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'routes',
        paint: { 'line-color': '#2a8ec0', 'line-width': mini ? 3 : 4 },
      });
      instance.addSource('traveled', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: 'traveled-line',
        type: 'line',
        source: 'traveled',
        paint: { 'line-color': '#dfad63', 'line-width': 5 },
      });
      // Negócios: uma camada desenhada pelo mapa, agrupada em bolhas quando o zoom é baixo.
      instance.addSource('properties', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: !mini,
        clusterRadius: 46,
        clusterMaxZoom: 8,
      });
      instance.addLayer({
        id: 'property-clusters',
        type: 'circle',
        source: 'properties',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 17, 10, 21, 40, 27],
          'circle-color': '#163640',
          'circle-stroke-color': '#e6b866',
          'circle-stroke-width': 2,
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
          'circle-radius': mini ? 12 : ['case', ['get', 'selected'], 21, 18],
          'circle-color': [
            'case',
            ['get', 'selected'],
            '#ffffff',
            ['get', 'own'],
            '#e6b866',
            '#0b1418',
          ],
          'circle-opacity': ['case', ['any', ['get', 'selected'], ['get', 'own']], 0.9, 0.35],
        },
      });
      instance.addLayer({
        id: 'property-dots',
        type: 'circle',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': mini ? 9 : 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': ['case', ['get', 'available'], 0.55, 1],
          'circle-stroke-color': ['case', ['get', 'available'], '#f4ead7', '#0b1418'],
          'circle-stroke-width': ['case', ['get', 'available'], 2, 1.2],
        },
      });
      instance.addLayer({
        id: 'property-icons',
        type: 'symbol',
        source: 'properties',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'cat-', ['get', 'category']],
          'icon-size': mini ? 0.6 : 0.82,
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
        instance.on('click', 'property-dots', pick);
        instance.on('click', 'property-clusters', async (event) => {
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
        });
        for (const layer of ['property-dots', 'property-clusters']) {
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
                  (!world.requireRoadRoutes ||
                    s.routeSource === 'osrm' ||
                    s.mapRouteSource === 'osrm') &&
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
      .filter(
        (s) => !world.requireRoadRoutes || s.routeSource === 'osrm' || s.mapRouteSource === 'osrm',
      )
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
