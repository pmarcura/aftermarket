import { useEffect, useMemo } from 'react';
import { useGame } from '../../lib/game';
import {
  ECONOMIC_INTERVAL,
  TIME_SCALE,
  type World,
} from '../../../../../packages/simulation/src/model';
import { GAME_DAY, weekdayNames } from '../../../../../packages/simulation/src/operations';

const HORA_DO_JOGO = 3_600_000;

/** Instante real mais recente que o mundo já calculou. */
export const agoraDoMundo = (w: World) =>
  Math.max(w.updatedAt, w.nextEconomicAt - ECONOMIC_INTERVAL);

/** Converte um instante real em data do jogo (o relógio do jogo corre TIME_SCALE vezes mais rápido). */
const dataDoJogo = (w: World, real: number) =>
  w.season.startedAt + (real - w.season.startedAt) * TIME_SCALE;
const realDoJogo = (w: World, jogo: number) =>
  w.season.startedAt + (jogo - w.season.startedAt) / TIME_SCALE;

/** "Dia 6 · 14h" contados desde o início da temporada, em horas do jogo. */
export function relogio(w: World) {
  const jogo = dataDoJogo(w, agoraDoMundo(w));
  const dia = Math.floor((jogo - w.season.startedAt) / 86_400_000) + 1;
  const data = new Date(jogo);
  return { dia, hora: data.getUTCHours(), semana: weekdayNames[data.getUTCDay()] };
}

/** Instante real em que começou o dia corrente do jogo (meia-noite do jogo). */
export function comecoDoDia(w: World) {
  const jogo = dataDoJogo(w, agoraDoMundo(w));
  return realDoJogo(w, jogo - (jogo % 86_400_000));
}

/** Duração real em horas do jogo, para textos como "7 h de jogo". */
export const horasDeJogo = (realMs: number) => Math.round((realMs * TIME_SCALE) / HORA_DO_JOGO);

/**
 * Dinheiro da empresa numa só passada pelo histórico. Vendas são sempre "vendas" (loja e para
 * outras empresas); gastos separam a mercadoria comprada, que é estoque e não prejuízo.
 * Hoje = desde a meia-noite do jogo, em todas as telas.
 */
export function resumoDoCaixa(w: World, empresa: string, desde: number) {
  const hoje = comecoDoDia(w);
  const semana = hoje - 6 * GAME_DAY;
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
      if (l.at >= semana) r.porDia[Math.min(6, Math.floor((l.at - semana) / GAME_DAY))] += l.amount;
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
  const fora = desde !== null && agora - desde >= GAME_DAY / 6 ? desde : null;
  return { desde: fora ?? comecoDoDia(world), ausente: fora !== null, agora };
}
