import { describe, expect, it, vi } from 'vitest';
import { runLab, validateLabOptions } from '../packages/simulation/src/lab';
import * as metrics from '../packages/simulation/src/metrics';
import {
  marketView,
  recordMarket,
  regionsOf,
  withAppendOnlyMarketLedger,
} from '../packages/simulation/src/metrics';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { seasonProducts, type MarketSample, type World } from '../packages/simulation/src/model';
import { GAME_DAY } from '../packages/simulation/src/operations';

// Query oracle: mirrors the previous recording contract only in the test.
function queriedSamples(world: World, at: number): MarketSample[] {
  const result: MarketSample[] = [];
  const regions = regionsOf(world);
  for (const product of seasonProducts(world))
    for (const regionId of [
      '',
      ...regions.map((region) => region.id),
      ...[...new Set(regions.map((region) => region.state))].map((state) => `state:${state}`),
    ]) {
      const row = marketView(world, product, regionId);
      result.push({
        at,
        product,
        regionId,
        price: row.price,
        stock: row.stock,
        offerCount: row.offers.length,
        tradedQuantity: row.tradedQuantity,
        tradedValue: row.tradedValue,
      });
    }
  return result;
}

describe('laboratório headless', () => {
  // Dez dias do mundo da economia 2 (~500 ms/dia) bastam para a trajetória divergir se o índice
  // alterasse algum número; 30 dias passavam do tempo da suíte.
  it('preserva a trajetória de 10 dias com e sem índice de leitura', () => {
    const indexed = runLab({ days: 10 });
    const scope = vi
      .spyOn(metrics, 'withAppendOnlyMarketLedger')
      .mockImplementation((_world, run) => run());
    try {
      const queried = runLab({ days: 10 });
      expect({ ...indexed, performance: undefined }).toEqual({
        ...queried,
        performance: undefined,
      });
    } finally {
      scope.mockRestore();
    }
  }, 30000);
  it('mantém índice de leitura só dentro do escopo append-only e limpa em exceções', () => {
    const at = Date.UTC(2026, 9, 26, 12);
    const world = createScenario(at);
    const regions = regionsOf(world);
    const assertQueries = () => {
      const oracle = structuredClone(world);
      for (const product of seasonProducts(world))
        for (const scope of ['', regions[0].id, 'state:SP', 'state:MG', 'unknown', 'state:unknown'])
          expect(marketView(world, product, scope)).toEqual(marketView(oracle, product, scope));
    };
    expect(() =>
      withAppendOnlyMarketLedger(world, () => {
        assertQueries();
        for (const regionId of [undefined, '', regions[0].id, 'unknown', 'state:SP']) {
          world.ledger.push({
            id: `index-${regionId}`,
            at,
            from: 'a',
            to: 'b',
            amount: 29,
            kind: 'trade',
            description: 'Índice de leitura',
            channel: 'wholesale',
            product: 'iron',
            quantity: 0.125,
            regionId,
          });
          assertQueries();
        }
        world.ledger.length -= 2;
        assertQueries();
        world.ledger = world.ledger.slice(1);
        assertQueries();
        throw new Error('callback falhou');
      }),
    ).toThrow('callback falhou');
    // Editing an old entry is intentionally unsupported inside the scope, but must
    // always be read correctly after cleanup, including cleanup after a throw.
    const entry = world.ledger.find(
      (candidate) => candidate.product === 'iron' && candidate.channel === 'wholesale',
    )!;
    entry.amount += 1000;
    assertQueries();
  });
  it('agrega histórico com os mesmos números e ordem das consultas por produto e escopo', () => {
    const at = Date.UTC(2026, 9, 26, 12);
    const world = createScenario(at);
    const regions = regionsOf(world);
    advance(world, at + GAME_DAY * 2);
    const farm = world.establishments.find((establishment) => establishment.category === 'farm')!;
    farm.automation = true;
    farm.inventory.soy = 1;
    const offer = world.offers.find((candidate) => candidate.product === 'iron')!;
    const owner = world.establishments.find(
      (establishment) => establishment.id === offer.establishmentId,
    )!;
    owner.enabled = false; // Offers remain visible exactly as marketView currently specifies.
    world.offers.push({ ...offer, id: 'duplicate-offer', price: offer.price + 17 });
    world.ledger.push(
      {
        id: 'global-only',
        description: 'Teste sem praça',
        at,
        from: 'a',
        to: 'b',
        amount: 17,
        kind: 'trade',
        product: 'iron',
        quantity: 0.125,
        channel: 'wholesale',
      },
      {
        id: 'unknown-region',
        description: 'Teste praça desconhecida',
        at,
        from: 'a',
        to: 'b',
        amount: 23,
        kind: 'trade',
        product: 'iron',
        quantity: 0.25,
        channel: 'wholesale',
        regionId: 'unknown',
      },
      {
        id: 'retail-excluded',
        description: 'Teste varejo',
        at,
        from: 'a',
        to: 'b',
        amount: 99,
        kind: 'retail',
        product: 'iron',
        quantity: 10,
        channel: 'retail',
        regionId: regions[0].id,
      },
      {
        id: 'scope-looking-region',
        description: 'Praça desconhecida com nome de escopo',
        at,
        from: 'a',
        to: 'b',
        amount: 13,
        kind: 'trade',
        product: 'iron',
        quantity: 0.5,
        channel: 'wholesale',
        regionId: 'state:SP',
      },
    );
    const expected = queriedSamples(world, at + GAME_DAY * 2);
    const before = structuredClone(world);
    world.marketHistory = [];
    recordMarket(world, at + GAME_DAY * 2);
    expect(world.marketHistory).toEqual(expected);
    expect({ ...world, marketHistory: before.marketHistory }).toEqual(before);
    // Aggregation is local: inventory/ledger edits must be visible on the next call.
    owner.inventory.iron = 0;
    world.ledger.push({
      id: 'next-trade',
      description: 'Teste próximo negócio',
      at,
      from: 'a',
      to: 'b',
      amount: 11,
      kind: 'trade',
      product: 'iron',
      quantity: 0.5,
      channel: 'wholesale',
      regionId: regions[0].id,
    });
    const next = queriedSamples(world, at + GAME_DAY * 3);
    recordMarket(world, at + GAME_DAY * 3);
    expect(world.marketHistory.slice(-next.length)).toEqual(next);
    world.marketHistory = Array.from({ length: 33000 }, () => ({ ...next[0] }));
    recordMarket(world, at + GAME_DAY * 4);
    expect(world.marketHistory).toHaveLength(33000);
    expect(world.marketHistory.slice(-next.length)).toEqual(
      queriedSamples(world, at + GAME_DAY * 4),
    );
  });
  it('valida as fronteiras sem converter entradas ambíguas', () => {
    expect(validateLabOptions()).toEqual({
      scenario: 'baseline',
      seed: 0,
      days: 30,
      demandMultiplier: 1,
      costMultiplier: 1,
      capacityMultiplier: 1,
      freightMultiplier: 1,
      botPolicy: 'mixed',
      seedMode: 'rotation',
    });
    for (const input of [
      null,
      [],
      { days: 0 },
      { days: 366 },
      { days: '30' },
      { days: null },
      { seed: null },
      { scenario: null },
      { demandMultiplier: null },
      { seed: -1 },
      { seed: 10001 },
      { seed: 0.1 },
      { scenario: 'unknown' },
      { demandMultiplier: 0 },
      { demandMultiplier: Infinity },
      { demandMultiplier: 2.1 },
      { database: 'world.sqlite' },
    ])
      expect(() => validateLabOptions(input)).toThrow();
    expect(
      validateLabOptions({ days: 365, seed: 10000, demandMultiplier: 0.1, scenario: 'playtest' }),
    ).toEqual({
      ...validateLabOptions(),
      days: 365,
      seed: 10000,
      demandMultiplier: 0.1,
      scenario: 'playtest',
    });
  });

  it('reproduz a trajetória numérica e decisões sem rede nem relógio real', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const { performance: firstPerformance, ...first } = runLab({ days: 2, seed: 2 });
      const { performance: secondPerformance, ...second } = runLab({ days: 2, seed: 2 });
      expect(first).toEqual(second);
      expect(fetch).not.toHaveBeenCalled();
      expect(firstPerformance.elapsedMs).toBeGreaterThan(0);
      expect(secondPerformance.simulatedDaysPerSecond).toBeGreaterThan(0);
      expect(first.summary.moneyConserved).toBe(true);
      expect(new Set(first.observations.map((snapshot) => snapshot.money)).size).toBe(1);
      expect(first.observations).toHaveLength(3);
      expect(first.observations.at(-1)!.bots.some((bot) => bot.decisions > 0)).toBe(true);
      for (const snapshot of first.observations) {
        for (const bot of snapshot.bots) {
          expect(Number.isSafeInteger(bot.balance)).toBe(true);
          expect(bot.balance).toBeGreaterThanOrEqual(0);
          expect(bot.decisions).toBe(
            Object.values(bot.decisionKinds).reduce((sum, count) => sum + count, 0),
          );
        }
        for (const item of snapshot.items) {
          expect(item.physical).toBeGreaterThanOrEqual(0);
          expect(item.hhi === null || (item.hhi > 0 && item.hhi <= 10000.000001)).toBe(true);
        }
      }
    } finally {
      fetch.mockRestore();
    }
  });

  it('altera apenas a demanda de abertura do experimento e preserva o próximo cenário', () => {
    const base = runLab({ days: 1 });
    const variant = runLab({ days: 1, demandMultiplier: 0.5 });
    const fresh = runLab({ days: 1 });
    expect(variant.metadata.config.parameters.playableConsumerShare).toBe(
      base.metadata.config.parameters.playableConsumerShare * 0.5,
    );
    expect(fresh.metadata.config).toEqual(base.metadata.config);
    expect(variant.observations[0].money).toBe(base.observations[0].money);
    expect(variant.metadata.routingMode).toBe('estimate');
    expect(variant.metadata.humanActions).toBe(false);
    // O mundo jogável (começo enxuto) tem a mesma procura; só a opção `demand` a altera.
    const lean = runLab({ days: 1, scenario: 'playtest', demandMultiplier: 2 });
    expect(lean.metadata.config.parameters.playableConsumerShare).toBe(
      base.metadata.config.parameters.playableConsumerShare * 2,
    );
  });

  it('informa progresso e cancela antes do próximo dia sem entregar um relatório parcial', () => {
    const controller = new AbortController();
    const progress: number[] = [];
    expect(() =>
      runLab(
        { days: 3 },
        {
          signal: controller.signal,
          onProgress: ({ day }) => {
            progress.push(day);
            if (day === 1) controller.abort();
          },
        },
      ),
    ).toThrow('Simulação cancelada');
    expect(progress).toEqual([0, 1]);
    expect(() => runLab({ days: 1 }, { shouldCancel: () => true })).toThrow('Simulação cancelada');
    const completed: number[] = [];
    runLab({ days: 1 }, { onProgress: ({ percent }) => completed.push(percent) });
    expect(completed).toEqual([0, 100]);
  });
});
