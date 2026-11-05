import { useMemo, useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { patrimonioDe, porteDe } from '../empresa/resumo';
import type { Historico } from '../mercado/historico';
import {
  products,
  seasonProducts,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { HOUR_MS, gameDay, realToGame } from '../../../../../packages/simulation/src/clock';
import { Perfil, PERIODOS, SeloEmpresa, janelaDe, type Periodo } from './Perfil';
import { NumeroVivo, haQuanto, matizDaEmpresa } from './vivo';

type Filtro = 'tudo' | 'empresarios' | 'rivais';

interface Fato {
  id: string;
  at: number;
  quem: string;
  icone: NomeIcone;
  /** O texto só é escrito para as linhas que aparecem: formatar milhares de números trava a tela. */
  texto: () => string;
  produto?: ProductId;
  valor?: number;
  /** Assunto repetível: o vendedor de uma troca ou o tipo de ação de uma empresa. */
  assunto: string;
}

// O verbo curto de cada ação dos bots, com o ícone do assunto.
const ACOES: Record<string, { icone: NomeIcone; verbo: (p?: string) => string }> = {
  buyVehicle: { icone: 'caminhao', verbo: () => 'comprou um caminhão' },
  createPurchaseRequest: {
    icone: 'pedido',
    verbo: (p) => (p ? `procura ${p}` : 'publicou um pedido'),
  },
  proposeOrder: { icone: 'carta', verbo: (p) => (p ? `ofereceu ${p}` : 'fez uma proposta') },
  acceptProposal: {
    icone: 'trofeu',
    verbo: (p) => (p ? `fechou negócio de ${p}` : 'fechou negócio'),
  },
  bidInfrastructure: { icone: 'prefeitura', verbo: () => 'disputa uma obra pública' },
  trainWorkforce: { icone: 'equipe', verbo: () => 'treinou a equipe' },
};

const POR_PAGINA = 7;

/**
 * O que os outros empresários e as empresas automáticas estão fazendo: o placar, a maior compra do
 * dia e as movimentações, filtráveis por quem, produto e período. Cada empresa abre o seu perfil.
 */
export function Mural({ historico }: { historico: Historico }) {
  const { world, actor } = useGame();
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [produto, setProduto] = useState<ProductId | ''>('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [mais, setMais] = useState(false);
  const empresas = useMemo(
    () => new Map(world.companies.map((c) => [c.id, c])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision],
  );
  const nome = (id: string) => (id === actor ? 'Você' : (empresas.get(id)?.name ?? 'Empresa'));
  const humano = (id: string) => empresas.get(id)?.bot === false;

  const placar = useMemo(
    () =>
      world.companies
        .filter((c) => c.bot === false)
        .map((c) => ({
          c,
          patrimonio: patrimonioDe(world, c.id).netWorth,
          negocios: world.establishments.filter((e) => e.companyId === c.id).length,
        }))
        .sort((a, b) => b.patrimonio - a.patrimonio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision],
  );

  // As trocas só mudam quando chega histórico novo; as ações dos bots, a cada atualização do mundo.
  const trocas = useMemo(
    () =>
      Object.values(historico)
        .flatMap((h) => h?.trades ?? [])
        .map((t, i): Fato => ({
          id: `t-${t.at}-${t.from}-${t.to}-${t.product}-${i}`,
          at: t.at,
          quem: t.from,
          assunto: `vende-${t.to}`,
          icone: 'moeda',
          texto: () =>
            `comprou ${num(t.quantity)} ${unidade(t.product, t.quantity)} de ${nome(t.to)}`,
          produto: t.product,
          valor: t.quantity * t.unitPrice,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historico],
  );
  const fatos = useMemo(() => {
    const ids = seasonProducts(world);
    const doTexto = (t: string) => ids.find((id) => t.includes(products[id].name));
    const acoes: Fato[] = (world.botActivity ?? []).map((a, i) => {
      const produto = doTexto(a.text);
      const acao = ACOES[a.kind];
      return {
        id: `a-${a.at}-${a.companyId}-${i}`,
        at: a.at,
        quem: a.companyId,
        // A mesma ação sobre o mesmo produto, de empresas diferentes, conta como repetida.
        assunto: `${a.kind}-${produto ?? ''}`,
        icone: acao?.icone ?? 'estrela',
        texto: () =>
          acao
            ? acao.verbo(produto && products[produto].name.toLocaleLowerCase('pt-BR'))
            : a.text.charAt(0).toLowerCase() + a.text.slice(1),
        produto,
      };
    });
    return [...trocas, ...acoes].sort((a, b) => b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trocas, world.revision]);

  // Produtos que realmente aparecem nos fatos, para o filtro.
  const produtosNoMural = useMemo(
    () => [...new Set(fatos.map((f) => f.produto).filter(Boolean))] as ProductId[],
    [fatos],
  );
  const filtrando = filtro !== 'tudo' || produto !== '' || periodo !== 'dia';
  const desde = janelaDe(periodo, world.updatedAt, gameDay(world));
  const manchete = fatos
    .filter((f) => f.valor && f.at >= world.updatedAt - gameDay(world) && f.quem !== actor)
    .sort((a, b) => b.valor! - a.valor!)[0];

  // Sem filtro, compra miúda não é notícia e o mesmo vendedor aparece no máximo duas vezes.
  const todos: Fato[] = [];
  const porAssunto = new Map<string, number>();
  for (const f of fatos) {
    if (f.at < desde) continue;
    if (produto && f.produto !== produto) continue;
    if (filtro === 'empresarios' ? !humano(f.quem) : filtro === 'rivais' && humano(f.quem))
      continue;
    if (!filtrando) {
      if (f.id === manchete?.id || (f.valor !== undefined && f.valor < 500_000)) continue;
      const vezes = (porAssunto.get(f.assunto) ?? 0) + 1;
      porAssunto.set(f.assunto, vezes);
      if (vezes > 2) continue;
    }
    todos.push(f);
  }
  const lista = todos.slice(0, mais ? 25 : POR_PAGINA);
  const horas = (at: number) => realToGame(world, world.updatedAt - at) / HOUR_MS;

  return (
    <section className="mural" aria-labelledby="mural-titulo">
      <header className="ini-cabeca">
        <h2 id="mural-titulo" className="lv-grande">
          Mural
        </h2>
        <span className="lv-mao">quem está fazendo o quê</span>
      </header>

      <ol className="placar" aria-label="Placar dos empresários pelo patrimônio">
        {placar.map((p, i) => {
          const voce = p.c.id === actor;
          return (
            <li key={p.c.id} className={voce ? 'voce' : ''}>
              <span className="placar-pos">{i + 1}º</span>
              <button className="perfil-abre" onClick={() => setAberto(p.c.id)}>
                <SeloEmpresa id={p.c.id} nome={p.c.name} voce={voce} />
                <span className="placar-nome">
                  <b>{voce ? 'Você' : p.c.name}</b>
                  <small>
                    {porteDe(p.patrimonio).atual.nome} · {p.negocios}{' '}
                    {p.negocios === 1 ? 'negócio' : 'negócios'}
                  </small>
                </span>
              </button>
              <span className="placar-valor">
                <NumeroVivo
                  valor={p.patrimonio}
                  formato={(v) => cr(v, 0)}
                  id={`placar-${p.c.id}`}
                />
              </span>
            </li>
          );
        })}
      </ol>

      {manchete && (
        <article className="manchete" style={{ ['--h' as string]: matizDaEmpresa(manchete.quem) }}>
          <span className="lv-rotulo">Maior compra do dia</span>
          {manchete.produto && (
            <BotaoProduto product={manchete.produto} className="manchete-arte">
              <ProdutoArte product={manchete.produto} escala={2} />
            </BotaoProduto>
          )}
          <p>
            <button className="perfil-pessoa" onClick={() => setAberto(manchete.quem)}>
              {nome(manchete.quem)}
            </button>{' '}
            {manchete.texto()}
          </p>
          <span className="manchete-valor">{cr(manchete.valor!, 0)}</span>
          <small>{haQuanto(horas(manchete.at))}</small>
        </article>
      )}

      <div className="mural-filtros" role="radiogroup" aria-label="Quem aparece no mural">
        {(
          [
            ['tudo', 'Tudo'],
            ['empresarios', 'Empresários'],
            ['rivais', 'Empresas automáticas'],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            role="radio"
            aria-checked={filtro === id}
            className={filtro === id ? 'on' : ''}
            onClick={() => setFiltro(id)}
          >
            {rotulo}
          </button>
        ))}
      </div>
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
          <select value={produto} onChange={(ev) => setProduto(ev.target.value as ProductId | '')}>
            <option value="">Todos os produtos</option>
            {produtosNoMural.map((id) => (
              <option key={id} value={id}>
                {products[id].name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lista.length === 0 ? (
        <p className="mural-vazio">
          {filtrando
            ? 'Nada com esses filtros. Tente um período maior ou todos os produtos.'
            : 'Nada novo no mercado por enquanto.'}
        </p>
      ) : (
        <ul className="mural-lista">
          {lista.map((f) => (
            <li key={f.id} className={humano(f.quem) ? 'humano' : ''}>
              <button
                className="perfil-abre"
                onClick={() => setAberto(f.quem)}
                aria-label={`Ver o perfil de ${nome(f.quem)}`}
              >
                <SeloEmpresa id={f.quem} nome={nome(f.quem)} voce={f.quem === actor} />
              </button>
              <span className="mural-icone">
                <IconePixel nome={f.icone} tamanho={22} />
              </span>
              <p>
                <button className="perfil-pessoa" onClick={() => setAberto(f.quem)}>
                  {nome(f.quem)}
                </button>{' '}
                {f.texto()}
              </p>
              {f.produto && (
                <BotaoProduto product={f.produto} className="mural-produto">
                  <ProdutoArte product={f.produto} escala={1} />
                </BotaoProduto>
              )}
              <span className="mural-quando">
                {f.valor ? <b>{cr(f.valor, 0)}</b> : null}
                <small>{haQuanto(horas(f.at))}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
      {todos.length > POR_PAGINA && (
        <button
          className="ini-link mural-mais"
          onClick={() => setMais((v) => !v)}
          aria-expanded={mais}
        >
          {mais ? 'Mostrar menos' : `Ver mais ${Math.min(25, todos.length) - POR_PAGINA}`}
        </button>
      )}

      {aberto && (
        <Perfil
          key={aberto}
          empresaId={aberto}
          historico={historico}
          onAbrir={setAberto}
          onFechar={() => setAberto(null)}
        />
      )}
    </section>
  );
}
