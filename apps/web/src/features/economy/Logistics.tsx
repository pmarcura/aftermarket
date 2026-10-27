import { FleetPicker } from '../../components/FleetPicker';
import { freeCash } from '../../../../../packages/simulation/src/design';
import { OrderLogistics } from '../business/OrderLogistics';
import { useState } from 'react';
import { Truck, ChevronRight, MapPin, ShoppingCart } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Empty, Modal, PageHeading, Panel, Rows, Tabs } from '../../components/ui';
import { WorldMap } from '../../components/WorldMap';
import { products, TIME_SCALE } from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useRoute } from '../../lib/routing';
import '../../economy.css';

export function LogisticsPage() {
  const { world, actor, intent, navigate, run, pending } = useGame();
  const [view, setView] = useState(intent.offerId ? 'Contratar frete' : 'Meus pedidos'),
    [carrier, setCarrier] = useState(''),
    [confirm, setConfirm] = useState(false),
    [more, setMore] = useState(false);
  const [orderMode, setOrderMode] = useState(false),
    [adjustedQuantity, setAdjustedQuantity] = useState<number>(),
    [deliveryDays, setDeliveryDays] = useState(3);
  const offer = world.offers.find((o) => o.id === intent.offerId),
    origin = world.establishments.find((e) => e.id === offer?.establishmentId),
    dest = world.establishments.find((e) => e.id === intent.destinationId && e.companyId === actor),
    quantity = adjustedQuantity ?? intent.quantity;
  const goodsCost = offer && quantity && origin?.companyId !== actor ? offer.price * quantity : 0;
  const op = world.properties.find((p) => p.id === origin?.propertyId),
    dp = world.properties.find((p) => p.id === dest?.propertyId),
    loading = useRoute(op?.id, dp?.id);
  const quotes =
    offer && origin && dest && quantity
      ? world.companies
          .filter(
            (c) =>
              (c.id === actor || (c.bot && !c.id.startsWith('treasury'))) &&
              world.vehicles.some((v) => v.companyId === c.id),
          )
          .map((c) => c.id)
          .map((id) => quote(world, origin.id, dest.id, offer.product, quantity, id))
          .sort((a, b) => a.price - b.price)
      : [];
  const selected = quotes.find((q) => q.carrierId === carrier),
    preview = selected ?? quotes[0];
  const balance = freeCash(world, actor);
  return (
    <>
      <PageHeading
        eyebrow="Logística / Controle de entregas"
        title={view === 'Contratar frete' ? 'Contratar frete' : 'Logística e entregas'}
        description="A posição da carga acompanha o prazo da remessa. Recarregar a página preserva o progresso."
        action={
          <button className="secondary" onClick={() => navigate('carrier')}>
            <Truck size={17} /> Minha transportadora <ChevronRight size={14} />
          </button>
        }
      />
      <div className="page-body">
        <div className="logistics-toolbar">
          <Tabs values={['Meus pedidos', 'Contratar frete']} value={view} onChange={setView} />
        </div>
        {view === 'Contratar frete' && (!offer || !origin || !dest || !quantity) ? (
          <Empty
            title="Monte a compra antes de contratar"
            description="Escolha uma oferta, o estabelecimento de destino e a quantidade no mercado. Nenhuma carga é escolhida automaticamente."
            action={
              <button className="primary" onClick={() => navigate('market')}>
                <ShoppingCart size={16} /> Abrir mercado
              </button>
            }
          />
        ) : view === 'Contratar frete' && offer && dest && quantity && preview ? (
          <>
            <div className="freight-filter">
              <div>
                <MapPin size={16} />
                {op?.city} → {dp?.city}
              </div>
              <div>
                {products[offer.product].name} · {num(quantity)} {products[offer.product].unit}
              </div>
              <label className="field">
                Quantidade a transportar
                <input
                  aria-label="Quantidade no frete"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setAdjustedQuantity(Number(e.target.value))}
                />
              </label>
              <button className="secondary" onClick={() => navigate('market')}>
                Alterar compra
              </button>
            </div>
            <div className="freight-quote-grid">
              <Panel
                title="Rota planejada"
                subtitle="A animação começa após a contratação"
                action={
                  <Badge tone={preview.source === 'osrm' ? 'blue' : 'gold'}>
                    {loading
                      ? 'Calculando…'
                      : preview.source === 'osrm'
                        ? 'Rodoviária'
                        : 'Estimativa geográfica'}
                  </Badge>
                }
              >
                <div className="freight-map">
                  <WorldMap route={preview.routeRequired ? undefined : preview.coordinates} />
                </div>
                <div className="freight-map-stats">
                  <div>
                    <span>Distância da carga</span>
                    <strong>{num(preview.distanceKm, 1)} km</strong>
                  </div>
                  <div>
                    <span>Prazo no jogo</span>
                    <strong>{num((preview.durationMs * TIME_SCALE) / 60000)} min</strong>
                  </div>
                  <div>
                    <span>Tempo real</span>
                    <strong>{Math.ceil(preview.durationMs / 1000)} s</strong>
                  </div>
                </div>
              </Panel>
              <Panel
                title="Cotações de transporte"
                subtitle="Escolha explicitamente quem fará o serviço"
              >
                <div className="panel-content">
                  <FleetPicker
                    originId={origin?.id}
                    destinationId={dest.id}
                    product={offer.product}
                    quantity={quantity}
                    value={carrier}
                    onChange={setCarrier}
                    onQuantityChange={setAdjustedQuantity}
                    label="Frota para a compra"
                  />
                </div>
                <div className="panel-content">
                  {selected ? (
                    <>
                      <div className="truck-manifest">
                        {selected.parts.map((part) => (
                          <div key={part.vehicleId}>
                            <Truck size={16} />
                            <span>{world.vehicles.find((v) => v.id === part.vehicleId)!.name}</span>
                            <strong>
                              {num(part.quantity)} {products[offer.product].unit}
                            </strong>
                            <small>{cr(part.price)}</small>
                          </div>
                        ))}
                      </div>
                      <Rows
                        rows={[
                          { label: 'Mercadoria', value: cr(goodsCost) },
                          { label: 'Frete', value: cr(selected.price) },
                        ]}
                      />
                      <div className="total-row">
                        <strong>Total</strong>
                        <strong>{cr(goodsCost + selected.price)}</strong>
                      </div>
                      <button className="text-button" onClick={() => setMore(!more)}>
                        {more ? 'Ocultar cálculo' : 'Ver cálculo do frete'}
                      </button>
                      {more && (
                        <Rows
                          rows={[
                            { label: 'Combustível', value: cr(selected.costs.fuel) },
                            { label: 'Motorista', value: cr(selected.costs.driver) },
                            { label: 'Manutenção por km', value: cr(selected.costs.maintenance) },
                            { label: 'Pedágios estimados', value: cr(selected.costs.tolls) },
                            { label: 'Manuseio', value: cr(selected.costs.handling) },
                            {
                              label: 'Margem do transportador',
                              value: cr(selected.price - selected.costs.operatingCost),
                            },
                          ]}
                        />
                      )}
                      <button
                        className="primary full"
                        disabled={
                          pending ||
                          loading ||
                          !selected.compatible ||
                          balance < goodsCost + selected.price
                        }
                        onClick={() => {
                          setOrderMode(false);
                          setConfirm(true);
                        }}
                      >
                        Contratar e comprar
                      </button>
                      {origin?.companyId !== actor && (
                        <button
                          className="secondary full"
                          disabled={pending || loading || !selected.compatible}
                          onClick={() => {
                            setOrderMode(true);
                            setConfirm(true);
                          }}
                        >
                          Enviar pedido para aceitação
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="muted">Selecione uma transportadora para revisar o total.</p>
                  )}
                  <p className="muted small">
                    O total é revalidado no servidor. Uma cotação alterada exige nova confirmação.
                  </p>
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <OrderLogistics />
        )}
      </div>
      {confirm && offer && dest && quantity && selected && (
        <Modal
          title={orderMode ? 'Enviar pedido ao fornecedor' : 'Confirmar compra e transporte'}
          onClose={() => setConfirm(false)}
        >
          <p>
            {orderMode
              ? 'O fornecedor precisa aceitar. Nenhum pagamento ou estoque é reservado antes da aceitação. O valor da mercadoria e o teto de frete ficam registrados.'
              : 'A mercadoria será reservada na origem e recebida somente após a entrega.'}
          </p>
          {orderMode && (
            <label className="field">
              Prazo de entrega (dias do jogo)
              <input
                aria-label="Prazo de entrega do pedido"
                type="number"
                min="1"
                max="14"
                value={deliveryDays}
                onChange={(event) => setDeliveryDays(Number(event.target.value))}
              />
            </label>
          )}
          <Rows
            rows={[
              {
                label: 'Carga',
                value: `${num(quantity)} ${products[offer.product].unit} · ${products[offer.product].name}`,
              },
              { label: 'Mercadoria', value: cr(goodsCost) },
              { label: 'Frete', value: cr(selected.price) },
              {
                label: 'Saldo após pagamento',
                value: cr(balance - goodsCost - selected.price),
              },
            ]}
          />
          <button
            className="primary full"
            disabled={pending}
            onClick={async () => {
              if (
                await run(
                  orderMode
                    ? {
                        type: 'requestOrder',
                        offerId: offer.id,
                        quantity,
                        destinationId: dest.id,
                        carrierId: selected.carrierId,
                        maxFreight: selected.price,
                        deliveryDays,
                        expectedUnitPrice: offer.price,
                      }
                    : {
                        type: 'trade',
                        offerId: offer.id,
                        quantity,
                        destinationId: dest.id,
                        carrierId: selected.carrierId,
                        expectedTotal: goodsCost + selected.price,
                      },
                  orderMode
                    ? 'Pedido enviado. Acompanhe a aceitação em Meus Negócios.'
                    : 'Compra confirmada. A carga está em preparação.',
                )
              ) {
                setConfirm(false);
                if (orderMode) navigate('businesses');
                else setView('Meus pedidos');
              }
            }}
          >
            {pending
              ? 'Confirmando…'
              : orderMode
                ? 'Enviar pedido com teto de frete'
                : `Pagar ${cr(goodsCost + selected.price)}`}
          </button>
        </Modal>
      )}
    </>
  );
}
