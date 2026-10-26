import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { LocateFixed, RefreshCw } from 'lucide-react';
import { useGame, CategoryIcon } from '../lib/game';
import { categoryInfo, type Position } from '../../../../packages/simulation/src/model';
import { regions } from '../../../../packages/world/src/regions';
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
}: {
  mini?: boolean;
  propertyId?: string;
  layers?: Layers;
  route?: Position[];
  center?: Position[] | Position;
  onSelect?: (id: string) => void;
}) {
  const { world, selectedId, select, focus, consumeFocus } = useGame();
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const callback = useRef(onSelect);
  const framedRoute = useRef('');
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
      style: 'https://tiles.openfreemap.org/styles/bright',
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
      // Paleta própria sobre a cartografia Bright; dados e créditos permanecem do provedor.
      instance.setPaintProperty('background', 'background-color', '#dce2d3');
      for (const id of ['landuse-residential', 'landuse-suburb'])
        instance.setPaintProperty(id, 'fill-color', '#e4e3d9');
      for (const id of ['park', 'landcover-grass', 'landcover-grass-park'])
        instance.setPaintProperty(id, 'fill-color', '#c5d8b9');
      instance.setPaintProperty('landcover-wood', 'fill-color', '#a9c59b');
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
            properties: { demand: r.demand },
          })),
        },
      });
      instance.addLayer({
        id: 'demand-circles',
        type: 'circle',
        source: 'demand',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': 55,
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
    const visible = world.properties.filter((p) =>
      p.ownerId
        ? layers.companies && (layers.resources || (p.category !== 'farm' && p.category !== 'mine'))
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
    markers.current.forEach((marker) => marker.remove());
    markers.current = visible.map((p) => {
      const node = document.createElement('button');
      node.className = `map-marker ${p.category} ${p.ownerId ? '' : 'available'} ${p.id === (propertyId ?? selectedId) ? 'selected' : ''} ${mini ? 'mini' : ''}`;
      node.setAttribute('aria-label', `${p.name} · ${p.city}${p.ownerId ? '' : ' · disponível'}`);
      node.title = `${p.name} · ${p.city}`;
      node.innerHTML = renderToStaticMarkup(
        <CategoryIcon category={p.category} size={mini ? 13 : 21} />,
      );
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        callback.current ? callback.current(p.id) : select(p.id);
      });
      return new maplibregl.Marker({ element: node }).setLngLat(p.coordinates).addTo(m);
    });
  }, [ready, world.properties, layers, selectedId, propertyId]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const lines: Position[][] =
      route && route.length > 1
        ? [route]
        : layers.routes
          ? world.shipments
              .filter((s) => !s.delivered)
              .map((s) => {
                const origin = world.establishments.find((e) => e.id === s.originId)!,
                  dest = world.establishments.find((e) => e.id === s.destinationId)!;
                return (
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
    if (route && route.length > 1) {
      const key = `${route[0].join(',')}:${route[route.length - 1].join(',')}:${route.length}`;
      if (framedRoute.current !== key) {
        const bounds = new maplibregl.LngLatBounds();
        route.forEach((p) => bounds.extend(p));
        m.fitBounds(bounds, { padding: mini ? 30 : 65, maxZoom: 12, duration: 500 });
        framedRoute.current = key;
      }
    }
  }, [ready, route, layers.routes, world.shipments]);
  useEffect(() => {
    if (ready && focus && !mini) {
      map.current?.flyTo({ center: focus, zoom: 11, duration: 900 });
      consumeFocus();
    }
  }, [focus, ready, mini, consumeFocus]);
  return (
    <div className={`world-map ${mini ? 'mini-map' : ''}`} data-map-ready={ready}>
      <div ref={container} className="map-canvas" />
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
