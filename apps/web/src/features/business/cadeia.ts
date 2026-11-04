import {
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';

/** Estoque abaixo disto, no preço de referência, não vale um aviso: é sobra de ciclo. */
const VALOR_MINIMO = 50000;
const MAXIMO = 4;

/** Uma ligação que falta entre os negócios do jogador, ou mercadoria parada sem comprador. */
export interface Sugestao {
  id: string;
  tipo: 'abastecer' | 'vender';
  produto: ProductId;
  origem: Establishment;
  destino?: Establishment;
  quantidade: number;
  /** Valor do estoque no preço de referência da temporada: estimativa, não venda. */
  valor: number;
}

/** O que um negócio usa: a loja, o que está na prateleira; a produção, os insumos da receita. */
export function usosDe(world: World, e: Establishment): Set<ProductId> {
  if (e.category === 'retail')
    return new Set([
      ...(Object.keys(e.inventory) as ProductId[]),
      ...(Object.keys(e.prices) as ProductId[]),
    ]);
  const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
  return new Set([
    ...(Object.keys(receita?.input ?? {}) as ProductId[]),
    ...(Object.keys(receita?.requires ?? {}) as ProductId[]),
  ]);
}

/**
 * O que os negócios do jogador podem fazer entre si: levar o que um produz para outro que usa, e pôr
 * à venda o que está parado no armazém sem oferta. Ligações já existentes ficam de fora.
 */
export function sugestoesDaCadeia(world: World, actor: string): Sugestao[] {
  const meus = world.establishments.filter((e) => e.companyId === actor && e.installed !== false);
  const ligadas = new Set(
    meus.flatMap((d) =>
      (d.supplyPolicy?.rules ?? [])
        .filter((r) => r.originId)
        .map((r) => `${r.originId}:${d.id}:${r.product}`),
    ),
  );
  const precos = world.season.config.basePrices;
  const lista: Sugestao[] = [];
  for (const origem of meus) {
    if (origem.category === 'retail') continue;
    const usa = usosDe(world, origem);
    for (const [id, q] of Object.entries(origem.inventory) as [ProductId, number][]) {
      const quantidade = Math.floor(q ?? 0);
      const valor = quantidade * (precos[id] ?? 0);
      // Insumo da própria unidade não é sobra: espera o próximo ciclo.
      if (quantidade <= 0 || valor < VALOR_MINIMO || usa.has(id)) continue;
      const destinos = meus.filter(
        (d) =>
          d.id !== origem.id &&
          usosDe(world, d).has(id) &&
          !ligadas.has(`${origem.id}:${d.id}:${id}`),
      );
      for (const destino of destinos)
        lista.push({
          id: `abastecer:${origem.id}:${destino.id}:${id}`,
          tipo: 'abastecer',
          produto: id,
          origem,
          destino,
          quantidade,
          valor,
        });
      const aVenda = world.offers.some((o) => o.establishmentId === origem.id && o.product === id);
      const usadoPorOutro = meus.some((d) => d.id !== origem.id && usosDe(world, d).has(id));
      if (!aVenda && !usadoPorOutro)
        lista.push({
          id: `vender:${origem.id}:${id}`,
          tipo: 'vender',
          produto: id,
          origem,
          quantidade,
          valor,
        });
    }
  }
  return lista.sort((a, b) => b.valor - a.valor).slice(0, MAXIMO);
}
