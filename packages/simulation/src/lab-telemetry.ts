import type { ProductId, World } from './model';
import type { DecisionTrace } from './decision-trace';
import { GAME_DAY } from './operations';

export interface LabTraceBucket {
  day: number;
  companyId: string;
  source: DecisionTrace['source'];
  outcome: DecisionTrace['outcome'];
  action: string;
  code: string;
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
  establishmentIds: string[];
  productId?: ProductId;
}
export interface LabReason {
  source: DecisionTrace['source'];
  outcome: DecisionTrace['outcome'];
  code: string;
  message: string;
  count: number;
}
export interface LabBotTrace {
  attempts: number;
  executed: number;
  rejected: number;
  blocked: number;
  idle: number;
  reasonCounts: Record<string, number>;
  lastReasons: LabReason[];
}
type Counters = Omit<LabBotTrace, 'lastReasons'> & {
  reasons: Map<string, LabReason & { lastAt: number }>;
};
const stableText = (s: string) =>
  s
    .replace(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
      '[referência efêmera]',
    )
    .replace(/#[a-f0-9]{6}\b/gi, '#pedido');

/** Real observer events, grouped for fast queries without diagnosing unobserved causes. */
export class LabTraceCollector {
  private groups = new Map<string, LabTraceBucket>();
  private bots = new Map<string, Counters>();
  constructor(
    private world: World,
    private startAt: number,
  ) {}
  observe = (event: DecisionTrace) => {
    const day = Math.max(1, Math.ceil((event.at - this.startAt) / GAME_DAY));
    const productId = event.productId;
    const message = stableText(event.message),
      code = stableText(event.code);
    const key = JSON.stringify([
      day,
      event.companyId,
      event.source,
      event.outcome,
      event.action,
      code,
      productId,
    ]);
    let group = this.groups.get(key);
    if (!group) {
      group = {
        day,
        companyId: event.companyId,
        source: event.source,
        outcome: event.outcome,
        action: event.action,
        code,
        message,
        count: 0,
        firstAt: event.at,
        lastAt: event.at,
        establishmentIds: [],
        ...(productId ? { productId } : {}),
      };
      this.groups.set(key, group);
    }
    group.count++;
    group.lastAt = event.at;
    if (event.establishmentId) {
      const index = this.world.establishments.findIndex((e) => e.id === event.establishmentId);
      const id = /[a-f0-9]{8}-[a-f0-9]{4}/i.test(event.establishmentId)
        ? `establishment:${index}`
        : event.establishmentId;
      if (!group.establishmentIds.includes(id) && group.establishmentIds.length < 3)
        group.establishmentIds.push(id);
    }
    let stats = this.bots.get(event.companyId);
    if (!stats) {
      stats = {
        attempts: 0,
        executed: 0,
        rejected: 0,
        blocked: 0,
        idle: 0,
        reasonCounts: {},
        reasons: new Map(),
      };
      this.bots.set(event.companyId, stats);
    }
    stats[event.outcome]++;
    if (event.outcome === 'executed' || event.outcome === 'rejected') stats.attempts++;
    if (event.outcome !== 'executed') {
      stats.reasonCounts[code] = (stats.reasonCounts[code] ?? 0) + 1;
      const reasonKey = `${event.source}:${event.outcome}:${code}`;
      const reason = stats.reasons.get(reasonKey) ?? {
        source: event.source,
        outcome: event.outcome,
        code,
        message,
        count: 0,
        lastAt: event.at,
      };
      reason.count++;
      reason.lastAt = event.at;
      stats.reasons.set(reasonKey, reason);
    }
  };
  snapshot(companyId: string): LabBotTrace {
    const stats = this.bots.get(companyId);
    if (!stats)
      return {
        attempts: 0,
        executed: 0,
        rejected: 0,
        blocked: 0,
        idle: 0,
        reasonCounts: {},
        lastReasons: [],
      };
    return {
      attempts: stats.attempts,
      executed: stats.executed,
      rejected: stats.rejected,
      blocked: stats.blocked,
      idle: stats.idle,
      reasonCounts: { ...stats.reasonCounts },
      lastReasons: [...stats.reasons.values()]
        .sort((a, b) => b.lastAt - a.lastAt || b.count - a.count || a.code.localeCompare(b.code))
        .slice(0, 5)
        .map(({ lastAt: _lastAt, ...reason }) => ({ ...reason })),
    };
  }
  result() {
    return [...this.groups.values()];
  }
}
