import { useEffect, useState } from 'react';

// Atualiza apenas a apresentação. O relógio autoritativo continua no servidor.
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
