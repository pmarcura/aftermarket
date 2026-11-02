import { describe, it, expect } from 'vitest';
import type { Job, PurchaseOrder, Shipment, World } from '../packages/simulation/src/model';
import {
  jobsAt,
  openJobs,
  openJobsAt,
  openShipments,
  openShipmentsTo,
  pendingOrdersBy,
  pendingOrdersTo,
  supplyHistoryOf,
} from '../packages/simulation/src/indexes';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { createWorld } from '../packages/simulation/src/seed';
import { GAME_DAY } from '../packages/simulation/src/operations';

const ship = (id: string, destinationId: string, product = 'rice', delivered = false) =>
  ({ id, destinationId, product, quantity: 1, delivered }) as unknown as Shipment;
const job = (id: string, establishmentId: string, completed = false) =>
  ({ id, establishmentId, completed }) as unknown as Job;
const order = (id: string, destinationId: string, product = 'rice', status = 'pending') =>
  ({ id, destinationId, product, status, quantity: 1 }) as unknown as PurchaseOrder;
const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);

// Confere cada índice contra a varredura que ele substitui, para todo destino/estabelecimento.
function expectSameAsScan(w: World) {
  const keys = new Set([
    ...w.shipments.map((s) => s.destinationId),
    ...w.jobs.map((j) => j.establishmentId),
    ...w.orders.map((o) => o.destinationId),
    ...w.establishments.map((e) => e.id),
  ]);
  for (const k of keys) {
    expect(ids(openShipmentsTo(w, k))).toEqual(
      ids(w.shipments.filter((s) => s.destinationId === k && !s.delivered)),
    );
    for (const p of ['rice', 'milk', 'ironOre'])
      expect(ids(openShipmentsTo(w, k, p))).toEqual(
        ids(w.shipments.filter((s) => s.destinationId === k && s.product === p && !s.delivered)),
      );
    expect(ids(openJobsAt(w, k))).toEqual(
      ids(w.jobs.filter((j) => j.establishmentId === k && !j.completed)),
    );
    expect(ids(jobsAt(w, k))).toEqual(ids(w.jobs.filter((j) => j.establishmentId === k)));
    expect(ids(pendingOrdersTo(w, k))).toEqual(
      ids(w.orders.filter((o) => o.destinationId === k && o.status === 'pending')),
    );
    expect(supplyHistoryOf(w, k)).toEqual(
      (w.supplyHistory ?? []).filter((h) => h.establishmentId === k),
    );
  }
  for (const c of w.companies ?? [])
    expect(ids(pendingOrdersBy(w, c.id))).toEqual(
      ids(w.orders.filter((o) => o.buyerId === c.id && o.status === 'pending')),
    );
  expect(ids(openShipments(w))).toEqual(ids(w.shipments.filter((s) => !s.delivered)));
  expect(ids(openJobs(w))).toEqual(ids(w.jobs.filter((j) => !j.completed)));
}

describe('índices incrementais do mundo (spec 005)', () => {
  it('vê itens novos, mudanças de situação no lugar e troca da lista', () => {
    const w = { shipments: [], jobs: [], orders: [], establishments: [] } as unknown as World;
    expect(openShipmentsTo(w, 'a')).toEqual([]);
    w.shipments.push(
      ship('1', 'a'),
      ship('2', 'b'),
      ship('3', 'a', 'milk'),
      ship('4', 'a', 'rice', true),
    );
    expect(ids(openShipmentsTo(w, 'a'))).toEqual(['1', '3']);
    expect(ids(openShipmentsTo(w, 'a', 'rice'))).toEqual(['1']);
    // Item novo depois da primeira leitura entra no fim do balde, na ordem da lista.
    w.shipments.push(ship('5', 'a'));
    expect(ids(openShipmentsTo(w, 'a'))).toEqual(['1', '3', '5']);
    // Entrega muda a flag no lugar: some na próxima leitura (e não volta).
    w.shipments[0].delivered = true;
    expect(ids(openShipmentsTo(w, 'a'))).toEqual(['3', '5']);
    expect(ids(openShipments(w))).toEqual(['2', '3', '5']);
    // O array devolvido é novo: leituras posteriores não o alteram.
    const held = openShipmentsTo(w, 'a');
    w.shipments.push(ship('6', 'a'));
    expect(ids(openShipmentsTo(w, 'a'))).toEqual(['3', '5', '6']);
    expect(ids(held)).toEqual(['3', '5']);
    // Arquivamento troca a lista: índice refeito.
    w.shipments = w.shipments.filter((s) => s.id !== '3');
    expect(ids(openShipmentsTo(w, 'a'))).toEqual(['5', '6']);

    w.jobs.push(job('j1', 'x'), job('j2', 'x', true), job('j3', 'y'));
    expect(ids(openJobsAt(w, 'x'))).toEqual(['j1']);
    expect(ids(jobsAt(w, 'x'))).toEqual(['j1', 'j2']);
    w.jobs[0].completed = true;
    expect(ids(openJobsAt(w, 'x'))).toEqual([]);
    expect(ids(jobsAt(w, 'x'))).toEqual(['j1', 'j2']);
    expect(ids(openJobs(w))).toEqual(['j3']);

    w.orders.push(order('o1', 'd'), order('o2', 'd', 'milk'), order('o3', 'd', 'rice', 'accepted'));
    expect(ids(pendingOrdersTo(w, 'd'))).toEqual(['o1', 'o2']);
    expect(ids(pendingOrdersTo(w, 'd', 'milk'))).toEqual(['o2']);
    w.orders[0].status = 'expired';
    expect(ids(pendingOrdersTo(w, 'd'))).toEqual(['o2']);
    // Lista que encolhe sem trocar de identidade também refaz o índice.
    w.orders.length = 0;
    w.orders.push(order('o4', 'd'));
    expect(ids(pendingOrdersTo(w, 'd'))).toEqual(['o4']);
    expectSameAsScan(w);
  });

  it('dá o mesmo resultado que a varredura num mundo jogável, dia após dia', () => {
    const AT = Date.UTC(2026, 9, 26, 12);
    const w = createScenario(AT, 'playtest', 0, { scale: 1 });
    expectSameAsScan(w);
    for (let d = 1; d <= 2; d++) {
      advance(w, AT + d * GAME_DAY);
      expectSameAsScan(w);
    }
    expect(w.shipments.length).toBeGreaterThan(0);
    expect(w.jobs.length).toBeGreaterThan(0);
  }, 60000);
});

describe('advance com muitos eventos abertos (spec 005, R6)', () => {
  it('acha o próximo evento sem estourar o limite de argumentos', () => {
    const NOW = Date.UTC(2026, 9, 27, 4);
    const w = createWorld(NOW);
    const far = NOW + 1000 * GAME_DAY;
    // 200 mil lotes abertos de um estabelecimento que não existe: só a busca do próximo evento os lê.
    for (let i = 0; i < 200000; i++)
      w.jobs.push({
        id: `fantasma-${i}`,
        establishmentId: 'fantasma',
        recipeId: 'rice',
        cycles: 1,
        startedAt: NOW,
        finishesAt: far + i,
        completed: false,
        cost: 0,
      });
    expect(() => advance(w, NOW + 60_000)).not.toThrow();
    expect(w.jobs.filter((j) => j.completed && j.establishmentId === 'fantasma')).toHaveLength(0);
  }, 60000);
});
