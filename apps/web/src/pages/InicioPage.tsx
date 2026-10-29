import { useEffect, useState } from 'react';
import { Check, Coins, Factory, Plus, ShoppingBasket, Truck } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { Badge } from '../components/ui';
import { PixelArt } from '../components/PixelArt';
import { GraficoPixel } from '../components/GraficoPixel';
import { spriteDoNegocio } from '../design/arte';
import { estadoDe } from '../features/business/BusinessCards';
import { usePendencias, type Pendencia } from '../features/inicio/pendencias';
import { usePrimeirosPassos } from '../features/inicio/primeirosPassos';
import {
  agoraDoMundo,
  comecoDoDia,
  horasDeJogo,
  relogio,
  useAusencia,
  useResumoDoCaixa,
} from '../features/inicio/tempo';
import { products } from '../../../../packages/simulation/src/model';
import { GAME_DAY, gameCalendar } from '../../../../packages/simulation/src/operations';
import '../design/inicio.css';

// A contagem anima só na primeira vez que cada número aparece na sessão.
const contados = new Set<string>();
const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Número que sobe até o valor em passos, uma vez por sessão. */
function Contador({
  id,
  valor,
  formato,
}: {
  id: string;
  valor: number;
  formato: (v: number) => string;
}) {
  const [mostrado, setMostrado] = useState(() => (contados.has(id) || semMovimento() ? valor : 0));
  useEffect(() => {
    if (mostrado === valor) return;
    if (contados.has(id) || semMovimento()) {
      setMostrado(valor);
      return;
    }
    let passo = 0;
    const passos = 12;
    const t = setInterval(() => {
      passo++;
      setMostrado(passo >= passos ? valor : Math.round((valor * passo) / passos));
      if (passo >= passos) {
        clearInterval(t);
        contados.add(id);
      }
    }, 45);
    return () => clearInterval(t);
    // Só reage ao valor novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return <>{formato(mostrado)}</>;
}

type Caixa = ReturnType<typeof useResumoDoCaixa>;
type Periodo = ReturnType<typeof useAusencia>;

function Ausencia({ caixa, periodo }: { caixa: Caixa; periodo: Periodo }) {
  const { world, actor } = useGame();
  const { desde, ausente, agora } = periodo;
  const meus = new Set(world.establishments.filter((e) => e.companyId === actor).map((e) => e.id));
  const entregas = world.shipments.filter(
    (s) => s.buyerId === actor && s.delivered && s.arrivesAt >= desde,
  ).length;
  const lotes = world.jobs.filter(
    (j) => meus.has(j.establishmentId) && j.completed && j.finishesAt >= desde,
  ).length;
  // Vendas e gastos sempre aparecem; entregas e lotes só quando aconteceram.
  const itens = [
    {
      id: 'vendas',
      icone: Coins,
      tom: 'ouro',
      valor: caixa.vendas,
      formato: (v: number) => cr(v, 0),
      rotulo: 'em vendas',
    },
    {
      id: 'gastos',
      icone: ShoppingBasket,
      tom: 'apagado',
      valor: caixa.gastos,
      formato: (v: number) => cr(v, 0),
      rotulo: caixa.mercadoria
        ? `em gastos, ${cr(caixa.mercadoria, 0)} viraram estoque`
        : 'em gastos',
    },
    entregas > 0 && {
      id: 'entregas',
      icone: Truck,
      tom: 'ceu',
      valor: entregas,
      formato: (v: number) => num(v),
      rotulo: entregas === 1 ? 'entrega chegou' : 'entregas chegaram',
    },
    lotes > 0 && {
      id: 'lotes',
      icone: Factory,
      tom: 'lavoura',
      valor: lotes,
      formato: (v: number) => num(v),
      rotulo: lotes === 1 ? 'lote produzido' : 'lotes produzidos',
    },
  ].filter(Boolean) as {
    id: string;
    icone: typeof Coins;
    tom: string;
    valor: number;
    formato: (v: number) => string;
    rotulo: string;
  }[];
  return (
    <section className="ini-fora" aria-labelledby="ini-fora-titulo">
      <h2 id="ini-fora-titulo">
        {ausente
          ? `Enquanto você esteve fora, ${num(horasDeJogo(agora - desde))} h de jogo`
          : 'Hoje'}
      </h2>
      <ul>
        {itens.map((i) => (
          <li key={i.id} className={`tom-${i.tom}`}>
            <i aria-hidden="true">
              <i.icone size={18} strokeWidth={2} />
            </i>
            <b>
              <Contador
                id={`${ausente ? 'fora' : 'hoje'}-${i.id}`}
                valor={i.valor}
                formato={i.formato}
              />
            </b>
            <span>{i.rotulo}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrecisaDeVoce({ pendencias }: { pendencias: Pendencia[] }) {
  const { navigate } = useGame();
  return (
    <section className="ini-bloco" aria-labelledby="ini-precisa">
      <h2 id="ini-precisa">
        Precisa de você{' '}
        {pendencias.length > 0 && <span className="ini-conta">{pendencias.length}</span>}
      </h2>
      {pendencias.length ? (
        <ul className="ini-pendencias">
          {pendencias.map((p) => (
            <li key={p.id} className={`tom-${p.tom}`}>
              <div>
                <strong>{p.titulo}</strong>
                <small>{p.detalhe}</small>
              </div>
              <button
                className={p.tom === 'brasa' ? 'primary' : 'secondary'}
                onClick={p.acao.executar}
              >
                {p.acao.rotulo}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ini-em-dia">
          <i aria-hidden="true">
            <Check size={18} strokeWidth={3} />
          </i>
          <div>
            <strong>Nada esperando por você.</strong>
            <small>Bom momento para olhar o que está em falta no mercado.</small>
          </div>
          <button className="secondary" onClick={() => navigate('quotes')}>
            Ver cotações
          </button>
        </div>
      )}
    </section>
  );
}

function PrimeirosPassos() {
  const passos = usePrimeirosPassos();
  const feitos = passos.filter((p) => p.done).length;
  const proximo = passos.find((p) => !p.done);
  if (!proximo) return null;
  return (
    <section className="ini-bloco ini-passos" aria-labelledby="ini-passos">
      <h2 id="ini-passos">Primeiros passos</h2>
      <div
        className="ini-blocos"
        role="img"
        aria-label={`${feitos} de ${passos.length} passos concluídos`}
      >
        {passos.map((p, i) => (
          <i
            key={p.title}
            className={p.done ? 'feito' : p === proximo ? 'agora' : ''}
            title={`${i + 1}. ${p.title}`}
          />
        ))}
        <span>
          {feitos} de {passos.length}
        </span>
      </div>
      <h3>{proximo.title}</h3>
      <p>{proximo.text}</p>
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
  const agora = agoraDoMundo(world);
  const cargas = world.shipments
    .filter((s) => s.buyerId === actor && !s.delivered)
    .sort((a, b) => a.arrivesAt - b.arrivesAt);
  if (!cargas.length) return null;
  return (
    <section className="ini-bloco" aria-labelledby="ini-caminho">
      <h2 id="ini-caminho">A caminho</h2>
      <ul className="ini-cargas">
        {cargas.slice(0, 4).map((s) => {
          const total = Math.max(1, s.arrivesAt - s.departedAt);
          const feito = Math.min(1, Math.max(0, (agora - s.departedAt) / total));
          const falta = Math.max(0, horasDeJogo(s.arrivesAt - agora));
          const destino = world.establishments.find((e) => e.id === s.destinationId)?.name;
          return (
            <li key={s.id}>
              <div className="ini-carga-texto">
                <strong>
                  {num(s.quantity)} {products[s.product].unit} de {products[s.product].name}
                </strong>
                <small>
                  para {destino} · {falta < 1 ? 'chegando' : `chega em ~${num(falta)} h`}
                </small>
              </div>
              <div
                className="ini-estrada"
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
        })}
      </ul>
      {cargas.length > 4 && (
        <button className="gpx-tabela-botao" onClick={() => navigate('logistics')}>
          Ver as {cargas.length} cargas
        </button>
      )}
    </section>
  );
}

function VendasDaSemana({ porDia }: { porDia: number[] }) {
  const { world } = useGame();
  // Com menos de 3 dias de vendas, as barras vazias não dizem nada.
  if (porDia.filter((v) => v > 0).length < 3) return null;
  const fim = comecoDoDia(world) + GAME_DAY;
  const rotulos = porDia.map((_, i) =>
    i === 6
      ? 'hoje'
      : gameCalendar(world, fim - (7 - i) * GAME_DAY + GAME_DAY / 2)
          .label.slice(0, 3)
          .toLocaleLowerCase('pt-BR'),
  );
  return (
    <section className="ini-bloco" aria-labelledby="ini-vendas">
      <h2 id="ini-vendas">Vendas por dia</h2>
      <GraficoPixel
        titulo="Vendas da empresa em cada um dos últimos 7 dias de jogo"
        tipo="barras"
        altura={190}
        rotulos={rotulos}
        series={[{ nome: 'Vendas', valores: porDia }]}
        formato={(v) => cr(v)}
        formatoEixo={(v) => cr(v, 0)}
      />
    </section>
  );
}

function SeusNegocios({
  pendencias,
  porNegocioHoje,
}: {
  pendencias: Pendencia[];
  porNegocioHoje: Map<string, number>;
}) {
  const { world, actor, openBusiness, navigate } = useGame();
  const agora = agoraDoMundo(world);
  const meus = world.establishments.filter((e) => e.companyId === actor);
  return (
    <section className="ini-bloco ini-negocios" aria-labelledby="ini-negocios">
      <h2 id="ini-negocios">Seus negócios</h2>
      <ul>
        {meus.map((e) => {
          const estado = estadoDe(e);
          const problema = pendencias.find((p) => p.negocioId === e.id);
          const lote = world.jobs.find((j) => j.establishmentId === e.id && !j.completed);
          const vendas = porNegocioHoje.get(e.id) ?? 0;
          const motivo = problema
            ? problema.titulo.replace(`${e.name} `, '')
            : lote
              ? `Produzindo, pronto em ~${num(Math.max(1, horasDeJogo(lote.finishesAt - agora)))} h`
              : vendas > 0 || e.category === 'retail'
                ? `Vendeu ${cr(vendas, 0)} hoje`
                : 'Sem produção agora';
          return (
            <li key={e.id}>
              <button
                onClick={() => openBusiness(e.id)}
                aria-label={`${e.name}: ${estado.tone === 'green' ? motivo : estado.label}`}
              >
                <span className="ini-cena">
                  <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
                </span>
                <strong>{e.name}</strong>
                {estado.tone !== 'green' && <Badge tone="gold">{estado.label}</Badge>}
                <small className={problema ? `ini-motivo tom-${problema.tom}` : 'ini-motivo'}>
                  {motivo}
                </small>
              </button>
            </li>
          );
        })}
        <li>
          <button className="ini-novo" onClick={() => navigate('map')}>
            <Plus size={22} aria-hidden="true" />
            <strong>Abrir negócio</strong>
            <small>Escolha um imóvel no mapa</small>
          </button>
        </li>
      </ul>
    </section>
  );
}

export function InicioPage() {
  const { world, actor } = useGame();
  const { dia, hora, semana } = relogio(world);
  const empresa = world.companies.find((c) => c.id === actor)!;
  const pendencias = usePendencias();
  const periodo = useAusencia();
  const caixa = useResumoDoCaixa(periodo.desde);
  return (
    <div className="inicio">
      <header className="ini-cab">
        <h1>{empresa.name}</h1>
        <p>
          Dia {dia} · {semana.toLocaleLowerCase('pt-BR')} · {String(hora).padStart(2, '0')}h no jogo
        </p>
      </header>
      <Ausencia caixa={caixa} periodo={periodo} />
      <div className="ini-grade">
        <div className="ini-coluna">
          <PrecisaDeVoce pendencias={pendencias} />
          <SeusNegocios pendencias={pendencias} porNegocioHoje={caixa.porNegocioHoje} />
        </div>
        <div className="ini-coluna">
          <PrimeirosPassos />
          <ACaminho />
          <VendasDaSemana porDia={caixa.porDia} />
        </div>
      </div>
    </div>
  );
}
