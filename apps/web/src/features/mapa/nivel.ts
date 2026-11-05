/**
 * Quanto o prédio de um negócio cresceu no mapa. Só desenho: lê o estado do negócio e não muda
 * nada na economia. O tamanho soma equipe, linhas de equipamento e capacidade de estoque.
 */
import type { Establishment } from '../../../../../packages/simulation/src/model';
import type { Estagio } from './modelos3d';

// Limites do "tamanho" para subir de nível (calibrados no mundo inicial de 05/11/2026:
// a maioria começa no nível 1 ou 2, e o nível 4 fica para os maiores negócios).
export const LIMITES_DE_NIVEL = [12, 24, 45] as const;

export function tamanhoDoNegocio(e: Establishment) {
  return e.employees + (e.equipmentLines ?? 0) * 4 + Math.min(e.capacityT, 200_000) / 25_000;
}

export function estagioDoNegocio(e: Establishment): Estagio {
  if (e.installed === false) return 'obra';
  const t = tamanhoDoNegocio(e);
  if (t < LIMITES_DE_NIVEL[0]) return 1;
  if (t < LIMITES_DE_NIVEL[1]) return 2;
  if (t < LIMITES_DE_NIVEL[2]) return 3;
  return 4;
}
