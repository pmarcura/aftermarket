import { useState } from 'react';
import { Truck, Route, Check, ArrowRight, ChevronRight, MapPin } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading, Panel, Badge, Rows, Modal, Empty, Progress } from '../components/ui';
import { WorldMap } from '../components/WorldMap';
import { products, TIME_SCALE } from '../../../../packages/simulation/src/model';
import { quote } from '../../../../packages/simulation/src/engine';
import { useRoute } from '../lib/routing';
import { useClock } from '../lib/clock';
export function LogisticsPage() {
  const now = useClock();
  const { world, actor, intent, navigate, pending, run } = useGame();
  const [carrier, setCarrier] = useState('transbrasil'),
    [confirm, setConfirm] = useState(false),
    [shipmentId, setShipment] = useState<string>();
  const offer =
    world.offers.find((o) => o.id === intent.offerId) ??
    world.offers.find((o) => o.product === intent.product);
  const origin = world.establishments.find((e) => e.id === offer?.establishmentId),
    destination =
      world.establishments.find((e) => e.id === intent.destinationId && e.companyId === actor) ??
      world.establishments.find((e) => e.companyId === actor);
  const op = world.properties.find((p) => p.id === origin?.propertyId),
    dp = world.properties.find((p) => p.id === destination?.propertyId),
    quantity = intent.quantity ?? 24;
  const loading = useRoute(op?.id, dp?.id);
  const shipments = world.shipments
      .filter((s) => s.buyerId === actor)
      .slice()
      .reverse(),
    shipment = shipments.find((s) => s.id === shipmentId);
  const quotes =
    origin && destination && offer
      ? ['transbrasil', 'rodoleste', 'expresso']
          .map((id) => quote(world, origin.id, destination.id, offer.product, quantity, id))
          .sort((a, b) => a.price - b.price)
      : [];
  const selected = quotes.find((q) => q.carrierId === carrier) ?? quotes[0];
  const activeOrigin = shipment
      ? world.establishments.find((e) => e.id === shipment.originId)
      : origin,
    activeDest = shipment
      ? world.establishments.find((e) => e.id === shipment.destinationId)
      : destination;
  const ap = world.properties.find((p) => p.id === activeOrigin?.propertyId),
    bp = world.properties.find((p) => p.id === activeDest?.propertyId);
  const route =
    shipment && ap && bp
      ? (world.routes[`${ap.id}:${bp.id}`]?.coordinates ?? [ap.coordinates, bp.coordinates])
      : selected?.coordinates;
  const duration = shipment
    ? shipment.arrivesAt - shipment.departedAt
    : (selected?.durationMs ?? 0);
  const gameMinutes = Math.round((duration * TIME_SCALE) / 60000);
  const balance = world.companies.find((c) => c.id === actor)!.balance;
  return (
    <>
      <PageHeading
        eyebrow="Logística / Nova remessa"
        title="Contratar frete"
        description="Escolha o melhor custo, capacidade e prazo para sua carga."
        action={
          <button className="secondary" onClick={() => navigate('carrier')}>
            <Truck size={17} /> Minha transportadora <ChevronRight size={14} />
          </button>
        }
      />
      <div className="page-body">
        <div className="freight-filter">
          <div>
            <MapPin size={16} />
            <span>
              Origem: <strong>{op?.city ?? 'Selecione no mercado'}</strong>
            </span>
          </div>
          <ArrowRight size={16} />
          <div>
            <MapPin size={16} />
            <span>
              Destino: <strong>{dp?.city ?? 'Sem destino'}</strong>
            </span>
          </div>
          <div>
            <Truck size={16} />
            <span>
              {offer ? products[offer.product].name : 'Sem mercadoria'} · {num(quantity)}{' '}
              {offer ? products[offer.product].unit : ''}
            </span>
          </div>
          <button className="secondary" onClick={() => navigate('market')}>
            Alterar compra
          </button>
        </div>
        <div className="freight-grid">
          <Panel
            title="Minhas cargas"
            action={<small>{shipments.length} remessas</small>}
            className="shipments-panel"
          >
            {shipments.length ? (
              shipments.map((s, i) => {
                const from = world.establishments.find((e) => e.id === s.originId)!,
                  to = world.establishments.find((e) => e.id === s.destinationId)!,
                  progress = s.delivered
                    ? 100
                    : ((now - s.departedAt) / (s.arrivesAt - s.departedAt)) * 100;
                return (
                  <button
                    className={`shipment-item ${shipmentId === s.id ? 'selected' : ''}`}
                    key={s.id}
                    onClick={() => setShipment(s.id)}
                  >
                    <div>
                      <strong>Carga #{String(4082 + shipments.length - i)}</strong>
                      <Badge tone={s.delivered ? 'blue' : 'green'}>
                        {s.delivered ? 'Entregue' : 'Em trânsito'}
                      </Badge>
                    </div>
                    <p>
                      {world.properties.find((p) => p.id === from.propertyId)!.city} →{' '}
                      {world.properties.find((p) => p.id === to.propertyId)!.city}
                    </p>
                    <small>
                      {num(s.quantity)} {products[s.product].unit} · {products[s.product].name}
                    </small>
                    <Progress value={progress} color="blue" />
                  </button>
                );
              })
            ) : (
              <Empty
                title="Nenhuma carga a caminho"
                description="Confirme a primeira compra para acompanhar a entrega aqui."
              />
            )}
            {shipment && (
              <button className="text-button panel-content" onClick={() => setShipment(undefined)}>
                Voltar à cotação atual
              </button>
            )}
          </Panel>
          <Panel
            title={`${ap?.city ?? 'Origem'} — ${ap?.state ?? ''} → ${bp?.city ?? 'Destino'} — ${bp?.state ?? ''}`}
            action={
              <Badge tone={selected?.source === 'osrm' ? 'blue' : 'gold'}>
                {loading
                  ? 'Calculando rota…'
                  : selected?.source === 'osrm'
                    ? 'Rota rodoviária'
                    : 'Rota estimada'}
              </Badge>
            }
            className="freight-map-panel"
          >
            <div className="freight-map">
              <WorldMap route={route} />
              <span className="map-location">
                <Route size={16} />
                {shipment
                  ? shipment.delivered
                    ? 'Carga recebida no estoque'
                    : 'Transporte em andamento'
                  : 'Trajeto da cotação'}
              </span>
            </div>
            <div className="freight-map-stats">
              <div>
                <span>Distância {selected?.source === 'osrm' ? 'rodoviária' : 'estimada'}</span>
                <strong>{num(shipment?.distance ?? selected?.distanceKm ?? 0, 1)} km</strong>
              </div>
              <div>
                <span>Prazo no jogo</span>
                <strong>
                  {gameMinutes} min <small>({Math.round(duration / 1000)} s reais)</small>
                </strong>
              </div>
              <div>
                <span>Carga</span>
                <strong>
                  {num(shipment?.quantity ?? quantity)} {offer ? products[offer.product].unit : ''}
                </strong>
              </div>
            </div>
          </Panel>
          <Panel
            title="Cotações de transporte"
            action={<small>{quotes.length} opções</small>}
            className="quotes-panel"
          >
            {quotes.length ? (
              quotes.map((q, i) => (
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
                      <small>BOT · Veículos de até 30 t / 85 m³</small>
                    </div>
                    {i === 0 && <Badge tone="green">Menor custo</Badge>}
                  </div>
                  <div className="quote-values">
                    <div>
                      <span>Preço cotado</span>
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
                    onClick={() => {
                      setCarrier(q.carrierId);
                      setShipment(undefined);
                    }}
                  >
                    {carrier === q.carrierId ? <Check size={16} /> : <ChevronRight size={16} />}
                    {!q.compatible
                      ? 'Sem capacidade disponível'
                      : carrier === q.carrierId
                        ? 'Transportadora selecionada'
                        : 'Selecionar transportadora'}
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="Escolha uma mercadoria"
                description="Compare as ofertas disponíveis no mercado."
              />
            )}
            <div className="panel-content">
              {selected && offer && (
                <>
                  <Rows
                    rows={[
                      { label: 'Mercadoria', value: cr(offer.price * quantity) },
                      { label: 'Frete', value: cr(selected.price) },
                    ]}
                  />
                  <div className="total-row">
                    <strong>Total da compra</strong>
                    <strong>{cr(offer.price * quantity + selected.price)}</strong>
                  </div>
                  <button
                    className="primary full"
                    disabled={
                      !selected.compatible ||
                      loading ||
                      !destination ||
                      balance < offer.price * quantity + selected.price
                    }
                    onClick={() => setConfirm(true)}
                  >
                    <Truck size={16} /> Contratar e comprar
                  </button>
                  {balance < offer.price * quantity + selected.price && (
                    <p className="negative small">Saldo insuficiente para a compra e o frete.</p>
                  )}
                </>
              )}
              <p className="muted small">
                As distâncias estimadas são identificadas quando o roteador não está disponível. O
                estoque só chega ao destino após a entrega.
              </p>
            </div>
          </Panel>
        </div>
      </div>
      {confirm && offer && destination && selected && (
        <Modal title="Confirmar compra e transporte" onClose={() => setConfirm(false)}>
          <p>
            A mercadoria sai do estoque de <strong>{origin?.name}</strong> e será recebida em{' '}
            <strong>{destination.name}</strong>.
          </p>
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
          <p className="muted small">
            O pagamento ao fornecedor e à transportadora é imediato neste cenário. Seu inventário
            recebe os produtos quando o prazo terminar.
          </p>
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
                    destinationId: destination.id,
                    carrierId: selected.carrierId,
                  },
                  'Compra confirmada. A carga está em trânsito.',
                )
              )
                setConfirm(false);
            }}
          >
            {pending ? 'Confirmando…' : `Pagar ${cr(offer.price * quantity + selected.price)}`}
          </button>
        </Modal>
      )}
    </>
  );
}
