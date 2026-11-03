import { useMemo, type ReactNode } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import { BotaoProduto } from '../../components/BotaoProduto';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { spriteDaCategoria, useNegocios } from '../economy/BusinessIdeas';
import { mercadoDaCidade } from '../business/precificacao';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  seasonProducts,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import { realToGame, HOUR_MS } from '../../../../../packages/simulation/src/clock';
import { NumeroVivo } from './vivo';

/** Menor preço de quem tem o produto em estoque agora, em todo o mapa. */
function menorOferta(world: World, product: ProductId) {
  let menor: number | undefined;
  for (const o of world.offers) {
    if (o.product !== product) continue;
    const e = world.establishments.find((x) => x.id === o.establishmentId);
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
  for (const loja of world.establishments) {
    if (loja.companyId !== empresa || loja.category !== 'retail' || !loja.enabled) continue;
    for (const id of seasonProducts(world)) {
      if ((loja.inventory[id] ?? 0) > 0) continue;
      const m = mercadoDaCidade(world, loja, id);
      if (m.procuraDia <= 0) continue;
      const custo = menorOferta(world, id);
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

function Cartao({
  tipo,
  arte,
  titulo,
  valor,
  rotuloValor,
  detalhe,
  acao,
  matiz,
}: {
  tipo: string;
  arte: ReactNode;
  titulo: string;
  valor: number;
  rotuloValor: string;
  detalhe: string;
  acao: { rotulo: string; executar: () => void };
  matiz: number;
}) {
  return (
    <li className="opo" style={{ ['--h' as string]: matiz }}>
      <span className="opo-tipo lv-rotulo">{tipo}</span>
      <div className="opo-arte">{arte}</div>
      <strong>{titulo}</strong>
      <div className="opo-valor">
        <b>
          +<NumeroVivo valor={valor} formato={(v) => cr(v, 0)} id={`opo-${tipo}`} />
        </b>
        <span>{rotuloValor}</span>
      </div>
      <small>{detalhe}</small>
      <button className="secondary" onClick={acao.executar}>
        {acao.rotulo}
      </button>
    </li>
  );
}

/** Até três jeitos de ganhar mais agora: vender um produto novo, abrir um negócio, atender um pedido. */
export function Oportunidades() {
  const { world, actor, openRepor, focusMap, navigate } = useGame();
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
  const comprador = pedido && world.companies.find((c) => c.id === pedido.pedido.buyerId)?.name;
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
      <ul className="opos-lista">
        {produto && (
          <Cartao
            tipo="Vender mais"
            matiz={matizDoProduto(produto.id)}
            arte={
              <BotaoProduto product={produto.id}>
                <ProdutoArte product={produto.id} escala={3} />
              </BotaoProduto>
            }
            titulo={`A cidade procura ${products[produto.id].name} e a ${produto.lojaNome} não vende`}
            valor={Math.round(produto.lucro)}
            rotuloValor="por dia, estimativa"
            detalhe={`~${num(produto.porDia)} ${unidade(produto.id, produto.porDia)} por dia, comprando a ${cr(produto.custo)} e vendendo a ${cr(produto.preco)}, antes do frete.`}
            acao={{
              rotulo: 'Mandar buscar',
              executar: () => openRepor({ destinationId: produto.lojaId, product: produto.id }),
            }}
          />
        )}
        {abrir && (
          <Cartao
            tipo="Abrir negócio"
            matiz={abrir.saidas[0] ? matizDoProduto(abrir.saidas[0]) : 120}
            arte={<PixelArt name={spriteDaCategoria[abrir.r.category]} scale={2} />}
            titulo={`${abrir.line.name} em ${abrir.site!.city}`}
            valor={Math.round(abrir.line.profitAtCapacity)}
            rotuloValor="por dia, linha sempre ocupada"
            detalhe={`Investimento de ${cr(abrir.investimento, 0)}; se paga em ~${num(abrir.retorno)} dias. Cabe no seu caixa.`}
            acao={{
              rotulo: 'Ver no mapa',
              executar: () => focusMap(abrir.site!.coordinates, abrir.site!.id),
            }}
          />
        )}
        {pedido && (
          <Cartao
            tipo="Vender a empresas"
            matiz={matizDoProduto(pedido.pedido.product)}
            arte={
              <BotaoProduto product={pedido.pedido.product}>
                <ProdutoArte product={pedido.pedido.product} escala={3} />
              </BotaoProduto>
            }
            titulo={`${comprador ?? 'Uma empresa'} quer ${products[pedido.pedido.product].name}`}
            valor={Math.round(pedido.valor)}
            rotuloValor="com o estoque que você já tem"
            detalhe={`${num(pedido.quantidade)} ${unidade(pedido.pedido.product, pedido.quantidade)} a ${cr(pedido.pedido.unitPrice)}; o pedido vence em ~${num(horas)} h de jogo.`}
            acao={{ rotulo: 'Fazer proposta', executar: () => navigate('orders') }}
          />
        )}
      </ul>
    </section>
  );
}
