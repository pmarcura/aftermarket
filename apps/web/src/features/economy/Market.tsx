import { useMemo, useState } from 'react';
import {
  Search,
  Truck,
  Info,
  SlidersHorizontal,
  X,
  ChartNoAxesCombined,
  ShoppingCart,
} from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { PageHeading, Panel, Select, Badge, Rows, Empty, Modal, Tabs } from '../../components/ui';
import { SecaoAbas } from '../../components/SecaoAbas';
import { ProductAnalysisModal } from '../../components/ProductAnalysis';
import {
  products,
  type ProductId,
  seasonProducts,
} from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useRoute } from '../../lib/routing';
import '../../economy.css';
import { Orders } from '../business/Orders';
import { BotActivity } from '../business/BotActivity';
import { InfrastructureContracts } from '../business/InfrastructureContracts';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import {
  householdDemand,
  regionFor,
  seasonPrice,
} from '../../../../../packages/simulation/src/metrics';
import { freeCash } from '../../../../../packages/simulation/src/design';
import { Carga, unidade } from './Carga';
import { Vitrine, ProdutoArte } from './Vitrine';
import { PixelArt } from '../../components/PixelArt';
import { spriteDoNegocio } from '../../design/arte';
import { avaliar, procuraDiaria, quantidadeSugerida, type Avaliacao } from './compra';

export function MarketPage() {
  const { world, actor, intent, navigate, openMarket, refresh, run, pending } = useGame();
  const meus = world.establishments.filter((e) => e.companyId === actor);
  const [product, setProduct] = useState(intent.product ?? ''),
    [supplierId, setSupplier] = useState(intent.supplierId ?? ''),
    [quantity, setQuantity] = useState(String(intent.quantity ?? '')),
    [destinationId, setDestination] = useState(
      intent.destinationId ?? meus.find((e) => e.category === 'retail')?.id ?? meus[0]?.id ?? '',
    ),
    [offerId, setOffer] = useState(intent.offerId ?? ''),
    [sort, setSort] = useState('');
  const [advanced, setAdvanced] = useState(false),
    [maxDistance, setMaxDistance] = useState(''),
    [maxPrice, setMaxPrice] = useState(''),
    [sourceState, setSourceState] = useState(''),
    [supplierType, setSupplierType] = useState(''),
    [search, setSearch] = useState(''),
    [mode, setMode] = useState('Simplificada'),
    [analysis, setAnalysis] = useState<ProductId>(),
    [allProducts, setAllProducts] = useState(false);
  const destinations = world.establishments.filter((e) => e.companyId === actor),
    destination = destinations.find((e) => e.id === destinationId),
    selected = world.offers.find((o) => o.id === offerId),
    seller = world.establishments.find((e) => e.id === selected?.establishmentId),
    amount = Number(quantity),
    validAmount = Number.isInteger(amount) && amount > 0;
  // Com um destino escolhido, o mercado mostra primeiro o que ele usa: a loja, o que as famílias
  // compram; a produção, os insumos e o rebanho da receita.
  const recipe = world.season.config.recipes.find((r) => r.id === destination?.specialization);
  const relevant: Set<string> | undefined =
    destination?.category === 'retail'
      ? new Set(householdItems(world))
      : recipe
        ? new Set([...Object.keys(recipe.input), ...Object.keys(recipe.requires ?? {})])
        : undefined;
  const retailDestination = destination?.category === 'retail';
  // Quantidade sugerida ao escolher uma oferta: 7 dias de procura da loja na cidade (compras
  // menores pagam frete mínimo demais), ou 4 lotes
  // do insumo da receita; nunca acima do estoque do fornecedor.
  const suggest = (id: ProductId, stock: number) => {
    if (!destination || !dp) return 0;
    const stores = world.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        world.properties.find((p) => p.id === x.propertyId)!.city === dp.city,
    ).length;
    const want = retailDestination
      ? (householdDemand(world, regionFor(world, dp.coordinates, dp.city).id, id) * 7) /
        Math.max(1, stores)
      : (recipe?.input[id] ?? recipe?.requires?.[id] ?? 0) * 4;
    return Math.max(0, Math.min(Math.floor(stock), Math.ceil(want)));
  };
  const order = seasonProducts(world);
  const sp = world.properties.find((p) => p.id === seller?.propertyId),
    dp = world.properties.find((p) => p.id === destination?.propertyId);
  const loading = useRoute(sp?.id, dp?.id);
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
        (product || allProducts || !relevant || relevant.has(o.product)) &&
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
      // Sem ordenação escolhida: agrupa por mercadoria, mais barata primeiro.
      if (!sort) return order.indexOf(a.product) - order.indexOf(b.product) || a.price - b.price;
      if (!destination || !validAmount || (sort === 'total' && !product)) return 0;
      const qa = quote(world, a.establishmentId, destination.id, a.product, amount, 'transbrasil'),
        qb = quote(world, b.establishmentId, destination.id, b.product, amount, 'transbrasil');
      return sort === 'distance'
        ? qa.distanceKm - qb.distanceKm
        : a.price * amount + qa.price - b.price * amount - qb.price;
    });
  const estoqueDe = (o: (typeof offers)[number]) =>
    world.establishments.find((e) => e.id === o.establishmentId)!.inventory[o.product] ?? 0;
  // Cada oferta com a própria quantidade sugerida e o frete mais barato até o destino.
  const chave = `${world.revision}|${destinationId}|${offerId}|${quantity}|${offers.map((o) => o.id).join()}`;
  const avaliacoes = useMemo(() => {
    const m = new Map<string, Avaliacao>();
    if (!destination) return m;
    for (const o of offers) {
      const estoque = estoqueDe(o);
      if (estoque <= 0) continue;
      const q =
        o.id === offerId && validAmount
          ? amount
          : quantidadeSugerida(world, destination, o.product, estoque);
      const a = avaliar(world, actor, o, destination, q);
      if (a) m.set(o.id, a);
    }
    return m;
    // A chave resume tudo o que muda a conta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const semEstoque = destination ? offers.filter((o) => estoqueDe(o) <= 0).length : 0;
  const lista = destination ? offers.filter((o) => estoqueDe(o) > 0) : offers;
  if (destination && !sort)
    lista.sort((a, b) => {
      const x = avaliacoes.get(a.id),
        y = avaliacoes.get(b.id);
      if (!x || !y) return Number(Boolean(y)) - Number(Boolean(x));
      return retailDestination
        ? (y.margem ?? 0) - (x.margem ?? 0)
        : order.indexOf(a.product) - order.indexOf(b.product) || x.naPorta - y.naPorta;
    });
  const compra =
    selected && destination && validAmount
      ? avaliar(world, actor, selected, destination, amount)
      : undefined;
  const caixa = freeCash(world, actor);
  // Com destino escolhido, a lista simplificada junta origem ao fornecedor e preço ao custo na porta.
  const compacto = Boolean(destination) && mode === 'Simplificada';
  const vitrineAtiva = Boolean(destination) && mode === 'Simplificada' && !product && !search;
  const comprar = async () => {
    if (!selected || !destination || !compra?.frete) return;
    const minutos = Math.max(1, Math.round(compra.frete.durationMs / 60000));
    if (
      await run(
        {
          type: 'trade',
          offerId: selected.id,
          quantity: amount,
          destinationId: destination.id,
          carrierId: compra.frete.carrierId,
          expectedTotal: compra.total,
        },
        `Comprado: ${num(amount)} ${products[selected.product].name}. A carga chega em cerca de ${minutos} min.`,
      )
    )
      setOffer('');
  };
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
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Comprar mercadorias"
        description="Escolha para onde vai a carga e o que comprar. Todo preço já inclui o frete até a sua porta."
        action={<Tabs values={['Simplificada', 'Avançada']} value={mode} onChange={setMode} />}
      />
      <div className="page-body">
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
            <div className="comprar-para" role="group" aria-label="Comprar para">
              <span>Comprar para</span>
              {destinations.map((e) => {
                const p = world.properties.find((p) => p.id === e.propertyId)!;
                return (
                  <button
                    key={e.id}
                    aria-pressed={e.id === destinationId}
                    className={e.id === destinationId ? 'on' : ''}
                    onClick={() => {
                      setDestination(e.id);
                      setOffer('');
                      setQuantity('');
                    }}
                  >
                    <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
                    <span>
                      <b>{e.name}</b>
                      <small>{p.city}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            {mode === 'Avançada' && (
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
                  {seasonProducts(world)
                    .map((id) => [id, products[id]] as const)
                    .map(([id, p]) => (
                      <option value={id} key={id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
                <Select
                  label="Ordenar ofertas"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
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
            )}
            <div className={`market-grid ${vitrineAtiva && !selected ? 'sem-compra' : ''}`}>
              {vitrineAtiva && destination ? (
                <Vitrine
                  destino={destination}
                  ofertas={lista}
                  avaliacoes={avaliacoes}
                  relevantes={relevant}
                  escolhida={offerId}
                  onComprar={(o) => {
                    setOffer(o.id);
                    const q = avaliacoes.get(o.id)?.quantidade;
                    if (q) setQuantity(String(q));
                  }}
                />
              ) : (
                <Panel
                  title="Ofertas de fornecedores"
                  subtitle={
                    destination && !sort
                      ? `${lista.length} ofertas com estoque · ${retailDestination ? 'mais lucrativas primeiro' : 'menor custo na porta primeiro'}, já com frete${semEstoque ? ` · ${semEstoque} sem estoque escondidas` : ''}`
                      : `${lista.length} ofertas · valores na unidade de cada mercadoria`
                  }
                  action={
                    relevant && !product ? (
                      <button className="text-button" onClick={() => setAllProducts(!allProducts)}>
                        {allProducts ? 'Só o que este destino usa' : 'Mostrar todos os produtos'}
                      </button>
                    ) : (
                      <Badge tone="blue">Estoque finito</Badge>
                    )
                  }
                >
                  {lista.length ? (
                    <div className="table-scroll">
                      <table className="market-table">
                        <thead>
                          <tr>
                            <th>Fornecedor / mercadoria</th>
                            {!compacto && <th>Origem</th>}
                            <th className="numeric">Disponível</th>
                            {!compacto && <th className="numeric">Preço / unidade</th>}
                            {destination && <th className="numeric">Na sua porta</th>}
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
                          {lista.map((o) => {
                            const e = world.establishments.find((e) => e.id === o.establishmentId)!,
                              p = world.properties.find((p) => p.id === e.propertyId)!,
                              stock = e.inventory[o.product] ?? 0,
                              aval = avaliacoes.get(o.id),
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
                                      <ProductIcon product={o.product} size={17} />
                                    </i>
                                    <div>
                                      <strong>{e.name}</strong>
                                      <small>
                                        {products[o.product].name}
                                        {compacto && ` · ${p.city} ${p.state}`}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                {!compacto && (
                                  <td>
                                    {p.city}
                                    <small>{p.state}</small>
                                  </td>
                                )}
                                <td className="numeric">
                                  {num(stock, 1)} {products[o.product].unit}
                                </td>
                                {!compacto && (
                                  <td className="numeric">
                                    {cr(o.price)} / {products[o.product].unit}
                                  </td>
                                )}
                                {destination && (
                                  <td className="numeric">
                                    {aval ? (
                                      <>
                                        {cr(aval.naPorta)} / {products[o.product].unit}
                                        {compacto && (
                                          <small className="muted">
                                            {cr(o.price)} + frete {cr(aval.naPorta - o.price)}
                                          </small>
                                        )}
                                        <small>
                                          {aval.margem !== undefined ? (
                                            <Badge tone={aval.margem >= 0 ? 'green' : 'red'}>
                                              margem {aval.margem >= 0 ? '+' : '−'}
                                              {num(Math.abs(aval.margem) * 100)}% ·{' '}
                                              {num(aval.quantidade)} {products[o.product].unit}
                                            </Badge>
                                          ) : (
                                            `com frete, ${num(aval.quantidade)} ${products[o.product].unit}`
                                          )}
                                        </small>
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                )}
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
                                    onClick={() => {
                                      setOffer(o.id);
                                      const next = aval?.quantidade || suggest(o.product, stock);
                                      if (next > 0) setQuantity(String(next));
                                    }}
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
              )}
              <Panel title="Sua compra" className="purchase-summary">
                {selected && seller ? (
                  <div className="panel-content">
                    <div className="compra-cab">
                      <ProdutoArte product={selected.product} escala={1} />
                      <div>
                        <h2>{products[selected.product].name}</h2>
                        <small>
                          de {seller.name},{' '}
                          {world.properties.find((p) => p.id === seller.propertyId)?.city}
                          {' · '}qualidade {num(inventoryQuality(seller, selected.product))}/100
                        </small>
                        <button
                          className="text-button"
                          onClick={() => setAnalysis(selected.product)}
                        >
                          <ChartNoAxesCombined size={14} /> Preço ao longo do tempo
                        </button>
                      </div>
                    </div>
                    {retailDestination && destination && (
                      <div className="compra-dias" role="group" aria-label="Dias de estoque">
                        {[7, 15, 30].map((d, i, todos) => {
                          const estoque = seller.inventory[selected.product] ?? 0;
                          const anterior =
                            i > 0
                              ? quantidadeSugerida(
                                  world,
                                  destination,
                                  selected.product,
                                  estoque,
                                  todos[i - 1],
                                )
                              : -1;
                          const q = quantidadeSugerida(
                            world,
                            destination,
                            selected.product,
                            seller.inventory[selected.product] ?? 0,
                            d,
                          );
                          const repetido = q === anterior;
                          const a =
                            q && !repetido
                              ? avaliar(world, actor, selected, destination, q)
                              : undefined;
                          return (
                            <button
                              key={d}
                              className={q > 0 && !repetido && amount === q ? 'on' : ''}
                              aria-pressed={q > 0 && !repetido && amount === q}
                              disabled={!q || repetido}
                              onClick={() => setQuantity(String(q))}
                            >
                              <b>{d} dias</b>
                              <small>
                                {repetido
                                  ? 'acabou o estoque'
                                  : `${num(q)} ${products[selected.product].unit}`}
                              </small>
                              {a?.margem !== undefined && (
                                <small className={a.margem >= 0 ? 'positive' : 'negative'}>
                                  {a.margem >= 0 ? '+' : '−'}
                                  {num(Math.abs(a.margem) * 100)}%
                                </small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {(() => {
                      const outros = lista.filter(
                        (o) => o.product === selected.product && avaliacoes.has(o.id),
                      );
                      return outros.length > 1 ? (
                        <div
                          className="compra-fornecedores"
                          role="radiogroup"
                          aria-label="Fornecedor"
                        >
                          {outros.map((o) => {
                            const v = world.establishments.find((e) => e.id === o.establishmentId)!;
                            const c = world.properties.find((p) => p.id === v.propertyId)!;
                            const a = avaliacoes.get(o.id)!;
                            return (
                              <button
                                key={o.id}
                                role="radio"
                                aria-checked={o.id === offerId}
                                className={o.id === offerId ? 'on' : ''}
                                onClick={() => {
                                  setOffer(o.id);
                                  setQuantity(String(a.quantidade));
                                }}
                              >
                                <b>{v.name}</b>
                                <small>{c.city}</small>
                                <span>
                                  {cr(a.naPorta)} por {unidade(o.product, 1)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null;
                    })()}
                    <label className="compra-qtd">
                      Quantidade
                      <input
                        aria-label="Quantidade de mercadoria"
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                      <span>{products[selected.product].unit}</span>
                    </label>
                    {loading && <p className="muted small">Calculando a rota do caminhão…</p>}
                    {compra?.frete && destination && (
                      <Carga
                        frete={compra.frete}
                        product={selected.product}
                        quantidade={amount}
                        origem={seller}
                        destino={destination}
                        estoque={seller.inventory[selected.product] ?? 0}
                        precoUnidade={selected.price}
                        precoVenda={
                          retailDestination ? seasonPrice(world, selected.product) : undefined
                        }
                        onQuantidade={(q) => setQuantity(String(q))}
                      />
                    )}
                    {compra && (
                      <>
                        <div className="total-row">
                          <strong>Total na sua porta</strong>
                          <strong>{cr(compra.total)}</strong>
                        </div>
                        {compra.margem !== undefined && (
                          <p
                            className={`small ${compra.margem >= 0 ? 'positive' : 'warning-text'}`}
                          >
                            {compra.margem >= 0
                              ? `Vendendo tudo a ${cr(seasonPrice(world, selected.product))}, sobram ${num(compra.margem * 100)}% depois do frete.`
                              : `Prejuízo de ${num(-compra.margem * 100)}%: o frete pesa demais nesta quantidade. Compre para mais dias ou escolha um fornecedor mais perto.`}{' '}
                            Dura cerca de{' '}
                            {num(
                              amount /
                                Math.max(
                                  1e-9,
                                  procuraDiaria(world, destination!, selected.product),
                                ),
                            )}{' '}
                            dias na loja.
                          </p>
                        )}
                        <Rows
                          rows={[
                            { label: 'Caixa depois da compra', value: cr(caixa - compra.total) },
                          ]}
                        />
                      </>
                    )}
                    <button
                      className="primary full"
                      disabled={
                        pending ||
                        loading ||
                        !compra?.frete?.compatible ||
                        (seller.inventory[selected.product] ?? 0) < amount ||
                        caixa < (compra?.total ?? 0)
                      }
                      onClick={() => void comprar()}
                    >
                      <ShoppingCart size={16} />{' '}
                      {pending
                        ? 'Comprando…'
                        : compra
                          ? `Comprar por ${cr(compra.total)}`
                          : 'Comprar'}
                    </button>
                    {validAmount && !loading && compra && !compra.frete?.compatible && (
                      <p className="warning-text small">
                        {compra.frete?.routeRequired
                          ? 'A rota entre origem e destino ainda está sendo confirmada. Tente de novo em um minuto.'
                          : 'Nenhuma frota livre leva esta quantidade agora. Reduza a quantidade ou tente na próxima rodada.'}
                      </p>
                    )}
                    {compra && caixa < compra.total && (
                      <p className="warning-text small">
                        O caixa não cobre esta compra. Reduza a quantidade.
                      </p>
                    )}
                    <button
                      className="text-button"
                      disabled={!destination || !validAmount}
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
                      <Truck size={15} /> Escolher outra transportadora ou pedir com prazo
                    </button>
                  </div>
                ) : (
                  <Empty
                    title="Compare antes de escolher"
                    description="Escolha uma oferta. A quantidade e o frete mais barato já vêm sugeridos; você só confirma."
                  />
                )}
              </Panel>
            </div>
          </>
        )}
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
