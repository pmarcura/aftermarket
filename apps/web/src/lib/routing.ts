import { useEffect, useState } from 'react';
import { useGame } from './game';
export function useRoute(origin?: string, destination?: string, details = false) {
  const { world, refresh } = useGame();
  const [loading, setLoading] = useState(false),
    [attempt, setAttempt] = useState(0);
  const ready =
    origin &&
    destination &&
    world.routes[`${origin}:${destination}`]?.source === 'osrm' &&
    (!details || Array.isArray(world.routes[`${origin}:${destination}`]?.steps));
  useEffect(() => {
    if (!origin || !destination || ready) {
      setLoading(false);
      return;
    }
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    setLoading(true);
    fetch(
      `/api/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
    )
      .then((response) => (response.ok ? refresh() : undefined))
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
          retry = setTimeout(() => setAttempt((n) => n + 1), 15000);
        }
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [origin, destination, ready, attempt]);
  return loading || Boolean(world.requireRoadRoutes && origin && destination && !ready);
}
