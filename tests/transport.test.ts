import { describe, it, expect } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { quote, execute } from '../packages/simulation/src/engine';
import { fleetAvailability, storageQuantity } from '../packages/simulation/src/transport';
import { defaultSupplyPolicy } from '../packages/simulation/src/competition';
import { supplyCandidates, runSupplyPolicies } from '../packages/simulation/src/supply';
import { roadNeeds } from '../packages/simulation/src/routing-needs';
const NOW = Date.UTC(2026, 9, 27, 4);
describe('capacidade de transporte e conexão produtiva', () => {
  it('limita por veículo, massa e volume sem contar caminhões em viagem/manutenção', () => {
    const w = createWorld(NOW);
    w.vehicles = [
      {
        id: 'a',
        companyId: 'player',
        name: 'A',
        capacityT: 1.9,
        capacityM3: 100,
        propertyId: 'industry',
        status: 'available',
      },
      {
        id: 'b',
        companyId: 'player',
        name: 'B',
        capacityT: 100,
        capacityM3: 0.9,
        propertyId: 'industry',
        status: 'available',
      },
      {
        id: 'c',
        companyId: 'player',
        name: 'C',
        capacityT: 100,
        capacityM3: 100,
        propertyId: 'industry',
        status: 'route',
      },
      {
        id: 'd',
        companyId: 'player',
        name: 'D',
        capacityT: 100,
        capacityM3: 100,
        propertyId: 'industry',
        status: 'maintenance',
      },
    ];
    const f = fleetAvailability(w, 'player', 'iron');
    expect(f.total).toBe(4);
    expect(f.available).toBe(2);
    expect(f.busy).toBe(1);
    expect(f.maintenance).toBe(1);
    const q = quote(w, 'e-mine', 'e-industry', 'iron', f.maxQuantity, 'player');
    expect(q.compatible).toBe(true);
    expect(q.unallocated).toBe(0);
    expect(quote(w, 'e-mine', 'e-industry', 'iron', f.maxQuantity + 1, 'player').compatible).toBe(
      false,
    );
  });
  it('capacidade do destino inclui entregas e produção já comprometidas', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-industry')!;
    e.inventory = {};
    e.capacityT = 100;
    e.capacityM3 = 100;
    const before = storageQuantity(w, e, 'iron');
    execute(
      w,
      'player',
      {
        type: 'transferStock',
        originId: 'e-mine',
        destinationId: e.id,
        product: 'iron',
        quantity: 5,
        carrierId: 'player',
      },
      NOW,
    );
    expect(storageQuantity(w, e, 'iron')).toBe(before - 5);
  });
  it('conexão fixa não usa outra origem nem mercado quando a produtora esgota', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-industry')!,
      origin = w.establishments.find((e) => e.id === 'e-mine')!;
    const policy = defaultSupplyPolicy(w, e);
    policy.source = 'market';
    policy.minQuality = 0;
    policy.maxDistanceKm = 6000;
    policy.carrierId = 'own';
    policy.rules = [
      { product: 'iron', originId: origin.id, minimum: 1, target: 10, maxBuy: 10, maxPrice: 0 },
    ];
    expect(supplyCandidates(w, e, 'iron', 1, policy)[0]?.origin.id).toBe(origin.id);
    origin.inventory.iron = 0;
    expect(supplyCandidates(w, e, 'iron', 1, policy)).toEqual([]);
    policy.enabled = true;
    e.supplyPolicy = policy;
    e.inventory.iron = 0;
    const before = w.companies.map((c) => c.balance);
    for (const other of w.establishments)
      if (other.id !== e.id && other.supplyPolicy) other.supplyPolicy.enabled = false;
    runSupplyPolicies(w, NOW);
    expect(w.companies.map((c) => c.balance)).toEqual(before);
    expect(w.shipments).toHaveLength(0);
  });
  it('recusa conexão para unidade de terceiro e não altera a política anterior', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-industry')!,
      policy = defaultSupplyPolicy(w, e),
      before = structuredClone(e.supplyPolicy);
    policy.rules = [
      { product: 'iron', originId: 'e-ferrovale', minimum: 1, target: 10, maxBuy: 10, maxPrice: 0 },
    ];
    expect(() =>
      execute(w, 'player', { type: 'configureSupply', establishmentId: e.id, policy }, NOW),
    ).toThrow();
    expect(e.supplyPolicy).toEqual(before);
  });
  it('pré-cálculo rodoviário respeita conexão fixa, inclusive com estoque abaixo do alvo', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.id === 'e-industry')!,
      origin = w.establishments.find((e) => e.id === 'e-mine')!;
    w.orders = [];
    w.infrastructure = [];
    for (const u of w.establishments) if (u.supplyPolicy) u.supplyPolicy.enabled = false;
    e.enabled = true;
    e.mothballed = false;
    e.inventory.iron = 0;
    e.supplyPolicy = {
      ...defaultSupplyPolicy(w, e),
      enabled: true,
      rules: [
        { product: 'iron', originId: origin.id, minimum: 1, target: 10, maxBuy: 10, maxPrice: 0 },
      ],
    };
    const needs = roadNeeds(w).filter((n) => n.destination === e.propertyId);
    expect(needs.map((n) => n.origin)).toEqual([origin.propertyId]);
  });
});
