import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DEFAULT_TIME_SCALE,
  HOUR_MS,
  createClock,
  economicInterval,
  gameDay,
  gameToReal,
  realToGame,
  timeScaleOf,
} from '../packages/simulation/src/clock';
import { createScenario } from '../packages/simulation/src/scenarios';
import { migrateWorld } from '../packages/simulation/src/migrate';
import type { World } from '../packages/simulation/src/model';

const AT = Date.UTC(2026, 9, 26, 12);

// Relógio por mundo (spec 004): as únicas funções que convertem tempo de jogo em tempo real.
describe('relógio do mundo', () => {
  it('a 120× (padrão) reproduz as constantes antigas', () => {
    const clock = createClock();
    expect(DEFAULT_TIME_SCALE).toBe(120);
    expect(clock).toEqual({ timeScale: 120, economicIntervalGameMs: 2 * HOUR_MS });
    expect(gameDay(clock)).toBe(720_000); // 12 minutos reais
    expect(economicInterval(clock)).toBe(60_000); // 1 minuto real = 2 h de jogo
    expect(gameToReal(clock, 12 * HOUR_MS)).toBe((12 * 3_600_000) / 120);
    expect(realToGame(clock, 720_000)).toBe(DAY_MS);
  });

  it('a 6× um dia de jogo dura 4 horas reais com as mesmas 12 rodadas', () => {
    const clock = createClock(6);
    expect(gameDay(clock)).toBe(4 * HOUR_MS);
    expect(economicInterval(clock)).toBe(20 * 60_000);
    expect(gameDay(clock) / economicInterval(clock)).toBe(12);
    expect(realToGame(clock, gameToReal(clock, 7 * HOUR_MS))).toBe(7 * HOUR_MS);
  });

  it('lê o relógio da temporada do mundo', () => {
    const w = { season: { config: { clock: createClock(6) } } };
    expect(timeScaleOf(w)).toBe(6);
    expect(gameDay(w)).toBe(gameDay(createClock(6)));
  });

  it('recusa velocidades que não caem em milissegundos inteiros', () => {
    for (const bad of [0, -6, 1.5, 7, Number.NaN]) expect(() => createClock(bad)).toThrow();
  });

  it('a temporada grava o relógio e as durações na velocidade do mundo', () => {
    const fast = createScenario(AT, 'baseline', 0);
    const slow = createScenario(AT, 'baseline', 0, { timeScale: 6 });
    expect(fast.season.config.clock).toEqual(createClock(120));
    expect(slow.season.config.clock).toEqual(createClock(6));
    expect(fast.nextEconomicAt - AT).toBe(economicInterval(fast));
    expect(slow.nextEconomicAt - AT).toBe(economicInterval(slow));
    // Mesma receita, mesma duração em horas de jogo; 20× mais longa em ms reais.
    for (const [i, r] of fast.season.config.recipes.entries()) {
      const s = slow.season.config.recipes[i]!;
      expect(realToGame(slow, s.duration)).toBeCloseTo(realToGame(fast, r.duration), 6);
    }
    const { contractIntervalMs: a } = fast.season.config.government;
    const { contractIntervalMs: b } = slow.season.config.government;
    expect(Math.abs(b / gameDay(slow) - a / gameDay(fast))).toBeLessThan(1e-6);
  });

  it('mundo salvo sem relógio recebe 120× na migração, sem recalcular a temporada', () => {
    const w = createScenario(AT, 'baseline', 0);
    const saved = JSON.parse(JSON.stringify(w)) as World;
    const before = JSON.parse(JSON.stringify(saved.season.config));
    delete (saved.season.config as Partial<World['season']['config']>).clock;
    delete before.clock;
    const { world, changed } = migrateWorld(saved, AT);
    expect(changed).toBe(true);
    expect(world.season.config.clock).toEqual({
      timeScale: 120,
      economicIntervalGameMs: 7_200_000,
    });
    const after = JSON.parse(JSON.stringify(world.season.config));
    delete after.clock;
    expect(after).toEqual(before);
  });
});
