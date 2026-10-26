import { useState } from 'react';
import {
  Search,
  Plus,
  Box,
  TriangleAlert,
  ShoppingCart,
  Pencil,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import {
  PageHeading,
  Stat,
  Panel,
  Tabs,
  Badge,
  Progress,
  Modal,
  Rows,
  Empty,
} from '../components/ui';
import { products, type ProductId } from '../../../../packages/simulation/src/model';
import {
  householdDemand,
  regionFor,
  seasonPrice,
} from '../../../../packages/simulation/src/metrics';
import { ProductAnalysisModal } from '../components/ProductAnalysis';
export function RetailPage() {
  const { world, actor, businessId, openMarket, run, pending, navigate } = useGame();
  const e =
    world.establishments.find(
      (e) => e.id === businessId && e.companyId === actor && e.category === 'retail',
    ) ?? world.establishments.find((e) => e.companyId === actor && e.category === 'retail');
  const [tab, setTab] = useState('Produtos'),
    [editing, setEditing] = useState<ProductId>(),
    [price, setPrice] = useState(0);
  const [analysis, setAnalysis] = useState<ProductId>();
  if (!e)
    return (
      <Empty
        title="Você ainda não possui uma loja"
        description="Adquira uma propriedade comercial no mapa para iniciar seu varejo."
        action={
          <button className="primary" onClick={() => navigate('map')}>
            Explorar propriedades
          </button>
        }
      />
    );
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    entries = world.ledger.filter((l) => l.establishmentId === e.id && l.kind === 'retail'),
    stock = Object.entries(e.inventory) as [ProductId, number][];
  const sold = entries.reduce((n, l) => n + l.amount, 0);
  const region = regionFor(p.coordinates, p.city),
    competingStores = Math.max(
      1,
      world.establishments.filter(
        (x) =>
          x.enabled &&
          x.category === 'retail' &&
          world.properties.find((p) => p.id === x.propertyId)!.city === p.city,
      ).length,
    );
  const demandFor = (id: ProductId) => householdDemand(world, region.id, id) / competingStores;
  const low = stock.filter(([id, q]) => q < demandFor(id) * 2);
  const intervalStart = Math.max(world.economyStartedAt, world.nextEconomicAt - 14 * 60000);
  const bars = Array.from({ length: 14 }, (_, i) =>
    entries
      .filter((l) => l.at >= intervalStart + i * 60000 && l.at < intervalStart + (i + 1) * 60000)
      .reduce((n, l) => n + l.amount, 0),
  );
  return (
    <>
      <PageHeading
        eyebrow={`Meus Negócios / ${e.name}`}
        title={e.name}
        description="Administre preços, estoque, abastecimento e desempenho das vendas regionais."
      />
      <div className="page-body">
        <div className="stats-grid">
          <Stat label="Vendas registradas" value={cr(sold)} note="desde a abertura do mundo" />
          <Stat
            label="Resultado operacional"
            value={cr(e.revenue - e.expenses)}
            note="receitas menos custos operacionais"
            positive={e.revenue >= e.expenses}
          />
          <Stat
            label="Produtos disponíveis"
            value={num(stock.reduce((n, [, q]) => n + q, 0))}
            note={`${stock.length} produtos no estabelecimento`}
          />
          <Stat
            label="Receita por transação"
            value={cr(entries.length ? sold / entries.length : 0)}
            note="vendas agregadas aos consumidores"
          />
        </div>
        <div className="retail-grid">
          <Panel
            title={`${e.name} — Produtos à venda`}
            subtitle={`${p.city} — ${p.state} · Varejo alimentício`}
            action={
              <div className="inline-actions">
                <button
                  className="secondary"
                  onClick={() => openMarket({ product: 'oil', destinationId: e.id, quantity: 200 })}
                >
                  <Search size={16} /> Consultar fornecedores
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    openMarket({ product: 'milk', destinationId: e.id, quantity: 200 })
                  }
                >
                  <Plus size={16} /> Adicionar produto
                </button>
              </div>
            }
          >
            <Tabs
              values={['Produtos', 'Estoque', 'Preços', 'Vendas', 'Funcionários']}
              value={tab}
              onChange={setTab}
            />
            {['Produtos', 'Estoque', 'Preços'].includes(tab) && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th className="numeric">Estoque</th>
                      <th className="numeric">Preço</th>
                      <th>Estado</th>
                      <th aria-label="Editar preço" />
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map(([id, quantity]) => (
                      <tr key={id}>
                        <td>
                          <div className="table-name">
                            <i className={`table-icon ${id === 'oil' ? 'green' : ''}`}>
                              <Box size={17} />
                            </i>
                            <button className="text-button" onClick={() => setAnalysis(id)}>
                              {products[id].name} <ChartNoAxesCombined size={13} />
                            </button>
                          </div>
                        </td>
                        <td>{products[id].category}</td>
                        <td className="numeric">{num(quantity)}</td>
                        <td className="numeric">{cr(e.prices[id] ?? seasonPrice(world, id), 2)}</td>
                        <td>
                          <Badge tone={quantity < demandFor(id) * 2 ? 'gold' : 'green'}>
                            {quantity === 0
                              ? 'Sem estoque'
                              : quantity < demandFor(id) * 2
                                ? 'Baixo estoque'
                                : 'Ativo'}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Editar preço de ${products[id].name}`}
                            title="Editar preço"
                            onClick={() => {
                              setEditing(id);
                              setPrice(e.prices[id] ?? seasonPrice(world, id));
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === 'Funcionários' && (
              <div className="panel-content">
                <Rows
                  rows={[
                    { label: 'Funcionários', value: e.employees },
                    { label: 'Custo diário de operação', value: cr(e.dailyCost) },
                    { label: 'Estado', value: e.enabled ? 'Ativa' : 'Pausada' },
                  ]}
                />
                <button
                  className="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      { type: 'toggleOperation', establishmentId: e.id },
                      'Estado da loja atualizado.',
                    )
                  }
                >
                  {e.enabled ? 'Pausar vendas e operação' : 'Retomar operação'}
                </button>
              </div>
            )}
            {tab === 'Vendas' && (
              <div className="panel-content">
                {entries.length ? (
                  entries
                    .slice(-15)
                    .reverse()
                    .map((l) => (
                      <div className="simple-entry" key={l.id}>
                        <span>
                          {l.description}
                          <small>{new Date(l.at).toLocaleTimeString('pt-BR')}</small>
                        </span>
                        <strong className="positive">+{cr(l.amount)}</strong>
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Aguardando o próximo período de vendas"
                    description="Consumidores compram a cada minuto real, respeitando estoque, preços e orçamento. Mantenha a loja abastecida."
                  />
                )}
              </div>
            )}
            {['Produtos', 'Estoque', 'Vendas'].includes(tab) && (
              <div className="panel-content">
                <h3>Vendas por período — últimas 14 rodadas</h3>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label="Receita das últimas 14 rodadas de vendas"
                >
                  {bars.map((v, i) => (
                    <div key={i}>
                      <i
                        style={{
                          height: `${Math.max(v ? 5 : 1, (v / Math.max(...bars, 1)) * 100)}%`,
                        }}
                        title={`Rodada ${i + 1}: ${cr(v)}`}
                      />
                      <span>{i + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="small muted">
                  Cada rodada equivale a 2 horas do jogo (1 minuto real). Valores do estado
                  persistido.
                </p>
              </div>
            )}
          </Panel>
          <div className="right-stack">
            <Panel title="Cobertura estimada do estoque">
              <div className="panel-content">
                {stock.map(([id, quantity]) => {
                  const demand = demandFor(id),
                    days = demand ? quantity / demand : 0;
                  return (
                    <div className="meter-row" key={id}>
                      <span>{products[id].name}</span>
                      <Progress value={(days / 7) * 100} />
                      <small>{demand ? `${num(days, 1)} d` : '—'}</small>
                    </div>
                  );
                })}
                <p className="small muted">
                  Estoque ÷ demanda diária dividida entre {competingStores} lojas. Barra completa =
                  7 dias do jogo; não é garantia de vendas.
                </p>
                <button
                  className="secondary full"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      { type: 'setAutomation', establishmentId: e.id, enabled: !e.automation },
                      e.automation
                        ? 'Reposição automática desativada.'
                        : 'Reposição automática ativada com limite diário do cenário.',
                    )
                  }
                >
                  {e.automation ? 'Desativar reposição automática' : 'Ativar reposição automática'}
                </button>
                <p className="small muted">
                  A reposição respeita estoque, transporte, saldo e orçamento de{' '}
                  {cr(e.automationDailyBudget ?? 3000000)} por dia do jogo.
                </p>
              </div>
            </Panel>
            <Panel title="Alertas de estoque">
              <div className="panel-content">
                {low.length ? (
                  low.map(([id, q]) => (
                    <div className="stock-alert" key={id}>
                      <TriangleAlert size={20} />
                      <div>
                        <strong>{products[id].name}</strong>
                        <p>{num(q)} unidades restantes</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Todos os produtos estão acima do estoque mínimo.</p>
                )}
                <p className="muted small">
                  A reposição exige compra e entrega no depósito da loja.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    openMarket({
                      product: low[0]?.[0] ?? 'oil',
                      destinationId: e.id,
                      quantity: 200,
                    })
                  }
                >
                  <ShoppingCart size={16} /> Reabastecer estoque
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      {editing && (
        <Modal title={`Preço · ${products[editing].name}`} onClose={() => setEditing(undefined)}>
          <label className="field">
            Preço de venda por unidade (R$)
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              value={price / 100}
              onChange={(event) => setPrice(Math.round(Number(event.target.value) * 100))}
            />
          </label>
          <p className="muted small">
            O preço interfere na participação da loja na demanda regional. Produtos muito caros
            vendem menos.
          </p>
          <button
            className="primary full"
            disabled={pending || price <= 0}
            onClick={async () => {
              if (
                await run(
                  { type: 'setPrice', establishmentId: e.id, product: editing, price },
                  'Preço de venda atualizado.',
                )
              )
                setEditing(undefined);
            }}
          >
            Salvar preço
          </button>
        </Modal>
      )}
      {analysis && (
        <ProductAnalysisModal
          product={analysis}
          regionId={region.id}
          onClose={() => setAnalysis(undefined)}
        />
      )}
    </>
  );
}
