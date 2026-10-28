import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { PageHeading } from '../../components/ui';
import { SecaoAbas } from '../../components/SecaoAbas';
import { ProductAnalysisModal } from '../../components/ProductAnalysis';
import { ProdutoArte } from './Vitrine';
import { unidade } from './Carga';
import {
  products,
  seasonProducts,
  TIME_SCALE,
  type MarketSample,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { GAME_DAY } from '../../../../../packages/simulation/src/operations';
import '../../economy.css';

interface Negocio {
  at: number;
  from: string;
  to: string;
  product: ProductId;
  quantity: number;
  unitPrice: number;
}
type Historico = Partial<Record<ProductId, { samples: MarketSample[]; trades: Negocio[] }>>;

/** Histórico nacional de todos os produtos, pelo mesmo endereço que a análise de mercadoria usa. */
function useHistorico(ids: ProductId[]) {
  const [h, setH] = useState<Historico>({});
  const chave = ids.join(',');
  useEffect(() => {
    let ativo = true;
    const ler = () =>
      Promise.all(
        ids.map((id) =>
          fetch(`/api/market-history?product=${id}&region=`)
            .then((r) => (r.ok ? r.json() : undefined))
            .then((v) => [id, v] as const)
            .catch(() => [id, undefined] as const),
        ),
      ).then((pares) => {
        if (!ativo) return;
        const novo: Historico = {};
        for (const [id, v] of pares) if (v) novo[id] = { samples: v.samples, trades: v.trades };
        setH(novo);
      });
    void ler();
    const t = setInterval(() => void ler(), 30000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
    // A lista de produtos só muda com a temporada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return h;
}

/** Tempo de jogo decorrido, em palavras curtas. */
function haQuanto(at: number) {
  const horas = ((Date.now() - at) * TIME_SCALE) / 3600000;
  if (horas < 1) return 'agora';
  if (horas < 24) return `há ${Math.round(horas)} h`;
  return `há ${Math.round(horas / 24)} d`;
}

function Faisca({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <svg className="cot-faisca" aria-hidden="true" />;
  const min = Math.min(...valores),
    max = Math.max(...valores),
    w = 120,
    h = 34;
  const pts = valores.map(
    (v, i) =>
      `${((i / (valores.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)).toFixed(1)}`,
  );
  const sobe = valores[valores.length - 1] >= valores[0];
  return (
    <svg className="cot-faisca" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        className={sobe ? 'area sobe' : 'area desce'}
      />
      <polyline points={pts.join(' ')} className={sobe ? 'linha sobe' : 'linha desce'} />
    </svg>
  );
}

export function CotacoesPage() {
  const { world } = useGame();
  const ids = seasonProducts(world);
  const historico = useHistorico(ids);
  const [analise, setAnalise] = useState<ProductId>();
  const [grupo, setGrupo] = useState('');
  const nome = (id: string) => world.companies.find((c) => c.id === id)?.name ?? 'Empresa';

  const linhas = ids.map((id) => {
    const amostras = (historico[id]?.samples ?? []).filter((s) => s.price !== null);
    const ultima = amostras[amostras.length - 1];
    const ofertas = world.offers.filter((o) => {
      const e = world.establishments.find((x) => x.id === o.establishmentId);
      return o.product === id && (e?.inventory[id] ?? 0) > 0;
    });
    const menor = ofertas.reduce<number | undefined>(
      (n, o) => (n === undefined || o.price < n ? o.price : n),
      undefined,
    );
    const preco = ultima?.price ?? menor;
    const umDia = amostras.filter((s) => s.at <= Date.now() - GAME_DAY).pop() ?? amostras[0];
    const variacao = preco && umDia?.price ? preco / umDia.price - 1 : 0;
    const referencia = seasonPrice(world, id);
    const estoque = ofertas.reduce((n, o) => {
      const e = world.establishments.find((x) => x.id === o.establishmentId);
      return n + (e?.inventory[id] ?? 0);
    }, 0);
    return {
      id,
      preco,
      variacao,
      referencia,
      estoque,
      vendedores: ofertas.length,
      faisca: amostras.slice(-40).map((s) => s.price!),
    };
  });
  const grupos = [...new Set(ids.map((id) => products[id].category))];
  const visiveis = linhas.filter((l) => !grupo || products[l.id].category === grupo);

  // Movimento: negócios entre empresas e ações dos bots, do mais recente para trás.
  const movimento = useMemo(() => {
    const negocios = Object.values(historico)
      .flatMap((h) => h?.trades ?? [])
      .map((t) => ({
        at: t.at,
        tipo: 'negocio' as const,
        quem: t.from,
        product: t.product,
        texto: `comprou ${num(t.quantity)} ${unidade(t.product, t.quantity)} de ${products[t.product].name} de ${nome(t.to)}`,
        valor: t.unitPrice,
      }));
    const acoes = (world.botActivity ?? []).map((a) => ({
      at: a.at,
      tipo: a.kind,
      quem: a.companyId,
      product: ids.find((id) => a.text.includes(products[id].name)),
      texto: a.text.charAt(0).toLowerCase() + a.text.slice(1),
      valor: undefined as number | undefined,
    }));
    return [...negocios, ...acoes].sort((a, b) => b.at - a.at).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, world.revision]);

  const faltando = linhas.filter((l) => l.vendedores === 0).length;
  const maisCaro = [...linhas].filter((l) => l.preco).sort((a, b) => b.variacao - a.variacao)[0];
  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Cotações"
        description="O preço de tudo o que se negocia agora, como ele andou e o que as outras empresas estão fazendo."
      />
      <div className="page-body">
        <div className="cot-topo">
          <div>
            <b>{ids.length - faltando}</b>
            <span>produtos com quem venda</span>
          </div>
          <div className={faltando ? 'alerta' : ''}>
            <b>{faltando}</b>
            <span>
              {faltando === 1 ? 'esgotado em todo o mercado' : 'esgotados em todo o mercado'}
            </span>
          </div>
          {maisCaro && maisCaro.variacao > 0.005 && (
            <div>
              <b>
                {products[maisCaro.id].name.split(' ')[0]} +{num(maisCaro.variacao * 100)}%
              </b>
              <span>maior alta em um dia de jogo</span>
            </div>
          )}
        </div>
        <div className="cot-grupos" role="group" aria-label="Categoria">
          {['', ...grupos].map((g) => (
            <button
              key={g || 'todos'}
              className={grupo === g ? 'on' : ''}
              aria-pressed={grupo === g}
              onClick={() => setGrupo(g)}
            >
              {g || 'Tudo'}
            </button>
          ))}
        </div>
        <div className="cot-layout">
          <section className="cot-quadro" aria-label="Quadro de cotações">
            {visiveis.map((l) => {
              const u = products[l.id].unit;
              const ref = l.preco ? l.preco / l.referencia - 1 : 0;
              return (
                <button
                  key={l.id}
                  className={`cot-item ${l.vendedores ? '' : 'esgotado'}`}
                  onClick={() => setAnalise(l.id)}
                  aria-label={`${products[l.id].name}: ver preço ao longo do tempo`}
                >
                  <span className="cot-arte">
                    <ProdutoArte product={l.id} escala={1} />
                  </span>
                  <span className="cot-nome">
                    <b>{products[l.id].name}</b>
                    <small>{products[l.id].category}</small>
                  </span>
                  <span className="cot-preco">
                    <b>{l.preco ? cr(l.preco) : '—'}</b>
                    <small>por {u}</small>
                  </span>
                  <span
                    className={`cot-var ${l.variacao > 0.005 ? 'sobe' : l.variacao < -0.005 ? 'desce' : ''}`}
                  >
                    {l.variacao > 0.005 ? (
                      <ArrowUpRight size={14} aria-hidden="true" />
                    ) : l.variacao < -0.005 ? (
                      <ArrowDownRight size={14} aria-hidden="true" />
                    ) : (
                      <Minus size={14} aria-hidden="true" />
                    )}
                    {num(Math.abs(l.variacao) * 100, 1)}%
                  </span>
                  <Faisca valores={l.faisca} />
                  <span className="cot-oferta">
                    {l.vendedores ? (
                      <>
                        <b>
                          {num(l.estoque)} {u}
                        </b>
                        <small>
                          à venda por {l.vendedores} {l.vendedores === 1 ? 'empresa' : 'empresas'}
                        </small>
                      </>
                    ) : (
                      <b className="cot-falta">Esgotado</b>
                    )}
                  </span>
                  <span
                    className={`cot-ref ${Math.abs(ref) < 0.03 ? '' : ref > 0 ? 'acima' : 'abaixo'}`}
                  >
                    {Math.abs(ref) < 0.03
                      ? 'no preço justo'
                      : `${num(Math.abs(ref) * 100)}% ${ref > 0 ? 'acima' : 'abaixo'} do justo`}
                  </span>
                </button>
              );
            })}
          </section>
          <aside className="cot-movimento" aria-label="Movimento do mercado">
            <h2>Movimento do mercado</h2>
            <p>O que as outras empresas acabaram de fazer.</p>
            <hr className="divisor-estrada" />
            <ol>
              {movimento.map((m, i) => (
                <li key={i} className={`mov-${m.tipo}`}>
                  <span className="mov-arte">
                    {m.product ? <ProdutoArte product={m.product} escala={1} /> : <i />}
                  </span>
                  <span className="mov-texto">
                    <b>{nome(m.quem)}</b> {m.texto}
                    {m.valor !== undefined && (
                      <em>
                        {' '}
                        a {cr(m.valor)}
                        {m.product ? ` por ${products[m.product].unit}` : ''}
                      </em>
                    )}
                  </span>
                  <small>{haQuanto(m.at)}</small>
                </li>
              ))}
              {!movimento.length && (
                <li className="mov-vazio">Ainda nada aconteceu neste mundo.</li>
              )}
            </ol>
          </aside>
        </div>
      </div>
      {analise && <ProductAnalysisModal product={analise} onClose={() => setAnalise(undefined)} />}
    </>
  );
}
