import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createStore } from '../apps/server/src/store';
import { migrateWorld } from '../packages/simulation/src/migrate';
import type { World } from '../packages/simulation/src/model';

// Executar com o servidor deste banco parado. Validação pura precede qualquer UPDATE.
const path = resolve(process.env.AFTERMARKET_DB_FILE ?? '.runtime/world.sqlite');
const comparison = process.argv
  .find((a) => a.startsWith('--verify-from='))
  ?.slice('--verify-from='.length);
const beforeDb = new DatabaseSync(comparison ? resolve(comparison) : path, { readOnly: true });
const before = JSON.parse(
  (beforeDb.prepare('SELECT state FROM worlds WHERE id=1').get() as { state: string }).state,
) as World;
const receipts = beforeDb.prepare('SELECT * FROM receipts ORDER BY id').all();
beforeDb.close();

function validate(after: World) {
  const sum = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
  assert.equal(sum(after), sum(before), 'Migração não pode emitir dinheiro.');
  assert(after.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0));
  assert.deepEqual(after.ledger.slice(0, before.ledger.length), before.ledger);
  const added = after.ledger.slice(before.ledger.length);
  assert(
    added.every((e) => e.kind === 'budget' && e.amount >= 0 && Number.isSafeInteger(e.amount)),
  );
  for (const c of after.companies) {
    const prior = before.companies.find((x) => x.id === c.id);
    const delta = added.reduce(
      (n, e) => n + (e.to === c.id ? e.amount : 0) - (e.from === c.id ? e.amount : 0),
      0,
    );
    assert.equal(c.balance, (prior?.balance ?? 0) + delta, 'Saldo sem lançamento: ' + c.id);
    if (prior && !prior.bot)
      assert.equal(c.balance, prior.balance, 'Saldo humano deve permanecer intacto.');
  }
  for (const e of before.establishments) {
    const next = after.establishments.find((x) => x.id === e.id)!;
    assert(next, 'Unidade ausente: ' + e.id);
    for (const key of [
      'companyId',
      'propertyId',
      'inventory',
      'unitCosts',
      'employees',
      'revenue',
      'expenses',
      'reserve',
      'enabled',
    ] as const)
      assert.deepEqual(next[key], e[key], 'Unidade alterada: ' + e.id + '.' + key);
  }
  for (const p of before.properties)
    assert.equal(after.properties.find((x) => x.id === p.id)?.ownerId, p.ownerId);
  assert.deepEqual(after.jobs, before.jobs);
  assert.deepEqual(after.shipments, before.shipments);
  assert.deepEqual(
    after.infrastructure.slice(0, before.infrastructure?.length ?? 0),
    before.infrastructure ?? [],
  );
  for (const v of before.vehicles)
    assert.deepEqual(
      after.vehicles.find((x) => x.id === v.id),
      v,
    );
  if (before.season?.config)
    for (const [key, value] of Object.entries(before.season.config)) {
      if (key === 'recipes')
        for (const r of before.season.config.recipes)
          assert.deepEqual(
            after.season.config.recipes.find((x) => x.id === r.id),
            r,
          );
      else if (key === 'operations')
        for (const [k, v] of Object.entries(before.season.config.operations)) {
          if (k === 'profiles')
            for (const [id, profile] of Object.entries(before.season.config.operations.profiles))
              assert.deepEqual(after.season.config.operations.profiles[id], profile);
          else
            assert.deepEqual(
              after.season.config.operations[k as keyof typeof before.season.config.operations],
              v,
            );
        }
      else assert.deepEqual(after.season.config[key as keyof typeof after.season.config], value);
    }
}
validate(migrateWorld(before).world);
// createStore cria backup consistente com VACUUM INTO antes da migração transacional.
const store = createStore(path),
  after = store.read();
store.close();
validate(after);
const afterDb = new DatabaseSync(path, { readOnly: true });
assert.equal(afterDb.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
assert.deepEqual(afterDb.prepare('SELECT * FROM receipts ORDER BY id').all(), receipts);
afterDb.close();
const report = {
  path,
  from: before.operationsVersion ?? 0,
  to: after.operationsVersion,
  integrity: 'ok',
  moneyConserved: true,
  humanBalancesAndExistingStocksPreserved: true,
  ownersJobsVehiclesDeadlinesAndReceiptsPreserved: true,
  ledgerBefore: before.ledger.length,
  ledgerAfter: after.ledger.length,
  fundedOpeningEntries: after.ledger.length - before.ledger.length,
  newRivals: after.companies.filter(
    (c) => c.id.startsWith('rival-') && !before.companies.some((x) => x.id === c.id),
  ).length,
  stateTreasuries: after.companies.filter((c) => c.id.startsWith('treasury:')).length,
  receipts: receipts.length,
  shipments: after.shipments.length,
  jobs: after.jobs.length,
  existingSeasonParametersPreserved: true,
  at: new Date().toISOString(),
  maintenanceTicksNotBilled: after.nextEconomicAt > before.nextEconomicAt,
  previousNextEconomicAt: before.nextEconomicAt,
  nextEconomicAt: after.nextEconomicAt,
};
mkdirSync(resolve('.runtime/review'), { recursive: true });
writeFileSync(resolve('.runtime/review/migration-main.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
