export type Category = 'retail' | 'industry' | 'farm' | 'mine' | 'warehouse' | 'logistics';
export type ProductId =
  'iron' | 'coal' | 'steel' | 'soy' | 'soymeal' | 'oil' | 'rice' | 'beans' | 'sugar' | 'milk';
export type Position = [number, number];
export interface Company {
  id: string;
  name: string;
  bot: boolean;
  balance: number;
}
export interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  category: Category;
  coordinates: Position;
  area: number;
  price: number;
  ownerId: string | null;
  road: string;
  roadDistance: number;
  water: boolean;
  energyConnected?: boolean;
}
export interface Establishment {
  id: string;
  name: string;
  companyId: string;
  propertyId: string;
  category: Category;
  inventory: Partial<Record<ProductId, number>>;
  prices: Partial<Record<ProductId, number>>;
  unitCosts: Partial<Record<ProductId, number>>;
  capacityT: number;
  capacityM3: number;
  employees: number;
  dailyCost: number;
  revenue: number;
  expenses: number;
  enabled: boolean;
  reserve?: number;
  automation?: boolean;
  automationDailyBudget?: number;
}
export interface Offer {
  id: string;
  establishmentId: string;
  product: ProductId;
  price: number;
}
export interface Vehicle {
  id: string;
  companyId: string;
  name: string;
  capacityT: number;
  capacityM3: number;
  propertyId: string;
  status: 'available' | 'route' | 'maintenance';
  purchasePrice?: number;
}
export interface Shipment {
  id: string;
  buyerId: string;
  sellerId: string;
  originId: string;
  destinationId: string;
  product: ProductId;
  quantity: number;
  cost: number;
  freight: number;
  carrierId: string;
  vehicleId: string;
  departedAt: number;
  arrivesAt: number;
  delivered: boolean;
  distance: number;
  route?: Position[];
  routeSource?: 'osrm' | 'estimate';
  pickupAt?: number;
  roadDepartureAt?: number;
  roadArrivalAt?: number;
}
export interface Job {
  id: string;
  establishmentId: string;
  recipeId: string;
  cycles: number;
  startedAt: number;
  finishesAt: number;
  completed: boolean;
  cost: number;
  output?: Partial<Record<ProductId, number>>;
  outputCosts?: Partial<Record<ProductId, number>>;
  charges?: {
    processing: number;
    energy: number;
    water: number;
    energyKwh: number;
    waterM3: number;
  };
}
export interface Entry {
  id: string;
  at: number;
  from: string;
  to: string;
  amount: number;
  description: string;
  establishmentId?: string;
  kind:
    | 'trade'
    | 'freight'
    | 'property'
    | 'operation'
    | 'retail'
    | 'vehicle'
    | 'energy'
    | 'water'
    | 'payroll'
    | 'maintenance'
    | 'budget';
  product?: ProductId;
  quantity?: number;
  unitPrice?: number;
  regionId?: string;
  channel?: 'wholesale' | 'retail' | 'internal';
}
export interface MarketSample {
  at: number;
  product: ProductId;
  regionId: string;
  price: number | null;
  stock: number;
  offerCount: number;
  tradedQuantity: number;
  tradedValue: number;
}
export interface World {
  version: 2;
  revision: number;
  createdAt: number;
  updatedAt: number;
  nextEconomicAt: number;
  companies: Company[];
  properties: Property[];
  establishments: Establishment[];
  offers: Offer[];
  vehicles: Vehicle[];
  shipments: Shipment[];
  jobs: Job[];
  ledger: Entry[];
  routes: Record<string, Route>;
  marketHistory: MarketSample[];
  economyStartedAt: number;
  currency: 'BRL';
  season: { id: string; name: string; startedAt: number; config: SeasonConfig };
}
export interface Route {
  coordinates: Position[];
  distanceKm: number;
  durationSeconds: number;
  source: 'osrm' | 'estimate';
}
export type Command =
  | { type: 'buyProperty'; propertyId: string; name: string }
  | {
      type: 'trade';
      offerId: string;
      quantity: number;
      destinationId: string;
      carrierId: string;
      expectedTotal?: number;
    }
  | { type: 'produce'; establishmentId: string; recipeId: string; cycles: number }
  | { type: 'extract'; establishmentId: string; quantity: number }
  | { type: 'setPrice'; establishmentId: string; product: ProductId; price: number }
  | { type: 'publishOffer'; establishmentId: string; product: ProductId; price: number }
  | { type: 'toggleOperation'; establishmentId: string }
  | { type: 'setAutomation'; establishmentId: string; enabled: boolean }
  | { type: 'buyVehicle' };
export interface Recipe {
  id: string;
  name: string;
  category: Category;
  input: Partial<Record<ProductId, number>>;
  output: Partial<Record<ProductId, number>>;
  cost: number;
  duration: number;
  energyKwh: number;
  waterM3: number;
}
export const TIME_SCALE = 120;
export const ECONOMIC_INTERVAL = 60_000; // duas horas virtuais por minuto real
export const products: Record<
  ProductId,
  {
    name: string;
    category: string;
    unit: string;
    massT: number;
    volumeM3: number;
    basePrice: number;
  }
> = {
  iron: {
    name: 'Minério de ferro',
    category: 'Matérias-primas',
    unit: 't',
    massT: 1,
    volumeM3: 0.45,
    basePrice: 50000,
  },
  coal: {
    name: 'Carvão mineral',
    category: 'Matérias-primas',
    unit: 't',
    massT: 1,
    volumeM3: 1.3,
    basePrice: 180000,
  },
  steel: {
    name: 'Aço em barras',
    category: 'Materiais',
    unit: 't',
    massT: 1,
    volumeM3: 0.15,
    basePrice: 480000,
  },
  soy: {
    name: 'Soja em grão',
    category: 'Agricultura',
    unit: 't',
    massT: 1,
    volumeM3: 1.4,
    basePrice: 250000,
  },
  soymeal: {
    name: 'Farelo de soja',
    category: 'Agricultura',
    unit: 'kg',
    massT: 0.001,
    volumeM3: 0.0017,
    basePrice: 230,
  },
  oil: {
    name: 'Óleo de soja 1 L',
    category: 'Alimentos',
    unit: 'un',
    massT: 0.00092,
    volumeM3: 0.0013,
    basePrice: 849,
  },
  rice: {
    name: 'Arroz 5 kg',
    category: 'Alimentos',
    unit: 'un',
    massT: 0.005,
    volumeM3: 0.007,
    basePrice: 2345,
  },
  beans: {
    name: 'Feijão 1 kg',
    category: 'Alimentos',
    unit: 'un',
    massT: 0.001,
    volumeM3: 0.0015,
    basePrice: 870,
  },
  sugar: {
    name: 'Açúcar 5 kg',
    category: 'Alimentos',
    unit: 'un',
    massT: 0.005,
    volumeM3: 0.006,
    basePrice: 1745,
  },
  milk: {
    name: 'Leite 1 L',
    category: 'Bebidas',
    unit: 'un',
    massT: 0.00103,
    volumeM3: 0.0012,
    basePrice: 549,
  },
};
export const recipes: Recipe[] = [
  {
    id: 'steel-bars',
    name: 'Aço em barras',
    category: 'industry',
    input: { iron: 12, coal: 3 },
    output: { steel: 8 },
    cost: 1200000,
    duration: 3_600_000 / TIME_SCALE,
    energyKwh: 4400,
    waterM3: 24,
  },
  {
    id: 'soy-oil',
    name: 'Óleo de soja',
    category: 'industry',
    input: { soy: 1 },
    output: { oil: 200, soymeal: 760 },
    cost: 16000,
    duration: 3_600_000 / TIME_SCALE,
    energyKwh: 150,
    waterM3: 0.5,
  },
  {
    id: 'soy-harvest',
    name: 'Colheita de soja',
    category: 'farm',
    input: { soy: 1 },
    output: { soy: 26 },
    cost: 1280000,
    duration: 86_400_000 / TIME_SCALE,
    energyKwh: 80,
    waterM3: 25,
  },
  {
    id: 'iron-extraction',
    name: 'Extração de minério',
    category: 'mine',
    input: {},
    output: { iron: 1 },
    cost: 14500,
    duration: 3000,
    energyKwh: 30,
    waterM3: 0.8,
  },
];
export const categoryInfo: Record<Category, { label: string; color: string }> = {
  retail: { label: 'Comércio', color: '#df7165' },
  industry: { label: 'Indústria', color: '#82929b' },
  farm: { label: 'Agricultura', color: '#65a371' },
  mine: { label: 'Mineração', color: '#bc915a' },
  warehouse: { label: 'Armazém', color: '#b68abc' },
  logistics: { label: 'Logística', color: '#5c9bc4' },
};
import type { SeasonConfig } from './calibration';
