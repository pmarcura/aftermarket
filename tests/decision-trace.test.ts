import { describe, expect, it, vi } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute } from '../packages/simulation/src/engine';
import { runBotDirector } from '../packages/simulation/src/director';
import { runSupplyPolicies } from '../packages/simulation/src/supply';
import { defaultSupplyPolicy } from '../packages/simulation/src/competition';
import { ECONOMIC_INTERVAL, type World } from '../packages/simulation/src/model';
import {
  hasDecisionTrace,
  withDecisionSource,
  withDecisionTrace,
  type DecisionTrace,
} from '../packages/simulation/src/decision-trace';

const NOW = Date.UTC(2026, 9, 26, 12);
const unit = (world: World, id = 'e-botfactory') => world.establishments.find((e) => e.id === id)!;

function supplyWorld() {
  const world = createWorld(NOW);
  for (const establishment of world.establishments) {
    establishment.automation = false;
    if (establishment.supplyPolicy) establishment.supplyPolicy.enabled = false;
  }
  const destination = unit(world);
  destination.inventory = {};
  destination.capacityT = 1000;
  destination.capacityM3 = 1000;
  destination.supplyPolicy = {
    ...defaultSupplyPolicy(world, destination),
    enabled: true,
    source: 'market',
    purchaseMode: 'immediate',
    carrierId: 'transbrasil',
    minQuality: 0,
    maxDistanceKm: 6000,
    maxFreightPerUnit: 0,
    dailyBudget: 1000000000,
    cashReserve: 0,
    rules: [{ product: 'iron', minimum: 1, target: 10, maxBuy: 10, maxPrice: 0 }],
  };
  world.offers = world.offers.filter((offer) => offer.id === 'offer-ferrovale');
  return { world, destination };
}

describe('observação opcional das decisões', () => {
  it('preserva exatamente o mundo com e sem observação, inclusive IDs e ordem', () => {
    const base = createWorld(NOW);
    const plain = structuredClone(base);
    const observed = structuredClone(base);
    const events: DecisionTrace[] = [];
    let sequence = 0;
    const uuid = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
    try {
      advance(plain, NOW + ECONOMIC_INTERVAL * 4);
      sequence = 0;
      withDecisionTrace(
        observed,
        (event) => events.push(event),
        () => {
          advance(observed, NOW + ECONOMIC_INTERVAL * 4);
        },
      );
      expect(observed).toEqual(plain);
      expect(Reflect.ownKeys(observed)).toEqual(Reflect.ownKeys(base));
      expect(events.some((event) => event.source === 'production')).toBe(true);
      expect(events.some((event) => event.source === 'director')).toBe(true);
      expect(hasDecisionTrace(observed)).toBe(false);
    } finally {
      uuid.mockRestore();
    }
  });

  it('registra o resultado do comando e o RuleError real sem mudar estado rejeitado', () => {
    const world = createWorld(NOW);
    const events: DecisionTrace[] = [];
    const factory = unit(world);
    factory.inventory.soy = 0;
    const before = structuredClone(world);
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => {
        expect(() =>
          execute(
            world,
            factory.companyId,
            { type: 'produce', establishmentId: factory.id, recipeId: 'soy-oil', cycles: 1 },
            NOW,
          ),
        ).toThrow();
        expect(world).toEqual(before);
        execute(
          world,
          'aurora',
          { type: 'setPrice', establishmentId: 'e-marketbot', product: 'rice', price: 1900 },
          NOW,
        );
        // Human commands use the same executor but are outside bot telemetry.
        execute(
          world,
          'player',
          { type: 'setPrice', establishmentId: 'e-retail', product: 'rice', price: 1900 },
          NOW,
        );
      },
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      source: 'command',
      outcome: 'rejected',
      action: 'produce',
      companyId: factory.companyId,
      establishmentId: factory.id,
    });
    expect(events[0].message).toMatch(/insumo|estoque/i);
    expect(events[0].code).toMatch(/^command:produce:rejected:/);
    expect(events[1]).toMatchObject({
      source: 'command',
      outcome: 'executed',
      action: 'setPrice',
      productId: 'rice',
    });
  });

  it('restaura observadores e fonte após escopos aninhados e exceções', () => {
    const world = createWorld(NOW);
    const outer: DecisionTrace[] = [];
    const inner: DecisionTrace[] = [];
    const act = () =>
      execute(
        world,
        'aurora',
        { type: 'setPrice', establishmentId: 'e-marketbot', product: 'rice', price: 1900 },
        NOW,
      );
    expect(() =>
      withDecisionTrace(
        world,
        (event) => outer.push(event),
        () => {
          withDecisionSource(world, 'supply', () => {
            act();
            withDecisionTrace(world, (event) => inner.push(event), act);
            act();
          });
          expect(() =>
            withDecisionSource(world, 'director', () => {
              throw Error('fonte');
            }),
          ).toThrow('fonte');
          act();
          throw Error('observação');
        },
      ),
    ).toThrow('observação');
    expect(outer.map((event) => event.source)).toEqual(['supply', 'supply', 'command']);
    expect(inner.map((event) => event.source)).toEqual(['command']);
    expect(hasDecisionTrace(world)).toBe(false);
    act();
    expect(outer).toHaveLength(3);
    expect(inner).toHaveLength(1);
    expect(JSON.stringify(world)).not.toMatch(/observer|DecisionTrace|traceScope/);
  });

  it('observa reserva de caixa, frota e espaço nos branches reais de reposição', () => {
    const { world, destination } = supplyWorld();
    const events: DecisionTrace[] = [];
    destination.supplyPolicy!.cashReserve =
      world.companies.find((c) => c.id === destination.companyId)!.balance + 1;
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => runSupplyPolicies(world, NOW + ECONOMIC_INTERVAL),
    );
    expect(
      events.some(
        (event) =>
          event.code === 'cash-reserve' && event.productId === 'iron' && event.source === 'supply',
      ),
    ).toBe(true);
    expect(world.shipments).toHaveLength(0);
    destination.supplyPolicy!.cashReserve = 0;
    world.vehicles.forEach((vehicle) => {
      vehicle.status = 'maintenance';
    });
    events.length = 0;
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => runSupplyPolicies(world, NOW + ECONOMIC_INTERVAL * 2),
    );
    expect(events.some((event) => event.code === 'fleet-unavailable')).toBe(true);
    expect(events.every((event) => event.at === NOW + ECONOMIC_INTERVAL * 2)).toBe(true);
    world.vehicles.forEach((vehicle) => {
      vehicle.status = 'available';
    });
    destination.capacityT = 0;
    destination.capacityM3 = 0;
    events.length = 0;
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => runSupplyPolicies(world, NOW + ECONOMIC_INTERVAL * 3),
    );
    expect(events.some((event) => event.code === 'destination-storage-full')).toBe(true);
    expect(world.shipments).toHaveLength(0);
  });

  it('identifica comando de reposição e espera pela contraparte', () => {
    const { world, destination } = supplyWorld();
    const events: DecisionTrace[] = [];
    destination.supplyPolicy!.purchaseMode = 'request';
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => runSupplyPolicies(world, NOW),
    );
    expect(
      events.some(
        (event) =>
          event.source === 'supply' &&
          event.action === 'requestOrder' &&
          event.outcome === 'executed' &&
          event.productId === 'iron',
      ),
    ).toBe(true);
    expect(
      events.some((event) => event.code === 'awaiting-counterparty' && event.outcome === 'idle'),
    ).toBe(true);
    expect(world.orders).toHaveLength(1);
    expect(world.shipments).toHaveLength(0);
  });

  it('registra pausa e falta física de insumos da produção sem inferir causas', () => {
    const world = createWorld(NOW);
    const factory = unit(world);
    for (const e of world.establishments) {
      e.automation = false;
      if (e.supplyPolicy) e.supplyPolicy.enabled = false;
    }
    factory.automation = true;
    factory.inventory.soy = 0;
    world.offers = world.offers.filter((offer) => offer.product !== 'soy');
    const events: DecisionTrace[] = [];
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => advance(world, NOW + ECONOMIC_INTERVAL),
    );
    expect(
      events.some(
        (event) =>
          event.source === 'production' &&
          event.code === 'inputs-missing' &&
          event.establishmentId === factory.id &&
          event.productId === 'soy',
      ),
    ).toBe(true);
    factory.enabled = false;
    events.length = 0;
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => advance(world, NOW + ECONOMIC_INTERVAL * 2),
    );
    expect(
      events.some(
        (event) =>
          event.source === 'production' &&
          event.code === 'operation-paused' &&
          event.establishmentId === factory.id,
      ),
    ).toBe(true);
  });

  it('distingue o diretor sem comando selecionado de uma causa econômica presumida', () => {
    const world = createWorld(NOW);
    world.establishments = [];
    world.offers = [];
    world.orders = [];
    const events: DecisionTrace[] = [];
    withDecisionTrace(
      world,
      (event) => events.push(event),
      () => runBotDirector(world, NOW),
    );
    const event = events.find((candidate) => candidate.companyId === 'ferrovale');
    expect(event).toMatchObject({
      source: 'director',
      outcome: 'idle',
      action: 'plan',
      code: 'no-command-selected',
    });
    expect(event?.message).toMatch(/causa não foi inferida/);
  });
});
