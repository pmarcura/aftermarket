import { useEffect, useState } from 'react';
import { Search, Truck, Info, ArrowRight } from 'lucide-react';
import { useGame, cr, num, CategoryIcon } from '../lib/game';
import { PageHeading, Panel, Select, Badge, Rows, Empty } from '../components/ui';
import { products, type ProductId } from '../../../../packages/simulation/src/model';
import { quote } from '../../../../packages/simulation/src/engine';
import { useRoute } from '../lib/routing';
export function MarketPage() {
  const { world, actor, intent, navigate, openMarket } = useGame();
  const [product, setProduct] = useState<ProductId>(intent.product),
    [quantity, setQuantity] = useState(intent.quantity ?? 24),
    [destinationId, setDestination] = useState(intent.destinationId);
  const [offerId, setOffer] = useState(intent.offerId ?? 'offer-ferrovale'),
    [sort, setSort] = useState('total');
  const destinations = world.establishments.filter((e) => e.companyId === actor);
  const destination = destinations.find((e) => e.id === destinationId) ?? destinations[0];
  const offers = world.offers.filter(
    (o) =>
      o.product === product &&
      world.establishments.find((e) => e.id === o.establishmentId)!.companyId !== actor,
  );
  const selected = offers.find((o) => o.id === offerId) ?? offers[0];
  const seller = world.establishments.find((e) => e.id === selected?.establishmentId);
  const sp = world.properties.find((p) => p.id === seller?.propertyId),
    dp = world.properties.find((p) => p.id === destination?.propertyId);
  const loading = useRoute(sp?.id, dp?.id);
  const cost = selected ? selected.price * quantity : 0,
    freight =
      seller && destination
        ? quote(world, seller.id, destination.id, product, quantity, 'transbrasil')
        : undefined;
  useEffect(() => {
    setProduct(intent.product);
    setQuantity(intent.quantity ?? (products[intent.product].unit === 't' ? 24 : 200));
    setDestination(intent.destinationId);
    setOffer(intent.offerId ?? 'offer-ferrovale');
  }, [intent]);
  const sorted = [...offers].sort((a, b) => {
    if (!destination) return 0;
    const qa = quote(world, a.establishmentId, destination.id, product, quantity, 'transbrasil'),
      qb = quote(world, b.establishmentId, destination.id, product, quantity, 'transbrasil');
    return sort === 'distance'
      ? qa.distanceKm - qb.distanceKm
      : sort === 'price'
        ? a.price - b.price
        : a.price * quantity + qa.price - b.price * quantity - qb.price;
  });
  return (
    <>
      <PageHeading
        eyebrow="Mercado / Comprar insumos"
        title="Mercado de mercadorias"
        description="Compare ofertas de empresas e bots, considerando preço, localização e transporte."
      />
      <div className="page-body">
        <div className="filter-bar market-filters panel">
          <Select
            label="Produto"
            value={product}
            onChange={(e) => {
              const p = e.target.value as ProductId;
              setProduct(p);
              setQuantity(products[p].unit === 't' ? 24 : 200);
            }}
          >
            {Object.entries(products).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            label="Destino da compra"
            value={destination?.id ?? ''}
            onChange={(e) => setDestination(e.target.value)}
          >
            {destinations.map((e) => (
              <option value={e.id} key={e.id}>
                Destino: {e.name}
              </option>
            ))}
          </Select>
          <label className="quantity-field">
            Quantidade
            <input
              type="number"
              min="1"
              max="1000000"
              value={quantity}
              aria-label="Quantidade de mercadoria"
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value))))}
            />
            <span>{products[product].unit}</span>
          </label>
          <Select label="Ordenar ofertas" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="total">Ordenar: menor custo total</option>
            <option value="price">Ordenar: mercadoria</option>
            <option value="distance">Ordenar: distância</option>
          </Select>
          <button
            className="primary"
            onClick={() =>
              openMarket({ product, quantity, destinationId: destination?.id ?? '', offerId })
            }
          >
            <Search size={16} /> Buscar ofertas
          </button>
          <Badge tone="blue">{offers.length} ofertas disponíveis</Badge>
        </div>
        {!destination ? (
          <Empty
            title="Você precisa de um destino"
            description="Adquira um estabelecimento antes de comprar mercadorias."
            action={
              <button className="primary" onClick={() => navigate('map')}>
                Explorar propriedades
              </button>
            }
          />
        ) : (
          <div className="market-grid">
            <Panel
              title="Ofertas de fornecedores"
              subtitle="Mercadoria na origem · frete por carga completa"
              action={<small>Destino: {dp?.city}</small>}
            >
              {sorted.length ? (
                <div className="table-scroll">
                  <table className="market-table">
                    <thead>
                      <tr>
                        <th>Fornecedor</th>
                        <th>Distância</th>
                        <th className="numeric">Disponível</th>
                        <th className="numeric">Mercadoria / {products[product].unit}</th>
                        <th className="numeric">Frete / carga</th>
                        <th className="numeric">Total / {products[product].unit}</th>
                        <th aria-label="Selecionar" />
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((o) => {
                        const e = world.establishments.find((e) => e.id === o.establishmentId)!,
                          p = world.properties.find((p) => p.id === e.propertyId)!,
                          q = quote(world, e.id, destination.id, product, quantity, 'transbrasil'),
                          available = e.inventory[product] ?? 0;
                        return (
                          <tr key={o.id} className={selected?.id === o.id ? 'selected-row' : ''}>
                            <td>
                              <div className="table-name">
                                <i className="table-icon">
                                  <CategoryIcon category={e.category} />
                                </i>
                                <div>
                                  <strong>{e.name}</strong>
                                  <small>
                                    {p.city} — {p.state}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              {num(q.distanceKm, 1)} km
                              <small>{q.source === 'osrm' ? 'rodoviária' : 'estimada'}</small>
                            </td>
                            <td className="numeric">
                              {num(available)} {products[product].unit}
                            </td>
                            <td className="numeric">
                              {cr(o.price, products[product].unit === 'un' ? 2 : 0)}
                            </td>
                            <td className="numeric">{cr(q.price)}</td>
                            <td className={`numeric ${selected?.id === o.id ? 'positive' : ''}`}>
                              <strong>{cr(o.price + q.price / quantity, 2)}</strong>
                            </td>
                            <td>
                              <button
                                className={selected?.id === o.id ? 'primary' : 'secondary'}
                                disabled={available < quantity}
                                onClick={() => setOffer(o.id)}
                              >
                                {available < quantity
                                  ? 'Estoque insuficiente'
                                  : selected?.id === o.id
                                    ? 'Selecionado'
                                    : 'Selecionar'}
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
                  title="Ainda não há ofertas deste produto"
                  description="Outras empresas podem anunciar mercadorias com estoque disponível. Produza e publique sua própria oferta na administração do negócio."
                />
              )}
              <div className="panel-content">
                <h3>Compare o custo até o destino</h3>
                <p className="muted small icon-paragraph">
                  <Info size={17} /> Um preço menor na origem pode resultar em uma compra mais cara
                  após o frete. A capacidade e o prazo também influenciam sua decisão.
                </p>
              </div>
            </Panel>
            <Panel title="Resumo de compra" className="purchase-summary">
              {selected && seller && (
                <div className="panel-content">
                  <span className="muted small">Fornecedor selecionado</span>
                  <h2>{seller.name}</h2>
                  <Badge
                    tone={
                      world.companies.find((c) => c.id === seller.companyId)!.bot ? 'muted' : 'blue'
                    }
                  >
                    {world.companies.find((c) => c.id === seller.companyId)!.bot
                      ? 'Empresa automatizada'
                      : 'Empresa de jogador'}
                  </Badge>
                  <Rows
                    rows={[
                      { label: 'Produto', value: products[product].name },
                      { label: 'Quantidade', value: `${num(quantity)} ${products[product].unit}` },
                      { label: 'Preço unitário', value: cr(selected.price, 2) },
                      { label: 'Subtotal', value: cr(cost) },
                      {
                        label: 'Frete estimado',
                        value: loading ? 'Calculando rota…' : cr(freight?.price ?? 0),
                      },
                      { label: 'Destino', value: destination.name },
                    ]}
                  />
                  <div className="total-row">
                    <strong>Total estimado</strong>
                    <strong>{cr(cost + (freight?.price ?? 0))}</strong>
                  </div>
                  <p className="muted small">
                    O estoque é reservado e o pagamento ocorre somente após a confirmação do
                    transporte.
                  </p>
                  <button
                    className="primary full"
                    disabled={
                      loading || (seller.inventory[product] ?? 0) < quantity || !freight?.compatible
                    }
                    onClick={() => {
                      openMarket({
                        product,
                        quantity,
                        destinationId: destination.id,
                        offerId: selected.id,
                      });
                      navigate('logistics');
                    }}
                  >
                    <Truck size={16} /> Continuar para frete <ArrowRight size={15} />
                  </button>
                  {!freight?.compatible && (
                    <p className="warning-text small">
                      A carga excede a capacidade dos veículos disponíveis. Reduza a quantidade.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}
