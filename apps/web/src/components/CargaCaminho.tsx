import { Truck } from 'lucide-react';
import { num } from '../lib/game';
import { products, type Shipment, type World } from '../../../../packages/simulation/src/model';
import { agoraDoMundo, horasDeJogo } from '../features/inicio/tempo';
import '../design/carga-caminho.css';

/** Uma carga na estrada: o caminhão anda sobre a faixa até chegar. */
export function CargaCaminho({ s, world }: { s: Shipment; world: World }) {
  const agora = agoraDoMundo(world);
  const total = Math.max(1, s.arrivesAt - s.departedAt);
  const feito = Math.min(1, Math.max(0, (agora - s.departedAt) / total));
  const falta = Math.max(0, horasDeJogo(s.arrivesAt - agora));
  const destino = world.establishments.find((e) => e.id === s.destinationId)?.name;
  return (
    <li className="cam">
      <div className="cam-texto">
        <strong>
          {num(s.quantity)} {products[s.product].unit} de {products[s.product].name}
        </strong>
        <small>
          para {destino} · {falta < 1 ? 'chegando' : `chega em ~${num(falta)} h`}
        </small>
      </div>
      <div
        className="cam-estrada"
        role="progressbar"
        aria-label={`Viagem até ${destino}`}
        aria-valuenow={Math.round(feito * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <Truck size={16} strokeWidth={2.2} style={{ left: `${feito * 100}%` }} />
      </div>
    </li>
  );
}
