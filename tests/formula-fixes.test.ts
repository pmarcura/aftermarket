import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute } from '../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL, type ProductId, type World } from '../packages/simulation/src/model';
import {
  automationCyclesPerDay,
  GAME_DAY,
  retailCapacity,
} from '../packages/simulation/src/operations';
import { dailyNeed } from '../packages/simulation/src/supply';
import { botRecoveryPlan } from '../packages/simulation/src/director';
import { dailyDemand, marketView } from '../packages/simulation/src/metrics';
import { householdProducts } from '../packages/simulation/src/channels';

// Correções da auditoria matemática M02, M03, M04, M05 e M07, provadas sobre as receitas da temporada.
const NOW = Date.UTC(2026, 9, 30, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
function quiet() {
  const w = createWorld(NOW);
  w.nextEconomicAt = Infinity;
  for (const c of w.companies) c.bot = false;
  for (const e of w.establishments) {
    e.enabled = false;
    e.automation = false;
    e.mothballed = true;
    e.employees = 0;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  w.season.config.operations.weekday = [1, 1, 1, 1, 1, 1, 1];
  return w;
}
function stores(w: World, count: number, city: string, products: ProductId[], employees: number) {
  const shops = w.establishments.filter((e) => e.category === 'retail').slice(0, count);
  for (const shop of shops) {
    w.properties.find((p) => p.id === shop.propertyId)!.city = city;
    Object.assign(shop, { enabled: true, mothballed: false, installed: true, employees });
    shop.inventory = Object.fromEntries(products.map((id) => [id, 10000]));
    shop.prices = Object.fromEntries(products.map((id) => [id, w.season.config.basePrices[id]]));
    shop.quality = Object.fromEntries(products.map((id) => [id, 70]));
  }
  return shops;
}
const sold = (w: World, ids: string[], product?: ProductId) =>
  w.consumptionHistory
    .filter((h) => ids.includes(h.establishmentId) && (!product || h.product === product))
    .reduce((n, h) => n + h.sold, 0);

describe('correções da auditoria matemática', () => {
  it('M02: a recuperação de um bot não projeta mais ciclos do que a linha conclui por dia', () => {
    const plan = (slower: number) => {
      const w = createWorld(NOW);
      const recipe = w.season.config.recipes.find((r) => r.id === 'milk-production')!;
      recipe.duration *= slower;
      const dairy = w.establishments.find(
        (e) => e.specialization === recipe.id && w.companies.find((c) => c.id === e.companyId)!.bot,
      )!;
      Object.assign(dairy, { enabled: false, mothballed: true, employees: 0 });
      const preview = {
        ...dairy,
        enabled: true,
        mothballed: false,
        employees:
          w.season.config.operations.profiles[recipe.id].workers * (dairy.equipmentLines ?? 1),
      };
      const price = marketView(w, 'milk').price ?? w.season.config.basePrices.milk;
      return {
        plan: botRecoveryPlan(w, dairy, NOW)!,
        cadence: automationCyclesPerDay(w, preview, recipe),
        ceiling: price * recipe.output.milk!,
      };
    };
    const normal = plan(1),
      slow = plan(4);
    expect(slow.cadence).toBe(normal.cadence / 4);
    // Receita do dia ≤ saída por ciclo × ciclos concluíveis; a margem cai quando a linha fica lenta.
    expect(slow.plan.contribution).toBeLessThanOrEqual(
      slow.ceiling * slow.cadence - slow.plan.fixed,
    );
    expect(slow.plan.contribution).toBeLessThan(normal.plan.contribution);
  });

  it('M03: previsões usam a mesma cadência que a automação executa', () => {
    const w = quiet();
    const steel = w.establishments.find((e) => e.id === 'e-industry')!;
    Object.assign(steel, {
      enabled: true,
      mothballed: false,
      installed: true,
      equipmentLines: 2,
      employees: 36,
    });
    steel.inventory = { iron: 5000, coal: 1500 };
    steel.capacityT = steel.capacityM3 = 1000000;
    w.properties.find((p) => p.id === steel.propertyId)!.area = 12000;
    execute(
      w,
      steel.companyId,
      {
        type: 'configureProduction',
        establishmentId: steel.id,
        recipeId: 'steel-bars',
        cycles: 5,
        dailyBudget: 1000000000,
        enabled: true,
      },
      NOW,
    );
    const recipe = w.season.config.recipes.find((r) => r.id === 'steel-bars')!;
    // Lote de 5 em 2 linhas de 4 h: 3 rodadas × 4 h = 12 h por lote → 10 ciclos por dia.
    const perDay = automationCyclesPerDay(w, steel, recipe);
    expect(perDay).toBe(10);
    expect(dailyNeed(w, steel, 'iron')).toBe(perDay * recipe.input.iron!);
    expect(marketView(w, 'iron').industrialDemand).toBe(perDay * recipe.input.iron!);
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + 3 * GAME_DAY);
    const started = w.jobs
      .filter(
        (j) =>
          j.establishmentId === steel.id &&
          j.startedAt >= NOW + GAME_DAY &&
          j.startedAt < NOW + 2 * GAME_DAY,
      )
      .reduce((n, j) => n + j.cycles, 0);
    expect(started).toBe(perDay);
  });

  it('M04: duas lojas iguais vendem tanto quanto uma, sem perder frações', () => {
    const run = (count: number) => {
      const w = quiet(),
        before = money(w);
      const shops = stores(w, count, 'Itabira', ['rice'], 12);
      w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
      advance(w, NOW + ECONOMIC_INTERVAL * 12);
      expect(money(w)).toBe(before);
      return sold(
        w,
        shops.map((e) => e.id),
      );
    };
    const one = run(1),
      two = run(2);
    expect(two).toBeGreaterThan(0);
    expect(Math.abs(two - one)).toBeLessThanOrEqual(2);
  });

  it('M05: sem capacidade para tudo, a loja reparte pela procura e não pela ordem', () => {
    const w = quiet();
    const [shop] = stores(w, 1, 'Campinas', [...householdProducts], 1);
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const rows = w.consumptionHistory.filter((h) => h.establishmentId === shop.id);
    const milk = rows.find((h) => h.product === 'milk')!,
      oil = rows.find((h) => h.product === 'oil')!;
    const capacity = retailCapacity(w, shop);
    expect(rows.reduce((n, h) => n + h.desired, 0)).toBeGreaterThan(capacity);
    expect(rows.reduce((n, h) => n + h.sold, 0)).toBe(capacity);
    expect(milk.desired).toBeGreaterThan(oil.desired);
    expect(milk.sold).toBeGreaterThan(oil.sold);
  });

  it('M07: a meta de estoque de óleo é repartida entre os produtores', () => {
    const w = createWorld(NOW);
    for (const e of w.establishments) if (e.supplyPolicy) e.supplyPolicy.enabled = false;
    const producers = w.establishments.filter(
      (e) => e.specialization === 'soy-oil' && e.enabled && !e.mothballed && e.automation,
    );
    expect(producers.length).toBeGreaterThan(1);
    const recipe = w.season.config.recipes.find((r) => r.id === 'soy-oil')!;
    // Meta: três dias da procura do mundo mais o prazo do lote. Antiga: inteira para cada produtor.
    const whole = dailyDemand(w, 'oil') * (3 + recipe.duration / GAME_DAY);
    const shared = whole / producers.length;
    // Entre a meta repartida e a antiga, com folga para as vendas da própria rodada.
    const stock = Math.ceil((shared + whole) / 2);
    for (const e of producers) {
      e.inventory.oil = stock;
      e.inventory.soy = 100;
      expect(stock).toBeGreaterThan(recipe.output.oil! * (e.automationCycles ?? 1) * 2);
    }
    expect(stock).toBeGreaterThan(shared);
    expect(stock).toBeLessThan(whole);
    const jobs = w.jobs.length;
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const started = w.jobs
      .slice(jobs)
      .filter((j) => producers.some((e) => e.id === j.establishmentId));
    expect(started).toHaveLength(0);
    for (const e of producers) e.inventory.oil = 0;
    advance(w, NOW + ECONOMIC_INTERVAL * 2);
    expect(
      w.jobs.slice(jobs).filter((j) => producers.some((e) => e.id === j.establishmentId)).length,
    ).toBeGreaterThan(0);
  });
});
