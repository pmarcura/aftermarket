import { useEffect, useRef, type ReactNode } from 'react';
import { X, ChevronDown, ArrowUpRight } from 'lucide-react';
export function Badge({
  children,
  tone = 'green',
}: {
  children: ReactNode;
  tone?: 'green' | 'gold' | 'blue' | 'red' | 'muted';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Stat({
  label,
  value,
  note,
  positive = false,
  gold = false,
}: {
  label: string;
  value: ReactNode;
  note: string;
  positive?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={positive ? 'positive' : gold ? 'gold-text' : ''}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function Tabs({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {values.map((v) => (
        <button
          role="tab"
          aria-selected={value === v}
          className={value === v ? 'active' : ''}
          key={v}
          onClick={() => onChange(v)}
          tabIndex={value === v ? 0 : -1}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const i = values.indexOf(v),
              next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? values.length - 1
                    : (i + (event.key === 'ArrowRight' ? 1 : -1) + values.length) % values.length;
            onChange(values[next]);
            (
              event.currentTarget.parentElement?.querySelectorAll('button')[next] as
                HTMLButtonElement | undefined
            )?.focus();
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="select-wrap">
      <select aria-label={label} {...props}>
        {children}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}
export function Progress({
  value,
  color = 'green',
}: {
  value: number;
  color?: 'green' | 'blue' | 'gold';
}) {
  return (
    <div className="progress">
      <i className={color} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Rows({
  rows,
}: {
  rows: { label: ReactNode; value: ReactNode; className?: string }[];
}) {
  return (
    <div className="detail-rows">
      {rows.map((r, i) => (
        <div key={i}>
          <span>{r.label}</span>
          <strong className={r.className}>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <ArrowUpRight size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  formLayout = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  formLayout?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    const previous = document.activeElement as HTMLElement;
    node.showModal();
    return () => {
      node.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide-modal' : ''} ${formLayout ? 'form-modal' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="panel-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Fechar janela" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-alert-slot" />
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
