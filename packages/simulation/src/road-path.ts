import type { World, Shipment, Position } from './model';
export function shipmentRoute(w: World, s: Shipment): Position[] {
  if (s.routeKey && w.roadPaths?.[s.routeKey]) return w.roadPaths[s.routeKey];
  if (s.mapRoute) return s.mapRoute;
  if (s.mapRouteKey && w.routes[s.mapRouteKey]?.source === 'osrm')
    return w.routes[s.mapRouteKey].coordinates;
  if (s.route) return s.route;
  const a = w.establishments.find((e) => e.id === s.originId)!,
    b = w.establishments.find((e) => e.id === s.destinationId)!;
  return (
    w.routes[`${a.propertyId}:${b.propertyId}`]?.coordinates ?? [
      w.properties.find((p) => p.id === a.propertyId)!.coordinates,
      w.properties.find((p) => p.id === b.propertyId)!.coordinates,
    ]
  );
}
