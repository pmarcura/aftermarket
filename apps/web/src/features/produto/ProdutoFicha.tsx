import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { GraficoPixel } from '../../components/GraficoPixel';
import { BarrasPixel } from '../../components/BarrasPixel';
import { IconePixel } from '../../components/IconePixel';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  TIME_SCALE,
  type MarketSample,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { marketView, seasonPrice } from '../../../../../packages/simulation/src/metrics';
import '../../design/produto-ficha.css';

const PERIODOS = [
  { id: 'dia', rotulo: '1 dia', horas: 24 },
  { id: 'semana', rotulo: '7 dias', horas: 168 },
  { id: 'tudo', rotulo: 'Tudo', horas: 0 },
] as const;

/** Reduz uma série a no máximo `n` pontos, tirando a média de cada faixa. */
function reduzir<T extends { at: number }>(
  itens: T[],
  n: number,
  valor: (i: T) => number,
  somar = false,
): { at: number; v: number }[] {
  if (itens.length <= n) return itens.map((i) => ({ at: i.at, v: valor(i) }));
  const tam = itens.length / n;
  return Array.from({ length: n }, (_, k) => {
    const fatia = itens.slice(
      Math.floor(k * tam),
      Math.max(Math.floor(k * tam) + 1, Math.floor((k + 1) * tam)),
    );
    return {
      at: fatia[fatia.length - 1].at,
      v: fatia.reduce((s, i) => s + valor(i), 0) / (somar ? 1 : fatia.length),
    };
  });
}

/** Ficha do produto: um painel por cima da tela com preço, procura, quem produz e quem vende. */
export function ProdutoFicha() {
  const { produtoAberto } = useGame();
  return produtoAberto ? <Ficha key={produtoAberto} id={produtoAberto} /> : null;
}

function Ficha({ id }: { id: ProductId }) {
  const { world, actor, openProduto, openRepor } = useGame();
  const ref = useRef<HTMLDialogElement>(null);
  const info = products[id];
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['id']>('semana');
  const [amostras, setAmostras] = useState<MarketSample[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const no = ref.current!;
    const antes = document.activeElement as HTMLElement | null;
    no.showModal();
    return () => {
      no.close();
      antes?.focus();
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    const buscar = () =>
      fetch(`/api/market-history?product=${id}&region=`)
        .then((r) => {
          if (!r.ok) throw new Error('histórico');
          return r.json() as Promise<{ samples: MarketSample[] }>;
        })
        .then((v) => {
          if (ativo) {
            setAmostras(v.samples);
            setFalhou(false);
          }
        })
        .catch(() => ativo && setFalhou(true));
    void buscar();
    const t = setInterval(() => void buscar(), 15000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [id]);

  const mercado = useMemo(
    () => marketView(world, id, '', 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, id],
  );
  const justo = seasonPrice(world, id);
  const faixa = world.season.config.priceBands[id];
  const preco = mercado.price;
  const desvio = preco !== null && justo > 0 ? preco / justo - 1 : null;

  // Série de preço e de negociado, no período escolhido, em horas de jogo.
  const serie = useMemo(() => {
    const horas = PERIODOS.find((p) => p.id === periodo)!.horas;
    const desde = horas ? world.updatedAt - (horas * 3_600_000) / TIME_SCALE : 0;
    const dados = (amostras ?? []).filter((s) => s.at >= desde);
    const rotulo = (at: number) => {
      const jogo = world.season.startedAt + (at - world.season.startedAt) * TIME_SCALE;
      const dia = Math.floor((jogo - world.season.startedAt) / 86_400_000) + 1;
      return `Dia ${dia} · ${String(new Date(jogo).getUTCHours()).padStart(2, '0')}h`;
    };
    const comPreco = dados.filter((s) => s.price !== null);
    const precos = reduzir(comPreco, 36, (s) => s.price as number);
    const negociado = reduzir(
      dados.map((s, i) => ({
        at: s.at,
        q: Math.max(0, s.tradedQuantity - (dados[i - 1]?.tradedQuantity ?? s.tradedQuantity)),
      })),
      24,
      (s) => s.q,
      true,
    );
    return {
      precos,
      negociado,
      rotulosPreco: precos.map((p) => rotulo(p.at)),
      rotulosVolume: negociado.map((p) => rotulo(p.at)),
      maximo: Math.max(0, ...comPreco.map((s) => s.price as number)),
      minimo: comPreco.length ? Math.min(...comPreco.map((s) => s.price as number)) : 0,
    };
  }, [amostras, periodo, world.season.startedAt, world.updatedAt]);

  // Quem produziu e quem vendeu, pelo que o mundo guarda em memória.
  const quemProduziu = useMemo(() => {
    const dono = new Map(world.establishments.map((e) => [e.id, e.companyId]));
    const m = new Map<string, number>();
    for (const j of world.jobs) {
      const q = j.completed ? (j.output?.[id] ?? 0) : 0;
      if (q > 0)
        m.set(
          dono.get(j.establishmentId) ?? '?',
          (m.get(dono.get(j.establishmentId) ?? '?') ?? 0) + q,
        );
    }
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, id]);
  const quemVendeu = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of world.ledger)
      if (l.product === id && (l.kind === 'trade' || l.kind === 'retail') && (l.quantity ?? 0) > 0)
        m.set(l.to, (m.get(l.to) ?? 0) + (l.quantity ?? 0));
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, id]);
  const nome = (companyId: string) => {
    const c = world.companies.find((x) => x.id === companyId);
    return companyId === actor ? 'Você' : (c?.name ?? 'Empresa');
  };
  const ranking = (lista: [string, number][]) =>
    lista.map(([empresa, q], i) => ({
      rotulo: `${i + 1}º ${nome(empresa)}`,
      valor: q,
      tom: empresa === actor ? ('lavoura' as const) : ('ceu' as const),
    }));

  // Ofertas mais baratas agora e o destino padrão do botão de reposição.
  const ofertas = [...mercado.offers].sort((a, b) => a.price - b.price).slice(0, 3);
  const meus = world.establishments.filter((e) => e.companyId === actor);
  const destino =
    meus.find((e) =>
      world.season.config.recipes.some((r) => r.id === e.specialization && r.input[id]),
    ) ?? meus.find((e) => e.category === 'retail');
  const feitoEm = world.season.config.recipes.filter((r) => r.output[id]);
  const usadoEm = world.season.config.recipes.filter((r) => r.input[id]);

  const cobertura = mercado.coverageDays;
  const situacao =
    cobertura === null
      ? { tom: 'apagado', texto: 'Sem procura' }
      : cobertura < 1
        ? { tom: 'brasa', texto: 'Falta no mercado' }
        : cobertura < 3
          ? { tom: 'ouro', texto: 'Mercado apertado' }
          : { tom: 'lavoura', texto: 'Mercado folgado' };
  const fechar = () => openProduto(null);
  // Posição do preço dentro da faixa de referência, para o medidor.
  const baixo = faixa?.low ?? 0;
  const alto = faixa?.high ?? 0;
  const pos = (v: number) =>
    alto > baixo ? Math.min(100, Math.max(0, ((v - baixo) / (alto - baixo)) * 100)) : 50;

  return (
    <dialog
      ref={ref}
      className="ficha"
      aria-labelledby="ficha-titulo"
      onCancel={fechar}
      onClick={(ev) => ev.target === ev.currentTarget && fechar()}
    >
      <div className="ficha-painel">
        <button className="ficha-fechar" onClick={fechar} aria-label="Fechar">
          <X size={20} />
        </button>

        <header className="ficha-hero" style={{ ['--h' as string]: matizDoProduto(id) }}>
          <div className="ficha-arte">
            <ProdutoArte product={id} escala={4} />
          </div>
          <div className="ficha-titulo">
            <h2 id="ficha-titulo">{info.name}</h2>
            <span className={`item-estado tom-${situacao.tom}`}>{situacao.texto}</span>
            <p>
              Vendido por {unidade(id, 1)} ·{' '}
              {info.massT >= 1 ? `${num(info.massT, 2)} t` : `${num(info.massT * 1000, 1)} kg`} por
              unidade
            </p>
          </div>
          <div className="ficha-preco">
            <span>Preço médio das ofertas</span>
            <b>{preco !== null ? cr(preco) : '—'}</b>
            {desvio !== null && (
              <small className={desvio > 0.05 ? 'alto' : desvio < -0.05 ? 'baixo' : ''}>
                {desvio >= 0 ? '+' : ''}
                {num(desvio * 100, 0)}% sobre o preço justo ({cr(justo)})
              </small>
            )}
          </div>
        </header>

        <div className="ficha-corpo">
          <ul className="ficha-numeros">
            <li>
              <IconePixel nome="caixa" tamanho={30} />
              <span>No mercado agora</span>
              <b>
                {num(mercado.stock)} {unidade(id, mercado.stock)}
              </b>
              <small>{num(mercado.offers.length)} ofertas</small>
            </li>
            <li>
              <IconePixel nome="rival" tamanho={30} />
              <span>Preço nas lojas</span>
              <b>{mercado.retailPrice !== null ? cr(mercado.retailPrice) : '—'}</b>
              <small>média cobrada às famílias</small>
            </li>
            <li>
              <IconePixel nome="pedido" tamanho={30} />
              <span>Procura por dia</span>
              <b>{num(mercado.demand, 0)}</b>
              <small>
                famílias {num(mercado.householdDemand, 0)} · indústria{' '}
                {num(mercado.industrialDemand, 0)}
              </small>
            </li>
            <li>
              <IconePixel nome="prazo" tamanho={30} />
              <span>O estoque dá para</span>
              <b className={`tom-${situacao.tom}`}>
                {cobertura === null ? '—' : `${num(cobertura, 1)} dias`}
              </b>
              <small>{situacao.texto.toLowerCase()}</small>
            </li>
          </ul>

          {faixa && alto > baixo && (
            <section className="ficha-bloco" aria-labelledby="ficha-faixa">
              <h3 id="ficha-faixa">Onde o preço está</h3>
              <div
                className="ficha-faixa"
                role="img"
                aria-label={`Faixa de referência de ${cr(baixo)} a ${cr(alto)}${preco !== null ? `; preço atual ${cr(preco)}` : ''}`}
              >
                <div className="ficha-trilho">
                  {preco !== null && (
                    <span className="ficha-pino" style={{ left: `${pos(preco)}%` }}>
                      <IconePixel nome="moeda" tamanho={34} />
                    </span>
                  )}
                  <span className="ficha-justo" style={{ left: `${pos(justo)}%` }}>
                    <IconePixel nome="justo" tamanho={26} />
                  </span>
                </div>
                <div className="ficha-extremos">
                  <span>
                    <small>Faixa baixa</small> <b>{cr(baixo)}</b>
                  </span>
                  <span>
                    <small>Faixa alta</small> <b>{cr(alto)}</b>
                  </span>
                </div>
              </div>
              <p className="ficha-nota">
                Referência real de mercado ({faixa.source}, {faixa.date}). A moeda é o preço médio
                das ofertas no jogo; a balança é o preço justo da temporada.
              </p>
            </section>
          )}

          <section className="ficha-bloco" aria-labelledby="ficha-grafico">
            <div className="ficha-cab">
              <h3 id="ficha-grafico">Preço ao longo do tempo</h3>
              <div className="ficha-periodos" role="radiogroup" aria-label="Período">
                {PERIODOS.map((p) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={periodo === p.id}
                    className={periodo === p.id ? 'on' : ''}
                    onClick={() => setPeriodo(p.id)}
                  >
                    {p.rotulo}
                  </button>
                ))}
              </div>
            </div>
            {falhou && !amostras ? (
              <p className="ficha-vazio">
                Não foi possível carregar o histórico agora. Tentando de novo.
              </p>
            ) : serie.precos.length < 2 ? (
              <p className="ficha-vazio">
                {amostras
                  ? 'Ainda há poucos dados nesse período. O histórico cresce a cada rodada.'
                  : 'Carregando o histórico…'}
              </p>
            ) : (
              <>
                <GraficoPixel
                  titulo={`Preço médio de ${info.name} ao longo do tempo`}
                  altura={250}
                  rotulos={serie.rotulosPreco}
                  series={[{ nome: 'Preço médio', valores: serie.precos.map((p) => p.v) }]}
                  formato={(v) => cr(v)}
                  formatoEixo={(v) => cr(v, 0)}
                  referencia={{ valor: justo, rotulo: 'preço justo' }}
                />
                <div className="ficha-resumo">
                  <span>
                    Mínimo <b>{cr(serie.minimo)}</b>
                  </span>
                  <span>
                    Máximo <b>{cr(serie.maximo)}</b>
                  </span>
                </div>
                <h4>Quanto foi negociado</h4>
                <GraficoPixel
                  titulo={`Quantidade negociada de ${info.name}`}
                  tipo="barras"
                  altura={150}
                  rotulos={serie.rotulosVolume}
                  series={[
                    { nome: 'Negociado', valores: serie.negociado.map((p) => Math.round(p.v)) },
                  ]}
                  formato={(v) => `${num(v)} ${unidade(id, v)}`}
                  formatoEixo={(v) => num(v)}
                />
              </>
            )}
          </section>

          <p className="ficha-nota">
            Produção e vendas abaixo consideram apenas os registros disponíveis nesta sessão, não um
            ranking completo do mundo.
          </p>
          <div className="ficha-duas">
            <section className="ficha-bloco" aria-labelledby="ficha-prod">
              <h3 id="ficha-prod">
                <IconePixel nome="caixa" tamanho={26} /> Quem mais produziu
              </h3>
              {quemProduziu.length ? (
                <BarrasPixel
                  titulo={`Quem mais produziu ${info.name}`}
                  itens={ranking(quemProduziu)}
                  formato={(v) => `${num(v)} ${unidade(id, v)}`}
                />
              ) : (
                <p className="ficha-vazio">
                  Ninguém concluiu produção desse item nos dados guardados.
                </p>
              )}
            </section>
            <section className="ficha-bloco" aria-labelledby="ficha-vend">
              <h3 id="ficha-vend">
                <IconePixel nome="moeda" tamanho={26} /> Quem mais vendeu
              </h3>
              {quemVendeu.length ? (
                <BarrasPixel
                  titulo={`Quem mais vendeu ${info.name}`}
                  itens={ranking(quemVendeu)}
                  formato={(v) => `${num(v)} ${unidade(id, v)}`}
                />
              ) : (
                <p className="ficha-vazio">
                  Nenhuma venda registrada desse item nos dados guardados.
                </p>
              )}
            </section>
          </div>

          <section className="ficha-bloco" aria-labelledby="ficha-ofertas">
            <h3 id="ficha-ofertas">Ofertas mais baratas agora</h3>
            {ofertas.length ? (
              <ul className="ficha-ofertas">
                {ofertas.map((o) => {
                  const p = world.properties.find((x) => x.id === o.establishment.propertyId);
                  return (
                    <li key={o.id}>
                      <IconePixel nome="rival" tamanho={30} />
                      <span>
                        <strong>{o.establishment.name}</strong>
                        <small>
                          {p?.city}, {p?.state} · {num(o.quantity)} {unidade(id, o.quantity)}
                        </small>
                      </span>
                      <b>{cr(o.price)}</b>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ficha-vazio">Ninguém está vendendo esse item agora.</p>
            )}
          </section>

          {(feitoEm.length > 0 || usadoEm.length > 0) && (
            <section className="ficha-bloco" aria-labelledby="ficha-cadeia">
              <h3 id="ficha-cadeia">Na cadeia</h3>
              <div className="ficha-cadeia">
                {feitoEm.length > 0 && (
                  <p>
                    <b>Sai de:</b> {feitoEm.map((r) => r.name).join(', ')}
                  </p>
                )}
                {usadoEm.length > 0 && (
                  <p>
                    <b>Entra em:</b> {usadoEm.map((r) => r.name).join(', ')}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="ficha-rodape">
          <button className="secondary" onClick={fechar}>
            Fechar
          </button>
          {destino && (
            <button
              className="primary"
              onClick={() => {
                fechar();
                openRepor({ destinationId: destino.id, product: id });
              }}
            >
              Mandar buscar para {destino.name}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
