import { IconePixel } from '../../components/IconePixel';
import { PixelArt, Fumaca } from '../../components/PixelArt';
import { cr, num, useGame } from '../../lib/game';
import { spriteDoNegocio, type Sprite } from '../../design/arte';
import type { Pendencia } from '../inicio/pendencias';
import type { Category, Establishment } from '../../../../../packages/simulation/src/model';

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

export function estadoDe(e: Establishment): { label: string; tone: 'green' | 'gold' } {
  if (e.installed === false) return { label: 'Instalação pendente', tone: 'gold' };
  if (e.mothballed) return { label: 'Estrutura suspensa', tone: 'gold' };
  return e.enabled ? { label: 'Ativo', tone: 'green' } : { label: 'Pausado', tone: 'gold' };
}

/** Quanto o cartão pede atenção: parado e com alerta vem primeiro na lista. */
export function urgenciaDe(e: Establishment, alerta?: Pendencia) {
  if (alerta?.tom === 'brasa') return 0;
  if (alerta) return 1;
  if (!e.enabled || e.installed === false || e.mothballed) return 2;
  return 3;
}

/**
 * Um negócio como cartão de jogo: a cena grande com o fundo da cor do tipo, o nome, uma palavra de
 * estado e um botão só. Se algo precisa de você, o botão é o que resolve; senão, abre o negócio.
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
  const p = world.properties.find((p) => p.id === e.propertyId)!;
  const arte = spriteDoNegocio(e, world);
  const estado = estadoDe(e);
  const parado = !e.enabled || e.installed === false || e.mothballed;
  const palavra = alerta?.tom === 'brasa' ? 'Precisa de você' : estado.label;
  const tom = alerta?.tom === 'brasa' ? 'brasa' : estado.tone === 'green' ? 'lavoura' : 'ouro';
  return (
    <article
      className={`item neg-item ${alerta?.tom === 'brasa' ? 'alerta' : ''} ${parado ? 'parado' : ''}`}
      style={{ ['--h' as string]: MATIZ[e.category] }}
    >
      <header className="item-hero">
        <div className="item-arte neg-cena">
          <PixelArt name={arte} scale={2} />
          {chamines[arte] && !parado && <Fumaca pontos={chamines[arte]!} />}
        </div>
        <div className="item-ident">
          <h3>{e.name}</h3>
          <span className={`item-estado tom-${tom}`}>{palavra}</span>
          <dl className="item-fatos">
            <div>
              <IconePixel nome="mapa" tamanho={22} />
              <dt>Onde</dt>
              <dd>
                {p.city}, {p.state}
              </dd>
            </div>
            <div>
              <IconePixel nome="moeda" tamanho={22} />
              <dt>Vendeu hoje</dt>
              <dd>{cr(vendasHoje, 0)}</dd>
            </div>
            <div>
              <dt>Equipe</dt>
              <dd>{num(e.employees)}</dd>
            </div>
          </dl>
        </div>
      </header>
      <div className="item-corpo neg-corpo">
        {alerta ? (
          <p className={`neg-aviso tom-${alerta.tom}`}>
            <IconePixel nome="alerta" tamanho={28} />
            <span>
              <b>{alerta.titulo.replace(`${e.name} `, '')}</b>
              <small>{alerta.detalhe}</small>
            </span>
          </p>
        ) : (
          <p className="neg-aviso ok">
            <span>
              <b>{parado ? 'Parado no momento' : 'Tudo certo por aqui'}</b>
              <small>
                {parado
                  ? 'Abra o negócio para colocar em operação.'
                  : 'Nada esperando por você neste negócio.'}
              </small>
            </span>
          </p>
        )}
        <div className="neg-botoes">
          {alerta && (
            <button type="button" className="primary" onClick={alerta.acao.executar}>
              {alerta.acao.rotulo}
            </button>
          )}
          <button
            type="button"
            className={alerta ? 'secondary' : 'primary'}
            onClick={() => openBusiness(e.id)}
            aria-label={`Abrir ${e.name}`}
          >
            Abrir
          </button>
        </div>
      </div>
    </article>
  );
}
