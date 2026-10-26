import { useState } from 'react';
import { Truck, Check, ChevronRight, MapPin, Info, ShoppingCart } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import {
  Badge,
  Empty,
  Modal,
  PageHeading,
  Panel,
  Progress,
  Rows,
  Select,
  Tabs,
} from '../../components/ui';
import { WorldMap, defaultLayers } from '../../components/WorldMap';
import { products, TIME_SCALE } from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { shipmentStatus } from '../../../../../packages/simulation/src/shipment';
import { useRoute } from '../../lib/routing';
import { useClock } from '../../lib/clock';
import '../../economy.css';

export function LogisticsPage() {
  const { world, actor, intent, navigate, run, pending } = useGame(),
    now = useClock();
  const [view, setView] = useState(intent.offerId ? 'Contratar frete' : 'Minhas cargas'),
    [carrier, setCarrier] = useState(''),
    [confirm, setConfirm] = useState(false),
    [shipmentId, setShipment] = useState(''),
    [statusFilter, setStatusFilter] = useState(''),
    [more, setMore] = useState(false);
  const offer = world.offers.find((o) => o.id === intent.offerId),
    origin = world.establishments.find((e) => e.id === offer?.establishmentId),
    dest = world.establishments.find((e) => e.id === intent.destinationId && e.companyId === actor),
    quantity = intent.quantity;
  const op = world.properties.find((p) => p.id === origin?.propertyId),
    dp = world.properties.find((p) => p.id === dest?.propertyId),
    loading = useRoute(op?.id, dp?.id);
  const quotes =
    offer && origin && dest && quantity
      ? ['transbrasil', 'rodoleste', 'expresso']
          .map((id) => quote(world, origin.id, dest.id, offer.product, quantity, id))
          .sort((a, b) => a.price - b.price)
      : [];
  const selected = quotes.find((q) => q.carrierId === carrier),
    preview = selected ?? quotes[0];
  const shipments = world.shipments
      .filter((s) => s.buyerId === actor || s.carrierId === actor || s.sellerId === actor)
      .slice()
      .reverse(),
    visible = shipments.filter(
      (s) => !statusFilter || (statusFilter === 'delivered') === s.delivered,
    ),
    shipment = shipments.find((s) => s.id === shipmentId);
  const selectedRoute =
    shipment?.route ??
    (shipment
      ? world.routes[
          `${world.establishments.find((e) => e.id === shipment.originId)!.propertyId}:${world.establishments.find((e) => e.id === shipment.destinationId)!.propertyId}`
        ]?.coordinates
      : undefined);
  const progress = shipment ? shipmentStatus(shipment, now) : null,
    balance = world.companies.find((c) => c.id === actor)!.balance;
  const sourceName = (id: string) => {
    const e = world.establishments.find((e) => e.id === id)!;
    return world.properties.find((p) => p.id === e.propertyId)!.city;
  };
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
          <Tabs values={['Minhas cargas', 'Contratar frete']} value={view} onChange={setView} />
          {view === 'Minhas cargas' && (
            <Select
              label="Filtrar estado da carga"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Estado (opcional)</option>
              <option value="route">Em andamento</option>
              <option value="delivered">Entregues</option>
            </Select>
          )}
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
                  <WorldMap route={preview.coordinates} />
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
                {quotes.map((q, i) => (
                  <div
                    key={q.carrierId}
                    className={`quote-card ${carrier === q.carrierId ? 'selected' : ''}`}
                  >
                    <div className="quote-title">
                      <i className="table-icon">
                        <Truck size={19} />
                      </i>
                      <div>
                        <h3>{world.companies.find((c) => c.id === q.carrierId)!.name}</h3>
                        <small>Até 30 t / 85 m³ · capacidade verificada</small>
                      </div>
                      {i === 0 && <Badge tone="green">Menor custo</Badge>}
                    </div>
                    <div className="quote-values">
                      <div>
                        <span>Frete</span>
                        <strong>{cr(q.price)}</strong>
                      </div>
                      <div>
                        <span>Entrega no jogo</span>
                        <b>{num((q.durationMs * TIME_SCALE) / 60000)} min</b>
                      </div>
                    </div>
                    <button
                      className={carrier === q.carrierId ? 'primary full' : 'secondary full'}
                      disabled={!q.compatible || loading}
                      onClick={() => setCarrier(q.carrierId)}
                    >
                      {carrier === q.carrierId ? <Check size={16} /> : <ChevronRight size={16} />}{' '}
                      {!q.compatible
                        ? 'Sem veículo disponível'
                        : carrier === q.carrierId
                          ? 'Selecionada'
                          : 'Selecionar transportadora'}
                    </button>
                  </div>
                ))}
                <div className="panel-content">
                  {selected ? (
                    <>
                      <Rows
                        rows={[
                          { label: 'Mercadoria', value: cr(offer.price * quantity) },
                          { label: 'Frete', value: cr(selected.price) },
                        ]}
                      />
                      <div className="total-row">
                        <strong>Total</strong>
                        <strong>{cr(offer.price * quantity + selected.price)}</strong>
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
                          balance < offer.price * quantity + selected.price
                        }
                        onClick={() => setConfirm(true)}
                      >
                        Contratar e comprar
                      </button>
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
          <div className="shipment-dashboard">
            <Panel
              title="Minhas cargas"
              subtitle={`${visible.length} remessas no filtro atual`}
              className="shipments-panel"
            >
              {visible.length ? (
                visible.map((s) => {
                  const status = shipmentStatus(s, now);
                  return (
                    <button
                      className={`shipment-item ${s.id === shipmentId ? 'selected' : ''}`}
                      key={s.id}
                      onClick={() => setShipment(s.id)}
                    >
                      <div>
                        <strong>Carga {s.id.slice(0, 6).toUpperCase()}</strong>
                        <Badge tone={s.delivered ? 'blue' : 'green'}>
                          {s.delivered
                            ? 'Entregue'
                            : status.phase === 'Em trânsito'
                              ? 'Em trânsito'
                              : 'Em preparação'}
                        </Badge>
                      </div>
                      <p>
                        {sourceName(s.originId)} → {sourceName(s.destinationId)}
                      </p>
                      <small>
                        {products[s.product].name} · {num(s.quantity)} {products[s.product].unit}
                      </small>
                      <Progress value={status.totalProgress * 100} color="blue" />
                    </button>
                  );
                })
              ) : (
                <Empty
                  title="Nenhuma remessa neste estado"
                  description="Compre uma mercadoria para iniciar sua primeira entrega."
                  action={
                    <button className="primary" onClick={() => navigate('market')}>
                      Ir ao mercado
                    </button>
                  }
                />
              )}
            </Panel>
            <Panel
              title={
                shipment
                  ? `${sourceName(shipment.originId)} → ${sourceName(shipment.destinationId)}`
                  : 'Entregas da sua empresa'
              }
              subtitle={
                shipment
                  ? `${products[shipment.product].name} · ${num(shipment.quantity)} ${products[shipment.product].unit}`
                  : 'Selecione uma remessa ou acompanhe todas as rotas ativas'
              }
              action={
                shipment && (
                  <Badge tone={shipment.delivered ? 'green' : 'blue'}>{progress?.phase}</Badge>
                )
              }
            >
              <div className="freight-map">
                <WorldMap
                  route={selectedRoute}
                  shipment={shipment}
                  layers={{ ...defaultLayers, routes: true }}
                  ownership="mine"
                />
              </div>
              {shipment && progress ? (
                <div className="shipment-details">
                  <div className="delivery-timeline">
                    {['Coleta', 'Carregamento', 'Em trânsito', 'Entrega'].map((phase, i) => (
                      <div
                        className={
                          (
                            i === 3
                              ? shipment.delivered
                              : i === 2
                                ? now >= (shipment.roadDepartureAt ?? shipment.departedAt)
                                : i === 1
                                  ? now >= (shipment.pickupAt ?? shipment.departedAt)
                                  : true
                          )
                            ? 'done'
                            : ''
                        }
                        key={phase}
                      >
                        <i />
                        {phase}
                      </div>
                    ))}
                  </div>
                  <div className="analysis-stats">
                    <div>
                      <span>Trajeto percorrido</span>
                      <strong>{num(progress.progress * 100, 1)}%</strong>
                      <small>
                        {num(shipment.distance * progress.progress, 1)} de{' '}
                        {num(shipment.distance, 1)} km
                      </small>
                    </div>
                    <div>
                      <span>Tempo real restante</span>
                      <strong>
                        {shipment.delivered
                          ? 'Recebida'
                          : `${Math.ceil(progress.remainingMs / 1000)} s`}
                      </strong>
                      <small>{progress.phase}</small>
                    </div>
                    <div>
                      <span>Frete contratado</span>
                      <strong>{cr(shipment.freight)}</strong>
                      <small>
                        {world.companies.find((c) => c.id === shipment.carrierId)?.name}
                      </small>
                    </div>
                  </div>
                  <p className="chart-caption">
                    <Info size={14} />A posição é uma representação do tempo da simulação. O estoque
                    só é creditado após a confirmação da entrega pelo servidor.
                  </p>
                </div>
              ) : (
                <div className="panel-content">
                  <p className="muted">
                    {shipments.filter((s) => !s.delivered).length} cargas em andamento. Os veículos
                    seguem os horários gravados na contratação.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
      {confirm && offer && dest && quantity && selected && (
        <Modal title="Confirmar compra e transporte" onClose={() => setConfirm(false)}>
          <p>A mercadoria será reservada na origem e recebida somente após a entrega.</p>
          <Rows
            rows={[
              {
                label: 'Carga',
                value: `${num(quantity)} ${products[offer.product].unit} · ${products[offer.product].name}`,
              },
              { label: 'Mercadoria', value: cr(offer.price * quantity) },
              { label: 'Frete', value: cr(selected.price) },
              {
                label: 'Saldo após pagamento',
                value: cr(balance - offer.price * quantity - selected.price),
              },
            ]}
          />
          <button
            className="primary full"
            disabled={pending}
            onClick={async () => {
              if (
                await run(
                  {
                    type: 'trade',
                    offerId: offer.id,
                    quantity,
                    destinationId: dest.id,
                    carrierId: selected.carrierId,
                    expectedTotal: offer.price * quantity + selected.price,
                  },
                  'Compra confirmada. A carga está em preparação.',
                )
              ) {
                setConfirm(false);
                setView('Minhas cargas');
              }
            }}
          >
            {pending ? 'Confirmando…' : `Pagar ${cr(offer.price * quantity + selected.price)}`}
          </button>
        </Modal>
      )}
    </>
  );
}
