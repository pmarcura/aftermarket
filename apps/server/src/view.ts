import { economyHealth } from '../../../packages/simulation/src/design';
import { tradeTotalsByScope } from '../../../packages/simulation/src/metrics';
import { GAME_DAY } from '../../../packages/simulation/src/operations';
import { simplifyPath } from '../../../packages/simulation/src/geometry';
import {
  seasonProducts,
  type Entry,
  type Position,
  type World,
  type WorldViewSummary,
} from '../../../packages/simulation/src/model';

// Pacote que o navegador recebe. O mundo completo cresce sem parar (extrato, lotes, entregas e
// estradas inteiras: 28 MB aos 30 dias); aqui vai só o que as telas do jogador usam, com os
// totais desde a abertura calculados no servidor.
export const VIEW_LEDGER_DAYS = 7;
const RECENT_DAYS = 2;
const MAX_LEDGER = 4000;
// Desvio máximo do desenho: 10 m ficam abaixo de 2 pixels no zoom de rua e cortam 58% do
// pacote em relação a 2 m (medido no mundo principal, D-036). As pontas são sempre preservadas.
const ROUTE_TOLERANCE_M = 10;
const OTHERS_LIMIT = 150;

// Cache de rotas e trajetos contratados substitui arrays, nunca edita seus pontos. Reutiliza o
// desenho entre jogadores/revisões e deixa o GC liberar trajetos que saíram do mundo.
const mapPaths = new WeakMap<Position[], Position[]>();
function mapPath(path: Position[]) {
  let simplified = mapPaths.get(path);
  if (!simplified) {
    simplified = simplifyPath(path, ROUTE_TOLERANCE_M);
    mapPaths.set(path, simplified);
  }
  return simplified;
}

// Indicadores que não dependem do jogador: calculados uma vez por revisão do mundo.
const shared = new WeakMap<
  World,
  { revision: number; trade: WorldViewSummary['tradeTotals']; health: WorldViewSummary['health'] }
>();
function sharedSummary(w: World) {
  const cached = shared.get(w);
  if (cached && cached.revision === w.revision) return cached;
  const health: WorldViewSummary['health'] = { '': economyHealth(w) };
  for (const product of seasonProducts(w)) health[product] = economyHealth(w, w.updatedAt, product);
  const next = { revision: w.revision, trade: tradeTotalsByScope(w), health };
  shared.set(w, next);
  return next;
}

// O extrato só recebe registros no fim e em ordem de tempo (com pequenas inversões entre
// comando e rodada); lê de trás para frente com um dia de folga.
function recentEntries(ledger: Entry[], since: number, keep: (l: Entry) => boolean) {
  const out: Entry[] = [];
  for (let i = ledger.length - 1; i >= 0; i--) {
    const l = ledger[i];
    if (l.at < since - GAME_DAY) break;
    if (l.at >= since && keep(l)) out.push(l);
  }
  return out.reverse();
}

export function worldView(w: World, actor: string): World {
  const now = w.updatedAt,
    recent = now - GAME_DAY * RECENT_DAYS;
  const mine = (l: Entry) => l.from === actor || l.to === actor;
  const ledger = recentEntries(w.ledger, now - GAME_DAY * VIEW_LEDGER_DAYS, mine).slice(
    -MAX_LEDGER,
  );
  const units = new Set(w.establishments.filter((e) => e.companyId === actor).map((e) => e.id));
  const properties = new Set(w.properties.filter((p) => p.ownerId === actor).map((p) => p.id));
  // Começa pelos totais do histórico arquivado e soma o extrato que ainda está no mundo.
  const totals: WorldViewSummary['totals'] = structuredClone(w.history?.companies[actor] ?? {});
  const retailByEstablishment: Record<string, number> = Object.fromEntries(
    Object.entries(w.history?.retail ?? {}).filter(([id]) => units.has(id)),
  );
  for (const l of w.ledger) {
    if (l.to === actor) (totals[l.kind] ??= { in: 0, out: 0 }).in += l.amount;
    if (l.from === actor) (totals[l.kind] ??= { in: 0, out: 0 }).out += l.amount;
    if (l.kind === 'retail' && l.establishmentId && units.has(l.establishmentId))
      retailByEstablishment[l.establishmentId] =
        (retailByEstablishment[l.establishmentId] ?? 0) + l.amount;
  }
  // Com centenas de bots: tudo o que é do jogador, e dos outros só as últimas OTHERS_LIMIT
  // movimentações (painel de concorrentes e mapa de rotas).
  const involved = (s: World['shipments'][number]) =>
    s.buyerId === actor || s.sellerId === actor || s.carrierId === actor;
  const shipments = [
    ...w.shipments.filter((s) => involved(s) && (!s.delivered || s.arrivesAt >= recent)),
    ...w.shipments.filter((s) => !involved(s) && !s.delivered).slice(-OTHERS_LIMIT),
  ];
  const usedPaths = new Set(
    shipments.flatMap((s) => [s.routeKey, s.mapRouteKey].filter(Boolean) as string[]),
  );
  // Estradas: resumo de todas (distância e duração entram no cálculo do frete), desenho só das
  // que tocam um imóvel do jogador, com desvio máximo de ROUTE_TOLERANCE_M, mesmo em trajetos longos.
  const routes = Object.fromEntries(
    Object.entries(w.routes).map(([key, route]) => {
      const [origin, destination] = key.split(':');
      const draw = properties.has(origin) || properties.has(destination) || usedPaths.has(key);
      return [key, { ...route, coordinates: draw ? mapPath(route.coordinates) : [] }];
    }),
  );
  const roadPaths = Object.fromEntries(
    Object.entries(w.roadPaths ?? {})
      .filter(([key]) => usedPaths.has(key))
      .map(([key, path]) => [key, mapPath(path)]),
  );
  const common = sharedSummary(w);
  return {
    ...w,
    // Política de abastecimento é configuração privada; as telas só usam a do próprio jogador.
    establishments: w.establishments.map((e) =>
      e.companyId === actor || !e.supplyPolicy ? e : { ...e, supplyPolicy: undefined },
    ),
    ledger,
    jobs: [
      ...w.jobs.filter(
        (j) => units.has(j.establishmentId) && (!j.completed || j.finishesAt >= recent),
      ),
      ...w.jobs.filter((j) => !units.has(j.establishmentId) && !j.completed).slice(-OTHERS_LIMIT),
    ],
    shipments,
    orders: w.orders.filter(
      (o) =>
        o.status === 'pending' ||
        ((o.buyerId === actor || o.sellerId === actor) &&
          (o.status === 'accepted' || o.createdAt >= recent)),
    ),
    consumptionHistory: w.consumptionHistory.filter(
      (h) => h.at >= recent && units.has(h.establishmentId),
    ),
    supplyHistory: (w.supplyHistory ?? []).filter(
      (h) => h.at >= recent && units.has(h.establishmentId),
    ),
    infrastructure: w.infrastructure.filter(
      (c) => c.status === 'open' || c.status === 'delivering' || c.createdAt >= recent,
    ),
    botActivity: (w.botActivity ?? []).slice(-200),
    marketHistory: w.marketHistory.slice(-220),
    routes,
    roadPaths,
    view: {
      actor,
      ledgerDays: VIEW_LEDGER_DAYS,
      totals,
      retailByEstablishment,
      tradeTotals: common.trade,
      health: common.health,
    },
  };
}
