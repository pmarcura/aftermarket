/**
 * Fachadas em pixel art dos prédios do mapa, na paleta da identidade: cada fachada é um módulo
 * de 16×16 pixels que vale 3 m de largura por 1 andar, repetido pela parede.
 *
 * O canal alfa diz o que é parede: 255 = parede (pega a cor do prédio), 0 = cor própria (moldura
 * branca, vidro cor de céu), valores no meio escurecem a cor da parede (rodapé do andar). Assim
 * uma textura só serve para prédios de todas as cores.
 */
import * as THREE from 'three';
import { degraus } from './modelos3d';

/** Paredes (casa, prédio, galpão) e coberturas (laje, telha, metal). */
export type Fachada = 'casa' | 'predio' | 'galpao' | 'laje' | 'telha' | 'metal';
const ORDEM: Fachada[] = ['casa', 'predio', 'galpao', 'laje', 'telha', 'metal'];
export const INDICE_FACHADA: Record<Fachada, number> = {
  casa: 0,
  predio: 1,
  galpao: 2,
  laje: 3,
  telha: 4,
  metal: 5,
};
const COBERTURA = new Set<Fachada>(['laje', 'telha', 'metal']);
const ESCURO: [number, number, number] = [40, 26, 14];
const CLARO: [number, number, number] = [255, 246, 228];

const LADO = 16;
const MOLDURA: [number, number, number] = [248, 241, 224]; // #f8f1e0
const VIDRO: [number, number, number] = [108, 184, 232]; // #6cb8e8 (céu)
const BRILHO: [number, number, number] = [214, 238, 250];
const SOMBRA_VIDRO: [number, number, number] = [63, 127, 192]; // #3f7fc0

type Pintor = (x: number, y: number) => [number, number, number, number] | null;

/** Janela com moldura, vidro, brilho no canto e peitoril. y = 0 é o pé do andar. */
function janela(x0: number, x1: number, y0: number, y1: number, divisao = false): Pintor {
  return (x, y) => {
    if (y === y0 - 1 && x >= x0 - 1 && x <= x1 + 1) return [...MOLDURA, 0]; // peitoril
    if (x < x0 || x > x1 || y < y0 || y > y1) return null;
    if (x === x0 || x === x1 || y === y0 || y === y1) return [...MOLDURA, 0];
    if (divisao && x === Math.floor((x0 + x1) / 2)) return [...MOLDURA, 0];
    if (y === y1 - 1 && x === x0 + 1) return [...BRILHO, 0];
    if (y === y0 + 1) return [...SOMBRA_VIDRO, 0];
    return [...VIDRO, 0];
  };
}

const PINTURAS: Record<Fachada, Pintor[]> = {
  // casa: uma janela por módulo, à meia altura
  casa: [janela(4, 11, 5, 11)],
  // prédio: janela larga com divisão no meio, quase da largura do módulo
  predio: [janela(2, 13, 4, 12, true)],
  // galpão: faixa de janelinhas no alto
  galpao: [janela(2, 6, 11, 13), janela(9, 13, 11, 13)],
  // laje: juntas a cada 3 m e manchas leves de impermeabilização
  laje: [
    (x, y) => (x === 0 || y === 0 ? [...ESCURO, 225] : null),
    (x, y) => ((x * 7 + y * 3) % 23 === 0 ? [...ESCURO, 238] : null),
  ],
  // telha: fiadas (a cada 4 pixels, 75 cm) com a borda de cima clara e a de baixo escura
  telha: [
    (x, y) =>
      y % 4 === 0
        ? [...ESCURO, 185]
        : y % 4 === 3
          ? [...CLARO, 205]
          : x % 8 === (y % 8 < 4 ? 0 : 4)
            ? [...ESCURO, 225]
            : null,
  ],
  // metal: nervuras ao longo da queda do telhado
  metal: [(x) => (x % 8 === 0 ? [...ESCURO, 195] : x % 8 === 1 ? [...CLARO, 210] : null)],
};

/** Atlas com as fachadas e coberturas lado a lado (16 pixels cada). */
export function criarAtlasDeFachadas() {
  const largura = LADO * ORDEM.length;
  const dados = new Uint8Array(largura * LADO * 4);
  ORDEM.forEach((f, coluna) => {
    for (let y = 0; y < LADO; y++)
      for (let x = 0; x < LADO; x++) {
        const k = (y * largura + coluna * LADO + x) * 4;
        let px: [number, number, number, number] = [0, 0, 0, 255]; // parede
        // rodapé do andar: parede um pouco mais escura (coberturas têm o próprio desenho)
        if (y === 0 && !COBERTURA.has(f)) px = [40, 30, 20, 205];
        for (const p of PINTURAS[f]) px = p(x, y) ?? px;
        dados.set(px, k);
      }
  });
  const t = new THREE.DataTexture(dados, largura, LADO, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * Material dos prédios: a mesma luz em três tons dos negócios; a cor da parede vem do vértice e
 * a fachada do atlas. Vértices com fachada −1 (lajes, telhados) usam só a cor do vértice.
 */
export function criarMaterialDosPredios(atlas = criarAtlasDeFachadas()) {
  const m = new THREE.MeshToonMaterial({ map: atlas, gradientMap: degraus, vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float fachada;\nvarying float vFachada;',
      )
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFachada = fachada;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFachada;')
      .replace(
        '#include <map_fragment>',
        `if (vFachada >= 0.0) {
          vec2 local = fract(vMapUv);
          vec2 atlasUv = vec2((vFachada + local.x) / ${ORDEM.length}.0, local.y);
          vec4 texel = texture2D(map, atlasUv);
          diffuseColor.rgb = mix(texel.rgb, vColor.rgb, texel.a);
        } else {
          diffuseColor.rgb = vColor.rgb;
        }`,
      )
      .replace('#include <color_fragment>', '');
  };
  return m;
}
