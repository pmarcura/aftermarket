import type { Shipment } from './model';
export function shipmentStatus(s: Shipment, now: number) {
  const roadDeparture = s.roadDepartureAt ?? s.departedAt,
    roadArrival = s.roadArrivalAt ?? s.arrivesAt;
  const progress = Math.max(
    0,
    Math.min(1, (now - roadDeparture) / Math.max(1, roadArrival - roadDeparture)),
  );
  const totalProgress = Math.max(
    0,
    Math.min(1, (now - s.departedAt) / Math.max(1, s.arrivesAt - s.departedAt)),
  );
  return {
    progress,
    totalProgress,
    remainingMs: Math.max(0, s.arrivesAt - now),
    phase: s.delivered
      ? 'Entregue'
      : now < (s.pickupAt ?? s.departedAt)
        ? 'Veículo a caminho da coleta'
        : now < roadDeparture
          ? 'Carregando'
          : now < roadArrival
            ? 'Em trânsito'
            : 'Confirmando recebimento',
  };
}
