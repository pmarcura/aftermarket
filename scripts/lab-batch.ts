import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLabOptions } from '../packages/simulation/src/lab';
import { labSourceFingerprint } from './lib/lab-fingerprint';
import { runLabCached } from './lib/lab-run';

const arg = (name: string, fallback: string) =>
  process.argv.find((s) => s.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const days = Number(arg('days', '90'));
const seeds = arg('seeds', arg('seed', '0')).split(',').map(Number);
if (!seeds.length || seeds.length > 10 || new Set(seeds).size !== seeds.length)
  throw Error('Use uma a dez sementes distintas em --seeds=0,1,2.');
const scenario = arg('scenario', 'baseline');
const compare = arg('compare', 'low-demand');
function parameters(prefix: string) {
  const shockDay = arg(`${prefix}shock-day`, '');
  return {
    costMultiplier: Number(arg(`${prefix}cost`, '1')),
    capacityMultiplier: Number(arg(`${prefix}capacity`, '1')),
    freightMultiplier: Number(arg(`${prefix}freight`, '1')),
    botPolicy: arg(`${prefix}policy`, 'mixed'),
    seedMode: arg(`${prefix}seed-mode`, arg('seed-mode', 'rotation')),
    ...(arg(`${prefix}capacity-recipe`, '')
      ? { capacityRecipe: arg(`${prefix}capacity-recipe`, '') }
      : {}),
    ...(shockDay
      ? {
          shock: {
            day: Number(shockDay),
            type: arg(`${prefix}shock-type`, 'demand'),
            multiplier: Number(arg(`${prefix}shock-multiplier`, '0.5')),
          },
        }
      : {}),
  };
}
const variants =
  compare === 'none'
    ? [
        {
          label: 'A',
          scenario,
          demandMultiplier: Number(arg('demand', '1')),
          parameters: parameters(''),
        },
      ]
    : [
        {
          label: 'A',
          scenario,
          demandMultiplier: Number(arg('demand', '1')),
          parameters: parameters(''),
        },
        {
          label: 'B',
          scenario: compare,
          demandMultiplier: Number(arg('compare-demand', '1')),
          parameters: parameters('compare-'),
        },
      ];
// Valida todo o lote antes de iniciar trabalho e só cria mundos novos.
const jobs = seeds.flatMap((seed) =>
  variants.map((v) => ({
    label: v.label,
    options: validateLabOptions({
      ...v.parameters,
      scenario: v.scenario,
      seed,
      days,
      demandMultiplier: v.demandMultiplier,
    }),
  })),
);
const sourceFingerprint = labSourceFingerprint();
const folder = resolve('.runtime/lab/simulations');
mkdirSync(folder, { recursive: true });
const force = process.argv.includes('--force');
const started = performance.now();
const runs = jobs.map(({ label, options }) => {
  const { report, path, reused } = runLabCached(options, {
    force,
    sourceFingerprint,
    hooks: {
      onProgress: (p) => {
        if (p.day && p.day % 30 === 0)
          console.log(
            JSON.stringify({
              label,
              seed: options.seed,
              day: p.day,
              days: options.days,
              status: 'running',
            }),
          );
      },
    },
  });
  const last = report.observations.at(-1)!;
  const first = report.observations[0];
  const entry = {
    label,
    options,
    report: path,
    reused,
    performance: report.performance,
    experiment: report.metadata.experiment,
    moneyConserved: report.summary.moneyConserved,
    final: {
      privateCash: last.health.privateCash,
      obligations: last.health.obligations,
      active: last.health.active,
      mothballed: last.health.mothballed,
      hhi: last.health.hhi,
      delivered: last.delivered,
      completedJobs: last.completedJobs,
      pendingOrders: last.pendingOrders,
    },
    alerts: report.summary.alerts,
    items: last.items.map((item) => ({
      ...item,
      firstObservedStockoutDay:
        report.observations.find(
          (o) => o.day > 0 && o.items.find((i) => i.id === item.id)?.withoutOffers,
        )?.day ?? null,
      observedDaysWithoutOffers: report.observations.filter(
        (o) => o.day > 0 && o.items.find((i) => i.id === item.id)?.withoutOffers,
      ).length,
    })),
    bots: last.bots
      .map((bot) => ({
        id: bot.id,
        name: bot.name,
        cashChange: bot.balance - (first.bots.find((b) => b.id === bot.id)?.balance ?? bot.balance),
        balance: bot.balance,
        active: bot.active,
        paused: bot.paused,
        obligations: bot.obligations,
        decisions: bot.decisions,
        lastActions: bot.lastActions,
        attempts: bot.attempts,
        executed: bot.executed,
        rejected: bot.rejected,
        blocked: bot.blocked,
        idle: bot.idle,
        lastReasons: bot.lastReasons,
      }))
      .sort((a, b) => b.obligations - a.obligations),
  };
  console.log(
    JSON.stringify({
      label,
      ...options,
      reused,
      elapsedMs: report.performance.elapsedMs,
      moneyConserved: entry.moneyConserved,
      active: entry.final.active,
      obligations: entry.final.obligations,
    }),
  );
  return entry;
});
const pairs = seeds.flatMap((seed) => {
  const a = runs.find((r) => r.label === 'A' && r.options.seed === seed),
    b = runs.find((r) => r.label === 'B' && r.options.seed === seed);
  if (!a || !b) return [];
  return [
    {
      seed,
      deltaBminusA: {
        privateCash: b.final.privateCash - a.final.privateCash,
        obligations: b.final.obligations - a.final.obligations,
        active: b.final.active - a.final.active,
        delivered: b.final.delivered - a.final.delivered,
        hhi: b.final.hhi === null || a.final.hhi === null ? null : b.final.hhi - a.final.hhi,
      },
    },
  ];
});
const batch = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceFingerprint,
  note: 'A/B pareado, mesma data/horizonte/semente. seedMode descreve rotação ou condições inaugurais. Mudanças e choques são explícitos; diferenças são efeito conjunto das opções. Caixa e dívidas em centavos. Rupturas de oferta são amostras diárias; trace identifica gates reais e candidatos avaliados, sem atribuir inação total a cada bloqueio.',
  elapsedMs: performance.now() - started,
  runs,
  pairs,
};
writeFileSync(resolve(folder, 'latest.json'), JSON.stringify(batch, null, 2) + '\n');
const cells = (row: unknown[]) =>
  row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';');
const rows = [
  cells([
    'variante',
    'cenario',
    'semente',
    'dias',
    'demanda',
    'caixa_privado_centavos',
    'atrasados_centavos',
    'ativos',
    'HHI_7_dias',
    'duracao_ms',
    'cache',
  ]),
];
for (const r of runs)
  rows.push(
    cells([
      r.label,
      r.options.scenario,
      r.options.seed,
      r.options.days,
      r.options.demandMultiplier,
      r.final.privateCash,
      r.final.obligations,
      r.final.active,
      r.final.hhi,
      r.performance.elapsedMs,
      r.reused,
    ]),
  );
writeFileSync(resolve(folder, 'comparison.csv'), '\uFEFF' + rows.join('\r\n'));
console.log(
  JSON.stringify({
    batch: resolve(folder, 'latest.json'),
    csv: resolve(folder, 'comparison.csv'),
    runs: runs.length,
    elapsedMs: batch.elapsedMs,
  }),
);
