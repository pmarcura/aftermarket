import { describe, expect, it } from 'vitest';
import { createScenario } from '../packages/simulation/src/scenarios';
import { createWorld } from '../packages/simulation/src/seed';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { economyHealth } from '../packages/simulation/src/design';
import { marketView } from '../packages/simulation/src/metrics';
import type { Position } from '../packages/simulation/src/model';
import { worldView } from '../apps/server/src/view';

// Pacote enxuto do navegador: pequeno, mas com os mesmos números das telas.
const AT = Date.UTC(2026, 9, 26, 12);
describe('pacote do navegador', () => {
  const w = createScenario(AT, 'playtest');
  for (let d = 1; d <= 9; d++) advance(w, AT + d * GAME_DAY);
  const view = worldView(w, 'player');

  it('fica muito menor que o mundo e só leva o extrato recente do jogador', () => {
    const full = JSON.stringify(w).length,
      slim = JSON.stringify(view).length;
    expect(slim).toBeLessThan(full / 8);
    for (const l of view.ledger) {
      expect(l.from === 'player' || l.to === 'player').toBe(true);
      expect(l.at).toBeGreaterThanOrEqual(w.updatedAt - GAME_DAY * 7);
    }
    expect(view.jobs.every((j) => !j.completed || j.finishesAt >= w.updatedAt - GAME_DAY * 2)).toBe(
      true,
    );
  });

  it('mantém totais desde a abertura, saúde da economia e mercado iguais aos do mundo completo', () => {
    const paid = w.ledger.filter((l) => l.from === 'player').reduce((n, l) => n + l.amount, 0);
    const out = Object.values(view.view!.totals).reduce((n, t) => n + (t?.out ?? 0), 0);
    expect(out).toBe(paid);
    expect(economyHealth(view)).toEqual(economyHealth(w));
    expect(economyHealth(view, view.updatedAt, 'milk')).toEqual(
      economyHealth(w, w.updatedAt, 'milk'),
    );
    for (const id of ['milk', 'steel', 'rice'] as const) {
      expect(marketView(view, id).tradedQuantity).toBeCloseTo(marketView(w, id).tradedQuantity, 6);
      expect(marketView(view, id).tradedValue).toBe(marketView(w, id).tradedValue);
    }
  });

  it('mantém curvas locais, compartilha trajetos e reutiliza desenho entre revisões', () => {
    const world = createWorld(AT),
      line: Position[] = Array.from({ length: 1200 }, (_, i) => [
        -47 + i * 0.0005,
        -23 + (i % 2) * 0.0004,
      ]);
    world.routes['ferrovale:industry'] = {
      coordinates: line,
      distanceKm: 80,
      durationSeconds: 5000,
      source: 'osrm',
    };
    world.roadPaths = { contracted: line, unused: line };
    world.shipments.push({
      id: 'in-transit',
      buyerId: 'player',
      sellerId: 'ferrovale',
      originId: 'e-ferrovale',
      destinationId: 'e-industry',
      product: 'iron',
      quantity: 1,
      cost: 10,
      freight: 20,
      carrierId: 'transbrasil',
      vehicleId: 'test-truck',
      departedAt: AT,
      arrivesAt: AT + 5000,
      delivered: false,
      distance: 80,
      routeKey: 'contracted',
    });
    const first = worldView(world, 'player'),
      drawn = first.routes['ferrovale:industry'].coordinates;
    expect(drawn.length).toBeGreaterThan(150);
    expect(drawn[0]).toEqual(line[0]);
    expect(drawn.at(-1)).toEqual(line.at(-1));
    expect(first.roadPaths!.contracted).toBe(drawn);
    expect(first.roadPaths!.unused).toBeUndefined();
    world.revision++;
    expect(worldView(world, 'player').routes['ferrovale:industry'].coordinates).toBe(drawn);
    const replacement = line.map(([x, y]): Position => [x, y + 0.01]);
    world.routes['ferrovale:industry'] = {
      ...world.routes['ferrovale:industry'],
      coordinates: replacement,
    };
    world.revision++;
    const next = worldView(world, 'player');
    expect(next.routes['ferrovale:industry'].coordinates[0]).toEqual(replacement[0]);
    expect(next.roadPaths!.contracted).toBe(drawn);
    expect(world.shipments[0].arrivesAt).toBe(AT + 5000);
  });
});
