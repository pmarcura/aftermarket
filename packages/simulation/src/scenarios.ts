import { createWorld } from './seed';
import { defaultSupplyPolicy } from './competition';
import { operatingCosts } from './metrics';
import type { ProductId } from './model';
export type ScenarioName = 'baseline' | 'starter' | 'low-demand';
export function createScenario(at: number, scenario: ScenarioName = 'baseline', seed = 0) {
  const w = createWorld(at);
  if (
    !['baseline', 'starter', 'low-demand'].includes(scenario) ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > 10000
  )
    throw Error('Cenário ou semente inválida.');
  for (const [i, c] of w.companies.filter((c) => c.id.startsWith('rival-')).entries())
    c.strategy = (['regional', 'quality', 'value'] as const)[(i + seed) % 3];
  w.season.name =
    scenario === 'starter'
      ? 'Iniciante · laboratório separado'
      : scenario === 'low-demand'
        ? 'Demanda reduzida · experimento'
        : 'Temporada local';
  if (scenario === 'low-demand') w.season.config.parameters.playableConsumerShare *= 0.25;
  if (scenario === 'starter') {
    const gov = w.establishments.find((e) => e.id === 'e-public-works')!;
    for (const actor of ['player', 'player2']) {
      const c = w.companies.find((c) => c.id === actor)!;
      const reduced = c.balance - 12000000;
      c.balance -= reduced;
      w.companies.find((c) => c.id === 'treasury:SP')!.balance += reduced;
      w.ledger.push({
        id: crypto.randomUUID(),
        at,
        from: actor,
        to: 'treasury:SP',
        amount: reduced,
        kind: 'budget',
        description: 'Configuração inaugural do cenário iniciante: reserva institucional',
      });
      const owned = w.establishments.filter((e) => e.companyId === actor),
        shop = owned.find((e) => e.category === 'retail');
      for (const e of owned.filter((e) => e !== shop)) {
        const recipient =
          e.category === 'mine'
            ? 'ferrovale'
            : e.category === 'industry' || e.category === 'farm'
              ? 'agro'
              : 'aurora';
        e.companyId = recipient;
        w.properties.find((p) => p.id === e.propertyId)!.ownerId = recipient;
        e.automation = ['mine', 'farm', 'industry'].includes(e.category);
        e.supplyPolicy = defaultSupplyPolicy(w, e);
        e.supplyPolicy.enabled = e.supplyPolicy.rules.length > 0;
      }
      for (const v of w.vehicles.filter((v) => v.companyId === actor)) v.companyId = 'aurora';
      const property = shop
        ? w.properties.find((p) => p.id === shop.propertyId)!
        : w.properties.find((p) => p.id === 'newretail')!;
      property.ownerId = actor;
      property.area = 60;
      property.price = 21000000;
      const e = shop ?? {
        id: 'e-starter-player2',
        name: 'Loja Costa',
        companyId: actor,
        propertyId: property.id,
        category: 'retail' as const,
        inventory: {},
        unitCosts: {},
        prices: {},
        capacityT: 21,
        capacityM3: 84,
        employees: 6,
        dailyCost: 0,
        revenue: 0,
        expenses: 0,
        enabled: true,
      };
      if (!shop) w.establishments.push(e);
      e.capacityT = 21;
      e.capacityM3 = 84;
      e.employees = 6;
      e.revenue = 0;
      e.expenses = 0;
      e.enabled = true;
      e.installed = true;
      e.equipmentLines = 1;
      for (const [id, n] of Object.entries(e.inventory) as [ProductId, number][]) {
        gov.inventory[id] = (gov.inventory[id] ?? 0) + n;
        gov.unitCosts[id] = e.unitCosts[id] ?? w.season.config.basePrices[id];
      }
      e.inventory = {};
      e.unitCosts = {};
      e.prices = {};
      e.quality = {};
      e.supplyPolicy = defaultSupplyPolicy(w, e);
      e.supplyPolicy.enabled = false;
      e.dailyCost = operatingCosts(w, e).total;
    }
  }
  return w;
}
