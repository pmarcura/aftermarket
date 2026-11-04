import { ArrowRight } from 'lucide-react';
import { IconePixel } from '../../components/IconePixel';
import { PixelArt, Fumaca } from '../../components/PixelArt';
import { cr, num, useGame } from '../../lib/game';
import { spriteDoNegocio, type Sprite } from '../../design/arte';
import { ProdutoMini } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { agoraDoMundo } from '../inicio/tempo';
import { estadoDaUnidade } from './producao/pecas';
import type { Pendencia } from '../inicio/pendencias';
import {
  categoryInfo,
  products,
  type Category,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';

// Onde sai a fumaça, em % da ilustração. Só as chaminés.
const chamines: Partial<Record<Sprite, [number, number][]>> = {
  siderurgica: [
    [32, 8],
    [47, 2],
  ],
};

/** Matiz de fundo de cada tipo de negócio: o jogador reconhece o tipo pela cor do cartão. */
const MATIZ: Record<Category, number> = {
  retail: 14,
  farm: 112,
  industry: 212,
  mine: 32,
  warehouse: 272,
  logistics: 188,
};

type Tom = 'brasa' | 'ouro' | 'lavoura' | 'ceu' | 'apagado';

const primeiraMaiuscula = (t: string) => t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);

/** Quanto o cartão pede atenção: parado e com alerta vem primeiro na lista. */
export function urgenciaDe(e: Establishment, alerta?: Pendencia) {
  if (alerta?.tom === 'brasa') return 0;
  if (alerta) return 1;
  if (!e.enabled || e.installed === false || e.mothballed) return 2;
  return 3;
}

/** Uma palavra de estado: o que o negócio está fazendo agora. */
function estadoDoNegocio(world: World, e: Establishment): { tom: Tom; texto: string } {
  if (e.installed === false) return { tom: 'ouro', texto: 'Falta instalar' };
  if (e.mothballed) return { tom: 'ouro', texto: 'Suspenso' };
  if (!e.enabled) return { tom: 'ouro', texto: 'Pausado' };
  if (e.category === 'retail') {
    const vazios = Object.values(e.inventory).filter((q) => (q ?? 0) <= 0).length;
    return vazios
      ? { tom: 'ouro', texto: vazios === 1 ? '1 produto esgotado' : `${vazios} produtos esgotados` }
      : { tom: 'lavoura', texto: 'Vendendo' };
  }
  const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
  const lotes = world.jobs.filter((j) => j.establishmentId === e.id && !j.completed);
  const estado = estadoDaUnidade(
    world,
    e,
    receita,
    lotes,
    agoraDoMundo(world),
    (id) => products[id as ProductId].name,
  );
  return { tom: estado.tom, texto: estado.texto };
}

/** O que entra e o que sai: insumos → produtos na produção; os produtos da prateleira na loja. */
function OQueFaz({ world, e }: { world: World; e: Establishment }) {
  if (e.category === 'retail') {
    const ids = Object.keys(e.inventory) as ProductId[];
    if (!ids.length) return <p className="ng-faz vazio">Prateleira vazia</p>;
    return (
      <p className="ng-faz" aria-label={`Vende ${ids.map((id) => products[id].name).join(', ')}`}>
        <span className="ng-faz-rotulo">Vende</span>
        {ids.slice(0, 6).map((id) => (
          <ProdutoMini key={id} product={id} tamanho={26} />
        ))}
        {ids.length > 6 && <small>+{ids.length - 6}</small>}
      </p>
    );
  }
  const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
  if (!receita) return <p className="ng-faz vazio">{categoryInfo[e.category].label}</p>;
  const entra = Object.keys(receita.input) as ProductId[];
  const sai = Object.keys(receita.output) as ProductId[];
  return (
    <p
      className="ng-faz"
      aria-label={`${entra.length ? `Usa ${entra.map((id) => products[id].name).join(', ')} e faz` : 'Faz'} ${sai.map((id) => products[id].name).join(', ')}`}
    >
      {entra.map((id) => (
        <ProdutoMini key={id} product={id} tamanho={26} />
      ))}
      {entra.length > 0 && <ArrowRight size={16} aria-hidden="true" />}
      {sai.map((id) => (
        <ProdutoMini key={id} product={id} tamanho={26} />
      ))}
      <small>
        {entra.length ? `${products[entra[0]].name} → ` : ''}
        {sai.map((id) => products[id].name).join(' + ')}
      </small>
    </p>
  );
}

/**
 * Um negócio como cartão: a cena, o nome, o que está fazendo em uma palavra, o que entra e sai,
 * quanto deu até agora e o que está no armazém. Um botão principal: o que resolve o alerta, ou abrir.
 */
export function BusinessCard({
  e,
  vendasHoje,
  alerta,
}: {
  e: Establishment;
  vendasHoje: number;
  alerta?: Pendencia;
}) {
  const { world, openBusiness } = useGame();
  const p = world.properties.find((x) => x.id === e.propertyId)!;
  const arte = spriteDoNegocio(e, world);
  const parado = !e.enabled || e.installed === false || e.mothballed;
  const estado = estadoDoNegocio(world, e);
  const tom: Tom = alerta?.tom === 'brasa' ? 'brasa' : estado.tom;
  const resultado = e.revenue - e.expenses;
  // No armazém da produção: o que mais pesa, e se está à venda.
  const usa = new Set(
    Object.keys(world.season.config.recipes.find((r) => r.id === e.specialization)?.input ?? {}),
  );
  const armazem =
    e.category === 'retail'
      ? []
      : (Object.entries(e.inventory) as [ProductId, number][])
          .filter(([id, q]) => (q ?? 0) >= 1 && !usa.has(id))
          .map(([id, q]) => ({
            id,
            q: Math.floor(q),
            aVenda: world.offers.some((o) => o.establishmentId === e.id && o.product === id),
            valor: Math.floor(q) * (world.season.config.basePrices[id] ?? 0),
          }))
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 2);
  const abreONegocio = alerta ? ['Abrir', 'Instalar'].includes(alerta.acao.rotulo) : false;
  return (
    <article
      className={`ng-card tom-${tom} ${parado ? 'parado' : ''}`}
      style={{ ['--h' as string]: MATIZ[e.category] }}
    >
      <div className="ng-topo">
        <span className="ng-cena" aria-hidden="true">
          <PixelArt name={arte} scale={2} />
          {chamines[arte] && !parado && <Fumaca pontos={chamines[arte]!} />}
        </span>
        <span className="ng-ident">
          <span className="ng-estado">{estado.texto}</span>
          <h3 className="ng-nome">{e.name}</h3>
          <span className="ng-onde">
            {categoryInfo[e.category].label} · {p.city}, {p.state} · {num(e.employees)}{' '}
            {e.employees === 1 ? 'pessoa' : 'pessoas'}
          </span>
        </span>
      </div>

      <OQueFaz world={world} e={e} />

      <dl className="ng-numeros">
        <div className={`ng-resultado ${resultado >= 0 ? 'pos' : 'neg'}`}>
          <dt>Resultado até agora</dt>
          <dd>
            {resultado >= 0 ? '+' : '−'}
            {cr(Math.abs(resultado), 0)}
          </dd>
        </div>
        <div>
          <dt>Custa por dia</dt>
          <dd>{cr(e.dailyCost, 0)}</dd>
        </div>
        <div>
          <dt>Vendeu hoje</dt>
          <dd>{cr(vendasHoje, 0)}</dd>
        </div>
      </dl>

      {armazem.length > 0 && (
        <ul className="ng-armazem" aria-label="No armazém">
          {armazem.map((x) => (
            <li key={x.id} className={x.aVenda ? '' : 'parado'}>
              <ProdutoMini product={x.id} tamanho={24} />
              <span>
                <b>
                  {num(x.q)} {unidade(x.id, x.q)}
                </b>{' '}
                de {products[x.id].name}
              </span>
              <em>{x.aVenda ? 'à venda' : 'parado, sem oferta'}</em>
            </li>
          ))}
        </ul>
      )}

      {alerta && (
        <p className={`ng-alerta tom-${alerta.tom}`}>
          <IconePixel nome="alerta" tamanho={24} />
          <span>
            <b>{primeiraMaiuscula(alerta.titulo.replace(`${e.name} `, ''))}</b>
            <small>{alerta.detalhe}</small>
          </span>
        </p>
      )}

      <footer className="ng-pe">
        {alerta && (
          <button type="button" className="primary" onClick={alerta.acao.executar}>
            {alerta.acao.rotulo}
          </button>
        )}
        {(!alerta || !abreONegocio) && (
          <button
            type="button"
            className={alerta ? 'secondary' : 'primary'}
            onClick={() => openBusiness(e.id)}
            aria-label={`Abrir ${e.name}`}
          >
            Abrir
          </button>
        )}
      </footer>
    </article>
  );
}
