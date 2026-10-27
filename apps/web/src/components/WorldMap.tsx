import { useEffect, useRef, useState } from 'react';
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
} from '../../../../packages/simulation/src/model';
import { regions } from '../../../../packages/world/src/regions';
import { createMapStyle } from '../lib/map-style';
import { positionAlongRoute, routeLengths } from '../../../../packages/simulation/src/geometry';
import { shipmentStatus } from '../../../../packages/simulation/src/shipment';
import { marketView } from '../../../../packages/simulation/src/metrics';
maplibregl.setWorkerUrl(workerUrl);
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
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const callback = useRef(onSelect);
  const framedRoute = useRef('');
  const framedEconomy = useRef<string | undefined>(undefined);
  callback.current = onSelect;
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
    const timeout = setTimeout(() => {
      if (!instance.isStyleLoaded()) setFailed(true);
    }, 15000);
    instance.on('load', () => {
      clearTimeout(timeout);
      setFailed(false);
      instance.addSource('territories', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      instance.addLayer({
        id: 'territories-fill',
        type: 'fill',
        source: 'territories',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
      });
      instance.addLayer({
        id: 'territories-line',
        type: 'line',
        source: 'territories',
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
      markers.current.forEach((m) => m.remove());
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const visible = (economic ? [] : world.properties)
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
      );
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
            selected: p.id === (propertyId ?? selectedId),
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
    m.setLayoutProperty('demand-circles', 'visibility', layers.demand ? 'visible' : 'none');
    if (layers.demand) {
      const values = regions.map((r) => ({
        r,
        amount: (Object.keys(products) as ProductId[]).reduce(
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
    }
    markers.current.forEach((marker) => marker.remove());
    markers.current = visible.map((p) => {
      const node = document.createElement('button');
      node.className = `map-marker ${p.category} ${p.ownerId ? '' : 'available'} ${p.id === (propertyId ?? selectedId) ? 'selected' : ''} ${mini ? 'mini' : ''}`;
      node.setAttribute('aria-label', `${p.name} · ${p.city}${p.ownerId ? '' : ' · disponível'}`);
      node.title = `${p.name} · ${p.city}`;
      node.dataset.owner = p.ownerId ?? 'available';
      node.dataset.property = p.id;
      if (mini) {
        node.tabIndex = -1;
        node.setAttribute('aria-hidden', 'true');
      }
      node.innerHTML = renderToStaticMarkup(
        <CategoryIcon category={p.category} size={mini ? 13 : 21} />,
      );
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        callback.current ? callback.current(p.id) : select(p.id);
      });
      return new maplibregl.Marker({ element: node }).setLngLat(p.coordinates).addTo(m);
    });
  }, [
    ready,
    world.properties,
    layers,
    selectedId,
    propertyId,
    actor,
    ownership,
    Boolean(economic),
  ]);
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
                  (ownership !== 'mine' ||
                    s.buyerId === actor ||
                    s.sellerId === actor ||
                    s.carrierId === actor),
              )
              .map((s) => {
                const origin = world.establishments.find((e) => e.id === s.originId)!,
                  dest = world.establishments.find((e) => e.id === s.destinationId)!;
                return (
                  s.route ??
                  world.routes[`${origin.propertyId}:${dest.propertyId}`]?.coordinates ?? [
                    world.properties.find((p) => p.id === origin.propertyId)!.coordinates,
                    world.properties.find((p) => p.id === dest.propertyId)!.coordinates,
                  ]
                );
              })
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
    const moving = items.map((s) => {
      const origin = world.establishments.find((e) => e.id === s.originId)!,
        dest = world.establishments.find((e) => e.id === s.destinationId)!;
      const path = s.route ??
        world.routes[`${origin.propertyId}:${dest.propertyId}`]?.coordinates ?? [
          world.properties.find((p) => p.id === origin.propertyId)!.coordinates,
          world.properties.find((p) => p.id === dest.propertyId)!.coordinates,
        ];
      const element = document.createElement('div');
      element.className = `shipment-truck${shipmentGroup ? ' grouped' : ''}`;
      element.tabIndex = 0;
      element.setAttribute('role', 'img');
      element.dataset.shipmentId = s.id;
      element.innerHTML = renderToStaticMarkup(<Truck size={20} />);
      const marker = new maplibregl.Marker({ element }).setLngLat(path[0]).addTo(m);
      return { s, path, lengths: routeLengths(path), element, marker };
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0,
      last = 0;
    const draw = (timestamp: number) => {
      if (timestamp - last >= (reduced ? 1000 : 50) && !document.hidden) {
        const features: {
          type: 'Feature';
          properties: Record<string, never>;
          geometry: { type: 'LineString'; coordinates: Position[] };
        }[] = [];
        for (const [index, item] of moving.entries()) {
          const status = shipmentStatus(item.s, Date.now()),
            point = positionAlongRoute(item.path, status.progress, item.lengths);
          item.marker.setLngLat(point.position);
          const columns = Math.min(4, moving.length),
            rows = Math.ceil(moving.length / columns);
          item.element.style.marginLeft = shipmentGroup
            ? `${((index % columns) - (columns - 1) / 2) * 34}px`
            : '0px';
          item.element.style.marginTop = shipmentGroup
            ? `${(Math.floor(index / columns) - (rows - 1) / 2) * 34}px`
            : '0px';
          item.element.dataset.progress = status.progress.toFixed(4);
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
    const values = regions
      .filter((r) => !economic.state || r.state === economic.state)
      .map((r) => {
        const rows = economic.product
          ? [marketView(world, economic.product, r.id, economic.radiusKm)]
          : (Object.keys(products) as ProductId[]).map((id) =>
              marketView(world, id, r.id, economic.radiusKm),
            );
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
      {!ready && !failed && (
        <div className="map-loading" role="status">
          Carregando cartografia…
        </div>
      )}
      {!mini && (
        <button
          className="map-recenter"
          aria-label="Voltar à região de Campinas"
          title="Voltar à região de Campinas"
          onClick={() => map.current?.flyTo({ center: [-47.31, -22.88], zoom: 10.05 })}
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
