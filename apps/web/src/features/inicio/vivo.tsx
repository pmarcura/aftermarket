import { useEffect, useRef, useState } from 'react';

const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Números que já subiram do zero nesta sessão: trocar de tela não repete a contagem.
const vistos = new Set<string>();

/**
 * Valor que corre do anterior ao novo e diz, por um instante, se subiu ou desceu.
 * Com `id`, a primeira aparição na sessão sobe do zero.
 */
export function useNumeroVivo(valor: number, id?: string, duracao = 700) {
  const doZero = id !== undefined && !vistos.has(id) && !semMovimento();
  const [mostrado, setMostrado] = useState(doZero ? 0 : valor);
  const [rumo, setRumo] = useState<'sobe' | 'desce' | null>(null);
  // O que está na tela agora: a corrida parte daqui, mesmo se o efeito rodar duas vezes.
  const atual = useRef(doZero ? 0 : valor);
  const primeira = useRef(doZero);
  useEffect(() => {
    const de = atual.current;
    if (id) vistos.add(id);
    if (de === valor) return;
    // A primeira subida do zero não pisca: só as mudanças de verdade.
    if (!primeira.current) setRumo(valor > de ? 'sobe' : 'desce');
    const limpa = setTimeout(() => setRumo(null), 1400);
    const mostrar = (v: number) => {
      atual.current = v;
      if (v === valor) primeira.current = false;
      setMostrado(v);
    };
    if (semMovimento()) {
      mostrar(valor);
      return () => clearTimeout(limpa);
    }
    const inicio = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      mostrar(de + (valor - de) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    // Em aba escondida o navegador congela os quadros: o valor final chega mesmo assim.
    const fim = setTimeout(() => mostrar(valor), duracao + 80);
    return () => {
      cancelAnimationFrame(quadro);
      clearTimeout(limpa);
      clearTimeout(fim);
    };
    // Reage só ao valor novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return { mostrado, rumo };
}

/** Número que corre e pisca em lavoura quando sobe e em brasa quando desce. */
export function NumeroVivo({
  valor,
  formato,
  id,
  className = '',
}: {
  valor: number;
  formato: (v: number) => string;
  id?: string;
  className?: string;
}) {
  const { mostrado, rumo } = useNumeroVivo(valor, id);
  return (
    <span className={`vivo ${rumo ? `vivo-${rumo}` : ''} ${className}`}>{formato(mostrado)}</span>
  );
}

/** Tempo de jogo desde um instante real, em palavras curtas. */
export function haQuanto(horas: number) {
  if (horas < 1) return 'agora';
  if (horas < 24) return `há ${Math.round(horas)} h`;
  return `há ${Math.round(horas / 24)} d`;
}

/** Cor estável para cada empresa: a mesma em todo o jogo. */
export function matizDaEmpresa(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Iniciais de uma empresa para o selo redondo. */
export function iniciais(nome: string) {
  const partes = nome.split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p));
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || nome.slice(0, 2);
}
