import { useState } from 'react';
import { Search, SlidersHorizontal, Plus, ChevronRight, Map, TriangleAlert } from 'lucide-react';
import { useGame, CategoryIcon, cr, num } from '../lib/game';
import { PageHeading, Panel, Stat, Badge, Select, Rows, Empty } from '../components/ui';
import { WorldMap } from '../components/WorldMap';
import { categoryInfo } from '../../../../packages/simulation/src/model';
import { Orders } from '../features/business/Orders';

export function BusinessesPage() {
  const { world, actor, navigate, openBusiness } = useGame();
  const [search, setSearch] = useState(''),
    [showFilter, setShowFilter] = useState(false),
    [category, setCategory] = useState('all');
  const mine = world.establishments.filter((e) => e.companyId === actor),
    visible = mine.filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) &&
        (category === 'all' || e.category === category),
    );
  const revenue = mine.reduce((n, e) => n + e.revenue, 0),
    result = revenue - mine.reduce((n, e) => n + e.expenses, 0);
  const countStates = new Set(
    mine.map((e) => world.properties.find((p) => p.id === e.propertyId)!.state),
  );
  return (
    <>
      <PageHeading
        eyebrow="Gestão / Portfólio empresarial"
        title="Meus Negócios"
        description="Acompanhe e administre seus estabelecimentos em diferentes regiões do Brasil."
      />
      <div className="page-body">
        <div className="stats-grid">
          <Stat
            label="Estabelecimentos"
            value={mine.length}
            note={`${new Set(mine.map((e) => e.category)).size} tipos de negócio`}
          />
          <Stat
            label="Receita do período"
            value={cr(revenue)}
            note="desde a abertura deste mundo"
          />
          <Stat
            label="Resultado operacional"
            value={`${result >= 0 ? '+' : '−'}${cr(Math.abs(result))}`}
            note="receitas menos custos registrados"
            positive={result >= 0}
          />
          <Stat
            label="Unidades pausadas"
            value={mine.filter((e) => !e.enabled).length}
            note="podem exigir atenção"
            gold
          />
        </div>
        <div className="businesses-grid">
          <Panel
            title="Meus estabelecimentos"
            action={
              <div className="inline-actions">
                <label className="search-input">
                  <Search size={16} />
                  <input
                    aria-label="Buscar estabelecimento"
                    placeholder="Buscar estabelecimento…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button className="secondary" onClick={() => setShowFilter(!showFilter)}>
                  <SlidersHorizontal size={15} /> Filtros
                </button>
                <button className="primary" onClick={() => navigate('map')}>
                  <Plus size={17} /> Novo estabelecimento
                </button>
              </div>
            }
          >
            {showFilter && (
              <div className="inline-filter">
                <Select
                  label="Filtrar categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">Todas as categorias</option>
                  {Object.entries(categoryInfo).map(([key, c]) => (
                    <option value={key} key={key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {visible.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Estabelecimento</th>
                      <th>Categoria</th>
                      <th>Localização</th>
                      <th className="numeric">Resultado / período</th>
                      <th>Estado</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e, i) => {
                      const p = world.properties.find((p) => p.id === e.propertyId)!;
                      const balance = e.revenue - e.expenses;
                      return (
                        <tr key={e.id}>
                          <td>
                            <div className="table-name">
                              <i className="table-icon">
                                <CategoryIcon category={e.category} />
                              </i>
                              <div>
                                <strong>{e.name}</strong>
                                <small>Unidade #{105 + i}</small>
                              </div>
                            </div>
                          </td>
                          <td>{categoryInfo[e.category].label}</td>
                          <td>
                            {p.city} — {p.state}
                          </td>
                          <td className={`numeric ${balance >= 0 ? 'positive' : 'negative'}`}>
                            {balance >= 0 ? '+' : '−'}
                            {cr(Math.abs(balance))}
                          </td>
                          <td>
                            <Badge tone={e.enabled ? 'green' : 'gold'}>
                              {e.enabled ? 'Ativo' : 'Pausado'}
                            </Badge>
                          </td>
                          <td>
                            <button className="secondary" onClick={() => openBusiness(e.id)}>
                              <ChevronRight size={16} /> Gerenciar
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
                title={mine.length ? 'Nenhuma unidade encontrada' : 'Sua empresa começa aqui'}
                description={
                  mine.length
                    ? 'Experimente outro nome ou categoria.'
                    : 'Explore o mapa, encontre uma propriedade e abra seu primeiro negócio.'
                }
                action={
                  !mine.length && (
                    <button className="primary" onClick={() => navigate('map')}>
                      Explorar propriedades
                    </button>
                  )
                }
              />
            )}
            <p className="panel-footnote">
              Exibindo {visible.length} de {mine.length} estabelecimentos · Estado compartilhado
              entre as empresas de teste.
            </p>
          </Panel>
          <Panel title="Resumo da operação" className="operation-summary">
            <div className="business-mini-map">
              <WorldMap mini />
            </div>
            <div className="panel-content">
              <h3>Distribuição territorial</h3>
              <Rows
                rows={[...countStates].map((state) => ({
                  label: state === 'SP' ? 'São Paulo' : state === 'MG' ? 'Minas Gerais' : 'Paraná',
                  value: `${num(mine.filter((e) => world.properties.find((p) => p.id === e.propertyId)!.state === state).length)} unidades`,
                }))}
              />
              <h3>Ação necessária</h3>
              {mine.some((e) => !e.enabled) ? (
                mine
                  .filter((e) => !e.enabled)
                  .map((e) => (
                    <p className="warning-line" key={e.id}>
                      <TriangleAlert size={16} />
                      <button onClick={() => openBusiness(e.id)}>
                        {e.name} está com a operação pausada.
                      </button>
                    </p>
                  ))
              ) : (
                <p className="muted small">Nenhuma unidade pausada no momento.</p>
              )}
              <button className="secondary full" onClick={() => navigate('map')}>
                <Map size={16} /> Ver unidades no mapa
              </button>
            </div>
          </Panel>
        </div>
        <Panel title="Central de pedidos" subtitle="Compras e vendas de todas as suas unidades">
          <Orders />
        </Panel>
      </div>
    </>
  );
}
