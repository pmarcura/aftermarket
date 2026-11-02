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
});
