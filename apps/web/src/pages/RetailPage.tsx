import { useState } from 'react';
import '../design/loja.css';
import '../design/producao.css';
import { useGame } from '../lib/game';
import { Panel, Tabs, Empty } from '../components/ui';
import { Workforce } from '../features/business/Workforce';
import { Installation } from '../features/business/Installation';
import { BusinessFinance, Consumption } from '../features/business/Analytics';
import { LojaCabecalho } from '../features/business/Empate';
import { Balcao } from '../features/loja/Balcao';
import { Unidades } from '../features/business/producao/Cabeca';
import { matizDaCategoria } from '../features/business/producao/pecas';

export function RetailPage() {
  const { world, actor, businessId, navigate } = useGame();
  const e =
    world.establishments.find(
      (e) => e.id === businessId && e.companyId === actor && e.category === 'retail',
    ) ?? world.establishments.find((e) => e.companyId === actor && e.category === 'retail');
  // Quem abre a loja pode pedir uma aba (o Início leva direto à Equipe, por exemplo).
  const [tab, setTab] = useState(() => {
    const pedida = sessionStorage.getItem('aftermarket.loja.aba');
    sessionStorage.removeItem('aftermarket.loja.aba');
    // Abas antigas continuam valendo para quem chega com um atalho velho.
    return pedida === 'Finanças'
      ? 'Resultado'
      : pedida === 'Abastecimento'
        ? 'Prateleira'
        : (pedida ?? 'Prateleira');
  });
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
  const p = world.properties.find((x) => x.id === e.propertyId)!;
  if (e.installed === false)
    return (
      <div className="prod">
        <Unidades atual={e.id} />
        <section
          className="prod-instalar"
          style={{ ['--h' as string]: matizDaCategoria[e.category] ?? 24 }}
        >
          <h1>{e.name}</h1>
          <p>
            O imóvel em {p.city} já é seu. Falta instalar o balcão e as prateleiras, contratar a
            equipe e abastecer.
          </p>
        </section>
        <div className="prod-painel">
          <Installation establishment={e} onInstalled={() => setTab('Equipe')} />
        </div>
      </div>
    );
  return (
    <div className="page-body loja-pagina">
      <Unidades atual={e.id} />
      <LojaCabecalho loja={e} />
      <div className="retail-grid">
        <Panel className="loja-painel">
          <Tabs values={['Prateleira', 'Equipe', 'Resultado']} value={tab} onChange={setTab} />
          {tab === 'Prateleira' && <Balcao loja={e} />}
          {tab === 'Equipe' && <Workforce key={e.id} establishment={e} />}
          {tab === 'Resultado' && (
            <>
              <BusinessFinance key={e.id} establishment={e} />
              <Consumption key={`${e.id}-consumo`} establishment={e} />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
