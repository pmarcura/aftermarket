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
import { SecaoAbas } from '../components/SecaoAbas';
import type { ProductId, Vehicle } from '../../../../packages/simulation/src/model';
import { Stock } from '../features/business/Stock';
import { SalesCatalog } from '../features/business/SalesCatalog';
import { OfferModal } from '../features/business/OfferModal';
import { freeCash } from '../../../../packages/simulation/src/design';
import { vehicleWear } from '../../../../packages/simulation/src/engine';
import { TruckPurchase } from '../components/TruckPurchase';
import { VehicleDetails, vehicleStatus, vehicleType } from '../components/VehicleDetails';
export function CarrierPage() {
  const { world, actor, navigate, run, pending } = useGame();
  const [tab, setTab] = useState('Frota'),
    [vehicle, setVehicle] = useState<Vehicle>(),
    [buy, setBuy] = useState(false),
    [offerProduct, setOfferProduct] = useState<ProductId>();
  const fleet = world.vehicles.filter((v) => v.companyId === actor),
    available = fleet.filter((v) => v.status === 'available');
  const shipments = world.shipments.filter((s) => s.carrierId === actor),
    // Totais desde a abertura vêm do servidor; o extrato que chega cobre só os dias recentes.
    revenue =
      world.view?.totals.freight?.in ??
      world.ledger
        .filter((l) => l.to === actor && l.kind === 'freight')
        .reduce((n, l) => n + l.amount, 0);
  const logistics = world.establishments.find(
    (e) => e.companyId === actor && e.category === 'logistics',
  );
  const v2 = !!world.season.config.economyVersion;
  const vehiclePrice = 28000000;
  const cashAvailable = freeCash(world, actor);
  // Mesma regra do comando: na versão 2 qualquer unidade própria recebe o caminhão.
  const vehicleDepot =
    world.establishments.find(
      (e) => e.companyId === actor && (e.category === 'logistics' || e.category === 'warehouse'),
    ) ?? (v2 ? world.establishments.find((e) => e.companyId === actor) : undefined);
  const home = logistics ?? (v2 ? vehicleDepot : undefined);
  const cashMissing = Math.max(0, vehiclePrice - cashAvailable);
  return (
    <>
      <SecaoAbas secao="negocios" />
      <PageHeading
        title={logistics?.name ?? (v2 ? 'Minha frota' : 'Minha transportadora')}
        description={
          v2
            ? 'Compre caminhões de montadoras, acompanhe o desgaste e venda ou desmonte os velhos.'
            : 'Gerencie veículos, disponibilidade e receitas com transporte de cargas.'
        }
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
            title={`${home?.name ?? 'Transportadora'} — Frota`}
            subtitle={(() => {
              const p = home && world.properties.find((p) => p.id === home.propertyId);
              return p ? `Sede: ${p.city} — ${p.state}` : 'Sem sede';
            })()}
            action={
              <button className="primary" onClick={() => setBuy(true)}>
                <Plus size={17} /> {v2 ? 'Comprar caminhão' : 'Comprar veículo'}
              </button>
            }
          >
            <Tabs
              values={[
                'Frota',
                // Versão 2: sucata de caminhões desmontados fica no pátio e pode ser vendida.
                ...(v2 && logistics ? ['Estoque', 'Vendas'] : []),
                'Fretes',
                'Rotas',
                'Custos',
                'Funcionários',
              ]}
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
                        {v2 && <th>Uso</th>}
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
                          <td>{vehicleType(v)}</td>
                          <td>
                            {v.capacityT} t / {v.capacityM3} m³
                          </td>
                          {v2 && (
                            <td>
                              {v.model ? (
                                <>
                                  <small className="block">
                                    {num(v.odometerKm ?? 0)} km · {num(vehicleWear(world, v) * 100)}
                                    % da vida
                                  </small>
                                  <Progress
                                    value={vehicleWear(world, v) * 100}
                                    color={vehicleWear(world, v) >= 0.8 ? 'gold' : 'green'}
                                  />
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}
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
                              {vehicleStatus(v)}
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
                  title={v2 ? 'Nenhum caminhão na frota' : 'Sua frota começa com um veículo'}
                  description={
                    v2
                      ? 'Compre de uma montadora ou da concessionária; ele fica registrado numa unidade sua.'
                      : 'Adquira um caminhão após abrir uma base logística.'
                  }
                />
              ))}
            {tab === 'Estoque' && logistics && <Stock establishment={logistics} />}
            {tab === 'Vendas' && logistics && (
              <SalesCatalog establishment={logistics} onEdit={setOfferProduct} />
            )}
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
                        world.view?.totals.vehicle?.out ??
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
      {offerProduct && logistics && (
        <OfferModal
          establishment={logistics}
          product={offerProduct}
          onClose={() => setOfferProduct(undefined)}
        />
      )}
      {vehicle && <VehicleDetails vehicle={vehicle} onClose={() => setVehicle(undefined)} />}
      {buy && v2 && <TruckPurchase depot={vehicleDepot} onClose={() => setBuy(false)} />}
      {buy && !v2 && (
        <Modal title="Comprar caminhão pesado" onClose={() => setBuy(false)}>
          <p>
            Amplie sua frota com um veículo de <strong>30 t e 85 m³</strong>. O caminhão será
            registrado em sua base logística.
          </p>
          <Rows
            rows={[
              { label: 'Preço de aquisição', value: cr(vehiclePrice) },
              { label: 'Caixa livre disponível', value: cr(cashAvailable) },
              {
                label: 'Caixa livre após a compra',
                value: cashMissing ? 'Caixa insuficiente' : cr(cashAvailable - vehiclePrice),
              },
            ]}
          />
          {(cashMissing > 0 || !vehicleDepot) && (
            <p id="vehicle-purchase-blocked" role="status" className="form-message error">
              {!vehicleDepot
                ? 'Adquira uma propriedade logística ou um armazém para receber o veículo.'
                : `Faltam ${cr(cashMissing)} de caixa livre. Revise os compromissos ou aumente o caixa antes de comprar.`}
            </p>
          )}
          <button
            className="primary full"
            disabled={pending || cashMissing > 0 || !vehicleDepot}
            aria-describedby={
              cashMissing > 0 || !vehicleDepot ? 'vehicle-purchase-blocked' : undefined
            }
            onClick={async () => {
              if (await run({ type: 'buyVehicle' }, 'Veículo adquirido e adicionado à frota.'))
                setBuy(false);
            }}
          >
            Comprar por {cr(vehiclePrice)}
          </button>
          {cashMissing > 0 && (
            <button
              className="secondary full"
              onClick={() => {
                setBuy(false);
                navigate('company');
              }}
            >
              Revisar caixa e compromissos
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
