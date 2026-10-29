import { useState } from 'react';
import '../design/grafico.css';

/** Formas da chave: o jogador separa as séries pela forma, não só pela cor. */
export const FORMAS = ['quadrado', 'losango', 'triangulo', 'cruz', 'octogono'] as const;
export type Forma = (typeof FORMAS)[number];

export function Chave({
  forma,
  cor,
}: {
  forma: Forma;
  /** Posição na paleta de séries (1–5) ou um tom de função (`lavoura`, `brasa`, `ouro`, `ceu`). */
  cor: 1 | 2 | 3 | 4 | 5 | 'lavoura' | 'brasa' | 'ouro' | 'ceu' | 'apagado';
}) {
  const fundo = typeof cor === 'number' ? `var(--serie-${cor})` : `var(--${cor})`;
  return (
    <i className={`gpx-forma gpx-f-${forma}`} style={{ background: fundo }} aria-hidden="true" />
  );
}

export type ItemBarra = {
  rotulo: string;
  valor: number;
  tom?: 'lavoura' | 'brasa' | 'ouro' | 'ceu' | 'apagado';
  /** Texto curto à direita do valor, por exemplo "vencedora". */
  nota?: string;
};

/**
 * Barras horizontais lisas, uma linha por item: nome à esquerda, barra que enche e o valor
 * à direita. Cada item é uma linha separada, com respiro, para ler de relance.
 */
export function BarrasPixel({
  titulo,
  itens,
  formato,
  maximo,
}: {
  titulo: string;
  itens: ItemBarra[];
  formato: (v: number) => string;
  /** Valor que enche a barra; sem ele, o maior item enche. */
  maximo?: number;
}) {
  const teto = Math.max(1, maximo ?? Math.max(...itens.map((i) => i.valor)));
  return (
    <figure className="bpx" aria-label={titulo}>
      <ul>
        {itens.map((i) => {
          const cheio = Math.min(1, Math.max(0, i.valor) / teto);
          return (
            <li key={i.rotulo} style={{ ['--tom' as string]: `var(--${i.tom ?? 'lavoura'})` }}>
              <span className="bpx-nome" title={i.rotulo}>
                {i.rotulo}
              </span>
              <span
                className="bpx-trilho"
                role="meter"
                aria-label={`${i.rotulo}: ${formato(i.valor)}`}
                aria-valuemin={0}
                aria-valuemax={Math.round(teto)}
                aria-valuenow={Math.round(i.valor)}
              >
                <i className="cheio" style={{ width: `${cheio * 100}%` }} />
              </span>
              <b className="bpx-valor">
                {formato(i.valor)}
                {i.nota && <small>{i.nota}</small>}
              </b>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export type ParteEmpilhada = {
  id: string;
  rotulo: string;
  valor: number;
  cor: 1 | 2 | 3 | 4 | 5;
  forma: Forma;
  /** Frase curta que explica a parte, mostrada na chave. */
  ajuda?: string;
};

/**
 * Uma barra só dividida em partes, com a chave logo abaixo: um cartão por parte, com forma, nome,
 * valor e porcentagem. Passar o mouse (ou o foco) numa parte destaca a outra na barra.
 */
export function BarraEmpilhada({
  titulo,
  partes,
  formato,
}: {
  titulo: string;
  partes: ParteEmpilhada[];
  formato: (v: number) => string;
}) {
  const [em, setEm] = useState<string | null>(null);
  const total = partes.reduce((n, p) => n + p.valor, 0);
  const visiveis = partes.filter((p) => p.valor > 0);
  if (total <= 0) return <p className="muted small">Nenhum gasto registrado neste período.</p>;
  return (
    <figure className="bemp" aria-label={`${titulo}. Total ${formato(total)}.`}>
      <div className="bemp-barra" role="img" aria-label={titulo}>
        {visiveis.map((p) => (
          <span
            key={p.id}
            className={em && em !== p.id ? 'apagada' : ''}
            style={{ flexGrow: p.valor, background: `var(--serie-${p.cor})` }}
            onPointerEnter={() => setEm(p.id)}
            onPointerLeave={() => setEm(null)}
          />
        ))}
      </div>
      <ul className="bemp-chave" aria-label="Chave das partes">
        {partes.map((p) => {
          const pct = total ? (p.valor / total) * 100 : 0;
          return (
            <li
              key={p.id}
              tabIndex={0}
              className={`${p.valor <= 0 ? 'vazia' : ''} ${em === p.id ? 'em' : ''}`}
              onPointerEnter={() => setEm(p.id)}
              onPointerLeave={() => setEm(null)}
              onFocus={() => setEm(p.id)}
              onBlur={() => setEm(null)}
            >
              <Chave forma={p.forma} cor={p.cor} />
              <span className="bemp-nome">{p.rotulo}</span>
              <b>{formato(p.valor)}</b>
              <small>{pct < 1 && pct > 0 ? '<1' : Math.round(pct)}%</small>
              {p.ajuda && <em>{p.ajuda}</em>}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
