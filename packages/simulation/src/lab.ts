import type { SeasonConfig } from './calibration';
import { arrears, economyHealth, outstandingLoans } from './design';
import { advance } from './engine';
import { marketView, withAppendOnlyMarketLedger } from './metrics';
import { products, TIME_SCALE, type ProductId, type World, seasonProducts } from './model';
import { GAME_DAY, treasuryReserved } from './operations';
import { createScenario, type ScenarioName } from './scenarios';
import { withDecisionTrace } from './decision-trace';
import {
  applyLabOpening,
  applyLabShock,
  type LabExperimentSettings,
  type LabExperimentLog,
} from './lab-experiments';
import { LabTraceCollector, type LabBotTrace, type LabTraceBucket } from './lab-telemetry';
export type { LabTraceBucket } from './lab-telemetry';
export type { LabPolicy, LabSeedMode, LabShock } from './lab-experiments';

export const labScenarios = ['baseline', 'starter', 'low-demand'] as const;
export interface LabOptions extends LabExperimentSettings {
  scenario: ScenarioName;
  seed: number;
  days: number;
  demandMultiplier: number;
}
export interface LabProgress {
  day: number;
  days: number;
  percent: number;
}
export interface LabHooks {
  onProgress?: (progress: LabProgress) => void;
  signal?: AbortSignal;
  shouldCancel?: () => boolean;
}
export interface LabAction {
  day: number;
  kind: string;
  text: string;
}
export interface LabBotSnapshot extends LabBotTrace {
  id: string;
  name: string;
  cohort: 'rivals' | 'original';
  strategy: string;
  balance: number;
  active: number;
  paused: number;
  establishments: number;
  obligations: number;
  outstandingPrincipal: number;
  decisions: number;
  decisionKinds: Record<string, number>;
  lastActions: LabAction[];
}
export interface LabItemSnapshot {
  id: ProductId;
  name: string;
  unit: string;
  price: number | null;
  offered: number;
  physical: number;
  tradedQuantity: number;
  tradedValue: number;
  coverageDays: number | null;
  suppliers: number;
  hhi: number | null;
  withoutOffers: boolean;
  produced: number;
  productionInputs: number;
  householdConsumption: number;
  publicConsumption: number;
  inTransit: number;
  committedOutput: number;
  physicalBalanceDifference: number;
}
export interface LabSnapshot {
  day: number;
  at: number;
  money: number;
  moneyConserved: boolean;
  health: ReturnType<typeof economyHealth>;
  healthWindow: {
    requestedStartAt: number;
    consumptionStartAt: number | null;
    consumptionHistoryLimited: boolean;
  };
  items: LabItemSnapshot[];
  bots: LabBotSnapshot[];
  shipments: number;
  delivered: number;
  completedJobs: number;
  pendingOrders: number;
  principal: number;
  treasuryReserved: number;
  infrastructureSpent: number;
}
export interface LabAlert {
  code: string;
  severity: 'warning' | 'info';
  message: string;
  productId?: ProductId;
  companyId?: string;
}
export interface LabSummary {
  moneyConserved: boolean;
  activeBotsAtStart: number;
  activeBotsAtEnd: number;
  obligationsChange: number;
  productTrends: {
    id: ProductId;
    priceChangePercent: number | null;
    daysWithoutOffers: number;
    longestShortageDays: number;
    finalHhi: number | null;
  }[];
  cohorts: {
    strategy: string;
    bots: number;
    activeBots: number;
    initialBalance: number;
    finalBalance: number;
    obligations: number;
    decisions: number;
  }[];
  alerts: LabAlert[];
}
export interface LabReport {
  schemaVersion: 2;
  options: LabOptions;
  metadata: {
    engineVersion: string;
    simulationStartedAt: number;
    timeScale: number;
    currency: 'BRL';
    moneyUnit: 'centavos';
    routingMode: 'estimate';
    humanActions: false;
    seedMeaning: string;
    config: SeasonConfig;
    metricNotes: string[];
    experiment: LabExperimentLog;
    replay: { options: LabOptions };
    sourceFingerprint?: string;
  };
  observations: LabSnapshot[];
  trace: LabTraceBucket[];
  summary: LabSummary;
  performance: {
    elapsedMs: number;
    simulatedDaysPerSecond: number;
  };
}

/** Validate at both CLI and worker boundaries; no coercion hides malformed requests. */
export function validateLabOptions(input: unknown = {}): LabOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('As opções do laboratório devem ser um objeto.');
  const record = input as Record<string, unknown>;
  const allowed = new Set([
    'scenario',
    'seed',
    'days',
    'demandMultiplier',
    'costMultiplier',
    'capacityMultiplier',
    'freightMultiplier',
    'botPolicy',
    'seedMode',
    'shock',
    'capacityRecipe',
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key)))
    throw new Error('Opção de laboratório desconhecida.');
  const options = {
    scenario: record.scenario === undefined ? 'baseline' : record.scenario,
    seed: record.seed === undefined ? 0 : record.seed,
    days: record.days === undefined ? 30 : record.days,
    demandMultiplier: record.demandMultiplier === undefined ? 1 : record.demandMultiplier,
    costMultiplier: record.costMultiplier === undefined ? 1 : record.costMultiplier,
    capacityMultiplier: record.capacityMultiplier === undefined ? 1 : record.capacityMultiplier,
    freightMultiplier: record.freightMultiplier === undefined ? 1 : record.freightMultiplier,
    botPolicy: record.botPolicy === undefined ? 'mixed' : record.botPolicy,
    seedMode: record.seedMode === undefined ? 'rotation' : record.seedMode,
    ...(record.shock === undefined ? {} : { shock: record.shock }),
    ...(record.capacityRecipe === undefined ? {} : { capacityRecipe: record.capacityRecipe }),
  };
  if (!labScenarios.includes(options.scenario as ScenarioName))
    throw new Error('Cenário inválido: use baseline, starter ou low-demand.');
  if (
    !Number.isSafeInteger(options.seed) ||
    Number(options.seed) < 0 ||
    Number(options.seed) > 10000
  )
    throw new Error('A semente deve ser um inteiro de 0 a 10000.');
  if (!Number.isInteger(options.days) || Number(options.days) < 1 || Number(options.days) > 365)
    throw new Error('A duração deve ser um inteiro de 1 a 365 dias.');
  if (
    typeof options.demandMultiplier !== 'number' ||
    !Number.isFinite(options.demandMultiplier) ||
    options.demandMultiplier < 0.1 ||
    options.demandMultiplier > 2
  )
    throw new Error('O multiplicador de demanda deve ficar entre 0,1 e 2.');
  for (const key of ['costMultiplier', 'capacityMultiplier', 'freightMultiplier'] as const) {
    if (
      typeof options[key] !== 'number' ||
      !Number.isFinite(options[key]) ||
      options[key] < 0.25 ||
      options[key] > 3
    )
      throw new Error(`${key}: use um fator entre 0,25 e 3.`);
  }
  if (!['mixed', 'regional', 'quality', 'value'].includes(String(options.botPolicy)))
    throw new Error('Política de bots inválida.');
  if (!['rotation', 'conditions'].includes(String(options.seedMode)))
    throw new Error('Modo de semente inválido.');
  if (options.shock !== undefined) {
    if (!options.shock || typeof options.shock !== 'object' || Array.isArray(options.shock))
      throw new Error('Choque deve ser um objeto.');
    const shock = options.shock as Record<string, unknown>;
    if (
      Object.keys(shock).some((key) => !['day', 'type', 'multiplier'].includes(key)) ||
      !Number.isInteger(shock.day) ||
      Number(shock.day) < 1 ||
      Number(shock.day) > Number(options.days) ||
      !['demand', 'freight', 'cost'].includes(String(shock.type)) ||
      typeof shock.multiplier !== 'number' ||
      !Number.isFinite(shock.multiplier) ||
      shock.multiplier < 0.25 ||
      shock.multiplier > 3
    )
      throw new Error(
        'Choque inválido: dia dentro do horizonte, tipo demand/freight/cost e fator de 0,25 a 3.',
      );
  }
  if (
    options.capacityRecipe !== undefined &&
    (typeof options.capacityRecipe !== 'string' ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(options.capacityRecipe))
  )
    throw new Error('Receita alvo inválida.');
  return options as LabOptions;
}

function checkCancelled(hooks: LabHooks) {
  if (hooks.signal?.aborted || hooks.shouldCancel?.()) {
    const error = new Error('Simulação cancelada.');
    error.name = 'AbortError';
    throw error;
  }
}

function checkInvariants(world: World, openingMoney: number, day: number, at?: number) {
  const money = world.companies.reduce((sum, company) => sum + company.balance, 0);
  if (
    !Number.isSafeInteger(money) ||
    money !== openingMoney ||
    world.companies.some((company) => !Number.isSafeInteger(company.balance) || company.balance < 0)
  )
    throw new Error(`Invariante monetário violado no dia ${day}.`);
  if (
    world.establishments.some((establishment) =>
      Object.values(establishment.inventory).some(
        (quantity) => quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0),
      ),
    )
  )
    throw new Error(`Invariante de estoque violado no dia ${day}.`);
  if (
    (world.obligations ?? []).some(
      (obligation) =>
        !Number.isSafeInteger(obligation.amount) ||
        !Number.isSafeInteger(obligation.paid) ||
        obligation.paid < 0 ||
        obligation.paid > obligation.amount,
    ) ||
    (world.loans ?? []).some(
      (loan) =>
        !Number.isSafeInteger(loan.principal) ||
        !Number.isSafeInteger(loan.repaid) ||
        loan.repaid < 0 ||
        loan.repaid > loan.principal,
    )
  )
    throw new Error(`Invariante de obrigação ou principal violado no dia ${day}.`);
  if (
    at !== undefined &&
    (world.nextEconomicAt <= at ||
      world.shipments.some((shipment) => !shipment.delivered && shipment.arrivesAt <= at) ||
      world.jobs.some((job) => !job.completed && job.finishesAt <= at) ||
      (world.training ?? []).some((training) => !training.completed && training.finishesAt <= at))
  )
    throw new Error(
      `Eventos vencidos ainda não processados no dia ${day}; resultado interrompido.`,
    );
  return money;
}

type BotTelemetry = {
  decisions: number;
  decisionKinds: Record<string, number>;
  lastActions: LabAction[];
};

function snapshot(
  world: World,
  day: number,
  at: number,
  openingMoney: number,
  telemetry: Map<string, BotTelemetry>,
  traces: LabTraceCollector,
  openingPhysical: Partial<Record<ProductId, number>>,
): LabSnapshot {
  const money = checkInvariants(world, openingMoney, day, at);
  const since = Math.max(world.createdAt, at - GAME_DAY * 7);
  // Same product unit within each market; company grouping prevents counting branches as competitors.
  const salesByProduct = new Map<ProductId, Map<string, number>>();
  const flow = new Map(
    seasonProducts(world).map((id) => [
      id,
      {
        produced: 0,
        productionInputs: 0,
        householdConsumption: 0,
        inTransit: 0,
        committedOutput: 0,
      },
    ]),
  );
  const recipes = new Map(world.season.config.recipes.map((recipe) => [recipe.id, recipe]));
  for (const job of world.jobs) {
    const recipe = recipes.get(job.recipeId)!;
    for (const [id, quantity] of Object.entries(recipe.input) as [ProductId, number][])
      flow.get(id)!.productionInputs += quantity * job.cycles;
    const output =
      job.output ??
      Object.fromEntries(
        Object.entries(recipe.output).map(([id, quantity]) => [id, quantity! * job.cycles]),
      );
    for (const [id, quantity] of Object.entries(output) as [ProductId, number][])
      flow.get(id)![job.completed ? 'produced' : 'committedOutput'] += quantity;
  }
  for (const shipment of world.shipments)
    if (!shipment.delivered) flow.get(shipment.product)!.inTransit += shipment.quantity;
  for (const entry of world.ledger) {
    if (entry.product && entry.kind === 'retail' && entry.channel === 'retail')
      flow.get(entry.product)!.householdConsumption += entry.quantity ?? 0;
    if (
      entry.at < since ||
      entry.at > at ||
      !entry.product ||
      !['trade', 'retail'].includes(entry.kind) ||
      entry.channel === 'internal' ||
      entry.from === entry.to
    )
      continue;
    const sales = salesByProduct.get(entry.product) ?? new Map<string, number>();
    sales.set(entry.to, (sales.get(entry.to) ?? 0) + entry.amount);
    salesByProduct.set(entry.product, sales);
  }
  return {
    day,
    at,
    money,
    moneyConserved: money === openingMoney,
    health: economyHealth(world, at),
    healthWindow: {
      requestedStartAt: since,
      consumptionStartAt: world.consumptionHistory.find((entry) => entry.at >= since)?.at ?? null,
      consumptionHistoryLimited:
        world.consumptionHistory.length >= 20000 &&
        (world.consumptionHistory[0]?.at ?? since) > since,
    },
    items: seasonProducts(world).map((id) => {
      const market = marketView(world, id);
      const sales = [...(salesByProduct.get(id)?.values() ?? [])];
      const total = sales.reduce((sum, value) => sum + value, 0);
      const physical = world.establishments.reduce((sum, e) => sum + (e.inventory[id] ?? 0), 0);
      const itemFlow = flow.get(id)!;
      const publicConsumption = world.consumedMaterials[id] ?? 0;
      return {
        id,
        name: products[id].name,
        unit: products[id].unit,
        price: market.price,
        offered: market.stock,
        physical,
        ...itemFlow,
        publicConsumption,
        physicalBalanceDifference:
          physical +
          itemFlow.inTransit -
          ((openingPhysical[id] ?? 0) +
            itemFlow.produced -
            itemFlow.productionInputs -
            itemFlow.householdConsumption -
            publicConsumption),
        tradedQuantity: market.tradedQuantity,
        tradedValue: market.tradedValue,
        coverageDays: market.coverageDays,
        suppliers: market.suppliers,
        hhi: total ? sales.reduce((sum, value) => sum + (value / total) ** 2 * 10000, 0) : null,
        withoutOffers: market.stock <= 0,
      };
    }),
    bots: world.companies
      .filter(
        (company) =>
          company.bot && company.id !== 'consumers' && !company.id.startsWith('treasury'),
      )
      .map((company) => {
        const establishments = world.establishments.filter((e) => e.companyId === company.id);
        const activity = telemetry.get(company.id);
        return {
          ...traces.snapshot(company.id),
          id: company.id,
          name: company.name,
          cohort: company.id.startsWith('rival-') ? 'rivals' : 'original',
          strategy: company.strategy ?? 'original',
          balance: company.balance,
          active: establishments.filter((e) => e.enabled).length,
          paused: establishments.filter((e) => !e.enabled).length,
          establishments: establishments.length,
          obligations: arrears(world, company.id),
          outstandingPrincipal: outstandingLoans(world, company.id),
          decisions: activity?.decisions ?? 0,
          decisionKinds: { ...activity?.decisionKinds },
          lastActions: activity?.lastActions.map((action) => ({ ...action })) ?? [],
        };
      }),
    shipments: world.shipments.length,
    delivered: world.shipments.filter((shipment) => shipment.delivered).length,
    completedJobs: world.jobs.filter((job) => job.completed).length,
    pendingOrders: world.orders.filter((order) => order.status === 'pending').length,
    principal: world.companies.reduce(
      (sum, company) => sum + outstandingLoans(world, company.id),
      0,
    ),
    treasuryReserved: treasuryReserved(world),
    infrastructureSpent: world.infrastructure.reduce(
      (sum, contract) => sum + (contract.paid ?? 0),
      0,
    ),
  };
}

function summarize(observations: LabSnapshot[], activityLimited: boolean): LabSummary {
  const first = observations[0];
  const last = observations.at(-1)!;
  const alerts: LabAlert[] = [];
  const productTrends = first.items.map((item) => {
    const final = last.items.find((row) => row.id === item.id)!;
    let daysWithoutOffers = 0;
    let longestShortageDays = 0;
    let streak = 0;
    for (const observation of observations.slice(1)) {
      if (observation.items.find((row) => row.id === item.id)!.withoutOffers) {
        daysWithoutOffers++;
        streak++;
        longestShortageDays = Math.max(longestShortageDays, streak);
      } else streak = 0;
    }
    if (daysWithoutOffers)
      alerts.push({
        code: 'no-offers',
        severity: 'warning',
        productId: item.id,
        message: `${item.name}: sem oferta em ${daysWithoutOffers} amostras diárias; maior sequência ${longestShortageDays} dias.`,
      });
    if (final.hhi !== null && final.hhi > 2500)
      alerts.push({
        code: 'concentration',
        severity: 'warning',
        productId: item.id,
        message: `${item.name}: HHI de receita acima de 2.500 na janela final de até sete dias (heurística de triagem do laboratório).`,
      });
    return {
      id: item.id,
      priceChangePercent:
        item.price !== null && item.price > 0 && final.price !== null
          ? (final.price / item.price - 1) * 100
          : null,
      daysWithoutOffers,
      longestShortageDays,
      finalHhi: final.hhi,
    };
  });
  const activeBotsAtStart = first.bots.filter((bot) => bot.active > 0).length;
  const activeBotsAtEnd = last.bots.filter((bot) => bot.active > 0).length;
  if (activeBotsAtEnd < activeBotsAtStart)
    alerts.push({
      code: 'bot-inactivity',
      severity: 'warning',
      message: `${activeBotsAtStart - activeBotsAtEnd} bots a menos com ao menos uma unidade ativa ao final; atividade não equivale a solvência.`,
    });
  if (last.health.obligations > first.health.obligations)
    alerts.push({
      code: 'arrears-growth',
      severity: 'warning',
      message:
        'Obrigações não pagas cresceram. Inspecione caixa e dívida dos bots antes de alterar parâmetros.',
    });
  if (observations.some((observation) => observation.healthWindow.consumptionHistoryLimited))
    alerts.push({
      code: 'consumption-retention',
      severity: 'info',
      message:
        'O histórico de consumo atingiu a retenção de 20.000 registros; atendimento pode cobrir menos de sete dias. Consulte healthWindow.',
    });
  if (activityLimited)
    alerts.push({
      code: 'activity-retention',
      severity: 'info',
      message:
        'Um tick atingiu a retenção de 1.000 ações do diretor; contagens de decisões podem estar incompletas.',
    });
  return {
    moneyConserved: observations.every((observation) => observation.moneyConserved),
    activeBotsAtStart,
    activeBotsAtEnd,
    obligationsChange: last.health.obligations - first.health.obligations,
    productTrends,
    cohorts: [...new Set(last.bots.map((bot) => bot.strategy))].map((strategy) => {
      const bots = last.bots.filter((bot) => bot.strategy === strategy);
      return {
        strategy,
        bots: bots.length,
        activeBots: bots.filter((bot) => bot.active > 0).length,
        initialBalance: first.bots
          .filter((bot) => bot.strategy === strategy)
          .reduce((sum, bot) => sum + bot.balance, 0),
        finalBalance: bots.reduce((sum, bot) => sum + bot.balance, 0),
        obligations: bots.reduce((sum, bot) => sum + bot.obligations, 0),
        decisions: bots.reduce((sum, bot) => sum + bot.decisions, 0),
      };
    }),
    alerts,
  };
}

/**
 * Runs the actual economic commands in a new isolated world, without persistence or network.
 * Synchronous by design: use a Web Worker for UI work; terminate that worker for immediate cancellation.
 */
export function runLab(input: Partial<LabOptions> = {}, hooks: LabHooks = {}): LabReport {
  const options = validateLabOptions(input);
  checkCancelled(hooks);
  const started = performance.now();
  // A fixed epoch keeps A/B runs on the same weekdays. The seed rotates rival strategies.
  const at = Date.UTC(2026, 9, 26, 12);
  const world = createScenario(at, options.scenario, options.seed);
  if (
    options.capacityRecipe &&
    !world.season.config.recipes.some((r) => r.id === options.capacityRecipe)
  )
    throw new Error('Receita alvo não existe no cenário.');
  const experiment = applyLabOpening(world, options);
  const openingPhysical = Object.fromEntries(
    seasonProducts(world).map((id) => [
      id,
      world.establishments.reduce((sum, e) => sum + (e.inventory[id] ?? 0), 0),
    ]),
  );
  const traces = new LabTraceCollector(world, at);
  return withDecisionTrace(world, traces.observe, () =>
    withAppendOnlyMarketLedger(world, () => {
      const config = structuredClone(world.season.config);
      const openingMoney = world.companies.reduce((sum, company) => sum + company.balance, 0);
      const telemetry = new Map<string, BotTelemetry>();
      const observations = [
        snapshot(world, 0, at, openingMoney, telemetry, traces, openingPhysical),
      ];
      let activityLimited = false;
      hooks.onProgress?.({ day: 0, days: options.days, percent: 0 });
      for (let day = 1; day <= options.days; day++) {
        checkCancelled(hooks);
        const target = at + day * GAME_DAY;
        if (options.shock?.day === day)
          applyLabShock(world, options.shock, at + (day - 1) * GAME_DAY, experiment);
        // Capture at each economic tick, before the director's rolling activity history can be lost.
        while (world.nextEconomicAt <= target) {
          checkCancelled(hooks);
          const tickAt = world.nextEconomicAt;
          advance(world, tickAt);
          checkInvariants(world, openingMoney, day, tickAt);
          const activity = (world.botActivity ?? []).filter((action) => action.at === tickAt);
          if (activity.length >= 1000) activityLimited = true;
          for (const action of activity) {
            const stats = telemetry.get(action.companyId) ?? {
              decisions: 0,
              decisionKinds: {},
              lastActions: [],
            };
            stats.decisions++;
            stats.decisionKinds[action.kind] = (stats.decisionKinds[action.kind] ?? 0) + 1;
            stats.lastActions.push({
              day: (action.at - at) / GAME_DAY,
              kind: action.kind,
              // The director records only six UUID characters, which can collide.
              // Omit that ephemeral display reference instead of inventing identity.
              text: action.text.replace(/ao pedido #[a-f0-9]{6}\b/g, 'a um pedido do cenário'),
            });
            if (stats.lastActions.length > 3) stats.lastActions.shift();
            telemetry.set(action.companyId, stats);
          }
        }
        if (world.updatedAt < target) advance(world, target);
        observations.push(
          snapshot(world, day, target, openingMoney, telemetry, traces, openingPhysical),
        );
        hooks.onProgress?.({ day, days: options.days, percent: (day / options.days) * 100 });
      }
      checkCancelled(hooks);
      const summary = summarize(observations, activityLimited);
      const elapsedMs = performance.now() - started;
      return {
        schemaVersion: 2,
        options,
        metadata: {
          engineVersion: `world:${world.version}/operations:${world.operationsVersion}/competition:${world.competitionVersion}/design:${world.designVersion}/calibration:${config.version}`,
          simulationStartedAt: at,
          timeScale: TIME_SCALE,
          currency: 'BRL',
          moneyUnit: 'centavos',
          routingMode: 'estimate',
          humanActions: false,
          seedMeaning:
            options.seedMode === 'rotation'
              ? 'Rotação determinística das estratégias dos novos rivais; não representa uma amostra aleatória independente. Época fixa para comparar os mesmos dias da semana.'
              : 'Capital inaugural e orçamentos privados variam em ±15% por PRNG determinístico, além da rotação de estratégias; dinheiro conservado por transferências com famílias. Não representa uma população de jogadores humanos.',
          config,
          experiment,
          replay: { options: structuredClone(options) },
          metricNotes: [
            'Mundo novo isolado: nenhum banco ou serviço externo. Rotas são estimativas offline; nenhuma ação humana é injetada.',
            'Demanda é parâmetro simulado: demandMultiplier multiplica playableConsumerShare do cenário antes do primeiro tick; a configuração efetiva está anexada.',
            'Valores monetários em centavos inteiros. Estoque e quantidade respeitam a unidade de cada produto; não somar unidades heterogêneas.',
            'Preços e oferta são fotografias do fim do dia. Sem oferta não comprova demanda insatisfeita; dias de ruptura contam amostras diárias, sem o dia zero.',
            'tradedQuantity e tradedValue são acumulados do livro de atacado desde a abertura, sem limite de retenção atual. Remessas, entregas, jobs e ações são contagens acumuladas.',
            'HHI por produto usa receita de vendas entre empresas ou varejo, agrupada por vendedor, excluindo transferências internas, na janela de até sete dias. Sem vendas: null; escala 0 a 10.000.',
            'Saúde global reutiliza economyHealth: giro e HHI na janela de até sete dias. Atendimento usa histórico limitado a 20.000 registros; healthWindow informa quando a retenção encurta a janela.',
            'decisions/lastActions mantêm contagens do diretor. attempts/executed/rejected/blocked/idle e trace provêm do observador de comandos e gates instrumentados; idle não atribui causa inexistente. Trace agrupa por dia/empresa/fonte/resultado/ação/código e productId somente quando observado. Não cobre todos os ramos possíveis. Fragmentos efêmeros de UUID são omitidos.',
            'Experimentos alteram somente mundos novos: custo operacional, duração dos ciclos, componentes de frete e política. Choque aplica-se no início do dia declarado; config registra abertura e experiment.events registra intervenções. Termos já contratados não são reescritos.',
            'Atividade indica ao menos uma unidade enabled; não comprova lucro ou solvência. Estratégias são heurísticas programadas, não agentes LLM.',
            'Alertas e limiar HHI 2.500 são heurísticas de triagem do laboratório; conservação monetária não comprova balanceamento de uma temporada.',
          ],
        },
        observations,
        trace: traces.result(),
        summary,
        performance: {
          elapsedMs,
          simulatedDaysPerSecond: elapsedMs > 0 ? (options.days * 1000) / elapsedMs : 0,
        },
      };
    }),
  );
}
