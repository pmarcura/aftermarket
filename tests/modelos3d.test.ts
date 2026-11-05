import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { construirModelo, type Nivel } from '../apps/web/src/features/mapa/modelos3d';
import { estagioDoNegocio, LIMITES_DE_NIVEL } from '../apps/web/src/features/mapa/nivel';
import type { Category, Establishment } from '../packages/simulation/src/model';

const categorias: Category[] = ['retail', 'industry', 'farm', 'mine', 'warehouse', 'logistics'];
const niveis: Nivel[] = [1, 2, 3, 4];

const volume = (g: THREE.Object3D) => {
  const t = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  return t.x * t.z;
};

describe('kit de modelos 3D dos negócios', () => {
  it('monta todos os tipos em todos os estágios, apoiados no chão', () => {
    for (const c of categorias)
      for (const e of [...niveis, 'obra' as const]) {
        const g = construirModelo(c, e);
        const caixa = new THREE.Box3().setFromObject(g);
        expect(caixa.isEmpty(), `${c}:${e}`).toBe(false);
        expect(caixa.min.y, `${c}:${e}`).toBeGreaterThanOrEqual(-0.01);
        expect(g.userData).toEqual({ categoria: c, estagio: e });
      }
  });

  it('cada nível ocupa mais terreno que o anterior', () => {
    for (const c of categorias) {
      const areas = niveis.map((n) => volume(construirModelo(c, n)));
      for (let i = 1; i < areas.length; i++)
        expect(areas[i], `${c} nível ${i + 1}`).toBeGreaterThan(areas[i - 1]);
    }
  });
});

describe('estágio do negócio no mapa', () => {
  const base = {
    employees: 0,
    equipmentLines: 0,
    capacityT: 0,
    installed: true,
  } as unknown as Establishment;

  it('obra enquanto não está instalado', () => {
    expect(estagioDoNegocio({ ...base, installed: false, employees: 99 })).toBe('obra');
  });

  it('cresce com a equipe, nos limites combinados', () => {
    expect(estagioDoNegocio({ ...base, employees: LIMITES_DE_NIVEL[0] - 1 })).toBe(1);
    expect(estagioDoNegocio({ ...base, employees: LIMITES_DE_NIVEL[0] })).toBe(2);
    expect(estagioDoNegocio({ ...base, employees: LIMITES_DE_NIVEL[1] })).toBe(3);
    expect(estagioDoNegocio({ ...base, employees: LIMITES_DE_NIVEL[2] })).toBe(4);
  });

  it('linhas de equipamento e capacidade também contam', () => {
    expect(estagioDoNegocio({ ...base, employees: 8, equipmentLines: 2 })).toBe(2);
    expect(estagioDoNegocio({ ...base, capacityT: 100_000 })).toBe(1);
  });
});
