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
import { Factory, Store, Sprout, Pickaxe, Truck, Warehouse } from 'lucide-react';
import { Notice } from '../components/Notice';

export const cr = (value: number, decimals = 2) =>
  (value / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
export const num = (value: number, decimals = 0) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
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
export type Page =
  | 'map'
  | 'opportunities'
  | 'businesses'
  | 'market'
  | 'logistics'
  | 'company'
  | 'purchase'
  | 'industry'
  | 'retail'
  | 'carrier';
export interface MarketIntent {
  supplierId?: string;
  product?: ProductId;
  destinationId?: string;
  offerId?: string;
  quantity?: number;
}
interface GameContextValue {
  world: World;
  actor: string;
  setActor: (v: string) => void;
  pending: boolean;
  run: (command: Command, message: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  page: Page;
  navigate: (page: Page, preserveIntent?: boolean) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  focus: [number, number] | undefined;
  consumeFocus: () => void;
  focusMap: (coordinates: [number, number], propertyId?: string) => void;
  businessId: string;
  openBusiness: (id: string) => void;
  intent: MarketIntent;
  openMarket: (intent: MarketIntent) => void;
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
  const [world, setWorld] = useState<World | null>(null),
    [error, setError] = useState('');
  const [actor, changeActor] = useState(() =>
    localStorage.getItem('aftermarket.company') === 'player2' ? 'player2' : 'player',
  );
  const [page, changePage] = useState<Page>(
    (localStorage.getItem('aftermarket.page') as Page) || 'map',
  );
  const [selectedId, select] = useState<string | null>('hortolandia');
  const [businessId, setBusinessId] = useState(
    () => localStorage.getItem('aftermarket.business') ?? 'e-industry',
  );
  const [focus, setFocus] = useState<[number, number]>();
  const consumeFocus = useCallback(() => setFocus(undefined), []);
  const [intent, setIntent] = useState<MarketIntent>({});
  const [pending, setPending] = useState(false),
    [toast, setToast] = useState<{ message: string; error: boolean; id: number }>();
  const refresh = useCallback(async () => {
    const response = await fetch('/api/world');
    if (!response.ok) throw new Error('O servidor não respondeu.');
    const next: World = await response.json();
    latestWorld.current = next;
    setWorld((previous) =>
      previous?.revision === next.revision &&
      Object.keys(previous.routes).length === Object.keys(next.routes).length
        ? previous
        : next,
    );
    setError('');
  }, []);
  useEffect(() => {
    void refresh().catch(() =>
      setError('Não foi possível conectar ao mundo. Verifique se o servidor está em execução.'),
    );
    const timer = setInterval(
      () => void refresh().catch(() => setError('Conexão interrompida. Tentando reconectar…')),
      3000,
    );
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(undefined), 9000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notice = (message: string, isError = false) =>
    setToast({ message, error: isError, id: Date.now() });
  const navigate = (p: Page, preserveIntent = false) => {
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
    if (pending) return false;
    setPending(true);
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': actor,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      latestWorld.current = result;
      setWorld(result);
      notice(message);
      return true;
    } catch (e) {
      notice(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.', true);
      await refresh().catch(() => undefined);
      return false;
    } finally {
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
          <button onClick={() => void refresh().catch(() => undefined)}>Tentar novamente</button>
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
        openBusiness: (id) => {
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
        openMarket: (next) => {
          setIntent(next);
          changePage('market');
          localStorage.setItem('aftermarket.page', 'market');
        },
      }}
    >
      {children}
      {error && (
        <div className="connection-banner" role="status">
          {error}
        </div>
      )}
      {toast && <Notice key={toast.id} {...toast} onClose={() => setToast(undefined)} />}
    </GameContext.Provider>
  );
}
