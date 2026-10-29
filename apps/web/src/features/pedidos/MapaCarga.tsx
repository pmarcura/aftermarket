import { useState } from 'react';
import { Truck } from 'lucide-react';
import { WorldMap, defaultLayers } from '../../components/WorldMap';
import { useGame, cr, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { useRoute } from '../../lib/routing';
import { products } from '../../../../../packages/simulation/src/model';
import { shipmentStatus } from '../../../../../packages/simulation/src/shipment';
import { shipmentRoute } from '../../../../../packages/simulation/src/road-path';
import type { GrupoCarga } from './dados';

/** Mapa de uma carga: a estrada, cada caminhão e um botão para localizar cada um. */
export function MapaCarga({ g }: { g: GrupoCarga }) {
  const { world } = useGame();
  const agora = useClock();
  const [destaque, setDestaque] = useState('');
  const carregando = useRoute(g.origem.propertyId, g.destino.propertyId, true);
  const pronta = g.first.mapRouteSource === 'osrm' || g.first.routeSource === 'osrm';
  return (
    <div className="ped-mapa">
      <div className="ped-mapa-quadro">
        <WorldMap
          route={pronta || !world.requireRoadRoutes ? shipmentRoute(world, g.first) : undefined}
          shipments={g.shipments}
          highlightShipmentId={destaque}
          layers={{ ...defaultLayers, routes: true }}
          ownership="mine"
        />
      </div>
      <p className="ped-nota">
        {pronta
          ? 'Trajeto pelas estradas reais.'
          : carregando
            ? 'Traçando a estrada…'
            : 'Trajeto estimado.'}{' '}
        Caminhões na mesma posição se sobrepõem: toque em Localizar para destacar um.
      </p>
      <ul className="ped-caminhoes">
        {g.shipments.map((s) => {
          const status = shipmentStatus(s, agora);
          const truck = world.vehicles.find((v) => v.id === s.vehicleId);
          return (
            <li key={s.id}>
              <Truck size={18} aria-hidden="true" />
              <div>
                <strong>{truck?.name ?? 'Caminhão'}</strong>
                <small>
                  {num(s.quantity)} {products[s.product].unit} · {status.phase}
                </small>
              </div>
              <button
                className="secondary"
                aria-pressed={destaque === s.id}
                onClick={() => setDestaque(s.id)}
              >
                Localizar
              </button>
            </li>
          );
        })}
      </ul>
      <p className="ped-nota">
        Frete de todas as viagens: {cr(g.shipments.reduce((n, s) => n + s.freight, 0))}.
      </p>
    </div>
  );
}
