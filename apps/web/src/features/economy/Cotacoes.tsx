import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { PageHeading } from '../../components/ui';
import { SecaoAbas } from '../../components/SecaoAbas';
import { IconePixel } from '../../components/IconePixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { matizDoProduto } from '../../design/arte';
import { Faisca } from '../mercado/Faisca';
import { ProdutoArte } from './Vitrine';
import { unidade } from './Carga';
import { BusinessIdeas, useNegocios } from './BusinessIdeas';
import {
  products,
  seasonProducts,
  TIME_SCALE,
  type MarketSample,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { GAME_DAY } from '../../../../../packages/simulation/src/operations';
import '../../design/cotacoes.css';

interface Negocio {
  at: number;
  from: string;
  to: string;
  product: ProductId;
  quantity: number;
  unitPrice: number;
}
type Historico = Partial<Record<ProductId, { samples: MarketSample[]; trades: Negocio[] }>>;

/** Histórico nacional de todos os produtos, pelo mesmo endereço que a ficha do produto usa. */
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

export function CotacoesPage() {
  const { world, openMarket, navigate } = useGame();
  const ids = seasonProducts(world);
  const historico = useHistorico(ids);
  const negocios = useNegocios();
  const [grupo, setGrupo] = useState('');
  const nome = (id: string) => world.companies.find((c) => c.id === id)?.name ?? 'Empresa';

  const linhas = ids.map((id) => {
    const amostras = (historico[id]?.samples ?? []).filter((s) => s.price !== null);
    const ultima = amostras[amostras.length - 1];
    const ofertas = world.offers.filter((o) => {
      const e = world.establishments.find((x) => x.id === o.establishmentId);
      return o.product === id && e?.enabled && (e.inventory[id] ?? 0) > 0;
    });
    const menor = ofertas.reduce<number | undefined>(
      (n, o) => (n === undefined || o.price < n ? o.price : n),
      undefined,
    );
    const preco = ultima?.price ?? menor;
    const umDia = amostras.filter((s) => s.at <= world.updatedAt - GAME_DAY).pop();
    const variacao = preco && umDia?.price ? preco / umDia.price - 1 : 0;
    const estoque = ofertas.reduce((n, o) => {
      const e = world.establishments.find((x) => x.id === o.establishmentId);
      return n + (e?.inventory[id] ?? 0);
    }, 0);
    return {
      id,
      preco,
      variacao,
      temComparacao: Boolean(preco && umDia?.price),
      referencia: seasonPrice(world, id),
      estoque,
      vendedores: ofertas.length,
      faisca: amostras.slice(-40).map((s) => s.price!),
      ideia: negocios.itens.find((i) => i.saidas.includes(id)),
    };
  });
  const grupos = [...new Set(ids.map((id) => products[id].category))];
  const visiveis = linhas.filter((l) => !grupo || products[l.id].category === grupo);

  // Movimento: negócios entre empresas e ações dos bots, do mais recente para trás.
  const movimento = useMemo(() => {
    const trocas = Object.values(historico)
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
    return [...trocas, ...acoes].sort((a, b) => b.at - a.at).slice(0, 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, world.revision]);

  const faltando = linhas.filter((l) => l.vendedores === 0).length;
  const maisAlta = [...linhas].filter((l) => l.preco).sort((a, b) => b.variacao - a.variacao)[0];
  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Cotações"
        description="O preço de tudo o que se negocia agora, como ele andou e o que as outras empresas estão fazendo."
      />
      <div className="page-body cotacoes">
        <div className="cot-resumo">
          <div className="cot-fato">
            <IconePixel nome="grafico" tamanho={40} />
            <span>
              <b>{ids.length - faltando}</b>
              <small>produtos com quem venda</small>
            </span>
          </div>
          <div className={`cot-fato ${faltando ? 'alerta' : ''}`}>
            <IconePixel nome="alerta" tamanho={40} />
            <span>
              <b>{faltando}</b>
              <small>
                {faltando === 1 ? 'esgotado em todo o mercado' : 'esgotados em todo o mercado'}
              </small>
            </span>
          </div>
          {maisAlta && maisAlta.variacao > 0.005 && (
            <div className="cot-fato">
              <IconePixel nome="moeda" tamanho={40} />
              <span>
                <b>
                  {products[maisAlta.id].name.split(' ')[0]} +{num(maisAlta.variacao * 100)}%
                </b>
                <small>maior alta em um dia de jogo</small>
              </span>
            </div>
          )}
        </div>

        <div className="cot-grupos" role="radiogroup" aria-label="Categoria">
          {['', ...grupos].map((g) => (
            <button
              key={g || 'todos'}
              role="radio"
              aria-checked={grupo === g}
              className={grupo === g ? 'on' : ''}
              onClick={() => setGrupo(g)}
            >
              {g || 'Tudo'}
            </button>
          ))}
        </div>

        <div className="cot-layout">
          <ul className="cot-quadro" aria-label="Quadro de cotações">
            {visiveis.map((l) => {
              const u = products[l.id].unit;
              const ref = l.preco ? l.preco / l.referencia - 1 : 0;
              const sobe = l.variacao > 0.005;
              const desce = l.variacao < -0.005;
              return (
                <li key={l.id}>
                  <article
                    className={`cot-card ${l.vendedores ? '' : 'esgotado'}`}
                    style={{ ['--h' as string]: matizDoProduto(l.id) }}
                  >
                    <header className="cot-topo">
                      <BotaoProduto product={l.id} className="cot-arte">
                        <ProdutoArte product={l.id} escala={2} />
                      </BotaoProduto>
                      <div className="cot-ident">
                        <h3>
                          <BotaoProduto product={l.id}>{products[l.id].name}</BotaoProduto>
                        </h3>
                        <small>{products[l.id].category}</small>
                        {l.vendedores === 0 && (
                          <span className="cot-estado tom-brasa">Esgotado no mercado</span>
                        )}
                      </div>
                    </header>
                    <div className="cot-corpo">
                      <div className="cot-preco">
                        <b>{l.preco ? cr(l.preco) : '—'}</b>
                        <span>por {unidade(l.id, 1)}</span>
                        <span className={`cot-var ${sobe ? 'sobe' : desce ? 'desce' : ''}`}>
                          {sobe ? (
                            <ArrowUpRight size={16} aria-hidden="true" />
                          ) : desce ? (
                            <ArrowDownRight size={16} aria-hidden="true" />
                          ) : (
                            <Minus size={16} aria-hidden="true" />
                          )}
                          {l.temComparacao
                            ? `${sobe ? 'Subiu' : desce ? 'Caiu' : 'Estável'} ${num(Math.abs(l.variacao) * 100, 1)}%`
                            : 'Sem histórico de um dia'}
                        </span>
                      </div>
                      <Faisca valores={l.faisca} sobe={l.variacao >= 0} />
                      <ul className="cot-fatos">
                        <li>
                          <IconePixel nome="caixa" tamanho={22} />
                          {l.vendedores ? (
                            <span>
                              <b>
                                {num(l.estoque)} {u}
                              </b>{' '}
                              à venda por {l.vendedores}{' '}
                              {l.vendedores === 1 ? 'empresa' : 'empresas'}
                            </span>
                          ) : (
                            <span>Ninguém vende agora</span>
                          )}
                        </li>
                        <li>
                          <IconePixel nome="justo" tamanho={22} />
                          <span>
                            {!l.preco
                              ? 'Sem preço observado'
                              : Math.abs(ref) < 0.03
                                ? 'No preço justo'
                                : `${num(Math.abs(ref) * 100)}% ${ref > 0 ? 'acima' : 'abaixo'} do preço justo`}
                          </span>
                        </li>
                      </ul>
                      {l.vendedores === 0 && l.ideia ? (
                        <button
                          className="primary cot-acao"
                          onClick={() => navigate('opportunities')}
                        >
                          <IconePixel nome="fabrica" tamanho={24} /> Falta no mercado: abrir negócio
                        </button>
                      ) : (
                        <button
                          className="secondary cot-acao"
                          disabled={!l.vendedores}
                          onClick={() => openMarket({ product: l.id })}
                        >
                          <IconePixel nome="caminhao" tamanho={24} /> Comprar
                        </button>
                      )}
                      {l.vendedores === 0 && l.ideia && (
                        <small className="cot-ideia">
                          Rende {cr(l.ideia.line.profit, 0)} por dia e se paga em{' '}
                          {num(l.ideia.retorno)} dias.
                        </small>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          <aside className="cot-movimento" aria-label="Movimento do mercado">
            <h2>Movimento do mercado</h2>
            <p>O que as outras empresas acabaram de fazer.</p>
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

        {negocios.itens.some((i) => i.falta) && (
          <section className="cot-ideias" aria-labelledby="cot-ideias">
            <div className="cot-ideias-titulo">
              <h2 id="cot-ideias">Onde falta, dá para ganhar</h2>
              <button className="text-button" onClick={() => navigate('opportunities')}>
                Ver todos os negócios para abrir
              </button>
            </div>
            <BusinessIdeas limite={3} filtro="falta" />
          </section>
        )}
      </div>
    </>
  );
}
