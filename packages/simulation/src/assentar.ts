/**
 * Assenta cada negócio num lugar real da sua cidade (packages/world/data/lugares-reais.json),
 * com o mesmo algoritmo para todos os tipos:
 *
 *   comércio → zona comercial · indústria, armazém, transportadora → zona industrial
 *   fazenda → lavoura · mina → área de mineração
 *
 * Os terrenos maiores escolhem primeiro; cada um fica com o menor lugar livre onde cabe inteiro
 * (assim os lugares grandes sobram para os terrenos grandes). Sem lugar onde caiba, fica com o
 * maior lugar livre; sem nenhum lugar livre, o terreno continua onde estava.
 *
 * Roda uma vez, no fim da criação do mundo. Muda só posição e orientação do terreno; área,
 * preço e dono continuam iguais.
 */
import { codigoDaCidade, lugaresReais, type ZonaReal } from '../../world/src/lugares-reais';
import type { Category, World } from './model';

export const zonaDoNegocio: Record<Category, ZonaReal> = {
  retail: 'comercio',
  industry: 'industria',
  warehouse: 'industria',
  logistics: 'industria',
  farm: 'lavoura',
  mine: 'mineracao',
};

export function assentarNoMapa(w: World) {
  const usados = new Map<string, Set<number>>();
  const fila = [...w.properties].sort((a, b) => b.area - a.area || a.id.localeCompare(b.id));
  for (const p of fila) {
    const zona = zonaDoNegocio[p.category];
    const cidade = codigoDaCidade(p.city, p.state);
    if (!cidade) continue;
    const lugares = lugaresReais(cidade, zona);
    const chave = `${cidade}:${zona}`;
    const ocupados = usados.get(chave) ?? usados.set(chave, new Set()).get(chave)!;
    const lado = Math.sqrt(p.area);
    let escolhido = -1;
    for (let i = 0; i < lugares.length; i++) {
      if (ocupados.has(i)) continue;
      const cabe = lugares[i][3] >= lado;
      const atual = escolhido < 0 ? null : lugares[escolhido];
      if (
        escolhido < 0 ||
        (cabe && (atual![3] < lado || lugares[i][3] < atual![3])) ||
        (!cabe && atual![3] < lado && lugares[i][3] > atual![3])
      )
        escolhido = i;
    }
    if (escolhido < 0) continue;
    ocupados.add(escolhido);
    const [lng, lat, giro, ladoMaximo, , acessoLng, acessoLat] = lugares[escolhido];
    p.coordinates = [lng, lat];
    p.site = {
      facing: giro,
      side: ladoMaximo,
      ...(acessoLng !== undefined ? { access: [acessoLng, acessoLat] } : {}),
    };
  }
}
