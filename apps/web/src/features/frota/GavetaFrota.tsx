import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import '../../design/gaveta.css';

/**
 * Gaveta de lado para as telas da frota. Usa o mesmo molde da gaveta de reposição (faixa colorida
 * no topo, blocos grandes, rodapé com o total), para a compra e a venda de caminhões terem a
 * mesma cara das outras escolhas do jogo.
 */
export function GavetaFrota({
  titulo,
  matiz = 200,
  onClose,
  children,
}: {
  titulo: string;
  matiz?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const no = ref.current!;
    const antes = document.activeElement as HTMLElement | null;
    no.showModal();
    return () => {
      no.close();
      antes?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="gaveta"
      aria-label={titulo}
      style={{ ['--h' as string]: matiz }}
      onCancel={(ev) => {
        ev.preventDefault();
        onClose();
      }}
      onClick={(ev) => ev.target === ev.currentTarget && onClose()}
    >
      <div className="gaveta-painel">
        <button className="gaveta-fechar" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
