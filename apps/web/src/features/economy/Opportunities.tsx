import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpRight, Box, Globe2, Info } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Empty, Modal, PageHeading, Panel, Select, Tabs } from '../../components/ui';
import { WorldMap } from '../../components/WorldMap';
import { ProductAnalysisModal } from '../../components/ProductAnalysis';
import { EconomicChart } from '../../components/EconomicChart';
import {
  products,
  type ProductId,
  seasonProducts,
} from '../../../../../packages/simulation/src/model';
import { marketView, seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { regions } from '../../../../../packages/world/src/regions';
import '../../economy.css';

export function OpportunitiesPage() {
  const { world } = useGame();
  const [mode, setMode] = useState('Simplificada'),
    [category, setCategory] = useState(''),
    [product, setProduct] = useState(''),
    [state, setState] = useState(''),
    [region, setRegion] = useState(''),
    [search, setSearch] = useState('');
  const [advanced, setAdvanced] = useState(false),
    [minimumStock, setMinimumStock] = useState(''),
    [maximumPrice, setMaximumPrice] = useState(''),
    [onlyOffers, setOnlyOffers] = useState(false),
    [radius, setRadius] = useState(''),
    [metric, setMetric] = useState<'price' | 'demand' | 'stock' | 'coverage'>('demand'),
    [analysis, setAnalysis] = useState<ProductId>();
  const scope = region || (state ? `state:${state}` : '');
  const radiusKm = Math.min(1000, Math.max(1, Number(radius) || 120));
  const rows = useMemo(
    () => seasonProducts(world).map((id) => marketView(world, id, scope, radiusKm)),
    [world.revision, scope, radiusKm],
  );
  const visible = rows.filter(
    (row) =>
      (!category || products[row.product].category === category) &&
      (!product || row.product === product) &&
      (!search ||
        products[row.product].name
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR'))) &&
      (!onlyOffers || row.stock > 0) &&
      (!minimumStock || row.stock >= Number(minimumStock)) &&
      (!maximumPrice || (row.price !== null && row.price <= Number(maximumPrice) * 100)),
  );
  const categories = [...new Set(Object.values(products).map((p) => p.category))];
  const selectedRegion = regions.find((r) => r.id === region),
    activeFilters = [
      category,
      product,
      state,
      region,
      search,
      minimumStock,
      maximumPrice,
      radius,
      onlyOffers,
    ].filter(Boolean).length;
  const clear = () => {
    setCategory('');
    setProduct('');
    setState('');
    setRegion('');
    setSearch('');
    setMinimumStock('');
    setMaximumPrice('');
    setOnlyOffers(false);
    setRadius('');
  };
  const availableValue = visible.reduce((n, r) => n + r.stock * (r.price ?? 0), 0),
    tradedValue = visible.reduce((n, r) => n + r.tradedValue, 0);
  const mapProduct = (product as ProductId) || undefined,
    mapMetric = metric === 'price' && !mapProduct ? 'stock' : metric;
  const viewLabel =
    mapMetric === 'price'
      ? `Preço das ofertas em R$ / ${products[mapProduct!].unit}`
      : mapMetric === 'stock'
        ? mapProduct
          ? `Estoque em ${products[mapProduct].unit}`
          : 'Valor anunciado em R$'
        : mapMetric === 'coverage'
          ? 'Cobertura em dias'
          : mapProduct
            ? `Demanda em ${products[mapProduct].unit}/dia`
            : 'Demanda modelada em R$/dia';
  return (
    <>
      <PageHeading
        eyebrow="Inteligência econômica / Mercado interno"
        title="Análise de oportunidades"
        description="Compare preços e disponibilidade do jogo. Comece pela visão geral e aprofunde cada mercadoria."
        action={<Tabs values={['Simplificada', 'Avançada']} value={mode} onChange={setMode} />}
      />
      <div className="page-body economic-page">
        <div className="season-strip">
          <span className="season-dot" />
          <strong>{world.season.name}</strong>
          <span>Economia interna em reais</span>
          <Badge tone="blue">Abertura {world.season.config.version}</Badge>
          <span className="season-explanation">Sem cotações externas durante a temporada</span>
        </div>
        <div className="economic-filter-panel">
          <label className="search-input">
            <Search size={17} />
            <input
              aria-label="Buscar mercadoria"
              placeholder="Buscar mercadoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select
            label="Categoria de oportunidade"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setProduct('');
              setMinimumStock('');
              setMaximumPrice('');
            }}
          >
            <option value="">Categoria (opcional)</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select
            label="Mercadoria de oportunidade"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">Mercadoria (opcional)</option>
            {seasonProducts(world)
              .map((id) => [id, products[id]] as const)
              .filter(([, p]) => !category || p.category === category)
              .map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
          </Select>
          <Select
            label="Estado de oportunidade"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setRegion('');
            }}
          >
            <option value="">Estado (opcional)</option>
            {[...new Set(regions.map((r) => r.state))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select
            label="Município de oportunidade"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">Município (opcional)</option>
            {regions
              .filter((r) => !state || r.state === state)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
          <button className="secondary" onClick={() => setAdvanced(true)}>
            <SlidersHorizontal size={16} /> Filtros avançados{' '}
            {activeFilters > 0 && <i className="filter-count">{activeFilters}</i>}
          </button>
          {activeFilters > 0 && (
            <button className="text-button" onClick={clear}>
              <X size={14} /> Limpar
            </button>
          )}
        </div>
        <div className="economic-summary">
          <div>
            <Box size={17} />
            <span>Mercadorias</span>
            <strong>{visible.length}</strong>
          </div>
          <div>
            <span>Ofertas com estoque</span>
            <strong>{visible.reduce((n, r) => n + r.offers.length, 0)}</strong>
          </div>
          <div>
            <span>Valor anunciado</span>
            <strong>{cr(availableValue)}</strong>
          </div>
          <div>
            <span>Negociado no mundo</span>
            <strong>{cr(tradedValue)}</strong>
          </div>
        </div>
        <div className="economic-map-grid">
          <Panel
            title="Mapa da economia"
            subtitle={
              selectedRegion
                ? `${selectedRegion.name} · raio econômico de ${radiusKm} km`
                : state
                  ? `Praças piloto de ${state} · indicadores comparáveis`
                  : 'Praças piloto · indicadores comparáveis'
            }
            action={
              <Select
                label="Indicador do mapa econômico"
                value={metric}
                onChange={(e) => setMetric(e.target.value as typeof metric)}
              >
                <option value="demand">Demanda do jogo</option>
                <option value="stock">Estoque anunciado</option>
                <option value="coverage">Cobertura em dias</option>
                <option value="price" disabled={!mapProduct}>
                  Preço por unidade
                </option>
              </Select>
            }
            className="economic-map-panel"
          >
            <div className="economic-map">
              <WorldMap
                economic={{
                  product: mapProduct,
                  metric: mapMetric,
                  radiusKm,
                  state,
                }}
                onRegionSelect={setRegion}
              />
              <div className="economic-map-key">
                <Globe2 size={16} />
                <span>{viewLabel}</span>
                <span className="intensity-legend">
                  Menor <i /> Maior
                </span>
              </div>
            </div>
            <div className="economic-map-footer">
              <Info size={14} />
              <span>
                Clique numa praça para analisar. Demanda é modelada; preços e negócios vêm do jogo.
              </span>
            </div>
          </Panel>
          <Panel
            title={
              mode === 'Avançada'
                ? 'Valor em estoque por mercadoria'
                : 'Como encontrar uma oportunidade'
            }
            className="economic-guidance"
          >
            {mode === 'Avançada' ? (
              <>
                <EconomicChart
                  label="Valor dos estoques anunciados, em reais"
                  height={300}
                  option={{
                    grid: { left: 105, right: 30, top: 20, bottom: 40 },
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    xAxis: {
                      type: 'value',
                      name: 'R$ em estoque',
                      axisLabel: {
                        color: '#8fafbf',
                        formatter: (v: number) =>
                          v.toLocaleString('pt-BR', { notation: 'compact' }),
                      },
                      splitLine: { lineStyle: { color: '#2b424f' } },
                    },
                    yAxis: {
                      type: 'category',
                      data: visible.map((r) => products[r.product].name),
                      axisLabel: {
                        color: '#aec4ce',
                        width: 90,
                        overflow: 'truncate',
                        fontSize: 10,
                      },
                    },
                    series: [
                      {
                        type: 'bar',
                        data: visible.map((r) => Math.round((r.stock * (r.price ?? 0)) / 100)),
                        barMaxWidth: 14,
                        itemStyle: { color: '#67b7ba', borderRadius: [0, 3, 3, 0] },
                      },
                    ],
                  }}
                />
                <p className="chart-caption">
                  Cada quantidade é convertida em reais pela própria unidade. Não somamos toneladas
                  e embalagens.
                </p>
              </>
            ) : (
              <div className="economic-playbook">
                <div>
                  <span>1</span>
                  <h3>Compare o custo no destino</h3>
                  <p>Preço, frete e prazo precisam caber na margem da operação.</p>
                </div>
                <div>
                  <span>2</span>
                  <h3>Observe a disponibilidade</h3>
                  <p>Estoque curto pode sinalizar procura ou abastecimento interrompido.</p>
                </div>
                <div>
                  <span>3</span>
                  <h3>Confira as premissas</h3>
                  <p>Demanda alta não garante lucro. “Ver mais” revela os números e o método.</p>
                </div>
              </div>
            )}
          </Panel>
        </div>
        <div className="section-title catalog-heading">
          <div>
            <h2>Mercadorias da temporada</h2>
            <p>
              {visible.length} de {seasonProducts(world).length} itens · preços por unidade
              comercial
            </p>
          </div>
          <Badge tone="muted">{selectedRegion ? selectedRegion.name : 'Todas as praças'}</Badge>
        </div>
        {visible.length ? (
          mode === 'Simplificada' ? (
            <div className="commodity-grid">
              {visible.map((row) => {
                const p = products[row.product];
                return (
                  <article className="commodity-card" key={row.product}>
                    <div className="commodity-title">
                      <i className="table-icon">
                        <Box size={19} />
                      </i>
                      <div>
                        <h3>{p.name}</h3>
                        <small>
                          {p.category} · {p.unit === 'un' ? 'embalagem' : p.unit}
                        </small>
                      </div>
                      {row.variation !== null && (
                        <span className={`price-change ${row.variation >= 0 ? 'up' : 'down'}`}>
                          {row.variation >= 0 ? '+' : ''}
                          {num(row.variation, 1)}%
                        </span>
                      )}
                    </div>
                    <div className="commodity-price">
                      <strong>{row.price === null ? 'Sem oferta' : cr(row.price)}</strong>
                      <span>/ {p.unit}</span>
                    </div>
                    <div className="commodity-facts">
                      <span>
                        Abertura <b>{cr(seasonPrice(world, row.product))}</b>
                      </span>
                      <span>
                        Disponível{' '}
                        <b>
                          {num(row.stock, 1)} {p.unit}
                        </b>
                      </span>
                      <span>
                        Fornecedores <b>{row.suppliers}</b>
                      </span>
                    </div>
                    <button
                      className="secondary full"
                      aria-label={`Ver mais sobre ${p.name}`}
                      onClick={() => setAnalysis(row.product)}
                    >
                      Ver mais <ArrowUpRight size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <Panel>
              <div className="table-scroll">
                <table className="economic-catalog">
                  <thead>
                    <tr>
                      <th>Mercadoria / unidade</th>
                      <th className="numeric">Oferta média</th>
                      <th className="numeric">Menor / maior</th>
                      <th className="numeric">Abertura</th>
                      <th className="numeric">Estoque</th>
                      <th className="numeric">Demanda / dia</th>
                      <th className="numeric">Negociado</th>
                      <th aria-label="Análise" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => (
                      <tr key={row.product}>
                        <td>
                          <strong>{products[row.product].name}</strong>
                          <small>
                            {products[row.product].unit} · {products[row.product].category}
                          </small>
                        </td>
                        <td className="numeric">
                          {row.price === null ? 'Sem oferta' : cr(row.price)}
                        </td>
                        <td className="numeric">
                          {row.low === null ? '—' : `${cr(row.low)} / ${cr(row.high!)}`}
                        </td>
                        <td className="numeric">{cr(seasonPrice(world, row.product))}</td>
                        <td className="numeric">
                          {num(row.stock, 1)} {products[row.product].unit}
                        </td>
                        <td className="numeric">
                          {num(row.demand, 1)} {products[row.product].unit}
                        </td>
                        <td className="numeric">{cr(row.tradedValue)}</td>
                        <td>
                          <button className="secondary" onClick={() => setAnalysis(row.product)}>
                            Analisar <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )
        ) : (
          <Empty
            title="Nenhuma mercadoria atende aos filtros"
            description="Remova um limite de preço, estoque ou categoria para ampliar a análise."
            action={
              <button className="secondary" onClick={clear}>
                Limpar filtros
              </button>
            }
          />
        )}
        <p className="economic-disclaimer">
          <Info size={14} /> A variação compara a oferta atual com o valor de abertura. Não é
          variação diária nem cotação do mercado brasileiro.
        </p>
      </div>
      {advanced && (
        <Modal title="Filtros avançados de mercado" onClose={() => setAdvanced(false)}>
          <p>Todos os campos são opcionais. Preço e quantidade respeitam a unidade de cada item.</p>
          <label className="field">
            Estoque mínimo
            <input
              aria-label="Estoque mínimo"
              type="number"
              min="0"
              placeholder="Sem mínimo"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
            />
          </label>
          <label className="field">
            Preço máximo por unidade (R$)
            <input
              aria-label="Preço máximo por unidade"
              type="number"
              min="0"
              step=".01"
              placeholder="Sem limite"
              value={maximumPrice}
              onChange={(e) => setMaximumPrice(e.target.value)}
            />
          </label>
          <label className="field">
            Raio econômico da praça (km)
            <input
              aria-label="Raio econômico"
              type="number"
              min="10"
              max="1000"
              placeholder="Padrão do modelo: 120 km"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={onlyOffers}
              onChange={(e) => setOnlyOffers(e.target.checked)}
            />{' '}
            Apenas itens com ofertas disponíveis
          </label>
          <div className="modal-actions">
            <button className="secondary" onClick={clear}>
              Limpar todos
            </button>
            <button className="primary" onClick={() => setAdvanced(false)}>
              Aplicar filtros
            </button>
          </div>
        </Modal>
      )}
      {analysis && (
        <ProductAnalysisModal
          product={analysis}
          regionId={scope}
          radiusKm={radiusKm}
          advanced={mode === 'Avançada'}
          onClose={() => setAnalysis(undefined)}
        />
      )}
    </>
  );
}
