// Estimativa de venda por preço com a mesma regra do motor (engine.ts, vendas do varejo): a procura
// da cidade é repartida entre as lojas que têm o produto pelo peso (preço justo ÷ preço)^1,4 ×
// (0,5 + qualidade/100), limitado a 1,2. Não conta equipe, área, estoque nem caixa das famílias.
import type { Establishment, ProductId, World } from '../../../../../packages/simulation/src/model';
import {
  householdDemand,
  regionFor,
  seasonPrice,
} from '../../../../../packages/simulation/src/metrics';
import { gameCalendar, inventoryQuality } from '../../../../../packages/simulation/src/operations';

export interface Concorrente {
  loja: Establishment;
  preco: number;
}

export function mercadoDaCidade(world: World, loja: Establishment, product: ProductId) {
  const p = world.properties.find((x) => x.id === loja.propertyId)!;
  const cidade = p.city;
  const concorrentes: Concorrente[] = world.establishments
    .filter(
      (e) =>
        e.id !== loja.id &&
        e.enabled &&
        e.category === 'retail' &&
        product in e.inventory &&
        (e.prices[product] ?? 0) > 0 &&
        world.properties.find((x) => x.id === e.propertyId)?.city === cidade,
    )
    .map((e) => ({ loja: e, preco: e.prices[product]! }))
    .sort((a, b) => a.preco - b.preco);
  const regiao = regionFor(world, p.coordinates, cidade);
  const calendario = gameCalendar(world, world.nextEconomicAt - 60000);
  const procuraDia = householdDemand(world, regiao.id, product) * calendario.factor;
  const justo = seasonPrice(world, product);
  const peso = (e: Establishment, preco: number) =>
    Math.pow(justo / preco, 1.4) * (0.5 + inventoryQuality(e, product) / 100);
  const pesoRivais = concorrentes.reduce((n, c) => n + peso(c.loja, c.preco), 0);
  /** Unidades por dia que a loja venderia a este preço. */
  const vendas = (preco: number) => {
    if (preco <= 0) return 0;
    const s = peso(loja, preco);
    return (procuraDia * s * Math.min(1.2, s)) / (pesoRivais + s);
  };
  const custo = loja.unitCosts[product] ?? 0;
  const lucro = (preco: number) => vendas(preco) * (preco - custo);
  // Melhor preço: varre de 50% a 300% do preço justo em passos de 1%.
  let melhor = justo;
  for (let f = 0.5; f <= 3.0001; f += 0.01) {
    const preco = Math.round(justo * f);
    if (lucro(preco) > lucro(melhor)) melhor = preco;
  }
  const menorDoPais = world.establishments
    .filter(
      (e) =>
        e.category === 'retail' &&
        e.enabled &&
        (e.prices[product] ?? 0) > 0 &&
        (e.inventory[product] ?? 0) > 0,
    )
    .reduce<number | undefined>(
      (n, e) => (n === undefined || e.prices[product]! < n ? e.prices[product]! : n),
      undefined,
    );
  // No teto da busca, o pico real pode estar ainda acima (concorrência muito cara).
  const melhorNoTeto = melhor >= Math.round(justo * 2.95);
  return {
    cidade,
    concorrentes,
    procuraDia,
    justo,
    custo,
    vendas,
    lucro,
    melhor,
    melhorNoTeto,
    menorDoPais,
  };
}

export type Mercado = ReturnType<typeof mercadoDaCidade>;

/**
 * A prateleira inteira numa conta só, usada pelo cabeçalho da loja, pela prateleira e pelos
 * avisos do Início. Só produto com estoque entra no lucro: sem estoque não há venda.
 * Ordem de atenção: o que acaba primeiro vem primeiro.
 */
export function contaDaPrateleira(world: World, loja: Establishment) {
  const itens = (Object.keys(loja.inventory) as ProductId[])
    .map((id) => {
      const m = mercadoDaCidade(world, loja, id);
      const preco = loja.prices[id] ?? m.justo;
      const estoque = loja.inventory[id] ?? 0;
      const vende = m.vendas(preco);
      const dias = estoque <= 0 ? 0 : vende > 0.01 ? estoque / vende : Infinity;
      return {
        id,
        m,
        preco,
        estoque,
        vende,
        dias,
        // A venda do dia não passa do que há na prateleira.
        lucro: Math.min(vende, estoque) * (preco - m.custo),
        lucroMelhor: Math.min(m.vendas(m.melhor), estoque) * (m.melhor - m.custo),
      };
    })
    .sort((a, b) => a.dias - b.dias || b.estoque - a.estoque);
  const ajustar = itens.filter(
    (x) => x.estoque > 0 && !x.m.melhorNoTeto && Math.abs(x.preco - x.m.melhor) / x.m.melhor > 0.03,
  );
  return {
    itens,
    agora: itens.reduce((n, x) => n + x.lucro, 0),
    melhor: itens.reduce((n, x) => n + x.lucroMelhor, 0),
    ajustar,
  };
}
