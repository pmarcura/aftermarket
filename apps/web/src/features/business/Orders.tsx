import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Empty, Modal, Rows, Select } from '../../components/ui';
import {
  products,
  type Establishment,
  type ProductId,
  type PurchaseOrder,
  type OrderProposal,
} from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useClock } from '../../lib/clock';
const statuses = {
  pending: 'Em negociação',
  accepted: 'Em entrega',
  delivered: 'Concluído',
  rejected: 'Recusado / cancelado',
  expired: 'Expirado',
};
export function Orders({ establishment: e }: { establishment?: Establishment }) {
  const { world, actor, run, pending, navigate } = useGame(),
    now = useClock();
  const [filter, setFilter] = useState(''),
    [create, setCreate] = useState(false),
    [negotiating, setNegotiating] = useState<PurchaseOrder>(),
    [review, setReview] = useState<{ order: PurchaseOrder; proposal?: OrderProposal }>();
  const [destination, setDestination] = useState(e?.id ?? ''),
    [product, setProduct] = useState(''),
    [quantity, setQuantity] = useState(0),
    [price, setPrice] = useState(0),
    [freight, setFreight] = useState(0),
    [days, setDays] = useState(3),
    [origin, setOrigin] = useState(''),
    [carrier, setCarrier] = useState('');
  const units = world.establishments.filter((x) => x.companyId === actor);
  const rows = world.orders
    .filter(
      (o) =>
        (!o.sellerId || o.buyerId === actor || o.sellerId === actor) &&
        (!e || o.destinationId === e.id || o.originId === e.id || !o.sellerId),
    )
    .slice()
    .reverse();
  const visible = rows.filter((o) => !filter || o.status === filter);
  const negotiate = (o: PurchaseOrder, p?: OrderProposal) => {
    setNegotiating(o);
    setOrigin(
      p?.originId ||
        (o.buyerId === actor ? o.originId || o.proposals?.at(-1)?.originId || '' : (e?.id ?? '')),
    );
    setQuantity(p?.quantity ?? o.quantity);
    setPrice(p?.unitPrice ?? o.unitPrice);
    setFreight(p?.maxFreight ?? o.maxFreight);
    setDays(3);
    setCarrier(p?.carrierId ?? '');
  };
  const props = review?.proposal,
    ro = review?.order;
  const q = ro
    ? quote(
        world,
        props?.originId ?? ro.originId,
        ro.destinationId,
        ro.product,
        props?.quantity ?? ro.quantity,
        props?.carrierId ?? ro.carrierId,
      )
    : undefined;
  return (
    <div className="business-section">
      <div className="panel-content section-title">
        <div>
          <h3>Pedidos e propostas entre empresas</h3>
          <p className="small muted">
            Jogadores e bots podem publicar necessidades, negociar termos e aceitar a proposta da
            contraparte.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setCreate(true);
            setProduct('');
            setQuantity(0);
            setPrice(0);
            setFreight(0);
            setDestination(e?.id ?? '');
          }}
        >
          Publicar pedido de compra
        </button>
      </div>
      <div className="panel-content">
        <Select
          label="Estado dos pedidos"
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
        >
          <option value="">Estado (opcional)</option>
          {Object.entries(statuses).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {visible.length ? (
        <div className="orders-list">
          {visible.slice(0, 60).map((o) => {
            const buyer = world.companies.find((c) => c.id === o.buyerId)!,
              selling = o.sellerId === actor,
              buying = o.buyerId === actor;
            return (
              <article className="commercial-order" key={o.id}>
                <div className="section-title">
                  <div>
                    <Badge tone={buying ? 'blue' : selling ? 'green' : 'gold'}>
                      {buying ? 'Minha compra' : selling ? 'Minha venda' : 'Pedido aberto'}
                    </Badge>
                    <strong>
                      {' '}
                      {products[o.product].name} · {num(o.quantity)} {products[o.product].unit}
                    </strong>
                    <small className="block">
                      {buyer.name} {buyer.bot ? '[BOT]' : ''} · #{o.id.slice(0, 6)} ·{' '}
                      {world.establishments.find((e) => e.id === o.destinationId)?.name}
                    </small>
                  </div>
                  <Badge
                    tone={
                      o.status === 'pending' ? 'gold' : o.status === 'delivered' ? 'green' : 'muted'
                    }
                  >
                    {statuses[o.status]}
                  </Badge>
                </div>
                <div className="order-numbers">
                  <span>
                    Referência / unidade <b>{cr(o.unitPrice)}</b>
                  </span>
                  <span>
                    Mercadoria <b>{cr(o.unitPrice * o.quantity)}</b>
                  </span>
                  <span>
                    Frete autorizado <b>{cr(o.maxFreight)}</b>
                  </span>
                  <span>
                    Prazo restante{' '}
                    <b>{Math.max(0, Math.ceil(((o.deadline - now) * 120) / 3600000))} h do jogo</b>
                  </span>
                </div>
                {o.status === 'pending' && (
                  <div className="inline-actions">
                    {selling && !o.proposals?.length && (
                      <button className="primary" onClick={() => setReview({ order: o })}>
                        Aceitar pedido
                      </button>
                    )}
                    {(!buying || Boolean(o.proposals?.length)) && (
                      <button className="secondary" onClick={() => negotiate(o)}>
                        {o.proposals?.length ? 'Propor alteração' : 'Fazer proposta'}
                      </button>
                    )}
                    {(buying || selling) && (
                      <button
                        className="text-button"
                        disabled={pending}
                        onClick={() =>
                          void run(
                            { type: 'rejectOrder', orderId: o.id },
                            'Pedido encerrado sem pagamento.',
                          )
                        }
                      >
                        {buying ? 'Cancelar pedido' : 'Recusar pedido'}
                      </button>
                    )}
                  </div>
                )}
                {!!o.proposals?.length && (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Proponente / fornecedor</th>
                          <th>Quantidade</th>
                          <th>Preço / un.</th>
                          <th>Total + teto de frete</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.proposals.map((p) => (
                          <tr key={p.id}>
                            <td>
                              {world.companies.find((c) => c.id === p.proposedBy)?.name}
                              <small className="block">
                                Estoque:{' '}
                                {world.establishments.find((e) => e.id === p.originId)?.name}
                              </small>
                            </td>
                            <td>
                              {num(p.quantity)} {products[o.product].unit}
                            </td>
                            <td>{cr(p.unitPrice)}</td>
                            <td>{cr(p.unitPrice * p.quantity + p.maxFreight)}</td>
                            <td>
                              {o.status === 'pending' &&
                                p.proposedBy !== actor &&
                                (buying || p.sellerId === actor) && (
                                  <div className="inline-actions">
                                    <button
                                      className="primary"
                                      onClick={() => setReview({ order: o, proposal: p })}
                                    >
                                      Revisar e aceitar
                                    </button>
                                    <button className="secondary" onClick={() => negotiate(o, p)}>
                                      Contrapropor
                                    </button>
                                  </div>
                                )}
                              {o.acceptedProposalId === p.id && <Badge tone="green">Aceita</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {['accepted', 'delivered'].includes(o.status) && (
                  <button className="secondary" onClick={() => navigate('logistics')}>
                    Acompanhar pedido na logística
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Nenhum pedido neste recorte"
          description="Publique uma necessidade ou consulte novamente após as empresas avaliarem seus estoques."
        />
      )}
      <p className="panel-footnote">
        Negociação não reserva estoque nem cobra. Na aceitação, preço, prazo, caixa, espaço e todos
        os caminhões são revalidados. Pedidos de outros jogadores exigem sua aprovação.
      </p>
      {create && (
        <Modal title="Publicar necessidade de compra" onClose={() => setCreate(false)}>
          <Select
            label="Destino do pedido aberto"
            value={destination}
            onChange={(ev) => setDestination(ev.target.value)}
          >
            <option value="">Escolher unidade de destino</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select
            label="Mercadoria do pedido aberto"
            value={product}
            onChange={(ev) => setProduct(ev.target.value)}
          >
            <option value="">Escolher mercadoria</option>
            {Object.entries(products).map(([id, p]) => (
              <option key={id} value={id}>
                {p.name}
              </option>
            ))}
          </Select>
          <label className="field">
            Quantidade
            <input
              aria-label="Quantidade do pedido aberto"
              type="number"
              min="1"
              value={quantity || ''}
              onChange={(ev) => setQuantity(Number(ev.target.value))}
            />
          </label>
          <label className="field">
            Preço máximo por unidade (R$)
            <input
              aria-label="Preço do pedido aberto"
              type="number"
              min=".01"
              step=".01"
              value={price / 100 || ''}
              onChange={(ev) => setPrice(Math.round(Number(ev.target.value) * 100))}
            />
          </label>
          <label className="field">
            Verba máxima de frete (R$)
            <input
              aria-label="Frete do pedido aberto"
              type="number"
              min=".01"
              step=".01"
              value={freight / 100 || ''}
              onChange={(ev) => setFreight(Math.round(Number(ev.target.value) * 100))}
            />
          </label>
          <label className="field">
            Prazo de entrega em dias do jogo
            <input
              aria-label="Prazo do pedido aberto"
              type="number"
              min="1"
              max="14"
              value={days}
              onChange={(ev) => setDays(Number(ev.target.value))}
            />
          </label>
          <Rows
            rows={[{ label: 'Autorização máxima de caixa', value: cr(quantity * price + freight) }]}
          />
          <button
            className="primary full"
            disabled={
              pending || !destination || !product || quantity <= 0 || price <= 0 || freight <= 0
            }
            onClick={async () => {
              if (
                await run(
                  {
                    type: 'createPurchaseRequest',
                    destinationId: destination,
                    product: product as ProductId,
                    quantity,
                    unitPrice: price,
                    maxFreight: freight,
                    deliveryDays: days,
                  },
                  'Necessidade publicada. Empresas podem enviar propostas.',
                )
              )
                setCreate(false);
            }}
          >
            Publicar pedido sem cobrança
          </button>
        </Modal>
      )}
      {negotiating && (
        <Modal title="Proposta e alteração de termos" onClose={() => setNegotiating(undefined)}>
          <p>
            {products[negotiating.product].name} · comprador{' '}
            {world.companies.find((c) => c.id === negotiating.buyerId)?.name}
          </p>
          {negotiating.buyerId !== actor && (
            <Select
              label="Origem da proposta"
              value={origin}
              onChange={(ev) => setOrigin(ev.target.value)}
            >
              <option value="">Escolher meu estoque</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {num(u.inventory[negotiating.product] ?? 0)} em estoque
                </option>
              ))}
            </Select>
          )}
          <label className="field">
            Quantidade proposta
            <input
              aria-label="Quantidade proposta"
              type="number"
              min="1"
              value={quantity}
              onChange={(ev) => setQuantity(Number(ev.target.value))}
            />
          </label>
          <label className="field">
            Preço por unidade (R$)
            <input
              aria-label="Preço proposto"
              type="number"
              step=".01"
              min=".01"
              value={price / 100}
              onChange={(ev) => setPrice(Math.round(Number(ev.target.value) * 100))}
            />
          </label>
          <label className="field">
            Frete máximo (R$)
            <input
              aria-label="Frete proposto"
              type="number"
              step=".01"
              min=".01"
              value={freight / 100}
              onChange={(ev) => setFreight(Math.round(Number(ev.target.value) * 100))}
            />
          </label>
          <label className="field">
            Prazo em dias do jogo
            <input
              aria-label="Prazo proposto"
              type="number"
              min="1"
              max="14"
              value={days}
              onChange={(ev) => setDays(Number(ev.target.value))}
            />
          </label>
          <Select
            label="Transportadora proposta"
            value={carrier}
            onChange={(ev) => setCarrier(ev.target.value)}
          >
            <option value="">Escolher transporte</option>
            {world.companies
              .filter(
                (c) =>
                  (c.bot || c.id === actor) && world.vehicles.some((v) => v.companyId === c.id),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
          <p className="small muted">
            Enviar termos exige aceitação da outra parte. O pagamento será revalidado nessa
            aceitação.
          </p>
          <button
            className="primary full"
            disabled={pending || !origin || !carrier || quantity <= 0 || price <= 0 || freight <= 0}
            onClick={async () => {
              if (
                await run(
                  {
                    type: 'proposeOrder',
                    orderId: negotiating.id,
                    establishmentId: origin,
                    unitPrice: price,
                    quantity,
                    maxFreight: freight,
                    deliveryDays: days,
                    carrierId: carrier,
                  },
                  'Proposta enviada para aprovação da contraparte.',
                )
              )
                setNegotiating(undefined);
            }}
          >
            Enviar proposta
          </button>
        </Modal>
      )}
      {ro && q && (
        <Modal title="Confirmar os termos e despachar" onClose={() => setReview(undefined)}>
          <Rows
            rows={[
              {
                label: 'Quantidade',
                value: `${num(props?.quantity ?? ro.quantity)} ${products[ro.product].unit}`,
              },
              { label: 'Preço por unidade', value: cr(props?.unitPrice ?? ro.unitPrice) },
              {
                label: 'Mercadoria',
                value: cr((props?.quantity ?? ro.quantity) * (props?.unitPrice ?? ro.unitPrice)),
              },
              { label: 'Frete atual', value: cr(q.price) },
              { label: 'Caminhões', value: q.compatible ? q.parts.length : 'Sem capacidade' },
            ]}
          />
          <button
            className="primary full"
            disabled={pending || !q.compatible || q.price > (props?.maxFreight ?? ro.maxFreight)}
            onClick={async () => {
              if (
                await run(
                  props
                    ? { type: 'acceptProposal', orderId: ro.id, proposalId: props.id }
                    : { type: 'acceptOrder', orderId: ro.id },
                  'Termos aceitos. Pedido despachado em veículos reais.',
                )
              )
                setReview(undefined);
            }}
          >
            Confirmar aceitação e transporte
          </button>
        </Modal>
      )}
    </div>
  );
}
