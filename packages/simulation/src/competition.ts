import {
  products,
  type World,
  type Establishment,
  type ProductId,
  type Category,
  type SupplyPolicy,
} from './model';
import { regions } from '../../world/src/regions';
import { GAME_DAY, defaultSpecialization } from './operations';
import { householdItems } from './channels';

export const stateFactors: Record<string, number> = {
  AC: 0.85,
  AL: 0.84,
  AP: 0.9,
  AM: 0.92,
  BA: 0.9,
  CE: 0.88,
  DF: 1.2,
  ES: 1.03,
  GO: 0.99,
  MA: 0.83,
  MT: 1.05,
  MS: 1.01,
  MG: 0.98,
  PA: 0.91,
  PB: 0.84,
  PR: 1.03,
  PE: 0.89,
  PI: 0.82,
  RJ: 1.1,
  RN: 0.87,
  RS: 1.04,
  RO: 0.91,
  RR: 0.9,
  SC: 1.08,
  SP: 1.12,
  SE: 0.86,
  TO: 0.9,
};
export const competitionRules = {
  version: 1,
  botCount: 30,
  botCapital: 100000000,
  governmentBonus: 1.25,
  biddingHours: 6,
  maxOpenContracts: 5,
  educationPerWorker: 35000,
  educationMaxLevel: 5,
  educationHours: 12,
  stateFactors,
};
export const treasuryId = (state: string) => `treasury:${state}`;
export const institutional = (id: string) =>
  id === 'treasury' || id === 'consumers' || id.startsWith('treasury:');
export function actorState(w: World, actor: string, establishmentId?: string) {
  const unit =
    w.establishments.find((e) => e.id === establishmentId) ??
    w.establishments.find((e) => e.companyId === actor);
  return (
    w.properties.find((p) => p.id === unit?.propertyId)?.state ??
    w.companies.find((c) => c.id === actor)?.homeState ??
    'SP'
  );
}
export const rivalNames = [
  'Horizonte',
  'Pioneira',
  'Atlântica',
  'Caminhos',
  'Veredas',
  'Nacional',
  'Aliança',
  'Boa Vista',
  'Integra',
  'Nova Era',
  'Raízes',
  'Planalto',
  'Impulso',
  'Bandeirante',
  'União',
  'Vitória',
  'Terra Nova',
  'Progresso',
  'Cruzeiro',
  'Cerrado',
  'Serrana',
  'Brasil Sul',
  'Vale Verde',
  'Primavera',
  'Rota Norte',
  'Pontal',
  'Sol Nascente',
  'Ideal',
  'Fortaleza',
  'Avenida',
];
export function openingTransfer(
  w: World,
  from: string,
  to: string,
  amount: number,
  description: string,
  at: number,
) {
  if (!amount) return;
  const a = w.companies.find((c) => c.id === from)!,
    b = w.companies.find((c) => c.id === to)!;
  if (a.balance < amount) throw new Error('Capital de abertura indisponível.');
  a.balance -= amount;
  b.balance += amount;
  w.ledger.push({ id: crypto.randomUUID(), at, from, to, amount, description, kind: 'budget' });
}
export function defaultSupplyPolicy(w: World, e: Establishment): SupplyPolicy {
  const recipe = w.season.config.recipes.find((r) => r.id === e.specialization);
  const ids =
    e.category === 'retail' ? householdItems(w) : (Object.keys(recipe?.input ?? {}) as ProductId[]);
  return {
    enabled: false,
    dailyBudget: e.automationDailyBudget ?? 10000000,
    cashReserve: 2000000,
    source: 'internal-first',
    purchaseMode: 'immediate',
    maxDistanceKm: 800,
    minQuality: 40,
    maxFreightPerUnit: 0,
    carrierId: 'auto',
    rules: ids.map((product) => {
      const q = recipe?.input[product];
      const target = q ? Math.ceil(q * 4) : product === 'milk' ? 1200 : 400;
      return {
        product,
        minimum: q ? Math.ceil(q * 2) : Math.ceil(target / 3),
        target,
        maxBuy: target,
        maxPrice: Math.round(w.season.config.basePrices[product] * 1.5),
      };
    }),
  };
}
// Mantém em custódia só obrigações antigas; saldo liberado circula pelos estados do piloto.
export function regionalizeTreasury(w: World, at: number) {
  const legacy = w.companies.find((c) => c.id === 'treasury')!;
  const committed = w.infrastructure
    .filter((c) => c.status === 'open' && !c.treasuryId)
    .reduce((n, c) => n + c.reserved, 0);
  const states = [...new Set(regions.map((r) => r.state))];
  let free = Math.max(0, legacy.balance - committed);
  for (let i = 0; i < states.length; i++) {
    const amount = Math.floor(free / (states.length - i));
    openingTransfer(
      w,
      'treasury',
      treasuryId(states[i]),
      amount,
      'Regionalização da arrecadação existente',
      at,
    );
    free -= amount;
  }
}
export function initializeCompetition(w: World, at = w.updatedAt) {
  if (w.competitionVersion === 1) {
    w.operationsVersion = 3;
    return;
  }
  w.season.config.competition ??= structuredClone(competitionRules);
  w.stateWages ??= {};
  w.training ??= [];
  w.botActivity ??= [];
  w.supplyHistory ??= [];
  for (const state of Object.keys(stateFactors)) {
    if (!w.companies.some((c) => c.id === treasuryId(state)))
      w.companies.push({
        id: treasuryId(state),
        name: `Tesouro estadual · ${state}`,
        bot: true,
        balance: 0,
        homeState: state,
      });
    w.stateWages[state] ??= { index: 1, updatedAt: at, history: [{ at, index: 1 }] };
  }
  regionalizeTreasury(w, at);
  for (const r of regions) {
    const pid = `municipal-${r.id}`,
      id = `e-${pid}`;
    if (!w.properties.some((p) => p.id === pid))
      w.properties.push({
        id: pid,
        name: `Prefeitura de ${r.name}`,
        city: r.name,
        state: r.state,
        coordinates: [r.coordinates[0] + 0.006, r.coordinates[1] + 0.004],
        category: 'warehouse',
        ownerId: treasuryId(r.state),
        area: 30000,
        price: 0,
        road: 'Acesso municipal',
        roadDistance: 0.5,
        water: true,
        energyConnected: true,
      });
    if (!w.establishments.some((e) => e.id === id))
      w.establishments.push({
        id,
        propertyId: pid,
        name: `Prefeitura de ${r.name} · recebimento`,
        companyId: treasuryId(r.state),
        category: 'warehouse',
        inventory: {},
        unitCosts: {},
        prices: {},
        quality: {},
        capacityT: 100000,
        capacityM3: 100000,
        employees: 0,
        dailyCost: 0,
        revenue: 0,
        expenses: 0,
        enabled: true,
      });
  }
  // Capital vem de contas existentes; os estoques inaugurais são finitos e pagos.
  const investors = w.companies.find((c) => c.id === 'consumers')!;
  // Versão 2: os rivais nascem da carteira da economia alvo (opening-v2.ts), chamada pelo seed.
  const missing = w.season.config.economyVersion
    ? []
    : Array.from({ length: competitionRules.botCount }, (_, i) => i).filter(
        (i) => !w.companies.some((c) => c.id === `rival-${i + 1}`),
      );
  const capital = Math.min(
    w.season.config.competition.botCapital,
    Math.floor((investors.balance * 0.6) / Math.max(1, missing.length)),
  );
  const names = rivalNames;
  const portfolio: {
    category: Category;
    recipe?: string;
    inventory: Partial<Record<ProductId, number>>;
  }[] = [
    { category: 'industry', recipe: 'steel-bars', inventory: { iron: 36, coal: 9, steel: 32 } },
    { category: 'industry', recipe: 'soy-oil', inventory: { soy: 8, oil: 1200, soymeal: 500 } },
    { category: 'mine', recipe: 'iron-extraction', inventory: { iron: 45 } },
    { category: 'mine', recipe: 'coal-extraction', inventory: { coal: 30 } },
    { category: 'farm', recipe: 'soy-harvest', inventory: { soy: 10 } },
    { category: 'retail', inventory: { oil: 80, rice: 30, beans: 40, sugar: 20, milk: 80 } },
    { category: 'farm', recipe: 'rice-harvest', inventory: { rice: 2 } },
    { category: 'farm', recipe: 'beans-harvest', inventory: { beans: 2 } },
    { category: 'farm', recipe: 'sugar-harvest', inventory: { sugar: 2 } },
    { category: 'farm', recipe: 'milk-production', inventory: { soymeal: 500, milk: 200 } },
  ];
  for (const i of missing) {
    const r = regions[(i + Math.floor(i / 10) * 4) % regions.length],
      template = portfolio[i % portfolio.length],
      cid = `rival-${i + 1}`,
      pid = `site-${cid}`,
      id = `e-${cid}`;
    const category = template.category,
      area =
        category === 'industry'
          ? 6000
          : category === 'mine'
            ? 90000
            : category === 'farm'
              ? 200000
              : 180;
    w.companies.push({
      id: cid,
      name: `${names[i]} ${category === 'industry' ? 'Industrial' : category === 'mine' ? 'Recursos' : category === 'farm' ? 'Agro' : 'Comercial'}`,
      bot: true,
      balance: 0,
      homeState: r.state,
      strategy: (['regional', 'quality', 'value'] as const)[i % 3],
      behaviorVersion: 1,
    });
    openingTransfer(w, 'consumers', cid, capital, 'Capital finito de abertura · concorrente', at);
    const sitePrice = Math.min(Math.round(capital * 0.35), 42000000);
    w.properties.push({
      id: pid,
      name: `Unidade ${names[i]}`,
      city: r.name,
      state: r.state,
      coordinates: [
        r.coordinates[0] + ((i % 3) - 1) * 0.018 - 0.012,
        r.coordinates[1] + 0.015 + Math.floor(i / 10) * 0.008,
      ],
      category,
      ownerId: cid,
      area,
      price: sitePrice,
      road: 'Via regional',
      roadDistance: 1 + (i % 5),
      water: true,
      energyConnected: true,
    });
    openingTransfer(
      w,
      cid,
      treasuryId(r.state),
      sitePrice,
      'Instalação inaugural paga · concorrente',
      at,
    );
    const e: Establishment = {
      id,
      propertyId: pid,
      name: w.companies.at(-1)!.name,
      companyId: cid,
      category,
      inventory: {},
      prices: {},
      unitCosts: {},
      quality: {},
      capacityT: 1500,
      capacityM3: 3000,
      employees: category === 'industry' ? 18 : category === 'mine' ? 12 : 6,
      dailyCost: 0,
      revenue: 0,
      expenses: 0,
      enabled: true,
      education: i % 3,
      specialization: template.recipe,
      reserve: category === 'mine' ? 15000 : undefined,
      automation: true,
      automationCycles: category === 'mine' ? 10 : 1,
      automationDailyBudget: 12000000,
    };
    w.establishments.push(e);
    for (const [p, q] of Object.entries(template.inventory) as [ProductId, number][]) {
      const cost = w.season.config.basePrices[p] * q;
      if (w.companies.find((c) => c.id === cid)!.balance < cost) continue;
      openingTransfer(
        w,
        cid,
        treasuryId(r.state),
        cost,
        `Estoque inaugural finito · ${products[p].name}`,
        at,
      );
      e.inventory[p] = q;
      e.unitCosts[p] = w.season.config.basePrices[p];
      e.quality![p] = 65 + (i % 20);
      if (category === 'retail') e.prices[p] = Math.round(e.unitCosts[p]! * 1.3);
      else if (!(p in (w.season.config.recipes.find((r) => r.id === template.recipe)?.input ?? {})))
        w.offers.push({
          id: `offer-${cid}-${p}`,
          establishmentId: id,
          product: p,
          price: Math.round(e.unitCosts[p]! * 1.2),
        });
    }
    e.supplyPolicy = defaultSupplyPolicy(w, e);
    e.supplyPolicy.enabled = e.supplyPolicy.rules.length > 0;
    e.supplyPolicy.cashReserve = 500000;
    e.supplyPolicy.maxDistanceKm = 1500;
    w.vehicles.push({
      id: `truck-${cid}`,
      name: `RIVAL-${i + 1}`,
      companyId: cid,
      propertyId: pid,
      capacityT: 30,
      capacityM3: 85,
      status: 'available',
      purchasePrice: 28000000,
    });
    // Frota também é capitalizada e paga, sem levar a conta a negativo.
    const vehicleCost = Math.min(28000000, w.companies.find((c) => c.id === cid)!.balance);
    w.vehicles.at(-1)!.purchasePrice = vehicleCost;
    openingTransfer(
      w,
      cid,
      treasuryId(r.state),
      vehicleCost,
      'Veículo inaugural usado · concorrente',
      at,
    );
  }
  for (const e of w.establishments) {
    e.education ??= 0;
    e.specialization ??= defaultSpecialization(e);
    if (e.category === 'retail' && !e.supplyPolicy) {
      e.supplyPolicy = defaultSupplyPolicy(w, e);
      e.supplyPolicy.enabled = Boolean(e.automation);
      e.automation = false;
    }
  }
  w.competitionVersion = 1;
  w.operationsVersion = 3;
}
export function updateWages(w: World, at: number) {
  for (const [state, market] of Object.entries(w.stateWages ?? {})) {
    while (at - market.updatedAt >= GAME_DAY * 7) {
      const paid = w.ledger
        .filter(
          (l) =>
            l.kind === 'payroll' &&
            l.at >= market.updatedAt &&
            actorState(w, l.from, l.establishmentId) === state,
        )
        .reduce((n, l) => n + l.amount, 0);
      const growth = Math.min(0.02, 0.002 + paid / 1e11);
      market.index = Math.round(market.index * (1 + growth) * 1000000) / 1000000;
      market.updatedAt += GAME_DAY * 7;
      market.history.push({ at: market.updatedAt, index: market.index });
      market.history = market.history.slice(-104);
    }
  }
}
export function publicReference(w: World, product: ProductId) {
  return w.publicBenchmarks?.[product]?.price ?? w.season.config.basePrices[product];
}
export function trainingQuote(w: World, e: Establishment) {
  const targetLevel = Math.floor(e.education ?? 0) + 1;
  return {
    targetLevel,
    cost: e.employees * w.season.config.competition.educationPerWorker * targetLevel,
    durationMs: (w.season.config.competition.educationHours * 3600000) / 120,
    qualityGain: (targetLevel - (e.education ?? 0)) * 3,
  };
}
