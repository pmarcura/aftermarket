import { NotificationCenter } from './components/NotificationCenter';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Map,
  Store,
  Building2,
  Search,
  ChevronDown,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  Check,
  MapPin,
  ExternalLink,
  ArrowLeftRight,
  House,
} from 'lucide-react';
import { GameProvider, useGame, cr, type Page } from './lib/game';
import { Modal, Badge, Rows } from './components/ui';
import { IconePixel } from './components/IconePixel';
import './business.css';
import { regionsOf } from '../../../packages/simulation/src/metrics';
import { products, TIME_SCALE, type Position } from '../../../packages/simulation/src/model';
import { freeCash } from '../../../packages/simulation/src/design';
import { comecoDoDia, relogio, useMarcarVisita, useResumoDoCaixa } from './features/inicio/tempo';
import { ReporGaveta } from './features/economy/ReporGaveta';
import { ProdutoFicha } from './features/produto/ProdutoFicha';
const InicioPage = lazy(() =>
  import('./pages/InicioPage').then((m) => ({ default: m.InicioPage })),
);
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
const CotacoesPage = lazy(() =>
  import('./features/economy/Cotacoes').then((m) => ({ default: m.CotacoesPage })),
);
const PedidosPage = lazy(() =>
  import('./pages/ComercioPages').then((m) => ({ default: m.PedidosPage })),
);
const ContratosPage = lazy(() =>
  import('./pages/ComercioPages').then((m) => ({ default: m.ContratosPage })),
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
  { id: 'inicio', label: 'Início', icon: House, pages: ['inicio'] },
  { id: 'map', label: 'Mapa', icon: Map, pages: ['map', 'purchase'] },
  {
    id: 'businesses',
    label: 'Negócios',
    icon: Store,
    pages: ['businesses', 'industry', 'retail', 'carrier'],
  },
  {
    id: 'market',
    label: 'Comércio',
    icon: ArrowLeftRight,
    pages: ['market', 'quotes', 'orders', 'contracts', 'logistics', 'opportunities'],
  },
  { id: 'company', label: 'Empresa', icon: Building2, pages: ['company'] },
];
function Brand() {
  return (
    <div className="marca">
      <img src="/arte/marca-logo.png" alt="" />
      <div>
        <strong>AFTERMARKET</strong>
        <small>Economia em movimento</small>
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
    { dia, hora } = relogio(world);
  useMarcarVisita();
  const vendasHoje = useResumoDoCaixa(comecoDoDia(world)).vendasHoje;
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
    inicio: <InicioPage />,
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
    quotes: <CotacoesPage />,
    orders: <PedidosPage />,
    contracts: <ContratosPage />,
  };
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className="topbar">
        <button
          className="brand-button"
          onClick={() => navigate('inicio')}
          aria-label="AFTERMARKET · Abrir o início"
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
              {visibleRegions.length > 0 && <small>Cidades</small>}
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
                    <small>{r.state}</small>
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
                <p>Nada encontrado. Tente o nome de uma cidade, empresa ou produto.</p>
              )}
            </div>
          )}
        </div>
        <div className="topbar-spacer" />
        <div className="top-metric top-caixa">
          <IconePixel nome="moeda" tamanho={26} />
          <div>
            <strong>{cr(freeCash(world, actor), 0)}</strong>
            <span>Caixa livre</span>
          </div>
        </div>
        <div className="top-metric top-result">
          <IconePixel nome="estrela" tamanho={26} />
          <div>
            <strong>{cr(vendasHoje, 0)}</strong>
            <span>Vendas hoje</span>
          </div>
        </div>
        <div className="top-metric top-relogio" aria-label={`Dia ${dia} do jogo, ${hora} horas`}>
          <IconePixel nome="prazo" tamanho={26} />
          <div>
            <strong>Dia {dia}</strong>
            <span>{String(hora).padStart(2, '0')}h no jogo</span>
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
              <small>{company.name}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {profile && (
            <div className="header-popover profile-popover">
              <div className="popover-title">
                <strong>{company.name}</strong>
                <Badge tone="gold">Em operação</Badge>
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
      <ReporGaveta />
      <ProdutoFicha />
      {settings && (
        <Modal title="Preferências do mundo" onClose={() => setSettings(false)}>
          <Badge tone="gold">Mundo ativo</Badge>
          <p>
            Alterne entre as empresas disponíveis para administrar propriedades, ofertas e entregas
            no mesmo território.
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
              { label: 'Ritmo do mundo', value: `1 minuto real = ${TIME_SCALE} minutos no jogo` },
              { label: 'Progresso', value: 'Salvo automaticamente' },
              { label: 'Economia e lotes', value: 'Dados simulados' },
              { label: 'Cartografia', value: 'OpenFreeMap / OpenStreetMap' },
            ]}
          />
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
