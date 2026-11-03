import { useEffect, useMemo } from 'react';
import { useGame } from '../../lib/game';
import type { World } from '../../../../../packages/simulation/src/model';
import { weekdayNames } from '../../../../../packages/simulation/src/operations';
import {
  DAY_MS,
  HOUR_MS,
  economicInterval,
  gameDay,
  gameToReal,
  realToGame,
} from '../../../../../packages/simulation/src/clock';

/** Instante real mais recente que o mundo já calculou. */
export const agoraDoMundo = (w: World) =>
  Math.max(w.updatedAt, w.nextEconomicAt - economicInterval(w));

/** Converte um instante real em data do jogo, pelo relógio deste mundo (season.config.clock). */
const dataDoJogo = (w: World, real: number) =>
  w.season.startedAt + realToGame(w, real - w.season.startedAt);
const realDoJogo = (w: World, jogo: number) =>
  w.season.startedAt + gameToReal(w, jogo - w.season.startedAt);

/** "Dia 6 · 14h" contados desde o início da temporada, em horas do jogo. */
export function relogio(w: World) {
  const jogo = dataDoJogo(w, agoraDoMundo(w));
  const dia = Math.floor((jogo - w.season.startedAt) / DAY_MS) + 1;
  const data = new Date(jogo);
  return { dia, hora: data.getUTCHours(), semana: weekdayNames[data.getUTCDay()] };
}

/** Instante real em que começou o dia corrente do jogo (meia-noite do jogo). */
export function comecoDoDia(w: World) {
  const jogo = dataDoJogo(w, agoraDoMundo(w));
  return realDoJogo(w, jogo - (jogo % DAY_MS));
}

/** Duração real em horas do jogo, para textos como "7 h de jogo". */
export const horasDeJogo = (w: World, realMs: number) =>
  Math.round(realToGame(w, realMs) / HOUR_MS);

/**
 * Dinheiro da empresa numa só passada pelo histórico. Vendas são sempre "vendas" (loja e para
 * outras empresas); gastos separam a mercadoria comprada, que é estoque e não prejuízo.
 * Hoje = desde a meia-noite do jogo, em todas as telas.
 */
export function resumoDoCaixa(w: World, empresa: string, desde: number) {
  const hoje = comecoDoDia(w);
  const semana = hoje - 6 * gameDay(w);
  const r = {
    vendas: 0,
    gastos: 0,
    mercadoria: 0,
    vendasHoje: 0,
    porDia: [0, 0, 0, 0, 0, 0, 0],
    porNegocioHoje: new Map<string, number>(),
  };
  for (const l of w.ledger) {
    if (l.from === l.to) continue;
    if (l.to === empresa && (l.kind === 'retail' || l.kind === 'trade')) {
      if (l.at >= desde) r.vendas += l.amount;
      if (l.at >= semana)
        r.porDia[Math.min(6, Math.floor((l.at - semana) / gameDay(w)))] += l.amount;
      if (l.at >= hoje) {
        r.vendasHoje += l.amount;
        if (l.establishmentId)
          r.porNegocioHoje.set(
            l.establishmentId,
            (r.porNegocioHoje.get(l.establishmentId) ?? 0) + l.amount,
          );
      }
    } else if (l.from === empresa && l.at >= desde) {
      r.gastos += l.amount;
      if (l.kind === 'trade') r.mercadoria += l.amount;
    }
  }
  return r;
}

/** Resumo recalculado só quando o mundo muda de revisão. */
export function useResumoDoCaixa(desde: number) {
  const { world, actor } = useGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resumoDoCaixa(world, actor, desde), [world.revision, actor, desde]);
}

const chaveDaVisita = (w: World, empresa: string) => `aftermarket.visto.${w.season.id}.${empresa}`;

// Lida uma vez por carga da página: trocar de tela não apaga o resumo da ausência.
const primeiraLeitura = new Map<string, number | null>();
function lerVisita(chave: string) {
  if (!primeiraLeitura.has(chave)) {
    let salvo: number | null = null;
    try {
      const n = Number(localStorage.getItem(chave));
      salvo = Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      salvo = null;
    }
    primeiraLeitura.set(chave, salvo);
  }
  return primeiraLeitura.get(chave)!;
}

/** Grava a visita enquanto o jogador joga, em qualquer tela. Fica na moldura do jogo. */
export function useMarcarVisita() {
  const { world, actor } = useGame();
  const chave = chaveDaVisita(world, actor);
  lerVisita(chave); // guarda a visita anterior antes de sobrescrever
  const agora = agoraDoMundo(world);
  useEffect(() => {
    try {
      localStorage.setItem(chave, String(agora));
    } catch {
      /* sem armazenamento: o resumo usa as últimas 24 h de jogo */
    }
  }, [chave, agora]);
}

/** Desde quando o jogador está fora, pela visita anterior a esta sessão. */
export function useAusencia() {
  const { world, actor } = useGame();
  const desde = lerVisita(chaveDaVisita(world, actor));
  const agora = agoraDoMundo(world);
  // Ausência curta (ou primeira visita) vira "hoje", o mesmo período da barra de cima e dos negócios.
  const fora = desde !== null && agora - desde >= gameDay(world) / 6 ? desde : null;
  return { desde: fora ?? comecoDoDia(world), ausente: fora !== null, agora };
}
