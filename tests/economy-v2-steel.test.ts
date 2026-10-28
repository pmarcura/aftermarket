import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute, quote, RuleError } from '../packages/simulation/src/engine';
import {
  ECONOMIC_INTERVAL,
  products,
  type Establishment,
  type ProductId,
  type World,
} from '../packages/simulation/src/model';
import { SCRAP_COLLECTION } from '../packages/simulation/src/operations';
import { dealershipMarkup, vehicleModels } from '../packages/simulation/src/catalog';

// Fatias 6 e 7 da etapa B: aço para bens, sucata, reciclagem e caminhão como mercadoria.
const NOW = Date.UTC(2026, 9, 27, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);

function quiet(economy: 1 | 2 = 2) {
  const w = createWorld(NOW, { economy });
  w.nextEconomicAt = Infinity;
  for (const c of w.companies) c.bot = false;
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  return w;
}
function unit(
  w: World,
  id: string,
  recipeId: string | undefined,
  inventory: Partial<Record<ProductId, number>>,
): Establishment {
  const e = w.establishments.find((x) => x.id === id)!;
  const p = w.properties.find((x) => x.id === e.propertyId)!;
  const profile = recipeId ? w.season.config.operations.profiles[recipeId] : undefined;
  if (profile) Object.assign(p, { area: profile.areaM2, water: true, energyConnected: true });
  Object.assign(e, {
    enabled: true,
    mothballed: false,
    installed: true,
    specialization: recipeId ?? e.specialization,
    equipmentLines: 1,
    employees: profile?.workers ?? e.employees,
    inventory: { ...inventory },
    unitCosts: {},
    capacityT: 1e9,
    capacityM3: 1e9,
  });
  w.companies.find((c) => c.id === e.companyId)!.balance = 1e12;
  return e;
}
const truckFactory = (w: World) => unit(w, 'e-industry', 'truck-heavy', { truckHeavy: 1 });

describe('mundo versão 2 · aço para bens e caminhões', () => {
  it('cada utensílio vendido devolve 30% da massa como sucata à coleta municipal', () => {
    const w = quiet();
    w.season.config.operations.weekday = [1, 1, 1, 1, 1, 1, 1];
    const store = unit(w, 'e-retail', undefined, { utensils: 5000 });
    store.prices = { utensils: products.utensils.basePrice };
    store.quality = { utensils: 70 };
    store.employees = 20;
    const collection = w.establishments.find((e) => e.id === SCRAP_COLLECTION)!;
    expect(w.offers.some((o) => o.establishmentId === SCRAP_COLLECTION)).toBe(true);
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL * 12);
    const sold = w.consumptionHistory
      .filter((h) => h.product === 'utensils')
      .reduce((n, h) => n + h.sold, 0);
    expect(
      w.consumptionHistory.some(
        (h) => h.establishmentId === store.id && h.product === 'utensils' && h.sold > 0,
      ),
    ).toBe(true);
    expect(collection.inventory.scrap).toBeCloseTo(sold * 0.005 * 0.3, 9);
  });

  it('a siderúrgica usa sucata no lugar do minério quando tem para o lote', () => {
    const w = quiet();
    const mill = unit(w, 'e-industry', 'steel-bars', {
      scrap: 1.1,
      coal: 0.55,
      iron: 1.6,
    });
    Object.assign(mill, { automation: true, automationCycles: 1, automationDailyBudget: 1e10 });
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const job = w.jobs.filter((j) => j.establishmentId === mill.id).at(-1)!;
    expect(job.recipeId).toBe('steel-recycling');
    expect(mill.inventory.iron).toBe(1.6); // o minério ficou guardado
  });

  it('compra caminhão montado pelo preço da montadora, conservando dinheiro', () => {
    const w = quiet();
    const factory = truckFactory(w);
    w.offers.push({
      id: 'o-truck',
      establishmentId: factory.id,
      product: 'truckHeavy',
      price: 29000000,
    });
    const buyer = w.establishments.find((e) => e.id === 'e-logistics')!;
    w.companies.find((c) => c.id === buyer.companyId)!.balance = 1e12;
    // Vendedor e comprador da mesma empresa transferem sem preço: usar outra empresa vendedora.
    factory.companyId = 'agro';
    const before = money(w),
      fleet = w.vehicles.length;
    execute(
      w,
      buyer.companyId,
      { type: 'buyVehicle', model: 'truckHeavy', sellerEstablishmentId: factory.id },
      NOW,
    );
    const truck = w.vehicles.at(-1)!;
    expect(w.vehicles).toHaveLength(fleet + 1);
    expect(truck).toMatchObject({
      model: 'truckHeavy',
      capacityT: 30,
      capacityM3: 85,
      odometerKm: 0,
    });
    expect(truck.purchasePrice).toBe(29000000);
    expect(factory.inventory.truckHeavy).toBe(0);
    expect(money(w)).toBe(before);
    expect(() =>
      execute(
        w,
        buyer.companyId,
        { type: 'buyVehicle', model: 'truckHeavy', sellerEstablishmentId: factory.id },
        NOW,
      ),
    ).toThrow(/não tem este caminhão/);
  });

  it('concessionária vende caminhão importado 30% acima da referência', () => {
    const w = quiet();
    const buyer = w.establishments.find((e) => e.id === 'e-logistics')!;
    const company = w.companies.find((c) => c.id === buyer.companyId)!;
    company.balance = 1e12;
    execute(w, buyer.companyId, { type: 'buyVehicle', model: 'truckLight' }, NOW);
    expect(1e12 - company.balance).toBe(
      Math.round(products.truckLight.basePrice * dealershipMarkup),
    );
    expect(w.vehicles.at(-1)).toMatchObject({ model: 'truckLight', capacityT: 8, capacityM3: 25 });
  });

  it('manutenção do frete dobra quando o caminhão chega à vida útil', () => {
    const w = quiet();
    const truck = w.vehicles.find((v) => v.companyId === 'player')!;
    truck.model = 'truckHeavy';
    const args = ['e-ferrovale', 'e-industry', 'iron', 20, 'player'] as const;
    const fresh = quote(w, ...args).costs.maintenance;
    truck.odometerKm = vehicleModels.truckHeavy.lifeKm;
    const worn = quote(w, ...args).costs.maintenance;
    expect(worn / fresh).toBeCloseTo(2, 2);
  });

  it('desmonta caminhão livre em sucata no pátio próprio', () => {
    const w = quiet();
    const truck = w.vehicles.find((v) => v.companyId === 'player' && v.status === 'available')!;
    truck.model = 'truckHeavy';
    const yard = w.establishments.find(
      (e) => e.propertyId === truck.propertyId && e.companyId === 'player',
    )!;
    const scrapBefore = yard.inventory.scrap ?? 0;
    execute(w, 'player', { type: 'scrapVehicle', vehicleId: truck.id }, NOW);
    expect(w.vehicles.some((v) => v.id === truck.id)).toBe(false);
    expect(yard.inventory.scrap! - scrapBefore).toBeCloseTo(9 * 0.9, 9);
  });

  it('mundo da versão 1 mantém só a compra antiga e não desmonta caminhões', () => {
    const w = quiet(1);
    const truck = w.vehicles.find((v) => v.companyId === 'player')!;
    expect(() => execute(w, 'player', { type: 'buyVehicle', model: 'truckLight' }, NOW)).toThrow(
      RuleError,
    );
    expect(() => execute(w, 'player', { type: 'scrapVehicle', vehicleId: truck.id }, NOW)).toThrow(
      RuleError,
    );
    expect(w.establishments.some((e) => e.id === SCRAP_COLLECTION)).toBe(false);
  });
});
