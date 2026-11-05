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
// Spec 009 (calibração de 03/11 com prints reais): vias menores só aparecem de perto e finas,
// senão a cidade vira um emaranhado de areia no zoom médio.
const widthStops = [
  { zoom: 4, widths: [1.2, 0.95, 0.65, 0.25, 0, 0, 0, 0] },
  { zoom: 7, widths: [2.1, 1.7, 1.2, 0.65, 0.3, 0, 0, 0] },
  { zoom: 10, widths: [3.6, 3.0, 2.3, 1.4, 0.8, 0, 0, 0] },
  { zoom: 12, widths: [5.0, 4.2, 3.2, 2.2, 1.3, 0.35, 0.25, 0.25] },
  { zoom: 13, widths: [6.0, 5.0, 3.8, 2.8, 1.8, 0.8, 0.5, 0.5] },
  { zoom: 14, widths: [7.4, 6.2, 4.8, 3.8, 2.6, 1.6, 1.0, 0.9] },
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
        // Meio-fio: cinza do asfalto do pacote, mais escuro nas rodovias.
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk'],
          PALETA.meioFioRodovia,
          PALETA.meioFio,
        ],
        'line-width': roadWidth(true),
        'line-opacity': kind === 'tunnel' ? 0.55 : 1,
      },
    },
    {
      ...base,
      id: `roads-${kind}`,
      paint: {
        // Rodovias em amarelo; avenidas e ruas em asfalto claro; estradas de terra em areia.
        'line-color': [
          'match',
          ['get', 'class'],
          ['motorway', 'trunk'],
          PALETA.rodovia,
          'track',
          PALETA.terra,
          PALETA.rua,
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
      minzoom: 12,
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
        // Faixa central tracejada, como nas pistas do pacote.
        'line-color': PALETA.faixa,
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

/**
 * Cores do mapa, tiradas do MODERN TOWN SET (referência de estilo escolhida pelo Pedro em
 * 05/11/2026): grama clara, asfalto cinza com meio-fio, telhados turquesa, concreto e tijolo.
 */
export const PALETA = {
  grama: '#bfe0a0',
  mata: '#8fcb79',
  parque: '#a6d98a',
  areia: '#eadbb9',
  agua: '#6cc3ea',
  margem: '#a9d8ee',
  rio: '#5bb8e2',
  bairro: '#e6dfcf',
  comercio: '#f0d2bf',
  industria: '#cfc6dc',
  divisa: '#5f8f6a',
  rua: '#f7f5f0',
  meioFio: '#a7a39b',
  meioFioRodovia: '#8d877c',
  rodovia: '#f6d27a',
  faixa: '#ffffff',
  terra: '#d9c49a',
  predioCidade: '#d9d3c6',
  contornoCidade: '#bdb5a5',
} as const;

/** Mapa do jogo: cidade de brinquedo sobre a geografia real (OpenStreetMap).
 * De longe, campo, mata, água e estradas; de perto, o contorno dos prédios reais.
 * Estilo local e enxuto: sem estilo remoto, rótulos, sprites ou fontes. */
export function createMapStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'AFTERMARKET · Cidade',
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
      { id: 'background', type: 'background', paint: { 'background-color': PALETA.grama } },
      {
        id: 'natural-landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        // Grama do OSM desenha pistas, campos e canteiros; o chão uniforme evita esse ruído.
        filter: ['match', ['get', 'class'], ['wood', 'sand', 'ice'], true, false],
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'wood',
            PALETA.mata,
            'sand',
            PALETA.areia,
            '#f3f1ea',
          ],
        },
      },
      {
        // Chão de cidade por zona: bairro, comércio e indústria em tons próprios.
        id: 'urban-landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        minzoom: 9,
        filter: [
          'match',
          ['get', 'class'],
          ['residential', 'commercial', 'industrial', 'retail', 'neighbourhood', 'suburb'],
          true,
          false,
        ],
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'industrial',
            PALETA.industria,
            ['commercial', 'retail'],
            PALETA.comercio,
            PALETA.bairro,
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 0.85, 14, 1],
        },
      },
      {
        id: 'parks',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        minzoom: 11,
        filter: ['match', ['get', 'class'], ['park', 'garden', 'grass', 'cemetery'], true, false],
        paint: { 'fill-color': PALETA.parque },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': PALETA.agua },
      },
      {
        id: 'water-outline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: {
          'line-color': PALETA.margem,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 12, 1.4, 16, 2.4],
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
          'line-color': PALETA.rio,
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
          'line-color': PALETA.divisa,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 1.6, 14, 2.2],
          'line-dasharray': [4, 3],
          'line-opacity': 0.7,
        },
      },
      ...roads('tunnel'),
      ...roads('surface'),
      ...roads('bridge'),
      {
        // Prédios reais do OpenStreetMap: contornos planos e discretos, só para dar textura de
        // cidade. Em 3D ficam apenas os negócios do jogo (camada própria em WorldMap).
        id: 'buildings',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-color': PALETA.predioCidade,
          'fill-outline-color': PALETA.contornoCidade,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 0.9],
        },
      },
    ],
  };
}
