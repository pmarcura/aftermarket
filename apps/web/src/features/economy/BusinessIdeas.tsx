import { useMemo } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { IconePixel } from '../../components/IconePixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { PixelArt } from '../../components/PixelArt';
import { matizDoProduto, type Sprite } from '../../design/arte';
import { ProdutoArte } from './Vitrine';
import { analyzeDesign } from '../../../../../packages/simulation/src/economy-design';
import { equipmentCostFor, freeCash } from '../../../../../packages/simulation/src/design';
import { products, type Category, type ProductId } from '../../../../../packages/simulation/src/model';
import '../../design/cotacoes.css';

const spriteDaCategoria: Record<Category, Sprite> = {
  retail: 'loja',
  farm: 'lavoura',
  industry: 'siderurgica',
  mine: 'mina',
  warehouse: 'silos',
  logistics: 'caminhao',
};

/**
 * Quanto custa e quanto rende abrir cada negócio: o imóvel livre mais barato que comporta uma linha,
 * o equipamento e o rebanho. O lucro é estimativa a preços de referência, com a linha sempre
 * ocupada. `falta` marca os negócios cujo produto ninguém vende agora.
 */
export function useNegocios() {
  const { world, actor } = useGame();
  const design = useMemo(() => analyzeDesign().recipes, []);
  const caixa = freeCash(world, actor);
  const vendendo = new Set<ProductId>();
  for (const o of world.offers) {
    const e = world.establishments.find((x) => x.id === o.establishmentId);
    if (e && (e.inventory[o.product] ?? 0) > 0) vendendo.add(o.product);
  }
  const itens = world.season.config.economyVersion
    ? world.season.config.recipes
        .filter((r) => !r.alternativeOf)
        .flatMap((r) => {
          const line = design.find((d) => d.id === r.id);
          const profile = world.season.config.operations.profiles[r.id];
          if (!line || !profile) return [];
          const site = world.properties
            .filter((p) => p.ownerId === null && p.category === r.category && p.area >= profile.areaM2)
            .sort((a, b) => a.price - b.price)[0];
          const rebanho = (Object.entries(r.requires ?? {}) as [ProductId, number][]).reduce(
            (n, [id, q]) => n + q * world.season.config.basePrices[id],
            0,
          );
          const investimento = (site?.price ?? 0) + equipmentCostFor(world, r.category, r.id) + rebanho;
          const saidas = Object.keys(r.output) as ProductId[];
          return [
            {
              r,
              line,
              profile,
              site,
              investimento,
              retorno: investimento / Math.max(1, line.profit),
              saidas,
              falta: saidas.length > 0 && saidas.every((id) => !vendendo.has(id)),
            },
          ];
        })
        .sort((a, b) => a.retorno - b.retorno)
    : [];
  return { itens, caixa };
}

type Negocio = ReturnType<typeof useNegocios>['itens'][number];

function CartaoNegocio({ n, caixa }: { n: Negocio; caixa: number }) {
  const { focusMap } = useGame();
  const cobre = n.investimento > 0 ? Math.min(1, caixa / n.investimento) : 1;
  const acima = n.investimento > caixa;
  const principal = n.saidas[0];
  return (
    <article
      className="neg-card"
      style={{ ['--h' as string]: principal ? matizDoProduto(principal) : 120 }}
    >
      <header className="neg-topo">
        <div className="neg-arte">
          <PixelArt name={spriteDaCategoria[n.r.category]} scale={1} />
        </div>
        <div className="neg-ident">
          <h3>{n.line.name}</h3>
          {n.falta ? (
            <span className="neg-selo tom-lavoura">Ninguém vende: procura garantida</span>
          ) : acima ? (
            <span className="neg-selo tom-ouro">Acima do seu caixa</span>
          ) : (
            <span className="neg-selo tom-lavoura">Cabe no seu caixa</span>
          )}
        </div>
      </header>
      <div className="neg-corpo">
        <div className="neg-numeros">
          <div>
            <IconePixel nome="custo" tamanho={30} />
            <span>
              <small>Investimento</small>
              <b>{cr(n.investimento, 0)}</b>
            </span>
          </div>
          <div className="lucro">
            <IconePixel nome="moeda" tamanho={30} />
            <span>
              <small>Lucro por dia</small>
              <b>{cr(n.line.profit, 0)}</b>
            </span>
          </div>
          <div>
            <IconePixel nome="prazo" tamanho={30} />
            <span>
              <small>Se paga em</small>
              <b>{num(n.retorno)} dias</b>
            </span>
          </div>
        </div>
        <div className="neg-caixa">
          <div
            className="neg-barra"
            role="img"
            aria-label={`Seu caixa cobre ${Math.round(cobre * 100)}% do investimento`}
          >
            <i className={acima ? 'ouro' : 'lavoura'} style={{ width: `${cobre * 100}%` }} />
          </div>
          <small>
            {acima
              ? `Seu caixa cobre ${Math.round(cobre * 100)}%. Faltam ${cr(n.investimento - caixa, 0)}.`
              : 'Seu caixa cobre todo o investimento.'}
          </small>
        </div>
        <ul className="neg-detalhes">
          <li>
            <IconePixel nome="equipe" tamanho={22} /> {n.profile.workers} pessoas na equipe
          </li>
          <li>
            <IconePixel nome="mapa" tamanho={22} />{' '}
            {n.site ? `${n.site.city}, ${n.site.state}` : 'Nenhum imóvel livre que comporte'}
          </li>
        </ul>
        {n.saidas.length > 0 && (
          <div className="neg-produz">
            <span>Produz</span>
            {n.saidas.map((id) => (
              <BotaoProduto key={id} product={id} className="neg-produto">
                <ProdutoArte product={id} escala={1} />
                <b>{products[id].name}</b>
              </BotaoProduto>
            ))}
          </div>
        )}
        <button
          className="primary neg-acao"
          disabled={!n.site}
          onClick={() => n.site && focusMap(n.site.coordinates, n.site.id)}
        >
          <IconePixel nome="mapa" tamanho={24} /> Ver imóvel no mapa
        </button>
      </div>
    </article>
  );
}
export type FiltroNegocios = 'todos' | 'caixa' | 'falta';

/** Cartões dos negócios para abrir. O filtro escolhe os que cabem no caixa ou os que ninguém atende. */
export function BusinessIdeas({
  limite,
  filtro = 'todos',
}: {
  limite?: number;
  filtro?: FiltroNegocios;
}) {
  const { itens, caixa } = useNegocios();
  const lista = itens
    .filter((i) => (filtro === 'falta' ? i.falta : filtro === 'caixa' ? i.investimento <= caixa : true))
    .slice(0, limite);
  if (!lista.length) return <p className="neg-vazio">Nenhum negócio atende a este filtro agora.</p>;
  return (
    <ul className="neg-lista">
      {lista.map((n) => (
        <li key={n.r.id}>
          <CartaoNegocio n={n} caixa={caixa} />
        </li>
      ))}
    </ul>
  );
}
