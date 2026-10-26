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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
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
      className="modal"
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
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function LineChart({
  values,
  labels = ['Jan', 'Mar', 'Mai', 'Jul', 'Set', 'Dez'],
  money = false,
}: {
  values: number[];
  labels?: string[];
  money?: boolean;
}) {
  const min = Math.min(0, ...values),
    max = Math.max(...values, 1),
    span = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${50 + (i / Math.max(1, values.length - 1)) * 920},${210 - ((v - min) / span) * 180}`,
    )
    .join(' ');
  return (
    <div className="chart">
      <svg
        viewBox="0 0 1000 250"
        role="img"
        aria-label={`Gráfico de ${values.length} pontos, mínimo ${min.toLocaleString('pt-BR')} e máximo ${max.toLocaleString('pt-BR')}${money ? ' centavos' : ''}`}
      >
        <defs>
          <linearGradient id={money ? 'money-fill' : 'demand-fill'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#59bca2" stopOpacity=".22" />
            <stop offset="100%" stopColor="#59bca2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="50"
              x2="975"
              y1={30 + i * 45}
              y2={30 + i * 45}
              stroke="#31454e"
              strokeWidth="1"
            />
            <text x="40" y={34 + i * 45} textAnchor="end" fill="#8ca2ae" fontSize="11">
              {Math.round((max - (i * span) / 4) / (money ? 100 : 1)).toLocaleString('pt-BR', {
                notation: 'compact',
              })}
            </text>
          </g>
        ))}
        <polygon
          points={`50,210 ${points} 970,210`}
          fill={`url(#${money ? 'money-fill' : 'demand-fill'})`}
        />
        <polyline
          points={points}
          fill="none"
          stroke="#62c2aa"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {labels.map((v, i) => (
          <text
            key={v + i}
            x={50 + (i / Math.max(1, labels.length - 1)) * 920}
            y="242"
            textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
            fill="#93a8b2"
            fontSize="12"
          >
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}
