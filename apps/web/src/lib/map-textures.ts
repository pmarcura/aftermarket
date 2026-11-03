import type { ExpressionSpecification } from 'maplibre-gl';
import { URBAN_LANDUSE_STYLES } from './map-style';

type PixelImage = { width: number; height: number; data: Uint8Array };
type Painter = (color: string, x: number, y: number, width: number, height: number) => void;
interface TextureMap {
  hasImage(id: string): boolean;
  addImage(id: string, image: PixelImage, options: { pixelRatio: number }): unknown;
  getLayer(id: string): unknown;
  setPaintProperty(
    id: string,
    property: 'fill-pattern' | 'background-pattern',
    value: string | ExpressionSpecification,
  ): unknown;
}

function texture(size: number, paint: (rect: Painter) => void): PixelImage {
  const data = new Uint8Array(size * size * 4);
  const rect: Painter = (hex, x, y, width, height) => {
    const color = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    for (let row = y; row < y + height; row++) {
      for (let col = x; col < x + width; col++) {
        const offset = (((row + size) % size) * size + ((col + size) % size)) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
      }
    }
  };
  paint(rect);
  return { width: size, height: size, data };
}

const bindings = [
  ['background', 'background-pattern', 'ground-pixel'],
  ['natural-landcover', 'fill-pattern', 'wood-pixel'],
  ['natural-sand', 'fill-pattern', 'sand-pixel'],
  ['natural-ice', 'fill-pattern', 'ice-pixel'],
  ['water', 'fill-pattern', 'water-pixel'],
] as const;

/** Original, deterministic pixel artwork. No image requests or canvas dependency. */
export function createMapTextures(): Record<string, PixelImage> {
  return {
    'ground-pixel': texture(64, (rect) => {
      rect('#607a49', 0, 0, 64, 64);
      // Sparse grass marks leave space for roads and property silhouettes.
      for (const [x, y] of [
        [8, 10],
        [38, 6],
        [22, 38],
        [52, 46],
      ]) {
        rect('#657f4d', x, y, 4, 2);
        rect('#6b8550', x + 2, y - 2, 2, 2);
      }
      for (const [x, y] of [
        [26, 18],
        [2, 50],
        [46, 28],
        [34, 58],
      ])
        rect('#5b7446', x, y, 2, 2);
    }),
    'wood-pixel': texture(128, (rect) => {
      rect('#3f603b', 0, 0, 128, 128);
      // Uneven groups and varied crowns avoid reading as a planted orchard.
      // The pattern remains clipped to the geographic woodland polygons.
      for (const [x, y, width] of [
        [4, 8, 16],
        [24, 14, 20],
        [18, 36, 14],
        [78, 4, 18],
        [96, 24, 14],
        [70, 34, 20],
        [48, 70, 18],
        [62, 92, 20],
        [32, 98, 14],
        [104, 82, 16],
        [116, 106, 20],
      ]) {
        const half = Math.floor(width / 4) * 2;
        rect('#304c33', x + 4, y + half, width, half);
        rect('#507343', x + 2, y + 2, width - 4, half + 2);
        rect('#507343', x, y + 4, width, half - 2);
        rect('#60834a', x + 2, y + 2, half, 4);
        rect('#6a8b4f', x + 4, y, half - 2, 2);
        rect('#45663b', x + width - 6, y + half, 4, 4);
      }
    }),
    'sand-pixel': texture(64, (rect) => {
      rect('#b4a17a', 0, 0, 64, 64);
      for (const [x, y] of [
        [8, 10],
        [40, 4],
        [24, 34],
        [54, 48],
      ]) {
        rect('#c3b08a', x, y, 8, 2);
        rect('#a79571', x + 6, y + 4, 4, 2);
      }
    }),
    'ice-pixel': texture(64, (rect) => {
      rect('#c0d0c5', 0, 0, 64, 64);
      for (const [x, y] of [
        [6, 8],
        [38, 28],
        [16, 48],
      ]) {
        rect('#d7e0d0', x, y, 10, 2);
        rect('#afc3bc', x + 8, y + 2, 4, 2);
      }
    }),
    'water-pixel': texture(128, (rect) => {
      rect('#547f8d', 0, 0, 128, 128);
      for (const [x, y, width] of [
        [8, 12, 10],
        [70, 26, 8],
        [34, 68, 12],
        [102, 94, 8],
        [6, 108, 6],
      ]) {
        rect('#79a4ae', x + 2, y, width, 2);
        rect('#668f9a', x, y + 2, 4, 2);
        rect('#668f9a', x + width + 2, y + 2, 4, 2);
        rect('#4d7785', x + 4, y + 6, width, 2);
      }
    }),
    ...Object.fromEntries(
      URBAN_LANDUSE_STYLES.map(({ texture: id, color, grain }) => [
        id,
        texture(64, (rect) => {
          rect(color, 0, 0, 64, 64);
          // Sparse two-tone grain, not invented paving joints or parking spaces.
          for (const [x, y] of [
            [8, 14],
            [42, 6],
            [28, 40],
            [54, 52],
            [4, 58],
          ])
            rect(grain, x, y, 2, 2);
        }),
      ]),
    ),
  };
}

let registrationTextures: Record<string, PixelImage> | undefined;

export function registerMapTextures(map: TextureMap) {
  // Shared read-only inputs avoid regenerating every pattern for each minimap.
  // The public factory still returns independent data for callers and tests.
  registrationTextures ??= createMapTextures();
  for (const [id, image] of Object.entries(registrationTextures))
    if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 1 });
  // Bind only after every image exists, so the first textured frame is complete.
  for (const [layer, property, image] of bindings)
    if (map.getLayer(layer)) map.setPaintProperty(layer, property, image);
  if (map.getLayer('urban-landuse'))
    map.setPaintProperty('urban-landuse', 'fill-pattern', [
      'match',
      ['get', 'class'],
      [...URBAN_LANDUSE_STYLES[0].classes],
      URBAN_LANDUSE_STYLES[0].texture,
      ...URBAN_LANDUSE_STYLES.slice(1).flatMap(({ classes, texture }) => [[...classes], texture]),
      'urban-industrial-pixel',
    ] as ExpressionSpecification);
}
