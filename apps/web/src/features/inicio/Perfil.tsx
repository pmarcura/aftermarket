import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { IconePixel } from '../../components/IconePixel';
import { PixelArt } from '../../components/PixelArt';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { spriteDaCategoria } from '../economy/BusinessIdeas';
import { patrimonioDe, porteDe } from '../empresa/resumo';
import type { Historico } from '../mercado/historico';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  type Category,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { HOUR_MS, gameDay, realToGame } from '../../../../../packages/simulation/src/clock';
import { Ficha } from './pecas';
import { NumeroVivo, haQuanto, iniciais, matizDaEmpresa } from './vivo';

export type Periodo = 'dia' | 'semana' | 'tudo';
export const PERIODOS: [Periodo, string][] = [
  ['dia', '1 dia'],
  ['semana', '7 dias'],
  ['tudo', 'Tudo'],
];

const CATEGORIAS: Record<Category, string> = {
  retail: 'Comércio',
  farm: 'Lavoura',
  industry: 'Indústria',
  mine: 'Mineração',
  warehouse: 'Armazém',
  logistics: 'Logística',
};

/** Selo redondo da empresa, com a cor dela em todo o jogo. */
export function SeloEmpresa({
  id,
  nome,
  voce = false,
  grande = false,
}: {
  id: string;
  nome: string;
  voce?: boolean;
  grande?: boolean;
}) {
  return (
    <span
      className={`selo-empresa ${voce ? 'voce' : ''} ${grande ? 'grande' : ''}`}
      style={{ ['--h' as string]: matizDaEmpresa(id) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

/** Janela de tempo em milissegundos reais, pelo relógio deste mundo. */
export function janelaDe(periodo: Periodo, agora: number, dia: number) {
  return periodo === 'dia' ? agora - dia : periodo === 'semana' ? agora - 7 * dia : 0;
}

/**
 * Perfil de uma empresa: quem é, o que tem aberto e o que comprou e vendeu, com filtro por tempo
 * e por produto. O dinheiro em caixa não aparece: só o patrimônio, que é público no placar.
 */
export function Perfil({
  empresaId,
  historico,
  onAbrir,
  onFechar,
}: {
  empresaId: string;
  historico: Historico;
  onAbrir: (id: string) => void;
  onFechar: () => void;
}) {
  const { world, actor, focusMap } = useGame();
  const janela = useRef<HTMLDialogElement>(null);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [produto, setProduto] = useState<ProductId | ''>('');
  const empresa = world.companies.find((c) => c.id === empresaId);
  const nome = (id: string) =>
    id === actor ? 'Você' : (world.companies.find((c) => c.id === id)?.name ?? 'Empresa');

  useEffect(() => {
    const d = janela.current;
    if (d && !d.open) d.showModal();
  }, []);

  const patrimonio = useMemo(
    () => patrimonioDe(world, empresaId).netWorth,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, empresaId],
  );
  const negocios = world.establishments.filter((e) => e.companyId === empresaId);
  const desde = janelaDe(periodo, world.updatedAt, gameDay(world));
  const transacoes = useMemo(
    () =>
      Object.values(historico)
        .flatMap((h) => h?.trades ?? [])
        .filter((t) => (t.from === empresaId || t.to === empresaId) && t.at >= desde)
        .filter((t) => !produto || t.product === produto)
        .sort((a, b) => b.at - a.at),
    [historico, empresaId, desde, produto],
  );
  const compras = transacoes.filter((t) => t.from === empresaId);
  const vendas = transacoes.filter((t) => t.to === empresaId);
  const soma = (l: typeof transacoes) => l.reduce((n, t) => n + t.quantity * t.unitPrice, 0);
  const porProduto = useMemo(() => {
    const m = new Map<ProductId, number>();
    for (const t of transacoes)
      m.set(t.product, (m.get(t.product) ?? 0) + t.quantity * t.unitPrice);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transacoes]);
  const maior = porProduto[0]?.[1] ?? 1;
  const produtosDaEmpresa = useMemo(() => {
    const ids = new Set<ProductId>();
    for (const h of Object.values(historico))
      for (const t of h?.trades ?? [])
        if (t.from === empresaId || t.to === empresaId) ids.add(t.product);
    return [...ids];
  }, [historico, empresaId]);
  const atividades = (world.botActivity ?? []).filter((a) => a.companyId === empresaId).slice(0, 4);
  const horas = (at: number) => realToGame(world, world.updatedAt - at) / HOUR_MS;
  if (!empresa) return null;
  const humano = empresa.bot === false;
  const porte = porteDe(patrimonio);

  return (
    <dialog
      ref={janela}
      className="perfil"
      aria-labelledby="perfil-titulo"
      onClose={onFechar}
      onClick={(ev) => ev.target === janela.current && janela.current?.close()}
    >
      <div className="perfil-corpo">
        <header className="perfil-cab" style={{ ['--h' as string]: matizDaEmpresa(empresaId) }}>
          <SeloEmpresa id={empresaId} nome={empresa.name} voce={empresaId === actor} grande />
          <div>
            <span className="lv-rotulo">
              {empresaId === actor ? 'Sua empresa' : humano ? 'Empresário' : 'Empresa automática'}
            </span>
            <h2 id="perfil-titulo" className="lv-grande">
              {empresa.name}
            </h2>
          </div>
          <button
            className="perfil-fechar"
            onClick={() => janela.current?.close()}
            aria-label="Fechar perfil"
          >
            <X size={22} strokeWidth={3} aria-hidden="true" />
          </button>
        </header>

        <div className="perfil-fichas">
          <Ficha
            rotulo="Patrimônio"
            icone="moeda"
            tom="ouro"
            valor={<NumeroVivo valor={patrimonio} formato={(v) => cr(v, 0)} />}
          />
          <Ficha rotulo="Porte" icone="trofeu" valor={porte.atual.nome} />
          <Ficha rotulo="Negócios" icone="predio" valor={String(negocios.length)} />
        </div>

        <section aria-labelledby="perfil-negocios">
          <h3 id="perfil-negocios" className="lv-rotulo">
            O que tem aberto
          </h3>
          {negocios.length === 0 ? (
            <p className="perfil-vazio">Ainda não abriu nenhum negócio.</p>
          ) : (
            <ul className="perfil-negocios">
              {negocios.map((e) => {
                const p = world.properties.find((x) => x.id === e.propertyId);
                return (
                  <li key={e.id}>
                    <PixelArt name={spriteDaCategoria[e.category]} scale={1} />
                    <span>
                      <b>{e.name}</b>
                      <small>
                        {CATEGORIAS[e.category]}
                        {p ? ` · ${p.city}` : ''}
                      </small>
                    </span>
                    {p && (
                      <button
                        className="ini-link"
                        onClick={() => {
                          janela.current?.close();
                          focusMap(p.coordinates, p.id);
                        }}
                      >
                        No mapa
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="perfil-trocas">
          <h3 id="perfil-trocas" className="lv-rotulo">
            Compras e vendas
          </h3>
          <div className="mural-filtros" role="radiogroup" aria-label="Período">
            {PERIODOS.map(([id, rotulo]) => (
              <button
                key={id}
                role="radio"
                aria-checked={periodo === id}
                className={periodo === id ? 'on' : ''}
                onClick={() => setPeriodo(id)}
              >
                {rotulo}
              </button>
            ))}
            <label className="mural-produto-filtro">
              <span className="sr-only">Produto</span>
              <select
                value={produto}
                onChange={(ev) => setProduto(ev.target.value as ProductId | '')}
              >
                <option value="">Todos os produtos</option>
                {produtosDaEmpresa.map((id) => (
                  <option key={id} value={id}>
                    {products[id].name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="perfil-fichas">
            <Ficha rotulo="Comprou" tom="brasa" valor={cr(soma(compras), 0)} />
            <Ficha rotulo="Vendeu" tom="lavoura" valor={cr(soma(vendas), 0)} />
            <Ficha rotulo="Negócios" valor={String(transacoes.length)} />
          </div>
          {porProduto.length > 0 && (
            <ul className="perfil-barras" aria-label="Produtos mais negociados">
              {porProduto.map(([id, valor]) => (
                <li key={id} style={{ ['--h' as string]: matizDoProduto(id) }}>
                  <span className="perfil-barra-arte">
                    <ProdutoArte product={id} escala={1} />
                  </span>
                  <span className="perfil-barra-nome">{products[id].name}</span>
                  <span className="perfil-barra-trilho">
                    <i style={{ width: `${(valor / maior) * 100}%` }} />
                  </span>
                  <b>{cr(valor, 0)}</b>
                </li>
              ))}
            </ul>
          )}
          {transacoes.length === 0 ? (
            <p className="perfil-vazio">Nenhuma compra ou venda neste período.</p>
          ) : (
            <ul className="perfil-trocas">
              {transacoes.slice(0, 30).map((t, i) => {
                const comprou = t.from === empresaId;
                const outro = comprou ? t.to : t.from;
                return (
                  <li
                    key={`${t.at}-${t.from}-${t.to}-${t.product}-${i}`}
                    className={comprou ? 'compra' : 'venda'}
                  >
                    <span className="perfil-sentido">{comprou ? 'Comprou' : 'Vendeu'}</span>
                    <span className="mural-produto">
                      <ProdutoArte product={t.product} escala={1} />
                    </span>
                    <p>
                      <b>
                        {num(t.quantity)} {unidade(t.product, t.quantity)}
                      </b>{' '}
                      de {products[t.product].name} {comprou ? 'de' : 'para'}{' '}
                      <button className="perfil-pessoa" onClick={() => onAbrir(outro)}>
                        {nome(outro)}
                      </button>
                    </p>
                    <span className="mural-quando">
                      <b>{cr(t.quantity * t.unitPrice, 0)}</b>
                      <small>{haQuanto(horas(t.at))}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {atividades.length > 0 && (
          <section aria-labelledby="perfil-atividade">
            <h3 id="perfil-atividade" className="lv-rotulo">
              Últimas decisões
            </h3>
            <ul className="perfil-atividade">
              {atividades.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <IconePixel nome="estrela" tamanho={18} />
                  <span>{a.text}</span>
                  <small>{haQuanto(horas(a.at))}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </dialog>
  );
}
