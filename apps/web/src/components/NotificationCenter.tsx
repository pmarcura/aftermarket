import { useState } from 'react';
import { Bell, Check, Info, X } from 'lucide-react';
import { useGame, num } from '../lib/game';
import { products, type Shipment } from '../../../../packages/simulation/src/model';
import { usePendencias } from '../features/inicio/pendencias';

export function NotificationCenter({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { world, actor, navigate } = useGame();
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
  const pendencias = usePendencias(),
    count = deliveries.length + pendencias.length;
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
              <strong>Precisa de você · {pendencias.length}</strong>
              <small>Continuam visíveis até resolver a causa.</small>
            </div>
            {pendencias.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  p.acao.executar();
                  onClose();
                }}
              >
                <Info size={17} className={p.tom === 'brasa' ? 'negative' : 'gold-text'} />
                <span>
                  {p.titulo}
                  <small>
                    {p.detalhe} · {p.acao.rotulo}
                  </small>
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
                Mostrando os 10 recebimentos mais recentes. Todo o histórico está em Pedidos.
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
