/**
 * Lugares reais dos negócios, um único algoritmo para todos os tipos.
 *
 * Para cada cidade do jogo, lê os mesmos dados do mapa que o jogador vê (tiles vetoriais do
 * OpenFreeMap / OpenStreetMap) e:
 *   1. pinta numa grade as zonas reais: comércio (landuse commercial/retail), indústria
 *      (landuse industrial), lavoura (landcover farmland) e mineração (landuse quarry);
 *   2. marca como proibido o que não pode ser ocupado: ruas e rodovias (com a largura de cada
 *      classe) e água;
 *   3. mede, em cada célula da zona, a distância até a borda livre mais próxima (transformada
 *      de distância): é o tamanho do maior terreno que cabe ali sem sair da zona nem cruzar rua;
 *   4. escolhe, um a um, os pontos com mais espaço, reservando a área de cada terreno escolhido
 *      para que nenhum se sobreponha; a frente do terreno aponta para a rua mais próxima.
 *
 * Saída versionada: packages/world/data/lugares-reais.json. O jogo não consulta a internet.
 * Os tiles baixados ficam em .runtime/tiles (cache) para rodar de novo sem baixar tudo.
 *
 * Uso: npm run lugares:sync                 (todas as cidades)
 *      npm run lugares:sync -- 3509502       (uma cidade, pelo código IBGE)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { cities, type City } from '../packages/world/src/geography-v2';

const SAIDA = 'packages/world/data/lugares-reais.json';
// Cidades que têm negócios no mundo inicial mas não estão na lista da economia (só mapa).
const EXTRAS: City[] = [
  { id: '3525904', name: 'Jundiaí', state: 'SP', coordinates: [-46.884, -23.186], population: 443 },
];
const CACHE = '.runtime/tiles';
const M_POR_GRAU = 111_320;

export type Zona = 'comercio' | 'industria' | 'lavoura' | 'mineracao';

/** Como cada zona é lida do mapa e quanto espaço procurar. */
const ESCALAS = {
  // cidade: tiles de rua (zoom 14), grade de 8 m, até ~6 km do centro
  urbana: { zoom: 14, raioTiles: 2, celula: 8, zonas: ['comercio', 'industria'] as Zona[] },
  // campo: tiles de zoom 12, grade de 40 m, até ~30 km do centro
  rural: { zoom: 12, raioTiles: 3, celula: 40, zonas: ['lavoura', 'mineracao'] as Zona[] },
};

/** Lado mínimo e máximo (m) do terreno guardado em cada zona, e quantos lugares guardar. */
const TERRENO: Record<Zona, { minimo: number; maximo: number; quantos: number }> = {
  comercio: { minimo: 20, maximo: 200, quantos: 40 },
  industria: { minimo: 40, maximo: 400, quantos: 40 },
  lavoura: { minimo: 200, maximo: 2400, quantos: 25 },
  mineracao: { minimo: 120, maximo: 1400, quantos: 15 },
};

/** Meia largura (m) de cada classe de via: o terreno não pode encostar nela. */
const MEIA_LARGURA: Record<string, number> = {
  motorway: 18,
  trunk: 14,
  primary: 10,
  secondary: 8,
  tertiary: 7,
  minor: 5,
  service: 3,
};
/** Vias que podem ser a frente de um negócio (rodovia expressa não tem entrada). */
const FRENTE = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track']);

type P = [number, number]; // metros (leste, norte) a partir do centro da cidade
interface Segmento {
  a: P;
  b: P;
  classe: string;
}

// -------------------------------------------------------------------------------------------
// Tiles

function tileDe(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  };
}

let modelo: string | null = null;
async function baixarTile(z: number, x: number, y: number): Promise<VectorTile | null> {
  const arquivo = `${CACHE}/${z}/${x}/${y}.pbf`;
  let dados: Uint8Array | null = null;
  if (existsSync(arquivo)) dados = new Uint8Array(readFileSync(arquivo));
  else {
    if (!modelo) {
      const tj = (await (await fetch('https://tiles.openfreemap.org/planet')).json()) as {
        tiles: string[];
      };
      modelo = tj.tiles[0];
    }
    const url = modelo.replace('{z}', `${z}`).replace('{x}', `${x}`).replace('{y}', `${y}`);
    for (let i = 0; i < 4 && !dados; i++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'aftermarket-lugares/1.0' } });
        if (r.status === 204 || r.status === 404) dados = new Uint8Array(0);
        else if (r.ok) dados = new Uint8Array(await r.arrayBuffer());
      } catch {
        /* tenta de novo */
      }
      if (!dados) await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
    }
    if (!dados) throw new Error(`não foi possível baixar ${url}`);
    mkdirSync(dirname(arquivo), { recursive: true });
    writeFileSync(arquivo, dados);
  }
  return dados.length ? new VectorTile(new PbfReader(dados)) : null;
}

/** Executa tarefas com no máximo `n` ao mesmo tempo (educado com o servidor de tiles). */
async function emLotes<T>(tarefas: (() => Promise<T>)[], n = 8) {
  const saida: T[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tarefas.length) {
        const k = i++;
        saida[k] = await tarefas[k]();
      }
    }),
  );
  return saida;
}

// -------------------------------------------------------------------------------------------
// Grade

class Grade {
  readonly n: number;
  readonly zona: Uint8Array; // bits das zonas
  readonly bloqueio: Uint8Array; // 1 = rua, água ou terreno já escolhido
  constructor(
    readonly meio: number, // metade do lado da área coberta (m)
    readonly cel: number,
  ) {
    this.n = Math.ceil((2 * meio) / cel);
    this.zona = new Uint8Array(this.n * this.n);
    this.bloqueio = new Uint8Array(this.n * this.n);
  }
  celula([x, y]: P) {
    return [Math.floor((x + this.meio) / this.cel), Math.floor((y + this.meio) / this.cel)];
  }
  centro(i: number, j: number): P {
    return [-this.meio + (i + 0.5) * this.cel, -this.meio + (j + 0.5) * this.cel];
  }
  /** Preenche polígonos (anéis com buracos, regra par-ímpar) por varredura de linhas. */
  pintar(aneis: P[][], alvo: Uint8Array, valor: number) {
    let y0 = Infinity,
      y1 = -Infinity;
    for (const [, y] of aneis[0]) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const j0 = Math.max(0, Math.floor((y0 + this.meio) / this.cel));
    const j1 = Math.min(this.n - 1, Math.floor((y1 + this.meio) / this.cel));
    for (let j = j0; j <= j1; j++) {
      const y = -this.meio + (j + 0.5) * this.cel;
      const cortes: number[] = [];
      for (const anel of aneis)
        for (let a = 0, b = anel.length - 1; a < anel.length; b = a++) {
          const [xa, ya] = anel[a],
            [xb, yb] = anel[b];
          if (ya > y !== yb > y) cortes.push(((xb - xa) * (y - ya)) / (yb - ya) + xa);
        }
      cortes.sort((p, q) => p - q);
      for (let c = 0; c + 1 < cortes.length; c += 2) {
        const i0 = Math.max(0, Math.ceil((cortes[c] + this.meio) / this.cel - 0.5));
        const i1 = Math.min(this.n - 1, Math.floor((cortes[c + 1] + this.meio) / this.cel - 0.5));
        for (let i = i0; i <= i1; i++) alvo[j * this.n + i] |= valor;
      }
    }
  }
  /** Marca como bloqueadas as células a até `raio` metros do segmento. */
  riscar(s: Segmento, raio: number) {
    const passo = this.cel / 2;
    const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    const r = Math.ceil(raio / this.cel);
    for (let t = 0; t <= L; t += passo) {
      const f = L ? t / L : 0;
      const [i, j] = this.celula([s.a[0] + f * (s.b[0] - s.a[0]), s.a[1] + f * (s.b[1] - s.a[1])]);
      for (let di = -r; di <= r; di++)
        for (let dj = -r; dj <= r; dj++) {
          const ii = i + di,
            jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= this.n || jj >= this.n) continue;
          if ((di * di + dj * dj) * this.cel * this.cel <= raio * raio)
            this.bloqueio[jj * this.n + ii] = 1;
        }
    }
  }
  /**
   * Transformada de distância (chanfro 3-4, em metros): para cada célula da zona, a distância
   * até a célula mais próxima que está fora da zona ou bloqueada.
   */
  folga(vale: (bits: number) => boolean) {
    const { n } = this;
    const d = new Float32Array(n * n);
    const INF = 1e9;
    for (let k = 0; k < n * n; k++) d[k] = vale(this.zona[k]) && !this.bloqueio[k] ? INF : 0;
    const a = 1,
      b = Math.SQRT2;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (!d[k]) continue;
        let v = d[k];
        if (i > 0) v = Math.min(v, d[k - 1] + a);
        else v = 0;
        if (j > 0) {
          v = Math.min(v, d[k - n] + a);
          if (i > 0) v = Math.min(v, d[k - n - 1] + b);
          if (i < n - 1) v = Math.min(v, d[k - n + 1] + b);
        } else v = 0;
        d[k] = v;
      }
    for (let j = n - 1; j >= 0; j--)
      for (let i = n - 1; i >= 0; i--) {
        const k = j * n + i;
        if (!d[k]) continue;
        let v = d[k];
        if (i < n - 1) v = Math.min(v, d[k + 1] + a);
        else v = 0;
        if (j < n - 1) {
          v = Math.min(v, d[k + n] + a);
          if (i < n - 1) v = Math.min(v, d[k + n + 1] + b);
          if (i > 0) v = Math.min(v, d[k + n - 1] + b);
        } else v = 0;
        d[k] = v;
      }
    for (let k = 0; k < n * n; k++) d[k] *= this.cel;
    return d;
  }
}

// -------------------------------------------------------------------------------------------
// Leitura de uma cidade numa escala

async function lerEscala(cidade: City, escala: (typeof ESCALAS)[keyof typeof ESCALAS]) {
  const k = Math.cos((cidade.coordinates[1] * Math.PI) / 180);
  const paraM = ([lng, lat]: number[]): P => [
    (lng - cidade.coordinates[0]) * M_POR_GRAU * k,
    (lat - cidade.coordinates[1]) * M_POR_GRAU,
  ];
  const paraGraus = ([x, y]: P): [number, number] => [
    cidade.coordinates[0] + x / (M_POR_GRAU * k),
    cidade.coordinates[1] + y / M_POR_GRAU,
  ];
  const { zoom, raioTiles, celula } = escala;
  const t0 = tileDe(cidade.coordinates[0], cidade.coordinates[1], zoom);
  // metade do lado coberto: raio de tiles completo em volta do tile central
  const ladoTile = (40_075_016 * k) / 2 ** zoom;
  const grade = new Grade(ladoTile * (raioTiles + 0.5), celula);
  const ruas: Segmento[] = [];
  const BIT = { comercio: 1, industria: 2, lavoura: 4, mineracao: 8, bairro: 16, mata: 32 };
  // Zona substituta, quando o mapa da cidade não marca a zona do negócio: comércio vai para o
  // bairro (ou, sem bairro marcado, para a área da cidade fora de mata e indústria); indústria
  // vai para terreno aberto fora de bairro; lavoura vai para campo aberto (fora de cidade e mata).
  const URBANO = BIT.comercio | BIT.industria | BIT.bairro;
  const ZONA: Record<Zona, (b: number) => boolean> = {
    comercio: (b) => Boolean(b & BIT.comercio),
    industria: (b) => Boolean(b & BIT.industria),
    lavoura: (b) => Boolean(b & BIT.lavoura),
    mineracao: (b) => Boolean(b & BIT.mineracao),
  };
  // Em ordem: a primeira substituta que tiver espaço é usada.
  const livre = (b: number) => !(b & (BIT.mata | BIT.mineracao));
  const SUBSTITUTA: Partial<Record<Zona, ((b: number) => boolean)[]>> = {
    comercio: [(b) => Boolean(b & BIT.bairro), (b) => livre(b) && !(b & BIT.industria)],
    industria: [(b) => livre(b) && !(b & (BIT.bairro | BIT.comercio))],
    lavoura: [(b) => livre(b) && !(b & URBANO)],
  };

  const tarefas: (() => Promise<void>)[] = [];
  for (let dx = -raioTiles; dx <= raioTiles; dx++)
    for (let dy = -raioTiles; dy <= raioTiles; dy++)
      tarefas.push(async () => {
        const x = t0.x + dx,
          y = t0.y + dy;
        const tile = await baixarTile(zoom, x, y);
        if (!tile) return;
        const poligonos = (geo: GeoJSON.Geometry): P[][][] =>
          geo.type === 'Polygon'
            ? [geo.coordinates.map((a) => a.map(paraM))]
            : geo.type === 'MultiPolygon'
              ? geo.coordinates.map((p) => p.map((a) => a.map(paraM)))
              : [];
        const cada = (nome: string, f: (g: GeoJSON.Feature) => void) => {
          const camada = tile.layers[nome];
          for (let i = 0; camada && i < camada.length; i++)
            f(camada.feature(i).toGeoJSON(x, y, zoom));
        };
        cada('landuse', (g) => {
          const c = String(g.properties?.class);
          const zona: Zona | 'bairro' | null =
            c === 'commercial' || c === 'retail'
              ? 'comercio'
              : c === 'industrial'
                ? 'industria'
                : c === 'quarry'
                  ? 'mineracao'
                  : c === 'farmland' || c === 'farmyard'
                    ? 'lavoura'
                    : c === 'residential' || c === 'suburb' || c === 'neighbourhood'
                      ? 'bairro'
                      : null;
          if (zona) for (const p of poligonos(g.geometry)) grade.pintar(p, grade.zona, BIT[zona]);
        });
        cada('landcover', (g) => {
          const c = String(g.properties?.class);
          const bit = c === 'farmland' ? BIT.lavoura : c === 'wood' ? BIT.mata : 0;
          if (bit) for (const p of poligonos(g.geometry)) grade.pintar(p, grade.zona, bit);
        });
        cada('water', (g) => {
          for (const p of poligonos(g.geometry)) grade.pintar(p, grade.bloqueio, 1);
        });
        cada('transportation', (g) => {
          const classe = String(g.properties?.class);
          if (!(classe in MEIA_LARGURA) && classe !== 'track') return;
          if (g.properties?.brunnel === 'tunnel') return;
          const geo = g.geometry;
          const linhas =
            geo.type === 'LineString'
              ? [geo.coordinates]
              : geo.type === 'MultiLineString'
                ? geo.coordinates
                : [];
          for (const l of linhas)
            for (let i = 1; i < l.length; i++)
              ruas.push({ a: paraM(l[i - 1]), b: paraM(l[i]), classe });
        });
      });
  await emLotes(tarefas);
  for (const s of ruas) if (MEIA_LARGURA[s.classe]) grade.riscar(s, MEIA_LARGURA[s.classe] + 2);

  // Índice de ruas de frente, para virar cada terreno para a rua mais próxima.
  const CEL = 200;
  const indice = new Map<string, Segmento[]>();
  for (const s of ruas.filter((r) => FRENTE.has(r.classe))) {
    const k0 = `${Math.floor((s.a[0] + s.b[0]) / 2 / CEL)},${Math.floor((s.a[1] + s.b[1]) / 2 / CEL)}`;
    (indice.get(k0) ?? indice.set(k0, []).get(k0)!).push(s);
  }
  const ruaMaisProxima = (p: P) => {
    let melhor: { d: number; q: P } | null = null;
    const ci = Math.floor(p[0] / CEL),
      cj = Math.floor(p[1] / CEL);
    for (let r = 0; r <= 8 && !melhor; r++)
      for (let i = ci - r; i <= ci + r; i++)
        for (let j = cj - r; j <= cj + r; j++)
          for (const s of indice.get(`${i},${j}`) ?? []) {
            const vx = s.b[0] - s.a[0],
              vy = s.b[1] - s.a[1];
            const L = vx * vx + vy * vy || 1;
            const t = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * vx + (p[1] - s.a[1]) * vy) / L));
            const q: P = [s.a[0] + t * vx, s.a[1] + t * vy];
            const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
            if (!melhor || d < melhor.d) melhor = { d, q };
          }
    return melhor;
  };

  const resultado: Partial<Record<Zona, number[][]>> = {};
  for (const zona of escala.zonas) {
    const { minimo, maximo, quantos } = TERRENO[zona];
    const lugares: number[][] = [];
    // Primeiro a zona real; se ela acabar (ou não existir no mapa), a substituta.
    const testes = [ZONA[zona], ...(SUBSTITUTA[zona] ?? [])];
    let fase = 0;
    // Escolhe de novo a cada lugar, porque o terreno escolhido bloqueia a vizinhança.
    while (lugares.length < quantos && fase < testes.length) {
      const folga = grade.folga(testes[fase]);
      let melhor = -1;
      for (let c = 0; c < folga.length; c++) if (melhor < 0 || folga[c] > folga[melhor]) melhor = c;
      // quadrado inscrito no círculo livre: lado = raio × √2
      const lado = Math.min(maximo, (folga[melhor] ?? 0) * Math.SQRT2);
      if (melhor < 0 || lado < minimo) {
        fase++;
        continue;
      }
      const i = melhor % grade.n,
        j = Math.floor(melhor / grade.n);
      const p = grade.centro(i, j);
      const rua = ruaMaisProxima(p);
      const giro = rua ? Math.atan2(rua.q[0] - p[0], -(rua.q[1] - p[1])) : 0;
      const [lng, lat] = paraGraus(p);
      lugares.push([
        Math.round(lng * 1e5) / 1e5,
        Math.round(lat * 1e5) / 1e5,
        Math.round(giro * 100) / 100,
        Math.round(lado),
        fase === 0 ? 1 : 0, // 1 = zona real do mapa; 0 = zona substituta
      ]);
      // reserva a área do terreno escolhido (com um recuo) para o próximo não sobrepor
      const raio = (lado / Math.SQRT2) * 1.05 + grade.cel;
      const r = Math.ceil(raio / grade.cel);
      for (let di = -r; di <= r; di++)
        for (let dj = -r; dj <= r; dj++) {
          const ii = i + di,
            jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < grade.n && jj < grade.n)
            if ((di * di + dj * dj) * grade.cel * grade.cel <= raio * raio)
              grade.bloqueio[jj * grade.n + ii] = 1;
        }
    }
    resultado[zona] = lugares;
  }
  return resultado;
}

async function lugaresDaCidade(cidade: City) {
  const t = Date.now();
  const urbana = await lerEscala(cidade, ESCALAS.urbana);
  const rural = await lerEscala(cidade, ESCALAS.rural);
  return { ...urbana, ...rural, segundos: Math.round((Date.now() - t) / 1000) };
}

async function main() {
  const so = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  const anterior = existsSync(SAIDA)
    ? (JSON.parse(readFileSync(SAIDA, 'utf8')) as { cidades: Record<string, unknown> })
    : { cidades: {} };
  const saida: Record<string, unknown> = so ? anterior.cidades : {};
  for (const c of [...cities, ...EXTRAS].filter((x) => !so || x.id === so)) {
    const r = await lugaresDaCidade(c);
    saida[c.id] = {
      nome: c.name,
      uf: c.state,
      comercio: r.comercio,
      industria: r.industria,
      lavoura: r.lavoura,
      mineracao: r.mineracao,
    };
    const conta = (z: Zona) => String(r[z]?.length ?? 0).padStart(2);
    console.log(
      `${c.name.padEnd(26)} comércio ${conta('comercio')} · indústria ${conta('industria')} · lavoura ${conta('lavoura')} · mineração ${conta('mineracao')} · ${r.segundos} s`,
    );
    writeFileSync(
      SAIDA,
      JSON.stringify({
        fonte: 'OpenFreeMap (OpenMapTiles, dados © colaboradores do OpenStreetMap)',
        formato:
          '[lng, lat, giro (rad, 0 = frente para o sul), lado máximo do terreno (m), 1 = zona real / 0 = substituta]',
        geradoEm: new Date().toISOString().slice(0, 10),
        cidades: saida,
      }) + '\n',
    );
  }
  console.log(`gravado em ${SAIDA}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
