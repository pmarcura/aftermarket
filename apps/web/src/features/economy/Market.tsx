import { useState } from 'react';
import {
  Search,
  Truck,
  Info,
  ArrowRight,
  SlidersHorizontal,
  X,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useGame, cr, num, CategoryIcon } from '../../lib/game';
import { PageHeading, Panel, Select, Badge, Rows, Empty, Modal, Tabs } from '../../components/ui';
import { ProductAnalysisModal } from '../../components/ProductAnalysis';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useRoute } from '../../lib/routing';
import '../../economy.css';
import { Orders } from '../business/Orders';
import { BotActivity } from '../business/BotActivity';
import { InfrastructureContracts } from '../business/InfrastructureContracts';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';

export function MarketPage() {
  const { world, actor, intent, navigate, openMarket, refresh } = useGame();
  const [product, setProduct] = useState(intent.product ?? ''),
    [supplierId, setSupplier] = useState(intent.supplierId ?? ''),
    [quantity, setQuantity] = useState(String(intent.quantity ?? '')),
    [destinationId, setDestination] = useState(intent.destinationId ?? ''),
    [offerId, setOffer] = useState(intent.offerId ?? ''),
    [sort, setSort] = useState('');
  const [advanced, setAdvanced] = useState(false),
    [maxDistance, setMaxDistance] = useState(''),
    [maxPrice, setMaxPrice] = useState(''),
    [sourceState, setSourceState] = useState(''),
    [supplierType, setSupplierType] = useState(''),
    [search, setSearch] = useState(''),
    [mode, setMode] = useState('Simplificada'),
    [analysis, setAnalysis] = useState<ProductId>();
  const destinations = world.establishments.filter((e) => e.companyId === actor),
    destination = destinations.find((e) => e.id === destinationId),
    selected = world.offers.find((o) => o.id === offerId),
    seller = world.establishments.find((e) => e.id === selected?.establishmentId),
    amount = Number(quantity),
    validAmount = Number.isInteger(amount) && amount > 0;
  const sp = world.properties.find((p) => p.id === seller?.propertyId),
    dp = world.properties.find((p) => p.id === destination?.propertyId);
  const loading = useRoute(sp?.id, dp?.id),
    freight =
      selected && seller && destination && validAmount
        ? quote(world, seller.id, destination.id, selected.product, amount, 'transbrasil')
        : undefined;
  const offers = world.offers
    .filter((o) => {
      const e = world.establishments.find((e) => e.id === o.establishmentId)!,
        p = world.properties.find((p) => p.id === e.propertyId)!,
        bot = world.companies.find((c) => c.id === e.companyId)!.bot;
      const q =
        destination && validAmount
          ? quote(world, e.id, destination.id, o.product, amount, 'transbrasil')
          : undefined;
      return (
        e.id !== destinationId &&
        e.enabled &&
        (!supplierId || e.id === supplierId) &&
        (!product || o.product === product) &&
        (!sourceState || p.state === sourceState) &&
        (!supplierType || (supplierType === 'bot') === bot) &&
        (!search ||
          `${e.name} ${products[o.product].name} ${p.city}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!maxPrice || o.price <= Number(maxPrice) * 100) &&
        (!maxDistance || (q && q.distanceKm <= Number(maxDistance)))
      );
    })
    .sort((a, b) => {
      if (sort === 'price' && product) return a.price - b.price;
      if (!destination || !validAmount || !sort || (sort === 'total' && !product)) return 0;
      const qa = quote(world, a.establishmentId, destination.id, a.product, amount, 'transbrasil'),
        qb = quote(world, b.establishmentId, destination.id, b.product, amount, 'transbrasil');
      return sort === 'distance'
        ? qa.distanceKm - qb.distanceKm
        : a.price * amount + qa.price - b.price * amount - qb.price;
    });
  const cost =
    selected && seller?.companyId !== actor ? selected.price * (validAmount ? amount : 0) : 0;
  const clear = () => {
    setProduct('');
    setSupplier('');
    setQuantity('');
    setDestination('');
    setOffer('');
    setSort('');
    setMaxDistance('');
    setMaxPrice('');
    setSourceState('');
    setSupplierType('');
    setSearch('');
  };
  return (
    <>
      <PageHeading
        eyebrow="Mercado / Negociação entre empresas"
        title="Mercado de mercadorias"
        description="Encontre ofertas reais do mundo. Escolha fornecedor, destino e quantidade antes de contratar."
        action={<Tabs values={['Simplificada', 'Avançada']} value={mode} onChange={setMode} />}
      />
      <div className="page-body">
        <details className="infrastructure-market">
          <summary>
            Pedidos e negociações{' '}
            <Badge tone="blue">
              {world.orders.filter((o) => o.status === 'pending').length} em aberto
            </Badge>
          </summary>
          <Orders />
        </details>
        <details className="infrastructure-market">
          <summary>Concorrentes e movimento do mundo</summary>
          <BotActivity />
        </details>
        <details className="infrastructure-market">
          <summary>
            Contratos de infraestrutura{' '}
            <Badge tone="gold">
              {world.infrastructure.filter((c) => c.status === 'open').length} abertos
            </Badge>
            <span>Disputar projetos estaduais e entregas municipais</span>
          </summary>
          <InfrastructureContracts />
        </details>
        {supplierId && (
          <div className="supplier-context">
            <span>
              Ofertas de{' '}
              <strong>{world.establishments.find((e) => e.id === supplierId)?.name}</strong>
            </span>
            <button className="text-button" onClick={() => setSupplier('')}>
              Ver todos os fornecedores
            </button>
          </div>
        )}
        <div className="economic-filter-panel">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Buscar oferta"
              placeholder="Fornecedor, item ou cidade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select
            label="Produto"
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setOffer('');
              setSort('');
            }}
          >
            <option value="">Mercadoria (opcional)</option>
            {Object.entries(products).map(([id, p]) => (
              <option value={id} key={id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select label="Ordenar ofertas" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="">Ordenação (opcional)</option>
            <option value="price" disabled={!product}>
              Menor preço da mercadoria
            </option>
            <option value="total" disabled={!product || !destination || !validAmount}>
              Menor custo por carga
            </option>
            <option value="distance" disabled={!destination}>
              Menor distância ao destino
            </option>
          </Select>
          <button className="secondary" onClick={() => setAdvanced(true)}>
            <SlidersHorizontal size={15} /> Filtros avançados
          </button>
          <button className="secondary" onClick={() => void refresh()}>
            Atualizar ofertas
          </button>
          <button className="text-button" onClick={clear}>
            <X size={14} /> Limpar
          </button>
        </div>
        {!destinations.length ? (
          <Empty
            title="Escolha um imóvel para receber mercadorias"
            description="Sua empresa precisa de um destino com inventário para concluir uma compra."
            action={
              <button className="primary" onClick={() => navigate('map')}>
                Explorar propriedades
              </button>
            }
          />
        ) : (
          <>
            <div className="purchase-context">
              <span>
                <Truck size={17} /> Contexto da compra
              </span>
              <Select
                label="Destino da compra"
                value={destinationId}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Selecione o destino</option>
                {destinations.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
              <label className="quantity-field">
                Quantidade
                <input
                  aria-label="Quantidade de mercadoria"
                  placeholder="Informe"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <span>
                  {selected
                    ? products[selected.product].unit
                    : product
                      ? products[product as ProductId].unit
                      : 'unidade do item'}
                </span>
              </label>
              <small>
                Os filtros começam sem escolhas. O contexto só é preenchido quando você decide
                comprar.
              </small>
            </div>
            <div className="market-grid">
              <Panel
                title="Ofertas de fornecedores"
                subtitle={`${offers.length} ofertas · valores na unidade de cada mercadoria`}
                action={<Badge tone="blue">Estoque finito</Badge>}
              >
                {offers.length ? (
                  <div className="table-scroll">
                    <table className="market-table">
                      <thead>
                        <tr>
                          <th>Fornecedor / mercadoria</th>
                          <th>Origem</th>
                          <th className="numeric">Disponível</th>
                          <th className="numeric">Preço / unidade</th>
                          {mode === 'Avançada' && (
                            <>
                              <th className="numeric">Distância</th>
                              <th className="numeric">Frete / carga</th>
                              <th className="numeric">Total / unidade</th>
                            </>
                          )}
                          <th aria-label="Selecionar" />
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((o) => {
                          const e = world.establishments.find((e) => e.id === o.establishmentId)!,
                            p = world.properties.find((p) => p.id === e.propertyId)!,
                            stock = e.inventory[o.product] ?? 0,
                            q =
                              destination && validAmount
                                ? quote(
                                    world,
                                    e.id,
                                    destination.id,
                                    o.product,
                                    amount,
                                    'transbrasil',
                                  )
                                : undefined;
                          return (
                            <tr key={o.id} className={offerId === o.id ? 'selected-row' : ''}>
                              <td>
                                <div className="table-name">
                                  <i className="table-icon">
                                    <CategoryIcon category={e.category} />
                                  </i>
                                  <div>
                                    <strong>{e.name}</strong>
                                    <small>{products[o.product].name}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {p.city}
                                <small>{p.state}</small>
                              </td>
                              <td className="numeric">
                                {num(stock, 1)} {products[o.product].unit}
                              </td>
                              <td className="numeric">
                                {cr(o.price)} / {products[o.product].unit}
                              </td>
                              {mode === 'Avançada' && (
                                <>
                                  <td className="numeric">
                                    {q ? `${num(q.distanceKm, 1)} km` : 'Escolha destino'}
                                    <small>
                                      {q?.source === 'osrm' ? 'Rodoviária' : q ? 'Estimada' : ''}
                                    </small>
                                  </td>
                                  <td className="numeric">{q ? cr(q.price) : '—'}</td>
                                  <td className="numeric">
                                    {q ? cr(o.price + q.price / amount) : '—'}
                                  </td>
                                </>
                              )}
                              <td>
                                <button
                                  className={offerId === o.id ? 'primary' : 'secondary'}
                                  disabled={stock <= 0}
                                  onClick={() => setOffer(o.id)}
                                >
                                  {offerId === o.id
                                    ? 'Selecionado'
                                    : stock > 0
                                      ? 'Selecionar'
                                      : 'Sem estoque'}
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
                    title="Nenhuma oferta atende à busca"
                    description="Amplie os filtros ou consulte novamente após a próxima produção."
                    action={
                      <button className="secondary" onClick={clear}>
                        Limpar filtros
                      </button>
                    }
                  />
                )}
                <div className="panel-content">
                  <p className="muted small icon-paragraph">
                    <Info size={17} />
                    Compare preços somente na mesma unidade e canal. Frete e disponibilidade podem
                    mudar o melhor fornecedor.
                  </p>
                </div>
              </Panel>
              <Panel title="Sua compra" className="purchase-summary">
                {selected && seller ? (
                  <div className="panel-content">
                    <Badge tone="blue">{products[selected.product].name}</Badge>
                    <h2>{seller.name}</h2>
                    <button className="text-button" onClick={() => setAnalysis(selected.product)}>
                      <ChartNoAxesCombined size={15} /> Ver análise da mercadoria
                    </button>
                    <Rows
                      rows={[
                        {
                          label: 'Qualidade disponível',
                          value: `${num(inventoryQuality(seller, selected.product))}/100 · média do estoque`,
                        },
                        {
                          label: 'Preço unitário',
                          value: `${cr(selected.price)} / ${products[selected.product].unit}`,
                        },
                        { label: 'Destino', value: destination?.name ?? 'Selecione um destino' },
                        {
                          label: 'Quantidade',
                          value: validAmount
                            ? `${num(amount)} ${products[selected.product].unit}`
                            : 'Informe a quantidade',
                        },
                        { label: 'Subtotal', value: validAmount ? cr(cost) : '—' },
                        {
                          label: 'Frete estimado',
                          value: loading
                            ? 'Calculando rota…'
                            : freight
                              ? cr(freight.price)
                              : 'Preencha o contexto',
                        },
                      ]}
                    />
                    {freight && (
                      <div className="total-row">
                        <strong>Total estimado</strong>
                        <strong>{cr(cost + freight.price)}</strong>
                      </div>
                    )}
                    <button
                      className="primary full"
                      disabled={
                        !destination ||
                        !validAmount ||
                        loading ||
                        !freight?.compatible ||
                        (seller.inventory[selected.product] ?? 0) < amount
                      }
                      onClick={() => {
                        openMarket({
                          product: selected.product,
                          offerId: selected.id,
                          quantity: amount,
                          destinationId: destination!.id,
                        });
                        navigate('logistics', true);
                      }}
                    >
                      <Truck size={16} /> Continuar para frete <ArrowRight size={14} />
                    </button>
                    {validAmount && freight && !freight.compatible && (
                      <p className="warning-text small">
                        A frota disponível não comporta esta massa e volume. Compare outra
                        transportadora ou reduza a quantidade.
                      </p>
                    )}
                    <p className="muted small">
                      O pagamento só ocorre após escolher a transportadora e confirmar o valor
                      total.
                    </p>
                  </div>
                ) : (
                  <Empty
                    title="Compare antes de escolher"
                    description="Selecione uma oferta para montar a compra. Nenhum fornecedor é escolhido automaticamente."
                  />
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
      {advanced && (
        <Modal title="Filtros avançados de fornecedores" onClose={() => setAdvanced(false)}>
          <label className="field">
            Estado de origem
            <Select
              label="Estado de origem"
              value={sourceState}
              onChange={(e) => setSourceState(e.target.value)}
            >
              <option value="">Qualquer estado</option>
              {[...new Set(world.properties.map((p) => p.state))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label className="field">
            Tipo de fornecedor
            <Select
              label="Tipo de fornecedor"
              value={supplierType}
              onChange={(e) => setSupplierType(e.target.value)}
            >
              <option value="">Sem preferência</option>
              <option value="bot">Empresa automatizada</option>
              <option value="player">Empresa de jogador</option>
            </Select>
          </label>
          <label className="field">
            Distância máxima ao destino (km)
            <input
              type="number"
              min="0"
              placeholder="Sem limite"
              value={maxDistance}
              disabled={!destination}
              onChange={(e) => setMaxDistance(e.target.value)}
            />
          </label>
          <label className="field">
            Preço máximo por unidade (R$)
            <input
              type="number"
              min="0"
              step=".01"
              placeholder="Sem limite"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
          <button className="primary full" onClick={() => setAdvanced(false)}>
            Aplicar filtros
          </button>
        </Modal>
      )}
      {analysis && (
        <ProductAnalysisModal product={analysis} onClose={() => setAnalysis(undefined)} />
      )}
    </>
  );
}
