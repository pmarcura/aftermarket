import type { Command, ProductId, World } from './model';

export type DecisionSource = 'director' | 'production' | 'supply' | 'command';
export type DecisionOutcome = 'executed' | 'rejected' | 'blocked' | 'idle';
export interface DecisionTrace {
  at: number;
  companyId: string;
  source: DecisionSource;
  outcome: DecisionOutcome;
  action: string;
  code: string;
  message: string;
  establishmentId?: string;
  targetId?: string;
  productId?: ProductId;
}
type TraceScope = { observer: (event: DecisionTrace) => void; source: DecisionSource };
const observers = new WeakMap<World, TraceScope>();

/** Synchronous observation only. No observer, context or event is stored in World. */
export function withDecisionTrace<T>(
  world: World,
  observer: (event: DecisionTrace) => void,
  callback: () => T,
): T {
  const previous = observers.get(world);
  observers.set(world, { observer, source: 'command' });
  try {
    return callback();
  } finally {
    if (previous) observers.set(world, previous);
    else observers.delete(world);
  }
}

export function hasDecisionTrace(world: World) {
  return observers.has(world);
}

export function withDecisionSource<T>(world: World, source: DecisionSource, callback: () => T): T {
  const scope = observers.get(world);
  if (!scope) return callback();
  const previous = scope.source;
  scope.source = source;
  try {
    return callback();
  } finally {
    scope.source = previous;
  }
}

export function emitDecisionTrace(world: World, event: DecisionTrace) {
  const scope = observers.get(world);
  if (!scope || !world.companies.some((company) => company.id === event.companyId && company.bot))
    return;
  scope.observer(event);
}

/** Command outcome is emitted by the shared executor, never inferred from balances. */
export function traceCommand(
  world: World,
  actor: string,
  command: Command,
  at: number,
  error?: Error,
) {
  const scope = observers.get(world);
  if (!scope) return;
  let hash = 2166136261;
  if (error)
    for (const character of error.message
      .replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, '[id]')
      .replace(/#[a-f0-9]{6}\b/gi, '#[id]')) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
  emitDecisionTrace(world, {
    at,
    companyId: actor,
    source: scope.source,
    outcome: error ? 'rejected' : 'executed',
    action: command.type,
    code: error
      ? `command:${command.type}:rejected:${(hash >>> 0).toString(16)}`
      : `command:${command.type}:executed`,
    message: error ? error.message : `Comando ${command.type} executado pelo motor.`,
    establishmentId:
      'establishmentId' in command
        ? command.establishmentId
        : 'destinationId' in command
          ? command.destinationId
          : undefined,
    targetId:
      'orderId' in command
        ? command.orderId
        : 'contractId' in command
          ? command.contractId
          : 'offerId' in command
            ? command.offerId
            : 'propertyId' in command
              ? command.propertyId
              : 'originId' in command
                ? command.originId
                : undefined,
    productId:
      'product' in command
        ? command.product
        : 'offerId' in command
          ? world.offers.find((offer) => offer.id === command.offerId)?.product
          : 'orderId' in command
            ? world.orders.find((order) => order.id === command.orderId)?.product
            : 'contractId' in command
              ? world.infrastructure.find((contract) => contract.id === command.contractId)?.product
              : command.type === 'extract'
                ? 'iron'
                : command.type === 'produce'
                  ? singleRecipeOutput(world, command.recipeId)
                  : undefined,
  });
}

function singleRecipeOutput(world: World, recipeId: string): ProductId | undefined {
  const outputs = Object.keys(
    world.season.config.recipes.find((recipe) => recipe.id === recipeId)?.output ?? {},
  ) as ProductId[];
  return outputs.length === 1 ? outputs[0] : undefined;
}
