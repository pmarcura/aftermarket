import { useState } from 'react';
import { BotaoProduto } from '../../../components/BotaoProduto';
import { Tag } from 'lucide-react';
import { useGame, cr, num } from '../../../lib/game';
import { Empty } from '../../../components/ui';
import { IconePixel } from '../../../components/IconePixel';
import { matizDoProduto } from '../../../design/arte';
import { ProdutoArte } from '../../economy/Vitrine';
import { OfferModal } from '../OfferModal';
import { ChipEstado } from './pecas';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../../packages/simulation/src/operations';

/**
 * Vender para outras empresas: um cartão por produto no armazém, com o preço anunciado, o custo e
 * a margem. O anúncio usa o mesmo comando de antes (`publishOffer`), pelo mesmo modal.
 */
export function Vendas({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame();
  const [editando, setEditando] = useState<ProductId>();
  const estoque = (Object.entries(e.inventory) as [ProductId, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return (
    <section className="vendas" aria-labelledby="vendas-titulo">
      <h2 id="vendas-titulo">O que você vende para outras empresas</h2>
      <p className="vendas-intro">
        Anuncie o que está no armazém. Jogadores e bots compram pelo seu preço; pedidos que já foram
        fechados mantêm o valor combinado.
      </p>
      {estoque.length ? (
        <ul className="vendas-lista">
          {estoque.map(([id, q]) => {
            const oferta = world.offers.find((o) => o.establishmentId === e.id && o.product === id);
            const custo = e.unitCosts[id] ?? 0;
            const preco = oferta?.price;
            const margem = preco ? preco - custo : 0;
            return (
              <li key={id}>
                <article
                  className="item item-compacto"
                  style={{ ['--h' as string]: matizDoProduto(id) }}
                >
                  <header className="item-hero">
                    <div className="item-arte">
                      <BotaoProduto product={id}>
                        <ProdutoArte product={id} escala={2} />
                      </BotaoProduto>
                    </div>
                    <div className="item-ident">
                      <h3>
                        <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                      </h3>
                      <ChipEstado
                        tom={preco ? 'lavoura' : 'apagado'}
                        texto={preco ? `À venda por ${cr(preco)}` : 'Não anunciado'}
                      />
                      <dl className="item-fatos">
                        <div>
                          <IconePixel nome="caixa" tamanho={22} />
                          <dt>No armazém</dt>
                          <dd>
                            {num(q, 1)} {products[id].unit}
                          </dd>
                        </div>
                        <div>
                          <IconePixel nome="custo" tamanho={22} />
                          <dt>Custo posto</dt>
                          <dd>{cr(custo)}</dd>
                        </div>
                        <div>
                          <dt>Qualidade</dt>
                          <dd>{num(inventoryQuality(e, id))}</dd>
                        </div>
                        {preco ? (
                          <div>
                            <IconePixel nome="moeda" tamanho={22} />
                            <dt>Margem antes dos custos fixos</dt>
                            <dd className={margem >= 0 ? 'vendas-bom' : 'vendas-ruim'}>
                              {margem >= 0 ? '+' : '−'}
                              {cr(Math.abs(margem))} ({num((margem / preco) * 100, 0)}%)
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="est-acoes">
                      <button
                        className={preco ? 'secondary' : 'primary'}
                        disabled={q <= 0}
                        onClick={() => setEditando(id)}
                      >
                        <Tag size={16} /> {preco ? 'Alterar preço' : 'Anunciar'}
                      </button>
                    </div>
                  </header>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty
          title="Nada para vender ainda"
          description="Quando a unidade tiver produtos no armazém, eles aparecem aqui para você anunciar."
        />
      )}
      {editando && (
        <OfferModal establishment={e} product={editando} onClose={() => setEditando(undefined)} />
      )}
    </section>
  );
}
