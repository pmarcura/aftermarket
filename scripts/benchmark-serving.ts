import { DatabaseSync } from 'node:sqlite';
import { readWorldSnapshot } from '../apps/server/src/world-storage';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { worldView } from '../apps/server/src/view';
import { createWorldPacketCache } from '../apps/server/src/world-packet';

const file = process.argv.find((a) => a.startsWith('--db='))?.slice(5);
if (!file) throw new Error('Informe --db=<mundo>; apenas leitura, sem tick ou migração.');
const db = new DatabaseSync(file, { readOnly: true });
const world = readWorldSnapshot(db);
db.close();
const at = performance.now();
const view = worldView(world, 'player');
const projectMs = performance.now() - at;
console.log(JSON.stringify({ step: 'projection', projectMs }));
const json = JSON.stringify(view);
mkdirSync('.runtime/performance', { recursive: true });
writeFileSync('.runtime/performance/view.json', json);
const cache = createWorldPacketCache();
const times: { mode: string; ms: number }[] = [];
for (const mode of ['uncached', 'cached']) {
  if (mode === 'cached') await cache(world, 'player').gzip;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    if (mode === 'cached') await cache(world, 'player').gzip;
    else gzipSync(JSON.stringify(worldView(world, 'player')), { level: 6 });
    times.push({ mode, ms: performance.now() - start });
  }
}
const report = {
  scope: 'CPU/response reuse on one saved snapshot read-only, no advance; not HTTP latency or FPS',
  companies: world.companies.length,
  ledger: world.ledger.length,
  projectMs,
  rawViewBytes: Buffer.byteLength(json),
  gzipViewBytes: gzipSync(json).length,
  times,
};
const serializeAt = performance.now();
const persistedBytes = Buffer.byteLength(JSON.stringify(world));
Object.assign(report, { persistedBytes, serializeWorldMs: performance.now() - serializeAt });
mkdirSync('test-results/performance', { recursive: true });
writeFileSync('test-results/performance/serving.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
