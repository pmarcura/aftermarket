import { useEffect, useRef, useState } from 'react';
import { routeMatchesProperties } from '../../../../packages/simulation/src/road-access';
import { useGame } from './game';

const RETRY_MS = 60000;
const MAX_ATTEMPTS = 3;

export function useRouteStatus(origin?: string, destination?: string, details = false) {
  const { world, refresh } = useGame();
  const a = world.properties.find((p) => p.id === origin),
    b = world.properties.find((p) => p.id === destination),
    route = world.routes[`${origin}:${destination}`];
  const ready = Boolean(
    routeMatchesProperties(route, a, b) && (!details || Array.isArray(route?.steps)),
  );
  const enabled = Boolean(world.requireRoadRoutes && a && b && origin !== destination);
  // Mudanças de posição invalidam a resposta anterior, mesmo mantendo o ID do imóvel.
  const key = `${origin}:${a?.coordinates.join(',')}:${a?.roadAccess?.status}:${destination}:${b?.coordinates.join(',')}:${b?.roadAccess?.status}`;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ key: '', loading: false, error: '' });
  useEffect(() => {
    if (!enabled || ready) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController;
    const request = async () => {
      attempts++;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      setState({ key, loading: true, error: '' });
      try {
        const response = await fetch(
          `/api/route?origin=${encodeURIComponent(origin!)}&destination=${encodeURIComponent(destination!)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(
            typeof body?.error === 'string'
              ? body.error
              : 'Não foi possível confirmar uma rota até este destino. Tente novamente em um minuto.',
          );
        }
        await refresh();
        if (active) setState({ key, loading: false, error: '' });
      } catch (error) {
        if (!active) return;
        setState({
          key,
          loading: false,
          error:
            error instanceof Error && error.name !== 'AbortError'
              ? error.message
              : 'A consulta da rota demorou demais. Tente novamente em um minuto.',
        });
        if (attempts < MAX_ATTEMPTS) timer = setTimeout(() => void request(), RETRY_MS);
      } finally {
        clearTimeout(timeout);
      }
    };
    void request();
    return () => {
      active = false;
      controller?.abort();
      clearTimeout(timer);
    };
  }, [key, enabled, origin, destination, ready, retry, refresh]);
  return {
    ready,
    loading: enabled && !ready && state.key === key && state.loading,
    error: enabled && !ready && state.key === key ? state.error : '',
    retry: () => setRetry((value) => value + 1),
  };
}

// Compatibilidade com os formulários que já exibem erros no aviso persistente do jogo.
export function useRoute(origin?: string, destination?: string, details = false) {
  const status = useRouteStatus(origin, destination, details);
  const { notice } = useGame();
  const notify = useRef(notice);
  notify.current = notice;
  useEffect(() => {
    if (status.error) notify.current(status.error, true);
  }, [status.error]);
  return status.loading;
}
