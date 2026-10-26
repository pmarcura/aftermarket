import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  MapPin,
  Zap,
  Droplets,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  Route,
  Layers3,
  Building2,
  Mountain,
  Check,
  ArrowLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useGame, CategoryIcon, cr, num } from '../lib/game';
import { WorldMap, defaultLayers, type Layers } from '../components/WorldMap';
import { Badge, Panel, PageHeading, Rows, Modal } from '../components/ui';
import { categoryInfo } from '../../../../packages/simulation/src/model';
import {
  laborMarket,
  logisticsQuality,
  utilityTariff,
} from '../../../../packages/simulation/src/metrics';
import { InfrastructureDetails } from '../components/InfrastructureDetails';

export function MapPage() {
  const { world, actor, selectedId, select, navigate, openBusiness, focusMap } = useGame();
  const [layers, setLayers] = useState<Layers>(defaultLayers),
    [expanded, setExpanded] = useState(true);
  const [ownership, setOwnership] = useState<'' | 'mine' | 'others' | 'available'>(''),
    [details, setDetails] = useState(false);
  const p = world.properties.find((x) => x.id === selectedId),
    e = world.establishments.find((x) => x.propertyId === selectedId);
  const labor = p ? laborMarket(world, p) : null,
    logistics = p ? logisticsQuality(world, p) : null,
    tariff = p ? utilityTariff(world, p) : null;
  const layerList: { key: keyof Layers; label: string; icon: typeof Building2 }[] = [
    { key: 'companies', label: 'Empresas', icon: Building2 },
    { key: 'available', label: 'Propriedades disponíveis', icon: MapPin },
    { key: 'resources', label: 'Recursos naturais', icon: Mountain },
    { key: 'demand', label: 'Demanda regional', icon: Users },
    { key: 'zoning', label: 'Zoneamento do jogo', icon: Layers3 },
    { key: 'routes', label: 'Rotas logísticas', icon: Route },
  ];
  return (
    <div className="map-page">
      <div className="main-map">
        <WorldMap layers={layers} onSelect={select} ownership={ownership} />
        <div className="map-breadcrumb">
          <MapPin size={14} />
          <span>
            Brasil <i>/</i> São Paulo <i>/</i> Região de Campinas
          </span>
          <Badge tone="muted">Região piloto</Badge>
        </div>
        <div className="map-owner-controls">
          <button
            className={ownership === 'mine' ? 'primary' : 'secondary'}
            aria-pressed={ownership === 'mine'}
            onClick={() => {
              setOwnership(ownership === 'mine' ? '' : 'mine');
              if (p?.ownerId !== actor) select(null);
            }}
          >
            <Building2 size={15} /> Minhas propriedades
          </button>
          <select
            aria-label="Filtrar titularidade no mapa"
            value={ownership}
            onChange={(event) => {
              setOwnership(event.target.value as typeof ownership);
              select(null);
            }}
          >
            <option value="">Titularidade (opcional)</option>
            <option value="mine">Somente minhas</option>
            <option value="others">Outras empresas</option>
            <option value="available">Disponíveis</option>
          </select>
        </div>
        <div className="map-layer-panel">
          <button
            className="layer-title"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <Layers3 size={16} /> Camadas do mapa{' '}
            {expanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          {expanded && (
            <div className="layer-options">
              {layerList.map((l) => (
                <label key={l.key}>
                  <l.icon size={15} />
                  <span>{l.label}</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={layers[l.key]}
                    onChange={(event) => setLayers({ ...layers, [l.key]: event.target.checked })}
                  />
                  <i className="switch" />
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="map-legend">
          {(['farm', 'mine', 'industry', 'retail', 'logistics'] as const).map((c) => (
            <span key={c}>
              <i style={{ background: categoryInfo[c].color }}>
                <CategoryIcon category={c} size={14} />
              </i>
              {categoryInfo[c].label}
            </span>
          ))}
          <span>
            <i className="legend-available" />
            Disponível
          </span>
        </div>
      </div>
      {p && (
        <aside className="property-sidebar">
          <div className="property-title">
            <div className={`activity-icon ${p.category}`}>
              <CategoryIcon category={p.category} size={30} />
            </div>
            <div>
              <Badge tone="blue">{categoryInfo[p.category].label}</Badge>
              <h2>{p.ownerId ? (e?.name ?? p.name) : 'Propriedade disponível'}</h2>
              <p>
                {p.city} — {p.state}
              </p>
            </div>
            <button
              className="icon-button close-panel"
              aria-label="Fechar detalhes da propriedade"
              onClick={() => select(null)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="coordinates">
            <MapPin size={13} />
            {p.coordinates[1].toFixed(4)}, {p.coordinates[0].toFixed(4)}
          </div>
          <div className="property-preview">
            <WorldMap mini propertyId={p.id} key={p.id} />
            <button
              title="Aproximar da propriedade"
              aria-label="Aproximar da propriedade"
              onClick={() => focusMap(p.coordinates, p.id)}
            >
              <ArrowUpRight size={17} />
            </button>
            <span>Cartografia · área virtual</span>
          </div>
          <div className="property-stats">
            <div>
              <span>Área total</span>
              <strong>{num(p.area)} m²</strong>
              <small>{num(p.area / 10000, 2)} hectares</small>
            </div>
            <div>
              <span>{p.ownerId ? 'Valor do imóvel' : 'Preço de aquisição'}</span>
              <strong>{cr(p.price)}</strong>
              <small>{cr(p.price / p.area, 2)} / m²</small>
            </div>
          </div>
          <section className="sidebar-section">
            <h3>
              Zoneamento <Badge tone="muted">{categoryInfo[p.category].label}</Badge>
            </h3>
            <p>
              Uso virtual permitido para{' '}
              {p.category === 'industry'
                ? 'indústrias, armazéns e centros de distribuição'
                : categoryInfo[p.category].label.toLowerCase()}
              .
            </p>
          </section>
          <section className="sidebar-section">
            <h3>Acesso e infraestrutura</h3>
            <Rows
              rows={[
                {
                  label: (
                    <>
                      <Route size={15} /> Rodovia mais próxima
                    </>
                  ),
                  value: `${p.road} (${p.roadDistance} km)`,
                },
                {
                  label: (
                    <>
                      <MapPin size={15} /> Município
                    </>
                  ),
                  value: p.city,
                },
                {
                  label: (
                    <>
                      <Truck size={15} /> Acesso rodoviário
                    </>
                  ),
                  value: 'Acesso cadastrado no jogo',
                },
              ]}
            />
          </section>
          <section className="sidebar-section">
            <h3>Recursos na região</h3>
            <Rows
              rows={[
                {
                  label: (
                    <>
                      <Zap size={16} className="gold-text" /> Energia
                    </>
                  ),
                  value:
                    p.energyConnected === false
                      ? 'Sem conexão'
                      : `${cr(tariff!.electricity)} / kWh`,
                  className: 'positive',
                },
                {
                  label: (
                    <>
                      <Droplets size={16} className="blue-text" /> Água
                    </>
                  ),
                  value: p.water ? `${cr(tariff!.water)} / m³` : 'Sem abastecimento',
                  className: 'positive',
                },
                {
                  label: (
                    <>
                      <Users size={16} /> Mão de obra
                    </>
                  ),
                  value: `${num(labor!.available)} candidatos`,
                  className: 'positive',
                },
                {
                  label: (
                    <>
                      <Truck size={16} /> Logística
                    </>
                  ),
                  value: `${logistics!.score}/100 · ${logistics!.label}`,
                  className: 'positive',
                },
              ]}
            />
            <button className="text-button" onClick={() => setDetails(true)}>
              Ver cálculos, tarifas e custos <ArrowUpRight size={13} />
            </button>
          </section>
          <div className="property-actions">
            {!p.ownerId ? (
              <button className="primary full" onClick={() => navigate('purchase')}>
                <ShoppingCart size={17} /> Comprar propriedade
              </button>
            ) : p.ownerId === actor && e ? (
              <button className="primary full" onClick={() => openBusiness(e.id)}>
                <Building2 size={17} /> Administrar negócio
              </button>
            ) : (
              e && (
                <button className="primary full" onClick={() => navigate('market')}>
                  <ShoppingCart size={17} /> Consultar mercado
                </button>
              )
            )}
            <button className="secondary full" onClick={() => navigate('opportunities')}>
              <BarChart3 size={17} /> Ver análise da região
            </button>
          </div>
        </aside>
      )}
      {details && p && <InfrastructureDetails property={p} onClose={() => setDetails(false)} />}
    </div>
  );
}

export function PurchasePage() {
  const { world, actor, selectedId, navigate, run, pending, openBusiness } = useGame();
  const p = world.properties.find((x) => x.id === selectedId);
  const [confirm, setConfirm] = useState(false),
    [name, setName] = useState('Nova operação industrial');
  if (!p)
    return (
      <div className="page-body">
        <button onClick={() => navigate('map')}>Selecionar uma propriedade no mapa</button>
      </div>
    );
  const balance = world.companies.find((x) => x.id === actor)!.balance;
  const labor = laborMarket(world, p),
    tariff = utilityTariff(world, p);
  return (
    <>
      <PageHeading
        eyebrow={`Mapa / ${p.state} / ${p.city}`}
        title="Comprar propriedade"
        description="Conheça a área e o investimento necessário para o seu próximo negócio."
        action={
          <button className="text-button" onClick={() => navigate('map')}>
            <ArrowLeft size={16} /> Voltar ao mapa
          </button>
        }
      />
      <div className="page-body purchase-layout">
        <Panel className="purchase-map">
          <WorldMap propertyId={p.id} />
          <span className="map-location">
            <MapPin size={16} />
            {p.city} — {p.state}
          </span>
          <span className="map-note">Propriedade virtual georreferenciada</span>
        </Panel>
        <Panel
          className="purchase-details"
          title={`Propriedade ${categoryInfo[p.category].label.toLowerCase()}`}
          subtitle={`${p.city} — ${p.state} · ID BR-${p.state}-${p.id}`}
          action={
            <Badge tone={p.ownerId ? 'muted' : 'green'}>
              {p.ownerId ? 'Adquirida' : 'Disponível'}
            </Badge>
          }
        >
          <div className="purchase-prices">
            <div>
              <span>Preço de aquisição</span>
              <strong>{cr(p.price)}</strong>
            </div>
            <div>
              <span>Área do terreno</span>
              <strong>{num(p.area)} m²</strong>
            </div>
          </div>
          <div className="panel-content">
            <h3>Uso permitido</h3>
            <div className="badge-row">
              <Badge tone="blue">{categoryInfo[p.category].label}</Badge>
              {p.category === 'industry' && (
                <>
                  <Badge tone="muted">Armazenagem</Badge>
                  <Badge tone="muted">Distribuição</Badge>
                  <Badge tone="muted">Processamento</Badge>
                </>
              )}
            </div>
            <h3>Acesso e infraestrutura</h3>
            <Rows
              rows={[
                { label: 'Rodovia mais próxima', value: `${p.road} · ${p.roadDistance} km` },
                { label: 'Acesso rodoviário', value: 'Disponível' },
                {
                  label: 'Energia',
                  value:
                    p.energyConnected === false ? 'Sem conexão' : `${cr(tariff.electricity)} / kWh`,
                },
                {
                  label: 'Água + esgoto',
                  value: p.water ? `${cr(tariff.water)} / m³` : 'Sem abastecimento',
                },
                { label: 'Tipo de aquisição', value: 'Imóvel e instalação inicial' },
                { label: 'Equipe de abertura', value: '12 contratos de trabalho' },
                { label: 'Candidatos disponíveis no modelo', value: num(labor.available) },
                {
                  label: 'Folha mensal de abertura + encargos',
                  value: cr(
                    labor.monthlySalary * 12 * world.season.config.parameters.payrollBurden,
                  ),
                },
              ]}
            />
            <h3>Condições de aquisição</h3>
            <p className="check-line">
              <Check size={16} /> Atividade compatível com o zoneamento do jogo
            </p>
            <p className={`check-line ${balance < p.price ? 'negative' : ''}`}>
              <Check size={16} />{' '}
              {balance >= p.price
                ? 'Saldo suficiente para a aquisição'
                : 'Saldo insuficiente para esta propriedade'}
            </p>
            <p className="muted small">
              O pagamento transfere a titularidade e abre uma unidade vazia. Estoques, veículos e
              capital de giro são adquiridos separadamente. A folha e a manutenção continuam sendo
              pagas ao pausar a produção. Não há taxa de registro neste cenário.
            </p>
            <div className="purchase-bottom">
              <button className="secondary" onClick={() => navigate('opportunities')}>
                <BarChart3 size={16} /> Comparar região
              </button>
              <button
                className="primary"
                disabled={Boolean(p.ownerId) || balance < p.price || labor.available < 12}
                onClick={() => {
                  setName(`${categoryInfo[p.category].label} ${p.city}`);
                  setConfirm(true);
                }}
              >
                <ShoppingCart size={16} /> Confirmar compra · {cr(p.price)}
              </button>
            </div>
          </div>
        </Panel>
      </div>
      {confirm && (
        <Modal title="Confirmar aquisição" onClose={() => setConfirm(false)}>
          <p>
            Você está adquirindo <strong>{p.name}</strong>. A nova unidade começará sem estoque e
            terá custos de operação.
          </p>
          <label className="field">
            Nome do estabelecimento
            <input
              autoFocus
              value={name}
              maxLength={70}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Rows
            rows={[
              { label: 'Investimento total', value: cr(p.price) },
              { label: 'Saldo após a compra', value: cr(balance - p.price) },
            ]}
          />
          <button
            className="primary full"
            disabled={pending || name.trim().length < 3}
            onClick={async () => {
              if (
                await run(
                  { type: 'buyProperty', propertyId: p.id, name },
                  'Propriedade adquirida. Sua nova unidade já está disponível.',
                )
              ) {
                setConfirm(false);
                openBusiness(`e-${p.id}`);
              }
            }}
          >
            {pending ? 'Concluindo…' : `Comprar por ${cr(p.price)}`}
          </button>
        </Modal>
      )}
    </>
  );
}
