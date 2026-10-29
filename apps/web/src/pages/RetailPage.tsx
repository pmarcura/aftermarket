import { useState } from 'react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading, Panel, Tabs, Empty } from '../components/ui';
import { products } from '../../../../packages/simulation/src/model';
import { gameCalendar } from '../../../../packages/simulation/src/operations';
import { SupplyPlanner } from '../features/business/SupplyPlanner';
import { Stock } from '../features/business/Stock';
import { Workforce } from '../features/business/Workforce';
import { Installation } from '../features/business/Installation';
import { Orders } from '../features/business/Orders';
import { BusinessFinance, Consumption } from '../features/business/Analytics';
import { LojaCabecalho } from '../features/business/Empate';
import { Prateleira } from '../features/business/Prateleira';

export function RetailPage() {
  const { world, actor, businessId, navigate } = useGame();
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
  const sales = world.ledger.filter((l) => l.establishmentId === e.id && l.kind === 'retail');
  return (
    <>
      <div className="page-body loja-pagina">
        <LojaCabecalho loja={e} />
        <div className="retail-grid">
          <Panel className="loja-painel">
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
        </div>
      </div>
    </>
  );
}
