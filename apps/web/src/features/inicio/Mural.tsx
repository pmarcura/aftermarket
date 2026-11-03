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
import { NumeroVivo, haQuanto, iniciais, matizDaEmpresa } from './vivo';

type Filtro = 'tudo' | 'empresarios' | 'rivais';

interface Fato {
  id: string;
  at: number;
  quem: string;
  icone: NomeIcone;
  texto: string;
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

function Selo({ id, nome, voce = false }: { id: string; nome: string; voce?: boolean }) {
  return (
    <span
      className={`selo-empresa ${voce ? 'voce' : ''}`}
      style={{ ['--h' as string]: matizDaEmpresa(id) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}

/**
 * O que os outros empresários e as empresas automáticas estão fazendo: o placar dos jogadores,
 * a maior compra do dia como manchete e as últimas movimentações, com pouco texto.
 */
export function Mural({ historico }: { historico: Historico }) {
  const { world, actor } = useGame();
  const [filtro, setFiltro] = useState<Filtro>('tudo');
  const empresas = useMemo(
    () => new Map(world.companies.map((c) => [c.id, c])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision],
  );
  const nome = (id: string) => empresas.get(id)?.name ?? 'Empresa';
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

  const fatos = useMemo(() => {
    const ids = seasonProducts(world);
    const doTexto = (t: string) => ids.find((id) => t.includes(products[id].name));
    const trocas: Fato[] = Object.values(historico)
      .flatMap((h) => h?.trades ?? [])
      // Compra miúda não é notícia: só negócios de R$ 5 mil para cima.
      .filter((t) => t.from !== actor && t.to !== actor && t.quantity * t.unitPrice >= 500_000)
      .map((t, i) => ({
        id: `t-${t.at}-${t.from}-${t.to}-${t.product}-${i}`,
        at: t.at,
        quem: t.from,
        assunto: `vende-${t.to}`,
        icone: 'moeda' as const,
        texto: `comprou ${num(t.quantity)} ${unidade(t.product, t.quantity)} de ${nome(t.to)}`,
        produto: t.product,
        valor: t.quantity * t.unitPrice,
      }));
    const acoes: Fato[] = (world.botActivity ?? []).map((a, i) => {
      const produto = doTexto(a.text);
      const acao = ACOES[a.kind];
      return {
        id: `a-${a.at}-${a.companyId}-${i}`,
        at: a.at,
        quem: a.companyId,
        assunto: `${a.kind}-${a.companyId}`,
        icone: acao?.icone ?? 'estrela',
        texto: acao
          ? acao.verbo(produto && products[produto].name.toLocaleLowerCase('pt-BR'))
          : a.text.charAt(0).toLowerCase() + a.text.slice(1),
        produto,
      };
    });
    return [...trocas, ...acoes].sort((a, b) => b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico, world.revision, actor]);

  const umDia = world.updatedAt - gameDay(world);
  const manchete = fatos
    .filter((f) => f.valor && f.at >= umDia)
    .sort((a, b) => b.valor! - a.valor!)[0];
  // Um mesmo vendedor ou a mesma ação repetida aparece no máximo duas vezes.
  const porAssunto = new Map<string, number>();
  const lista: Fato[] = [];
  for (const f of fatos) {
    if (lista.length >= 7) break;
    if (f.id === manchete?.id) continue;
    if (filtro === 'empresarios' ? !humano(f.quem) : filtro === 'rivais' && humano(f.quem))
      continue;
    const vezes = (porAssunto.get(f.assunto) ?? 0) + 1;
    porAssunto.set(f.assunto, vezes);
    if (vezes <= 2) lista.push(f);
  }
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
              <Selo id={p.c.id} nome={p.c.name} voce={voce} />
              <span className="placar-nome">
                <b>{voce ? 'Você' : p.c.name}</b>
                <small>
                  {porteDe(p.patrimonio).atual.nome} · {p.negocios}{' '}
                  {p.negocios === 1 ? 'negócio' : 'negócios'}
                </small>
              </span>
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
            <b>{nome(manchete.quem)}</b> {manchete.texto}
          </p>
          <span className="manchete-valor">{cr(manchete.valor!, 0)}</span>
          <small>{haQuanto(horas(manchete.at))}</small>
        </article>
      )}

      <div className="mural-filtros" role="radiogroup" aria-label="Mostrar no mural">
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

      {lista.length === 0 ? (
        <p className="mural-vazio">
          {filtro === 'empresarios'
            ? 'Os outros empresários ainda não fecharam negócio hoje.'
            : 'Nada novo no mercado por enquanto.'}
        </p>
      ) : (
        <ul className="mural-lista">
          {lista.map((f) => (
            <li key={f.id} className={humano(f.quem) ? 'humano' : ''}>
              <Selo id={f.quem} nome={nome(f.quem)} />
              <span className="mural-icone">
                <IconePixel nome={f.icone} tamanho={22} />
              </span>
              <p>
                <b>{nome(f.quem)}</b> {f.texto}
              </p>
              {f.produto && (
                <span className="mural-produto">
                  <ProdutoArte product={f.produto} escala={1} />
                </span>
              )}
              <span className="mural-quando">
                {f.valor ? <b>{cr(f.valor, 0)}</b> : null}
                <small>{haQuanto(horas(f.at))}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
