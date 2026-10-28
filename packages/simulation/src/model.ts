export type Category = 'retail' | 'industry' | 'farm' | 'mine' | 'warehouse' | 'logistics';
import { designItems, itemCategory, referencePrice } from './catalog';

// Produtos da economia original; mundos da versão 2 somam os itens novos do catálogo.
export type LegacyProductId =
  'iron' | 'coal' | 'steel' | 'soy' | 'soymeal' | 'oil' | 'rice' | 'beans' | 'sugar' | 'milk';
export const newProductIds = [
  'scrap',
  'utensils',
  'truckHeavy',
  'truckLight',
  'soySeed',
  'feed',
  'cow',
  'riceSeed',
  'beanSeed',
  'caneSeedling',
] as const;
export type ProductId = LegacyProductId | (typeof newProductIds)[number];
export type Position = [number, number];
export interface Company {
  id: string;
  name: string;
  bot: boolean;
  balance: number;
  lastExpansionAt?: number;
  lastRecoveryAt?: number;
  homeState?: string;
  behaviorVersion?: number;
  strategy?: 'regional' | 'quality' | 'value';
  financingExpense?: number;
  // Versão 2: decisão diária de frota dos bots e rodadas do dia com a frota toda ocupada.
  lastFleetAt?: number;
  fleetBusyRounds?: number;
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
  // A posição do imóvel passa a representar sua entrada na via, após validação de ida e volta.
  roadAccess?: {
    status: 'connected' | 'unreachable';
    originalCoordinates: Position;
    checkedAt: number;
    network: string;
    reason?: string;
  };
  water: boolean;
  energyConnected?: boolean;
}
export interface Establishment {
  // Fração líquida de nascimentos menos aposentadorias ainda não formada em unidade (rebanho).
  herdCarry?: number;
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
  quality?: Partial<Record<ProductId, number>>;
  specialization?: string;
  automationCycles?: number;
  automationStatus?: string;
  supplyPolicy?: SupplyPolicy;
  supplyStatus?: string;
  supplyReorder?: ProductId[];
  // Versão 2: produto sem fornecedor elegível só volta a ser procurado depois deste instante.
  supplyRetryAt?: Partial<Record<ProductId, number>>;
  education?: number;
  mothballed?: boolean;
  installed?: boolean;
  equipmentLines?: number;
  installationValue?: number;
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
  // Versão 2: modelo fabricado e quilômetros rodados, que encarecem a manutenção.
  model?: 'truckHeavy' | 'truckLight';
  odometerKm?: number;
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
  mapRoute?: Position[];
  mapRouteSource?: 'osrm';
  mapRouteKey?: string;
  routeKey?: string;
  pickupAt?: number;
  roadDepartureAt?: number;
  roadArrivalAt?: number;
  quality?: number;
  orderId?: string;
  infrastructureId?: string;
  batchId?: string;
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
  quality?: number;
  lines?: number;
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
    | 'budget'
    | 'education'
    | 'loan'
    | 'repayment'
    | 'finance'
    | 'asset-sale';
  // Equipamentos pagos são capitalizados junto ao ativo da unidade.
  // Principais de empréstimo são passivos, não receita/despesa operacional.
  // educação tem pagamento próprio no extrato
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
  roadPaths?: Record<string, Position[]>;
  marketHistory: MarketSample[];
  economyStartedAt: number;
  currency: 'BRL';
  season: { id: string; name: string; startedAt: number; config: SeasonConfig };
  operationsVersion: number;
  competitionVersion?: number;
  designVersion?: number;
  requireRoadRoutes?: boolean;
  roadAccessVersion?: 1;
  obligations?: Obligation[];
  loans?: RecoveryLoan[];
  publicBenchmarks?: Partial<Record<ProductId, PublicBenchmark>>;
  stateWages?: Record<
    string,
    { index: number; updatedAt: number; history: { at: number; index: number }[] }
  >;
  training?: Training[];
  botActivity?: { at: number; companyId: string; text: string; kind: string }[];
  supplyHistory?: {
    at: number;
    establishmentId: string;
    product: ProductId;
    quantity: number;
    cost: number;
    source: string;
  }[];
  orders: PurchaseOrder[];
  infrastructure: InfrastructureContract[];
  consumptionHistory: ConsumptionSample[];
  // Fração de demanda ainda não vendida por loja e produto; carregada entre rodadas (auditoria M04).
  retailCarry?: Record<string, number>;
  consumedMaterials: Partial<Record<ProductId, number>>;
  // Só no pacote enviado ao navegador (apps/server/src/view.ts): totais calculados no servidor
  // a partir do extrato completo, que não viaja inteiro.
  view?: WorldViewSummary;
  // Totais do histórico arquivado no banco (history.ts); ausente enquanto nada foi arquivado.
  history?: import('./history').HistoryBaseline;
}
export type Health = {
  all: number;
  families: number;
  governments: number;
  privateCash: number;
  turnover: number;
  velocity: number;
  obligations: number;
  hhi: number | null;
  retailFulfillment: number | null;
  active: number;
  mothballed: number;
};
export interface WorldViewSummary {
  actor: string;
  // Extrato do jogador: dias de jogo incluídos; totais por tipo desde a abertura.
  ledgerDays: number;
  totals: Partial<Record<Entry['kind'], { in: number; out: number }>>;
  retailByEstablishment: Record<string, number>;
  tradeTotals: Record<string, Record<string, { tradedQuantity: number; tradedValue: number }>>;
  health: Record<string, Health>;
}
export interface PurchaseOrder {
  escrowReserved?: number;
  supplyManaged?: boolean;
  id: string;
  buyerId: string;
  sellerId: string;
  originId: string;
  destinationId: string;
  product: ProductId;
  quantity: number;
  unitPrice: number;
  carrierId: string;
  maxFreight: number;
  createdAt: number;
  deadline: number;
  status: 'pending' | 'accepted' | 'delivered' | 'rejected' | 'expired';
  proposals?: OrderProposal[];
  acceptedProposalId?: string;
}
export interface InfrastructureContract {
  id: string;
  title: string;
  destinationId: string;
  product: ProductId;
  state?: string;
  municipality?: string;
  treasuryId?: string;
  referencePrice?: number;
  referenceSource?: string;
  biddingEndsAt?: number;
  bids?: InfrastructureBid[];
  program?: string;
  quantity: number;
  unitPrice: number;
  minQuality: number;
  maxFreight: number;
  reserved: number;
  createdAt: number;
  deadline: number;
  status: 'open' | 'delivering' | 'completed' | 'expired';
  supplierId?: string;
  originId?: string;
  deliveredQuantity: number;
  paid?: number;
}
export interface ConsumptionSample {
  at: number;
  establishmentId: string;
  product: ProductId;
  desired: number;
  sold: number;
  weekday: number;
  quality: number;
}
export interface Route {
  coordinates: Position[];
  distanceKm: number;
  durationSeconds: number;
  source: 'osrm' | 'estimate';
  fetchedAt?: number;
  profile?: 'driving';
  steps?: { name: string; distanceM: number; durationSeconds: number; location: Position }[];
}
export type Command =
  | { type: 'installBusiness'; establishmentId: string; recipeId?: string; lines: number }
  | { type: 'takeRecoveryLoan'; state: string; amount: number }
  | { type: 'payObligations'; amount: number }
  | { type: 'repayLoan'; loanId: string; amount: number }
  | { type: 'mothball'; establishmentId: string; enabled: boolean }
  | { type: 'sellVehicle'; vehicleId: string }
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
  | {
      type: 'configureProduction';
      establishmentId: string;
      recipeId: string;
      cycles: number;
      dailyBudget: number;
      enabled: boolean;
    }
  | { type: 'setWorkforce'; establishmentId: string; employees: number }
  | {
      type: 'requestOrder';
      reserveFunds?: boolean;
      offerId: string;
      destinationId: string;
      quantity: number;
      carrierId: string;
      maxFreight: number;
      deliveryDays: number;
      expectedUnitPrice?: number;
    }
  | { type: 'acceptOrder'; orderId: string }
  | { type: 'rejectOrder'; orderId: string }
  | {
      type: 'fulfillInfrastructure';
      contractId: string;
      establishmentId: string;
      carrierId: string;
      expectedFreight: number;
    }
  | { type: 'configureSupply'; establishmentId: string; policy: SupplyPolicy }
  | {
      type: 'transferStock';
      originId: string;
      destinationId: string;
      product: ProductId;
      quantity: number;
      carrierId: string;
      expectedFreight?: number;
    }
  | {
      type: 'createPurchaseRequest';
      reserveFunds?: boolean;
      destinationId: string;
      product: ProductId;
      quantity: number;
      unitPrice: number;
      maxFreight: number;
      deliveryDays: number;
    }
  | {
      type: 'proposeOrder';
      orderId: string;
      establishmentId?: string;
      unitPrice: number;
      quantity: number;
      maxFreight: number;
      deliveryDays: number;
      carrierId: string;
    }
  | { type: 'acceptProposal'; orderId: string; proposalId: string }
  | {
      type: 'bidInfrastructure';
      contractId: string;
      establishmentId: string;
      carrierId: string;
      unitPrice: number;
    }
  | { type: 'trainWorkforce'; establishmentId: string }
  | {
      type: 'buyVehicle';
      // Versão 2: modelo e, opcionalmente, a montadora vendedora; sem ela, concessionária.
      model?: 'truckHeavy' | 'truckLight';
      sellerEstablishmentId?: string;
    }
  | { type: 'scrapVehicle'; vehicleId: string };
export interface Recipe {
  id: string;
  name: string;
  category: Category;
  input: Partial<Record<ProductId, number>>;
  output: Partial<Record<ProductId, number>>;
  // Itens que precisam estar na linha sem serem consumidos (rebanho), por linha.
  requires?: Partial<Record<ProductId, number>>;
  cost: number;
  duration: number;
  energyKwh: number;
  waterM3: number;
  // Massa que sai do processo sem virar item (escória, gases, umidade), por ciclo.
  lossKg?: number;
  // Rebanho: nascimentos e aposentadorias por ciclo de uma linha, aplicados em unidades inteiras.
  herd?: { product: ProductId; births: number; retirements: number };
  // Receita que a mesma instalação pode usar no lugar desta, lote a lote (reciclagem).
  alternativeOf?: string;
}
export const TIME_SCALE = 120;
export const ECONOMIC_INTERVAL = 60_000; // duas horas virtuais por minuto real
export interface ProductInfo {
  name: string;
  category: string;
  unit: string;
  massT: number;
  volumeM3: number;
  basePrice: number;
}
export const legacyProducts: Record<LegacyProductId, ProductInfo> = {
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
export const products: Record<ProductId, ProductInfo> = {
  ...legacyProducts,
  ...(Object.fromEntries(
    newProductIds.map((id) => [
      id,
      {
        name: designItems[id].name,
        category: itemCategory[id],
        unit: designItems[id].unit,
        massT: designItems[id].massKg / 1000,
        volumeM3: designItems[id].volumeM3,
        basePrice: referencePrice(id),
      },
    ]),
  ) as Record<(typeof newProductIds)[number], ProductInfo>),
};
// Produtos existentes na temporada deste mundo (a configuração congelada define o conjunto).
export const seasonProducts = (w: Pick<World, 'season'>) =>
  Object.keys(w.season.config.basePrices) as ProductId[];
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

export interface SupplyRule {
  originId?: string;
  product: ProductId;
  minimum: number;
  target: number;
  maxBuy: number;
  maxPrice: number;
  // Teto de frete por unidade só deste produto; sem ele vale o da política.
  maxFreightPerUnit?: number;
}
export interface SupplyPolicy {
  reserveOrders?: boolean;
  enabled: boolean;
  dailyBudget: number;
  cashReserve: number;
  source: 'internal-first' | 'internal-only' | 'market';
  purchaseMode: 'immediate' | 'request';
  maxDistanceKm: number;
  minQuality: number;
  maxFreightPerUnit: number;
  carrierId: string;
  rules: SupplyRule[];
}
export interface OrderProposal {
  id: string;
  proposedBy: string;
  sellerId: string;
  originId: string;
  unitPrice: number;
  quantity: number;
  maxFreight: number;
  deadline: number;
  carrierId: string;
  createdAt: number;
}
export interface InfrastructureBid {
  id: string;
  supplierId: string;
  originId: string;
  carrierId: string;
  unitPrice: number;
  quality: number;
  deliveryMs: number;
  freight: number;
  score: number;
  createdAt: number;
  status: 'valid' | 'won' | 'lost' | 'invalid';
  reason?: string;
}
export interface Training {
  id: string;
  establishmentId: string;
  cost: number;
  targetLevel: number;
  finishesAt: number;
  completed: boolean;
}

export interface Obligation {
  id: string;
  companyId: string;
  establishmentId: string;
  to: string;
  kind: 'payroll' | 'maintenance' | 'energy' | 'water';
  description: string;
  amount: number;
  paid: number;
  dueAt: number;
}
export interface RecoveryLoan {
  id: string;
  companyId: string;
  treasuryId: string;
  principal: number;
  repaid: number;
  fee: number;
  createdAt: number;
  nextDueAt: number;
  installment: number;
  durationDays: number;
}
export interface PublicBenchmark {
  price: number;
  at: number;
  trades: number;
  buyers: number;
  sellers: number;
  source: 'opening' | 'trades' | 'retained';
}
