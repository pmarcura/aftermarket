import { useEffect, useMemo, useState } from 'react';
import { useGame, cr, num } from '../../../lib/game';
import { Empty } from '../../../components/ui';
import { BotaoEspera } from '../../../components/Espera';
import { IconePixel } from '../../../components/IconePixel';
import { BotaoProduto } from '../../../components/BotaoProduto';
import { matizDoProduto } from '../../../design/arte';
import { ProdutoArte } from '../../economy/Vitrine';
import { unidade } from '../../economy/Carga';
import { Passo } from '../Abastecimento';
import {
  products,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../../packages/simulation/src/model';
import {
  inventoryQuality,
  availableStock,
} from '../../../../../../packages/simulation/src/operations';
import { wholesaleReference } from '../../../../../../packages/simulation/src/metrics';
import { distanceKm } from '../../../../../../packages/simulation/src/geometry';
import '../../../design/vendas-unidade.css';

/** Preço de referência entre empresas (porta da fábrica); sem ele, o preço da temporada. */
const referencia = (world: World, p: ProductId) =>
  wholesaleReference(world, p) ?? world.season.config.basePrices[p];

/** O mercado de um produto visto desta unidade: quem vende mais barato e quem compra perto. */
function mercadoDoProduto(world: World, e: Establishment, p: ProductId) {
  const aqui = world.properties.find((x) => x.id === e.propertyId)!.coordinates;
  const longe = (x: Establishment) =>
    distanceKm(aqui, world.properties.find((q) => q.id === x.propertyId)!.coordinates) * 1.3;
  const porId = new Map(world.establishments.map((x) => [x.id, x]));
  const rivais = world.offers
    .filter((o) => o.product === p && o.establishmentId !== e.id)
    .map((o) => ({ o, x: porId.get(o.establishmentId)! }))
    .filter(({ x }) => x && x.companyId !== e.companyId && availableStock(world, x, p) >= 1)
    .sort((a, b) => a.o.price - b.o.price);
  const usa = (x: Establishment) => {
    if (x.category === 'retail')
      return p in x.prices || (x.supplyPolicy?.rules.some((r) => r.product === p) ?? false);
    const receita = world.season.config.recipes.find((r) => r.id === x.specialization);
    return Boolean(receita?.input[p] || receita?.requires?.[p]);
  };
  const compradores = world.establishments
    .filter((x) => x.enabled && x.companyId !== e.companyId && usa(x))
    .map((x) => ({ x, km: longe(x) }))
    .sort((a, b) => a.km - b.km);
  const maisBarato = rivais[0];
  return {
    rivais: rivais.length,
    maisBarato: maisBarato && {
      preco: maisBarato.o.price,
      nome: maisBarato.x.name,
      km: longe(maisBarato.x),
    },
    compradores,
    lojas: compradores.filter((c) => c.x.category === 'retail').length,
  };
}

/** Preço sugerido: logo abaixo do mais barato do mercado, sem descer do custo; senão a referência. */
function sugerido(custo: number, ref: number, maisBarato?: number) {
  const abaixo = maisBarato ? Math.floor(maisBarato * 0.99) : ref;
  return Math.max(Math.ceil(custo * 1.05), abaixo);
}

function CartaoVenda({ e, p }: { e: Establishment; p: ProductId }) {
  const { world, run, pending } = useGame();
  const oferta = world.offers.find((o) => o.establishmentId === e.id && o.product === p);
  const estoque = Math.floor(e.inventory[p] ?? 0);
  const custo = Math.round(e.unitCosts[p] ?? 0);
  const ref = referencia(world, p);
  const m = useMemo(
    () => mercadoDoProduto(world, e, p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id, p],
  );
  const salvo = oferta?.price;
  const [preco, setPreco] = useState(() => salvo ?? sugerido(custo, ref, m.maisBarato?.preco));
  useEffect(() => {
    if (salvo !== undefined) setPreco(salvo);
  }, [salvo]);
  const margem = preco - custo;
  const nome = products[p].name;
  const un = unidade(p, 1);
  const abaixoDoMercado = m.maisBarato && preco < m.maisBarato.preco;
  const estado =
    estoque <= 0
      ? { tom: 'apagado', texto: 'Acabou' }
      : salvo !== undefined
        ? { tom: 'lavoura', texto: `À venda por ${cr(salvo)}` }
        : { tom: 'ouro', texto: 'Parado: ninguém pode comprar' };
  const referencias = [
    custo > 0 && { rotulo: 'Seu custo', valor: custo, icone: 'custo' as const },
    m.maisBarato && {
      rotulo: `Mais barato do mercado (${m.maisBarato.nome}, ${num(m.maisBarato.km)} km)`,
      valor: m.maisBarato.preco,
      icone: 'rival' as const,
    },
    { rotulo: 'Referência entre empresas', valor: ref, icone: 'justo' as const },
  ].filter(Boolean) as { rotulo: string; valor: number; icone: 'custo' | 'rival' | 'justo' }[];

  return (
    <article
      className={`vu-card tom-${estado.tom}`}
      style={{ ['--h' as string]: matizDoProduto(p) }}
    >
      <header className="vu-cab">
        <span className="vu-arte">
          <BotaoProduto product={p}>
            <ProdutoArte product={p} escala={2} />
          </BotaoProduto>
        </span>
        <div>
          <span className="vu-estado">{estado.texto}</span>
          <h3 className="lv-grande">
            <BotaoProduto product={p}>{nome}</BotaoProduto>
          </h3>
          <p>
            <b>
              {num(estoque)} {unidade(p, estoque)}
            </b>{' '}
            no armazém · valem ~{cr(estoque * ref, 0)} na referência · qualidade{' '}
            {num(inventoryQuality(e, p))}
          </p>
        </div>
      </header>

      <div className="vu-mercado">
        <p>
          <IconePixel nome="mapa" tamanho={22} />
          <span>
            {m.compradores.length ? (
              <>
                <b>
                  {num(m.compradores.length)}{' '}
                  {m.compradores.length === 1 ? 'empresa usa' : 'empresas usam'}
                </b>{' '}
                {nome}
                {m.lojas ? ` (${num(m.lojas)} ${m.lojas === 1 ? 'loja' : 'lojas'})` : ''}. A mais
                perto: {m.compradores[0].x.name}, {num(m.compradores[0].km)} km.
              </>
            ) : (
              <>Nenhuma empresa usa {nome} agora.</>
            )}
          </span>
        </p>
        <p>
          <IconePixel nome="rival" tamanho={22} />
          <span>
            {m.rivais ? (
              <>
                <b>
                  {num(m.rivais)} {m.rivais === 1 ? 'vendedor' : 'vendedores'}
                </b>{' '}
                com estoque. Quem compra escolhe quem entrega mais barato, frete incluído: perto e
                abaixo deles, você passa na frente.
              </>
            ) : (
              <>Ninguém mais vende: você define o preço.</>
            )}
          </span>
        </p>
      </div>

      <div className="vu-preco">
        <ul className="vu-refs" aria-label="Referências de preço: toque para usar">
          {referencias.map((r) => (
            <li key={r.rotulo}>
              <button
                type="button"
                className={preco === r.valor ? 'on' : ''}
                onClick={() => setPreco(r.valor)}
              >
                <IconePixel nome={r.icone} tamanho={22} />
                <span>
                  <small>{r.rotulo}</small>
                  <b>{cr(r.valor)}</b>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="vu-decisao">
          <Passo
            rotulo={`Seu preço por ${un} (R$)`}
            valor={preco / 100}
            passo={Math.max(0.01, Math.round(ref / 100) / 100)}
            casas={2}
            min={0.01}
            onChange={(v) => setPreco(Math.round(v * 100))}
          />
          <dl className="vu-efeito">
            <div className={margem >= 0 ? 'bom' : 'ruim'}>
              <dt>Margem por {un}</dt>
              <dd>
                {margem >= 0 ? '+' : '−'}
                {cr(Math.abs(margem))}
                {preco > 0 && <small> ({num((margem / preco) * 100)}%)</small>}
              </dd>
            </div>
            <div>
              <dt>Vendendo tudo</dt>
              <dd>{cr(estoque * preco, 0)}</dd>
            </div>
          </dl>
          {margem < 0 && (
            <p className="vu-alerta">
              Abaixo do seu custo: cada {un} vendido perde {cr(-margem)}. Vale para desovar estoque
              parado, não para vender sempre.
            </p>
          )}
          {m.maisBarato && !abaixoDoMercado && preco > 0 && (
            <p className="vu-dica">
              Acima do mais barato do mercado ({cr(m.maisBarato.preco)}): só vende para quem estiver
              mais perto de você do que dele.
            </p>
          )}
          <BotaoEspera
            className="primary vu-anunciar"
            esperando="Anunciando…"
            disabled={pending || estoque <= 0 || preco <= 0 || preco === salvo}
            onClick={() =>
              run(
                { type: 'publishOffer', establishmentId: e.id, product: p, price: preco },
                `${nome} à venda por ${cr(preco)}.`,
              )
            }
          >
            {salvo === undefined
              ? `Anunciar a ${cr(preco)}`
              : preco === salvo
                ? `À venda por ${cr(salvo)}`
                : `Mudar para ${cr(preco)}`}
          </BotaoEspera>
        </div>
      </div>
    </article>
  );
}

/**
 * Vender para outras empresas: um cartão por produto que a unidade tem para vender, com o mercado
 * à vista (quem compra perto, quem vende mais barato) e a decisão de preço no mesmo lugar. O
 * anúncio é o comando `publishOffer`, o mesmo para jogadores e bots.
 */
export function Vendas({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame();
  const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
  const insumos = new Set(Object.keys(receita?.input ?? {}));
  const saidas = Object.keys(receita?.output ?? {}) as ProductId[];
  // Primeiro o que a unidade faz, depois outras sobras; o insumo da linha fica de fora.
  const lista = [
    ...new Set([
      ...saidas,
      ...(Object.keys(e.inventory) as ProductId[]).filter(
        (id) => !insumos.has(id) && (e.inventory[id] ?? 0) >= 1,
      ),
    ]),
  ];
  const parado = lista.reduce(
    (n, p) =>
      world.offers.some((o) => o.establishmentId === e.id && o.product === p)
        ? n
        : n + Math.floor(e.inventory[p] ?? 0) * referencia(world, p),
    0,
  );
  return (
    <section className="vu" aria-labelledby="vu-titulo">
      <header className="vu-topo">
        <div>
          <h2 id="vu-titulo" className="lv-grande">
            Vender para outras empresas
          </h2>
          <p>
            Anuncie um preço e jogadores e bots compram direto do seu armazém. O frete é de quem
            compra; pedidos já fechados mantêm o valor combinado.
          </p>
        </div>
        {parado > 0 && (
          <p className="vu-parado">
            <small>Parado sem oferta</small>
            <b>~{cr(parado, 0)}</b>
          </p>
        )}
      </header>
      {lista.length ? (
        <div className="vu-lista">
          {lista.map((p) => (
            <CartaoVenda key={p} e={e} p={p} />
          ))}
        </div>
      ) : (
        <Empty
          title="Nada para vender ainda"
          description="Quando a unidade tiver produtos no armazém, eles aparecem aqui para você anunciar."
        />
      )}
    </section>
  );
}
