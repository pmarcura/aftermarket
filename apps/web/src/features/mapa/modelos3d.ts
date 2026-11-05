/**
 * Kit de modelos 3D dos negócios do jogo (só desenho: nada aqui muda a economia).
 *
 * Referência de estilo: MODERN TOWN SET (escolha do Pedro, 05/11/2026) — cidade de brinquedo,
 * telhado turquesa, concreto e tijolo, contorno escuro, luz do alto à esquerda. Os modelos são
 * montados em código, peça por peça, para todos terem a mesma mão e crescerem por nível.
 *
 * Unidades: metros. Origem no centro do lote, no chão; Y para cima; a frente olha para +Z.
 */
import * as THREE from 'three';
import type { Category } from '../../../../../packages/simulation/src/model';
import { CAMADA_TRACOS } from './pixel3d';

export type Nivel = 1 | 2 | 3 | 4;
export type Estagio = Nivel | 'obra';

// Paleta da identidade visual (apps/web/src/design/identidade.css e sprites de /arte):
// telhado de terracota, parede creme, azul de céu e de aço, ouro, brasa e verdes de lavoura.
export const COR = {
  contorno: '#1d1a12',
  concreto: '#d9cfb8',
  concretoClaro: '#eadfc6',
  cinza: '#9aa3a8',
  cinzaEscuro: '#5e6466',
  tijolo: '#c0603a',
  tijoloEscuro: '#8a3b12',
  creme: '#f3e7cc',
  turquesa: '#d0682f',
  turquesaClaro: '#e8894a',
  turquesaEscuro: '#a84f1f',
  vidro: '#6cb8e8',
  vidroEscuro: '#3f7fc0',
  porta: '#4b3a2a',
  vermelho: '#f47a5e',
  branco: '#f8f1e0',
  amarelo: '#f2bd3c',
  piso: '#e6d8b8',
  asfalto: '#6f6b63',
  faixa: '#f8f1e0',
  terra: '#a7714a',
  terraEscura: '#7a4f30',
  minerio: '#b0563a',
  carvao: '#3a3b3e',
  lavoura: '#8fd14f',
  lavouraMadura: '#e6c45a',
  celeiro: '#c0603a',
  copa: '#4f9a3a',
  copaClara: '#7cc14f',
  tronco: '#7a4f30',
  pneu: '#232220',
  laranja: '#e8894a',
  azul: '#3f7fc0',
} as const;

/** Chão de cada tipo de negócio, o "azulejo" grosso por baixo dos sprites da identidade. */
export const CHAO: Record<Category, string> = {
  retail: '#e07a3a',
  industry: '#d0682f',
  farm: '#c4622d',
  mine: '#a7714a',
  warehouse: '#9c7fa6',
  logistics: '#3f7fc0',
};

// ---------------------------------------------------------------------------------------------
// Materiais e peças básicas

// Luz em três tons (sombra, meia-luz, luz), como numa paleta de pixel art.
export const degraus = new THREE.DataTexture(
  new Uint8Array([120, 195, 255]),
  3,
  1,
  THREE.RedFormat,
);
degraus.minFilter = THREE.NearestFilter;
degraus.magFilter = THREE.NearestFilter;
degraus.needsUpdate = true;

const materiais = new Map<string, THREE.MeshToonMaterial>();
function material(cor: string) {
  let m = materiais.get(cor);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: cor, gradientMap: degraus });
    materiais.set(cor, m);
  }
  return m;
}
const materialContorno = new THREE.LineBasicMaterial({
  color: COR.contorno,
  transparent: true,
  opacity: 0.55,
});

/** Uma peça com contorno escuro nas arestas (o "traço" dos desenhos do pacote). */
function peca(geometria: THREE.BufferGeometry, cor: string, x = 0, y = 0, z = 0, contorno = true) {
  const malha = new THREE.Mesh(geometria, material(cor));
  malha.position.set(x, y, z);
  malha.castShadow = true;
  malha.receiveShadow = true;
  if (contorno) {
    const traco = new THREE.LineSegments(new THREE.EdgesGeometry(geometria, 30), materialContorno);
    traco.layers.set(CAMADA_TRACOS);
    malha.add(traco);
  }
  return malha;
}

/** Caixa apoiada no chão: (x, z) é o centro da base e y a altura da base. */
function caixa(
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  cor: string,
  x = 0,
  y = 0,
  z = 0,
  contorno = true,
) {
  const m = peca(new THREE.BoxGeometry(w, h, d), cor, x, y + h / 2, z, contorno);
  g.add(m);
  return m;
}

function cilindro(
  g: THREE.Group,
  r: number,
  h: number,
  cor: string,
  x = 0,
  y = 0,
  z = 0,
  lados = 14,
) {
  const m = peca(new THREE.CylinderGeometry(r, r, h, lados), cor, x, y + h / 2, z);
  g.add(m);
  return m;
}

/** Telhado de duas águas ao longo de X (cumeeira paralela à frente). */
function duasAguas(
  g: THREE.Group,
  w: number,
  d: number,
  h: number,
  cor: string,
  x = 0,
  y = 0,
  z = 0,
) {
  const forma = new THREE.Shape();
  forma.moveTo(-d / 2, 0);
  forma.lineTo(d / 2, 0);
  forma.lineTo(0, h);
  forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  geo.rotateY(Math.PI / 2);
  const m = peca(geo, cor, x, y, z);
  g.add(m);
  return m;
}

/** Telhado em dente de serra (galpão industrial), com a face de vidro voltada para trás. */
function denteDeSerra(
  g: THREE.Group,
  w: number,
  d: number,
  dentes: number,
  h: number,
  cor: string,
  y: number,
) {
  const passo = d / dentes;
  for (let i = 0; i < dentes; i++) {
    const forma = new THREE.Shape();
    forma.moveTo(0, 0);
    forma.lineTo(passo, 0);
    forma.lineTo(passo, h);
    forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma, { depth: w, bevelEnabled: false });
    geo.translate(-d / 2 + i * passo, 0, -w / 2);
    geo.rotateY(Math.PI / 2);
    g.add(peca(geo, cor, 0, y, 0));
    // vidro na face vertical do dente
    caixa(
      g,
      w * 0.92,
      h * 0.7,
      0.08,
      COR.vidro,
      0,
      y + h * 0.1,
      d / 2 - (i + 1) * passo + 0.05,
      false,
    );
  }
}

/** Fileira de janelas numa fachada voltada para +Z. */
function janelas(
  g: THREE.Group,
  larguraFachada: number,
  zFachada: number,
  andares: number,
  alturaAndar: number,
  base = 0,
  x = 0,
  porAndar = Math.max(2, Math.floor(larguraFachada / 2.6)),
  cor: string = COR.vidro,
) {
  const passo = larguraFachada / porAndar;
  for (let a = 0; a < andares; a++)
    for (let i = 0; i < porAndar; i++) {
      const cx = x - larguraFachada / 2 + passo * (i + 0.5);
      const cy = base + a * alturaAndar + alturaAndar * 0.35;
      // moldura clara, vidro e peitoril: a janela lê como janela mesmo de longe
      caixa(
        g,
        passo * 0.66,
        alturaAndar * 0.56,
        0.1,
        COR.branco,
        cx,
        cy - alturaAndar * 0.05,
        zFachada,
        false,
      );
      caixa(g, passo * 0.54, alturaAndar * 0.44, 0.14, cor, cx, cy, zFachada, false);
      caixa(
        g,
        passo * 0.74,
        0.14,
        0.32,
        COR.branco,
        cx,
        cy - alturaAndar * 0.07,
        zFachada + 0.1,
        false,
      );
    }
}

function arvore(g: THREE.Group, x: number, z: number, escala = 1) {
  cilindro(g, 0.25 * escala, 1.6 * escala, COR.tronco, x, 0, z, 6);
  const copa = peca(
    new THREE.IcosahedronGeometry(1.6 * escala, 1),
    escala > 1 ? COR.copa : COR.copaClara,
    x,
    2.6 * escala,
    z,
  );
  g.add(copa);
}

function carro(g: THREE.Group, x: number, z: number, cor: string, girar = 0) {
  const c = new THREE.Group();
  caixa(c, 1.8, 0.7, 4, cor, 0, 0.3);
  caixa(c, 1.6, 0.6, 2, COR.vidro, 0, 1, -0.2);
  for (const [dx, dz] of [
    [-0.9, 1.3],
    [0.9, 1.3],
    [-0.9, -1.3],
    [0.9, -1.3],
  ]) {
    const roda = peca(
      new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8),
      COR.pneu,
      dx,
      0.35,
      dz,
      false,
    );
    roda.rotation.z = Math.PI / 2;
    c.add(roda);
  }
  c.position.set(x, 0, z);
  c.rotation.y = girar;
  g.add(c);
}

function caminhao(g: THREE.Group, x: number, z: number, cor: string, girar = 0) {
  const c = new THREE.Group();
  caixa(c, 2.4, 2.2, 2.2, cor, 0, 0.5, 4.2);
  caixa(c, 2.2, 0.8, 0.1, COR.vidro, 0, 1.7, 5.31, false);
  caixa(c, 2.5, 2.8, 7, COR.branco, 0, 0.6, -0.8);
  caixa(c, 2.52, 0.5, 7.02, cor, 0, 2.5, -0.8, false);
  for (const dz of [4.2, 0.6, -3.2]) {
    for (const dx of [-1.15, 1.15]) {
      const roda = peca(
        new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10),
        COR.pneu,
        dx,
        0.5,
        dz,
        false,
      );
      roda.rotation.z = Math.PI / 2;
      c.add(roda);
    }
  }
  c.position.set(x, 0, z);
  c.rotation.y = girar;
  g.add(c);
}

/** Chaminé com faixas vermelhas e brancas. */
function chamine(g: THREE.Group, x: number, z: number, h: number, r = 0.9, y = 0) {
  const faixas = 5;
  for (let i = 0; i < faixas; i++)
    cilindro(
      g,
      r * (1 - i * 0.04),
      h / faixas,
      i % 2 ? COR.branco : COR.vermelho,
      x,
      y + (i * h) / faixas,
      z,
      12,
    );
}

function silo(
  g: THREE.Group,
  x: number,
  z: number,
  r: number,
  h: number,
  cor: string = COR.concretoClaro,
) {
  cilindro(g, r, h, cor, x, 0, z, 16);
  const cupula = peca(new THREE.ConeGeometry(r * 1.05, r * 0.8, 16), COR.cinza, x, h + r * 0.4, z);
  g.add(cupula);
  // anel de reforço
  cilindro(g, r * 1.03, 0.3, COR.cinzaEscuro, x, h * 0.55, z, 16);
}

function monte(g: THREE.Group, x: number, z: number, r: number, h: number, cor: string) {
  g.add(peca(new THREE.ConeGeometry(r, h, 9), cor, x, h / 2, z));
}

function placa(g: THREE.Group, w: number, h: number, cor: string, x: number, y: number, z: number) {
  caixa(g, w, h, 0.3, cor, x, y, z);
  caixa(g, w * 0.7, h * 0.3, 0.32, COR.branco, x, y + h * 0.35, z, false);
}

/** Toldo listrado sobre a vitrine. */
function toldo(g: THREE.Group, w: number, zFrente: number, y: number) {
  const listras = Math.max(4, Math.round(w / 1.2));
  const passo = w / listras;
  for (let i = 0; i < listras; i++) {
    const t = peca(
      new THREE.BoxGeometry(passo, 0.12, 1.6),
      i % 2 ? COR.branco : COR.vermelho,
      -w / 2 + passo * (i + 0.5),
      y,
      zFrente + 0.7,
      false,
    );
    t.rotation.x = 0.35;
    g.add(t);
  }
}

function piso(g: THREE.Group, w: number, d: number, cor: string = COR.piso, x = 0, z = 0) {
  caixa(g, w, 0.25, d, cor, x, 0, z, false);
}

function estacionamento(
  g: THREE.Group,
  w: number,
  d: number,
  x: number,
  z: number,
  vagas: number,
  cores: string[],
) {
  caixa(g, w, 0.28, d, COR.asfalto, x, 0, z, false);
  const passo = w / vagas;
  for (let i = 0; i <= vagas; i++)
    caixa(g, 0.15, 0.3, d * 0.45, COR.faixa, x - w / 2 + passo * i, 0, z - d * 0.2, false);
  cores.forEach((cor, i) => carro(g, x - w / 2 + passo * (i * 2 + 0.5), z - d * 0.2, cor));
}

// ---------------------------------------------------------------------------------------------
// Negócios, por nível

function loja(g: THREE.Group, n: Nivel) {
  if (n === 1) {
    piso(g, 18, 16);
    caixa(g, 12, 4.5, 9, COR.creme);
    caixa(g, 12.4, 0.6, 9.4, COR.turquesa, 0, 4.5);
    caixa(g, 8, 2.2, 0.15, COR.vidro, 0, 0.4, 4.55, false);
    caixa(g, 1.4, 2.4, 0.16, COR.porta, 4.3, 0, 4.56, false);
    toldo(g, 9, 4.5, 3.1);
    placa(g, 6, 1.4, COR.amarelo, 0, 5.1, 3.8);
    arvore(g, -7, 6);
    return;
  }
  if (n === 2) {
    piso(g, 24, 20);
    caixa(g, 14, 8, 10, COR.creme);
    caixa(g, 14.4, 0.6, 10.4, COR.turquesa, 0, 8);
    caixa(g, 10, 2.4, 0.15, COR.vidro, 0, 0.4, 5.05, false);
    caixa(g, 1.4, 2.6, 0.16, COR.porta, 5.6, 0, 5.06, false);
    janelas(g, 12, 5.05, 1, 3.2, 4.4);
    toldo(g, 11, 5, 3.3);
    placa(g, 8, 1.8, COR.amarelo, 0, 8.6, 4.2);
    caixa(g, 2, 1.2, 2, COR.cinza, -4, 8.6, -2);
    estacionamento(g, 8, 8, 11.5, 2, 3, [COR.azul]);
    arvore(g, -9, 7);
    return;
  }
  if (n === 3) {
    piso(g, 40, 32);
    caixa(g, 26, 6.5, 16, COR.creme, 0, 0, -4);
    caixa(g, 26.4, 0.7, 16.4, COR.turquesa, 0, 6.5, -4);
    caixa(g, 20, 3.4, 0.15, COR.vidro, 0, 0.4, 4.05, false);
    caixa(g, 3, 3, 0.16, COR.porta, 0, 0, 4.07, false);
    toldo(g, 22, 4, 4.2);
    placa(g, 12, 2.4, COR.vermelho, 0, 7.2, 3.2);
    for (const x of [-9, 0, 9]) caixa(g, 2.4, 1.4, 2.4, COR.cinza, x, 7.2, -7);
    estacionamento(g, 30, 10, 0, 11, 8, [COR.azul, COR.vermelho, COR.amarelo, COR.branco]);
    arvore(g, -17, 12);
    arvore(g, 17, 12);
    return;
  }
  piso(g, 56, 44);
  caixa(g, 36, 9, 22, COR.concretoClaro, 0, 0, -6);
  caixa(g, 36.4, 0.8, 22.4, COR.turquesa, 0, 9, -6);
  caixa(g, 9, 18, 9, COR.cinza, -12, 0, -6);
  caixa(g, 9.4, 0.8, 9.4, COR.turquesaEscuro, -12, 18, -6);
  janelas(g, 8, -1.45, 4, 3.2, 9.4, -12, 3);
  caixa(g, 26, 4.4, 0.15, COR.vidro, 4, 0.4, 5.05, false);
  caixa(g, 4, 3.6, 0.16, COR.porta, 4, 0, 5.07, false);
  placa(g, 7, 2.6, COR.amarelo, -12, 18.8, -1.4);
  placa(g, 16, 2.6, COR.vermelho, 6, 9.6, 4.4);
  for (const x of [0, 8, 14]) caixa(g, 2.6, 1.6, 2.6, COR.cinza, x, 9.8, -12);
  estacionamento(g, 44, 12, 0, 15, 11, [
    COR.azul,
    COR.vermelho,
    COR.amarelo,
    COR.branco,
    COR.laranja,
    COR.azul,
  ]);
  for (const x of [-24, -12, 12, 24]) arvore(g, x, 21.5);
}

function fabrica(g: THREE.Group, n: Nivel) {
  const galpao = (w: number, d: number, h: number, x: number, z: number) => {
    const s = new THREE.Group();
    // galpão azul com telhado de aço, como a siderúrgica da identidade
    caixa(s, w, h, d, COR.azul);
    denteDeSerra(s, w, d, Math.max(2, Math.round(d / 4)), 2.2, COR.cinza, h);
    caixa(s, 4, 3.6, 0.15, COR.cinzaEscuro, 0, 0, d / 2 + 0.05, false);
    for (let i = 0; i < 3; i++)
      caixa(s, 0.5, 3.6, 0.17, COR.amarelo, -1.6 + i * 1.6, 0, d / 2 + 0.07, false);
    s.position.set(x, 0, z);
    g.add(s);
  };
  const escritorio = (x: number, z: number, andares: number) => {
    caixa(g, 7, andares * 3.2, 6, COR.tijolo, x, 0, z);
    caixa(g, 7.3, 0.4, 6.3, COR.turquesaEscuro, x, andares * 3.2, z);
    janelas(g, 6, z + 3.05, andares, 3.2, 0, x, 3);
  };
  const tanque = (x: number, z: number, r = 2.4, h = 6) => {
    cilindro(g, r, h, COR.branco, x, 0, z, 16);
    cilindro(g, r * 1.02, 0.4, COR.laranja, x, h * 0.6, z, 16);
  };
  if (n === 1) {
    piso(g, 26, 22, COR.piso);
    galpao(14, 12, 5.5, 0, -1);
    chamine(g, 6, -6, 12, 0.8);
    caminhao(g, -9, 6, COR.azul, Math.PI / 2);
    return;
  }
  if (n === 2) {
    piso(g, 34, 28, COR.piso);
    galpao(18, 14, 6, 2, -2);
    escritorio(-11, 4, 2);
    chamine(g, 9, -8, 15, 0.9);
    tanque(-11, -6);
    caminhao(g, 4, 10, COR.azul, Math.PI / 2);
    return;
  }
  if (n === 3) {
    piso(g, 46, 36, COR.piso);
    galpao(18, 14, 6.5, -6, -6);
    galpao(14, 12, 6, 13, -7);
    escritorio(-17, 10, 3);
    chamine(g, 4, -13, 19, 1);
    chamine(g, 20, -13, 16, 0.9);
    tanque(8, 8);
    tanque(14, 8);
    caixa(g, 6, 0.5, 0.5, COR.cinzaEscuro, 11, 4.5, 8, false);
    caminhao(g, -4, 12, COR.azul, Math.PI / 2);
    caminhao(g, 2, 14, COR.vermelho, Math.PI / 2);
    return;
  }
  piso(g, 62, 48, COR.piso);
  galpao(22, 16, 7.5, -16, -10);
  galpao(22, 16, 7.5, 9, -10);
  galpao(16, 12, 6.5, 24, 9);
  escritorio(-24, 12, 4);
  chamine(g, -4, -20, 26, 1.3);
  chamine(g, 3, -20, 22, 1.1);
  chamine(g, 22, -20, 18, 1);
  for (const x of [-8, -2, 4]) tanque(x, 12, 2.6, 8);
  caixa(g, 0.8, 0.8, 18, COR.cinzaEscuro, 12, 6, 2, false);
  caminhao(g, -14, 18, COR.azul, Math.PI / 2);
  caminhao(g, 10, 20, COR.vermelho, Math.PI / 2);
  caminhao(g, 18, 22, COR.laranja, Math.PI / 2);
}

function fazenda(g: THREE.Group, n: Nivel) {
  const campo = (w: number, d: number, x: number, z: number, maduro: boolean) => {
    const fileiras = Math.round(d / 2.2);
    for (let i = 0; i < fileiras; i++)
      caixa(
        g,
        w,
        0.35 + (i % 2) * 0.15,
        d / fileiras - 0.5,
        maduro ? COR.lavouraMadura : COR.lavoura,
        x,
        0,
        z - d / 2 + (d / fileiras) * (i + 0.5),
        false,
      );
    caixa(g, w + 1, 0.2, d + 1, COR.terra, x, 0, z, false);
  };
  const celeiro = (x: number, z: number, escala = 1) => {
    const s = new THREE.Group();
    caixa(s, 10, 5, 8, COR.celeiro);
    duasAguas(s, 10.6, 8.6, 3.6, COR.branco, 0, 5, 0);
    caixa(s, 3, 3.6, 0.16, COR.branco, 0, 0, 4.05, false);
    caixa(s, 2.4, 3, 0.17, COR.porta, 0, 0, 4.07, false);
    s.scale.setScalar(escala);
    s.position.set(x, 0, z);
    g.add(s);
  };
  const casa = (x: number, z: number) => {
    caixa(g, 7, 3.2, 6, COR.creme, x, 0, z);
    duasAguas(g, 7.4, 6.6, 2.4, COR.vermelho, x, 3.2, z);
    caixa(g, 1.2, 2.2, 0.15, COR.porta, x, 0, z + 3.05, false);
  };
  const trator = (x: number, z: number) => {
    const t = new THREE.Group();
    caixa(t, 1.8, 1.2, 3, COR.vermelho, 0, 0.6);
    caixa(t, 1.4, 1.4, 1.4, COR.vidro, 0, 1.8, -0.4);
    for (const [dx, dz, r] of [
      [-1.1, -0.9, 0.9],
      [1.1, -0.9, 0.9],
      [-1, 1.1, 0.55],
      [1, 1.1, 0.55],
    ]) {
      const roda = peca(new THREE.CylinderGeometry(r, r, 0.5, 10), COR.pneu, dx, r, dz, false);
      roda.rotation.z = Math.PI / 2;
      t.add(roda);
    }
    t.position.set(x, 0, z);
    g.add(t);
  };
  if (n === 1) {
    campo(26, 18, 4, -6, false);
    celeiro(-12, 8, 0.85);
    arvore(g, -18, -4, 1.2);
    return;
  }
  if (n === 2) {
    campo(30, 22, 6, -8, true);
    celeiro(-14, 10);
    silo(g, -5, 12, 2.2, 9);
    arvore(g, -22, -6, 1.2);
    trator(10, 8);
    return;
  }
  if (n === 3) {
    campo(30, 22, 0, -14, true);
    campo(22, 22, 30, -14, false);
    celeiro(-12, 12);
    silo(g, -1, 14, 2.4, 10);
    silo(g, 5, 14, 2.4, 10);
    caixa(g, 10, 4, 7, COR.cinza, 18, 0, 12);
    duasAguas(g, 10.4, 7.4, 2, COR.turquesa, 18, 4, 12);
    trator(28, 10);
    arvore(g, -24, 0, 1.2);
    return;
  }
  campo(32, 24, -14, -16, true);
  campo(32, 24, 22, -16, false);
  campo(26, 16, 26, 12, true);
  celeiro(-20, 14);
  casa(-30, -2);
  for (const x of [-6, 0, 6, 12]) silo(g, x, 14, 2.6, 12);
  caixa(g, 12, 4.5, 8, COR.cinza, -20, 0, 26);
  duasAguas(g, 12.4, 8.4, 2.2, COR.turquesa, -20, 4.5, 26);
  trator(8, 4);
  caminhao(g, 2, 24, COR.amarelo, Math.PI / 2);
  for (const z of [-30, -20, -10]) arvore(g, -36, z, 1.3);
}

function mina(g: THREE.Group, n: Nivel) {
  const torre = (x: number, z: number, h: number) => {
    for (const [dx, dz] of [
      [-1.6, -1.6],
      [1.6, -1.6],
      [-1.6, 1.6],
      [1.6, 1.6],
    ])
      caixa(g, 0.35, h, 0.35, COR.vermelho, x + dx, 0, z + dz);
    for (let y = 3; y < h; y += 3.5) caixa(g, 3.6, 0.25, 3.6, COR.vermelho, x, y, z, false);
    const roda = peca(new THREE.TorusGeometry(1.4, 0.22, 6, 14), COR.cinzaEscuro, x, h + 1.2, z);
    g.add(roda);
    caixa(g, 0.3, 2.4, 0.3, COR.cinzaEscuro, x, h - 0.2, z);
  };
  const esteira = (x: number, z: number, comprimento: number, altura: number) => {
    const e = peca(
      new THREE.BoxGeometry(1.2, 0.5, comprimento),
      COR.cinzaEscuro,
      x,
      altura / 2 + 0.6,
      z,
    );
    e.rotation.x = -Math.atan2(altura, comprimento);
    g.add(e);
    caixa(g, 0.3, altura, 0.3, COR.cinzaEscuro, x, 0, z + comprimento / 2 - 1);
  };
  const galpao = (x: number, z: number, w: number, d: number) => {
    caixa(g, w, 4.5, d, COR.cinza, x, 0, z);
    duasAguas(g, w + 0.4, d + 0.4, 1.8, COR.turquesa, x, 4.5, z);
  };
  if (n === 1) {
    caixa(g, 28, 0.25, 24, COR.terra, 0, 0, 0, false);
    torre(-6, -4, 10);
    monte(g, 6, 2, 5, 4.5, COR.minerio);
    galpao(-8, 7, 7, 5);
    return;
  }
  if (n === 2) {
    caixa(g, 34, 0.25, 30, COR.terra, 0, 0, 0, false);
    torre(-9, -6, 13);
    monte(g, 8, -2, 6, 6, COR.minerio);
    esteira(1, -4, 12, 6);
    galpao(-9, 9, 9, 6);
    caminhao(g, 8, 10, COR.amarelo, Math.PI / 2);
    return;
  }
  if (n === 3) {
    caixa(g, 44, 0.25, 36, COR.terra, 0, 0, 0, false);
    torre(-12, -8, 15);
    monte(g, 8, -6, 7, 7, COR.minerio);
    monte(g, 18, 6, 5.5, 5, COR.carvao);
    esteira(0, -6, 14, 7);
    galpao(-12, 10, 11, 7);
    caminhao(g, 6, 12, COR.amarelo, Math.PI / 2);
    caminhao(g, 12, 14, COR.amarelo, Math.PI / 2);
    return;
  }
  caixa(g, 58, 0.25, 46, COR.terra, 0, 0, 0, false);
  caixa(g, 26, 0.3, 18, COR.terraEscura, 14, 0, -10, false);
  torre(-18, -12, 18);
  torre(-8, -14, 15);
  monte(g, 10, -10, 8, 8, COR.minerio);
  monte(g, 22, -6, 7, 7, COR.minerio);
  monte(g, 22, 10, 6, 6, COR.carvao);
  esteira(-2, -10, 16, 8);
  galpao(-16, 10, 14, 9);
  caixa(g, 8, 9, 7, COR.concreto, 2, 0, 12);
  chamine(g, 6, 14, 14, 0.8);
  caminhao(g, 10, 18, COR.amarelo, Math.PI / 2);
  caminhao(g, 16, 18, COR.amarelo, Math.PI / 2);
  caminhao(g, 22, 18, COR.amarelo, Math.PI / 2);
}

function armazem(g: THREE.Group, n: Nivel) {
  const deposito = (w: number, d: number, x: number, z: number) => {
    caixa(g, w, 6, d, COR.concretoClaro, x, 0, z);
    duasAguas(g, w + 0.4, d + 0.4, 2.6, COR.turquesa, x, 6, z);
    for (let i = 0; i < Math.floor(w / 6); i++)
      caixa(g, 3.6, 4, 0.15, COR.cinzaEscuro, x - w / 2 + 3 + i * 6, 0, z + d / 2 + 0.05, false);
  };
  const silos = (quantos: number, x0: number, z: number) => {
    for (let i = 0; i < quantos; i++) silo(g, x0 + i * 6, z, 2.6, 13);
    caixa(g, quantos * 6, 0.7, 1, COR.cinzaEscuro, x0 + (quantos - 1) * 3, 15, z, false);
  };
  if (n === 1) {
    piso(g, 30, 24);
    deposito(16, 10, -5, 3);
    silos(2, 6, -6);
    return;
  }
  if (n === 2) {
    piso(g, 36, 28);
    deposito(18, 12, -7, 5);
    silos(3, 2, -8);
    caminhao(g, 10, 10, COR.azul, Math.PI / 2);
    return;
  }
  if (n === 3) {
    piso(g, 46, 36);
    deposito(24, 14, -9, 8);
    silos(5, -12, -10);
    caminhao(g, 12, 12, COR.azul, Math.PI / 2);
    caminhao(g, 18, 12, COR.vermelho, Math.PI / 2);
    return;
  }
  piso(g, 60, 46);
  deposito(30, 16, -12, 10);
  deposito(18, 14, 20, 10);
  silos(6, -20, -12);
  silos(3, 18, -12);
  for (const x of [-4, 4, 12]) caminhao(g, x, 22, COR.azul, Math.PI / 2);
}

function transportadora(g: THREE.Group, n: Nivel) {
  const garagem = (w: number, x: number, z: number) => {
    caixa(g, w, 6, 10, COR.cinza, x, 0, z);
    caixa(g, w + 0.4, 0.6, 10.4, COR.turquesa, x, 6, z);
    const portas = Math.floor(w / 5);
    for (let i = 0; i < portas; i++)
      caixa(g, 3.8, 4.6, 0.15, COR.amarelo, x - w / 2 + 2.5 + i * 5, 0, z + 5.05, false);
  };
  const frota = (quantos: number, x0: number, z: number) => {
    const cores = [COR.azul, COR.vermelho, COR.laranja, COR.turquesaEscuro, COR.amarelo, COR.azul];
    for (let i = 0; i < quantos; i++) caminhao(g, x0 + i * 4, z, cores[i % cores.length]);
  };
  if (n === 1) {
    piso(g, 26, 26, COR.asfalto);
    garagem(10, -4, -6);
    caixa(g, 5, 3, 4, COR.creme, 7, 0, -7);
    frota(1, 4, 7);
    return;
  }
  if (n === 2) {
    piso(g, 32, 30, COR.asfalto);
    garagem(15, -4, -8);
    caixa(g, 6, 3.2, 5, COR.creme, 10, 0, -9);
    frota(3, -6, 7);
    return;
  }
  if (n === 3) {
    piso(g, 42, 36, COR.asfalto);
    garagem(20, -6, -11);
    caixa(g, 7, 6.4, 6, COR.tijolo, 13, 0, -12);
    janelas(g, 6, -8.95, 2, 3.2, 0, 13, 3);
    frota(5, -12, 8);
    cilindro(g, 0.6, 2, COR.vermelho, 16, 0, 6, 8);
    caixa(g, 6, 0.4, 4, COR.branco, 16, 4, 6);
    return;
  }
  piso(g, 58, 46, COR.asfalto);
  garagem(30, -10, -14);
  garagem(15, 18, -14);
  caixa(g, 8, 9.6, 7, COR.tijolo, 20, 0, 8);
  janelas(g, 7, 11.55, 3, 3.2, 0, 20, 3);
  frota(6, -22, 6);
  frota(5, -20, 16);
}

function obra(g: THREE.Group) {
  piso(g, 22, 18, COR.terra);
  caixa(g, 14, 0.6, 10, COR.concreto, 0, 0, -1);
  // andaime: postes e travessas
  for (const x of [-7, -3.5, 0, 3.5, 7])
    for (const z of [-6, 4]) caixa(g, 0.18, 7, 0.18, COR.amarelo, x, 0, z, false);
  for (const y of [2.4, 4.8, 7]) {
    caixa(g, 14.2, 0.18, 0.18, COR.amarelo, 0, y, -6, false);
    caixa(g, 14.2, 0.18, 0.18, COR.amarelo, 0, y, 4, false);
  }
  caixa(g, 13, 3, 9, COR.concretoClaro, 0, 0.6, -1);
  // guindaste
  for (let y = 0; y < 18; y += 2) caixa(g, 1.2, 2, 1.2, COR.amarelo, 9, y, -7);
  caixa(g, 16, 0.8, 0.8, COR.amarelo, 5, 18, -7);
  caixa(g, 2, 1.6, 1.6, COR.cinzaEscuro, 12, 17.2, -7);
  caixa(g, 0.08, 6, 0.08, COR.contorno, 0, 12, -7, false);
  caixa(g, 1.6, 1, 1.6, COR.laranja, 0, 11, -7);
  monte(g, -7, 7, 2.2, 2, COR.terraEscura);
  caixa(g, 3, 1.2, 2, COR.tijolo, 6, 0, 7);
}

const construtores: Record<Category, (g: THREE.Group, n: Nivel) => void> = {
  retail: loja,
  industry: fabrica,
  farm: fazenda,
  mine: mina,
  warehouse: armazem,
  logistics: transportadora,
};

/** Monta o modelo de um negócio no estágio pedido. O grupo retornado é novo a cada chamada. */
// Espessura do azulejo de chão (metros), abaixo do nível da rua.
export const ESPESSURA_DO_CHAO = 1.8;

export function construirModelo(categoria: Category, estagio: Estagio): THREE.Group {
  const g = new THREE.Group();
  if (estagio === 'obra') obra(g);
  else construtores[categoria](g, estagio);
  // Azulejo grosso por baixo, com a cor do tipo de negócio (o "tile" dos sprites).
  const caixaModelo = new THREE.Box3().setFromObject(g);
  const largura = caixaModelo.max.x - caixaModelo.min.x + 3;
  const fundo = caixaModelo.max.z - caixaModelo.min.z + 3;
  caixa(
    g,
    largura,
    ESPESSURA_DO_CHAO,
    fundo,
    estagio === 'obra' ? COR.terra : CHAO[categoria],
    (caixaModelo.max.x + caixaModelo.min.x) / 2,
    -ESPESSURA_DO_CHAO,
    (caixaModelo.max.z + caixaModelo.min.z) / 2,
  );
  g.userData = { categoria, estagio };
  return g;
}

/** Bandeira do dono, para o jogador achar os próprios negócios no meio da cidade. */
export function bandeira(cor: string, altura = 14): THREE.Group {
  const g = new THREE.Group();
  caixa(g, 0.3, altura, 0.3, COR.branco, 0, 0, 0);
  const pano = peca(new THREE.BoxGeometry(3.4, 2, 0.12), cor, 1.85, altura - 1.2, 0);
  g.add(pano);
  return g;
}

/** Luz do kit: céu claro e sol do alto à esquerda, como nos desenhos do pacote. */
export function luzes(alcance = 70): THREE.Object3D[] {
  const ceu = new THREE.HemisphereLight('#ffffff', '#b8a780', 1.15);
  // Sol baixo à esquerda: a lateral esquerda fica clara e a frente meia-sombra, como no pacote.
  const sol = new THREE.DirectionalLight('#fff6e4', 2.3);
  sol.position.set(-90, 120, 35);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -alcance;
  sol.shadow.camera.right = alcance;
  sol.shadow.camera.top = alcance;
  sol.shadow.camera.bottom = -alcance;
  sol.shadow.camera.far = 400;
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.05;
  return [ceu, sol];
}
