import type { ReactNode } from 'react';
import '../design/livro.css';

/** Título de uma tela: papel escuro rasgado, inclinado e preso com fita. */
export function Placa({
  titulo,
  sub,
  className = '',
}: {
  titulo: string;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`lv-placa ${className}`}>
      <span className="lv-fita a" aria-hidden="true" />
      <span className="lv-fita b" aria-hidden="true" />
      <h1>{titulo}</h1>
      {sub && <p className="lv-sub">{sub}</p>}
    </div>
  );
}

/** Carimbo de tinta: o estado de algo como objeto, não como etiqueta genérica. */
export function Carimbo({
  tom = 'brasa',
  giro = -4,
  children,
}: {
  tom?: 'brasa' | 'ouro' | 'lavoura' | 'ceu';
  giro?: number;
  children: ReactNode;
}) {
  return (
    <span
      className="lv-carimbo"
      style={{ ['--tom' as string]: `var(--${tom})`, ['--giro' as string]: `${giro}deg` }}
    >
      {children}
    </span>
  );
}
