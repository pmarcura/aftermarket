import type { World } from './model';
import { distanceKm } from './geometry';
import { inventoryQuality } from './operations';
import { routeMatchesProperties } from './road-access';

export interface RoadNeed {
  origin: string;
  destination: string;
  priority: number;
}
export function roadNeeds(w: World): RoadNeed[] {
  const needs = new Map<string, RoadNeed>();
  const add = (originId: string, destinationId: string, priority: number) => {
    const a = w.establishments.find((e) => e.id === originId),
      b = w.establishments.find((e) => e.id === destinationId);
    if (!a || !b || a.propertyId === b.propertyId) return;
    const key = `${a.propertyId}:${b.propertyId}`;
    if (
      routeMatchesProperties(
        w.routes[key],
        w.properties.find((p) => p.id === a.propertyId),
        w.properties.find((p) => p.id === b.propertyId),
      )
    )
      return;
    if (!needs.has(key) || needs.get(key)!.priority > priority)
      needs.set(key, { origin: a.propertyId, destination: b.propertyId, priority });
  };
  for (const s of w.shipments.filter(
    (s) => !s.delivered && s.routeSource !== 'osrm' && !s.mapRoute && !s.mapRouteKey,
  ))
    add(s.originId, s.destinationId, 1);
  for (const o of w.orders.filter((o) => o.status === 'pending')) {
    if (o.originId) add(o.originId, o.destinationId, 2);
    for (const p of o.proposals ?? []) add(p.originId, o.destinationId, 2);
    if (!o.originId)
      for (const e of w.establishments
        .filter((e) => e.companyId !== o.buyerId && (e.inventory[o.product] ?? 0) >= o.quantity)
        .slice(0, 4))
        add(e.id, o.destinationId, 2);
  }
  for (const c of w.infrastructure.filter((c) => c.status === 'open'))
    for (const e of w.establishments.filter(
      (e) =>
        !e.companyId.startsWith('treasury') &&
        (e.inventory[c.product] ?? 0) >= c.quantity &&
        inventoryQuality(e, c.product) >= c.minQuality,
    ))
      add(e.id, c.destinationId, 3);
  for (const e of w.establishments.filter(
    (e) => e.enabled && !e.mothballed && e.supplyPolicy?.enabled,
  )) {
    const dest = w.properties.find((p) => p.id === e.propertyId)!;
    for (const rule of e.supplyPolicy!.rules) {
      const incoming = w.shipments
        .filter((s) => !s.delivered && s.destinationId === e.id && s.product === rule.product)
        .reduce((n, s) => n + s.quantity, 0);
      if (
        (e.inventory[rule.product] ?? 0) + incoming > rule.minimum &&
        !e.supplyReorder?.includes(rule.product)
      )
        continue;
      const possible = w.establishments
        .filter(
          (a) =>
            a.id !== e.id &&
            (!rule.originId || (a.id === rule.originId && a.companyId === e.companyId)) &&
            (a.inventory[rule.product] ?? 0) > 0 &&
            (a.companyId === e.companyId ||
              w.offers.some((o) => o.establishmentId === a.id && o.product === rule.product)),
        )
        .filter((a) => e.supplyPolicy!.source !== 'internal-only' || a.companyId === e.companyId)
        .sort(
          (a, b) =>
            distanceKm(
              w.properties.find((p) => p.id === a.propertyId)!.coordinates,
              dest.coordinates,
            ) -
            distanceKm(
              w.properties.find((p) => p.id === b.propertyId)!.coordinates,
              dest.coordinates,
            ),
        );
      for (const a of possible.slice(0, 3)) add(a.id, e.id, 4);
    }
  }
  return [...needs.values()].sort((a, b) => a.priority - b.priority).slice(0, 48);
}
