import { useState } from 'react';
import { Search, Plus, TriangleAlert, ShoppingCart } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading, Stat, Panel, Tabs, Progress, Empty, Select } from '../components/ui';
import { products, type ProductId } from '../../../../packages/simulation/src/model';
import { householdDemand, regionFor } from '../../../../packages/simulation/src/metrics';
import { gameCalendar } from '../../../../packages/simulation/src/operations';
import { SupplyPlanner } from '../features/business/SupplyPlanner';
import { Stock } from '../features/business/Stock';
import { Workforce } from '../features/business/Workforce';
import { Installation } from '../features/business/Installation';
import { Orders } from '../features/business/Orders';
import { BusinessFinance, Consumption } from '../features/business/Analytics';
import { Empate } from '../features/business/Empate';
import { Prateleira } from '../features/business/Prateleira';

export function RetailPage() {
  const { world, actor, businessId, openMarket, openBusiness, navigate } = useGame();
  const e =
    world.establishments.find(
      (e) => e.id === businessId && e.companyId === actor && e.category === 'retail',
    ) ?? world.establishments.find((e) => e.companyId === actor && e.category === 'retail');
  const [tab, setTab] = useState('Prateleira');
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
  if (e.installed === false)
    return (
      <>
        <PageHeading
          eyebrow="Meus Negócios › Instalação"
          title={e.name}
          description="Prepare sua loja em etapas: imóvel, equipamento, equipe e abastecimento."
        />
        <div className="page-body">
          <Panel>
            <Installation establishment={e} onInstalled={() => setTab('Equipe')} />
          </Panel>
        </div>
      </>
    );
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    region = regionFor(world, p.coordinates, p.city);
  const stock = Object.entries(e.inventory) as [ProductId, number][];
  const competitors = Math.max(
    1,
    world.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        world.properties.find((p) => p.id === x.propertyId)!.city === p.city,
    ).length,
  );
  const calendar = gameCalendar(world, world.nextEconomicAt - 60000);
  const demandFor = (id: ProductId) =>
    (householdDemand(world, region.id, id) * calendar.factor) / competitors;
  const low = stock.filter(([id, q]) => q < demandFor(id) * 2);
  const sales = world.ledger.filter((l) => l.establishmentId === e.id && l.kind === 'retail');
  const requests = world.orders.filter((o) => o.originId === e.id && o.status === 'pending').length;
  return (
    <>
      <PageHeading
        eyebrow={`Meus Negócios › ${e.name}`}
        title={e.name}
        description="Decida o que vender, quando repor e quanto cada produto contribui para a operação."
        action={
          <Select
            label="Selecionar loja"
            value={e.id}
            onChange={(event) => openBusiness(event.target.value)}
          >
            {world.establishments
              .filter((x) => x.companyId === actor && x.category === 'retail')
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
        }
      />
      <div className="page-body">
        <div className="stats-grid">
          <Stat
            label="Vendas registradas"
            value={cr(
              world.view?.retailByEstablishment[e.id] ?? sales.reduce((n, l) => n + l.amount, 0),
            )}
            note="receita observada desde a abertura"
          />
          <Stat
            label="Resultado operacional"
            value={cr(e.revenue - e.expenses)}
            note="inclui mercadorias vendidas e custos fixos"
            positive={e.revenue >= e.expenses}
          />
          <Stat
            label="Produtos com baixa cobertura"
            value={low.length}
            note={`${stock.length} produtos no catálogo`}
            gold={low.length > 0}
          />
          <Stat
            label="Pedidos para aceitar"
            value={requests}
            note={`${calendar.label} no calendário do jogo`}
          />
        </div>
        <Empate loja={e} />
        <div className="retail-grid">
          <Panel
            title={e.name}
            subtitle={`${p.city} — ${p.state} · ${e.enabled ? 'Loja em operação' : 'Operação pausada'}`}
            action={
              <div className="inline-actions">
                <button className="secondary" onClick={() => openMarket({ destinationId: e.id })}>
                  <Search size={16} /> Consultar fornecedores
                </button>
                <button className="primary" onClick={() => openMarket({ destinationId: e.id })}>
                  <Plus size={16} /> Adicionar produto
                </button>
              </div>
            }
          >
            <Tabs
              values={['Prateleira', 'Abastecimento', 'Equipe', 'Finanças']}
              value={tab}
              onChange={setTab}
            />
            {tab === 'Prateleira' && <Prateleira loja={e} />}
            {tab === 'Prateleira' && (
              <div className="business-section">
                <div className="panel-content">
                  <h3>Últimas vendas às famílias</h3>
                  <p className="small muted">
                    Quantidade, receita e horário virtual observados. Pedidos entre empresas estão
                    na aba Pedidos.
                  </p>
                </div>
                {sales.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Quando no jogo</th>
                          <th>Produto</th>
                          <th className="numeric">Quantidade</th>
                          <th className="numeric">Preço / un.</th>
                          <th className="numeric">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales
                          .slice(-40)
                          .reverse()
                          .map((l) => (
                            <tr key={l.id}>
                              <td>
                                {gameCalendar(world, l.at).date.toLocaleString('pt-BR', {
                                  timeZone: 'UTC',
                                })}
                              </td>
                              <td>{l.product ? products[l.product].name : l.description}</td>
                              <td className="numeric">{num(l.quantity ?? 0)}</td>
                              <td className="numeric">{cr(l.unitPrice ?? 0)}</td>
                              <td className="numeric positive">{cr(l.amount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Aguardando a próxima rodada de vendas"
                    description="Consumidores compram a cada minuto real, respeitando estoque, preço, qualidade, capacidade e orçamento."
                  />
                )}
              </div>
            )}
            {tab === 'Abastecimento' && (
              <>
                <SupplyPlanner key={e.id} establishment={e} />
                <Stock establishment={e} />
                <Orders establishment={e} />
              </>
            )}
            {tab === 'Equipe' && <Workforce key={e.id} establishment={e} />}
            {tab === 'Finanças' && (
              <>
                <Consumption key={e.id} establishment={e} />
                <BusinessFinance establishment={e} />
              </>
            )}
          </Panel>
          <div className="right-stack">
            <Panel title="Reposição e cobertura">
              <div className="panel-content">
                {stock.map(([id, q]) => {
                  const demand = demandFor(id),
                    days = demand ? q / demand : 0;
                  return (
                    <div className="meter-row" key={id}>
                      <span>{products[id].name}</span>
                      <Progress value={(days / 7) * 100} />
                      <small>{demand ? `${num(days, 1)} d` : '—'}</small>
                    </div>
                  );
                })}
                <p className="small muted">
                  Estoque ÷ demanda diária modelada, dividida entre {competitors} lojas. Preço,
                  qualidade e orçamento alteram a venda efetiva. Barra completa = 7 dias.
                </p>
                <button className="secondary full" onClick={() => setTab('Abastecimento')}>
                  Configurar abastecimento automático
                </button>
                <p className="small muted">
                  Até {cr(e.supplyPolicy?.dailyBudget ?? e.automationDailyBudget ?? 3000000)} por
                  dia do jogo, incluindo mercadoria e frete. Pedidos e cargas em andamento entram na
                  cobertura.
                </p>
              </div>
            </Panel>
            <Panel title="Atenção na operação">
              <div className="panel-content">
                {low.length ? (
                  low.map(([id, q]) => (
                    <div className="stock-alert" key={id}>
                      <TriangleAlert size={20} />
                      <div>
                        <strong>{products[id].name}</strong>
                        <p>{num(q)} unidades · cobertura abaixo de 2 dias</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Estoque acima do mínimo estimado.</p>
                )}
                <button
                  className="primary"
                  onClick={() =>
                    openMarket({ product: low[0]?.[0], destinationId: e.id, quantity: 200 })
                  }
                >
                  <ShoppingCart size={16} /> Reabastecer estoque
                </button>
                <button className="text-button" onClick={() => setTab('Finanças')}>
                  Ver consumo e gargalos
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
