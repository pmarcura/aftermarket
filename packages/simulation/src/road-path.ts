import type { World, Shipment, Position } from './model';
import { routeMatchesProperties } from './road-access';

// Caminho de estrada confirmado de uma remessa, ou nada quando só existe a estimativa geográfica.
export function shipmentRoadPath(w: World, s: Shipment): Position[] | undefined {
  if (s.routeKey && w.roadPaths?.[s.routeKey]) return w.roadPaths[s.routeKey];
  if (s.mapRoute) return s.mapRoute;
  if (s.mapRouteKey && w.routes[s.mapRouteKey]?.source === 'osrm')
    return w.routes[s.mapRouteKey].coordinates;
  if (s.route && s.routeSource === 'osrm') return s.route;
  // Mundo versão 2 (D-036): a remessa sai com a estimativa e a rota real chega depois.
  const a = w.establishments.find((e) => e.id === s.originId),
    b = w.establishments.find((e) => e.id === s.destinationId);
  const route = a && b ? w.routes[`${a.propertyId}:${b.propertyId}`] : undefined;
  if (
    a &&
    b &&
    routeMatchesProperties(
      route,
      w.properties.find((p) => p.id === a.propertyId),
      w.properties.find((p) => p.id === b.propertyId),
    )
  )
    return route.coordinates;
}
export function shipmentRoute(w: World, s: Shipment): Position[] {
  const road = shipmentRoadPath(w, s);
  if (road) return road;
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
