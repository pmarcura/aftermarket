import { Pause, Play, Hammer } from 'lucide-react';
import { useGame, cr, num } from '../../../lib/game';
import { IconePixel } from '../../../components/IconePixel';
import { PixelArt, Fumaca } from '../../../components/PixelArt';
import { spriteDoNegocio, type Sprite } from '../../../design/arte';
import { categoryInfo, type Establishment } from '../../../../../../packages/simulation/src/model';
import { matizDaCategoria, type EstadoUnidade } from './pecas';

// Onde sai a fumaça, em % da ilustração. Só as chaminés.
const chamines: Partial<Record<Sprite, [number, number][]>> = {
  siderurgica: [
    [32, 8],
    [47, 2],
  ],
};

/** Troca rápida entre as unidades de produção: uma figurinha por unidade. */
export function Unidades({ atual }: { atual: string }) {
  const { world, actor, openBusiness } = useGame();
  const lista = world.establishments.filter(
    (x) => x.companyId === actor && x.category !== 'retail' && x.category !== 'logistics',
  );
  if (lista.length < 2) return null;
  return (
    <nav className="prod-unidades" aria-label="Minhas unidades de produção">
      {lista.map((x) => (
        <button
          key={x.id}
          aria-current={x.id === atual ? 'true' : undefined}
          className={x.id === atual ? 'on' : ''}
          onClick={() => openBusiness(x.id)}
        >
          <PixelArt name={spriteDoNegocio(x, world)} scale={1} />
          <span>{x.name}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * A cara da unidade: a cena, o nome grande, o estado em uma palavra, o que custa e rende por dia e
 * uma ação principal só (produzir, ou retomar quando está pausada).
 */
export function Cabeca({
  e,
  estado,
  custoDia,
  resultado,
  podeProduzir,
  semLinha,
  temReceita,
  onProduzir,
  onCustos,
}: {
  e: Establishment;
  estado: EstadoUnidade;
  custoDia: number;
  resultado: number;
  podeProduzir: boolean;
  semLinha: boolean;
  temReceita: boolean;
  onProduzir: () => void;
  onCustos: () => void;
}) {
  const { world, run, pending, navigate } = useGame();
  const p = world.properties.find((x) => x.id === e.propertyId)!;
  const arte = spriteDoNegocio(e, world);
  const parada = !e.enabled || e.mothballed;
  const alternar = () =>
    void run(
      { type: 'toggleOperation', establishmentId: e.id },
      e.enabled
        ? 'Novos ciclos pausados. Os ciclos em andamento serão concluídos.'
        : 'Operação retomada.',
    );
  return (
    <header
      className="unid-hero"
      style={{ ['--h' as string]: matizDaCategoria[e.category] ?? 120 }}
    >
      <div className="unid-cena">
        <div className="unid-sprite">
          <PixelArt name={arte} scale={2} />
          {chamines[arte] && !parada && <Fumaca pontos={chamines[arte]!} />}
        </div>
      </div>
      <div className="unid-ident">
        <span className="unid-tipo">{categoryInfo[e.category].label}</span>
        <h1>{e.name}</h1>
        <p className="unid-onde">
          <IconePixel nome="mapa" tamanho={20} /> {p.city}, {p.state} · {num(e.employees)}{' '}
          {e.employees === 1 ? 'pessoa' : 'pessoas'} trabalhando
        </p>
        <div className="unid-estado">
          <span className={`item-estado tom-${estado.tom}`}>{estado.texto}</span>
          {estado.detalhe && <span className="unid-detalhe">{estado.detalhe}</span>}
        </div>
      </div>
      <div className="unid-lado">
        <dl className="unid-numeros">
          <div>
            <dt>Custa por dia</dt>
            <dd className="dinheiro">{cr(custoDia, 0)}</dd>
          </div>
          <div>
            <dt>Resultado até agora</dt>
            <dd className={resultado >= 0 ? 'bom' : 'ruim'}>
              {resultado >= 0 ? '+' : '−'}
              {cr(Math.abs(resultado), 0)}
            </dd>
          </div>
        </dl>
        <div className="unid-acoes">
          {parada ? (
            <button
              className="primary unid-principal"
              disabled={pending}
              onClick={e.mothballed ? () => navigate('company') : alternar}
            >
              <Play size={18} /> {e.mothballed ? 'Reativar estrutura' : 'Retomar operação'}
            </button>
          ) : (
            temReceita && (
              <button
                className="primary unid-principal"
                disabled={!podeProduzir}
                onClick={onProduzir}
                title={
                  semLinha ? 'Sem capacidade para uma linha. Veja o motivo em Como esta unidade produz.' : undefined
                }
              >
                <Hammer size={18} /> Produzir agora
              </button>
            )
          )}
          <div className="unid-menos">
            {!parada && (
              <button className="text-button" disabled={pending} onClick={alternar}>
                <Pause size={14} /> Pausar novos ciclos
              </button>
            )}
            <button className="text-button" onClick={onCustos}>
              Ver custos e tarifas
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
