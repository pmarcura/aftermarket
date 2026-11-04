import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type {
  World,
  Command,
  Category,
  ProductId,
} from '../../../../packages/simulation/src/model';
import {
  Factory,
  Store,
  Sprout,
  Pickaxe,
  Truck,
  Warehouse,
  Mountain,
  Flame,
  Anvil,
  Bean,
  Wheat,
  Droplet,
  Candy,
  Milk,
  Recycle,
  Utensils,
  PawPrint,
  Package,
} from 'lucide-react';
import { Notice } from '../components/Notice';
import { createWorldConnection } from './world-connection';
import { createCommandConnection } from './command-connection';
import { definirPausa } from './clock';

// Formatadores prontos: criar um por número custa caro quando a tela formata milhares deles.
const moedas = new Map<number, Intl.NumberFormat>();
const numeros = new Map<number, Intl.NumberFormat>();
export const cr = (value: number, decimals = 2) => {
  let f = moedas.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    moedas.set(decimals, f);
  }
  return f.format(value / 100);
};
export const num = (value: number, decimals = 0) => {
  let f = numeros.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals });
    numeros.set(decimals, f);
  }
  return f.format(value);
};
export const categoryIcons = {
  industry: Factory,
  retail: Store,
  farm: Sprout,
  mine: Pickaxe,
  logistics: Truck,
  warehouse: Warehouse,
};
export function CategoryIcon({
  category,
  className = '',
  size = 18,
}: {
  category: Category;
  className?: string;
  size?: number;
}) {
  const Icon = categoryIcons[category];
  return <Icon size={size} className={className} strokeWidth={1.7} />;
}
// Ícones simples por item; sementes e mudas compartilham o broto.
const productIcons: Partial<Record<ProductId, typeof Package>> = {
  iron: Mountain,
  coal: Flame,
  steel: Anvil,
  soy: Bean,
  soymeal: Wheat,
  oil: Droplet,
  rice: Wheat,
  beans: Bean,
  sugar: Candy,
  milk: Milk,
  scrap: Recycle,
  utensils: Utensils,
  truckHeavy: Truck,
  truckLight: Truck,
  soySeed: Sprout,
  riceSeed: Sprout,
  beanSeed: Sprout,
  caneSeedling: Sprout,
  feed: Wheat,
  cow: PawPrint,
};
export function ProductIcon({ product, size = 16 }: { product: ProductId; size?: number }) {
  const Icon = productIcons[product] ?? Package;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
export type Page =
  | 'inicio'
  | 'map'
  | 'opportunities'
  | 'businesses'
  | 'market'
  | 'logistics'
  | 'company'
  | 'purchase'
  | 'industry'
  | 'retail'
  | 'carrier'
  | 'quotes'
  | 'orders'
  | 'contracts';
export interface MarketIntent {
  supplierId?: string;
  product?: ProductId;
  destinationId?: string;
  offerId?: string;
  quantity?: number;
}
export type OrdersTab = 'responder' | 'caminho' | 'concluidos';
interface GameContextValue {
  world: World;
  actor: string;
  setActor: (v: string) => void;
  pending: boolean;
  run: (command: Command, message: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  page: Page;
  navigate: (page: Page, preserveIntent?: boolean) => void;
  ordersIntent: { tab: OrdersTab; request: number; proporPedido?: string } | null;
  /** Abre Pedidos numa aba; com `proporPedido`, já abre a proposta para aquele pedido. */
  openOrders: (tab: OrdersTab, proporPedido?: string) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  focus: [number, number] | undefined;
  consumeFocus: () => void;
  focusMap: (coordinates: [number, number], propertyId?: string) => void;
  businessId: string;
  /** Abre o negócio; `aba` escolhe a aba de abertura da loja (Prateleira, Equipe…). */
  openBusiness: (id: string, aba?: string) => void;
  intent: MarketIntent;
  openMarket: (intent: MarketIntent) => void;
  /** Abre a gaveta de reposição (Mandar buscar) por cima da tela atual. */
  repor: { destinationId: string; product: ProductId } | null;
  openRepor: (alvo: { destinationId: string; product: ProductId } | null) => void;
  /** Produto aberto na ficha (gráfico de preço, quem produz e quem vende). */
  produtoAberto: ProductId | null;
  openProduto: (id: ProductId | null) => void;
  notice: (message: string, error?: boolean) => void;
}
const GameContext = createContext<GameContextValue | null>(null);
export const useGame = () => {
  const g = useContext(GameContext);
  if (!g) throw new Error('Game provider missing');
  return g;
};
export function GameProvider({ children }: { children: ReactNode }) {
  const latestWorld = useRef<World | null>(null);
  const [sendCommand] = useState(() => createCommandConnection());
  const operationPending = useRef(false);
  const [connection] = useState(() => createWorldConnection());
  const [world, setWorld] = useState<World | null>(null),
    [error, setError] = useState('');
  const [actor, changeActor] = useState(() =>
    localStorage.getItem('aftermarket.company') === 'player2' ? 'player2' : 'player',
  );
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const [page, changePage] = useState<Page>(
    (localStorage.getItem('aftermarket.page') as Page) || 'inicio',
  );
  const [selectedId, select] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState(
    () => localStorage.getItem('aftermarket.business') ?? 'e-industry',
  );
  const [focus, setFocus] = useState<[number, number]>();
  const consumeFocus = useCallback(() => setFocus(undefined), []);
  const [intent, setIntent] = useState<MarketIntent>({});
  const [ordersIntent, setOrdersIntent] = useState<GameContextValue['ordersIntent']>(null);
  const ordersRequest = useRef(0);
  const [produtoAberto, openProduto] = useState<ProductId | null>(null);
  const [repor, openRepor] = useState<{ destinationId: string; product: ProductId } | null>(null);
  const [pending, setPending] = useState(false),
    [toast, setToast] = useState<{ message: string; error: boolean; id: number }>();
  // Pede só quando o mundo mudou: o servidor responde 204 se a revisão e a empresa são as mesmas.
  const refresh = useCallback(
    async (force = false) => {
      const requestedActor = actorRef.current;
      const current = latestWorld.current;
      const since =
        current?.view?.actor === actorRef.current
          ? `?since=${current.revision}&actor=${actorRef.current}`
          : '';
      const next = await connection.read(requestedActor, since, force);
      if (requestedActor !== actorRef.current) return;
      if (!next) {
        setError('');
        return;
      }
      if (
        latestWorld.current?.view?.actor === requestedActor &&
        next.revision < latestWorld.current.revision
      )
        return;
      latestWorld.current = next;
      definirPausa(next.pausedMs);
      setWorld((previous) =>
        previous?.revision === next.revision &&
        previous.view?.actor === next.view?.actor &&
        Object.keys(previous.routes).length === Object.keys(next.routes).length
          ? previous
          : next,
      );
      setError('');
    },
    [connection],
  );
  useEffect(() => {
    void refresh().catch(() =>
      setError('Não foi possível conectar ao mundo. Verifique se o servidor está em execução.'),
    );
    const timer = setInterval(() => {
      if (!document.hidden)
        void refresh().catch(() => setError('Conexão interrompida. Tentando reconectar…'));
    }, 3000);
    const visible = () => {
      if (!document.hidden)
        void refresh().catch(() => setError('Conexão interrompida. Tentando reconectar…'));
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      connection.cancel();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);
  // Trocar de empresa pede o pacote da nova empresa na hora.
  useEffect(() => {
    if (latestWorld.current && latestWorld.current.view?.actor !== actor)
      void refresh().catch(() => setError('Não foi possível conectar à empresa. Tente novamente.'));
  }, [actor, refresh]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(undefined), 9000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notice = (message: string, isError = false) =>
    setToast({ message, error: isError, id: Date.now() });
  const navigate = (p: Page, preserveIntent = false) => {
    setOrdersIntent(null);
    if (p === 'market' || (p === 'logistics' && !preserveIntent)) setIntent({});
    changePage(p);
    localStorage.setItem('aftermarket.page', p);
  };
  const setActor = (a: string) => {
    changeActor(a);
    localStorage.setItem('aftermarket.company', a);
    navigate('map');
  };
  const run = async (command: Command, message: string) => {
    if (operationPending.current) return false;
    operationPending.current = true;
    setPending(true);
    const requestedActor = actor;
    try {
      const result = await sendCommand(requestedActor, command);
      if (!result) return false;
      if (actorRef.current === requestedActor) {
        if (!latestWorld.current || result.revision >= latestWorld.current.revision) {
          latestWorld.current = result;
          definirPausa(result.pausedMs);
          setWorld(result);
        }
        setError('');
        notice(message);
      }
      return true;
    } catch (e) {
      notice(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.', true);
      await refresh().catch(() => undefined);
      return false;
    } finally {
      operationPending.current = false;
      setPending(false);
    }
  };
  if (!world)
    return (
      <div className="connection-screen">
        <div className="brand-mark">A</div>
        <h1>AFTERMARKET</h1>
        <p>{error || 'Conectando à economia…'}</p>
        {error && (
          <button onClick={() => void refresh(true).catch(() => undefined)}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  return (
    <GameContext.Provider
      value={{
        world,
        actor,
        setActor,
        page,
        navigate,
        ordersIntent,
        openOrders: (tab, proporPedido) => {
          navigate('orders');
          setOrdersIntent({ tab, request: ++ordersRequest.current, proporPedido });
        },
        selectedId,
        select,
        focus,
        consumeFocus,
        pending,
        run,
        refresh,
        businessId,
        intent,
        notice,
        focusMap: (coordinates, propertyId) => {
          setFocus([...coordinates]);
          select(propertyId ?? null);
          navigate('map');
        },
        openBusiness: (id, aba) => {
          const live = latestWorld.current ?? world;
          const e = live.establishments.find((x) => x.id === id);
          if (!e) return;
          if (e.companyId !== actor) {
            const property = world.properties.find((p) => p.id === e.propertyId)!;
            setFocus([...property.coordinates]);
            select(property.id);
            navigate('map');
            return;
          }
          setBusinessId(id);
          localStorage.setItem('aftermarket.business', id);
          if (aba) sessionStorage.setItem('aftermarket.loja.aba', aba);
          navigate(
            e.installed === false && e.category !== 'retail'
              ? 'industry'
              : e.category === 'retail'
                ? 'retail'
                : e.category === 'logistics'
                  ? 'carrier'
                  : 'industry',
          );
        },
        repor,
        openRepor,
        produtoAberto,
        openProduto,
        openMarket: (next) => {
          setIntent(next);
          changePage('market');
          localStorage.setItem('aftermarket.page', 'market');
        },
      }}
    >
      {children}
      {!pending && sendCommand.unconfirmed(actor) && (
        <div className="connection-banner" role="status">
          Há uma operação aguardando confirmação.{' '}
          <button
            onClick={() =>
              void run(
                sendCommand.unconfirmed(actor)!,
                'Operação confirmada. Seus dados foram atualizados.',
              )
            }
          >
            Consultar operação
          </button>
        </div>
      )}
      {error && (
        <div className="connection-banner" role="status">
          {error}
        </div>
      )}
      {toast && <Notice key={toast.id} {...toast} onClose={() => setToast(undefined)} />}
    </GameContext.Provider>
  );
}
