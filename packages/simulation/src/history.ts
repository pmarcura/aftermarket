import { GAME_DAY } from './operations';
import { regionsOf } from './metrics';
import type { Entry, Job, Shipment, World } from './model';

// Histórico resumido (etapa C): registros com mais de `keepDays` dias de jogo saem do mundo
// salvo e vão para o arquivo do banco, sem apagar nada. O mundo guarda os totais desses
// registros para que "desde a abertura" e os totais de atacado continuem certos.
export interface HistoryBaseline {
  archivedUntil: number;
  trade: Record<string, Record<string, { tradedQuantity: number; tradedValue: number }>>;
  companies: Record<string, Partial<Record<Entry['kind'], { in: number; out: number }>>>;
  retail: Record<string, number>;
}
export function emptyBaseline(): HistoryBaseline {
  return { archivedUntil: 0, trade: {}, companies: {}, retail: {} };
}
export function archiveHistory(w: World, now: number, keepDays: number) {
  const cutoff = now - GAME_DAY * keepDays;
  const base = (w.history ??= emptyBaseline());
  const states = new Map(regionsOf(w).map((r) => [r.id, r.state]));
  const ledger: Entry[] = [];
  const keep: Entry[] = [];
  for (const l of w.ledger) (l.at < cutoff ? ledger : keep).push(l);
  for (const l of ledger) {
    const from = (base.companies[l.from] ??= {});
    const to = (base.companies[l.to] ??= {});
    (from[l.kind] ??= { in: 0, out: 0 }).out += l.amount;
    (to[l.kind] ??= { in: 0, out: 0 }).in += l.amount;
    if (l.kind === 'retail' && l.establishmentId)
      base.retail[l.establishmentId] = (base.retail[l.establishmentId] ?? 0) + l.amount;
    if (l.product && l.channel === 'wholesale') {
      const state = states.get(l.regionId ?? '');
      for (const scope of ['', ...(state ? [l.regionId!, `state:${state}`] : [])]) {
        const totals = ((base.trade[l.product] ??= {})[scope] ??= {
          tradedQuantity: 0,
          tradedValue: 0,
        });
        totals.tradedQuantity += l.quantity ?? 0;
        totals.tradedValue += l.amount;
      }
    }
  }
  const jobs: Job[] = w.jobs.filter((j) => j.completed && j.finishesAt < cutoff);
  const shipments: Shipment[] = w.shipments.filter((s) => s.delivered && s.arrivesAt < cutoff);
  if (!ledger.length && !jobs.length && !shipments.length) return { ledger, jobs, shipments };
  w.ledger = keep;
  const oldJobs = new Set(jobs),
    oldShipments = new Set(shipments);
  w.jobs = w.jobs.filter((j) => !oldJobs.has(j));
  w.shipments = w.shipments.filter((s) => !oldShipments.has(s));
  base.archivedUntil = cutoff;
  return { ledger, jobs, shipments };
}
