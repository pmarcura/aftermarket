import { useEffect, useState } from 'react';
import { useGame } from './game';
export function useRoute(origin?: string, destination?: string) {
  const { world, refresh } = useGame();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!origin || !destination || world.routes[`${origin}:${destination}`]) return;
    let active = true;
    setLoading(true);
    fetch(
      `/api/route?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
    )
      .then((response) => (response.ok ? refresh() : undefined))
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origin, destination]);
  return loading;
}
