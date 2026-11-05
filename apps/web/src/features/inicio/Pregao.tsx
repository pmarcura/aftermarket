import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { BotaoProduto } from '../../components/BotaoProduto';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { Faisca } from '../mercado/Faisca';
import { cotacaoDe, type Historico } from '../mercado/historico';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  seasonProducts,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import { NumeroVivo } from './vivo';

const QUANTOS = 8;

/**
 * Produtos que importam para esta empresa: primeiro o que ela tem em estoque ou usa como insumo,
 * depois os mais negociados do país na última rodada.
 */
export function produtosDoPregao(world: World, empresa: string): { id: ProductId; seu: boolean }[] {
  const temporada = new Set(seasonProducts(world));
  const seus = new Set<ProductId>();
  for (const e of world.establishments) {
    if (e.companyId !== empresa) continue;
    for (const id of Object.keys(e.inventory) as ProductId[]) if (temporada.has(id)) seus.add(id);
    const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
    for (const id of Object.keys(receita?.input ?? {}) as ProductId[])
      if (temporada.has(id)) seus.add(id);
  }
  const negociado = new Map<ProductId, number>();
  for (const s of world.marketHistory)
    if (s.regionId === '' && temporada.has(s.product))
      negociado.set(s.product, Math.max(negociado.get(s.product) ?? 0, s.tradedValue));
  const outros = [...temporada]
    .filter((id) => !seus.has(id))
    .sort((a, b) => (negociado.get(b) ?? 0) - (negociado.get(a) ?? 0));
  // No máximo 6 produtos próprios: sobram vagas para o que mais se negocia no país.
  return [
    ...[...seus].slice(0, 6).map((id) => ({ id, seu: true })),
    ...outros.map((id) => ({ id, seu: false })),
  ].slice(0, QUANTOS);
}

function Variacao({
  v,
  tem,
  dia,
  carregando,
}: {
  v: number;
  tem: boolean;
  dia: boolean;
  carregando: boolean;
}) {
  if (carregando) return <span className="preg-var carregando">…</span>;
  if (!tem) return <span className="preg-var novo">novo</span>;
  const sobe = v > 0.0005;
  const desce = v < -0.0005;
  const Seta = sobe ? ArrowUpRight : desce ? ArrowDownRight : Minus;
  return (
    <span
      className={`preg-var ${sobe ? 'sobe' : desce ? 'desce' : ''}`}
      title={dia ? 'Contra um dia de jogo atrás' : 'Desde a primeira cotação do mundo'}
    >
      <Seta size={15} strokeWidth={3} aria-hidden="true" />
      {sobe ? '+' : desce ? '−' : ''}
      {num(Math.abs(v) * 100, 1)}%
    </span>
  );
}

/** Quadro de cotações ao vivo: preço nacional, variação do dia e o caminho do preço. */
export function Pregao({
  historico,
  itens,
}: {
  historico: Historico;
  itens: { id: ProductId; seu: boolean }[];
}) {
  const { world, navigate } = useGame();
  const linhas = itens.map((i) => ({ ...i, ...cotacaoDe(world, historico, i.id) }));
  const comPreco = linhas.filter((l) => l.preco && l.temComparacao);
  const alta = [...comPreco].sort((a, b) => b.variacao - a.variacao)[0];
  const baixa = [...comPreco].sort((a, b) => a.variacao - b.variacao)[0];
  return (
    <section className="preg" aria-labelledby="preg-titulo">
      <header className="ini-cabeca">
        <h2 id="preg-titulo" className="lv-grande">
          Pregão
        </h2>
        <span className="ao-vivo">
          <i aria-hidden="true" /> ao vivo
        </span>
        <button className="ini-link" onClick={() => navigate('quotes')}>
          Todas as cotações
        </button>
      </header>
      {(alta?.variacao ?? 0) > 0.0005 || (baixa?.variacao ?? 0) < -0.0005 ? (
        <p className="preg-destaques">
          {alta && alta.variacao > 0.0005 && (
            <span className="sobe">
              Maior alta: <b>{products[alta.id].name}</b> +{num(alta.variacao * 100, 1)}%
            </span>
          )}
          {baixa && baixa.variacao < -0.0005 && (
            <span className="desce">
              Maior queda: <b>{products[baixa.id].name}</b> −
              {num(Math.abs(baixa.variacao) * 100, 1)}%
            </span>
          )}
        </p>
      ) : null}
      <ul className="preg-quadro">
        {linhas.map((l, i) => (
          <li key={l.id} style={{ ['--h' as string]: matizDoProduto(l.id), ['--i' as string]: i }}>
            <BotaoProduto product={l.id} className="preg-linha">
              <span className="preg-arte">
                <ProdutoArte product={l.id} escala={1} />
              </span>
              <span className="preg-nome">
                <b>
                  {products[l.id].name}
                  {l.seu && (
                    <span className="preg-seu" title="Você negocia este produto">
                      seu
                    </span>
                  )}
                </b>
                <small>{products[l.id].category}</small>
              </span>
              <span className="preg-faisca">
                <Faisca valores={l.faisca} sobe={l.variacao >= 0} />
              </span>
              <span className="preg-preco">
                {l.preco ? (
                  <NumeroVivo valor={l.preco} formato={(v) => cr(Math.round(v))} />
                ) : (
                  <span className={`vivo ${historico[l.id] ? '' : 'preg-carregando'}`}>
                    {historico[l.id] ? '—' : 'carregando'}
                  </span>
                )}
                <small>por {unidade(l.id, 1)}</small>
              </span>
              <Variacao
                v={l.variacao}
                tem={l.temComparacao}
                dia={l.diaInteiro}
                carregando={!historico[l.id]}
              />
            </BotaoProduto>
          </li>
        ))}
      </ul>
    </section>
  );
}
