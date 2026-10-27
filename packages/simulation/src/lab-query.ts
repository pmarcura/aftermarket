import type { LabReport } from './lab';
import type { DecisionOutcome, DecisionSource } from './decision-trace';

export interface LabQuery {
  day?: number;
  bot?: string;
  item?: string;
  outcome?: DecisionOutcome;
  source?: DecisionSource;
  search?: string;
  limit?: number;
  series?: boolean;
  allDays?: boolean;
}
const normalized = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
function matchOne<T extends { id: string; name: string }>(
  items: T[],
  query: string | undefined,
  kind: string,
) {
  if (!query) return undefined;
  const exact = items.find(
    (item) => item.id === query || normalized(item.name) === normalized(query),
  );
  if (exact) return exact;
  const found = items.filter((item) =>
    normalized(`${item.id} ${item.name}`).includes(normalized(query)),
  );
  if (found.length === 1) return found[0];
  throw new Error(
    found.length
      ? `${kind} ambíguo: ${found.map((item) => `${item.id} (${item.name})`).join(', ')}.`
      : `${kind} não encontrado: ${query}.`,
  );
}

/** Read-only bounded query. Filtering never invents missing product attribution. */
export function queryLabReport(report: LabReport, query: LabQuery = {}) {
  const day = query.day ?? report.options.days;
  if (!Number.isInteger(day) || day < 0 || day > report.options.days)
    throw Error(`Dia deve ficar entre 0 e ${report.options.days}.`);
  const limit = query.limit ?? 40;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw Error('Limite deve ficar entre 1 e 500 grupos.');
  if (query.outcome && !['executed', 'rejected', 'blocked', 'idle'].includes(query.outcome))
    throw Error('Resultado de decisão inválido.');
  if (query.source && !['director', 'production', 'supply', 'command'].includes(query.source))
    throw Error('Fonte de decisão inválida.');
  const observation = report.observations.find((row) => row.day === day)!;
  const bot = matchOne(observation.bots, query.bot, 'Bot');
  const item = matchOne(observation.items, query.item, 'Produto');
  const periodTrace = report.trace.filter(
    (event) => (query.allDays || event.day === day) && (!bot || event.companyId === bot.id),
  );
  const events = periodTrace
    .filter(
      (event) =>
        (!item || event.productId === item.id) &&
        (!query.outcome || event.outcome === query.outcome) &&
        (!query.source || event.source === query.source) &&
        (!query.search ||
          normalized(`${event.action} ${event.code} ${event.message}`).includes(
            normalized(query.search),
          )),
    )
    .sort((a, b) => b.lastAt - a.lastAt || b.count - a.count || a.code.localeCompare(b.code));
  const series = query.series
    ? report.observations.map((row) => ({
        day: row.day,
        ...(bot ? { bot: row.bots.find((entry) => entry.id === bot.id) } : {}),
        ...(item ? { item: row.items.find((entry) => entry.id === item.id) } : {}),
        ...(!bot && !item ? { health: row.health } : {}),
      }))
    : undefined;
  return {
    schemaVersion: 1,
    options: report.options,
    evidence: {
      sourceFingerprint: report.metadata.sourceFingerprint ?? null,
      moneyUnit: report.metadata.moneyUnit,
      routingMode: report.metadata.routingMode,
      eventPeriod: query.allDays ? 'all-days' : `day:${day}`,
      notes:
        'Bloqueios de candidatos select-source não provam inação de toda a empresa. Sem produto observado, nenhum evento é atribuído a um item. Contadores de bot são acumulados até o dia; eventos são do período indicado.',
    },
    snapshot: {
      day,
      at: observation.at,
      moneyConserved: observation.moneyConserved,
      ...(bot ? { bot } : { health: observation.health }),
      ...(item ? { item } : {}),
    },
    events: {
      matchingGroups: events.length,
      returnedGroups: Math.min(events.length, limit),
      observedEvents: events.reduce((n, event) => n + event.count, 0),
      withoutProductAttribution: item ? periodTrace.filter((event) => !event.productId).length : 0,
      groups: events.slice(0, limit),
    },
    ...(series ? { series } : {}),
    replay: report.metadata.replay,
  };
}
