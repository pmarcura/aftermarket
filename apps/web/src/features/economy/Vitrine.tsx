import { useState } from 'react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { IconePixel } from '../../components/IconePixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  type Establishment,
  type Offer,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { procuraDiaria, type Avaliacao } from './compra';
import { unidade } from './Carga';
import '../../design/comprar.css';

// Ilustrações em pixel art dos produtos (apps/web/public/arte/produto-*.png).
// Sem arte própria, o produto usa a peça do negócio que o produz.
const arteDoProduto: Partial<Record<ProductId, string>> = {
  rice: 'produto-arroz',
  beans: 'produto-feijao',
  sugar: 'produto-acucar',
  oil: 'produto-oleo',
  milk: 'produto-leite',
  utensils: 'produto-utensilios',
  steel: 'aco-utensilio',
  scrap: 'aco-utensilio',
  iron: 'mina',
  coal: 'mina',
  soy: 'soja-oleo',
  soymeal: 'soja-oleo',
  soySeed: 'soja-oleo',
  feed: 'silos',
  cow: 'fazenda-leite',
  riceSeed: 'lavoura',
  beanSeed: 'lavoura',
  caneSeedling: 'lavoura',
  truckHeavy: 'caminhao',
  truckLight: 'caminhao',
};

/** Ilustração do produto ampliada em múltiplo inteiro; sem arte, o ícone de traço. */
export function ProdutoArte({ product, escala = 2 }: { product: ProductId; escala?: number }) {
  const nome = arteDoProduto[product];
  const [tamanho, setTamanho] = useState<[number, number]>();
  const [falhou, setFalhou] = useState(false);
  if (!nome || falhou)
    return (
      <span className="vit-icone" aria-hidden="true">
        <ProductIcon product={product} size={34} />
      </span>
    );
  return (
    <img
      className="pixel-art vit-arte"
      src={`/arte/${nome}.png`}
      alt=""
      draggable={false}
      style={
        tamanho
          ? {
              // Ícones de produto ampliam; peças de negócio já são grandes e ficam em tamanho natural.
              width: tamanho[0] * (nome.startsWith('produto-') ? escala : 1),
              height: tamanho[1] * (nome.startsWith('produto-') ? escala : 1),
            }
          : undefined
      }
      onLoad={(e) => setTamanho([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
      onError={() => setFalhou(true)}
    />
  );
}

interface Item {
  product: ProductId;
  melhor?: Offer;
  aval?: Avaliacao;
  outros: number;
}

/**
 * A loja de mercadorias: um cartão por produto que o destino usa, com a melhor oferta já posta na
 * porta. O cartão tem uma única ação, Mandar buscar, que abre a gaveta de reposição.
 */
export function Vitrine({
  destino,
  ofertas,
  avaliacoes,
  relevantes,
  foco,
  onMandar,
  onProduzir,
}: {
  destino: Establishment;
  ofertas: Offer[];
  avaliacoes: Map<string, Avaliacao>;
  relevantes?: Set<string>;
  /** Produto que o jogador estava procurando: sobe para o começo e ganha destaque. */
  foco?: ProductId;
  onMandar: (product: ProductId) => void;
  onProduzir: () => void;
}) {
  const { world } = useGame();
  const loja = destino.category === 'retail';
  const ids = new Set<ProductId>([
    ...ofertas.map((o) => o.product),
    ...((relevantes ? [...relevantes] : []) as ProductId[]),
  ]);
  const itens: Item[] = [...ids].map((product) => {
    const dele = ofertas.filter((o) => o.product === product && avaliacoes.has(o.id));
    const melhor = dele.sort((a, b) => {
      const x = avaliacoes.get(a.id)!,
        y = avaliacoes.get(b.id)!;
      if (Boolean(x.frete) !== Boolean(y.frete))
        return Number(Boolean(y.frete)) - Number(Boolean(x.frete));
      return loja ? (y.margem ?? 0) - (x.margem ?? 0) : x.naPorta - y.naPorta;
    })[0];
    return {
      product,
      melhor,
      aval: melhor && avaliacoes.get(melhor.id),
      outros: Math.max(0, dele.length - 1),
    };
  });
  itens.sort((a, b) => {
    if (a.product === foco || b.product === foco)
      return Number(b.product === foco) - Number(a.product === foco);
    if (!a.aval || !b.aval) return Number(Boolean(b.aval)) - Number(Boolean(a.aval));
    return loja ? (b.aval.margem ?? 0) - (a.aval.margem ?? 0) : a.aval.naPorta - b.aval.naPorta;
  });
  return (
    <ul className="vitrine-lista">
      {itens.map(({ product, melhor, aval, outros }) => {
        const nome = products[product].name;
        const estilo = { ['--h' as string]: matizDoProduto(product) };
        const emFoco = product === foco;
        if (!melhor || !aval)
          return (
            <li key={product}>
              <article className="prod-card esgotado" style={estilo}>
                <header className="prod-topo">
                  <div className="prod-arte">
                    <BotaoProduto product={product}>
                      <ProdutoArte product={product} escala={2} />
                    </BotaoProduto>
                  </div>
                  <div className="prod-ident">
                    <h3>
                      <BotaoProduto product={product}>{nome}</BotaoProduto>
                    </h3>
                    <span className="prod-estado tom-brasa">Esgotado no mercado</span>
                  </div>
                </header>
                <div className="prod-corpo">
                  <p className="prod-nota">
                    <IconePixel nome="alerta" tamanho={22} />
                    Não há oferta disponível nesta seleção. Consulte a procura antes de produzir.
                  </p>
                  <button className="secondary prod-acao" onClick={onProduzir}>
                    <IconePixel nome="fabrica" tamanho={22} /> Ver como produzir
                  </button>
                </div>
              </article>
            </li>
          );
        const vendedor = world.establishments.find((e) => e.id === melhor.establishmentId)!;
        const lugar = world.properties.find((p) => p.id === vendedor.propertyId)!;
        const venda = seasonPrice(world, product);
        const porDia = loja ? procuraDiaria(world, destino, product) : 0;
        const fretePorUn = aval.frete ? aval.frete.price / aval.quantidade : 0;
        const custoUn = aval.mercadoria / aval.quantidade;
        const lucroUn = venda - aval.naPorta;
        const empata = Math.round(Math.abs(aval.margem ?? 0) * 100) === 0;
        const escala = Math.max(venda, aval.naPorta);
        const estado = !aval.frete
          ? { tom: 'ouro', texto: 'Frete a consultar' }
          : !loja
            ? { tom: 'ceu', texto: 'Insumo da produção' }
            : empata
              ? { tom: 'ouro', texto: 'Empata' }
              : lucroUn > 0
                ? { tom: 'lavoura', texto: `Margem estimada de ${num((aval.margem ?? 0) * 100)}%` }
                : {
                    tom: 'brasa',
                    texto: `Margem estimada de −${num(Math.abs(aval.margem ?? 0) * 100)}%`,
                  };
        return (
          <li key={product}>
            <article className={`prod-card ${emFoco ? 'em-foco' : ''}`} style={estilo}>
              {emFoco && <span className="prod-foco">Você procurava este</span>}
              <header className="prod-topo">
                <div className="prod-arte">
                  <BotaoProduto product={product}>
                    <ProdutoArte product={product} escala={2} />
                  </BotaoProduto>
                </div>
                <div className="prod-ident">
                  <h3>
                    <BotaoProduto product={product}>{nome}</BotaoProduto>
                  </h3>
                  <span className={`prod-estado tom-${estado.tom}`}>{estado.texto}</span>
                </div>
              </header>
              <div className="prod-corpo">
                <div className="prod-preco">
                  <IconePixel nome="moeda" tamanho={32} />
                  <b>{cr(aval.naPorta)}</b>
                  <span>
                    por {unidade(product, 1)}, {aval.frete ? 'na sua porta' : 'na origem'}
                    <small>
                      {aval.frete ? 'frete já incluído' : 'transporte ainda não cotado'}
                    </small>
                  </span>
                </div>
                {loja && aval.frete && (
                  <div className="prod-conta">
                    <div
                      className="prod-faixa"
                      role="img"
                      aria-label={`Você vende a ${cr(venda)}: ${cr(custoUn)} de mercadoria, ${cr(fretePorUn)} de frete e ${cr(Math.max(0, lucroUn))} de lucro por ${unidade(product, 1)}`}
                    >
                      <i className="merc" style={{ width: `${(custoUn / escala) * 100}%` }} />
                      <i className="frete" style={{ width: `${(fretePorUn / escala) * 100}%` }} />
                      {lucroUn > 0 && (
                        <i className="lucro" style={{ width: `${(lucroUn / escala) * 100}%` }} />
                      )}
                    </div>
                    <ul className="prod-chave">
                      <li>
                        <IconePixel nome="caixa" tamanho={22} /> mercadoria <b>{cr(custoUn)}</b>
                      </li>
                      <li>
                        <IconePixel nome="caminhao" tamanho={22} /> frete <b>{cr(fretePorUn)}</b>
                      </li>
                      <li>
                        <IconePixel nome="moeda" tamanho={22} />{' '}
                        {lucroUn > 0 ? 'lucro' : 'prejuízo'} <b>{cr(Math.abs(lucroUn))}</b>
                      </li>
                    </ul>
                    <p className="prod-ritmo">
                      Estimativa ao vender pelo preço de referência de {cr(venda)}
                      {porDia > 0 && `, cerca de ${num(porDia)} ${unidade(product)} por dia`}. Antes
                      dos custos de operação.
                    </p>
                  </div>
                )}
                <p className="prod-fornecedor">
                  <IconePixel nome="mapa" tamanho={22} />
                  <span>
                    {vendedor.name}, {lugar.city}
                    {outros > 0 && (
                      <em>
                        {' '}
                        · mais {outros} {outros === 1 ? 'opção' : 'opções'}
                      </em>
                    )}
                  </span>
                </p>
                <button className="primary prod-acao" onClick={() => onMandar(product)}>
                  <IconePixel nome="caminhao" tamanho={24} /> Mandar buscar
                </button>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
