import { Tag } from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { Badge, Empty } from '../../components/ui';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
export function SalesCatalog({
  establishment: e,
  onEdit,
  retail = false,
}: {
  establishment: Establishment;
  onEdit: (id: ProductId) => void;
  retail?: boolean;
}) {
  const { world } = useGame();
  const stock = Object.entries(e.inventory) as [ProductId, number][];
  return (
    <div className="business-section">
      <div className="panel-content">
        <h3>
          {retail ? 'Preço, custo e margem por produto' : 'Catálogo de vendas entre empresas'}
        </h3>
        <p className="small muted">
          {retail
            ? 'Margem bruta unitária antes da folha, manutenção e utilidades fixas.'
            : 'Anuncie o estoque para jogadores e bots. O preço do anúncio é usado nos novos pedidos; pedidos existentes conservam o valor acordado.'}
        </p>
      </div>
      {stock.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th className="numeric">Disponível</th>
                <th>Qualidade</th>
                <th className="numeric">Custo posto</th>
                <th className="numeric">Preço de venda</th>
                <th className="numeric">Margem bruta</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {stock.map(([id, q]) => {
                const offer = world.offers.find(
                  (o) => o.establishmentId === e.id && o.product === id,
                );
                const price = retail ? e.prices[id] : offer?.price,
                  cost = e.unitCosts[id] ?? 0;
                return (
                  <tr key={id}>
                    <td>
                      <div className="table-name">
                        <i className="table-icon">
                          <ProductIcon product={id} size={17} />
                        </i>
                        <div>
                          <strong>{products[id].name}</strong>
                          <small className="block">por {products[id].unit}</small>
                        </div>
                      </div>
                    </td>
                    <td className="numeric">{num(q, 2)}</td>
                    <td>
                      <Badge tone="blue">{num(inventoryQuality(e, id))}/100</Badge>
                    </td>
                    <td className="numeric">{cr(cost)}</td>
                    <td className="numeric">{price ? cr(price) : 'Não anunciado'}</td>
                    <td className={`numeric ${price && price >= cost ? 'positive' : 'negative'}`}>
                      {price
                        ? `${cr(price - cost)} (${num(((price - cost) / price) * 100, 1)}%)`
                        : '—'}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        disabled={!retail && q <= 0}
                        onClick={() => onEdit(id)}
                      >
                        <Tag size={14} />
                        {price ? 'Alterar preço' : 'Anunciar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Receba produtos para montar seu catálogo"
          description="O catálogo usa o estoque físico da unidade, com custo de aquisição e transporte."
        />
      )}
    </div>
  );
}
