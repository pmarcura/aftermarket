import type { World } from './model';
import { operatingCosts } from './metrics';

export type LabPolicy = 'mixed' | 'regional' | 'quality' | 'value';
export type LabSeedMode = 'rotation' | 'conditions';
export interface LabShock {
  day: number;
  type: 'demand' | 'freight' | 'cost';
  multiplier: number;
}
export interface LabExperimentSettings {
  costMultiplier: number;
  capacityMultiplier: number;
  freightMultiplier: number;
  botPolicy: LabPolicy;
  seedMode: LabSeedMode;
  capacityRecipe?: string;
  shock?: LabShock;
}
export interface LabExperimentLog {
  changes: string[];
  events: { day: number; type: LabShock['type']; multiplier: number; at: number }[];
}
const cents = (n: number, factor: number) => Math.max(0, Math.round(n * factor));
function costs(world: World, factor: number) {
  if (factor === 1) return;
  const cfg = world.season.config;
  cfg.parameters.minimumWage = cents(cfg.parameters.minimumWage, factor);
  for (const key of Object.keys(cfg.salaries) as (keyof typeof cfg.salaries)[]) {
    cfg.salaries[key] = cents(cfg.salaries[key], factor);
    cfg.maintenance[key] = cents(cfg.maintenance[key], factor);
  }
  for (const rate of Object.values(cfg.utilities)) {
    rate.electricity = cents(rate.electricity, factor);
    rate.water = cents(rate.water, factor);
  }
  for (const recipe of cfg.recipes) recipe.cost = cents(recipe.cost, factor);
  for (const e of world.establishments) e.dailyCost = operatingCosts(world, e).total;
}
function freight(world: World, factor: number) {
  if (factor === 1) return;
  const parameters = world.season.config.parameters;
  for (const key of [
    'dieselPerLiter',
    'maintenancePerKm',
    'driverPerHour',
    'estimatedTollPerKm',
  ] as const)
    parameters[key] = cents(parameters[key], factor);
}
function random(seed: number) {
  let state = (seed + 0x6d2b79f5) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lab-only opening configuration. Never called by store, migration, or a saved season. */
export function applyLabOpening(
  world: World,
  options: LabExperimentSettings & { seed: number; demandMultiplier: number },
): LabExperimentLog {
  const changes: string[] = [];
  world.season.config.parameters.playableConsumerShare *= options.demandMultiplier;
  if (options.demandMultiplier !== 1)
    changes.push(`Demanda familiar de abertura ×${options.demandMultiplier}.`);
  costs(world, options.costMultiplier);
  if (options.costMultiplier !== 1)
    changes.push(
      `Salários, manutenção, utilidades e processamento ×${options.costMultiplier}; preços dos itens e CAPEX preservados.`,
    );
  freight(world, options.freightMultiplier);
  if (options.freightMultiplier !== 1)
    changes.push(
      `Componentes monetários de frete ×${options.freightMultiplier}; mínimo comercial e prazos preservados.`,
    );
  if (options.capacityMultiplier !== 1) {
    for (const recipe of world.season.config.recipes.filter(
      (r) => !options.capacityRecipe || r.id === options.capacityRecipe,
    ))
      recipe.duration = Math.max(1, Math.round(recipe.duration / options.capacityMultiplier));
    changes.push(
      `Velocidade de produção ${options.capacityRecipe ?? 'de todas as receitas'} ×${options.capacityMultiplier}: duração dos ciclos dividida pelo fator, sem alterar quantidades, massa ou equipamento inaugural.`,
    );
  }
  const bots = world.companies.filter(
    (c) => c.bot && c.id !== 'consumers' && !c.id.startsWith('treasury'),
  );
  if (options.botPolicy !== 'mixed') {
    for (const bot of bots) bot.strategy = options.botPolicy;
    changes.push(`Política de todos os bots privados: ${options.botPolicy}.`);
  }
  if (options.seedMode === 'conditions') {
    const next = random(options.seed),
      families = world.companies.find((c) => c.id === 'consumers')!;
    for (const bot of bots) {
      const desired = Math.round(bot.balance * (0.85 + next() * 0.3));
      const difference = desired - bot.balance;
      const amount = Math.min(
        Math.abs(difference),
        difference > 0 ? families.balance : bot.balance,
      );
      if (amount) {
        const from = difference > 0 ? families : bot,
          to = difference > 0 ? bot : families;
        from.balance -= amount;
        to.balance += amount;
        world.ledger.push({
          id: crypto.randomUUID(),
          at: world.createdAt,
          from: from.id,
          to: to.id,
          amount,
          kind: 'budget',
          description: 'Condição inaugural simulada: redistribuição de capital, sem emissão',
        });
      }
      for (const e of world.establishments.filter((e) => e.companyId === bot.id)) {
        if (e.automationDailyBudget !== undefined)
          e.automationDailyBudget = Math.max(
            1,
            Math.round(e.automationDailyBudget * (0.85 + next() * 0.3)),
          );
        if (e.supplyPolicy) {
          e.supplyPolicy.dailyBudget = Math.max(
            1,
            Math.round(e.supplyPolicy.dailyBudget * (0.85 + next() * 0.3)),
          );
          e.supplyPolicy.cashReserve = Math.max(
            0,
            Math.round(e.supplyPolicy.cashReserve * (0.85 + next() * 0.3)),
          );
        }
      }
    }
    changes.push(
      'Semente varia capital inaugural privado e orçamentos em ±15%; transferências com famílias conservam dinheiro. É variação de cenário, não população humana representativa.',
    );
  }
  return { changes, events: [] };
}

/** Apply at the beginning of the declared game day; existing contracted terms stay intact. */
export function applyLabShock(world: World, shock: LabShock, at: number, log: LabExperimentLog) {
  if (shock.type === 'demand')
    world.season.config.parameters.playableConsumerShare *= shock.multiplier;
  else if (shock.type === 'freight') freight(world, shock.multiplier);
  else costs(world, shock.multiplier);
  log.events.push({ ...shock, at });
}
