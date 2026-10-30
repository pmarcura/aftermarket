import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute, quote } from '../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL, type Command, type World } from '../packages/simulation/src/model';
import {
  GAME_DAY,
  gameCalendar,
  inventoryQuality,
  productionCapacity,
  treasuryReserved,
} from '../packages/simulation/src/operations';
import { migrateWorld } from '../packages/simulation/src/migrate';
import { createStore } from '../apps/server/src/store';
const NOW = Date.UTC(2026, 9, 26, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
const unit = (w: World, id = 'e-industry') => w.establishments.find((e) => e.id === id)!;
const passiveOff = (w: World) =>
  w.establishments.forEach((e) => {
    e.automation = false;
  });
const transferToTreasury = (w: World, value: number) => {
  w.companies.find((c) => c.id === 'player')!.balance -= value;
  w.companies.find((c) => c.id === 'treasury')!.balance += value;
};
// A Distribuidora Aurora (e-supplier) abre com 90 t de minério anunciadas (offer-aurora); as
// minas abrem só com um ciclo de estoque, como os rivais.
const steelRecipe = (w: World) => w.season.config.recipes.find((r) => r.id === 'steel-bars')!;
const orderCommand = (w: World): Command => ({
  type: 'requestOrder',
  offerId: 'offer-aurora',
  destinationId: 'e-industry',
  quantity: 65,
  carrierId: 'transbrasil',
  maxFreight: quote(w, 'e-supplier', 'e-industry', 'iron', 65, 'transbrasil').price,
  deliveryDays: 3,
  expectedUnitPrice: w.offers.find((o) => o.id === 'offer-aurora')!.price,
});

describe('capacidade, automação e qualidade', () => {
  it('limita linhas por equipe e área, sem aumentar produção ao contratar além da área', () => {
    const w = createWorld(NOW),
      e = unit(w),
      r = steelRecipe(w),
      profile = w.season.config.operations.profiles[r.id];
    e.employees = profile.workers * 2;
    w.properties.find((p) => p.id === e.propertyId)!.area = profile.areaM2;
    expect(productionCapacity(w, e, r, 5)).toMatchObject({
      lines: 1,
      laborLines: 2,
      areaLines: 1,
      durationMs: r.duration * 5,
    });
    e.employees = profile.workers - 1;
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player',
        { type: 'produce', establishmentId: e.id, recipeId: r.id, cycles: 1 },
        NOW,
      ),
    ).toThrow(/Equipe insuficiente/);
    expect(w).toEqual(before);
  });
  it('usa linhas paralelas e não permite reduzir equipe comprometida com lotes', () => {
    const w = createWorld(NOW),
      e = unit(w),
      workers = w.season.config.operations.profiles['steel-bars'].workers;
    e.employees = workers * 2;
    execute(
      w,
      'player',
      { type: 'produce', establishmentId: e.id, recipeId: 'steel-bars', cycles: 2 },
      NOW,
    );
    expect(w.jobs[0].finishesAt - NOW).toBe(steelRecipe(w).duration);
    expect(() =>
      execute(
        w,
        'player',
        { type: 'setWorkforce', establishmentId: e.id, employees: workers },
        NOW,
      ),
    ).toThrow(/Conclua os lotes/);
    expect(e.employees).toBe(workers * 2);
  });
  it('qualidade dos insumos altera a saída e a qualidade congelada chega após o processamento', () => {
    const low = createWorld(NOW),
      high = createWorld(NOW);
    for (const [w, quality] of [
      [low, 20],
      [high, 95],
    ] as const) {
      passiveOff(w);
      unit(w).quality = { iron: quality, coal: quality };
      execute(
        w,
        'player',
        { type: 'produce', establishmentId: 'e-industry', recipeId: 'steel-bars', cycles: 1 },
        NOW,
      );
    }
    expect(high.jobs[0].quality).toBeGreaterThan(low.jobs[0].quality!);
    const expected = (24 * 70 + high.jobs[0].quality! * 1) / 25; // 1 t de aço por ciclo
    unit(high).quality!.iron = 0;
    advance(high, high.jobs[0].finishesAt);
    expect(inventoryQuality(unit(high), 'steel')).toBeCloseTo(expected);
  });
  it('extração passiva continua offline, respeita orçamento e reserva finita', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    const e = unit(w, 'e-mine');
    e.reserve = 3;
    execute(
      w,
      'player',
      {
        type: 'configureProduction',
        establishmentId: e.id,
        recipeId: 'iron-extraction',
        cycles: 2,
        dailyBudget: 100000,
        enabled: true,
      },
      NOW,
    );
    const total = money(w);
    advance(w, NOW + ECONOMIC_INTERVAL * 4);
    expect(e.reserve).toBe(0);
    expect(e.inventory.iron).toBe(650 + 3 * 1.5); // 1,5 t por ciclo de extração
    expect(w.jobs.filter((j) => j.establishmentId === e.id).reduce((n, j) => n + j.cycles, 0)).toBe(
      3,
    );
    expect(e.automationStatus).toMatch(/esgotada|diário/);
    expect(money(w)).toBe(total);
  });
  it('não inicia lote automático acima do orçamento e expõe o motivo de espera', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    execute(
      w,
      'player',
      {
        type: 'configureProduction',
        establishmentId: 'e-mine',
        recipeId: 'iron-extraction',
        cycles: 1,
        dailyBudget: 1,
        enabled: true,
      },
      NOW,
    );
    advance(w, NOW + ECONOMIC_INTERVAL);
    expect(w.jobs.filter((j) => j.establishmentId === 'e-mine')).toHaveLength(0);
    expect(unit(w, 'e-mine').automationStatus).toMatch(/Limite diário/);
  });
  it('usa dias virtuais e perfil semanal normalizado; equipe limita atendimento total', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    expect(gameCalendar(w, NOW).label).toBe('Segunda');
    expect(gameCalendar(w, NOW + GAME_DAY * 5).label).toBe('Sábado');
    expect(w.season.config.operations.weekday.reduce((n, x) => n + x, 0)).toBeCloseTo(7);
    unit(w, 'e-retail').employees = 1;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const rows = w.consumptionHistory.filter((s) => s.establishmentId === 'e-retail');
    expect(rows.reduce((n, s) => n + s.sold, 0)).toBeLessThanOrEqual(
      w.season.config.operations.retailUnitsPerWorker,
    );
    expect(rows.every((s) => s.desired >= s.sold)).toBe(true);
  });
});

describe('cargas divididas e pedidos comerciais', () => {
  it('divide quantidade inteira por massa/volume, ocupa os veículos e conserva dinheiro/custo', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    const q = quote(w, 'e-supplier', 'e-industry', 'iron', 65, 'transbrasil');
    expect(q.compatible).toBe(true);
    expect(q.parts.map((p) => p.quantity)).toEqual([30, 30, 5]);
    expect(q.price).toBeGreaterThan(
      quote(w, 'e-supplier', 'e-industry', 'iron', 30, 'transbrasil').price,
    );
    const total = money(w),
      before = unit(w).inventory.iron!,
      oldCost = unit(w).unitCosts.iron!;
    execute(
      w,
      'player',
      {
        type: 'trade',
        offerId: 'offer-aurora',
        quantity: 65,
        destinationId: 'e-industry',
        carrierId: 'transbrasil',
      },
      NOW,
    );
    const loads = w.shipments.slice();
    expect(loads).toHaveLength(3);
    expect(loads.reduce((n, s) => n + s.freight, 0)).toBe(q.price);
    expect(new Set(loads.map((s) => s.vehicleId)).size).toBe(3);
    expect(unit(w).inventory.iron).toBe(before);
    advance(w, Math.max(...loads.map((s) => s.arrivesAt)));
    expect(unit(w).inventory.iron).toBe(before + 65);
    expect(unit(w).unitCosts.iron).toBeCloseTo(
      (before * oldCost + loads.reduce((n, s) => n + s.cost + s.freight, 0)) / (before + 65),
    );
    expect(money(w)).toBe(total);
    expect(loads.every((s) => s.delivered)).toBe(true);
  });
  it('frota própria cobra só custos reais e não gera receita artificial para a unidade logística', () => {
    const w = createWorld(NOW),
      start = money(w),
      carrier = unit(w, 'e-logistics'),
      revenue = carrier.revenue;
    const q = quote(w, 'e-supplier', 'e-industry', 'iron', 24, 'player');
    expect(q.ownFleet).toBe(true);
    expect(q.price).toBe(q.costs.operatingCost);
    execute(
      w,
      'player',
      {
        type: 'trade',
        offerId: 'offer-aurora',
        quantity: 24,
        destinationId: 'e-industry',
        carrierId: 'player',
      },
      NOW,
    );
    expect(carrier.revenue).toBe(revenue);
    expect(money(w)).toBe(start);
    expect(w.ledger.some((l) => l.from === 'player' && l.to === 'player')).toBe(false);
  });
  it('pedido aguarda aceitação sem cobrar, fixa preço e entrega cada parte uma única vez', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    const before = structuredClone(w);
    execute(w, 'player', orderCommand(w), NOW);
    const order = w.orders[0];
    expect(w.companies).toEqual(before.companies);
    expect(w.shipments).toHaveLength(0);
    expect(unit(w, 'e-supplier').inventory).toEqual(unit(before, 'e-supplier').inventory);
    w.offers.find((o) => o.id === 'offer-aurora')!.price *= 2;
    execute(w, order.sellerId, { type: 'acceptOrder', orderId: order.id }, NOW);
    expect(order.status).toBe('accepted');
    expect(w.shipments.reduce((n, s) => n + s.cost, 0)).toBe(order.unitPrice * 65);
    expect(() =>
      execute(w, order.sellerId, { type: 'acceptOrder', orderId: order.id }, NOW),
    ).toThrow(/já foi atendido/);
    const finish = Math.max(...w.shipments.map((s) => s.arrivesAt));
    advance(w, finish);
    const stock = unit(w).inventory.iron;
    expect(order.status).toBe('delivered');
    advance(w, finish);
    expect(unit(w).inventory.iron).toBe(stock);
  });
  it('revalida saldo, prazo e autorização antes de qualquer pagamento', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    execute(w, 'player', orderCommand(w), NOW);
    const order = w.orders[0];
    expect(() => execute(w, 'player2', { type: 'acceptOrder', orderId: order.id }, NOW)).toThrow(
      /outra empresa/,
    );
    w.companies.find((c) => c.id === 'player')!.balance = 0;
    const before = structuredClone(w);
    expect(() =>
      execute(w, order.sellerId, { type: 'acceptOrder', orderId: order.id }, NOW),
    ).toThrow(/Saldo insuficiente/);
    expect(w).toEqual(before);
    expect(() =>
      execute(w, order.sellerId, { type: 'acceptOrder', orderId: order.id }, order.deadline),
    ).toThrow(/expirou/);
  });
});

describe('compatibilidade de contratos públicos legados', () => {
  it('preserva a reserva, o pagamento e o consumo contratado antes das disputas estaduais', () => {
    const w = createWorld(NOW);
    passiveOff(w);
    w.nextEconomicAt = NOW + GAME_DAY * 100;
    transferToTreasury(w, 50000000);
    const total = money(w);
    const c = {
      id: 'legacy-contract',
      title: 'Obra contratada anteriormente',
      destinationId: 'e-public-works',
      product: 'steel' as const,
      quantity: 24,
      unitPrice: 550000,
      minQuality: 55,
      maxFreight: 1000000,
      reserved: 24 * 550000 + 1000000,
      createdAt: NOW,
      deadline: NOW + GAME_DAY * 3,
      status: 'open' as const,
      deliveredQuantity: 0,
    };
    w.infrastructure.push(c);
    expect(treasuryReserved(w)).toBe(c.reserved);
    const q = quote(w, 'e-industry', c.destinationId, 'steel', c.quantity, 'transbrasil');
    execute(
      w,
      'player',
      {
        type: 'fulfillInfrastructure',
        contractId: c.id,
        establishmentId: 'e-industry',
        carrierId: 'transbrasil',
        expectedFreight: q.price,
      },
      NOW,
    );
    expect(w.infrastructure[0].status).toBe('delivering');
    expect(treasuryReserved(w)).toBe(0);
    advance(w, Math.max(...w.shipments.map((s) => s.arrivesAt)));
    expect(w.infrastructure[0].status).toBe('completed');
    expect(w.consumedMaterials.steel).toBe(24);
    expect(money(w)).toBe(total);
  });
  it('um legado com qualidade insuficiente não debita nem despacha', () => {
    const w = createWorld(NOW);
    transferToTreasury(w, 50000000);
    unit(w).quality!.steel = 10;
    w.infrastructure.push({
      id: 'legacy-low',
      title: 'Legado',
      destinationId: 'e-public-works',
      product: 'steel',
      quantity: 24,
      unitPrice: 550000,
      minQuality: 55,
      maxFreight: 1000000,
      reserved: 24 * 550000 + 1000000,
      createdAt: NOW,
      deadline: NOW + GAME_DAY * 3,
      status: 'open',
      deliveredQuantity: 0,
    });
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player',
        {
          type: 'fulfillInfrastructure',
          contractId: 'legacy-low',
          establishmentId: 'e-industry',
          carrierId: 'transbrasil',
          expectedFreight: 1,
        },
        NOW,
      ),
    ).toThrow(/Qualidade/);
    expect(w).toEqual(before);
  });
});

it('migração aditiva conserva o mundo e idempotência não duplica pedidos', () => {
  const w = createWorld(NOW),
    old = structuredClone(w) as any;
  delete old.operationsVersion;
  delete old.orders;
  delete old.infrastructure;
  delete old.season.config.operations;
  const { world: next } = migrateWorld(old, NOW + 100);
  expect(next.companies).toEqual(w.companies);
  expect(next.ledger).toEqual(w.ledger);
  expect(next.nextEconomicAt).toBe(w.nextEconomicAt);
  expect(migrateWorld(next).changed).toBe(false);
  const store = createStore(':memory:');
  try {
    const command = orderCommand(store.read()),
      key = crypto.randomUUID();
    store.command('player', command, key);
    const after = store.read();
    expect(store.command('player', command, key)).toEqual(after);
    expect(store.read().orders).toHaveLength(1);
  } finally {
    store.close();
  }
});
