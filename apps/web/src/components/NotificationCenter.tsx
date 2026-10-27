import { useState } from 'react';
import { Bell, Check, Info, X } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { products, type Shipment } from '../../../../packages/simulation/src/model';
import { arrears } from '../../../../packages/simulation/src/design';

export function NotificationCenter({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { world, actor, navigate, openBusiness } = useGame();
  const [reads, setReads] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('aftermarket.alerts.read') ?? '{}');
    } catch {
      return {};
    }
  });
  const groups = new Map<string, Shipment[]>();
  for (const s of world.shipments.filter((s) => s.buyerId === actor && s.delivered)) {
    const key = s.orderId ?? s.infrastructureId ?? s.batchId ?? s.id;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const deliveries = [...groups]
    .map(([id, ships]) => ({ id, ships, at: Math.max(...ships.map((s) => s.arrivesAt)) }))
    .filter((g) => g.at > (reads[actor] ?? 0))
    .sort((a, b) => b.at - a.at);
  const units = world.establishments.filter((e) => e.companyId === actor);
  const alerts = units.flatMap((e) => {
    if (!e.enabled) return [{ e, title: e.mothballed ? 'Estrutura suspensa' : 'Operação pausada' }];
    const recipe = world.season.config.recipes.find((r) => r.id === e.specialization);
    const low =
      e.category === 'retail'
        ? Object.values(e.inventory).some((q) => q! < 100)
        : recipe
          ? Object.entries(recipe.input).some(
              ([p, q]) => (e.inventory[p as keyof typeof e.inventory] ?? 0) < q!,
            )
          : false;
    return low
      ? [
          {
            e,
            title:
              e.category === 'retail' ? 'Produtos com estoque baixo' : 'Insumos abaixo de um ciclo',
          },
        ]
      : [];
  });
  const overdue = arrears(world, actor),
    count = deliveries.length + alerts.length + Number(overdue > 0);
  return (
    <div className="notification-wrapper">
      <button
        className={`notification-button ${open ? 'active' : ''}`}
        aria-label="Abrir notificações"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Bell size={21} />
        {count > 0 && <i>{count > 99 ? '99+' : count}</i>}
      </button>
      {open && (
        <div
          className="header-popover notifications"
          role="region"
          aria-label="Central de notificações"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          <div className="popover-title">
            <h3>Central de notificações</h3>
            <button className="icon-button" aria-label="Fechar notificações" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="notification-content">
            <div className="notification-section">
              <strong>Pendências atuais · {alerts.length + Number(overdue > 0)}</strong>
              <small>Continuam visíveis até resolver a causa.</small>
            </div>
            {overdue > 0 && (
              <button
                onClick={() => {
                  navigate('company');
                  onClose();
                }}
              >
                <Info size={17} className="negative" />
                <span>
                  Pagamentos em atraso<small>{cr(overdue)} · abrir recuperação</small>
                </span>
              </button>
            )}
            {alerts.map(({ e, title }) => (
              <button
                key={e.id}
                onClick={() => {
                  openBusiness(e.id);
                  onClose();
                }}
              >
                <Info size={17} className="gold-text" />
                <span>
                  {title}
                  <small>{e.name}</small>
                </span>
              </button>
            ))}
            <div className="notification-section">
              <strong>Recebimentos não lidos · {deliveries.length}</strong>
              <small>Agrupados por pedido; cada caminhão não gera um alerta separado.</small>
            </div>
            {deliveries.slice(0, 10).map(({ id, ships }) => (
              <button
                key={id}
                onClick={() => {
                  navigate('logistics');
                  onClose();
                }}
              >
                <Check size={17} className="positive" />
                <span>
                  Material recebido no estoque
                  <small>
                    {world.establishments.find((e) => e.id === ships[0].destinationId)?.name} ·{' '}
                    {num(ships.reduce((n, s) => n + s.quantity, 0))}{' '}
                    {products[ships[0].product].unit} · {ships.length}{' '}
                    {ships.length === 1 ? 'viagem recebida' : 'viagens recebidas'}
                  </small>
                </span>
              </button>
            ))}
            {deliveries.length > 10 && (
              <p className="small muted">
                Mostrando os 10 recebimentos mais recentes. Todo o histórico está na Logística.
              </p>
            )}
            {deliveries.length > 0 && (
              <button
                className="secondary"
                onClick={() => {
                  const next = {
                    ...reads,
                    [actor]: Math.max(Date.now(), ...deliveries.map((g) => g.at)),
                  };
                  setReads(next);
                  localStorage.setItem('aftermarket.alerts.read', JSON.stringify(next));
                }}
              >
                Marcar recebimentos como lidos
              </button>
            )}
            {!deliveries.length && <p className="small muted">Nenhum novo recebimento.</p>}
            {!count && <p>Você está em dia.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
