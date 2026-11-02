import type { Command, World } from './model';

// Invariantes verificados em tempo de execução (spec 005, R3 e R5).
//
// Dinheiro: toda mutação de saldo passa por `transfer()`, então a soma dos saldos de todas as
// empresas é a mesma desde a criação do mundo (`w.invariants.totalMoney`). A verificação roda ao
// fim de `execute` e de `advance` nos testes, no laboratório e na prova econômica; no servidor,
// só com AFTERMARKET_CHECK_INVARIANTS=1 (custa uma soma por comando).

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantError';
  }
}

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
let checking = env?.AFTERMARKET_CHECK_INVARIANTS === '1' || Boolean(env?.VITEST);

// Liga ou desliga a verificação (o laboratório e a prova ligam; devolve o valor anterior).
export function setInvariantChecks(enabled: boolean) {
  const previous = checking;
  checking = enabled;
  return previous;
}
export function invariantChecksEnabled() {
  return checking;
}

export function totalMoney(w: World) {
  let total = 0;
  for (const c of w.companies) total += c.balance;
  return total;
}

// Lança InvariantError com o contexto (comando ou evento) e a diferença em centavos.
export function assertMoney(w: World, context: string) {
  if (!checking || !w.invariants) return;
  const total = totalMoney(w);
  if (total !== w.invariants.totalMoney)
    throw new InvariantError(
      `Conservação do dinheiro violada em ${context}: soma dos saldos ${total}, esperado ${w.invariants.totalMoney} (diferença ${total - w.invariants.totalMoney} centavos).`,
    );
}

// Erro inesperado (não regra do jogo) de um bot ou de uma política de reposição: registrado na
// atividade dos bots com os ids envolvidos, sem derrubar a rodada; o bot pula o resto da vez.
// Violação de invariante nunca é engolida.
export function recordBotError(
  w: World,
  at: number,
  companyId: string,
  where: string,
  error: unknown,
  command?: Command,
) {
  if (error instanceof InvariantError) throw error;
  const ids = command
    ? Object.entries(command)
        .filter(([k, v]) => k !== 'type' && typeof v === 'string')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : '';
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  (w.botActivity ??= []).push({
    at,
    companyId,
    kind: 'error',
    text: `Erro interno em ${where}${command ? ` (${command.type}${ids ? ` ${ids}` : ''})` : ''}: ${message}`,
  });
}

// Quem cria ou destrói dinheiro de propósito, fora de `transfer()` (fixtures de teste que fixam
// saldos), declara a nova soma; o jogo nunca chama isto.
export function rebaseMoney(w: World) {
  w.invariants = { totalMoney: totalMoney(w) };
}
