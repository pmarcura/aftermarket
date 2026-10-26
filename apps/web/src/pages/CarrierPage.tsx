import { useState } from 'react';
import { Plus, Truck, ChevronRight, ArrowRight, Route } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import {
  PageHeading,
  Stat,
  Panel,
  Tabs,
  Badge,
  Progress,
  Rows,
  Modal,
  Empty,
} from '../components/ui';
import type { Vehicle } from '../../../../packages/simulation/src/model';
export function CarrierPage() {
  const { world, actor, navigate, run, pending } = useGame();
  const [tab, setTab] = useState('Frota'),
    [vehicle, setVehicle] = useState<Vehicle>(),
    [buy, setBuy] = useState(false);
  const fleet = world.vehicles.filter((v) => v.companyId === actor),
    available = fleet.filter((v) => v.status === 'available');
  const shipments = world.shipments.filter((s) => s.carrierId === actor),
    revenue = world.ledger
      .filter((l) => l.to === actor && l.kind === 'freight')
      .reduce((n, l) => n + l.amount, 0);
  const logistics = world.establishments.find(
    (e) => e.companyId === actor && e.category === 'logistics',
  );
  return (
    <>
      <PageHeading
        eyebrow="Logística / Minha transportadora"
        title={logistics?.name ?? 'Minha transportadora'}
        description="Gerencie veículos, disponibilidade e receitas com transporte de cargas."
        action={
          <button className="secondary" onClick={() => navigate('logistics')}>
            <Route size={16} /> Contratar frete
          </button>
        }
      />
      <div className="page-body">
        <div className="stats-grid">
          <Stat
            label="Veículos"
            value={fleet.length}
            note={`${available.length} disponíveis para serviço`}
          />
          <Stat
            label="Capacidade total"
            value={`${num(fleet.reduce((n, v) => n + v.capacityT, 0))} t`}
            note="soma das capacidades da frota"
          />
          <Stat
            label="Receita com fretes"
            value={cr(revenue)}
            note="serviços registrados neste mundo"
          />
          <Stat
            label="Veículos em operação"
            value={fleet.filter((v) => v.status === 'route').length}
            note={`${shipments.filter((s) => !s.delivered).length} cargas em andamento`}
          />
        </div>
        <div className="carrier-grid">
          <Panel
            title={`${logistics?.name ?? 'Transportadora'} — Frota`}
            subtitle={`Sede: ${logistics ? world.properties.find((p) => p.id === logistics.propertyId)?.city : 'Sem sede'} — SP`}
            action={
              <button className="primary" onClick={() => setBuy(true)}>
                <Plus size={17} /> Comprar veículo
              </button>
            }
          >
            <Tabs
              values={['Frota', 'Fretes', 'Rotas', 'Custos', 'Funcionários']}
              value={tab}
              onChange={setTab}
            />
            {tab === 'Frota' &&
              (fleet.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Veículo</th>
                        <th>Tipo</th>
                        <th>Capacidade</th>
                        <th>Localização</th>
                        <th>Estado</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {fleet.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <div className="table-name">
                              <i className="table-icon">
                                <Truck size={17} />
                              </i>
                              <strong>{v.name}</strong>
                            </div>
                          </td>
                          <td>
                            Caminhão{' '}
                            {v.capacityT === 30 ? 'pesado' : v.capacityT === 16 ? 'médio' : 'leve'}
                          </td>
                          <td>
                            {v.capacityT} t / {v.capacityM3} m³
                          </td>
                          <td>{world.properties.find((p) => p.id === v.propertyId)?.city}</td>
                          <td>
                            <Badge
                              tone={
                                v.status === 'available'
                                  ? 'green'
                                  : v.status === 'route'
                                    ? 'gold'
                                    : 'red'
                              }
                            >
                              {v.status === 'available'
                                ? 'Disponível'
                                : v.status === 'route'
                                  ? 'Em rota'
                                  : 'Manutenção'}
                            </Badge>
                          </td>
                          <td>
                            <button className="secondary" onClick={() => setVehicle(v)}>
                              <ChevronRight size={16} /> Detalhes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Sua frota começa com um veículo"
                  description="Adquira um caminhão após abrir uma base logística."
                />
              ))}
            {(tab === 'Fretes' || tab === 'Rotas') && (
              <div className="panel-content">
                {shipments.length ? (
                  shipments.map((s) => (
                    <div className="simple-entry" key={s.id}>
                      <span>
                        {world.establishments.find((e) => e.id === s.originId)?.name} →{' '}
                        {world.establishments.find((e) => e.id === s.destinationId)?.name}
                      </span>
                      <Badge>{s.delivered ? 'Concluído' : 'Em trânsito'}</Badge>
                      <strong>{cr(s.freight)}</strong>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="Nenhum contrato de transporte ativo"
                    description="A contratação de fretes entre empresas está disponível com transportadoras automatizadas. A aceitação pública de fretes por jogadores está planejada para a próxima fase."
                  />
                )}
              </div>
            )}
            {tab === 'Custos' && (
              <div className="panel-content">
                <h3>Custos registrados</h3>
                <Rows
                  rows={[
                    {
                      label: 'Aquisição de veículos',
                      value: cr(
                        world.ledger
                          .filter((l) => l.from === actor && l.kind === 'vehicle')
                          .reduce((n, l) => n + l.amount, 0),
                      ),
                    },
                    { label: 'Operação da sede', value: cr(logistics?.expenses ?? 0) },
                    { label: 'Receita de transporte', value: cr(revenue) },
                  ]}
                />
                <p className="muted small">
                  O cenário agrega custos fixos na operação da sede. Combustível e pedágios
                  individuais ainda serão detalhados na fase de transportadores humanos.
                </p>
              </div>
            )}
            {tab === 'Funcionários' && (
              <div className="panel-content">
                <h3>Equipe da transportadora</h3>
                <Rows
                  rows={[
                    { label: 'Funcionários', value: logistics?.employees ?? 0 },
                    {
                      label: 'Custo operacional / dia do jogo',
                      value: cr(logistics?.dailyCost ?? 0),
                    },
                    {
                      label: 'Estado da sede',
                      value: logistics?.enabled ? 'Operacional' : 'Sem operação ativa',
                    },
                  ]}
                />
              </div>
            )}
            {tab === 'Frota' && (
              <div className="panel-content">
                <h3>Capacidade operacional</h3>
                <Rows
                  rows={[
                    {
                      label: 'Veículos disponíveis',
                      value: `${available.length} / ${fleet.length}`,
                    },
                    {
                      label: 'Capacidade disponível',
                      value: `${num(available.reduce((n, v) => n + v.capacityT, 0))} toneladas`,
                    },
                    {
                      label: 'Volume disponível',
                      value: `${num(available.reduce((n, v) => n + v.capacityM3, 0))} m³`,
                    },
                  ]}
                />
              </div>
            )}
          </Panel>
          <div className="right-stack">
            <Panel
              title="Mercado de fretes"
              action={
                <button className="secondary" onClick={() => navigate('market')}>
                  <ArrowRight size={16} /> Ver mercado
                </button>
              }
            >
              <div className="panel-content">
                <i className="large-table-icon">
                  <Truck size={28} />
                </i>
                <h3>Conecte sua cadeia de negócios</h3>
                <p className="muted">
                  Compre mercadorias e compare as transportadoras disponíveis para atender suas
                  unidades.
                </p>
                <button className="primary full" onClick={() => navigate('logistics')}>
                  <Route size={16} /> Consultar cotações
                </button>
              </div>
            </Panel>
            <Panel title="Utilização da frota">
              <div className="panel-content">
                <Rows
                  rows={[
                    {
                      label: 'Veículos em serviço',
                      value: `${fleet.filter((v) => v.status === 'route').length} / ${fleet.length}`,
                    },
                  ]}
                />
                <Progress
                  value={
                    fleet.length
                      ? (fleet.filter((v) => v.status === 'route').length / fleet.length) * 100
                      : 0
                  }
                />
                <p className="muted small">
                  Peso, volume e disponibilidade são verificados antes de cada contratação.
                </p>
                <Badge tone="blue">Transportadores humanos · próxima fase</Badge>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      {vehicle && (
        <Modal title={vehicle.name} onClose={() => setVehicle(undefined)}>
          <Rows
            rows={[
              { label: 'Capacidade de carga', value: `${vehicle.capacityT} toneladas` },
              { label: 'Capacidade volumétrica', value: `${vehicle.capacityM3} m³` },
              {
                label: 'Localização',
                value: world.properties.find((p) => p.id === vehicle.propertyId)?.city,
              },
              {
                label: 'Estado',
                value:
                  vehicle.status === 'available'
                    ? 'Disponível'
                    : vehicle.status === 'route'
                      ? 'Em rota'
                      : 'Manutenção',
              },
              { label: 'Valor de referência', value: cr(28000000) },
            ]}
          />
        </Modal>
      )}
      {buy && (
        <Modal title="Comprar caminhão pesado" onClose={() => setBuy(false)}>
          <p>
            Amplie sua frota com um veículo de <strong>30 t e 85 m³</strong>. O caminhão será
            registrado em sua base logística.
          </p>
          <Rows
            rows={[
              { label: 'Preço de aquisição', value: cr(28000000) },
              {
                label: 'Saldo após a compra',
                value: cr(world.companies.find((c) => c.id === actor)!.balance - 28000000),
              },
            ]}
          />
          <button
            className="primary full"
            disabled={pending}
            onClick={async () => {
              if (await run({ type: 'buyVehicle' }, 'Veículo adquirido e adicionado à frota.'))
                setBuy(false);
            }}
          >
            Comprar por {cr(28000000)}
          </button>
        </Modal>
      )}
    </>
  );
}
