import { useMemo } from 'react';
import { useGame } from '../../lib/game';
import {
  TIME_SCALE,
  type Establishment,
  type InfrastructureContract,
  type PurchaseOrder,
  type Shipment,
  type World,
} from '../../../../../packages/simulation/src/model';

/** Onde cada pedido aparece para o jogador. */
export type Situacao = 'precisa' | 'espera' | 'aberto' | 'caminho' | 'fim';

/** Horas de jogo até um prazo em tempo real. */
export const horasAte = (ms: number) => Math.max(0, Math.ceil((ms * TIME_SCALE) / 3_600_000));

/** Algo que o jogador pode aceitar agora: o pedido inteiro ou uma proposta específica. */
export function acoesDoPedido(o: PurchaseOrder, actor: string, agora = Date.now()) {
  const compra = o.buyerId === actor;
  const venda = o.sellerId === actor;
  const pendente = o.status === 'pending' && o.deadline > agora;
  const aceitarPedido = pendente && venda && !o.proposals?.length;
  const propostas = pendente
    ? (o.proposals ?? []).filter(
        (p) =>
          p.deadline > agora &&
          (!o.sellerId || o.proposals?.at(-1)?.id === p.id) &&
          p.proposedBy !== actor &&
          (compra || p.sellerId === actor),
      )
    : [];
  return { compra, venda, aceitarPedido, propostas };
}

export function situacaoDoPedido(o: PurchaseOrder, actor: string): Situacao | null {
  const compra = o.buyerId === actor;
  const venda = o.sellerId === actor;
  const minhaProposta = o.proposals?.some((p) => p.proposedBy === actor) ?? false;
  const envolvido = compra || venda || minhaProposta;
  if (o.status === 'pending') {
    const a = acoesDoPedido(o, actor);
    if (a.aceitarPedido || a.propostas.length) return 'precisa';
    if (envolvido) return 'espera';
    return o.sellerId ? null : 'aberto';
  }
  if (!envolvido) return null;
  return o.status === 'accepted' ? 'caminho' : 'fim';
}

export interface GrupoCarga {
  id: string;
  shipments: Shipment[];
  first: Shipment;
  quantity: number;
  entregue: number;
  origem: Establishment;
  destino: Establishment;
  contrato?: InfrastructureContract;
  pedido?: PurchaseOrder;
  completo: boolean;
  saiuEm: number;
  /** Papel do jogador nesta carga. */
  papel: 'compra' | 'venda' | 'transporte';
}

/** Junta as viagens de um mesmo pedido, contrato ou lote: o pedido só termina na última chegada. */
export function agruparCargas(world: World, actor: string, unidade?: Establishment): GrupoCarga[] {
  const grupos = new Map<string, Shipment[]>();
  for (const s of world.shipments) {
    const chave = s.infrastructureId
      ? `public:${s.infrastructureId}`
      : s.orderId
        ? `order:${s.orderId}`
        : s.batchId
          ? `batch:${s.batchId}`
          : `legacy:${s.id}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), s]);
  }
  const lista: GrupoCarga[] = [];
  for (const [id, shipments] of grupos) {
    if (!shipments.some((s) => [s.buyerId, s.sellerId, s.carrierId].includes(actor))) continue;
    const first = shipments[0];
    const origem = world.establishments.find((e) => e.id === first.originId);
    const destino = world.establishments.find((e) => e.id === first.destinationId);
    if (!origem || !destino) continue;
    if (unidade && origem.id !== unidade.id && destino.id !== unidade.id) continue;
    lista.push({
      id,
      shipments,
      first,
      quantity: shipments.reduce((n, s) => n + s.quantity, 0),
      entregue: shipments.reduce((n, s) => n + (s.delivered ? s.quantity : 0), 0),
      origem,
      destino,
      contrato: world.infrastructure.find((c) => c.id === first.infrastructureId),
      pedido: first.orderId ? world.orders.find((o) => o.id === first.orderId) : undefined,
      completo: shipments.every((s) => s.delivered),
      saiuEm: Math.max(...shipments.map((s) => s.departedAt)),
      papel: first.buyerId === actor ? 'compra' : first.sellerId === actor ? 'venda' : 'transporte',
    });
  }
  return lista.sort((a, b) => b.saiuEm - a.saiuEm);
}

/** Tudo o que a tela de Pedidos mostra, separado por situação. Recalcula só quando o mundo muda. */
export function useDadosPedidos(unidade?: Establishment) {
  const { world, actor } = useGame();
  return useMemo(() => {
    const meus = world.establishments.filter((e) => e.companyId === actor);
    const pedidos = world.orders
      .filter(
        (o) =>
          (!o.sellerId || o.buyerId === actor || o.sellerId === actor) &&
          (!unidade || o.destinationId === unidade.id || o.originId === unidade.id || !o.sellerId),
      )
      .slice()
      .reverse();
    const por = (s: Situacao) => pedidos.filter((o) => situacaoDoPedido(o, actor) === s);
    // Pedidos abertos de outros só importam se o jogador (ou a unidade) tem o produto.
    const abertos = por('aberto').filter(
      (o) =>
        o.buyerId !== actor &&
        (unidade ? [unidade] : meus).some((e) => (e.inventory[o.product] ?? 0) > 0),
    );
    const cargas = agruparCargas(world, actor, unidade);
    const idsComPedido = new Set(cargas.filter((c) => c.pedido).map((c) => c.pedido!.id));
    const emCaminho = cargas.filter((c) => !c.completo);
    // Pedido aceito que ainda não tem viagem gravada continua visível como "em preparação".
    const semViagem = por('caminho').filter((o) => !idsComPedido.has(o.id));
    const concluidosCarga = cargas.filter((c) => c.completo && !c.pedido);
    const concluidosPedido = por('fim');
    return {
      precisa: por('precisa'),
      espera: por('espera'),
      abertos,
      emCaminho,
      semViagem,
      concluidosCarga,
      concluidosPedido,
    };
  }, [world.revision, actor, unidade?.id]);
}
