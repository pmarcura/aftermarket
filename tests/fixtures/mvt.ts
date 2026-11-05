/**
 * Codificador mínimo de Mapbox Vector Tile (MVT 2.1) para os testes de navegador: gera um tile
 * com uma camada `building` de retângulos (quadras com casas) e uma camada `transportation` com
 * uma rua, para provar as regras do mapa 16-bit sem rede externa.
 */
import { PbfWriter as Pbf } from 'pbf';

const EXTENT = 4096;
const cmd = (id: number, count: number) => (id & 0x7) | (count << 3);
const zig = (n: number) => (n << 1) ^ (n >> 31);

interface Feature {
  id: number;
  type: 2 | 3; // 2 = linha, 3 = polígono
  rings: [number, number][][]; // coordenadas em unidades do tile (0..EXTENT)
  props: Record<string, string | number>;
}

function writeGeometry(f: Feature) {
  const out: number[] = [];
  for (const ring of f.rings) {
    let x = 0,
      y = 0;
    const pts = f.type === 3 ? ring.slice(0, -1) : ring;
    out.push(cmd(1, 1), zig(pts[0][0] - x), zig(pts[0][1] - y));
    x = pts[0][0];
    y = pts[0][1];
    out.push(cmd(2, pts.length - 1));
    for (let i = 1; i < pts.length; i++) {
      out.push(zig(pts[i][0] - x), zig(pts[i][1] - y));
      x = pts[i][0];
      y = pts[i][1];
    }
    if (f.type === 3) out.push(cmd(7, 1));
  }
  return out;
}

function writeLayer(pbf: Pbf, name: string, features: Feature[]) {
  const keys: string[] = [];
  const values: (string | number)[] = [];
  const keyIndex = (k: string) => {
    let i = keys.indexOf(k);
    if (i < 0) {
      keys.push(k);
      i = keys.length - 1;
    }
    return i;
  };
  const valueIndex = (v: string | number) => {
    let i = values.indexOf(v);
    if (i < 0) {
      values.push(v);
      i = values.length - 1;
    }
    return i;
  };
  pbf.writeVarintField(15, 2);
  pbf.writeStringField(1, name);
  for (const f of features) {
    const tags: number[] = [];
    for (const [k, v] of Object.entries(f.props)) tags.push(keyIndex(k), valueIndex(v));
    pbf.writeMessage(
      2,
      (_: unknown, p: Pbf) => {
        p.writeVarintField(1, f.id);
        p.writePackedVarint(2, tags);
        p.writeVarintField(3, f.type);
        p.writePackedVarint(4, writeGeometry(f));
      },
      undefined,
    );
  }
  for (const k of keys) pbf.writeStringField(3, k);
  for (const v of values)
    pbf.writeMessage(
      4,
      (_: unknown, p: Pbf) => {
        if (typeof v === 'string') p.writeStringField(1, v);
        else if (Number.isInteger(v)) p.writeVarintField(5, v);
        else p.writeDoubleField(3, v);
      },
      undefined,
    );
  pbf.writeVarintField(5, EXTENT);
}

/** Tile de teste: uma avenida diagonal e uma malha de quadras com casas de tamanhos variados. */
export function buildingsTile(seed = 1): Uint8Array {
  const buildings: Feature[] = [];
  let id = 1;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647) as number;
  for (let gy = 0; gy < 8; gy++)
    for (let gx = 0; gx < 8; gx++) {
      const x0 = gx * 512 + 40,
        y0 = gy * 512 + 40;
      // lote grande num canto, casas pequenas no resto
      if ((gx + gy) % 5 === 0) {
        buildings.push({
          id: id++,
          type: 3,
          rings: [
            [
              [x0, y0],
              [x0 + 380, y0],
              [x0 + 380, y0 + 220],
              [x0, y0 + 220],
              [x0, y0],
            ],
          ],
          props: { render_height: 20 },
        });
        continue;
      }
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const w = 60 + Math.floor(rnd() * 50),
            h = 50 + Math.floor(rnd() * 40);
          const bx = x0 + i * 110,
            by = y0 + j * 130;
          buildings.push({
            id: id++,
            type: 3,
            rings: [
              [
                [bx, by],
                [bx + w, by],
                [bx + w, by + h],
                [bx, by + h],
                [bx, by],
              ],
            ],
            props: { render_height: 6 },
          });
        }
    }
  const roads: Feature[] = [
    {
      id: 1,
      type: 2,
      rings: [
        [
          [0, 2048],
          [EXTENT, 2048],
        ],
      ],
      props: { class: 'primary' },
    },
    {
      id: 2,
      type: 2,
      rings: [
        [
          [2048, 0],
          [2048, EXTENT],
        ],
      ],
      props: { class: 'minor' },
    },
  ];
  const tile = new Pbf();
  tile.writeMessage(3, (_: unknown, p: Pbf) => writeLayer(p, 'building', buildings), undefined);
  tile.writeMessage(3, (_: unknown, p: Pbf) => writeLayer(p, 'transportation', roads), undefined);
  return tile.finish();
}
