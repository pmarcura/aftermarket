/**
 * Controles do mapa num lugar só: a barra de modos (o que o mapa destaca), o "só os meus",
 * o painel do modo (fluxos, demanda e preços) e a legenda que muda com o modo.
 */
import {
  Building2,
  MapPin,
  Route,
  Users,
  CircleDollarSign,
  Layers3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  UserCheck,
  X,
} from 'lucide-react';
import {
  categoryInfo,
  products,
  seasonProducts,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { useGame } from '../../lib/game';
import {
  cargasDoFluxo,
  COR_DA_CADEIA,
  NOME_DA_CADEIA,
  resumoPorProduto,
  type OpcoesDeFluxo,
  type Sentido,
} from './fluxos';
import './modos.css';

export type Modo = 'negocios' | 'fluxos' | 'demanda' | 'precos' | 'terrenos' | 'zonas';

export const MODOS: { id: Modo; nome: string; icone: typeof Building2; dica: string }[] = [
  { id: 'negocios', nome: 'Negócios', icone: Building2, dica: 'Empresas, fazendas e minas' },
  { id: 'fluxos', nome: 'Fluxos', icone: Route, dica: 'Cargas na estrada agora' },
  { id: 'demanda', nome: 'Demanda', icone: Users, dica: 'Quanto cada cidade consome' },
  { id: 'precos', nome: 'Preços', icone: CircleDollarSign, dica: 'Preço de um produto por cidade' },
  { id: 'terrenos', nome: 'Terrenos à venda', icone: MapPin, dica: 'Onde dá para comprar' },
  { id: 'zonas', nome: 'Zonas', icone: Layers3, dica: 'Lotes e zonas da cidade' },
];

export function BarraDeModos({
  modo,
  aoMudar,
  soMeus,
  aoSoMeus,
}: {
  modo: Modo;
  aoMudar: (m: Modo) => void;
  soMeus: boolean;
  aoSoMeus: (v: boolean) => void;
}) {
  return (
    <div className="map-modos" role="group" aria-label="Filtrar mapa">
      {MODOS.map((m) => (
        <button
          key={m.id}
          type="button"
          className={modo === m.id ? 'on' : ''}
          aria-pressed={modo === m.id}
          title={m.dica}
          aria-label={m.nome}
          onClick={() => aoMudar(m.id)}
        >
          <m.icone size={15} aria-hidden="true" />
          <span>{m.nome}</span>
        </button>
      ))}
      <span className="map-modos-sep" aria-hidden="true" />
      <button
        type="button"
        className={`map-modos-meus${soMeus ? ' on' : ''}`}
        aria-pressed={soMeus}
        disabled={modo === 'terrenos'}
        title="Mostrar só o que é seu"
        aria-label="Meus negócios"
        onClick={() => aoSoMeus(!soMeus)}
      >
        <UserCheck size={15} aria-hidden="true" />
        <span>Meus negócios</span>
      </button>
    </div>
  );
}

/** Painel do modo Fluxos: o que está andando, por produto; clique filtra o mapa. */
export function PainelDeFluxos({
  opcoes,
  aoMudar,
}: {
  opcoes: OpcoesDeFluxo;
  aoMudar: (o: OpcoesDeFluxo) => void;
}) {
  const { world, actor } = useGame();
  // o resumo ignora o filtro de produto, para a lista continuar mostrando todos
  const cargas = cargasDoFluxo(world, actor, { ...opcoes, produto: null });
  const lista = resumoPorProduto(cargas);
  const maior = Math.max(1, ...lista.map((l) => l.cargas));
  const total = cargas.length;
  const peso = cargas.reduce((n, s) => n + s.quantity * products[s.product].massT, 0);
  const sentidos: [Sentido, string, typeof ArrowLeftRight][] = [
    ['todos', 'Todas', ArrowLeftRight],
    ['entrando', 'Chegando', ArrowDownToLine],
    ['saindo', 'Saindo', ArrowUpFromLine],
  ];
  return (
    <aside className="map-painel" aria-label="Fluxos de recursos">
      <header>
        <h2>Fluxos agora</h2>
        <p>
          {total} {total === 1 ? 'carga' : 'cargas'} na estrada ·{' '}
          {peso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t
        </p>
      </header>
      <div className="map-painel-sentido" role="group" aria-label="Sentido das cargas">
        {sentidos.map(([id, nome, Icone]) => (
          <button
            key={id}
            type="button"
            className={opcoes.sentido === id ? 'on' : ''}
            aria-pressed={opcoes.sentido === id}
            title={
              id === 'todos'
                ? 'Todas as cargas'
                : id === 'entrando'
                  ? 'Compras que chegam aos seus negócios'
                  : 'Vendas que saem dos seus negócios'
            }
            onClick={() => aoMudar({ ...opcoes, sentido: id })}
          >
            <Icone size={14} aria-hidden="true" />
            {nome}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="map-painel-vazio">
          {opcoes.sentido === 'todos'
            ? 'Nenhuma carga na estrada agora. Quando alguém comprar e despachar, o trajeto aparece aqui.'
            : opcoes.sentido === 'entrando'
              ? 'Nenhuma compra sua a caminho. Compre no Comércio para ver a carga chegando.'
              : 'Nenhuma venda sua na estrada agora.'}
        </p>
      ) : (
        <ul className="map-painel-lista">
          {lista.map((l) => {
            const ativo = opcoes.produto === l.produto;
            return (
              <li key={l.produto}>
                <button
                  type="button"
                  className={ativo ? 'on' : ''}
                  aria-pressed={ativo}
                  onClick={() => aoMudar({ ...opcoes, produto: ativo ? null : l.produto })}
                >
                  <span className="map-painel-nome">{products[l.produto].name}</span>
                  <span className="map-painel-num">
                    {l.cargas} · {l.toneladas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}{' '}
                    t
                  </span>
                  <span
                    className="map-painel-barra"
                    style={{
                      width: `${Math.round((l.cargas / maior) * 100)}%`,
                      background: COR_DA_CADEIA[l.cadeia],
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {opcoes.produto && (
        <button
          type="button"
          className="map-painel-limpar"
          onClick={() => aoMudar({ ...opcoes, produto: null })}
        >
          <X size={14} aria-hidden="true" /> Ver todos os produtos
        </button>
      )}
      <p className="map-painel-nota">
        Passe o mouse num trajeto para ver o que leva. Cargas entregues saem do mapa.
      </p>
    </aside>
  );
}

/** Painel dos modos Demanda e Preços: escolha do produto mostrado nas cidades. */
export function PainelDeProduto({
  modo,
  produto,
  aoMudar,
}: {
  modo: 'demanda' | 'precos';
  produto: ProductId | null;
  aoMudar: (p: ProductId | null) => void;
}) {
  const { world } = useGame();
  const lista = seasonProducts(world).filter(
    (id) => products[id].category !== 'Veículos' && products[id].category !== 'Sementes',
  );
  return (
    <aside
      className="map-painel"
      aria-label={modo === 'precos' ? 'Preços por cidade' : 'Demanda por cidade'}
    >
      <header>
        <h2>{modo === 'precos' ? 'Preço por cidade' : 'Demanda por cidade'}</h2>
        <p>
          {modo === 'precos'
            ? 'Compare onde comprar barato e onde vender caro.'
            : 'Quanto cada cidade consome por dia.'}
        </p>
      </header>
      <ul className="map-painel-lista">
        {modo === 'demanda' && (
          <li>
            <button
              type="button"
              className={produto === null ? 'on' : ''}
              aria-pressed={produto === null}
              onClick={() => aoMudar(null)}
            >
              <span className="map-painel-nome">Todos (em R$)</span>
            </button>
          </li>
        )}
        {lista.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={produto === id ? 'on' : ''}
              aria-pressed={produto === id}
              onClick={() => aoMudar(id)}
            >
              <span className="map-painel-nome">{products[id].name}</span>
              <span className="map-painel-num">{products[id].category}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Legenda do modo: só o que o modo mostra. */
export function LegendaDoModo({ modo }: { modo: Modo }) {
  return (
    <div className="map-legend-bar" aria-label="Legenda do mapa">
      {modo === 'fluxos' ? (
        <>
          {(['alimentos', 'metal'] as const).map((c) => (
            <span key={c}>
              <i style={{ background: COR_DA_CADEIA[c] }} />
              {NOME_DA_CADEIA[c]}
            </span>
          ))}
          <span>
            <i className="linha-grossa" />
            Mais grosso = mais toneladas
          </span>
          <span>
            <i className="ponto-carga" />
            Caminhão andando
          </span>
        </>
      ) : modo === 'demanda' || modo === 'precos' ? (
        <span>
          {modo === 'precos'
            ? 'Cada placa mostra o preço do produto na cidade · sem oferta quando ninguém vende'
            : 'Cada placa mostra o consumo da cidade · maior = mais procura'}
        </span>
      ) : modo === 'terrenos' ? (
        <span>
          <i className="livre" />
          Terreno livre: toque para ver preço e o que dá para construir
        </span>
      ) : (
        <>
          {(['farm', 'mine', 'industry', 'retail', 'warehouse', 'logistics'] as const).map((c) => (
            <span key={c} className="map-legenda-tipo">
              <i style={{ background: categoryInfo[c].color }} />
              {categoryInfo[c].label}
            </span>
          ))}
          <span className="map-legenda-tipo">
            <i className="livre" />
            Terreno livre
          </span>
          <span>
            <i className="alerta-brasa" />
            Precisa de você
          </span>
          <span>
            <i className="alerta-ouro" />
            Atenção
          </span>
        </>
      )}
    </div>
  );
}
