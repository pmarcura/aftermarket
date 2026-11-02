import { describe, expect, it } from 'vitest';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { runBotDirector } from '../packages/simulation/src/director';
import { trainingQuote } from '../packages/simulation/src/competition';
import { gameCalendar } from '../packages/simulation/src/operations';
import { withDecisionTrace, type DecisionTrace } from '../packages/simulation/src/decision-trace';
import {
  DAY_MS,
  HOUR_MS,
  economicInterval,
  gameDay,
  gameToReal,
  realToGame,
} from '../packages/simulation/src/clock';
import type { World } from '../packages/simulation/src/model';
import { createStore } from '../apps/server/src/store';

// Relógio por mundo (spec 004, A3): o relógio lento muda a velocidade, não as regras em tempo de jogo.
const AT = Date.UTC(2026, 9, 26, 12);
const worlds = new Map<number, World>();
function dayOne(timeScale: number) {
  let w = worlds.get(timeScale);
  if (!w) {
    w = createScenario(AT, 'baseline', 0, { timeScale });
    advance(w, AT + gameDay(w));
    worlds.set(timeScale, w);
  }
  return w;
}

describe('mesmo mundo a 120× e a 6×', () => {
  it('a 6× um dia de jogo leva 4 h reais e tem as mesmas 12 rodadas econômicas', () => {
    for (const timeScale of [120, 6]) {
      const w = dayOne(timeScale);
      expect(w.season.config.clock.timeScale).toBe(timeScale);
      // Rodadas em AT + 1·intervalo … AT + 12·intervalo; a próxima é a 13ª.
      expect((w.nextEconomicAt - AT) / economicInterval(w)).toBe(13);
      expect(gameCalendar(w, AT + gameDay(w)).date.getTime()).toBe(AT + DAY_MS);
    }
    expect(gameDay(dayOne(6))).toBe(4 * HOUR_MS);
    expect(gameDay(dayOne(120))).toBe(12 * 60_000);
  });

  it('treinamento e editais duram o mesmo em tempo de jogo nas duas velocidades', () => {
    for (const timeScale of [120, 6]) {
      const w = dayOne(timeScale);
      const cfg = w.season.config.competition;
      const e = w.establishments.find((x) => x.employees > 0)!;
      expect(realToGame(w, trainingQuote(w, e).durationMs)).toBe(cfg.educationHours * HOUR_MS);
      const contracts = w.infrastructure.filter((c) => c.biddingEndsAt !== undefined);
      expect(contracts.length).toBeGreaterThan(0);
      for (const c of contracts) {
        expect(realToGame(w, c.biddingEndsAt! - c.createdAt)).toBe(cfg.biddingHours * HOUR_MS);
        expect(realToGame(w, c.deadline - c.createdAt)).toBe(4 * DAY_MS);
      }
    }
    // Mesmos editais abertos no primeiro dia, nos mesmos instantes de jogo.
    const when = (w: World) =>
      w.infrastructure.map((c) => [c.product, c.quantity, realToGame(w, c.createdAt - AT)]);
    expect(when(dayOne(6))).toEqual(when(dayOne(120)));
  });

  it('o bot comprador espera 2 h de jogo por propostas nas duas velocidades', () => {
    for (const timeScale of [120, 6]) {
      const w = createScenario(AT, 'baseline', 0, { timeScale });
      const e = w.establishments.find((x) => x.id === 'e-botfactory')!;
      // Quantidade que nenhum bot tem em estoque: ninguém propõe e o comprador só espera.
      w.orders.push({
        id: 'pedido-relogio',
        buyerId: e.companyId,
        sellerId: '',
        originId: '',
        destinationId: e.id,
        product: 'iron',
        quantity: 10_000_000,
        unitPrice: 1,
        carrierId: '',
        maxFreight: 0,
        createdAt: AT,
        deadline: AT + 3 * gameDay(w),
        status: 'pending',
      });
      const waits = (at: number) => {
        const events: DecisionTrace[] = [];
        withDecisionTrace(
          w,
          (event) => events.push(event),
          () => runBotDirector(w, at),
        );
        return events.some(
          (x) => x.targetId === 'pedido-relogio' && x.code === 'awaiting-counterparty',
        );
      };
      expect(waits(AT + gameToReal(w, 2 * HOUR_MS) - 1)).toBe(false);
      expect(waits(AT + gameToReal(w, 2 * HOUR_MS))).toBe(true);
    }
  });

  it('o servidor cria mundo novo na velocidade pedida (AFTERMARKET_TIME_SCALE)', () => {
    for (const timeScale of [6, undefined]) {
      const store = createStore(':memory:', { scenario: 'baseline', timeScale });
      try {
        const w = store.read();
        expect(w.season.config.clock.timeScale).toBe(timeScale ?? 120);
        expect(w.nextEconomicAt - w.createdAt).toBe(economicInterval(w));
      } finally {
        store.close();
      }
    }
  });
});
