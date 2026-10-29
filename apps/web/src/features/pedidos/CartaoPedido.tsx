import { BotaoProduto } from '../../components/BotaoProduto';
import { IconePixel } from '../../components/IconePixel';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade as unidadeDe } from '../economy/Carga';
import { useGame, cr, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  type OrderProposal,
  type PurchaseOrder,
} from '../../../../../packages/simulation/src/model';
import { acoesDoPedido, horasAte, type Situacao } from './dados';
import '../../design/item.css';
import '../../design/pedidos.css';

const ESTADO: Record<Situacao, { tom: string; texto: string }> = {
  precisa: { tom: 'ouro', texto: 'Espera você' },
  espera: { tom: 'apagado', texto: 'Esperando resposta' },
  aberto: { tom: 'ceu', texto: 'Aberto no mercado' },
  caminho: { tom: 'ceu', texto: 'Em preparação' },
  fim: { tom: 'apagado', texto: 'Encerrado' },
};
const FIM: Record<string, { tom: string; texto: string }> = {
  delivered: { tom: 'lavoura', texto: 'Entregue' },
  rejected: { tom: 'apagado', texto: 'Cancelado' },
  expired: { tom: 'apagado', texto: 'Venceu o prazo' },
};

/**
 * Um pedido entre empresas como cartão: o produto grande, o que está em jogo numa frase, o estado
 * em uma palavra e, embaixo, as propostas como cartas que se aceitam ou se respondem.
 */
export function CartaoPedido({
  o,
  situacao,
  onAceitar,
  onProposta,
}: {
  o: PurchaseOrder;
  situacao: Situacao;
  onAceitar: (p?: OrderProposal) => void;
  onProposta: (base?: OrderProposal) => void;
}) {
  const { world, actor, run, pending } = useGame();
  const agora = useClock();
  const { compra, venda, aceitarPedido, propostas } = acoesDoPedido(o, actor, agora);
  const comprador = world.companies.find((c) => c.id === o.buyerId);
  const destino = world.establishments.find((e) => e.id === o.destinationId);
  const info = products[o.product];
  const estado = situacao === 'fim' ? (FIM[o.status] ?? ESTADO.fim) : ESTADO[situacao];
  const quem = compra
    ? `Você pede para ${destino?.name ?? 'sua unidade'}`
    : `${comprador?.name ?? 'Uma empresa'}${comprador?.bot ? ' (empresa automática)' : ''} ${venda ? 'quer comprar de você' : 'procura'}`;
  const horas = horasAte(o.deadline - agora);
  const abertoParaMim =
    o.status === 'pending' && o.deadline > agora && (!compra || Boolean(o.proposals?.length));
  const unicaAcao = aceitarPedido
    ? () => onAceitar()
    : propostas.length === 1
      ? () => onAceitar(propostas[0])
      : undefined;
  const cancelar = () =>
    run(
      { type: 'rejectOrder', orderId: o.id },
      compra ? 'Pedido cancelado. Nada foi cobrado.' : 'Pedido recusado.',
    );
  return (
    <article
      className={`item ped-item ped-${situacao}`}
      style={{ ['--h' as string]: matizDoProduto(o.product) }}
    >
      <header className="item-hero">
        <div className="item-arte">
          <BotaoProduto product={o.product}>
            <ProdutoArte product={o.product} escala={3} />
          </BotaoProduto>
        </div>
        <div className="item-ident">
          <h3>
            <BotaoProduto product={o.product}>{info.name}</BotaoProduto>
          </h3>
          <span className={`item-estado tom-${estado.tom}`}>{estado.texto}</span>
          <p className="ped-frase">
            {quem}: <b>{num(o.quantity)}</b> {unidadeDe(o.product, o.quantity)}
          </p>
          <dl className="item-fatos">
            <div>
              <IconePixel nome="moeda" tamanho={22} />
              <dt>Preço de referência</dt>
              <dd>{cr(o.unitPrice)}</dd>
            </div>
            {o.status === 'pending' && (
              <div>
                <IconePixel nome="prazo" tamanho={22} />
                <dt>Vence em</dt>
                <dd>~{num(horas)} h de jogo</dd>
              </div>
            )}
          </dl>
        </div>
        {unicaAcao && (
          <button className="item-repor primary" disabled={pending} onClick={unicaAcao}>
            {aceitarPedido ? 'Aceitar pedido' : 'Aceitar proposta'}
          </button>
        )}
      </header>
      <div className="item-corpo ped-corpo">
        <ul className="ped-valores" aria-label="Valores do pedido">
          <li>
            <span>Mercadoria</span>
            <b>{cr(o.unitPrice * o.quantity)}</b>
          </li>
          <li>
            <span>Frete que paga no máximo</span>
            <b>{cr(o.maxFreight)}</b>
          </li>
          <li className="ped-total">
            <span>Total até</span>
            <b>{cr(o.unitPrice * o.quantity + o.maxFreight)}</b>
          </li>
        </ul>
        {!!o.escrowReserved && (
          <p className="ped-nota">Dinheiro separado para este pedido: {cr(o.escrowReserved)}.</p>
        )}
        {!!o.proposals?.length && (
          <ul className="ped-ofertas" aria-label="Propostas recebidas">
            {o.proposals.map((p) => {
              const deMim = p.proposedBy === actor;
              const pode = propostas.some((x) => x.id === p.id);
              const empresa = world.companies.find((c) => c.id === p.proposedBy)?.name;
              return (
                <li key={p.id} className={`ped-oferta ${pode ? 'pede' : ''}`}>
                  <IconePixel nome="carta" tamanho={32} />
                  <div className="ped-oferta-quem">
                    <strong>{deMim ? 'Sua proposta' : (empresa ?? 'Uma empresa')}</strong>
                    <small>
                      Sai de{' '}
                      {world.establishments.find((e) => e.id === p.originId)?.name ?? 'estoque'}
                    </small>
                  </div>
                  <div className="ped-oferta-numeros">
                    <span>
                      {num(p.quantity)} {unidadeDe(o.product, p.quantity)} a{' '}
                      <b>{cr(p.unitPrice)}</b>
                    </span>
                    <small>
                      Total máximo com frete: {cr(p.unitPrice * p.quantity + p.maxFreight)}
                    </small>
                  </div>
                  <div className="ped-oferta-acoes">
                    {o.acceptedProposalId === p.id && <span className="ped-selo">Aceita</span>}
                    {pode && (
                      <>
                        <button className="primary" disabled={pending} onClick={() => onAceitar(p)}>
                          Aceitar
                        </button>
                        <button className="secondary" onClick={() => onProposta(p)}>
                          Responder
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {o.status === 'pending' && (
          <footer className="ped-rodape">
            {abertoParaMim && (
              <button className="secondary" onClick={() => onProposta()}>
                {o.proposals?.length ? 'Propor outro valor' : 'Fazer uma proposta'}
              </button>
            )}
            {(compra || venda) && (
              <button className="text-button" disabled={pending} onClick={() => void cancelar()}>
                {compra ? 'Cancelar pedido' : 'Recusar pedido'}
              </button>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}
