import { useState } from 'react';
import { Truck, MapPin } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Panel, Badge, Select, Progress, Empty, Rows } from '../../components/ui';
import { WorldMap, defaultLayers } from '../../components/WorldMap';
import { products, type Shipment } from '../../../../../packages/simulation/src/model';
import { shipmentStatus } from '../../../../../packages/simulation/src/shipment';
import { shipmentRoute } from '../../../../../packages/simulation/src/road-path';
import { useClock } from '../../lib/clock';
import { useRoute } from '../../lib/routing';
import { Pagination, usePagination } from '../../components/Pagination';
export function OrderLogistics() {
  const { world, actor, navigate } = useGame(),
    now = useClock();
  const [selectedId, setSelected] = useState(''),
    [filter, setFilter] = useState(''),
    [highlight, setHighlight] = useState('');
  const groups = new Map<string, Shipment[]>();
  for (const s of world.shipments) {
    const key = s.infrastructureId
      ? `public:${s.infrastructureId}`
      : s.orderId
        ? `order:${s.orderId}`
        : s.batchId
          ? `batch:${s.batchId}`
          : `legacy:${s.id}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const orders = [...groups]
    .filter(([, ships]) => ships.some((s) => [s.buyerId, s.sellerId, s.carrierId].includes(actor)))
    .map(([id, shipments]) => {
      const first = shipments[0],
        quantity = shipments.reduce((n, s) => n + s.quantity, 0),
        delivered = shipments.reduce((n, s) => n + (s.delivered ? s.quantity : 0), 0),
        contract = world.infrastructure.find((c) => c.id === first.infrastructureId),
        origin = world.establishments.find((e) => e.id === first.originId)!,
        destination = world.establishments.find((e) => e.id === first.destinationId)!;
      return {
        id,
        shipments,
        quantity,
        delivered,
        first,
        contract,
        origin,
        destination,
        complete: shipments.every((s) => s.delivered),
        progress:
          shipments.reduce((n, s) => n + shipmentStatus(s, now).totalProgress * s.quantity, 0) /
          quantity,
        at: Math.max(...shipments.map((s) => s.departedAt)),
      };
    })
    .sort((a, b) => b.at - a.at);
  const visible = orders.filter(
      (o) => !filter || (filter === 'delivered' ? o.complete : !o.complete),
    ),
    selected = orders.find((o) => o.id === selectedId);
  const page = usePagination(visible, (o) =>
    [o.id, o.origin.name, o.destination.name, products[o.first.product].name].join(' '),
  );
  const loadingRoute = useRoute(
    selected?.origin.propertyId,
    selected?.destination.propertyId,
    true,
  );
  const savedRoute = selected
    ? world.routes[`${selected.origin.propertyId}:${selected.destination.propertyId}`]
    : undefined;
  const roadReady =
    selected && (selected.first.mapRouteSource === 'osrm' || selected.first.routeSource === 'osrm');
  return (
    <>
      <div className="section-title">
        <p className="muted">
          Cada pedido reúne todos os caminhões e só conclui após a última entrega.
        </p>
        <Select
          label="Estado dos pedidos logísticos"
          value={filter}
          onChange={(ev) => setFilter(ev.target.value)}
        >
          <option value="">Estado (opcional)</option>
          <option value="route">Em andamento</option>
          <option value="delivered">Concluídos</option>
        </Select>
      </div>
      <Pagination value={page} label="pedidos logísticos" />
      <div className="shipment-dashboard">
        <Panel
          title="Meus pedidos logísticos"
          subtitle={`${page.total} de ${visible.length} pedidos · ${visible.reduce((n, o) => n + o.shipments.length, 0)} viagens`}
          className="shipments-panel"
        >
          {visible.length ? (
            page.rows.map((o) => (
              <button
                className={`shipment-item ${o.id === selectedId ? 'selected' : ''}`}
                key={o.id}
                onClick={() => setSelected(o.id)}
              >
                <div>
                  <strong>
                    {o.contract ? 'Contrato público' : 'Pedido'} #
                    {o.id.split(':')[1].slice(0, 6).toUpperCase()}
                  </strong>
                  <Badge tone={o.complete ? 'green' : 'blue'}>
                    {o.complete
                      ? 'Concluído'
                      : `${o.shipments.filter((s) => s.delivered).length}/${o.shipments.length} caminhões`}
                  </Badge>
                </div>
                <p>
                  {o.origin.name} →{' '}
                  {o.contract
                    ? `Prefeitura de ${o.contract.municipality ?? 'Campinas'}`
                    : o.destination.name}
                </p>
                <small>
                  {products[o.first.product].name} · {num(o.delivered)} / {num(o.quantity)}{' '}
                  {products[o.first.product].unit}
                </small>
                <Progress value={o.progress * 100} />
              </button>
            ))
          ) : (
            <Empty
              title="Nenhum pedido neste estado"
              description="Compras, transferências e contratos públicos aparecem aqui após o despacho."
              action={
                <button className="secondary" onClick={() => navigate('market')}>
                  Abrir mercado
                </button>
              }
            />
          )}
        </Panel>
        <Panel
          title={
            selected
              ? `${selected.origin.name} → ${selected.destination.name}`
              : 'Rotas dos seus pedidos'
          }
          subtitle={
            selected
              ? `${selected.shipments.length} ${selected.shipments.length === 1 ? 'caminhão' : 'caminhões'} · ${products[selected.first.product].name}`
              : 'Selecione um pedido para acompanhar todos os veículos juntos'
          }
          action={
            selected && (
              <Badge tone={selected.complete ? 'green' : 'blue'}>
                {selected.complete ? 'Entrega completa' : 'Entrega em andamento'}
              </Badge>
            )
          }
        >
          <div className="freight-map">
            <WorldMap
              route={
                selected && (roadReady || !world.requireRoadRoutes)
                  ? shipmentRoute(world, selected.first)
                  : undefined
              }
              shipments={selected?.shipments}
              highlightShipmentId={highlight}
              layers={{ ...defaultLayers, routes: true }}
              ownership="mine"
            />
          </div>
          {selected ? (
            <div className="panel-content">
              <div className="road-status">
                <strong>
                  {roadReady
                    ? 'Trajeto rodoviário'
                    : loadingRoute
                      ? 'Calculando pelas estradas…'
                      : 'Rota histórica estimada'}
                </strong>
                <span>OSRM / OpenStreetMap. Sem trânsito em tempo real.</span>
              </div>
              {selected.first.mapRouteSource === 'osrm' && (
                <p className="analysis-caption">
                  Trajeto visual recuperado pelas estradas. Preço e horários do contrato original
                  foram mantidos.
                </p>
              )}
              <p className="analysis-caption">
                Veículos na mesma posição podem se sobrepor. Use “Localizar” para destacar cada
                caminhão sobre a estrada.
              </p>
              <div className="section-title">
                <h3>
                  <Truck size={17} /> Caminhões deste pedido
                </h3>
                <span>
                  {selected.shipments.filter((s) => s.delivered).length} de{' '}
                  {selected.shipments.length} chegaram
                </span>
              </div>
              {selected.contract && (
                <div className="business-advice">
                  <strong>
                    {selected.contract.title} · {selected.contract.state ?? 'SP'}
                  </strong>
                  <p>
                    <MapPin size={14} /> Recebimento municipal em{' '}
                    {selected.contract.municipality ?? selected.destination.name}. O material é
                    consumido no programa público após cada chegada.
                  </p>
                </div>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Veículo</th>
                      <th>Quantidade</th>
                      <th>Etapa e progresso</th>
                      <th>Tempo real restante</th>
                      <th>No mapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.shipments.map((s) => {
                      const status = shipmentStatus(s, now),
                        truck = world.vehicles.find((v) => v.id === s.vehicleId);
                      return (
                        <tr key={s.id}>
                          <td>
                            <strong>{truck?.name ?? s.vehicleId}</strong>
                            <small className="block">
                              {world.companies.find((c) => c.id === s.carrierId)?.name}
                            </small>
                          </td>
                          <td>
                            {num(s.quantity)} {products[s.product].unit}
                          </td>
                          <td>
                            <Badge tone={s.delivered ? 'green' : 'blue'}>{status.phase}</Badge>
                            <Progress value={status.progress * 100} />
                          </td>
                          <td>
                            {s.delivered ? 'Recebido' : `${Math.ceil(status.remainingMs / 1000)} s`}
                          </td>
                          <td>
                            <button
                              className="secondary"
                              aria-pressed={highlight === s.id}
                              onClick={() => setHighlight(s.id)}
                            >
                              Localizar {truck?.name ?? 'caminhão'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!!savedRoute?.steps?.length && (
                <details>
                  <summary>Ver estradas e trechos do trajeto</summary>
                  <ol className="route-steps">
                    {savedRoute.steps
                      .filter((s) => s.distanceM > 50)
                      .map((step, i) => (
                        <li key={i}>
                          <strong>{step.name}</strong>
                          <span>{num(step.distanceM / 1000, 1)} km</span>
                        </li>
                      ))}
                  </ol>
                </details>
              )}
              <Rows
                rows={[
                  {
                    label: 'Quantidade recebida',
                    value: `${num(selected.delivered)} / ${num(selected.quantity)} ${products[selected.first.product].unit}`,
                  },
                  {
                    label: 'Frete de todas as viagens',
                    value: cr(selected.shipments.reduce((n, s) => n + s.freight, 0)),
                  },
                  {
                    label: 'Mercadoria ou custo contábil interno',
                    value: cr(selected.shipments.reduce((n, s) => n + s.cost, 0)),
                  },
                ]}
              />
              <p className="chart-caption">
                A posição segue o cronograma da simulação. Cada caminhão confirma sua parte; a
                conclusão do pedido exige todos os recebimentos.
              </p>
            </div>
          ) : (
            <p className="panel-content muted">
              {orders.filter((o) => !o.complete).length} pedidos ativos. Os veículos mostram os
              prazos gravados, incluindo preparação e transporte.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
