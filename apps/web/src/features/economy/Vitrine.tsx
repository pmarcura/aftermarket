import { useState } from 'react';
import { MapPin, Sparkles } from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import {
  products,
  type Establishment,
  type Offer,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { procuraDiaria, type Avaliacao } from './compra';
import { unidade } from './Carga';

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
 * A compra como vitrine: um cartão por produto que o destino usa, com a melhor oferta já posta na
 * porta. O olho lê a ilustração, o lucro e a barra; o texto é só confirmação.
 */
export function Vitrine({
  destino,
  ofertas,
  avaliacoes,
  relevantes,
  escolhida,
  onComprar,
}: {
  destino: Establishment;
  ofertas: Offer[];
  avaliacoes: Map<string, Avaliacao>;
  relevantes?: Set<string>;
  escolhida?: string;
  onComprar: (o: Offer) => void;
}) {
  const { world, navigate } = useGame();
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
    if (!a.aval || !b.aval) return Number(Boolean(b.aval)) - Number(Boolean(a.aval));
    return loja ? (b.aval.margem ?? 0) - (a.aval.margem ?? 0) : a.aval.naPorta - b.aval.naPorta;
  });
  return (
    <div className="vitrine">
      {itens.map(({ product, melhor, aval, outros }, i) => {
        const venda = seasonPrice(world, product);
        const porDia = loja ? procuraDiaria(world, destino, product) : 0;
        if (!melhor || !aval)
          return (
            <article className="vit-card esgotado" key={product}>
              <div className="vit-palco">
                <ProdutoArte product={product} />
              </div>
              <h3>{products[product].name}</h3>
              <p className="vit-esgotado">
                <Sparkles size={14} aria-hidden="true" /> Esgotado em todo o mercado
              </p>
              <p className="vit-nota">Ninguém tem para vender. Quem produzir, vende tudo.</p>
              <button className="secondary full" onClick={() => navigate('opportunities')}>
                Ver como produzir
              </button>
            </article>
          );
        const vendedor = world.establishments.find((e) => e.id === melhor.establishmentId)!;
        const lugar = world.properties.find((p) => p.id === vendedor.propertyId)!;
        const fretePorUn = aval.frete ? aval.frete.price / aval.quantidade : 0;
        const custoUn = aval.mercadoria / aval.quantidade;
        const lucroUn = venda - aval.naPorta;
        const escala = Math.max(venda, aval.naPorta);
        const u1 = unidade(product, 1);
        const empata = Math.round(Math.abs(aval.margem ?? 0) * 100) === 0;
        return (
          <article
            className={`vit-card ${escolhida === melhor.id ? 'on' : ''}`}
            key={product}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="vit-palco">
              <ProdutoArte product={product} />
            </div>
            <div className="vit-titulo">
              <h3>{products[product].name}</h3>
              {loja && (
                <small>
                  Você vende a {cr(venda)}
                  {porDia > 0 && ` · ~${num(porDia)} ${unidade(product)} por dia`}
                </small>
              )}
            </div>
            {loja ? (
              <div className={`vit-lucro ${empata ? 'zero' : lucroUn > 0 ? 'bom' : 'ruim'}`}>
                <b>
                  {empata
                    ? '0%'
                    : `${lucroUn > 0 ? '+' : '−'}${num(Math.abs(aval.margem ?? 0) * 100)}%`}
                </b>
                <span>
                  {empata ? 'empata' : lucroUn > 0 ? 'de lucro' : 'de prejuízo'}
                  <small>
                    {cr(Math.abs(lucroUn))} por {u1}
                  </small>
                </span>
              </div>
            ) : (
              <div className="vit-lucro">
                <b>{cr(aval.naPorta)}</b>
                <span>
                  na sua porta
                  <small>por {u1}, frete incluído</small>
                </span>
              </div>
            )}
            {loja && (
              <div
                className="vit-barra"
                role="img"
                aria-label={`Vende a ${cr(venda)}: ${cr(custoUn)} de mercadoria, ${cr(fretePorUn)} de frete e ${cr(lucroUn)} de lucro`}
              >
                <i className="merc" style={{ width: `${(custoUn / escala) * 100}%` }} />
                <i className="frete" style={{ width: `${(fretePorUn / escala) * 100}%` }} />
                {lucroUn > 0 && (
                  <i className="lucro" style={{ width: `${(lucroUn / escala) * 100}%` }} />
                )}
                <span className="vit-venda" style={{ left: `${(venda / escala) * 100}%` }} />
              </div>
            )}
            {loja && (
              <div className="vit-legenda" aria-hidden="true">
                <span className="merc">mercadoria</span>
                <span className="frete">frete</span>
                <span className="lucro">lucro</span>
              </div>
            )}
            <p className="vit-fornecedor">
              <MapPin size={12} aria-hidden="true" /> {vendedor.name}, {lugar.city}
              {outros > 0 && (
                <em>
                  {' '}
                  · +{outros} {outros === 1 ? 'opção' : 'opções'}
                </em>
              )}
            </p>
            <button
              className={escolhida === melhor.id ? 'primary full' : 'secondary full'}
              onClick={() => onComprar(melhor)}
            >
              {escolhida === melhor.id ? 'Escolhido' : 'Comprar'}
            </button>
          </article>
        );
      })}
    </div>
  );
}
