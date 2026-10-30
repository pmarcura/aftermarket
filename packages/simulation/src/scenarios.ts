import { createWorld } from './seed';
import { defaultSupplyPolicy } from './competition';
import { operatingCosts } from './metrics';
import { normalizeV2Lot } from './opening-v2';
import type { World } from './model';

// Começo enxuto do mundo jogável (D-033): cada jogador começa com uma loja vazia,
// equipe de uma loja de referência e R$ 1 milhão livre. Os outros negócios do jogador voltam ao
// mapa como imóveis à venda, sem estoque (que viraria oferta barata e derrubaria preços), e os
// caminhões vão para uma transportadora-bot. O dinheiro acima do capital inicial volta ao tesouro de SP.
export const leanStartCash = 100000000;
const leanStartStaff = 8;
function leanStart(w: World, at: number) {
  const yard = w.establishments.find(
    (e) => e.companyId === 'transbrasil' && e.category === 'logistics',
  );
  for (const actor of ['player', 'player2']) {
    const c = w.companies.find((c) => c.id === actor)!;
    const owned = w.establishments.filter((e) => e.companyId === actor);
    let shop = owned.find((e) => e.category === 'retail');
    const released = new Set(owned.filter((e) => e !== shop).map((e) => e.id));
    for (const e of owned.filter((e) => e !== shop)) {
      const lot = w.properties.find((p) => p.id === e.propertyId)!;
      lot.ownerId = null;
      normalizeV2Lot(w, lot);
    }
    w.establishments = w.establishments.filter((e) => !released.has(e.id));
    w.offers = w.offers.filter((o) => !released.has(o.establishmentId));
    w.jobs = w.jobs.filter((j) => !released.has(j.establishmentId));
    w.orders = w.orders.filter((o) => !released.has(o.originId) && !released.has(o.destinationId));
    w.shipments = w.shipments.filter(
      (s) => !released.has(s.originId) && !released.has(s.destinationId),
    );
    w.training = (w.training ?? []).filter((t) => !released.has(t.establishmentId));
    for (const v of w.vehicles.filter((v) => v.companyId === actor)) {
      v.companyId = yard?.companyId ?? 'transbrasil';
      if (yard) v.propertyId = yard.propertyId;
      v.status = 'available';
    }
    if (!shop) {
      // Ponto comercial livre em Campinas (os lotes são gerados por cidade).
      const lot =
        w.properties.find((p) => p.id === 'newretail' && p.ownerId === null) ??
        w.properties.find(
          (p) => p.category === 'retail' && p.ownerId === null && p.city === 'Campinas',
        )!;
      lot.ownerId = actor;
      shop = {
        id: `e-start-${actor}`,
        name: 'Loja Costa',
        companyId: actor,
        propertyId: lot.id,
        category: 'retail',
        inventory: {},
        unitCosts: {},
        prices: {},
        capacityT: 0,
        capacityM3: 0,
        employees: 0,
        dailyCost: 0,
        revenue: 0,
        expenses: 0,
        enabled: true,
      };
      w.establishments.push(shop);
    }
    const lot = w.properties.find((p) => p.id === shop!.propertyId)!;
    Object.assign(shop, {
      inventory: {},
      unitCosts: {},
      prices: {},
      quality: {},
      revenue: 0,
      expenses: 0,
      enabled: true,
      installed: true,
      equipmentLines: 1,
      employees: leanStartStaff,
      capacityT: Math.max(
        21,
        Math.floor(lot.area * w.season.config.design.storageMassPerM2.retail),
      ),
      capacityM3: Math.max(
        84,
        Math.floor(lot.area * w.season.config.design.storageVolumePerM2.retail),
      ),
    });
    shop.supplyPolicy = defaultSupplyPolicy(w, shop);
    shop.supplyPolicy.enabled = false;
    shop.dailyCost = operatingCosts(w, shop).total;
    const extra = c.balance - leanStartCash;
    const treasury = w.companies.find((x) => x.id === 'treasury:SP')!;
    const [from, to] = extra > 0 ? [c, treasury] : [treasury, c];
    from.balance -= Math.abs(extra);
    to.balance += Math.abs(extra);
    w.ledger.push({
      id: crypto.randomUUID(),
      at,
      from: from.id,
      to: to.id,
      amount: Math.abs(extra),
      kind: 'budget',
      description: 'Começo enxuto do mundo jogável: capital inicial de R$ 1 milhão',
    });
  }
}
// Cenários (D-042): `baseline` é o mundo de referência inteiro, para testes e laboratório;
// `playtest` é o mundo jogável, com começo enxuto e escala configurável.
export type ScenarioName = 'baseline' | 'playtest';
export const scenarioNames: readonly ScenarioName[] = ['baseline', 'playtest'];
export function createScenario(
  at: number,
  scenario: ScenarioName = 'baseline',
  seed = 0,
  options: { scale?: number } = {},
) {
  if (!scenarioNames.includes(scenario) || !Number.isSafeInteger(seed) || seed < 0 || seed > 10000)
    throw Error('Cenário ou semente inválida.');
  const w = createWorld(at, { scale: options.scale });
  for (const [i, c] of w.companies.filter((c) => c.id.startsWith('rival-')).entries())
    c.strategy = (['regional', 'quality', 'value'] as const)[(i + seed) % 3];
  w.season.name = scenario === 'playtest' ? 'Mundo jogável' : 'Temporada local';
  if (scenario === 'playtest') leanStart(w, at);
  return w;
}
