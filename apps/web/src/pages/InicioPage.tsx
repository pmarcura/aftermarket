import { useEffect, useMemo, useState } from 'react';
import { useGame, cr, num } from '../lib/game';
import { Placa } from '../components/Livro';
import { CargaCaminho } from '../components/CargaCaminho';
import { usePendencias } from '../features/inicio/pendencias';
import { usePrimeirosPassos } from '../features/inicio/primeirosPassos';
import { horasDeJogo, relogio, useAusencia, useResumoDoCaixa } from '../features/inicio/tempo';
import { Caderno } from '../features/inicio/Caderno';
import { Pregao, produtosDoPregao } from '../features/inicio/Pregao';
import { Oportunidades } from '../features/inicio/Oportunidades';
import { Mural } from '../features/inicio/Mural';
import { NumeroVivo } from '../features/inicio/vivo';
import { useHistorico } from '../features/mercado/historico';
import { patrimonioDe, porteDe } from '../features/empresa/resumo';
import '../design/inicio.css';

type Periodo = ReturnType<typeof useAusencia>;

/** O que aconteceu enquanto o jogador esteve fora (ou hoje), em forma de recibo. */
function Recibo({ periodo }: { periodo: Periodo }) {
  const { world, actor } = useGame();
  const caixa = useResumoDoCaixa(periodo.desde);
  const { desde, ausente, agora } = periodo;
  const meus = new Set(world.establishments.filter((e) => e.companyId === actor).map((e) => e.id));
  const entregas = world.shipments.filter(
    (s) => s.buyerId === actor && s.delivered && s.arrivesAt >= desde,
  ).length;
  const lotes = world.jobs.filter(
    (j) => meus.has(j.establishmentId) && j.completed && j.finishesAt >= desde,
  ).length;
  const custos = caixa.gastos - caixa.mercadoria - caixa.investimento;
  const sobra = caixa.vendas - custos;
  const chave = ausente ? 'fora' : 'hoje';
  return (
    <section className="recibo lv-recibo" aria-labelledby="recibo-titulo">
      <h2 id="recibo-titulo" className="lv-rotulo">
        {ausente
          ? `Enquanto você esteve fora · ${num(horasDeJogo(world, agora - desde))} h`
          : 'Hoje até agora'}
      </h2>
      <dl>
        <div>
          <dt>Vendas</dt>
          <dd className="entra">
            +<NumeroVivo valor={caixa.vendas} formato={(v) => cr(v, 0)} id={`${chave}-vendas`} />
          </dd>
        </div>
        <div>
          <dt>Equipe, energia e frete</dt>
          <dd className="sai">
            −<NumeroVivo valor={custos} formato={(v) => cr(v, 0)} id={`${chave}-custos`} />
          </dd>
        </div>
        {caixa.investimento > 0 && (
          <div>
            <dt>Investido em imóveis e caminhões</dt>
            <dd>{cr(caixa.investimento, 0)}</dd>
          </div>
        )}
        {caixa.mercadoria > 0 && (
          <div>
            <dt>Virou estoque</dt>
            <dd>{cr(caixa.mercadoria, 0)}</dd>
          </div>
        )}
        {entregas > 0 && (
          <div>
            <dt>{entregas === 1 ? 'Chegou 1 carga' : `Chegaram ${entregas} cargas`}</dt>
            <dd>✓</dd>
          </div>
        )}
        {lotes > 0 && (
          <div>
            <dt>{lotes === 1 ? '1 lote produzido' : `${lotes} lotes produzidos`}</dt>
            <dd>✓</dd>
          </div>
        )}
        <div className="total">
          <dt>{sobra >= 0 ? 'Sobrou' : 'Faltou'}</dt>
          <dd className={sobra >= 0 ? 'entra' : 'sai'}>
            {sobra >= 0 ? '+' : '−'}
            <NumeroVivo valor={Math.abs(sobra)} formato={(v) => cr(v, 0)} id={`${chave}-sobra`} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Régua do porte da empresa: a meta de longo prazo, sempre à vista. */
function Porte() {
  const { world, actor, navigate } = useGame();
  const patrimonio = useMemo(
    () => patrimonioDe(world, actor).netWorth,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const porte = porteDe(patrimonio);
  // A barra enche do zero ao aparecer; depois acompanha o patrimônio.
  const [cheio, setCheio] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setCheio(porte.avanco));
    return () => cancelAnimationFrame(t);
  }, [porte.avanco]);
  return (
    <section className="porte lv-peca" aria-labelledby="porte-titulo">
      <h2 id="porte-titulo" className="lv-rotulo">
        Porte da empresa
      </h2>
      <p className="porte-valor">
        <NumeroVivo valor={patrimonio} formato={(v) => cr(v, 0)} id="porte" />
        <small>de patrimônio</small>
      </p>
      <div
        className="porte-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(porte.avanco * 100)}
        aria-label={`Avanço até empresa ${porte.proximo?.nome.toLocaleLowerCase('pt-BR') ?? 'máxima'}`}
      >
        <i style={{ width: `${cheio * 100}%` }} />
      </div>
      <p className="porte-meta">
        <span>{porte.atual.nome}</span>
        {porte.proximo ? (
          <>
            <span aria-hidden="true">→</span>
            <b>{porte.proximo.nome}</b>
            <small>faltam {cr(porte.falta, 0)}</small>
          </>
        ) : (
          <small>o maior porte do jogo</small>
        )}
      </p>
      <button className="ini-link" onClick={() => navigate('company')}>
        Ver a empresa
      </button>
    </section>
  );
}

/** O guia da primeira hora: um passo por vez, até acabar. */
function PrimeirosPassos() {
  const passos = usePrimeirosPassos();
  const feitos = passos.filter((p) => p.done).length;
  const proximo = passos.find((p) => !p.done);
  if (!proximo) return null;
  return (
    <section className="passo" aria-labelledby="passo-titulo">
      <div
        className="passo-pips"
        role="img"
        aria-label={`${feitos} de ${passos.length} passos concluídos`}
      >
        {passos.map((p) => (
          <i key={p.title} className={p.done ? 'feito' : p === proximo ? 'agora' : ''} />
        ))}
      </div>
      <div className="passo-texto">
        <span className="lv-rotulo">
          Próximo passo · {feitos + 1} de {passos.length}
        </span>
        <h2 id="passo-titulo">{proximo.title}</h2>
        <p>{proximo.text}</p>
      </div>
      {proximo.action && (
        <button className="primary" onClick={proximo.action.run}>
          {proximo.action.label}
        </button>
      )}
    </section>
  );
}

/** Cargas compradas ainda na estrada: o caminhão anda sobre a faixa até chegar. */
function ACaminho() {
  const { world, actor, navigate } = useGame();
  const cargas = world.shipments
    .filter((s) => s.buyerId === actor && !s.delivered)
    .sort((a, b) => a.arrivesAt - b.arrivesAt);
  if (!cargas.length) return null;
  return (
    <section className="a-caminho" aria-labelledby="caminho-titulo">
      <h2 id="caminho-titulo" className="lv-rotulo">
        A caminho
      </h2>
      <ul className="cam-lista">
        {cargas.slice(0, 3).map((s) => (
          <CargaCaminho key={s.id} s={s} world={world} />
        ))}
      </ul>
      {cargas.length > 3 && (
        <button className="ini-link" onClick={() => navigate('logistics')}>
          Ver as {cargas.length} cargas
        </button>
      )}
    </section>
  );
}

export function InicioPage() {
  const { world, actor } = useGame();
  const { dia, hora, semana } = relogio(world);
  const empresa = world.companies.find((c) => c.id === actor)!;
  const pendencias = usePendencias();
  const periodo = useAusencia();
  const itens = useMemo(
    () => produtosDoPregao(world, actor),
    // A lista muda quando a empresa passa a negociar outro produto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  // O mural usa as trocas dos mesmos produtos que o pregão já busca.
  const historico = useHistorico(
    itens.map((i) => i.id),
    15000,
  );
  return (
    <div className="inicio">
      <header className="ini-cab">
        <Placa
          titulo={empresa.name}
          sub={`Dia ${dia} · ${semana.toLocaleLowerCase('pt-BR')} · ${String(hora).padStart(2, '0')}h no jogo`}
        />
      </header>
      <div className="ini-topo">
        <div className="ini-principal">
          <Caderno pendencias={pendencias} />
          <ACaminho />
        </div>
        <aside className="ini-lado" aria-label="Resumo">
          <Recibo periodo={periodo} />
          <Porte />
        </aside>
      </div>
      <PrimeirosPassos />
      <Oportunidades />
      <div className="ini-mercado">
        <Pregao historico={historico} itens={itens} />
        <Mural historico={historico} />
      </div>
    </div>
  );
}
