import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLabOptions, type LabReport } from '../packages/simulation/src/lab';
import { queryLabReport } from '../packages/simulation/src/lab-query';
import { runLabCached } from './lib/lab-run';
import { labSourceFingerprint } from './lib/lab-fingerprint';

const arg = (key: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const horizons = arg('days', '30,90,365').split(',').map(Number);
const repeats = Number(arg('repeats', '1'));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw Error('Use --repeats=1 até 5.');
const options = horizons.map((days) =>
  validateLabOptions({
    days,
    seed: Number(arg('seed', '0')),
    scenario: arg('scenario', 'baseline'),
  }),
);
const sourceFingerprint = labSourceFingerprint();
mkdirSync(resolve('.runtime/lab'), { recursive: true });
const results = [];
for (const option of options) {
  const samples = [];
  for (let sample = 0; sample < repeats; sample++) {
    const started = performance.now();
    const { report, path } = runLabCached(option, {
      force: true,
      sourceFingerprint,
      hooks: {
        onProgress: (p) => {
          if (p.day && p.day % 30 === 0)
            console.log(JSON.stringify({ days: option.days, sample: sample + 1, day: p.day }));
        },
      },
    });
    const wallElapsedMs = performance.now() - started;
    if (
      !report.summary.moneyConserved ||
      report.observations.some((o) =>
        o.items.some((i) => Math.abs(i.physicalBalanceDifference) > 1e-6),
      )
    )
      throw Error('Conservação falhou; benchmark interrompido.');
    const queryStarted = performance.now();
    const loaded: LabReport = JSON.parse(readFileSync(path, 'utf8'));
    const query = queryLabReport(loaded, { item: 'soymeal', day: option.days, limit: 5 });
    const queryWithReadMs = performance.now() - queryStarted;
    samples.push({
      computeMs: report.performance.elapsedMs,
      wallElapsedMs,
      queryWithReadMs,
      report: path,
      traceGroups: report.trace.length,
      events: report.trace.reduce((n, g) => n + g.count, 0),
      last: {
        moneyConserved: query.snapshot.moneyConserved,
        physicalBalanceConserved: true,
        jobs: report.observations.at(-1)!.completedJobs,
      },
    });
    console.log(JSON.stringify({ completed: option.days, sample: sample + 1, ...samples.at(-1) }));
  }
  const sorted = samples.map((s) => s.computeMs).sort((a, b) => a - b);
  results.push({
    days: option.days,
    samples,
    minMs: sorted[0],
    medianMs:
      sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    maxMs: sorted.at(-1),
    p95Ms: sorted.length >= 5 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
  });
  writeFileSync(
    resolve('.runtime/lab/benchmark.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceFingerprint,
        runtime: process.version,
        note: 'Mundos novos sem cache; processo pode estar aquecido. Compute exclui serialização, wall inclui gravação; consulta inclui leitura/parse. Sem p95 representativo com menos de cinco amostras.',
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
