// Relógio de cada mundo (spec 004). O motor guarda instantes e durações em milissegundos reais (o
// relógio do servidor); as regras do jogo falam em tempo de jogo (horas, dias). A velocidade é da
// temporada de cada mundo (`season.config.clock`) e a conversão entre os dois acontece só aqui.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
// Padrão de mundos novos e dos mundos salvos antes da spec 004: 1 minuto real = 2 horas de jogo,
// um dia de jogo = 12 minutos reais. O playtest lento usa 6 (D-028: dia de jogo = 4 horas reais).
export const DEFAULT_TIME_SCALE = 120;

export interface WorldClock {
  timeScale: number; // minutos de jogo por minuto real
  economicIntervalGameMs: number; // rodada econômica, em tempo de jogo
}

export function createClock(timeScale = DEFAULT_TIME_SCALE): WorldClock {
  const economicIntervalGameMs = 2 * HOUR_MS;
  // Inteiro que divide a rodada: rodadas e dias de jogo caem em milissegundos reais inteiros.
  if (!Number.isInteger(timeScale) || timeScale < 1 || economicIntervalGameMs % timeScale)
    throw new Error(
      'Velocidade do relógio inválida: use um inteiro positivo que divida 7.200.000 (ex.: 6 ou 120).',
    );
  return { timeScale, economicIntervalGameMs };
}

// Aceita o próprio relógio ou qualquer coisa com temporada (mundo, visão do navegador).
export type ClockSource = WorldClock | { season: { config: { clock: WorldClock } } };
const clockOf = (s: ClockSource): WorldClock => ('timeScale' in s ? s : s.season.config.clock);

export const timeScaleOf = (s: ClockSource) => clockOf(s).timeScale;
/** Duração de jogo → milissegundos reais. */
export const gameToReal = (s: ClockSource, gameMs: number) => gameMs / clockOf(s).timeScale;
/** Milissegundos reais → duração de jogo. */
export const realToGame = (s: ClockSource, realMs: number) => realMs * clockOf(s).timeScale;
/** Um dia de jogo em milissegundos reais. */
export const gameDay = (s: ClockSource) => gameToReal(s, DAY_MS);
/** Intervalo entre rodadas econômicas em milissegundos reais. */
export const economicInterval = (s: ClockSource) =>
  gameToReal(s, clockOf(s).economicIntervalGameMs);
