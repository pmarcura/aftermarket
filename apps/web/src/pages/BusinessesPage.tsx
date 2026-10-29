import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading } from '../components/ui';
import { SecaoAbas } from '../components/SecaoAbas';
import { PixelArt } from '../components/PixelArt';
import { IconePixel } from '../components/IconePixel';
import { BarrasPixel } from '../components/BarrasPixel';
import { categoryInfo } from '../../../../packages/simulation/src/model';
import { SupplyNetwork } from '../features/business/SupplyNetwork';
import { BusinessCard, urgenciaDe } from '../features/business/BusinessCards';
import { usePendencias } from '../features/inicio/pendencias';
import { comecoDoDia, useResumoDoCaixa } from '../features/inicio/tempo';
import '../design/negocios-novo.css';

/** Busca e filtro só aparecem a partir deste número de negócios: com poucos, atrapalham. */
const MUITOS = 8;

export function BusinessesPage() {
  const { world, actor, navigate } = useGame();
  const [busca, setBusca] = useState(''),
    [tipo, setTipo] = useState('all');
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
  const rank = [...meus]
    .map((e) => ({ rotulo: e.name, valor: porNegocioHoje.get(e.id) ?? 0, tom: 'ouro' as const }))
    .filter((i) => i.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  return (
    <>
      <SecaoAbas secao="negocios" />
      <PageHeading
        title="Meus negócios"
        description="Cada cartão é um negócio seu. O que precisa de você aparece primeiro."
      />
      <div className="page-body neg-pagina">
        {meus.length > 0 && (
          <section className="neg-faixa" aria-label="Resumo">
            <div>
              <IconePixel nome="predio" tamanho={32} />
              <b>{num(meus.length)}</b>
              <span>{meus.length === 1 ? 'negócio' : 'negócios'}</span>
            </div>
            <div>
              <IconePixel nome="moeda" tamanho={32} />
              <b>{cr(vendasHoje, 0)}</b>
              <span>vendidos hoje</span>
            </div>
            <div className={precisam ? 'atencao' : ''}>
              <IconePixel nome={precisam ? 'alerta' : 'estrela'} tamanho={32} />
              <b>{num(precisam)}</b>
              <span>
                {precisam
                  ? precisam === 1
                    ? 'precisa de você'
                    : 'precisam de você'
                  : 'tudo em dia'}
              </span>
            </div>
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

        {rank.length > 1 && (
          <section className="neg-bloco" aria-labelledby="neg-rank">
            <header className="neg-bloco-cab">
              <h2 id="neg-rank">Quem vendeu mais hoje</h2>
            </header>
            <BarrasPixel
              titulo="Vendas de hoje por negócio"
              itens={rank}
              formato={(v) => cr(v, 0)}
            />
          </section>
        )}

        <SupplyNetwork />

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
