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
  { zoom: 4, widths: [1.2, 0.95, 0.65, 0.25, 0, 0, 0, 0] },
  { zoom: 7, widths: [2.1, 1.7, 1.2, 0.65, 0.3, 0, 0, 0] },
  { zoom: 10, widths: [3.6, 3.0, 2.3, 1.6, 1.05, 0.45, 0, 0] },
  { zoom: 12, widths: [5.0, 4.2, 3.2, 2.4, 1.75, 1.1, 0.65, 0.7] },
  { zoom: 14, widths: [7.4, 6.2, 4.8, 3.8, 3.0, 2.1, 1.45, 1.4] },
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
        // Spec 009: contorno escuro das vias (16-bit), terra para as menores.
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk', 'primary'],
          '#1a2a24',
          ['secondary', 'tertiary'],
          '#8a7d62',
          '#b9a991',
        ],
        'line-width': roadWidth(true),
        'line-opacity': kind === 'tunnel' ? 0.55 : 1,
      },
    },
    {
      ...base,
      id: `roads-${kind}`,
      paint: {
        // Rodovias em ouro, estradas de terra em areia (paleta da referência aprovada).
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk'],
          '#eec156',
          'primary',
          '#d5bb97',
          ['secondary', 'tertiary'],
          '#cdb796',
          '#c9b89a',
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
        'line-color': '#fff6c8',
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
        'line-dasharray': [3, 3],
        'line-opacity': kind === 'tunnel' ? 0.35 : 0.9,
      },
    },
  ];
}

/** Mundo 16-bit (spec 009): campo verde vivo, mata em copas, água clara com margem de areia,
 * rodovias em ouro e estradas de terra. Padrões de pixel entram em WorldMap (addImage).
 * Local, deliberately small basemap. No remote style, labels, sprites or glyphs. */
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
      { id: 'background', type: 'background', paint: { 'background-color': '#00c369' } },
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
            '#00804c',
            'sand',
            '#d5bb97',
            '#f3e7cc',
          ],
          'fill-opacity': 1,
          'fill-antialias': false,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': '#00a9f8', 'fill-antialias': false },
      },
      {
        id: 'water-outline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: {
          // Margem de areia, como na referência.
          'line-color': '#d5bb97',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 2, 16, 3],
          'line-opacity': 1,
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
          'line-color': '#00a9f8',
          'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 1.2, 12, 2.4, 17, 5],
        },
      },
      {
        id: 'state-boundaries',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: {
          'line-color': '#006c56',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 1.6, 14, 2.2],
          'line-dasharray': [4, 3],
          'line-opacity': 0.8,
        },
      },
      ...roads('tunnel'),
      ...roads('surface'),
      ...roads('bridge'),
    ],
  };
}
