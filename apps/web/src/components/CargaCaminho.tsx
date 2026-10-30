import { num } from '../lib/game';
import { products, type Shipment, type World } from '../../../../packages/simulation/src/model';
import { agoraDoMundo, horasDeJogo } from '../features/inicio/tempo';
import { ProdutoArte } from '../features/economy/Vitrine';
import { BotaoProduto } from './BotaoProduto';
import { IconePixel } from './IconePixel';
import { matizDoProduto } from '../design/arte';
import '../design/carga-caminho.css';

/**
 * Uma carga na estrada: a imagem do produto, de onde sai e para onde vai, quando chega e o
 * caminhão andando sobre a pista entre a origem e o destino.
 */
export function CargaCaminho({ s, world }: { s: Shipment; world: World }) {
  const agora = agoraDoMundo(world);
  const total = Math.max(1, s.arrivesAt - s.departedAt);
  const feito = Math.min(1, Math.max(0, (agora - s.departedAt) / total));
  const falta = Math.max(0, horasDeJogo(s.arrivesAt - agora));
  const destino = world.establishments.find((e) => e.id === s.destinationId);
  const origem = world.establishments.find((e) => e.id === s.originId);
  const cidade = (id?: string) => {
    const p = world.properties.find((x) => x.id === id);
    return p ? p.city : '';
  };
  return (
    <li className="cam" style={{ ['--h' as string]: matizDoProduto(s.product) }}>
      <div className="cam-arte">
        <BotaoProduto product={s.product}>
          <ProdutoArte product={s.product} escala={2} />
        </BotaoProduto>
      </div>
      <div className="cam-corpo">
        <div className="cam-topo">
          <strong>
            {num(s.quantity)} {products[s.product].unit} de {products[s.product].name}
          </strong>
          <span className={`cam-prazo ${falta < 1 ? 'chegando' : ''}`}>
            <IconePixel nome="prazo" tamanho={20} />
            {falta < 1 ? 'Chegando' : `Chega em ~${num(falta)} h`}
          </span>
        </div>
        <div className="cam-rota">
          <span>{origem?.name ?? 'Fornecedor'}</span>
          <i aria-hidden="true" />
          <span>{destino?.name}</span>
        </div>
        <div
          className="cam-estrada"
          role="progressbar"
          aria-label={`Viagem até ${destino?.name ?? 'o destino'}`}
          aria-valuenow={Math.round(feito * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="cam-ponto origem" title={cidade(origem?.propertyId)} />
          <span className="cam-ponto destino" title={cidade(destino?.propertyId)} />
          <span className="cam-feito" style={{ width: `${feito * 100}%` }} />
          <span className="cam-caminhao" style={{ left: `${feito * 100}%` }}>
            <IconePixel nome="caminhao" tamanho={34} />
          </span>
        </div>
      </div>
    </li>
  );
}
