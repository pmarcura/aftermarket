import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

// These values belong to OpenMapTiles' landuse schema, rather than place labels.
// Color and grain illustrate mapped use; they do not assert actual paving.
export const URBAN_LANDUSE_STYLES = [
  {
    classes: ['residential'],
    color: '#8c8c71',
    grain: '#85856b',
    texture: 'urban-residential-pixel',
  },
  {
    classes: [
      'commercial',
      'retail',
      'school',
      'university',
      'kindergarten',
      'college',
      'library',
      'hospital',
    ],
    color: '#9c9278',
    grain: '#948b72',
    texture: 'urban-commercial-pixel',
  },
  {
    classes: ['industrial', 'garages', 'bus_station'],
    color: '#797e72',
    grain: '#73786c',
    texture: 'urban-industrial-pixel',
  },
] as const;

const roadClasses = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'minor',
  'service',
  'track',
];

// Every class uses the same continuous zoom curve in all three strata. A bridge
// or an unnumbered connection must not vanish because its label is unavailable.
const widthStops = [
  { zoom: 4, widths: [1.2, 0.95, 0.65, 0.25, 0, 0, 0, 0] },
  { zoom: 7, widths: [2.1, 1.7, 1.2, 0.65, 0.3, 0, 0, 0] },
  { zoom: 10, widths: [3.6, 3.0, 2.3, 1.6, 1.1, 0.6, 0, 0] },
  { zoom: 12, widths: [5.0, 4.2, 3.2, 2.4, 1.9, 1.5, 1.2, 1.2] },
  { zoom: 14, widths: [7.4, 6.2, 4.8, 3.8, 3.0, 2.4, 1.8, 1.8] },
  { zoom: 17, widths: [14, 11.8, 9.4, 7.8, 6.4, 4.8, 3.4, 3.1] },
];

function roadWidth(casing = false): ExpressionSpecification {
  return [
    'interpolate',
    ['exponential', 1.2],
    ['zoom'],
    ...widthStops.flatMap(({ zoom, widths }) => [
      zoom,
      [
        'match',
        ['get', 'class'],
        ...roadClasses.flatMap((roadClass, index) => {
          const width = widths[index];
          return [roadClass, casing ? width + Math.min(2.2, width * 0.55) : width];
        }),
        0,
      ],
    ]),
  ] as ExpressionSpecification;
}

function roads(kind: 'tunnel' | 'surface' | 'bridge'): LayerSpecification[] {
  const filter: FilterSpecification = [
    'all',
    ['==', ['geometry-type'], 'LineString'],
    ['match', ['get', 'class'], roadClasses, true, false],
    kind === 'surface'
      ? ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], false, true]
      : ['==', ['get', 'brunnel'], kind],
  ];
  const base = {
    type: 'line' as const,
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom: 4,
    filter,
    layout: {
      'line-cap': 'round' as const,
      'line-join': 'round' as const,
      'line-sort-key': [
        '+',
        ['*', ['to-number', ['get', 'layer'], 0], 10],
        [
          'match',
          ['get', 'class'],
          'motorway',
          8,
          'trunk',
          7,
          'primary',
          6,
          'secondary',
          5,
          'tertiary',
          4,
          1,
        ],
      ] as ExpressionSpecification,
    },
  };
  return [
    {
      ...base,
      id: `roads-${kind}-casing`,
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk'],
          '#344632',
          ['primary', 'secondary'],
          '#344632',
          'track',
          '#49543b',
          '#48573e',
        ],
        'line-width': roadWidth(true),
        'line-opacity': kind === 'tunnel' ? 0.55 : 0.95,
      },
    },
    {
      ...base,
      id: `roads-${kind}`,
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          'motorway',
          '#e5b967',
          'trunk',
          '#d9b56b',
          'primary',
          '#e1c998',
          'secondary',
          '#d0c398',
          'tertiary',
          '#c0b992',
          'track',
          '#b4a17a',
          '#b9b28d',
        ],
        'line-width': roadWidth(),
        'line-opacity': kind === 'tunnel' ? 0.72 : 1,
      },
    },
    {
      type: 'line' as const,
      id: `highway-${kind}-spine`,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 7,
      filter: [
        'all',
        ['==', ['geometry-type'], 'LineString'],
        ['match', ['get', 'class'], ['motorway', 'trunk'], true, false],
        kind === 'surface'
          ? ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], false, true]
          : ['==', ['get', 'brunnel'], kind],
      ],
      layout: {
        'line-cap': 'round' as const,
        'line-join': 'round' as const,
      },
      paint: {
        'line-color': '#f3dfa4',
        'line-width': [
          'interpolate',
          ['exponential', 1.2],
          ['zoom'],
          7,
          0.5,
          11,
          1.1,
          14,
          1.8,
          17,
          3.2,
        ],
        'line-opacity': kind === 'tunnel' ? 0.35 : 0.65,
      },
    },
  ];
}

function buildings(): LayerSpecification[] {
  // OpenMapTiles building footprints remain the source of truth. The small,
  // fixed offsets suggest pixel-art volume; they do not assert real heights.
  const base = {
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    filter: [
      'all',
      ['==', ['geometry-type'], 'Polygon'],
      ['!=', ['get', 'hide_3d'], true],
    ] as FilterSpecification,
  };
  // OpenMapTiles render heights are approximations from OSM heights/levels.
  // Six metres is a graphic fallback for missing heights, never gameplay data.
  const height: ExpressionSpecification = [
    'max',
    0,
    ['to-number', ['coalesce', ['get', 'render_height'], 6], 6],
  ];
  return [
    {
      ...base,
      id: 'building-shadow',
      type: 'fill',
      paint: {
        'fill-color': '#344632',
        'fill-opacity': 0.28,
        'fill-translate': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13,
          ['literal', [2, 3]],
          19,
          ['literal', [7, 9]],
        ],
        'fill-translate-anchor': 'viewport',
        'fill-antialias': false,
      },
    },
    {
      ...base,
      id: 'building-walls',
      type: 'fill',
      paint: {
        'fill-color': '#765b47',
        'fill-translate': [0, 2],
        'fill-translate-anchor': 'viewport',
        'fill-antialias': false,
      },
    },
    {
      ...base,
      id: 'building-roofs',
      type: 'fill',
      paint: { 'fill-color': '#c99770', 'fill-antialias': false },
    },
    {
      ...base,
      id: 'building-roof-edges',
      type: 'line',
      paint: { 'line-color': '#e0bb8b', 'line-width': 1 },
    },
    {
      ...base,
      id: 'building-volumes',
      type: 'fill-extrusion',
      minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#d4ac81',
        'fill-extrusion-height': height,
        'fill-extrusion-base': [
          'max',
          0,
          ['min', height, ['to-number', ['coalesce', ['get', 'render_min_height'], 0], 0]],
        ],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ];
}

interface BuildingPerspectiveMap {
  getPitch(): number;
  getZoom(): number;
  getLayer(id: string): unknown;
  setLayoutProperty(id: string, property: 'visibility', value: 'visible' | 'none'): unknown;
}

const buildingPerspective = new WeakMap<BuildingPerspectiveMap, string>();

/** Keep the readable flat representation until tilted buildings have enough detail. */
export function syncBuildingPerspective(map: BuildingPerspectiveMap, detailed = false) {
  if (!map.getLayer('building-volumes')) return;
  const volumes = map.getPitch() >= 15 && map.getZoom() >= 14;
  const mode = detailed ? 'detailed' : volumes ? 'volumes' : 'flat';
  if (buildingPerspective.get(map) === mode) return;
  buildingPerspective.set(map, mode);
  map.setLayoutProperty(
    'building-volumes',
    'visibility',
    volumes && !detailed ? 'visible' : 'none',
  );
  for (const id of ['building-shadow', 'building-walls', 'building-roofs', 'building-roof-edges'])
    if (map.getLayer(id))
      map.setLayoutProperty(
        id,
        'visibility',
        detailed && id === 'building-shadow' ? 'visible' : volumes || detailed ? 'none' : 'visible',
      );
}

/** Atlas pixel: a arte muda, as geometrias reais de água, matas e estradas permanecem.
 * Construções usam footprints reais; sem aeroportos, rótulos ou fontes remotas. */
export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'AFTERMARKET · Atlas pixel',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#607a49' } },
      {
        id: 'urban-landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        minzoom: 9,
        filter: [
          'match',
          ['get', 'class'],
          URBAN_LANDUSE_STYLES.flatMap(({ classes }) => [...classes]),
          true,
          false,
        ],
        paint: {
          // A graphic reading of mapped land use, not a survey of pavement.
          'fill-color': [
            'match',
            ['get', 'class'],
            [...URBAN_LANDUSE_STYLES[0].classes],
            URBAN_LANDUSE_STYLES[0].color,
            ...URBAN_LANDUSE_STYLES.slice(1).flatMap(({ classes, color }) => [[...classes], color]),
            '#797e72',
          ] as ExpressionSpecification,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.2, 13, 0.9],
          'fill-antialias': false,
        },
      },
      {
        id: 'natural-landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        // Grass polygons can trace runways, sports fields and urban landscaping.
        // A uniform ground color avoids bringing those details back as silhouettes.
        filter: ['==', ['get', 'class'], 'wood'],
        paint: {
          'fill-color': '#3f603b',
          'fill-antialias': false,
        },
      },
      {
        id: 'natural-sand',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'sand'],
        paint: { 'fill-color': '#b4a17a', 'fill-antialias': false },
      },
      {
        id: 'natural-ice',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'ice'],
        paint: { 'fill-color': '#c0d0c5', 'fill-antialias': false },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': '#547f8d', 'fill-antialias': false },
      },
      {
        id: 'water-outline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: {
          'line-color': '#9bb7a0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 2, 16, 3],
          'line-opacity': 0.8,
        },
      },
      {
        id: 'waterways',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        filter: [
          'all',
          ['match', ['get', 'class'], ['river', 'canal', 'stream'], true, false],
          ['!=', ['get', 'brunnel'], 'tunnel'],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#547f8d',
          'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.8, 12, 2, 17, 4],
        },
      },
      {
        id: 'state-boundaries',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': '#b4bd92',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 1.6, 14, 2.2],
          'line-dasharray': [4, 3],
          'line-opacity': 0.6,
        },
      },
      ...buildings(),
      ...roads('tunnel'),
      ...roads('surface'),
      ...roads('bridge'),
    ],
  };
}
