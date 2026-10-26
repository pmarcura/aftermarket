import { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpRight, Map, MapPin, Info } from 'lucide-react';
import { useGame, num } from '../lib/game';
import {
  PageHeading,
  Panel,
  Badge,
  Select,
  LineChart,
  Modal,
  Empty,
  Progress,
} from '../components/ui';
import { WorldMap } from '../components/WorldMap';
import { regions } from '../../../../packages/world/src/regions';

export function OpportunitiesPage() {
  const { focusMap, navigate } = useGame();
  const [state, setState] = useState('SP'),
    [municipality, setMunicipality] = useState('all'),
    [category, setCategory] = useState('Alimentos'),
    [product, setProduct] = useState('Óleo vegetal');
  const [filters, setFilters] = useState({
    state: 'SP',
    municipality: 'all',
    category: 'Alimentos',
    product: 'Óleo vegetal',
    high: false,
  });
  const [selected, setSelected] = useState('3509502'),
    [advanced, setAdvanced] = useState(false),
    [high, setHigh] = useState(false);
  const list = regions
    .filter(
      (r) =>
        (!filters.state || r.state === filters.state) &&
        (filters.municipality === 'all' || r.id === filters.municipality) &&
        (!filters.high || (r.demand - r.supply) / r.demand > 0.15),
    )
    .sort((a, b) => (b.demand - b.supply) / b.demand - (a.demand - a.supply) / a.demand);
  const region = list.find((r) => r.id === selected) ?? list[0];
  const factor =
    (
      {
        'Óleo vegetal': 1,
        Arroz: 0.87,
        Feijão: 0.56,
        Leite: 0.42,
        'Aço em barras': 0.74,
        'Minério de ferro': 0.92,
      } as Record<string, number>
    )[filters.product] ?? 1;
  const apply = () => setFilters({ state, municipality, category, product, high });
  return (
    <>
      <PageHeading
        eyebrow="Inteligência de mercado / Brasil"
        title="Análise de oportunidades"
        description="Compare demanda, concorrência e fornecedores antes de investir em uma região."
      />
      <div className="page-body">
        <div className="filter-bar opportunity-filters">
          <Select
            label="Categoria"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setProduct(
                e.target.value === 'Materiais'
                  ? 'Aço em barras'
                  : e.target.value === 'Bebidas'
                    ? 'Leite'
                    : 'Óleo vegetal',
              );
            }}
          >
            <option>Alimentos</option>
            <option>Materiais</option>
            <option>Bebidas</option>
          </Select>
          <Select label="Produto" value={product} onChange={(e) => setProduct(e.target.value)}>
            {(category === 'Materiais'
              ? ['Aço em barras', 'Minério de ferro']
              : category === 'Bebidas'
                ? ['Leite']
                : ['Óleo vegetal', 'Arroz', 'Feijão']
            ).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select
            label="Estado"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setMunicipality('all');
            }}
          >
            <option value="SP">Estado: São Paulo</option>
            <option value="MG">Estado: Minas Gerais</option>
            <option value="PR">Estado: Paraná</option>
            <option value="">Todos os estados piloto</option>
          </Select>
          <Select
            label="Município"
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
          >
            <option value="all">Município: Todos</option>
            {regions
              .filter((r) => !state || r.state === state)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
          <button className="primary" onClick={apply}>
            <Search size={16} /> Buscar oportunidades
          </button>
          <button className="secondary advanced-filter" onClick={() => setAdvanced(true)}>
            <SlidersHorizontal size={16} /> Filtros avançados
          </button>
        </div>
        {region ? (
          <div className="opportunity-grid">
            <Panel
              title="Regiões com oportunidades"
              action={<small>{list.length} resultados</small>}
              className="region-panel"
            >
              <div className="region-list">
                {list.map((r) => {
                  const potential = (r.demand - r.supply) / r.demand > 0.15;
                  return (
                    <button
                      key={r.id}
                      className={`region-item ${region.id === r.id ? 'selected' : ''}`}
                      onClick={() => setSelected(r.id)}
                    >
                      <div>
                        <strong>
                          {r.name} <span>— {r.state}</span>
                        </strong>
                        <Badge tone={potential ? 'green' : 'gold'}>
                          Potencial {potential ? 'alto' : 'moderado'}
                        </Badge>
                      </div>
                      <p>
                        {filters.category} · Demanda: {num(r.demand * factor)} t · Oferta:{' '}
                        {num(r.supply * factor)} t
                      </p>
                      <small>{r.competitors} estabelecimentos concorrentes</small>
                    </button>
                  );
                })}
              </div>
              <p className="panel-footnote">Ordenado pela proporção de demanda não atendida</p>
            </Panel>
            <Panel
              title={`${region.name} — ${region.state}`}
              action={
                <Badge
                  tone={(region.demand - region.supply) / region.demand > 0.15 ? 'green' : 'gold'}
                >
                  Mercado{' '}
                  {(region.demand - region.supply) / region.demand > 0.15
                    ? 'favorável'
                    : 'moderado'}
                </Badge>
              }
              className="opportunity-main"
            >
              <div className="demand-stats">
                <div>
                  <span>Demanda mensal</span>
                  <strong>{num(region.demand * factor)} t</strong>
                  <small>volume simulado</small>
                </div>
                <div>
                  <span>Oferta mensal</span>
                  <strong>{num(region.supply * factor)} t</strong>
                  <small>capacidade do cenário</small>
                </div>
                <div>
                  <span>Demanda não atendida</span>
                  <strong className="gold-text">
                    {num((region.demand - region.supply) * factor)} t
                  </strong>
                  <small>estimativa</small>
                </div>
              </div>
              <div className="panel-content">
                <h3>Projeção da demanda — próximos 12 meses</h3>
                <LineChart
                  values={[
                    0.72, 0.76, 0.74, 0.82, 0.8, 0.86, 0.88, 0.94, 0.92, 1.02, 1.07, 1.12,
                  ].map((v) => Math.round(region.demand * factor * v))}
                />
                <p className="muted small">
                  <Info size={13} /> Projeção do modelo de jogo. Não representa estatística
                  econômica oficial.
                </p>
              </div>
              <div className="opportunity-callout">
                <div>
                  <h3>Oportunidade identificada</h3>
                  <p>
                    Demanda estimada {num(((region.demand - region.supply) / region.supply) * 100)}%
                    acima da oferta. Considere a concorrência e o custo logístico{' '}
                    {region.logistics.toLowerCase()} antes de investir.
                  </p>
                </div>
                <button className="primary" onClick={() => focusMap(region.coordinates)}>
                  <Map size={16} /> Explorar no mapa
                </button>
              </div>
            </Panel>
            <div className="right-stack">
              <Panel
                title="Concorrência e localização"
                action={
                  <button
                    className="secondary small-button"
                    onClick={() => focusMap(region.coordinates)}
                  >
                    <ArrowUpRight size={15} /> Ver região
                  </button>
                }
              >
                <div className="opportunity-mini-map">
                  <WorldMap mini center={region.coordinates} key={region.id} />
                  <span className="map-location">
                    <MapPin size={14} /> {region.name} · {region.competitors} concorrentes
                  </span>
                </div>
                <div className="panel-content">
                  <h3>Oferta por categoria</h3>
                  {[
                    ['Alimentos', 67],
                    ['Bebidas', 72],
                    ['Higiene', 43],
                    ['Materiais', 81],
                    ['Vestuário', 36],
                  ].map(([label, value]) => (
                    <div className="meter-row" key={label}>
                      <span>{label}</span>
                      <Progress value={Number(value)} />
                      <small>{value}%</small>
                    </div>
                  ))}
                  <p className="muted small divided">
                    Parâmetros iniciais do cenário. Não há garantia de demanda ou de rentabilidade.
                  </p>
                </div>
              </Panel>
              <div className="context-hint">
                <Info size={16} />
                <p>
                  O frete pode mudar toda a conta.{' '}
                  <button onClick={() => navigate('market')}>Compare fornecedores próximos.</button>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Empty
            title="Nenhuma região atende aos filtros"
            description="Amplie a busca ou remova o filtro de potencial alto."
            action={
              <button
                className="secondary"
                onClick={() => {
                  setHigh(false);
                  setFilters({ state: '', municipality: 'all', category, product, high: false });
                }}
              >
                Ampliar busca
              </button>
            }
          />
        )}
      </div>
      {advanced && (
        <Modal title="Filtros de oportunidade" onClose={() => setAdvanced(false)}>
          <label className="checkbox-line">
            <input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} />{' '}
            Mostrar apenas regiões com mais de 15% de demanda não atendida
          </label>
          <p className="muted">
            As regiões piloto são São Paulo, Minas Gerais e Paraná. Outras regiões podem ser
            exploradas no mapa.
          </p>
          <button
            className="primary full"
            onClick={() => {
              apply();
              setAdvanced(false);
            }}
          >
            Aplicar filtros
          </button>
        </Modal>
      )}
    </>
  );
}
