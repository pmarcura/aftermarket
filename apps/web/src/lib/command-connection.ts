import type { Command, World } from '../../../../packages/simulation/src/model';

/** Keep the receipt key until a definitive HTTP result, including across a reload. */
export function createCommandConnection(
  fetcher: typeof fetch = fetch,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = sessionStorage,
  timeoutMs = 20000,
) {
  let pending = false;
  const send = async (actor: string, command: Command): Promise<World | null> => {
    if (pending) return null;
    pending = true;
    const body = JSON.stringify(command);
    const slot = `aftermarket.command.${actor}`;
    try {
      const unresolved = storage.getItem(slot);
      const previous = unresolved
        ? (JSON.parse(unresolved) as { body: string; key: string })
        : null;
      if (previous && previous.body !== body)
        throw new Error(
          'A operação anterior ainda não foi confirmada. Repita a mesma operação para consultar o resultado sem cobrar novamente.',
        );
      const key = previous?.key ?? crypto.randomUUID();
      storage.setItem(slot, JSON.stringify({ body, key }));
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetcher('/api/commands', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'x-company-id': actor,
              'Idempotency-Key': key,
            },
            body,
          });
          const result = await response.json();
          if (response.ok || (response.status >= 400 && response.status < 500)) {
            storage.removeItem(slot);
            if (!response.ok) throw new Error(result.error ?? 'Revise a operação.');
            return result as World;
          }
          throw new Error('O servidor ainda não confirmou a operação.');
        } catch (error) {
          if (!storage.getItem(slot)) throw error;
          if (attempt === 1)
            throw new Error(
              'Não foi possível confirmar a operação. Tente a mesma operação novamente; a confirmação será consultada sem cobrança duplicada.',
            );
        } finally {
          clearTimeout(timer);
        }
      }
      return null;
    } finally {
      pending = false;
    }
  };
  return Object.assign(send, {
    unconfirmed(actor: string): Command | null {
      const stored = storage.getItem(`aftermarket.command.${actor}`);
      return stored ? (JSON.parse(JSON.parse(stored).body) as Command) : null;
    },
  });
}
