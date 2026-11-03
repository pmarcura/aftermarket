import {
  seasonProducts,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import { mercadoDaCidade } from '../business/precificacao';

/** Um produto que a cidade procura e a loja não tem na prateleira. */
export interface Vaga {
  id: ProductId;
  /** Quanto a cidade procura por dia, ao preço justo. */
  procuraDia: number;
  /** Menor preço de quem tem o produto em estoque agora, no mapa inteiro. */
  custo: number;
  /** Preço justo: por quanto a loja venderia. */
  preco: number;
  /** Lucro por dia que a loja deixa de ganhar (estimativa, antes do frete). */
  lucroDia: number;
  /** Já há carga a caminho desta loja com o produto. */
  aCaminho: boolean;
}

/**
 * As vagas vazias da prateleira, da que mais rende para a que menos rende. Mesma conta da
 * oportunidade "Vender mais" do Início: comprar pelo menor preço do mapa e vender pelo preço justo.
 */
export function vagasDaLoja(world: World, loja: Establishment): Vaga[] {
  const porId = new Map(world.establishments.map((e) => [e.id, e]));
  const menor = new Map<ProductId, number>();
  for (const o of world.offers) {
    const e = porId.get(o.establishmentId);
    if (!e?.enabled || (e.inventory[o.product] ?? 0) <= 0) continue;
    const atual = menor.get(o.product);
    if (atual === undefined || o.price < atual) menor.set(o.product, o.price);
  }
  const vagas: Vaga[] = [];
  for (const id of seasonProducts(world)) {
    // Produto que já tem lugar na prateleira (mesmo zerado) aparece como produto, não como vaga.
    if (id in loja.inventory) continue;
    const m = mercadoDaCidade(world, loja, id);
    const custo = menor.get(id);
    if (m.procuraDia <= 0 || custo === undefined || custo >= m.justo) continue;
    vagas.push({
      id,
      procuraDia: m.vendas(m.justo),
      custo,
      preco: m.justo,
      lucroDia: m.vendas(m.justo) * (m.justo - custo),
      aCaminho: world.shipments.some(
        (s) => s.destinationId === loja.id && s.product === id && !s.delivered,
      ),
    });
  }
  return vagas.sort((a, b) => b.lucroDia - a.lucroDia);
}
