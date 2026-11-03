import type { ReactNode } from 'react';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';

export type Tom = 'ouro' | 'brasa' | 'lavoura' | 'ceu';

/** Um número que importa, como peça própria: rótulo curto em cima e o valor grande embaixo. */
export function Ficha({
  rotulo,
  valor,
  tom,
  icone,
}: {
  rotulo: string;
  valor: ReactNode;
  tom?: Tom;
  icone?: NomeIcone;
}) {
  return (
    <span className={`fnum ${tom ? `tom-${tom}` : ''}`}>
      {icone && <IconePixel nome={icone} tamanho={20} />}
      <span>
        <small>{rotulo}</small>
        <b>{valor}</b>
      </span>
    </span>
  );
}

/** Barra de quanto de algo se cumpre: equipe que atende a procura, estoque que cobre o dia. */
export function Medidor({
  parte,
  rotulo,
  tom = 'brasa',
}: {
  parte: number;
  rotulo: string;
  tom?: Tom;
}) {
  const p = Math.max(0, Math.min(1, parte));
  return (
    <span className={`medidor tom-${tom}`}>
      <span
        className="medidor-trilho"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-label={rotulo}
      >
        <i style={{ width: `${p * 100}%` }} />
      </span>
      <small>{rotulo}</small>
    </span>
  );
}
