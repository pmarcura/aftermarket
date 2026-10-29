// Contas de compra usadas pelo mercado e pela loja. Só leem o mundo; a compra continua sendo o comando `trade`.
import type {
  Establishment,
  Offer,
  ProductId,
  World,
} from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import {
  householdDemand,
  regionFor,
  seasonPrice,
} from '../../../../../packages/simulation/src/metrics';

export type Frete = ReturnType<typeof quote>;

/** Transportadoras que podem levar a carga: a própria frota e as frotas das empresas-bot. */
export function transportadoras(world: World, actor: string) {
  return world.companies
    .filter(
      (c) =>
        (c.id === actor || (c.bot && !c.id.startsWith('treasury'))) &&
        world.vehicles.some((v) => v.companyId === c.id),
    )
    .map((c) => c.id);
}

/** Frete mais barato que leva tudo; prefere os que já têm rota confirmada. */
export function melhorFrete(
  world: World,
  actor: string,
  originId: string,
  destinationId: string,
  product: ProductId,
  quantity: number,
): Frete | undefined {
  const cotas = transportadoras(world, actor)
    .map((id) => quote(world, originId, destinationId, product, quantity, id))
    .filter((q) => q.unallocated === 0 && q.parts.length > 0)
    .sort((a, b) => Number(b.compatible) - Number(a.compatible) || a.price - b.price);
  return cotas[0];
}

/** Procura diária estimada de um produto numa loja: a demanda da cidade dividida entre as lojas. */
export function procuraDiaria(world: World, loja: Establishment, product: ProductId) {
  const p = world.properties.find((p) => p.id === loja.propertyId)!;
  const lojas = Math.max(
    1,
    world.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        world.properties.find((q) => q.id === x.propertyId)!.city === p.city,
    ).length,
  );
  return householdDemand(world, regionFor(world, p.coordinates, p.city).id, product) / lojas;
}

/** Dias de estoque sugeridos: frete dilui melhor em cargas maiores, sem parar dinheiro demais. */
export const DIAS_SUGERIDOS = 15;

export function quantidadeSugerida(
  world: World,
  destino: Establishment,
  product: ProductId,
  estoque: number,
  dias = DIAS_SUGERIDOS,
) {
  if (destino.category !== 'retail') return 0;
  return Math.max(
    0,
    Math.min(Math.floor(estoque), Math.ceil(procuraDiaria(world, destino, product) * dias)),
  );
}

export interface Avaliacao {
  quantidade: number;
  mercadoria: number;
  frete?: Frete;
  total: number;
  /** Custo de cada unidade já na porta, com frete. */
  naPorta: number;
  /** Só para lojas: quanto sobra vendendo tudo ao preço de referência, depois do frete. */
  margem?: number;
}

export function avaliar(
  world: World,
  actor: string,
  offer: Offer,
  destino: Establishment,
  quantidade: number,
): Avaliacao | undefined {
  if (quantidade <= 0) return undefined;
  const vendedor = world.establishments.find((e) => e.id === offer.establishmentId)!;
  const mercadoria = vendedor.companyId === actor ? 0 : offer.price * quantidade;
  const frete = melhorFrete(world, actor, vendedor.id, destino.id, offer.product, quantidade);
  const total = mercadoria + (frete?.price ?? 0);
  const receita = seasonPrice(world, offer.product) * quantidade;
  return {
    quantidade,
    mercadoria,
    frete,
    total,
    naPorta: total / quantidade,
    margem: destino.category === 'retail' ? 1 - total / receita : undefined,
  };
}

/**
 * Quantidade inicial sugerida para encher um destino com um produto: para loja, os dias de
 * procura; para produção, quatro ciclos do insumo da receita. Nunca acima do estoque do fornecedor.
 */
export function quantidadeParaDestino(
  world: World,
  destino: Establishment,
  product: ProductId,
  estoque: number,
) {
  if (destino.category === 'retail') return quantidadeSugerida(world, destino, product, estoque);
  const receita = world.season.config.recipes.find((r) => r.id === destino.specialization);
  const base = (receita?.input[product] ?? receita?.requires?.[product] ?? 1) * 4;
  return Math.max(0, Math.min(Math.floor(estoque), Math.ceil(base)));
}
