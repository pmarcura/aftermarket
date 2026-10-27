import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function Notice({
  message,
  error,
  onClose,
}: {
  message: string;
  error: boolean;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    const update = () =>
      setTarget([...document.querySelectorAll('dialog[open] .modal-alert-slot')].at(-1) ?? null);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, []);
  return createPortal(
    <div
      className={`toast ${error ? 'error' : ''} ${target ? 'in-modal' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      <span aria-hidden="true">{error ? '!' : '✓'}</span>
      <div>
        <strong>{error ? 'Não foi possível concluir' : 'Atualização confirmada'}</strong>
        <p>{message}</p>
      </div>
      <button aria-label="Fechar mensagem" onClick={onClose}>
        ×
      </button>
    </div>,
    target ?? document.body,
  );
}
