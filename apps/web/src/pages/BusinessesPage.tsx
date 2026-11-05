import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading } from '../components/ui';
import { SecaoAbas } from '../components/SecaoAbas';
import { PixelArt } from '../components/PixelArt';
import { IconePixel } from '../components/IconePixel';
import { ProdutoArte } from '../features/economy/Vitrine';
import { unidade } from '../features/economy/Carga';
import { sugestoesDaCadeia } from '../features/business/cadeia';
import { categoryInfo, products } from '../../../../packages/simulation/src/model';
import { CadeiaBlocos, politicaCom } from '../features/business/CadeiaBlocos';
import { BusinessCard, urgenciaDe } from '../features/business/BusinessCards';
import { usePendencias } from '../features/inicio/pendencias';
import { comecoDoDia, useResumoDoCaixa } from '../features/inicio/tempo';
import '../design/negocios-novo.css';

/** Busca e filtro só aparecem a partir deste número de negócios: com poucos, atrapalham. */
const MUITOS = 8;

export function BusinessesPage() {
  const { world, actor, navigate, openBusiness, run, pending } = useGame();
  const [busca, setBusca] = useState(''),
    [tipo, setTipo] = useState('all');
  const sugestoes = useMemo(
    () => sugestoesDaCadeia(world, actor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const pendencias = usePendencias();
  const { vendasHoje, porNegocioHoje } = useResumoDoCaixa(comecoDoDia(world));
  const meus = world.establishments.filter((e) => e.companyId === actor);
  const pedidosEsperando = world.orders.filter(
    (o) => o.status === 'pending' && (o.buyerId === actor || o.sellerId === actor),
  ).length;

  const alertaDe = useMemo(() => {
    const m = new Map<string, (typeof pendencias)[number]>();
    for (const p of pendencias) if (p.negocioId && !m.has(p.negocioId)) m.set(p.negocioId, p);
    return m;
  }, [pendencias]);

  const ordenados = [...meus]
    .filter(
      (e) =>
        meus.length < MUITOS ||
        (e.name.toLowerCase().includes(busca.toLowerCase()) &&
          (tipo === 'all' || e.category === tipo)),
    )
    .sort(
      (a, b) =>
        urgenciaDe(a, alertaDe.get(a.id)) - urgenciaDe(b, alertaDe.get(b.id)) ||
        (porNegocioHoje.get(b.id) ?? 0) - (porNegocioHoje.get(a.id) ?? 0),
    );
  const tipos = [...new Set(meus.map((e) => e.category))];
  const precisam = meus.filter(
    (e) => alertaDe.has(e.id) || !e.enabled || e.installed === false || e.mothballed,
  ).length;
  // A conta da empresa: o que entrou menos o que saiu em cada negócio, desde a abertura.
  const resultados = meus
    .filter((e) => e.installed !== false)
    .map((e) => ({ e, valor: e.revenue - e.expenses }));
  const total = resultados.reduce((n, x) => n + x.valor, 0);
  const custoDia = meus.reduce((n, e) => n + e.dailyCost, 0);
  const melhor = [...resultados].sort((a, b) => b.valor - a.valor)[0];
  const pior = [...resultados].sort((a, b) => a.valor - b.valor)[0];
  const recado =
    resultados.length === 0
      ? ''
      : total >= 0
        ? pior && pior.valor < 0
          ? `${melhor.e.name} segura as contas`
          : 'todos se pagam!'
        : melhor && melhor.valor > 0
          ? `${pior.e.name} come o que ${melhor.e.name} ganha`
          : 'ainda no vermelho...';

  return (
    <>
      <SecaoAbas secao="negocios" />
      <PageHeading
        title="Meus negócios"
        description="Cada cartão é um negócio seu. O que precisa de você aparece primeiro."
      />
      <div className="page-body neg-pagina">
        {meus.length > 0 && (
          <section className="ng-conta" aria-label="A conta da empresa">
            <article className="lv-nota ng-nota">
              <span className="lv-etiqueta lv-rotulo">Resultado dos negócios</span>
              <b className={`lv-numero ng-total ${total >= 0 ? 'pos' : 'neg'}`}>
                {total >= 0 ? '+' : '−'}
                {cr(Math.abs(total), 0)}
              </b>
              {recado && <p className="lv-mao ng-recado">{recado}</p>}
              <p>
                Dinheiro que entrou menos o que saiu, desde a abertura de cada negócio. Estoque
                parado ainda não conta: só vira dinheiro quando vende.
              </p>
            </article>
            <dl className="ng-conta-lado">
              <div>
                <dt>Custam por dia</dt>
                <dd>{cr(custoDia, 0)}</dd>
              </div>
              <div>
                <dt>Vendido hoje</dt>
                <dd>{cr(vendasHoje, 0)}</dd>
              </div>
              <div className={precisam ? 'atencao' : ''}>
                <dt>Precisam de você</dt>
                <dd>{precisam ? `${num(precisam)} de ${num(meus.length)}` : 'nenhum'}</dd>
              </div>
            </dl>
          </section>
        )}

        {sugestoes.length > 0 && (
          <section className="ng-cadeia" aria-labelledby="ng-cadeia-titulo">
            <h2 id="ng-cadeia-titulo" className="lv-grande">
              Entre seus negócios
            </h2>
            <ul>
              {sugestoes.map((x) => (
                <li key={x.id} className={`ng-sugestao ${x.tipo}`}>
                  <span className="ng-sugestao-arte">
                    <ProdutoArte product={x.produto} escala={1} />
                  </span>
                  <span className="ng-sugestao-texto">
                    {x.tipo === 'abastecer' ? (
                      <>
                        <b>
                          Levar {products[x.produto].name} de {x.origem.name} para {x.destino!.name}
                        </b>
                        <small>
                          {x.origem.name} tem {num(x.quantidade)} {unidade(x.produto, x.quantidade)}{' '}
                          sem destino; {x.destino!.name} usa {products[x.produto].name} e hoje
                          compra de outras empresas, pagando mercadoria e frete.
                        </small>
                      </>
                    ) : (
                      <>
                        <b>
                          {x.origem.name} tem {num(x.quantidade)} {unidade(x.produto, x.quantidade)}{' '}
                          de {products[x.produto].name} sem comprador
                        </b>
                        <small>
                          Nenhum negócio seu usa e não há oferta, então ninguém pode comprar. Isso
                          vale cerca de {cr(x.valor, 0)} na referência: anuncie para virar dinheiro.
                        </small>
                      </>
                    )}
                  </span>
                  {x.tipo === 'abastecer' ? (
                    <button
                      className="primary"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          {
                            type: 'configureSupply',
                            establishmentId: x.destino!.id,
                            policy: politicaCom(world, x.destino!, x.produto, x.origem.id),
                          },
                          `${x.origem.name} agora abastece ${x.destino!.name} com ${products[x.produto].name}.`,
                        )
                      }
                    >
                      Ligar os dois
                    </button>
                  ) : (
                    <button className="primary" onClick={() => openBusiness(x.origem.id, 'Vendas')}>
                      Pôr à venda
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {meus.length >= MUITOS && (
          <div className="neg-filtros">
            <label className="neg-busca">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Buscar negócio"
                placeholder="Buscar pelo nome"
                value={busca}
                onChange={(ev) => setBusca(ev.target.value)}
              />
            </label>
            <div className="neg-chips" role="group" aria-label="Tipo de negócio">
              <button
                type="button"
                aria-pressed={tipo === 'all'}
                className={tipo === 'all' ? 'on' : ''}
                onClick={() => setTipo('all')}
              >
                Todos
              </button>
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tipo === t}
                  className={tipo === t ? 'on' : ''}
                  onClick={() => setTipo(t)}
                >
                  {categoryInfo[t].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <ul className="neg-grade">
          {ordenados.map((e) => (
            <li key={e.id}>
              <BusinessCard
                e={e}
                vendasHoje={porNegocioHoje.get(e.id) ?? 0}
                alerta={alertaDe.get(e.id)}
              />
            </li>
          ))}
          <li>
            <button type="button" className="neg-novo" onClick={() => navigate('map')}>
              {meus.length === 0 ? (
                <PixelArt name="loja" scale={2} />
              ) : (
                <Plus size={40} aria-hidden="true" />
              )}
              <strong>
                {meus.length === 0 ? 'Abra o seu primeiro negócio' : 'Abrir um negócio'}
              </strong>
              <small>Escolha um imóvel no mapa</small>
            </button>
          </li>
        </ul>
        {!ordenados.length && meus.length > 0 && (
          <p className="neg-vazio-mini">Nenhum negócio com esse nome ou tipo.</p>
        )}

        <CadeiaBlocos />

        {pedidosEsperando > 0 && (
          <section className="neg-pedidos" aria-label="Pedidos">
            <IconePixel nome="pedido" tamanho={40} />
            <p>
              <b>
                {pedidosEsperando} {pedidosEsperando === 1 ? 'pedido espera' : 'pedidos esperam'}
              </b>{' '}
              uma resposta.
            </p>
            <button type="button" className="secondary" onClick={() => navigate('orders')}>
              Ver pedidos
            </button>
          </section>
        )}
      </div>
    </>
  );
}
