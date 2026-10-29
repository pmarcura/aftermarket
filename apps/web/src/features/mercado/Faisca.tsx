import { useId } from 'react';
/** Linha pequena e suave do preço ao longo do tempo, com a área embaixo em degradê. */
export function Faisca({ valores, sobe }: { valores: number[]; sobe: boolean }) {
  const id = useId();
  const w = 160;
  const h = 44;
  if (valores.length < 2) return <svg className="faisca" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" />;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const px = valores.map((_, i) => (i / (valores.length - 1)) * w);
  const py = valores.map((v) => h - 5 - ((v - min) / Math.max(1e-9, max - min)) * (h - 10));
  // Curva monotônica: passa por todos os pontos sem inventar picos entre eles.
  const k = valores.length;
  const d = px.slice(1).map((v, i) => v - px[i]);
  const m = py.slice(1).map((v, i) => (v - py[i]) / (d[i] || 1));
  const t = [m[0]];
  for (let i = 1; i < k - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[k - 2]);
  let linha = `M${px[0]} ${py[0]}`;
  for (let i = 0; i < k - 1; i++) {
    const c = d[i] / 3;
    linha += ` C${px[i] + c} ${py[i] + t[i] * c} ${px[i + 1] - c} ${py[i + 1] - t[i + 1] * c} ${px[i + 1]} ${py[i + 1]}`;
  }
  return (
    <svg className={`faisca ${sobe ? 'sobe' : 'desce'}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linha} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
