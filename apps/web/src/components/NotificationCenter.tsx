import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useGame, num } from '../lib/game';
import { IconePixel } from './IconePixel';
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
  const { world, actor, openOrders } = useGame();
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
        <Bell size={20} />
        {count > 0 && <i>{count > 99 ? '99+' : count}</i>}
      </button>
      {open && (
        <div
          className="header-popover notifications"
          role="region"
          aria-label="Avisos do jogo"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          <div className="popover-title">
            <h3>Avisos do jogo</h3>
            <button className="icon-button" aria-label="Fechar notificações" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <div className="notification-content">
            <div className="notification-section">
              <strong>Precisa de você · {pendencias.length}</strong>
              <small>Toque para ir direto resolver.</small>
            </div>
            {pendencias.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  p.acao.executar();
                  onClose();
                }}
              >
                <IconePixel nome={p.tom === 'brasa' ? 'alerta' : 'prazo'} tamanho={22} />
                <span>
                  {p.titulo}
                  <small>
                    {p.detalhe} · {p.acao.rotulo}
                  </small>
                </span>
              </button>
            ))}
            <div className="notification-section">
              <strong>Chegaram agora · {deliveries.length}</strong>
              <small>Cargas que acabaram de entrar no estoque.</small>
            </div>
            {deliveries.slice(0, 10).map(({ id, ships }) => (
              <button
                key={id}
                onClick={() => {
                  openOrders('concluidos');
                  onClose();
                }}
              >
                <IconePixel nome="caminhao" tamanho={22} />
                <span>
                  Mercadoria entregue
                  <small>
                    {world.establishments.find((e) => e.id === ships[0].destinationId)?.name} ·{' '}
                    {num(ships.reduce((n, s) => n + s.quantity, 0))}{' '}
                    {products[ships[0].product].unit} · {ships.length}{' '}
                    {ships.length === 1 ? 'caminhão' : 'caminhões'}
                  </small>
                </span>
              </button>
            ))}
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
                Limpar entregas lidas
              </button>
            )}
            {!deliveries.length && <p className="small muted">Nenhuma entrega nova.</p>}
            {!count && <p>Tudo em dia por aqui.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
