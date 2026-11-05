import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  classificar,
  construirPredios,
  retanguloMinimo,
  type Planta,
} from '../apps/web/src/features/mapa/predios3d';
import { plantasDoTile } from '../apps/web/src/features/mapa/tile-predios';
import { criarAtlasDeFachadas } from '../apps/web/src/features/mapa/fachadas';
import { buildingsTile } from './fixtures/mvt';

const ret = (w: number, d: number, x = 0, z = 0): [number, number][] => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];

describe('prédios do mapa em 3D', () => {
  it('classifica casa, prédio e galpão pela altura do mapa e pelo tamanho da planta', () => {
    expect(classificar({ id: 10, contorno: ret(9, 12) }).tipo).toBe('casa');
    expect(classificar({ id: 20, contorno: ret(9, 12), altura: 30 }).tipo).toBe('predio');
    expect(classificar({ id: 30, contorno: ret(22, 22) }).tipo).toBe('predio');
    expect(classificar({ id: 40, contorno: ret(40, 30) }).tipo).toBe('galpao');
    // casa retangular ganha telhado de duas águas; planta em L fica com laje
    expect(classificar({ id: 50, contorno: ret(9, 12) }).duasAguas).toBe(true);
    const emL: [number, number][] = [
      [0, 0],
      [12, 0],
      [12, 6],
      [6, 6],
      [6, 12],
      [0, 12],
    ];
    expect(classificar({ id: 60, contorno: emL }).duasAguas).toBe(false);
  });

  it('acha o retângulo mínimo de uma planta girada', () => {
    const a = Math.PI / 6;
    const girado = ret(20, 8, -10, -4).map(([x, z]): [number, number] => [
      x * Math.cos(a) - z * Math.sin(a),
      x * Math.sin(a) + z * Math.cos(a),
    ]);
    const r = retanguloMinimo(girado);
    expect(r.meioU).toBeCloseTo(10, 5);
    expect(r.meioV).toBeCloseTo(4, 5);
  });

  it('monta uma malha válida: sem pontos inválidos, paredes viradas para fora', () => {
    const plantas: Planta[] = [
      { id: 10, contorno: ret(9, 12) },
      { id: 20, contorno: ret(18, 16, 20, 0), altura: 30 },
      { id: 30, contorno: ret(40, 30, 0, 40) },
      // mesmo prédio desenhado no sentido contrário
      { id: 40, contorno: ret(10, 10, 60, 0).reverse() },
    ];
    const g = construirPredios(plantas)!;
    const pos = g.getAttribute('position').array as Float32Array;
    const nor = g.getAttribute('normal').array as Float32Array;
    expect([...pos].some(Number.isNaN)).toBe(false);
    expect(g.getAttribute('fachada').count).toBe(g.getAttribute('position').count);
    // cada face aponta para a normal informada (luz e contorno corretos)
    for (let i = 0; i < pos.length; i += 9) {
      const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
      const b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]);
      const c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
      const n = b.sub(a).cross(c.sub(a));
      const informada = new THREE.Vector3(nor[i], nor[i + 1], nor[i + 2]);
      if (n.lengthSq() > 1e-8) expect(n.dot(informada)).toBeGreaterThan(0);
    }
    // nada abaixo do chão nem absurdamente alto
    const caixa = new THREE.Box3().setFromBufferAttribute(
      g.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(caixa.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(caixa.max.y).toBeLessThan(40);
  });

  it('equipamentos da laje ficam dentro da laje', () => {
    const planta: Planta = { id: 70, contorno: ret(30, 24), altura: 21 };
    const g = construirPredios([planta])!;
    const pos = g.getAttribute('position').array as Float32Array;
    // tudo acima da laje (21 m) pertence aos equipamentos; precisa estar dentro da planta
    for (let i = 0; i < pos.length; i += 3)
      if (pos[i + 1] > 21.75) {
        expect(pos[i]).toBeGreaterThanOrEqual(0);
        expect(pos[i]).toBeLessThanOrEqual(30);
        expect(pos[i + 2]).toBeGreaterThanOrEqual(0);
        expect(pos[i + 2]).toBeLessThanOrEqual(24);
      }
  });

  it('lê os prédios do tile do mapa, cada um no tile do seu centro', () => {
    const plantas = plantasDoTile(buildingsTile(1), 2400);
    expect(plantas.length).toBeGreaterThan(100);
    for (const p of plantas)
      for (const [x, z] of p.contorno) {
        expect(x).toBeGreaterThan(-60);
        expect(z).toBeGreaterThan(-60);
        expect(x).toBeLessThan(2460);
        expect(z).toBeLessThan(2460);
      }
    expect(construirPredios(plantas)).not.toBeNull();
  });

  it('o atlas de fachadas marca parede (alfa 255) e janela (alfa 0)', () => {
    const t = criarAtlasDeFachadas();
    const dados = t.image.data as Uint8Array;
    const alfas = new Set<number>();
    for (let i = 3; i < dados.length; i += 4) alfas.add(dados[i]);
    expect(alfas.has(255)).toBe(true);
    expect(alfas.has(0)).toBe(true);
  });
});
