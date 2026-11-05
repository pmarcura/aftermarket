/**
 * Prédios reais do mapa em 3D, na mesma mão dos modelos dos negócios (kit em modelos3d.ts):
 * a planta e a altura vêm do OpenStreetMap; o tipo (casa, prédio ou galpão) sai da forma e do
 * tamanho; paredes com fachada em pixel art (fachadas.ts), telhado de terracota nas casas, laje
 * com platibanda e caixa-d'água nos prédios, telhado de metal nos galpões.
 *
 * Tudo vira uma única malha por pedaço de mapa (uma chamada de desenho), com cor por vértice e
 * coordenadas de textura: milhares de prédios sem pesar. Só desenho; nada aqui muda o jogo.
 * Unidades: metros, Y para cima, X para leste, Z para o sul (o mesmo espaço da camada 3D).
 */
import * as THREE from 'three';
import { INDICE_FACHADA, type Fachada } from './fachadas';

export type Ponto = [number, number]; // (x leste, z sul) em metros

export interface Planta {
  id: number;
  /** Contorno externo (sem repetir o primeiro ponto no fim). */
  contorno: Ponto[];
  /** Altura informada no mapa (m); sem informação, o tipo decide. */
  altura?: number;
  /** Altura da base (m), para partes elevadas de prédios. */
  base?: number;
  /** Arestas que são corte do pedaço de mapa (não viram parede). */
  cortes?: boolean[];
}

export type TipoPredio = 'casa' | 'predio' | 'galpao';

// Paleta da identidade (mesmos tons do kit dos negócios).
const PAREDE: Record<TipoPredio, string[]> = {
  casa: ['#f3e7cc', '#efcfa8', '#e6d8b8', '#d9e4c4', '#c9dbe8', '#f0d6c8', '#f8f1e0'],
  predio: ['#e6d8b8', '#d9cfb8', '#c9c4ba', '#cfd6dc', '#efcfa8', '#f3e7cc'],
  galpao: ['#d9cfb8', '#9fbcd8', '#e6d8b8', '#c9c4ba'],
};
const TELHA = ['#d0682f', '#e8894a', '#b85a2a', '#c46a3a', '#a84f1f'];
const LAJES = ['#c9bfa9', '#b9b2a4', '#d2c4a2'];
const LAJES_PREDIO = ['#b4ab9b', '#c2b8a4', '#a9a39a', '#bfae94'];
const METAL = ['#9aa3a8', '#aab3b8', '#8d969c'];
const CAIXA_DAGUA = '#6cb8e8';
const PLATIBANDA = 0.7; // metros de mureta em volta da laje
const BEIRAL = 0.45; // metros que o telhado passa da parede
const ANDAR = 3; // metros por andar (a fachada repete a cada andar)

/** Escolha estável pela identidade do prédio (o mesmo prédio tem sempre a mesma cara). */
function escolher<T>(lista: readonly T[], id: number, sal = 0): T {
  let h = (Math.floor(id / 10) * 2654435761 + sal * 40503) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return lista[h % lista.length];
}

function area(p: Ponto[]) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return a / 2;
}

/** Fecho convexo (cadeia monótona), para achar o retângulo mínimo da planta. */
function fecho(pontos: Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o: Ponto, a: Ponto, b: Ponto) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo: Ponto[] = [];
  for (const q of p) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0)
      baixo.pop();
    baixo.push(q);
  }
  const cima: Ponto[] = [];
  for (const q of [...p].reverse()) {
    while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], q) <= 0)
      cima.pop();
    cima.push(q);
  }
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)];
}

/** Retângulo de menor área que contém a planta: centro, eixos e meias medidas. */
export function retanguloMinimo(contorno: Ponto[]) {
  const h = fecho(contorno);
  let melhor = { area: Infinity, cx: 0, cz: 0, ux: 1, uz: 0, meioU: 0, meioV: 0 };
  for (let i = 0; i < h.length; i++) {
    const a = h[i],
      b = h[(i + 1) % h.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const ux = (b[0] - a[0]) / L,
      uz = (b[1] - a[1]) / L;
    let u0 = Infinity,
      u1 = -Infinity,
      v0 = Infinity,
      v1 = -Infinity;
    for (const [x, z] of h) {
      const u = x * ux + z * uz,
        v = -x * uz + z * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const ar = (u1 - u0) * (v1 - v0);
    if (ar < melhor.area) {
      const cu = (u0 + u1) / 2,
        cv = (v0 + v1) / 2;
      melhor = {
        area: ar,
        cx: cu * ux - cv * uz,
        cz: cu * uz + cv * ux,
        ux,
        uz,
        meioU: (u1 - u0) / 2,
        meioV: (v1 - v0) / 2,
      };
    }
  }
  // eixo U sempre o comprido (a cumeeira corre ao longo dele)
  if (melhor.meioV > melhor.meioU)
    melhor = {
      ...melhor,
      ux: -melhor.uz,
      uz: melhor.ux,
      meioU: melhor.meioV,
      meioV: melhor.meioU,
    };
  return melhor;
}

/** Tipo e medidas de um prédio a partir da planta. */
export function classificar(p: Planta) {
  const a = Math.abs(area(p.contorno));
  const ret = retanguloMinimo(p.contorno);
  const cheio = ret.area > 0 ? a / ret.area : 0;
  const informada = p.altura && p.altura > 0 ? p.altura : undefined;
  // OpenMapTiles usa 5 m quando o mapa não diz a altura; tratamos como "sem altura".
  const conhecida = informada && Math.abs(informada - 5) > 0.01 ? informada : undefined;
  // altura do mapa manda; sem ela, o tamanho da planta: grande = galpão, média = prédio baixo
  let tipo: TipoPredio;
  if (conhecida && conhecida > 9) tipo = 'predio';
  else if (a > 700) tipo = 'galpao';
  else if (!conhecida && a >= 400) tipo = 'predio';
  else tipo = 'casa';
  const altura =
    conhecida ??
    (tipo === 'galpao'
      ? escolher([6, 7, 8, 9], p.id, 1)
      : tipo === 'predio'
        ? escolher([9, 9, 12], p.id, 1)
        : a > 160
          ? escolher([4, 6.5, 6.5], p.id, 1)
          : escolher([3.6, 4, 6.5], p.id, 1));
  // telhado de duas águas só em planta quase retangular e não muito grande
  const duasAguas =
    (tipo === 'casa' && cheio > 0.82 && a < 420 && ret.meioV > 1.5) ||
    (tipo === 'galpao' && cheio > 0.85);
  return { tipo, altura, area: a, ret, duasAguas };
}

/** Acumula triângulos com normal, cor e textura numa malha só. */
class Malha {
  pos: number[] = [];
  nor: number[] = [];
  cor: number[] = [];
  uv: number[] = [];
  fachada: number[] = [];
  private c = new THREE.Color();

  tri(
    a: THREE.Vector3Tuple,
    b: THREE.Vector3Tuple,
    c: THREE.Vector3Tuple,
    normal: THREE.Vector3Tuple,
    cor: string,
    uva: [number, number] = [0, 0],
    uvb: [number, number] = [0, 0],
    uvc: [number, number] = [0, 0],
    fachada = -1,
  ) {
    // garante a face virada para a normal pedida (frente para fora)
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    if (n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0) {
      [b, c] = [c, b];
      [uvb, uvc] = [uvc, uvb];
    }
    this.c.set(cor);
    for (const [v, t] of [
      [a, uva],
      [b, uvb],
      [c, uvc],
    ] as const) {
      this.pos.push(...v);
      this.nor.push(...normal);
      this.cor.push(this.c.r, this.c.g, this.c.b);
      this.uv.push(...t);
      this.fachada.push(fachada);
    }
  }

  quad(
    a: THREE.Vector3Tuple,
    b: THREE.Vector3Tuple,
    c: THREE.Vector3Tuple,
    d: THREE.Vector3Tuple,
    normal: THREE.Vector3Tuple,
    cor: string,
    uv?: [[number, number], [number, number], [number, number], [number, number]],
    fachada = -1,
  ) {
    this.tri(a, b, c, normal, cor, uv?.[0], uv?.[1], uv?.[2], fachada);
    this.tri(a, c, d, normal, cor, uv?.[0], uv?.[2], uv?.[3], fachada);
  }

  /** Caixa (para caixa-d'água e máquinas na laje). */
  caixa(cx: number, cz: number, y: number, w: number, h: number, d: number, cor: string) {
    const x0 = cx - w / 2,
      x1 = cx + w / 2,
      z0 = cz - d / 2,
      z1 = cz + d / 2,
      y1 = y + h;
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], cor);
    this.quad([x0, y, z1], [x1, y, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], cor);
    this.quad([x0, y, z0], [x1, y, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], cor);
    this.quad([x1, y, z0], [x1, y, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], cor);
    this.quad([x0, y, z0], [x0, y, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], cor);
  }

  dados(): DadosDaMalha {
    return {
      posicao: new Float32Array(this.pos),
      normal: new Float32Array(this.nor),
      cor: new Float32Array(this.cor),
      uv: new Float32Array(this.uv),
      fachada: new Float32Array(this.fachada),
    };
  }
}

/** Atributos crus de uma malha (para mandar de um worker sem copiar). */
export interface DadosDaMalha {
  posicao: Float32Array;
  normal: Float32Array;
  cor: Float32Array;
  uv: Float32Array;
  fachada: Float32Array;
}

export function geometriaDe(d: DadosDaMalha) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.posicao, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(d.normal, 3));
  g.setAttribute('color', new THREE.BufferAttribute(d.cor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  g.setAttribute('fachada', new THREE.BufferAttribute(d.fachada, 1));
  g.computeBoundingSphere();
  return g;
}

/** Paredes de um contorno, de y0 a y1, com a fachada escolhida (repete por andar). */
function paredes(
  m: Malha,
  contorno: Ponto[],
  y0: number,
  y1: number,
  cor: string,
  fachada: Fachada,
  cortes?: boolean[],
) {
  const fora = area(contorno) > 0 ? 1 : -1;
  let percorrido = 0;
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i],
      b = contorno[(i + 1) % contorno.length];
    const ex = b[0] - a[0],
      ez = b[1] - a[1];
    const L = Math.hypot(ex, ez);
    if (L < 0.05) continue;
    if (cortes?.[i]) {
      percorrido += L;
      continue;
    }
    const normal: THREE.Vector3Tuple = [(fora * ez) / L, 0, (-fora * ex) / L];
    // coordenadas de textura: 1 unidade = 1 módulo de 3 m (largura) por 1 andar (altura)
    const u0 = percorrido / ANDAR,
      u1 = (percorrido + L) / ANDAR;
    const v0 = y0 / ANDAR,
      v1 = y1 / ANDAR;
    m.quad(
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
      normal,
      cor,
      [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ],
      INDICE_FACHADA[fachada],
    );
    percorrido += L;
  }
}

/** Laje plana no contorno, na altura y, com a cor e a cobertura pedidas (juntas a cada 3 m). */
function laje(m: Malha, contorno: Ponto[], y: number, cor: string, cobertura: Fachada = 'laje') {
  const forma = contorno.map(([x, z]) => new THREE.Vector2(x, z));
  const uv = (q: Ponto): [number, number] => [q[0] / ANDAR, q[1] / ANDAR];
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(forma, []))
    m.tri(
      [contorno[i][0], y, contorno[i][1]],
      [contorno[j][0], y, contorno[j][1]],
      [contorno[k][0], y, contorno[k][1]],
      [0, 1, 0],
      cor,
      uv(contorno[i]),
      uv(contorno[j]),
      uv(contorno[k]),
      INDICE_FACHADA[cobertura],
    );
}

/** Ponto dentro do contorno (regra par-ímpar). */
function dentro(contorno: Ponto[], x: number, z: number) {
  let ok = false;
  for (let i = 0, j = contorno.length - 1; i < contorno.length; j = i++) {
    const [xi, zi] = contorno[i],
      [xj, zj] = contorno[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ok = !ok;
  }
  return ok;
}

/**
 * Equipamentos de laje: caixa-d'água, casa de máquinas e aparelhos de ar, em quantidade
 * proporcional à laje e sempre dentro dela (com folga da mureta).
 */
function equipamentos(
  m: Malha,
  p: Planta,
  a: number,
  y: number,
  ret: ReturnType<typeof retanguloMinimo>,
  predio: boolean,
) {
  const quantos = Math.min(7, Math.max(predio ? 1 : 0, Math.floor(a / 260)));
  const vx = -ret.uz,
    vz = ret.ux;
  const semente = Math.floor(p.id / 10);
  let colocados = 0;
  for (let tentativa = 0; tentativa < quantos * 6 && colocados < quantos; tentativa++) {
    const su = (((semente * 9301 + tentativa * 49297) % 233280) + 233280) % 233280;
    const sv = (((semente * 4271 + tentativa * 7919) % 233280) + 233280) % 233280;
    const fu = (su / 233280 - 0.5) * 1.6,
      fv = (sv / 233280 - 0.5) * 1.6;
    const x = ret.cx + ret.ux * fu * ret.meioU + vx * fv * ret.meioV;
    const z = ret.cz + ret.uz * fu * ret.meioU + vz * fv * ret.meioV;
    const tipo = colocados === 0 && predio ? 0 : (tentativa + semente) % 3;
    const [w, h, d, cor]: [number, number, number, string] =
      tipo === 0
        ? [2.4, 2.2, 2.4, CAIXA_DAGUA] // caixa-d'água
        : tipo === 1
          ? [3.2, 2.4, 2.6, '#d9cfb8'] // casa de máquinas
          : [1.4, 0.9, 1.1, '#9aa3a8']; // ar-condicionado
    // o centro e os quatro cantos precisam cair na laje, longe da mureta
    const folga = Math.max(w, d) / 2 + 0.8;
    const cantos = [
      [0, 0],
      [folga, folga],
      [-folga, folga],
      [folga, -folga],
      [-folga, -folga],
    ];
    if (!cantos.every(([dx, dz]) => dentro(p.contorno, x + dx, z + dz))) continue;
    m.caixa(x, z, y, w, h, d, cor);
    colocados++;
  }
}

/** Telhado de duas águas sobre o retângulo mínimo, com beiral e oitões. */
function duasAguas(
  m: Malha,
  ret: ReturnType<typeof retanguloMinimo>,
  y: number,
  inclinacao: number,
  telha: string,
  parede: string,
  cobertura: Fachada,
) {
  const { cx, cz, ux, uz, meioU, meioV } = ret;
  const vx = -uz,
    vz = ux;
  const ponto = (u: number, v: number, h: number): THREE.Vector3Tuple => [
    cx + ux * u + vx * v,
    h,
    cz + uz * u + vz * v,
  ];
  const U = meioU + BEIRAL,
    V = meioV + BEIRAL;
  const topo = y + meioV * inclinacao;
  const queda = y - BEIRAL * inclinacao;
  const k = Math.hypot(1, inclinacao);
  // textura correndo pela queda do telhado: fiadas de telha (ou nervuras do metal)
  const descida = Math.hypot(V, topo - queda);
  for (const lado of [1, -1]) {
    // água: do beiral (lado ±V) até a cumeeira (v = 0); normal inclinada para fora e para cima
    const n: THREE.Vector3Tuple = [
      (vx * lado * inclinacao) / k,
      1 / k,
      (vz * lado * inclinacao) / k,
    ];
    m.quad(
      ponto(-U, lado * V, queda),
      ponto(U, lado * V, queda),
      ponto(U, 0, topo),
      ponto(-U, 0, topo),
      n,
      telha,
      [
        [-U / ANDAR, 0],
        [U / ANDAR, 0],
        [U / ANDAR, descida / ANDAR],
        [-U / ANDAR, descida / ANDAR],
      ],
      INDICE_FACHADA[cobertura],
    );
    // oitão: triângulo de parede em cada ponta, no plano da parede (sem beiral)
    const nU: THREE.Vector3Tuple = [ux * lado, 0, uz * lado];
    m.tri(
      ponto(lado * meioU, -meioV, y),
      ponto(lado * meioU, meioV, y),
      ponto(lado * meioU, 0, topo),
      nU,
      parede,
    );
  }
}

/** Monta uma malha com todos os prédios das plantas. */
export function construirPredios(plantas: Planta[]): THREE.BufferGeometry | null {
  const d = malhaDosPredios(plantas);
  return d ? geometriaDe(d) : null;
}

/** Os mesmos prédios, como atributos crus (usado no worker). */
export function malhaDosPredios(plantas: Planta[]): DadosDaMalha | null {
  const m = new Malha();
  for (const p of plantas) {
    if (p.contorno.length < 3 || Math.abs(area(p.contorno)) < 6) continue;
    const { tipo, altura, area: a, ret, duasAguas: temTelhado } = classificar(p);
    const base = p.base ?? 0;
    const parede = escolher(PAREDE[tipo], p.id);
    const fachada: Fachada = tipo === 'predio' ? 'predio' : tipo === 'galpao' ? 'galpao' : 'casa';
    if (temTelhado) {
      paredes(m, p.contorno, base, altura, parede, fachada, p.cortes);
      const inclinacao = tipo === 'galpao' ? 0.18 : 0.55;
      const telha = tipo === 'galpao' ? escolher(METAL, p.id, 2) : escolher(TELHA, p.id, 2);
      duasAguas(m, ret, altura, inclinacao, telha, parede, tipo === 'galpao' ? 'metal' : 'telha');
      continue;
    }
    // laje com platibanda: a parede sobe a mureta e a laje fica um pouco abaixo dela
    paredes(m, p.contorno, base, altura + PLATIBANDA, parede, fachada, p.cortes);
    const galpao = tipo === 'galpao';
    laje(
      m,
      p.contorno,
      altura,
      galpao
        ? escolher(METAL, p.id, 2)
        : escolher(tipo === 'predio' ? LAJES_PREDIO : LAJES, p.id, 3),
      galpao ? 'metal' : 'laje',
    );
    // caixa-d'água, casa de máquinas e ar-condicionado na laje (prédios e casas grandes)
    if (!galpao && (tipo === 'predio' || a > 160))
      equipamentos(m, p, a, altura, ret, tipo === 'predio');
  }
  return m.pos.length ? m.dados() : null;
}
