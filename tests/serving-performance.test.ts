import { expect, it, vi } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { createWorld } from '../packages/simulation/src/seed';
import { worldView } from '../apps/server/src/view';
import { createWorldPacketCache } from '../apps/server/src/world-packet';
import { marketHistories } from '../apps/server/src/market-history';
import { economyHealth } from '../packages/simulation/src/design';
import { seasonProducts } from '../packages/simulation/src/model';
import { advance } from '../packages/simulation/src/engine';
import { economicInterval } from '../packages/simulation/src/clock';
import { createWorldConnection } from '../apps/web/src/lib/world-connection';
import { regionsOf } from '../packages/simulation/src/metrics';

it('reutiliza a resposta por revisão/empresa e conserva snapshot, compressão e privacidade', async () => {
  const world = createWorld(Date.UTC(2026, 10, 3));
  const project = vi.fn(worldView),
    get = createWorldPacketCache(project);
  const first = get(world, 'player');
  expect(get(world, 'player')).toBe(first);
  expect(project).toHaveBeenCalledTimes(1);
  expect(gunzipSync(await first.gzip)).toEqual(first.json);
  const other = get(world, 'player2');
  expect(JSON.parse(other.json.toString()).view.actor).toBe('player2');
  expect(other).not.toBe(first);
  const saved = first.json.toString();
  world.companies.find((c) => c.id === 'player')!.name = 'Nome atualizado';
  world.revision++;
  const next = get(world, 'player');
  expect(next).not.toBe(first);
  expect(first.json.toString()).toBe(saved);
  expect(
    JSON.parse(next.json.toString()).companies.find((c: { id: string }) => c.id === 'player').name,
  ).toBe('Nome atualizado');
  await Promise.all([other.gzip, next.gzip]);
});

it('indicadores em uma passagem conservam todos os indicadores de cada produto', () => {
  const world = createWorld(Date.UTC(2026, 10, 3));
  advance(world, world.updatedAt + economicInterval(world) * 8);
  const before = JSON.stringify(world);
  const view = worldView(world, 'player');
  for (const product of seasonProducts(world))
    expect(view.view!.health[product]).toEqual(economyHealth(world, world.updatedAt, product));
  expect(JSON.stringify(world)).toBe(before);
});

it('histórico agrupado preserva ordem, limites, recortes e dados do endpoint individual', () => {
  const world = createWorld(Date.UTC(2026, 10, 3));
  advance(world, world.updatedAt + economicInterval(world) * 3);
  const source = world.marketHistory[0];
  world.marketHistory = Array.from({ length: 2500 }, (_, i) => ({
    ...source,
    product: 'steel' as const,
    regionId: i % 2 ? '' : 'SP-campinas',
    at: i,
  }));
  const before = JSON.stringify(world);
  for (const region of ['', 'SP-campinas', `state:${regionsOf(world)[0].state}`]) {
    const histories = marketHistories(world, ['steel', 'coal'], region);
    for (const product of ['steel', 'coal'] as const) {
      expect(histories[product].samples).toEqual(
        world.marketHistory
          .filter((s) => s.product === product && s.regionId === region)
          .slice(-1000),
      );
      expect(histories[product].trades).toEqual(
        world.ledger
          .filter(
            (e) =>
              e.product === product &&
              e.channel === 'wholesale' &&
              (!region ||
                (region.startsWith('state:')
                  ? regionsOf(world).find((r) => r.id === e.regionId)?.state === region.slice(6)
                  : e.regionId === region)),
          )
          .slice(-2000),
      );
    }
  }
  expect(JSON.stringify(world)).toBe(before);
});

it('conexão compartilha pedido pendente, tem deadline e permite nova tentativa', async () => {
  vi.useFakeTimers();
  try {
    const fetcher = vi.fn(
      (_url: unknown, options?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const connection = createWorldConnection(fetcher as typeof fetch, 15000);
    const first = connection.read('player');
    const failed = expect(first).rejects.toThrow();
    expect(connection.read('player')).toBe(first);
    await vi.advanceTimersByTimeAsync(15000);
    await failed;
    expect(fetcher).toHaveBeenCalledTimes(1);
    const next = connection.read('player');
    connection.cancel();
    await expect(next).resolves.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
