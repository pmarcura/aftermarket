import type { World } from '../../../../packages/simulation/src/model';

/** A poll shares its current request; explicit retry replaces it. Deadline also
 * covers response.json(), rather than only receiving HTTP headers. */
export function createWorldConnection(fetcher = fetch, timeoutMs = 15000) {
  let current:
    { actor: string; controller: AbortController; promise: Promise<World | null> } | undefined;
  return {
    read(actor: string, since = '', force = false): Promise<World | null> {
      if (!force && current?.actor === actor) return current.promise;
      current?.controller.abort();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const promise = (async () => {
        try {
          const response = await fetcher(`/api/world${since}`, {
            headers: { 'x-company-id': actor },
            signal: controller.signal,
          });
          if (response.status === 204) return null;
          if (!response.ok) throw new Error('O servidor não respondeu.');
          return (await response.json()) as World;
        } catch (error) {
          if (controller.signal.aborted && current?.controller !== controller) return null;
          throw error;
        } finally {
          clearTimeout(timeout);
          if (current?.controller === controller) current = undefined;
        }
      })();
      current = { actor, controller, promise };
      return promise;
    },
    cancel() {
      const old = current;
      current = undefined;
      old?.controller.abort();
    },
  };
}
