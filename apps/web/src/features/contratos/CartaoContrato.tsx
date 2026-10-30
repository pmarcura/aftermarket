import { BarrasPixel } from '../../components/BarrasPixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { IconePixel } from '../../components/IconePixel';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade as unidadeDe } from '../economy/Carga';
import { useGame, cr, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  type InfrastructureContract,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import { Podio } from './Podio';
import '../../design/item.css';
import '../../design/contratos.css';

const ESTADO = {
  open: { tom: 'ouro', texto: 'Em disputa' },
  delivering: { tom: 'ceu', texto: 'Em entrega' },
  completed: { tom: 'lavoura', texto: 'Concluído' },
  expired: { tom: 'apagado', texto: 'Sem vencedor' },
} as const;

/** Situação do jogador diante de um contrato: pode entrar, falta estoque ou já está na disputa. */
export function minhaSituacao(
  c: InfrastructureContract,
  actor: string,
  meus: ReturnType<typeof useGame>['world']['establishments'],
) {
  const propostas = [...(c.bids ?? [])].sort((a, b) => b.score - a.score);
  const minha = propostas.findIndex((b) => b.supplierId === actor);
  const comEstoque = meus.filter((e) => e.companyId === actor && (e.inventory[c.product] ?? 0) > 0);
  const atende = comEstoque.some(
    (e) =>
      (e.inventory[c.product] ?? 0) >= c.quantity && inventoryQuality(e, c.product) >= c.minQuality,
  );
  const maior = Math.max(0, ...comEstoque.map((e) => e.inventory[c.product] ?? 0));
  return { propostas, minha, comEstoque, atende, maior };
}

/**
 * Um edital como cartão: a prefeitura e o que ela compra, quanto paga, o pódio das propostas e a
 * sua chance em uma frase. A jogada principal é uma só: participar da disputa.
 */
export function CartaoContrato({
  c,
  onParticipar,
}: {
  c: InfrastructureContract;
  onParticipar: (c: InfrastructureContract) => void;
}) {
  const { world, actor, navigate, focusMap } = useGame();
  const agora = useClock();
  const destino = world.establishments.find((e) => e.id === c.destinationId)!;
  const p = world.properties.find((x) => x.id === destino?.propertyId);
  const aberto = c.status === 'open' && (!c.biddingEndsAt || agora < c.biddingEndsAt);
  const teto = c.unitPrice;
  const info = products[c.product];
  const s = minhaSituacao(c, actor, world.establishments);
  const venci = c.supplierId === actor;
  const estado = venci ? { tom: 'lavoura', texto: 'Você venceu' } : ESTADO[c.status];
  const restam = c.biddingEndsAt ? Math.max(0, Math.ceil((c.biddingEndsAt - agora) / 1000)) : 0;
  const nomeDe = (id: string) => world.companies.find((x) => x.id === id)?.name ?? 'Empresa';
  const chance =
    s.minha >= 0
      ? `Você está em ${s.minha + 1}º de ${s.propostas.length} ${s.propostas.length === 1 ? 'proposta' : 'propostas'}, com nota ${num(s.propostas[s.minha].score, 1)}.`
      : !aberto
        ? c.supplierId
          ? `Levou: ${nomeDe(c.supplierId)}.`
          : 'Ninguém levou este contrato.'
        : s.atende
          ? 'Você tem estoque para atender. Faça uma proposta!'
          : s.comEstoque.length
            ? s.maior >= c.quantity
              ? 'O estoque não atinge a qualidade mínima pedida.'
              : `Você tem ${num(s.maior)} de ${num(c.quantity)} ${unidadeDe(c.product, c.quantity)}: falta estoque.`
            : `Você não tem ${info.name} em estoque.`;
  return (
    <article
      className={`item ctr-item ctr-${c.status}`}
      style={{ ['--h' as string]: matizDoProduto(c.product) }}
    >
      <header className="item-hero">
        <div className="item-arte">
          <BotaoProduto product={c.product}>
            <ProdutoArte product={c.product} escala={3} />
          </BotaoProduto>
        </div>
        <div className="item-ident">
          <h3>Prefeitura de {c.municipality ?? p?.city ?? c.state ?? 'destino indisponível'}</h3>
          <span className={`item-estado tom-${estado.tom}`}>{estado.texto}</span>
          <p className="ped-frase">
            Compra <b>{num(c.quantity)}</b> {unidadeDe(c.product, c.quantity)} de{' '}
            <BotaoProduto product={c.product}>{info.name}</BotaoProduto>
          </p>
          <dl className="item-fatos">
            <div>
              <IconePixel nome="moeda" tamanho={22} />
              <dt>Paga até</dt>
              <dd>{cr(teto * c.quantity, 0)}</dd>
            </div>
            <div>
              <IconePixel nome="estrela" tamanho={22} />
              <dt>Qualidade mínima</dt>
              <dd>{c.minQuality}</dd>
            </div>
            {aberto && c.biddingEndsAt && (
              <div>
                <IconePixel nome="prazo" tamanho={22} />
                <dt>Encerra em</dt>
                <dd>
                  {Math.floor(restam / 60)}:{String(restam % 60).padStart(2, '0')}
                </dd>
              </div>
            )}
          </dl>
        </div>
        {aberto && (
          <button
            className="item-repor primary"
            disabled={!s.atende}
            onClick={() => onParticipar(c)}
          >
            {s.minha >= 0
              ? 'Revisar proposta'
              : c.biddingEndsAt
                ? 'Participar da disputa'
                : 'Atender contrato'}
          </button>
        )}
      </header>
      <div className="item-corpo ctr-corpo">
        <div className="item-pista">
          <p className={`item-veredito ${s.minha >= 0 || s.atende ? '' : 'ruim'}`}>{chance}</p>
          <Podio propostas={s.propostas} nomeDe={nomeDe} eu={actor} />
          {c.status !== 'open' && c.status !== 'expired' && (
            <div className="ctr-entrega">
              <div
                className="ped-progresso"
                role="progressbar"
                aria-label="Quanto do contrato já foi entregue"
                aria-valuenow={Math.round((c.deliveredQuantity / c.quantity) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${(c.deliveredQuantity / c.quantity) * 100}%` }} />
              </div>
              <small>
                {num(c.deliveredQuantity)} de {num(c.quantity)} {unidadeDe(c.product, c.quantity)}{' '}
                entregues{c.paid ? ` · ${cr(c.paid)} pagos` : ''}
              </small>
            </div>
          )}
          {s.propostas.length > 3 && (
            <details className="ctr-todas">
              <summary>Ver as {s.propostas.length} propostas</summary>
              <BarrasPixel
                titulo="Nota de cada proposta do contrato, de 0 a 100"
                maximo={100}
                formato={(v) => num(v, 1)}
                itens={s.propostas.map((b) => ({
                  rotulo: b.supplierId === actor ? 'Você' : nomeDe(b.supplierId),
                  valor: b.score,
                  tom: b.status === 'won' ? 'lavoura' : b.status === 'valid' ? 'ceu' : 'apagado',
                  nota:
                    b.status === 'won'
                      ? 'vencedora'
                      : b.status === 'invalid'
                        ? 'inviável'
                        : undefined,
                }))}
              />
            </details>
          )}
        </div>
        <div className="item-decisao ctr-jogada">
          <div className="ctr-jogada-titulo">
            <IconePixel nome="prefeitura" tamanho={32} />
            <span>
              {c.title}
              <small>#{c.id.slice(0, 6)}</small>
            </span>
          </div>
          <ul className="ctr-selos">
            <li>
              <IconePixel nome="carta" tamanho={22} />
              {c.bids?.length ?? 0} {(c.bids?.length ?? 0) === 1 ? 'proposta' : 'propostas'}
            </li>
            <li>
              <IconePixel nome="moeda" tamanho={22} />
              até {cr(teto)} por {info.unit}
            </li>
          </ul>
          <div className="item-botoes">
            {aberto && s.minha < 0 && !s.atende && (
              <button className="secondary" onClick={() => navigate('market')}>
                Comprar {info.name}
              </button>
            )}
            {venci && c.status !== 'completed' && (
              <button className="primary" onClick={() => navigate('logistics')}>
                Acompanhar os caminhões
              </button>
            )}
            <button
              className="secondary"
              disabled={!p}
              onClick={() => p && focusMap(p.coordinates, p.id)}
            >
              Ver a prefeitura no mapa
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
