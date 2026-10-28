import { MapPin, Users } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge } from '../../components/ui';
import { PixelArt, Fumaca } from '../../components/PixelArt';
import { spriteDoNegocio, type Sprite } from '../../design/arte';
import {
  categoryInfo,
  type Establishment,
} from '../../../../../packages/simulation/src/model';
import { loadOf } from '../../../../../packages/simulation/src/engine';

// Onde sai a fumaça, em % da ilustração. Só as chamines.
const chamines: Partial<Record<Sprite, [number, number][]>> = {
  siderurgica: [
    [32, 8],
    [47, 2],
  ],
};

export function estadoDe(e: Establishment): { label: string; tone: 'green' | 'gold' } {
  if (e.installed === false) return { label: 'Instalação pendente', tone: 'gold' };
  if (e.mothballed) return { label: 'Estrutura suspensa', tone: 'gold' };
  return e.enabled ? { label: 'Ativo', tone: 'green' } : { label: 'Pausado', tone: 'gold' };
}

/** Ocupação do armazém: o que estiver mais cheio, massa ou volume. */
function ocupacao(e: Establishment) {
  const { mass, volume } = loadOf(e.inventory);
  const f = Math.max(e.capacityT ? mass / e.capacityT : 0, e.capacityM3 ? volume / e.capacityM3 : 0);
  return Math.min(1, Math.max(0, f));
}

function Anel({ fracao }: { fracao: number }) {
  const r = 15,
    c = 2 * Math.PI * r,
    cor = fracao > 0.9 ? 'var(--red)' : fracao > 0.7 ? 'var(--gold)' : 'var(--green)';
  return (
    <span
      className="neg-anel"
      role="img"
      aria-label={`Armazém ocupado em ${Math.round(fracao * 100)}%`}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} className="neg-anel-trilho" />
        <circle
          cx="20"
          cy="20"
          r={r}
          className="neg-anel-barra"
          style={{ stroke: cor, strokeDasharray: c, strokeDashoffset: c * (1 - fracao) }}
        />
      </svg>
      <b>{Math.round(fracao * 100)}%</b>
    </span>
  );
}

export function BusinessCard({ e, indice }: { e: Establishment; indice: number }) {
  const { world, openBusiness } = useGame();
  const p = world.properties.find((p) => p.id === e.propertyId)!;
  const arte = spriteDoNegocio(e, world);
  const estado = estadoDe(e);
  const saldo = e.revenue - e.expenses;
  const maior = Math.max(e.revenue, e.expenses, 1);
  const itens = Object.values(e.inventory).filter((q) => (q ?? 0) > 0).length;
  const parado = !e.enabled || e.installed === false || e.mothballed;
  return (
    <article
      className={`neg-card ${parado ? 'parado' : ''}`}
      style={{ '--cat': categoryInfo[e.category].color, animationDelay: `${indice * 45}ms` } as React.CSSProperties}
      onClick={() => openBusiness(e.id)}
    >
      <div className="neg-arte">
        <div className="neg-sprite">
          <PixelArt name={arte} />
          {chamines[arte] && !parado && <Fumaca pontos={chamines[arte]!} />}
        </div>
      </div>
      <div className="neg-topo">
        <div>
          <h3>{e.name}</h3>
          <span className="neg-local">
            <MapPin size={12} aria-hidden="true" /> {p.city} — {p.state}
          </span>
        </div>
        <Anel fracao={ocupacao(e)} />
      </div>
      <div className="neg-estado">
        <Badge tone={estado.tone}>{estado.label}</Badge>
        <span className="neg-cat">{categoryInfo[e.category].label}</span>
      </div>
      <dl className="neg-numeros">
        <div>
          <dt>Resultado</dt>
          <dd className={saldo >= 0 ? 'positive' : 'negative'}>
            {saldo >= 0 ? '+' : '−'}
            {cr(Math.abs(saldo))}
          </dd>
        </div>
        <div>
          <dt>
            <Users size={12} aria-hidden="true" /> Equipe
          </dt>
          <dd>{num(e.employees)}</dd>
        </div>
        <div>
          <dt>No estoque</dt>
          <dd>{itens ? `${itens} ${itens === 1 ? 'produto' : 'produtos'}` : 'Vazio'}</dd>
        </div>
      </dl>
      <div
        className="neg-fluxo"
        role="img"
        aria-label={`Receita ${cr(e.revenue)} e custos ${cr(e.expenses)}`}
      >
        <span className="neg-fluxo-l">Receita</span>
        <span className="neg-fluxo-b">
          <i className="rec" style={{ width: `${(e.revenue / maior) * 100}%` }} />
        </span>
        <span className="neg-fluxo-l">Custos</span>
        <span className="neg-fluxo-b">
          <i className="cus" style={{ width: `${(e.expenses / maior) * 100}%` }} />
        </span>
      </div>
      <button
        className="secondary full"
        onClick={(ev) => {
          ev.stopPropagation();
          openBusiness(e.id);
        }}
      >
        Gerenciar
      </button>
    </article>
  );
}

/** Resultado de cada unidade, partindo do zero: barras verdes à direita, vermelhas à esquerda. */
export function ResultadoPorUnidade({ itens }: { itens: Establishment[] }) {
  const linhas = itens
    .map((e) => ({ e, v: e.revenue - e.expenses }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 5);
  const teto = Math.max(1, ...linhas.map((l) => Math.abs(l.v)));
  if (!linhas.length) return null;
  return (
    <figure className="neg-div" aria-label="Resultado por unidade">
      <figcaption>Resultado por unidade</figcaption>
      {linhas.map(({ e, v }) => (
        <div className="neg-div-linha" key={e.id}>
          <span className="neg-div-nome" title={e.name}>
            {e.name}
          </span>
          <span className="neg-div-trilho">
            <i
              className={v >= 0 ? 'pos' : 'neg'}
              style={{
                width: `${(Math.abs(v) / teto) * 50}%`,
                [v >= 0 ? 'left' : 'right']: '50%',
              }}
            />
          </span>
          <span className={`neg-div-valor ${v >= 0 ? 'positive' : 'negative'}`}>
            {v >= 0 ? '+' : '−'}
            {cr(Math.abs(v), 0)}
          </span>
        </div>
      ))}
      {itens.length > linhas.length && (
        <small className="muted">e mais {itens.length - linhas.length} unidades</small>
      )}
    </figure>
  );
}
