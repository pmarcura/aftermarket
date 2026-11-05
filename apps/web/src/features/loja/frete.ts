import type { ProductId, World } from '../../../../../packages/simulation/src/model';

/** O frete das cargas recentes de um produto até um destino. */
export interface FreteDoProduto {
  viagens: number;
  quantidade: number;
  mercadoria: number;
  frete: number;
  /** Frete por unidade trazida, em centavos. */
  porUnidade: number;
  /** Parte do custo de cada unidade que foi frete (0 a 1). */
  parte: number;
}

/** Acima disto o frete pesa mais do que a mercadoria deveria aguentar: vale avisar. */
export const FRETE_ALTO = 0.3;

/**
 * Frete pago nas cargas que o jogador ainda enxerga (as entregues nos últimos dias e as que estão
 * na estrada), por produto. É o dado das remessas, não uma estimativa.
 */
export function freteRecente(world: World, destinoId: string) {
  const porProduto = new Map<ProductId, FreteDoProduto>();
  for (const s of world.shipments) {
    if (s.destinationId !== destinoId || s.quantity <= 0) continue;
    const x = porProduto.get(s.product) ?? {
      viagens: 0,
      quantidade: 0,
      mercadoria: 0,
      frete: 0,
      porUnidade: 0,
      parte: 0,
    };
    x.viagens++;
    x.quantidade += s.quantity;
    x.mercadoria += s.cost;
    x.frete += s.freight;
    porProduto.set(s.product, x);
  }
  for (const x of porProduto.values()) {
    x.porUnidade = x.frete / x.quantidade;
    x.parte = x.frete / Math.max(1, x.mercadoria + x.frete);
  }
  return porProduto;
}

/** Nome de quem leva a carga, do ponto de vista de quem compra. */
export function nomeTransportadora(world: World, carrierId: string, actor: string) {
  if (carrierId === actor) return 'sua frota';
  // Viagem com caminhão próprio: diesel, pedágio e motorista são pagos ao tesouro do estado.
  if (carrierId.startsWith('treasury')) return 'sua frota (diesel, pedágio e motorista)';
  return world.companies.find((c) => c.id === carrierId)?.name ?? 'transportadora';
}
