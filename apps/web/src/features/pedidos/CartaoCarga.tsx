import { Suspense, lazy, useState } from 'react';
import { CargaCaminho } from '../../components/CargaCaminho';
import { BotaoProduto } from '../../components/BotaoProduto';
import { IconePixel } from '../../components/IconePixel';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade as unidadeDe } from '../economy/Carga';
import { useGame, cr, num } from '../../lib/game';
import { matizDoProduto } from '../../design/arte';
import { products } from '../../../../../packages/simulation/src/model';
import { agoraDoMundo, horasDeJogo } from '../inicio/tempo';
import type { GrupoCarga } from './dados';
import '../../design/item.css';
import '../../design/pedidos.css';

const MapaCarga = lazy(() => import('./MapaCarga').then((m) => ({ default: m.MapaCarga })));

/**
 * Uma carga como cartão: o que está sendo levado, para onde, e os caminhões andando pela estrada.
 * Pedido, contrato público e transferência aparecem do mesmo jeito.
 */
export function CartaoCarga({ g }: { g: GrupoCarga }) {
  const { world } = useGame();
  const [mapa, setMapa] = useState(false);
  const agora = agoraDoMundo(world);
  const info = products[g.first.product];
  const naEstrada = g.shipments
    .filter((s) => !s.delivered)
    .sort((a, b) => a.arrivesAt - b.arrivesAt);
  const chegam = naEstrada.length
    ? horasDeJogo(Math.max(...naEstrada.map((s) => s.arrivesAt)) - agora)
    : 0;
  const comprador = world.companies.find((c) => c.id === g.first.buyerId)?.name ?? g.destino.name;
  const frase = g.contrato
    ? `Contrato público: Prefeitura de ${g.contrato.municipality ?? g.destino.name}`
    : g.papel === 'compra'
      ? `Você recebe de ${g.origem.name} em ${g.destino.name}`
      : g.papel === 'venda'
        ? `Você entrega de ${g.origem.name} a ${comprador}`
        : `Sua frota leva de ${g.origem.name} para ${g.destino.name}`;
  const chegou = g.shipments.filter((s) => s.delivered).length;
  const peso = g.quantity ? g.entregue / g.quantity : 0;
  return (
    <article
      className={`item ped-item ${g.completo ? 'ped-fim' : 'ped-caminho'}`}
      style={{ ['--h' as string]: matizDoProduto(g.first.product) }}
    >
      <header className="item-hero">
        <div className="item-arte">
          <BotaoProduto product={g.first.product}>
            <ProdutoArte product={g.first.product} escala={3} />
          </BotaoProduto>
        </div>
        <div className="item-ident">
          <h3>
            <BotaoProduto product={g.first.product}>{info.name}</BotaoProduto>
          </h3>
          <span className={`item-estado tom-${g.completo ? 'lavoura' : 'ceu'}`}>
            {g.completo
              ? 'Entregue'
              : `A caminho · ${chegou} de ${g.shipments.length} ${g.shipments.length === 1 ? 'caminhão chegou' : 'caminhões chegaram'}`}
          </span>
          <p className="ped-frase">{frase}</p>
          <dl className="item-fatos">
            <div>
              <IconePixel nome="caixa" tamanho={22} />
              <dt>Chegou</dt>
              <dd>
                {num(g.entregue)} de {num(g.quantity)} {unidadeDe(g.first.product, g.quantity)}
              </dd>
            </div>
            {!g.completo && (
              <div>
                <IconePixel nome="prazo" tamanho={22} />
                <dt>Última chega em</dt>
                <dd>{chegam < 1 ? 'instantes' : `~${num(chegam)} h`}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>
      <div className="item-corpo ped-corpo">
        <div
          className="ped-progresso"
          role="progressbar"
          aria-label="Quanto da carga já chegou"
          aria-valuenow={Math.round(peso * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${peso * 100}%` }} />
        </div>
        {!g.completo && (
          <ul className="cam-lista">
            {naEstrada.slice(0, 4).map((s) => (
              <CargaCaminho key={s.id} s={s} world={world} />
            ))}
          </ul>
        )}
        {naEstrada.length > 4 && (
          <p className="ped-nota">e mais {naEstrada.length - 4} caminhões a caminho.</p>
        )}
        <footer className="ped-rodape">
          <span className="ped-nota">
            Frete: {cr(g.shipments.reduce((n, s) => n + s.freight, 0))}
          </span>
          <button className="text-button" aria-expanded={mapa} onClick={() => setMapa(!mapa)}>
            {mapa ? 'Esconder o mapa' : 'Ver no mapa'}
          </button>
        </footer>
        {mapa && (
          <Suspense fallback={<p className="ped-nota">Abrindo o mapa…</p>}>
            <MapaCarga g={g} />
          </Suspense>
        )}
      </div>
    </article>
  );
}
