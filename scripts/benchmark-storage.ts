import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readWorldSnapshot, rollbackSnapshot } from '../apps/server/src/world-storage';
import type { ProductId } from '../packages/simulation/src/model';
import { createStore } from '../apps/server/src/store';

const input = process.argv.find((a) => a.startsWith('--db='))?.slice(5);
if (!input) throw new Error('Informe --db; somente a cópia de benchmark será modificada.');
mkdirSync('.runtime/storage-benchmark', { recursive: true });
const path = `.runtime/storage-benchmark/${Date.now()}.sqlite`;
const source = new DatabaseSync(input, { readOnly: true });
await backup(source, path);
const world = readWorldSnapshot(source);
source.close();
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hash = digest(world);
let start = performance.now();
structuredClone(world);
const oldCloneMs = performance.now() - start;
start = performance.now();
rollbackSnapshot(world);
const cloneMs = performance.now() - start;
start = performance.now();
const fullBytes = Buffer.byteLength(JSON.stringify(world));
const oldSerializeMs = performance.now() - start;
start = performance.now();
const packedBytes = Buffer.byteLength(JSON.stringify({ ...world, ledger: [], storageFormat: 1 }));
const serializeMs = performance.now() - start;
start = performance.now();
const store = createStore(path);
const migrateMs = performance.now() - start;
if (digest(store.read()) !== hash) throw new Error('Migração alterou o mundo!');
const commandMs: number[] = [];
const shop = store
  .read()
  .establishments.find((e) => e.companyId === 'player' && e.category === 'retail')!;
for (let i = 0; i < 3; i++) {
  start = performance.now();
  store.command(
    'player',
    {
      type: 'setPrice',
      establishmentId: shop.id,
      product: Object.keys(shop.inventory)[0] as ProductId,
      price: 600 + i,
    },
    crypto.randomUUID(),
    world.updatedAt,
  );
  commandMs.push(performance.now() - start);
}
const afterHash = digest(store.read());
store.close();
const reopened = new DatabaseSync(path, { readOnly: true });
if (digest(readWorldSnapshot(reopened)) !== afterHash)
  throw new Error('Reabertura alterou o mundo!');
reopened.close();
const report = {
  scope: 'same saved world, isolated copy; commands freeze injected time; not HTTP/FPS',
  ledger: world.ledger.length,
  fullBytes,
  packedBytes,
  oldCloneMs,
  cloneMs,
  oldSerializeMs,
  serializeMs,
  migrateMs,
  commandMs,
  exactMigration: true,
  exactReload: true,
};
mkdirSync('test-results/performance', { recursive: true });
writeFileSync('test-results/performance/storage.json', JSON.stringify(report, null, 2));
console.log(report);
