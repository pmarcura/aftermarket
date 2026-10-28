import { FirstSteps } from './components/FirstSteps';
import { NotificationCenter } from './components/NotificationCenter';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Map,
  TrendingUp,
  Store,
  ChartNoAxesColumnIncreasing,
  Truck,
  Building2,
  Search,
  ChevronDown,
  Coins,
  TrendingDown,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  Check,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { GameProvider, useGame, cr, type Page } from './lib/game';
import { Modal, Badge, Rows } from './components/ui';
import './business.css';
import { regionsOf } from '../../../packages/simulation/src/metrics';
import { products, type Position } from '../../../packages/simulation/src/model';
import { freeCash } from '../../../packages/simulation/src/design';
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const PurchasePage = lazy(() =>
  import('./pages/MapPage').then((m) => ({ default: m.PurchasePage })),
);
const OpportunitiesPage = lazy(() =>
  import('./pages/OpportunitiesPage').then((m) => ({ default: m.OpportunitiesPage })),
);
const BusinessesPage = lazy(() =>
  import('./pages/BusinessesPage').then((m) => ({ default: m.BusinessesPage })),
);
const MarketPage = lazy(() =>
  import('./pages/MarketPage').then((m) => ({ default: m.MarketPage })),
);
const LogisticsPage = lazy(() =>
  import('./pages/LogisticsPage').then((m) => ({ default: m.LogisticsPage })),
);
const OperationPage = lazy(() =>
  import('./pages/OperationPage').then((m) => ({ default: m.OperationPage })),
);
const RetailPage = lazy(() =>
  import('./pages/RetailPage').then((m) => ({ default: m.RetailPage })),
);
const CarrierPage = lazy(() =>
  import('./pages/CarrierPage').then((m) => ({ default: m.CarrierPage })),
);
const CompanyPage = lazy(() =>
  import('./pages/CompanyPage').then((m) => ({ default: m.CompanyPage })),
);
const normalized = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

const destinations: { id: Page; label: string; icon: typeof Map; pages: Page[] }[] = [
  { id: 'map', label: 'Mapa', icon: Map, pages: ['map', 'purchase'] },
  { id: 'opportunities', label: 'Oportunidades', icon: TrendingUp, pages: ['opportunities'] },
  {
    id: 'businesses',
    label: 'Meus Negócios',
    icon: Store,
    pages: ['businesses', 'industry', 'retail'],
  },
  { id: 'market', label: 'Mercado', icon: ChartNoAxesColumnIncreasing, pages: ['market'] },
  { id: 'logistics', label: 'Logística', icon: Truck, pages: ['logistics', 'carrier'] },
  { id: 'company', label: 'Empresa', icon: Building2, pages: ['company'] },
];
function Brand() {
  return (
    <div className="brand">
      <svg width="38" height="35" viewBox="0 0 52 46" aria-hidden="true">
        <path d="M3 40 25 3l12 20-10 17-8-14-8 14zm29 0 10-18 10 18z" fill="currentColor" />
        <path d="m18 17 7-12 8 13-8 5z" fill="#c6d5db" />
      </svg>
      <div>
        <strong>AFTERMARKET</strong>
        <small>ECONOMIA EM MOVIMENTO</small>
      </div>
    </div>
  );
}
function Shell() {
  const { world, actor, setActor, page, navigate, focusMap } = useGame();
  const [collapsed, setCollapsed] = useState(
      localStorage.getItem('aftermarket.sidebar') === 'collapsed',
    ),
    [settings, setSettings] = useState(false),
    [notifications, setNotifications] = useState(false),
    [profile, setProfile] = useState(false),
    [query, setQuery] = useState(''),
    [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const company = world.companies.find((c) => c.id === actor)!,
    mine = world.establishments.filter((e) => e.companyId === actor),
    profit = mine.reduce((n, e) => n + e.revenue - e.expenses, 0) - (company.financingExpense ?? 0);
  const coordinateMatch = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  const coordinate: Position | undefined =
    coordinateMatch &&
    Math.abs(Number(coordinateMatch[1])) <= 90 &&
    Math.abs(Number(coordinateMatch[2])) <= 180
      ? [Number(coordinateMatch[2]), Number(coordinateMatch[1])]
      : undefined;
  const visibleRegions =
    query.trim().length >= 2
      ? regionsOf(world)
          .filter((r) => normalized(`${r.name} ${r.state}`).includes(normalized(query)))
          .slice(0, 5)
      : [];
  const visibleProperties =
    query.trim().length >= 2
      ? world.properties
          .filter(
            (p) =>
              normalized(`${p.name} ${p.city}`).includes(normalized(query)) ||
              world.establishments.some(
                (e) =>
                  e.propertyId === p.id &&
                  Object.keys(e.inventory).some((id) =>
                    normalized(products[id as keyof typeof products].name).includes(
                      normalized(query),
                    ),
                  ),
              ),
          )
          .slice(0, 5)
      : [];
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node))
        setSearchOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);
  useEffect(() => {
    document.title = `AFTERMARKET · ${destinations.find((d) => d.pages.includes(page))?.label ?? 'Mapa'}`;
  }, [page]);
  const searchFirst = () => {
    const r = visibleRegions[0],
      p = visibleProperties[0];
    if (coordinate) focusMap(coordinate);
    else if (r) focusMap(r.coordinates);
    else if (p) focusMap(p.coordinates, p.id);
    setSearchOpen(false);
  };
  const views: Record<Page, React.ReactNode> = {
    map: <MapPage />,
    opportunities: <OpportunitiesPage />,
    businesses: <BusinessesPage />,
    market: <MarketPage />,
    logistics: <LogisticsPage />,
    company: <CompanyPage />,
    purchase: <PurchasePage />,
    industry: <OperationPage />,
    retail: <RetailPage />,
    carrier: <CarrierPage />,
  };
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className="topbar">
        <button
          className="brand-button"
          onClick={() => navigate('map')}
          aria-label="AFTERMARKET · Abrir mapa"
        >
          <Brand />
        </button>
        <div className="global-search" ref={searchRef}>
          <Search size={18} />
          <input
            aria-label="Buscar cidade, empresa ou recurso"
            placeholder="Buscar cidade, empresa, recurso ou coordenadas…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchFirst();
              if (e.key === 'Escape') setSearchOpen(false);
            }}
          />
          <kbd>↵</kbd>
          {searchOpen && query.length >= 2 && (
            <div className="search-results">
              {coordinate && (
                <button
                  onClick={() => {
                    focusMap(coordinate);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <MapPin size={17} />
                  <span>
                    <strong>Ir para as coordenadas</strong>
                    <small>
                      {coordinate[1]}, {coordinate[0]}
                    </small>
                  </span>
                </button>
              )}
              {visibleRegions.length > 0 && <small>Municípios do piloto</small>}
              {visibleRegions.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    focusMap(r.coordinates);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <MapPin size={17} />
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {r.state} · Código IBGE {r.id}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {visibleProperties.length > 0 && <small>Propriedades e empresas</small>}
              {visibleProperties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    focusMap(p.coordinates, p.id);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <Building2 size={17} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.city} — {p.state}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!coordinate && !visibleRegions.length && !visibleProperties.length && (
                <p>
                  Nenhum resultado no piloto. Busque Campinas, Limeira, Itabira ou o nome de uma
                  empresa.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="topbar-spacer" />
        <div className="top-metric">
          <Coins size={23} className="gold-text" />
          <div>
            <strong>{cr(freeCash(world, actor))}</strong>
            <span>Saldo disponível</span>
          </div>
        </div>
        <div className="top-metric top-result">
          {profit >= 0 ? (
            <TrendingUp size={23} className="positive" />
          ) : (
            <TrendingDown size={23} className="negative" />
          )}
          <div>
            <strong className={profit >= 0 ? 'positive' : 'negative'}>
              {profit >= 0 ? '+' : '−'}
              {cr(Math.abs(profit))}
            </strong>
            <span>Resultado operacional</span>
          </div>
        </div>
        <NotificationCenter
          open={notifications}
          onToggle={() => {
            setNotifications(!notifications);
            setProfile(false);
          }}
          onClose={() => setNotifications(false)}
        />
        <div className="profile-wrapper">
          <button
            className="profile-button"
            onClick={() => {
              setProfile(!profile);
              setNotifications(false);
            }}
            aria-expanded={profile}
          >
            <span className="avatar">{actor === 'player' ? 'JS' : 'MC'}</span>
            <span>
              <strong>{actor === 'player' ? 'João Silva' : 'Marina Costa'}</strong>
              <small>Minha Empresa</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {profile && (
            <div className="header-popover profile-popover">
              <div className="popover-title">
                <strong>{company.name}</strong>
                <Badge tone="blue">Conta de teste</Badge>
              </div>
              <button
                onClick={() => {
                  navigate('company');
                  setProfile(false);
                }}
              >
                <Building2 size={17} /> Ver minha empresa
              </button>
              <button
                onClick={() => {
                  setSettings(true);
                  setProfile(false);
                }}
              >
                <Settings2 size={17} /> Preferências e contas
              </button>
            </div>
          )}
        </div>
      </header>
      <aside className="sidebar">
        <nav aria-label="Menu principal">
          {destinations.map((d) => (
            <button
              key={d.id}
              className={d.pages.includes(page) ? 'active' : ''}
              aria-current={d.pages.includes(page) ? 'page' : undefined}
              title={collapsed ? d.label : undefined}
              onClick={() => navigate(d.id)}
            >
              <d.icon size={21} strokeWidth={1.6} />
              <span>{d.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <FirstSteps />
          <div className="world-status">
            <i />
            <div>
              <strong>Mundo local</strong>
              <span>Economia compartilhada · 120×</span>
            </div>
          </div>
          <button
            className="settings-button"
            onClick={() => setSettings(true)}
            title="Preferências"
          >
            <Settings2 size={19} />
            <span>Configurações</span>
          </button>
          <button
            className="collapse-button"
            onClick={() => {
              setCollapsed(!collapsed);
              localStorage.setItem('aftermarket.sidebar', collapsed ? 'expanded' : 'collapsed');
            }}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <>
                <PanelLeftClose size={17} />
                <span>Recolher menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <main id="main-content" className={page === 'map' ? 'map-main' : 'content-main'} key={page}>
        <Suspense
          fallback={
            <div className="page-body muted" role="status">
              Carregando painel…
            </div>
          }
        >
          {views[page] ?? <MapPage />}
        </Suspense>
      </main>
      {settings && (
        <Modal title="Preferências do mundo" onClose={() => setSettings(false)}>
          <Badge tone="blue">Ambiente local de desenvolvimento</Badge>
          <p>
            Este mundo está salvo no servidor SQLite. As duas empresas abaixo veem as mesmas
            propriedades, ofertas e entregas.
          </p>
          <div className="account-options">
            {world.companies
              .filter((c) => c.id === 'player' || c.id === 'player2')
              .map((c) => (
                <button
                  key={c.id}
                  className={actor === c.id ? 'selected' : ''}
                  onClick={() => {
                    setActor(c.id);
                    setSettings(false);
                  }}
                >
                  <span className="avatar">{c.id === 'player' ? 'JS' : 'MC'}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      {c.id === 'player'
                        ? 'João Silva · portfólio inicial'
                        : 'Marina Costa · nova empresa'}
                    </small>
                  </div>
                  {actor === c.id && <Check size={18} />}
                </button>
              ))}
          </div>
          <Rows
            rows={[
              { label: 'Velocidade da simulação', value: '1 segundo real = 2 minutos no jogo' },
              { label: 'Persistência', value: 'SQLite · salva automaticamente' },
              { label: 'Cartografia', value: 'OpenFreeMap / OpenStreetMap' },
              { label: 'Economia e lotes', value: 'Dados simulados' },
            ]}
          />
          <p className="small muted">
            As contas são perfis locais sem senha para teste funcional. Autenticação e acesso
            público fazem parte da próxima fase.
          </p>
          <a
            className="text-button"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            Créditos cartográficos <ExternalLink size={13} />
          </a>
        </Modal>
      )}
    </div>
  );
}
export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
