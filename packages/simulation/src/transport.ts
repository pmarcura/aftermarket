import { products, type World, type ProductId, type Establishment } from './model';
import { vehiclesOf } from './metrics';

// Limite por veículo: somar capacidades antes de arredondar criaria unidades impossíveis.
export function fleetAvailability(w: World, companyId: string, product: ProductId) {
  const vehicles = vehiclesOf(w, companyId);
  const available = vehicles.filter((v) => v.status === 'available');
  const p = products[product];
  return {
    total: vehicles.length,
    available: available.length,
    busy: vehicles.filter((v) => v.status === 'route').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    mass: available.reduce((n, v) => n + v.capacityT, 0),
    volume: available.reduce((n, v) => n + v.capacityM3, 0),
    maxQuantity: available.reduce(
      (n, v) =>
        n +
        Math.max(
          0,
          Math.min(
            Math.floor((v.capacityT + 1e-9) / p.massT),
            Math.floor((v.capacityM3 + 1e-9) / p.volumeM3),
          ),
        ),
      0,
    ),
  };
}

export function committedStorage(w: World, e: Establishment) {
  const inv = { ...e.inventory };
  for (const s of w.shipments.filter((s) => s.destinationId === e.id && !s.delivered))
    inv[s.product] = (inv[s.product] ?? 0) + s.quantity;
  for (const j of w.jobs.filter((j) => j.establishmentId === e.id && !j.completed)) {
    const output =
      j.output ??
      Object.fromEntries(
        Object.entries(w.season.config.recipes.find((r) => r.id === j.recipeId)!.output).map(
          ([p, q]) => [p, q! * j.cycles],
        ),
      );
    for (const [p, q] of Object.entries(output))
      inv[p as ProductId] = (inv[p as ProductId] ?? 0) + q!;
  }
  return inv;
}

export function storageQuantity(w: World, e: Establishment, product: ProductId) {
  let mass = 0,
    volume = 0;
  for (const [id, q] of Object.entries(committedStorage(w, e))) {
    mass += products[id as ProductId].massT * q!;
    volume += products[id as ProductId].volumeM3 * q!;
  }
  const p = products[product];
  return Math.max(
    0,
    Math.min(
      Math.floor((e.capacityT - mass + 1e-8) / p.massT),
      Math.floor((e.capacityM3 - volume + 1e-8) / p.volumeM3),
    ),
  );
}
