import { useMemo } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import { BotaoProduto } from '../../components/BotaoProduto';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { spriteDaCategoria, useNegocios } from '../economy/BusinessIdeas';
import { mercadoDaCidade } from '../business/precificacao';
import {
  products,
  seasonProducts,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import { realToGame, HOUR_MS } from '../../../../../packages/simulation/src/clock';
import { NumeroVivo } from './vivo';
import { Carimbo } from '../../components/Livro';
import { SeloEmpresa } from './Perfil';
import '../../design/oportunidades.css';

/** Menor preço de quem tem o produto em estoque agora, em todo o mapa. */
function menorOferta(
  world: World,
  product: ProductId,
  porId: Map<string, World['establishments'][number]>,
) {
  let menor: number | undefined;
  for (const o of world.offers) {
    if (o.product !== product) continue;
    const e = porId.get(o.establishmentId);
    if (!e?.enabled || (e.inventory[product] ?? 0) <= 0) continue;
    if (menor === undefined || o.price < menor) menor = o.price;
  }
  return menor;
}

/**
 * Produto que a cidade da loja procura e a loja não vende: o lucro por dia ao comprar pelo menor
 * preço do mapa e vender pelo preço justo, pela mesma conta de venda da prateleira (sem frete).
 */
function produtoParaLoja(world: World, empresa: string) {
  let melhor:
    | {
        lojaId: string;
        lojaNome: string;
        id: ProductId;
        custo: number;
        preco: number;
        porDia: number;
        lucro: number;
      }
    | undefined;
  const porId = new Map(world.establishments.map((e) => [e.id, e]));
  for (const loja of world.establishments) {
    if (loja.companyId !== empresa || loja.category !== 'retail' || !loja.enabled) continue;
    for (const id of seasonProducts(world)) {
      if ((loja.inventory[id] ?? 0) > 0) continue;
      // Já está a caminho desta loja: a sugestão seria repetir o que o jogador já fez.
      if (
        world.shipments.some((c) => !c.delivered && c.destinationId === loja.id && c.product === id)
      )
        continue;
      const m = mercadoDaCidade(world, loja, id);
      if (m.procuraDia <= 0) continue;
      const custo = menorOferta(world, id, porId);
      if (custo === undefined || custo >= m.justo) continue;
      const porDia = m.vendas(m.justo);
      const lucro = porDia * (m.justo - custo);
      if (lucro > (melhor?.lucro ?? 0))
        melhor = { lojaId: loja.id, lojaNome: loja.name, id, custo, preco: m.justo, porDia, lucro };
    }
  }
  return melhor;
}

/** Pedido aberto de outra empresa que você consegue atender com o estoque que já tem. */
function pedidoQueVoceAtende(world: World, empresa: string) {
  const estoque = new Map<ProductId, number>();
  for (const e of world.establishments)
    if (e.companyId === empresa)
      for (const [id, q] of Object.entries(e.inventory) as [ProductId, number][])
        estoque.set(id, (estoque.get(id) ?? 0) + q);
  let melhor: { pedido: World['orders'][number]; quantidade: number; valor: number } | undefined;
  for (const o of world.orders) {
    if (o.status !== 'pending' || o.buyerId === empresa || o.sellerId) continue;
    const tenho = estoque.get(o.product) ?? 0;
    if (tenho <= 0) continue;
    const quantidade = Math.min(tenho, o.quantity);
    const valor = quantidade * o.unitPrice;
    if (valor > (melhor?.valor ?? 0)) melhor = { pedido: o, quantidade, valor };
  }
  return melhor;
}

type Produto = NonNullable<ReturnType<typeof produtoParaLoja>>;
type Pedido = NonNullable<ReturnType<typeof pedidoQueVoceAtende>>;
type Negocio = ReturnType<typeof useNegocios>['itens'][number];

/** Lucro por dia como etiqueta pendurada: o número principal de cada oportunidade. */
function Etiqueta({ valor, id, rotulo }: { valor: number; id: string; rotulo: string }) {
  return (
    <span className="op-etiqueta">
      <b>
        +<NumeroVivo valor={valor} formato={(v) => cr(v, 0)} id={id} />
      </b>
      <small>{rotulo}</small>
    </span>
  );
}

/** Vender mais: o produto como adesivo e a régua de quanto sobra entre comprar e vender. */
function CartaoVenda({ o }: { o: Produto }) {
  const { openRepor } = useGame();
  const margem = o.preco - o.custo;
  return (
    <li className="op op-venda">
      <span className="op-tipo">Vender mais</span>
      <div className="op-venda-topo">
        <BotaoProduto product={o.id} className="op-adesivo lv-adesivo">
          <ProdutoArte product={o.id} escala={2} />
        </BotaoProduto>
        <p className="op-titulo">
          <small>A cidade procura</small>
          <strong>{products[o.id].name}</strong>
          <small>e a {o.lojaNome} não vende</small>
        </p>
      </div>
      <div className="op-regua" aria-label={`Compra a ${cr(o.custo)} e vende a ${cr(o.preco)}`}>
        <span className="op-preco compra">
          <small>compra</small>
          <b>{cr(o.custo)}</b>
        </span>
        <span className="op-seta">
          <i />
          <em>
            +{cr(margem)} · {num((margem / o.custo) * 100)}%
          </em>
        </span>
        <span className="op-preco vende">
          <small>vende</small>
          <b>{cr(o.preco)}</b>
        </span>
      </div>
      <div className="op-rodape">
        <Etiqueta valor={Math.round(o.lucro)} id="op-venda" rotulo="por dia · estimativa" />
        <span className="op-volume">
          ~{num(o.porDia)} {unidade(o.id, o.porDia)}
          <small>por dia, antes do frete</small>
        </span>
      </div>
      <button
        className="primary"
        onClick={() => openRepor({ destinationId: o.lojaId, product: o.id })}
      >
        Mandar buscar
      </button>
    </li>
  );
}

/** Abrir negócio: a planta do prédio e a linha do tempo até o investimento se pagar. */
function CartaoNegocio({ n }: { n: Negocio }) {
  const { focusMap } = useGame();
  const dias = Math.max(1, Math.round(n.retorno));
  return (
    <li className="op op-planta">
      <span className="op-tipo">Abrir negócio</span>
      <div className="op-planta-topo">
        <span className="op-predio">
          <PixelArt name={spriteDaCategoria[n.r.category]} scale={1} />
        </span>
        <p className="op-titulo">
          <strong>{n.line.name}</strong>
          <small>em {n.site!.city}</small>
        </p>
      </div>
      <div
        className="op-prazo"
        aria-label={`Investe ${cr(n.investimento, 0)} e se paga em cerca de ${dias} dias`}
      >
        <span className="op-prazo-ponta">
          <small>investe</small>
          <b>{cr(n.investimento, 0)}</b>
        </span>
        <span className="op-prazo-trilho">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ ['--i' as string]: i }} />
          ))}
        </span>
        <span className="op-prazo-ponta fim">
          <small>se paga em</small>
          <b>~{dias} dias</b>
        </span>
      </div>
      <div className="op-rodape">
        <Etiqueta
          valor={Math.round(n.line.profitAtCapacity)}
          id="op-negocio"
          rotulo="por dia · linha sempre ocupada"
        />
        <Carimbo tom="lavoura" giro={4}>
          Cabe no caixa
        </Carimbo>
      </div>
      <button className="primary" onClick={() => n.site && focusMap(n.site.coordinates, n.site.id)}>
        Ver no mapa
      </button>
    </li>
  );
}

/** Vender a empresas: o pedido de compra impresso, com a conta da quantidade pelo preço. */
function CartaoPedido({ o, horas }: { o: Pedido; horas: number }) {
  const { world, openOrders } = useGame();
  const comprador = world.companies.find((c) => c.id === o.pedido.buyerId);
  return (
    <li className="op op-pedido">
      <div className="op-pedido-papel">
        <header>
          <span className="op-pedido-titulo">Pedido de compra</span>
          <span className="op-pedido-numero">nº {o.pedido.id.slice(0, 6).toUpperCase()}</span>
        </header>
        <p className="op-pedido-de">
          {comprador && <SeloEmpresa id={comprador.id} nome={comprador.name} />}
          <span>
            <small>de</small>
            <b>{comprador?.name ?? 'Uma empresa'}</b>
          </span>
        </p>
        <div className="op-pedido-item">
          <BotaoProduto product={o.pedido.product} className="op-pedido-arte">
            <ProdutoArte product={o.pedido.product} escala={1} />
          </BotaoProduto>
          <span className="op-pedido-conta">
            <span>
              {num(o.quantidade)} {unidade(o.pedido.product, o.quantidade)}
            </span>
            <span>× {cr(o.pedido.unitPrice)}</span>
            <small>{products[o.pedido.product].name}, do seu estoque</small>
          </span>
        </div>
        <p className="op-pedido-total">
          <span>Total</span>
          <b>
            <NumeroVivo valor={Math.round(o.valor)} formato={(v) => cr(v, 0)} id="op-pedido" />
          </b>
        </p>
        <span className="op-pedido-carimbo">
          <Carimbo tom="brasa" giro={-8}>
            Vence em ~{num(horas)} h
          </Carimbo>
        </span>
      </div>
      <button className="primary" onClick={() => openOrders('responder', o.pedido.id)}>
        Fazer proposta
      </button>
    </li>
  );
}

/** Até três jeitos de ganhar mais agora: vender um produto novo, abrir um negócio, atender um pedido. */
export function Oportunidades() {
  const { world, actor } = useGame();
  const negocios = useNegocios();
  const produto = useMemo(
    () => produtoParaLoja(world, actor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const pedido = useMemo(
    () => pedidoQueVoceAtende(world, actor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const abrir = negocios.itens.find((n) => n.site && n.investimento <= negocios.caixa);
  const horas = pedido
    ? Math.max(1, Math.round(realToGame(world, pedido.pedido.deadline - world.updatedAt) / HOUR_MS))
    : 0;

  if (!produto && !abrir && !pedido) return null;
  return (
    <section className="opos" aria-labelledby="opos-titulo">
      <header className="ini-cabeca">
        <h2 id="opos-titulo" className="lv-grande">
          Oportunidades
        </h2>
        <span className="lv-mao">o que dá dinheiro agora</span>
      </header>
      <ul className="op-lista">
        {produto && <CartaoVenda o={produto} />}
        {abrir && <CartaoNegocio n={abrir} />}
        {pedido && <CartaoPedido o={pedido} horas={horas} />}
      </ul>
    </section>
  );
}
