import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

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
  { zoom: 4, widths: [0.6, 0.45, 0.3, 0, 0, 0, 0, 0] },
  { zoom: 7, widths: [1.1, 0.9, 0.6, 0.25, 0, 0, 0, 0] },
  { zoom: 10, widths: [2.6, 2.2, 1.6, 1.1, 0.7, 0, 0, 0] },
  { zoom: 12, widths: [3.6, 3.1, 2.2, 1.8, 1.3, 0.8, 0.5, 0.6] },
  { zoom: 14, widths: [5.5, 4.7, 3.6, 3, 2.5, 1.8, 1.3, 1.3] },
  { zoom: 17, widths: [12, 10, 8, 7, 6, 4.6, 3.2, 3] },
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
          return [roadClass, casing ? width + Math.min(1.4, width * 0.4) : width];
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
          '#b9aa86',
          'track',
          '#c3bba6',
          '#b8c0ae',
        ],
        'line-width': roadWidth(true),
        'line-opacity': kind === 'tunnel' ? 0.45 : 0.85,
      },
    },
    {
      ...base,
      id: `roads-${kind}`,
      paint: {
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk'],
          '#efd29b',
          ['primary', 'secondary'],
          '#f4edda',
          'track',
          '#e9e3d3',
          '#fcfbf5',
        ],
        'line-width': roadWidth(),
        'line-opacity': kind === 'tunnel' ? 0.7 : 1,
      },
    },
  ];
}

/** Local, deliberately small basemap. No remote style, labels, sprites or glyphs. */
export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'AFTERMARKET · Estradas e natureza',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
          '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
          'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e6ebdd' } },
      {
        id: 'natural-landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        // Grass polygons can trace runways, sports fields and urban landscaping.
        // A uniform ground color avoids bringing those details back as silhouettes.
        filter: ['match', ['get', 'class'], ['wood', 'sand', 'ice'], true, false],
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'wood',
            '#c5d3b9',
            'sand',
            '#e9dfc5',
            '#edf1ee',
          ],
          'fill-opacity': 0.65,
          'fill-antialias': false,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': '#9fc6d7' },
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
          'line-color': '#9fc6d7',
          'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6, 0.5, 12, 1.2, 17, 3],
        },
      },
      ...roads('tunnel'),
      ...roads('surface'),
      ...roads('bridge'),
    ],
  };
}
