import { useState } from 'react';
import '../design/loja.css';
import { useGame } from '../lib/game';
import { PageHeading, Panel, Tabs, Empty } from '../components/ui';
import { Abastecimento } from '../features/business/Abastecimento';
import { Workforce } from '../features/business/Workforce';
import { Installation } from '../features/business/Installation';
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
            {tab === 'Abastecimento' && <Abastecimento key={e.id} establishment={e} />}
            {tab === 'Equipe' && <Workforce key={e.id} establishment={e} />}
            {tab === 'Finanças' && (
              <>
                <BusinessFinance key={e.id} establishment={e} />
                <Consumption key={`${e.id}-consumo`} establishment={e} />
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
