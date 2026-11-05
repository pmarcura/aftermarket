/**
 * Quarteirões de exemplo para a vitrine (/modelos): plantas inventadas, mas com as medidas de
 * cidade brasileira, para avaliar casas, sobrados, prédios e galpões como ficam no mapa.
 */
import * as THREE from 'three';
import { construirPredios, type Planta, type Ponto } from './predios3d';
import { criarMaterialDosPredios } from './fachadas';

export const EXEMPLOS_DE_CIDADE = ['casas', 'sobrados', 'predios', 'galpoes', 'quadra'] as const;
export type ExemploDeCidade = (typeof EXEMPLOS_DE_CIDADE)[number];
export const NOME_DO_EXEMPLO: Record<ExemploDeCidade, string> = {
  casas: 'Casas',
  sobrados: 'Sobrados',
  predios: 'Prédios',
  galpoes: 'Galpões',
  quadra: 'Quarteirão',
};

const ret = (x: number, z: number, w: number, d: number): Ponto[] => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];
const emL = (x: number, z: number, w: number, d: number, cw: number, cd: number): Ponto[] => [
  [x, z],
  [x + w, z],
  [x + w, z + d - cd],
  [x + w - cw, z + d - cd],
  [x + w - cw, z + d],
  [x, z + d],
];

let proximo = 10;
const planta = (contorno: Ponto[], altura?: number): Planta => ({
  id: (proximo += 70),
  contorno,
  altura,
});

function plantas(tipo: ExemploDeCidade): Planta[] {
  proximo = 10;
  switch (tipo) {
    case 'casas':
      return [
        ...[0, 1, 2, 3].map((i) => planta(ret(-24 + i * 12, -14, 9, 12))),
        ...[0, 1, 2].map((i) => planta(ret(-20 + i * 14, 4, 10, 11))),
        planta(emL(22, 4, 12, 12, 5, 5)),
      ];
    case 'sobrados':
      return [0, 1, 2, 3, 4].map((i) => planta(ret(-30 + i * 12, -6, 10, 13), 6.5));
    case 'predios':
      return [
        planta(ret(-26, -10, 16, 16), 18),
        planta(emL(-4, -12, 18, 20, 7, 8), 33),
        planta(ret(20, -8, 14, 14), 45),
      ];
    case 'galpoes':
      return [planta(ret(-34, -18, 36, 24)), planta(emL(8, -14, 30, 30, 12, 12), 9)];
    case 'quadra':
      return [
        ...[0, 1, 2, 3, 4, 5].map((i) => planta(ret(-45 + i * 11, -38, 9, 13))),
        ...[0, 1, 2, 3].map((i) => planta(ret(-45 + i * 11, 26, 9, 12), i % 2 ? 6.5 : undefined)),
        planta(ret(24, -36, 18, 18), 24),
        planta(ret(4, -6, 34, 26)),
        planta(emL(-44, -12, 22, 26, 9, 10)),
      ];
  }
}

const material = criarMaterialDosPredios();

/** Grupo pronto para a vitrine: os prédios do exemplo e um chão de calçada por baixo. */
export function construirExemplo(tipo: ExemploDeCidade): THREE.Group {
  const g = new THREE.Group();
  const geo = construirPredios(plantas(tipo));
  if (geo) {
    const malha = new THREE.Mesh(geo, material);
    malha.castShadow = malha.receiveShadow = true;
    g.add(malha);
  }
  const caixa = new THREE.Box3().setFromObject(g);
  const chao = new THREE.Mesh(
    new THREE.BoxGeometry(caixa.max.x - caixa.min.x + 10, 0.4, caixa.max.z - caixa.min.z + 10),
    new THREE.MeshLambertMaterial({ color: '#e6d8b8' }),
  );
  chao.position.set((caixa.max.x + caixa.min.x) / 2, -0.2, (caixa.max.z + caixa.min.z) / 2);
  chao.receiveShadow = true;
  g.add(chao);
  return g;
}
