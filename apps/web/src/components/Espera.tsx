import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useGame } from '../lib/game';
import '../design/espera.css';

/**
 * Feedback de ação em andamento para o jogo inteiro. Todo comando leva alguns segundos para o
 * servidor confirmar; sem aviso o jogador acha que travou e clica de novo (e o clique é ignorado).
 * A barra no topo e o cursor de espera aparecem na hora e somem quando o servidor responde.
 */
export function EsperaGlobal() {
  const { pending } = useGame();
  // Some só depois de um instante, para ações rápidas não piscarem.
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (pending) {
      setVisivel(true);
      document.documentElement.classList.add('acao-pendente');
      return () => document.documentElement.classList.remove('acao-pendente');
    }
    const t = setTimeout(() => setVisivel(false), 350);
    return () => clearTimeout(t);
  }, [pending]);
  return (
    <div
      className={`espera-global ${pending ? 'ativa' : visivel ? 'saindo' : ''}`}
      role="status"
      aria-live="polite"
    >
      <i aria-hidden="true" />
      {pending && <span>Enviando… aguarde a confirmação</span>}
    </div>
  );
}

/**
 * Botão que mostra a espera: ao clicar vira "trabalhando", ganha o giro de espera, trava contra
 * clique duplo e só volta quando a ação termina. `onClick` pode devolver uma promessa.
 */
export function BotaoEspera({
  onClick,
  children,
  esperando = 'Enviando…',
  className = '',
  disabled,
  ...resto
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onClick: () => unknown | Promise<unknown>;
  children: ReactNode;
  /** Texto enquanto a ação roda. */
  esperando?: ReactNode;
}) {
  const [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => void (vivo.current = false);
  }, []);
  return (
    <button
      {...resto}
      className={`${className} ${ocupado ? 'ocupado' : ''}`}
      disabled={disabled || ocupado}
      aria-busy={ocupado}
      onClick={async () => {
        if (ocupado) return;
        setOcupado(true);
        try {
          await onClick();
        } finally {
          if (vivo.current) setOcupado(false);
        }
      }}
    >
      {ocupado && <i className="giro" aria-hidden="true" />}
      {ocupado ? esperando : children}
    </button>
  );
}
