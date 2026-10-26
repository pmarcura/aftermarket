import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createStore } from '../apps/server/src/store';
import type { World } from '../packages/simulation/src/model';

// Usar com o servidor deste banco parado. Migração faz backup antes de qualquer UPDATE.
const path = resolve(process.env.AFTERMARKET_DB_FILE ?? '.runtime/world.sqlite');
const beforeDb = new DatabaseSync(path, { readOnly: true });
const before = JSON.parse(
  (beforeDb.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
) as World;
const receipts = beforeDb.prepare('SELECT * FROM receipts ORDER BY id').all();
beforeDb.close();
const store = createStore(path),
  after = store.read();
store.close();
const afterDb = new DatabaseSync(path, { readOnly: true });
assert.equal(afterDb.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
assert.deepEqual(afterDb.prepare('SELECT * FROM receipts ORDER BY id').all(), receipts);
afterDb.close();
assert.deepEqual(after.companies, before.companies);
assert.deepEqual(
  after.establishments.map((e) => [e.id, e.inventory, e.unitCosts, e.revenue, e.expenses]),
  before.establishments.map((e) => [e.id, e.inventory, e.unitCosts, e.revenue, e.expenses]),
);
assert.deepEqual(
  after.properties.map((p) => [p.id, p.ownerId]),
  before.properties.map((p) => [p.id, p.ownerId]),
);
assert.deepEqual(after.ledger, before.ledger);
assert.deepEqual(
  after.jobs.map((j) => [j.id, j.cost, j.finishesAt, j.completed]),
  before.jobs.map((j) => [j.id, j.cost, j.finishesAt, j.completed]),
);
assert.deepEqual(
  after.shipments.map((s) => [s.id, s.cost, s.freight, s.arrivesAt, s.delivered]),
  before.shipments.map((s) => [s.id, s.cost, s.freight, s.arrivesAt, s.delivered]),
);
if (before.season?.config)
  for (const [key, value] of Object.entries(before.season.config))
    assert.deepEqual(after.season.config[key as keyof typeof after.season.config], value);
const report = {
  path,
  from: before.version,
  to: after.version,
  integrity: 'ok',
  balancesAndStocksPreserved: true,
  ownersPreserved: true,
  ledgerEntries: after.ledger.length,
  receipts: receipts.length,
  shipments: after.shipments.length,
  jobs: after.jobs.length,
  existingSeasonParametersPreserved: true,
  at: new Date().toISOString(),
};
mkdirSync(resolve('.runtime/review'), { recursive: true });
writeFileSync(resolve('.runtime/review/migration-main.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
