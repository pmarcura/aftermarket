import { describe, it, expect, vi } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute } from '../packages/simulation/src/engine';
import { migrateWorld } from '../packages/simulation/src/migrate';
import {
  laborMarket,
  logisticsQuality,
  marketView,
  productionCharges,
  seasonPrice,
} from '../packages/simulation/src/metrics';
import { calibration } from '../packages/simulation/src/calibration';
import {
  products,
  recipes,
  ECONOMIC_INTERVAL,
  type Command,
} from '../packages/simulation/src/model';
import { positionAlongRoute } from '../packages/simulation/src/geometry';
import { shipmentStatus } from '../packages/simulation/src/shipment';

const NOW = 1000000;
const trade: Command = {
  type: 'trade',
  offerId: 'offer-ferrovale',
  destinationId: 'e-industry',
  quantity: 10,
  carrierId: 'transbrasil',
};
describe('temporada e indicadores auditáveis', () => {
  it('congela preços, receitas e parâmetros sem consultar cotações externas', () => {
    const w = createWorld(NOW),
      before = structuredClone(w.season.config),
      fetchMock = vi.spyOn(globalThis, 'fetch');
    const oldPrice = products.iron.basePrice,
      oldCost = recipes[0].cost,
      oldDiesel = calibration.dieselPerLiter;
    try {
      products.iron.basePrice = 999;
      recipes[0].cost = 99;
      calibration.dieselPerLiter = 1;
      expect(seasonPrice(w, 'iron')).toBe(before.basePrices.iron);
      expect(productionCharges(w, w.establishments[1], 'steel-bars', 1).processing).toBe(
        before.recipes[0].cost,
      );
      advance(w, NOW + ECONOMIC_INTERVAL * 2);
      expect(w.season.config).toEqual(before);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      products.iron.basePrice = oldPrice;
      recipes[0].cost = oldCost;
      calibration.dieselPerLiter = oldDiesel;
      fetchMock.mockRestore();
    }
  });
  it('explica logística e responde à ocupação da frota, sem rótulos fixos', () => {
    const w = createWorld(NOW),
      p = w.properties[0],
      good = logisticsQuality(w, p);
    expect(good.score).toBe(
      Math.round(good.access * 0.35 + good.fleet * 0.35 + good.supplier * 0.3),
    );
    w.vehicles.forEach((v) => (v.status = 'route'));
    expect(logisticsQuality(w, p).score).toBeLessThan(good.score);
    const before = laborMarket(w, p);
    w.establishments.push({
      ...w.establishments[0],
      id: 'new-worker',
      propertyId: p.id,
      employees: 12,
    });
    expect(laborMarket(w, p).available).toBe(before.available - 12);
  });
  it('retorna sem oferta e distingue preços regionais, estaduais e globais', () => {
    const w = createWorld(NOW);
    expect(marketView(w, 'soymeal').price).toBeNull();
    const sp = marketView(w, 'iron', 'state:SP'),
      mg = marketView(w, 'iron', 'state:MG');
    expect(sp.stock + mg.stock).toBe(marketView(w, 'iron').stock);
    expect(
      sp.offers.every(
        (o) => w.properties.find((p) => p.id === o.establishment.propertyId)!.state === 'SP',
      ),
    ).toBe(true);
  });
  it('cobra utilidades por quantidade e conserva o custo dos coprodutos', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-botfactory')!,
      money = w.companies.reduce((n, c) => n + c.balance, 0);
    execute(
      w,
      e.companyId,
      { type: 'produce', establishmentId: e.id, recipeId: 'soy-oil', cycles: 1 },
      NOW,
    );
    const j = w.jobs[0];
    expect(j.output).toEqual({ oil: 200, soymeal: 760 });
    expect(Object.values(j.outputCosts!).reduce((n, c) => n + c!, 0)).toBe(j.cost);
    expect(w.ledger.find((l) => l.kind === 'energy')!.amount).toBe(150 * 92);
    expect(w.ledger.find((l) => l.kind === 'water')!.amount).toBe(0.5 * 2000);
    expect(w.companies.reduce((n, c) => n + c.balance, 0)).toBe(money);
    const frozen = structuredClone(j.output);
    w.season.config.recipes.find((r) => r.id === 'soy-oil')!.output.oil = 999;
    advance(w, j.finishesAt);
    expect(e.inventory.oil).toBe(12000 + frozen!.oil!);
    expect(e.inventory.soymeal).toBe(760);
  });
  it('uma cotação alterada não cobra nem reserva e a remessa congela a rota', () => {
    const w = createWorld(NOW),
      before = structuredClone(w);
    expect(() => execute(w, 'player', { ...trade, type: 'trade', expectedTotal: 1 }, NOW)).toThrow(
      /cotação mudou/,
    );
    expect(w).toEqual(before);
    execute(w, 'player', trade, NOW);
    const s = w.shipments[0],
      path = structuredClone(s.route);
    w.routes['ferrovale:industry'] = {
      coordinates: [
        [0, 0],
        [1, 1],
      ],
      distanceKm: 1,
      durationSeconds: 1,
      source: 'estimate',
    };
    expect(s.route).toEqual(path);
    expect(s.pickupAt).toBeLessThanOrEqual(s.roadDepartureAt!);
    expect(s.roadDepartureAt).toBeLessThan(s.arrivesAt);
  });
  it('salários realimentam consumidores e pausar não elimina contratos fixos', () => {
    const w = createWorld(NOW),
      e = w.establishments[1],
      money = w.companies.reduce((n, c) => n + c.balance, 0);
    e.enabled = false;
    advance(w, NOW + ECONOMIC_INTERVAL);
    expect(
      w.ledger.some(
        (l) => l.kind === 'payroll' && l.establishmentId === e.id && l.to === 'consumers',
      ),
    ).toBe(true);
    expect(w.ledger.some((l) => l.kind === 'water' && l.establishmentId === e.id)).toBe(true);
    expect(w.companies.reduce((n, c) => n + c.balance, 0)).toBe(money);
    expect(w.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0)).toBe(true);
  });
  it('automação respeita orçamento diário, estoque e saldo', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-retail')!;
    e.inventory = {};
    e.automation = true;
    e.automationDailyBudget = 1;
    advance(w, NOW + ECONOMIC_INTERVAL);
    expect(w.shipments.filter((s) => s.destinationId === e.id)).toHaveLength(0);
    e.automationDailyBudget = 3000000;
    advance(w, NOW + ECONOMIC_INTERVAL * 2);
    const spent = w.ledger
      .filter((l) => l.establishmentId === e.id && ['trade', 'freight'].includes(l.kind))
      .reduce((n, l) => n + l.amount, 0);
    expect(spent).toBeLessThanOrEqual(3000000);
    expect(spent).toBeGreaterThan(0);
  });
});
describe('tempo de transporte e migração', () => {
  it('completa snapshots intermediários sem rebalancear configurações já persistidas', () => {
    const w = createWorld(NOW),
      old = JSON.parse(JSON.stringify(w));
    old.season.config.parameters.dieselPerLiter = 777;
    old.season.config.basePrices.iron = 12345;
    delete old.season.config.population;
    delete old.season.config.qualification;
    delete old.season.config.recipes;
    const { world: m, changed } = migrateWorld(old, NOW + 100);
    expect(changed).toBe(true);
    expect(m.season.config.parameters.dieselPerLiter).toBe(777);
    expect(m.season.config.basePrices.iron).toBe(12345);
    expect(m.companies).toEqual(w.companies);
    expect(m.nextEconomicAt).toBe(w.nextEconomicAt);
    expect(migrateWorld(m).changed).toBe(false);
  });
  it('interpola por distância e separa carregamento, estrada e confirmação', () => {
    const w = createWorld(NOW);
    execute(w, 'player', trade, NOW);
    const s = w.shipments[0];
    expect(shipmentStatus(s, s.roadDepartureAt! - 1).progress).toBe(0);
    expect(shipmentStatus(s, (s.roadDepartureAt! + s.roadArrivalAt!) / 2).progress).toBeCloseTo(
      0.5,
    );
    expect(shipmentStatus(s, s.arrivesAt + 10).phase).toBe('Confirmando recebimento');
    const p = positionAlongRoute(
      [
        [0, 0],
        [0.1, 0],
        [1, 0],
      ],
      0.5,
    );
    expect(p.position[0]).toBeCloseTo(0.5, 5);
    advance(w, s.arrivesAt);
    expect(shipmentStatus(s, s.arrivesAt).phase).toBe('Entregue');
  });
  it('preserva capital, estoque, titularidade e produções antigas sem novas cobranças', () => {
    const w = createWorld(NOW);
    execute(w, 'player', trade, NOW);
    execute(
      w,
      'player',
      { type: 'produce', establishmentId: 'e-industry', recipeId: 'steel-bars', cycles: 1 },
      NOW,
    );
    const old = structuredClone(w) as unknown as Record<string, any>;
    old.version = 1;
    delete old.season;
    delete old.marketHistory;
    delete old.currency;
    old.jobs[0].output = undefined;
    old.jobs[0].outputCosts = undefined;
    const { world: m } = migrateWorld(old, NOW + 1000);
    expect(m.companies).toEqual(w.companies);
    expect(m.establishments.map((e) => e.inventory)).toEqual(
      w.establishments.map((e) => e.inventory),
    );
    expect(m.properties.filter((p) => p.ownerId).map((p) => [p.ownerId, p.price])).toEqual(
      w.properties.filter((p) => p.ownerId).map((p) => [p.ownerId, p.price]),
    );
    expect(m.ledger).toEqual(w.ledger);
    expect(m.jobs[0].output).toEqual({ steel: 8 });
    expect(m.nextEconomicAt).toBeGreaterThanOrEqual(NOW + 1000 + ECONOMIC_INTERVAL);
    expect(migrateWorld(m).changed).toBe(false);
  });
});
