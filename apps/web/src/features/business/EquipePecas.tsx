import { useEffect, useRef, useState } from 'react';
import { num } from '../../lib/game';

/** Estados que um crachá ou bloco pode ter. A cor sozinha nunca diz o estado: há rótulo e borda. */
export type EstadoEquipe = 'ok' | 'sobra' | 'falta' | 'entra' | 'sai' | 'vazio';

export const rotuloEstado: Record<EstadoEquipe, string> = {
  ok: 'Atende',
  sobra: 'Sobra',
  falta: 'Falta',
  entra: 'Entrando',
  sai: 'Saindo',
  vazio: 'Livre',
};

/** Um funcionário como crachá de pixel: foto quadrada, nome em etiqueta e presilha no topo. */
export function Cracha({ estado }: { estado: Exclude<EstadoEquipe, 'vazio'> }) {
  return (
    <span className={`eq-cracha ${estado}`} title={rotuloEstado[estado]}>
      <svg viewBox="0 0 9 11" width="27" height="33" shapeRendering="crispEdges" aria-hidden="true">
        <rect className="cr-cabeca" x="2" y="0" width="5" height="4" />
        <rect className="cr-olho" x="3" y="1" width="1" height="1" />
        <rect className="cr-olho" x="5" y="1" width="1" height="1" />
        <rect className="cr-corpo" x="1" y="5" width="7" height="6" />
        <rect className="cr-etiqueta" x="3" y="7" width="3" height="2" />
      </svg>
    </span>
  );
}

/** Legenda em fichas: mostra só os estados que existem na tela agora. */
export function Legenda({ estados }: { estados: EstadoEquipe[] }) {
  return (
    <ul className="eq-legenda" aria-label="Legenda">
      {estados.map((e) => (
        <li key={e}>
          <i className={`eq-ficha ${e}`} aria-hidden="true" />
          {rotuloEstado[e]}
        </li>
      ))}
    </ul>
  );
}

export interface MarcaMedidor {
  /** Posição de 0 a 1 ao longo da barra. */
  pos: number;
  rotulo: string;
  tom: 'ceu' | 'ouro' | 'brasa' | 'lavoura';
  lado: 'cima' | 'baixo';
}

/**
 * Barra em blocos. Cada bloco já vem com o estado calculado por quem usa: assim a mesma peça
 * serve para vendas por rodada (loja) e para linhas de produção (fábrica, fazenda, mina).
 */
export function Medidor({
  celulas,
  marcas = [],
  descricao,
}: {
  celulas: EstadoEquipe[];
  marcas?: MarcaMedidor[];
  descricao: string;
}) {
  return (
    <div
      className={`eq-medidor ${marcas.some((m) => m.lado === 'cima') ? 'com-cima' : ''} ${marcas.some((m) => m.lado === 'baixo') ? 'com-baixo' : ''}`}
    >
      <div
        className="eq-celulas"
        role="img"
        aria-label={descricao}
        style={{
          // Poucos blocos (linhas de produção) ficam compactos; muitos (vendas) preenchem a largura.
          gridTemplateColumns:
            celulas.length <= 8
              ? `repeat(${celulas.length}, 72px)`
              : `repeat(${celulas.length}, minmax(0, 1fr))`,
        }}
      >
        {celulas.map((c, i) => (
          <i key={i} className={c} />
        ))}
      </div>
      {marcas.map((m) => (
        <span
          key={m.rotulo}
          className={`eq-marca tom-${m.tom} ${m.lado} ${m.pos > 0.82 ? 'fim' : m.pos < 0.12 ? 'inicio' : ''}`}
          style={{ left: `${Math.min(100, Math.max(0, m.pos * 100))}%` }}
        >
          <small>{m.rotulo}</small>
        </span>
      ))}
    </div>
  );
}

/** Histórico do índice salarial: degraus de pixel numa escala só do que varia (não parte do zero). */
export function EvolucaoSalarial({ historico }: { historico: { at: number; index: number }[] }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const o = new ResizeObserver(([x]) => setW(Math.max(200, Math.round(x.contentRect.width))));
    o.observe(el);
    return () => o.disconnect();
  }, [historico.length]);
  if (historico.length < 2)
    return (
      <p className="eq-nota">
        O índice é revisto a cada sete dias de jogo. O histórico aparece depois da segunda revisão.
      </p>
    );
  const H = 96;
  const valores = historico.map((h) => h.index);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = Math.max((max - min) * 0.15, 0.002);
  const lo = min - folga;
  const hi = max + folga;
  const P = 4;
  const snap = (v: number) => Math.round(v / P) * P;
  const x = (i: number) => snap(8 + (i / (valores.length - 1)) * (W - 16));
  const y = (v: number) => snap(H - 8 - ((v - lo) / (hi - lo)) * (H - 16));
  const caminho = valores
    .map((v, i) => (i === 0 ? `M${x(0)} ${y(v)}` : `H${x(i)} V${y(v)}`))
    .join(' ');
  const data = (t: number) =>
    new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const ultimo = valores[valores.length - 1];
  const sobe = ultimo >= valores[0];
  return (
    <figure className="eq-evolucao">
      <div className="eq-evolucao-caixa" ref={caixa}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={`Índice salarial de ${num(valores[0], 3)}× para ${num(ultimo, 3)}× em ${valores.length} revisões`}
        >
          <line className="eq-eixo" x1="0" x2={W} y1={y(min)} y2={y(min)} />
          <line className="eq-eixo" x1="0" x2={W} y1={y(max)} y2={y(max)} />
          <path className="eq-linha" d={caminho} vectorEffect="non-scaling-stroke" />
          {valores.map((v, i) => (
            <rect
              key={i}
              className={i === valores.length - 1 ? 'eq-ponto agora' : 'eq-ponto'}
              x={x(i) - 4}
              y={y(v) - 4}
              width="8"
              height="8"
            />
          ))}
        </svg>
        <span className="eq-rotulo-y max">{num(max, 3)}×</span>
        <span className="eq-rotulo-y min">{num(min, 3)}×</span>
      </div>
      <figcaption>
        <span>{data(historico[0].at)}</span>
        <b className={sobe ? 'sobe' : 'desce'}>
          hoje {num(ultimo, 3)}× ({sobe ? '+' : '−'}
          {num(Math.abs(ultimo - valores[0]) * 100, 1)}% no período)
        </b>
        <span>{data(historico[historico.length - 1].at)}</span>
      </figcaption>
    </figure>
  );
}
