import { useEffect, useState } from 'react';

// Tempo em que o mundo ficou parado (spec 013). O relógio do mundo é o real menos isto; o pacote
// do servidor traz o valor e game.tsx o atualiza a cada mundo recebido.
let pausado = 0;
export const definirPausa = (ms: number | undefined) => {
  pausado = ms ?? 0;
};
/** Instante no relógio do mundo: use para prazos, chegadas e "há quanto tempo". */
export const agora = () => Date.now() - pausado;

// Atualiza apenas a apresentação. O relógio autoritativo continua no servidor.
export function useClock() {
  const [now, setNow] = useState(agora);
  useEffect(() => {
    const timer = setInterval(() => setNow(agora()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
