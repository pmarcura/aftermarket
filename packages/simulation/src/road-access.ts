import type { Position, Property, Route } from './model';
import { distanceKm } from './geometry';

export const ROAD_ENDPOINT_TOLERANCE_M = 25;

export function validRoadPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(Number.isFinite) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

export function hasRoadAccess(property: Property | undefined): property is Property & {
  roadAccess: NonNullable<Property['roadAccess']> & { status: 'connected' };
} {
  return property?.roadAccess?.status === 'connected' && validRoadPosition(property.coordinates);
}

// O selo do provedor não basta: o caminho precisa ligar os acessos atuais dos dois imóveis.
export function routeMatchesProperties(
  route: Route | undefined,
  origin: Property | undefined,
  destination: Property | undefined,
): route is Route {
  if (
    !hasRoadAccess(origin) ||
    !hasRoadAccess(destination) ||
    route?.source !== 'osrm' ||
    !Number.isFinite(route.distanceKm) ||
    route.distanceKm <= 0 ||
    !Number.isFinite(route.durationSeconds) ||
    route.durationSeconds <= 0 ||
    !Array.isArray(route.coordinates) ||
    route.coordinates.length < 2
  )
    return false;
  const first = route.coordinates[0],
    last = route.coordinates.at(-1);
  return (
    validRoadPosition(first) &&
    validRoadPosition(last) &&
    distanceKm(first, origin.coordinates) * 1000 <= ROAD_ENDPOINT_TOLERANCE_M &&
    distanceKm(last, destination.coordinates) * 1000 <= ROAD_ENDPOINT_TOLERANCE_M
  );
}
