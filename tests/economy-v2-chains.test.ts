import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute, RuleError } from '../packages/simulation/src/engine';
import type { Category, Establishment, ProductId, World } from '../packages/simulation/src/model';
import { availableStock, productionCapacity } from '../packages/simulation/src/operations';

// Fatias 3–5 da etapa B: sementes, rebanho e ração no mundo versão 2.
const NOW = Date.UTC(2026, 9, 27, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);

function v2World() {
  const w = createWorld(NOW, { economy: 2 });
  w.nextEconomicAt = Infinity; // só produção: sem salários, varejo ou bots
  for (const c of w.companies) c.bot = false;
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  return w;
}
function unit(
  w: World,
  category: Category,
  recipeId: string,
  lines: number,
  inventory: Partial<Record<ProductId, number>>,
): Establishment {
  const e = w.establishments.find((x) => x.category === category && x.companyId === 'player')!;
  const profile = w.season.config.operations.profiles[recipeId];
  const p = w.properties.find((x) => x.id === e.propertyId)!;
  Object.assign(p, { area: profile.areaM2 * lines, water: true, energyConnected: true });
  Object.assign(e, {
    enabled: true,
    mothballed: false,
    installed: true,
    specialization: recipeId,
    equipmentLines: lines,
    employees: profile.workers * lines,
    inventory: { ...inventory },
    unitCosts: {},
    capacityT: 1e9,
    capacityM3: 1e9,
  });
  w.companies.find((c) => c.id === e.companyId)!.balance = 1e12;
  return e;
}
function produceAndFinish(w: World, e: Establishment, recipeId: string, cycles: number) {
  execute(w, e.companyId, { type: 'produce', establishmentId: e.id, recipeId, cycles }, NOW);
  advance(w, w.jobs.at(-1)!.finishesAt);
}

describe('mundo versão 2 · sementes, rebanho e ração', () => {
  it('fazenda planta semente comprada e a colheita devolve 110% dela', () => {
    const w = v2World();
    const farm = unit(w, 'farm', 'soy-harvest', 1, { soySeed: 0.6 });
    const before = money(w);
    produceAndFinish(w, farm, 'soy-harvest', 1);
    expect(farm.inventory.soy).toBe(30);
    expect(farm.inventory.soySeed).toBeCloseTo(0.66, 9);
    // Processamento, energia e água vão ao tesouro: o dinheiro do mundo se conserva.
    expect(money(w)).toBe(before);
  });

  it('fazenda sem semente não planta, e nada muda', () => {
    const w = v2World();
    const farm = unit(w, 'farm', 'rice-harvest', 1, {});
    const snapshot = JSON.stringify(w);
    expect(() =>
      execute(
        w,
        farm.companyId,
        { type: 'produce', establishmentId: farm.id, recipeId: 'rice-harvest', cycles: 1 },
        NOW,
      ),
    ).toThrow(/Semente de arroz/);
    expect(JSON.stringify(w)).toBe(snapshot);
  });

  it('cada linha de ordenha exige 150 vacas presentes, que não são consumidas', () => {
    const w = v2World();
    const recipe = w.season.config.recipes.find((r) => r.id === 'milk-production')!;
    const dairy = unit(w, 'farm', 'milk-production', 2, { cow: 149, feed: 10000 });
    expect(productionCapacity(w, dairy, recipe).lines).toBe(0);
    expect(productionCapacity(w, dairy, recipe).bottleneck).toBe('Rebanho insuficiente');
    expect(() =>
      execute(
        w,
        dairy.companyId,
        { type: 'produce', establishmentId: dairy.id, recipeId: 'milk-production', cycles: 1 },
        NOW,
      ),
    ).toThrow(RuleError);
    dairy.inventory.cow = 200;
    expect(productionCapacity(w, dairy, recipe).lines).toBe(1);
    expect(productionCapacity(w, dairy, recipe).bottleneck).toBe('Rebanho limita as linhas');
    dairy.inventory.cow = 300;
    expect(productionCapacity(w, dairy, recipe).lines).toBe(2);
    // O rebanho das linhas instaladas não é vendável pela automação.
    expect(availableStock(w, dairy, 'cow')).toBe(0);
  });

  it('ordenha consome ração, produz leite e o rebanho cresce em vacas inteiras', () => {
    const w = v2World();
    const dairy = unit(w, 'farm', 'milk-production', 1, { cow: 150, feed: 1687.5 * 12 });
    let total = 0;
    for (let day = 0; day < 12; day++) {
      produceAndFinish(w, dairy, 'milk-production', 1);
      total += 1;
      expect(Number.isInteger(dairy.inventory.cow)).toBe(true);
    }
    expect(dairy.inventory.milk).toBe(4500 * total);
    expect(dairy.inventory.feed).toBeCloseTo(0, 6);
    // Saldo líquido de 0,09 vaca por linha por dia: 12 dias = 1,08 → uma vaca a mais e 0,08 guardado.
    expect(dairy.inventory.cow).toBe(151);
    expect(dairy.herdCarry).toBeCloseTo(0.08, 9);
  });

  it('fábrica de ração transforma farelo, declarando 1% de perda', () => {
    const w = v2World();
    const mill = unit(w, 'industry', 'feed-mill', 1, { soymeal: 1000 });
    produceAndFinish(w, mill, 'feed-mill', 1);
    expect(mill.inventory.soymeal).toBe(0);
    expect(mill.inventory.feed).toBe(990);
    expect(w.season.config.recipes.find((r) => r.id === 'feed-mill')!.lossKg).toBe(10);
  });
});
