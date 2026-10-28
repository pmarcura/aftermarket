import type { World, Property, Establishment, Category, Position } from './model';
import { ECONOMIC_INTERVAL, legacyProducts, products, recipes, type ProductId } from './model';
import { createSeasonConfig } from './calibration';
import { v2SeasonConfig } from './economy-v2';
import { operatingCosts, recordMarket } from './metrics';
import { initializeOperations } from './operations';
import { initializeCompetition } from './competition';
import { initializeDesign } from './design';
import { openV2Rivals, prepareV2Fleet } from './opening-v2';

// Mundo versão 1 por padrão; `economy: 2` abre a economia alvo da etapa B (D-028 a D-030).
export function createWorld(now = Date.now(), options: { economy?: 1 | 2 } = {}): World {
  const properties: Property[] = [];
  const establishments: Establishment[] = [];
  const add = (
    id: string,
    name: string,
    city: string,
    coordinates: Position,
    category: Category,
    ownerId: string | null,
    area = 120000,
    price = 68000000,
    state = 'SP',
  ) => {
    properties.push({
      id,
      name,
      city,
      state,
      coordinates,
      category,
      ownerId,
      area,
      price,
      road: city === 'Hortolândia' ? 'SP-101' : 'SP-330',
      roadDistance: 1.2,
      water: true,
    });
    if (ownerId && ownerId !== 'treasury')
      establishments.push({
        id: `e-${id}`,
        name,
        companyId: ownerId,
        propertyId: id,
        category,
        inventory: {},
        unitCosts: {},
        prices: {},
        capacityT: 1000,
        capacityM3: 2000,
        employees: category === 'industry' ? 86 : 24,
        dailyCost: category === 'industry' ? 840000 : 120000,
        revenue: 0,
        expenses: 0,
        enabled: true,
      });
  };
  add(
    'hortolandia',
    'Área industrial Hortolândia',
    'Hortolândia',
    [-47.2241, -22.8524],
    'industry',
    null,
    520000,
    185000000,
  );
  add('retail', 'Loja Campinas', 'Campinas', [-47.065, -22.906], 'retail', 'player', 840, 18500000);
  add(
    'industry',
    'Indústria de Aço',
    'Piracicaba',
    [-47.586, -22.73],
    'industry',
    'player',
    150000,
    87500000,
  );
  add(
    'farm',
    'Fazenda São José',
    'Sorocaba',
    [-47.478, -23.414],
    'farm',
    'player',
    4800000,
    54000000,
  );
  add(
    'mine',
    'Mineradora Horizonte',
    'Itabira',
    [-43.225, -19.62],
    'mine',
    'player',
    1800000,
    96000000,
    'MG',
  );
  add('warehouse', 'Centro de Distribuição', 'Jundiaí', [-46.915, -23.14], 'warehouse', 'player');
  add('retail2', 'Loja São José', 'São José dos Campos', [-45.887, -23.189], 'retail', 'player');
  add('warehouse2', 'Armazém Sul', 'Curitiba', [-49.273, -25.428], 'warehouse', 'player', 85000);
  add('logistics', 'Transportadora Aurora', 'Jundiaí', [-46.95, -23.18], 'logistics', 'player');
  add('ferrovale', 'FerroVale Comercial', 'Limeira', [-47.401, -22.568], 'mine', 'ferrovale');
  add(
    'minasferro',
    'Minas Ferro S.A.',
    'Itabira',
    [-43.21, -19.58],
    'mine',
    'minas',
    1800000,
    90000000,
    'MG',
  );
  add(
    'metais',
    'Metais Horizonte',
    'Belo Horizonte',
    [-43.94, -19.92],
    'mine',
    'metais',
    1800000,
    90000000,
    'MG',
  );
  add('supplier', 'Distribuidora Aurora', 'Americana', [-47.32, -22.731], 'warehouse', 'aurora');
  add(
    'agro',
    'AgroVale Alimentos',
    'Santa Bárbara d’Oeste',
    [-47.446, -22.777],
    'farm',
    'agro',
    4200000,
  );
  add('botfactory', 'Óleo Brasil Indústria', 'Sumaré', [-47.267, -22.817], 'industry', 'agro');
  add('marketbot', 'Mercado União', 'Campinas', [-47.105, -22.875], 'retail', 'aurora');
  add(
    'newretail',
    'Ponto comercial Campinas',
    'Campinas',
    [-47.032, -22.86],
    'retail',
    null,
    1200,
    32000000,
  );
  add(
    'newfarm',
    'Área rural Monte Mor',
    'Monte Mor',
    [-47.35, -22.982],
    'farm',
    null,
    3200000,
    98000000,
  );
  add(
    'newlogistics',
    'Pátio logístico Indaiatuba',
    'Indaiatuba',
    [-47.215, -23.045],
    'logistics',
    null,
    80000,
    72000000,
  );
  add(
    'newmine',
    'Concessão virtual Limeira',
    'Limeira',
    [-47.32, -22.53],
    'mine',
    null,
    1800000,
    145000000,
  );
  add(
    'newindustry',
    'Galpão industrial Americana',
    'Americana',
    [-47.36, -22.7],
    'industry',
    null,
    85000,
    64000000,
  );
  const e = (id: string) => establishments.find((x) => x.id === `e-${id}`)!;
  e('industry').inventory = { iron: 120, coal: 18, steel: 24, soy: 4 };
  e('industry').prices = { steel: 285000 };
  e('retail').inventory = { oil: 1240, rice: 980, beans: 650, sugar: 420, milk: 45 };
  e('retail').prices = { oil: 890, rice: 2490, beans: 890, sugar: 1690, milk: 590 };
  e('retail2').inventory = { oil: 20, rice: 12 };
  e('retail2').prices = { oil: 1020, rice: 2890 };
  e('warehouse2').enabled = false;
  e('farm').inventory = { soy: 80 };
  e('mine').inventory = { iron: 650 };
  e('mine').reserve = 20000;
  e('ferrovale').inventory = { iron: 180, coal: 80 };
  e('ferrovale').reserve = 18000;
  e('minasferro').inventory = { iron: 500 };
  e('minasferro').reserve = 45000;
  e('metais').inventory = { iron: 950 };
  e('metais').reserve = 30000;
  e('supplier').inventory = {
    iron: 90,
    coal: 120,
    oil: 2500,
    rice: 2000,
    beans: 1500,
    milk: 1800,
    sugar: 1500,
  };
  e('agro').inventory = { soy: 600 };
  e('botfactory').inventory = { soy: 40, oil: 12000 };
  e('marketbot').inventory = { oil: 400, rice: 300 };
  e('marketbot').prices = { oil: 850, rice: 2390 };
  if (options.economy === 2) {
    // Estoques declarados da abertura v2: a distribuidora vende sementes, mudas e matrizes finitas.
    Object.assign(e('supplier').inventory, {
      soySeed: 6,
      riceSeed: 2000,
      beanSeed: 2000,
      caneSeedling: 80,
      cow: 300,
      utensils: 3000,
    });
    e('agro').inventory.soySeed = 1.2;
    e('farm').inventory.soySeed = 1.2;
  }
  for (const establishment of establishments)
    for (const id of Object.keys(establishment.inventory) as ProductId[])
      establishment.unitCosts[id] = Math.round(
        products[id].basePrice * (establishment.category === 'retail' ? 0.67 : 0.75),
      );
  const vehicles: World['vehicles'] = [];
  for (const [owner, count] of [
    ['player', 12],
    ['transbrasil', 5],
    ['rodoleste', 4],
    ['expresso', 4],
  ] as const) {
    for (let i = 0; i < count; i++)
      vehicles.push({
        id: `${owner}-truck-${i}`,
        name: `TRK-${String(81 - i * 3).padStart(3, '0')}`,
        companyId: owner,
        capacityT: i < 7 ? 30 : i < 10 ? 16 : 8,
        capacityM3: i < 7 ? 85 : 45,
        propertyId: 'logistics',
        status: owner === 'player' && i === 3 ? 'maintenance' : 'available',
      });
  }
  const world: World = {
    operationsVersion: 1,
    orders: [],
    infrastructure: [],
    consumptionHistory: [],
    consumedMaterials: {},
    version: 2,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    nextEconomicAt: now + ECONOMIC_INTERVAL,
    companies: [
      { id: 'player', name: 'Silva Participações', bot: false, balance: 285062500 },
      { id: 'player2', name: 'Costa Empreendimentos', bot: false, balance: 285062500 },
      ...[
        ['ferrovale', 'FerroVale Comercial'],
        ['minas', 'Minas Ferro S.A.'],
        ['metais', 'Metais Horizonte'],
        ['aurora', 'Grupo Aurora'],
        ['agro', 'AgroVale Alimentos'],
        ['transbrasil', 'TransBrasil Logística'],
        ['rodoleste', 'RodoLeste Transportes'],
        ['expresso', 'Expresso Paulista'],
      ].map(([id, name]) => ({ id, name, bot: true, balance: 650000000 })),
      { id: 'treasury', name: 'Serviços e propriedades do mundo', bot: true, balance: 0 },
      { id: 'consumers', name: 'Orçamento dos consumidores', bot: true, balance: 5000000000 },
    ],
    properties,
    establishments,
    vehicles,
    offers: [
      { id: 'offer-minas', establishmentId: 'e-minasferro', product: 'iron', price: 24000 },
      { id: 'offer-ferrovale', establishmentId: 'e-ferrovale', product: 'iron', price: 25800 },
      { id: 'offer-metais', establishmentId: 'e-metais', product: 'iron', price: 23100 },
      { id: 'offer-aurora', establishmentId: 'e-supplier', product: 'iron', price: 26300 },
      { id: 'offer-coal', establishmentId: 'e-ferrovale', product: 'coal', price: 42000 },
      { id: 'offer-oil', establishmentId: 'e-botfactory', product: 'oil', price: 540 },
      { id: 'offer-rice', establishmentId: 'e-supplier', product: 'rice', price: 1860 },
      { id: 'offer-beans', establishmentId: 'e-supplier', product: 'beans', price: 640 },
      { id: 'offer-milk', establishmentId: 'e-supplier', product: 'milk', price: 440 },
      { id: 'offer-sugar', establishmentId: 'e-supplier', product: 'sugar', price: 1270 },
      { id: 'offer-soy', establishmentId: 'e-agro', product: 'soy', price: 148000 },
    ],
    shipments: [],
    jobs: [],
    ledger: [],
    routes: {},
    currency: 'BRL',
    economyStartedAt: now,
    marketHistory: [],
    season: {
      id: `local-${now}`,
      name: 'Temporada local',
      startedAt: now,
      config:
        options.economy === 2
          ? v2SeasonConfig()
          : createSeasonConfig(
              Object.fromEntries(
                Object.entries(legacyProducts).map(([id, p]) => [id, p.basePrice]),
              ) as Record<ProductId, number>,
              recipes,
            ),
    },
  };
  initializeOperations(world);
  if (options.economy === 2) prepareV2Fleet(world);
  for (const p of world.properties) {
    p.energyConnected = true;
    if (!p.ownerId) calibrateProperty(p);
  }
  for (const offer of world.offers)
    offer.price = Math.round(
      products[offer.product].basePrice * (products[offer.product].unit === 'un' ? 0.78 : 1),
    );
  for (const establishment of world.establishments) {
    establishment.automation = world.companies.find((c) => c.id === establishment.companyId)!.bot;
    for (const id of Object.keys(establishment.prices) as ProductId[])
      establishment.prices[id] = products[id].basePrice;
    establishment.dailyCost = operatingCosts(world, establishment).total;
  }
  initializeCompetition(world, now);
  openV2Rivals(world, now);
  initializeDesign(world, now);
  recordMarket(world, now);
  return world;
}

export function calibrateProperty(p: Property) {
  if (p.category === 'industry') {
    p.area = Math.min(p.area, 12000);
    p.price = Math.round(p.area * 20000);
  }
  if (p.category === 'retail') {
    p.area = Math.min(p.area, 180);
    p.price = Math.round(p.area * 350000);
  }
  if (p.category === 'logistics') {
    p.area = Math.min(p.area, 15000);
    p.price = Math.round(p.area * 25000);
  }
  if (p.category === 'farm') p.price = Math.round(p.area * 700);
  if (p.category === 'mine') p.price = 72000000; // direito virtual, não preço de um título minerário real
}
