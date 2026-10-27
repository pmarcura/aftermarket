import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { UiEvidence } from '../apps/web/src/devlab/ui-evidence';
import type { generateUiCatalog } from './ui-catalog';
import { labSourceFingerprint, labFixtureFingerprint } from './lib/lab-fingerprint';
import { queryLabReport, type LabQuery } from '../packages/simulation/src/lab-query';
import type { LabReport } from '../packages/simulation/src/lab';

const catalogPath = resolve('docs/design/UI-CATALOG.json');
if (!existsSync(catalogPath)) throw Error('Execute npm run lab:catalog primeiro.');
const catalog: ReturnType<typeof generateUiCatalog> = JSON.parse(readFileSync(catalogPath, 'utf8'));
const uiPath = resolve('.runtime/lab/ui/index.json');
const evidence: UiEvidence | undefined = existsSync(uiPath)
  ? JSON.parse(readFileSync(uiPath, 'utf8'))
  : undefined;
const economicPath = resolve('.runtime/lab/simulations/latest.json');
const economic = existsSync(economicPath)
  ? JSON.parse(readFileSync(economicPath, 'utf8'))
  : undefined;
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (['bot', 'item', 'day', 'outcome', 'source', 'run'].some((key) => arg(key) !== undefined)) {
  if (!economic?.runs?.length) throw Error('Não há simulação coletada. Execute npm run lab:batch.');
  const [side, seedText] = (arg('run') ?? 'A').split(':');
  const run = economic.runs.find(
    (r: { label: string; options: { seed: number } }) =>
      r.label === side && (seedText === undefined || r.options.seed === Number(seedText)),
  );
  if (!run) throw Error('Execução não encontrada. Use --run=A:0 ou --run=B:0 conforme o lote.');
  const report: LabReport = JSON.parse(readFileSync(run.report, 'utf8'));
  if (report.schemaVersion !== 2 || !report.trace)
    throw Error('Relatório anterior à telemetria. Execute npm run lab:batch para atualizar.');
  const started = performance.now();
  const data = queryLabReport(report, {
    bot: arg('bot'),
    item: arg('item'),
    ...(arg('day') && arg('day') !== 'all' ? { day: Number(arg('day')) } : {}),
    allDays: arg('day') === 'all',
    outcome: arg('outcome') as LabQuery['outcome'],
    source: arg('source') as LabQuery['source'],
    search: arg('query'),
    limit: Number(arg('limit') ?? 40),
    series: process.argv.includes('--series'),
  });
  console.log(
    JSON.stringify(
      {
        ...data,
        provenance: {
          report: run.report,
          current: economic.sourceFingerprint === labSourceFingerprint(),
          queryElapsedMs: performance.now() - started,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const selected = arg('screen');
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const query = normalize(arg('query') ?? '');
const action = normalize(arg('action') ?? '');
const detailed = process.argv.includes('--detail');
const state = arg('state');
const viewport = arg('viewport');
if (selected && !catalog.screens.some((s) => s.id === selected))
  throw Error('Tela desconhecida. Execute sem --screen para ver o índice.');
let changed: string[] = [];
try {
  changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
    encoding: 'utf8',
    windowsHide: true,
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  /* Contexto funciona sem repositório Git. */
}
const screens = catalog.screens
  .filter((s) => !selected || s.id === selected)
  .map((s) => {
    const files = catalog.files.filter((f) => s.files.includes(f.path));
    const changedSources = files
      .filter(
        (f) =>
          !existsSync(resolve(f.path)) ||
          createHash('sha256')
            .update(readFileSync(resolve(f.path), 'utf8'))
            .digest('hex') !== f.hash,
      )
      .map((f) => f.path);
    const runtime = evidence?.screens.find((entry) => entry.id === s.id);
    const matching = files.flatMap((f) =>
      f.literals
        .filter((l) => !query || normalize(l.text).includes(query))
        .map((l) => ({ ...l, source: `${f.path}:${l.line}` })),
    );
    return {
      id: s.id,
      title: s.title,
      purpose: s.purpose,
      task: s.task,
      source: `apps/web/src/${s.source}`,
      fingerprint: s.fingerprint,
      affectedByChanges: changed.filter((f) => s.files.includes(f)),
      changedSources,
      evidence: !runtime
        ? 'missing'
        : runtime.fingerprint !== s.fingerprint ||
            changedSources.length ||
            evidence?.engineFingerprint !== labFixtureFingerprint()
          ? 'stale'
          : 'captured',
      capturedAt: runtime?.capturedAt ?? null,
      states:
        runtime?.captures
          .filter((c) => (!state || c.state === state) && (!viewport || c.viewport === viewport))
          .map((c) => ({
            state: c.state,
            viewport: c.viewport,
            screenshot: resolve('.runtime/lab/ui', c.screenshot),
            overflow: c.overflow,
            unnamed: c.unnamed,
            headings: c.headings,
          })) ?? [],
      errors: runtime?.errors ?? [],
      commands: [...new Set(files.flatMap((f) => f.commands.map((c) => c.type)))].sort(),
      staticTextCount: files.reduce((n, f) => n + f.literals.length, 0),
      ...(query || detailed
        ? {
            matching,
            ...(detailed
              ? {
                  visibleStates:
                    runtime?.captures
                      .filter(
                        (c) =>
                          (!state || c.state === state) && (!viewport || c.viewport === viewport),
                      )
                      .map((c) => ({
                        state: c.state,
                        viewport: c.viewport,
                        controls: c.controls,
                        text: c.text,
                      })) ?? [],
                }
              : {}),
          }
        : {}),
    };
  })
  .filter(
    (s) =>
      (!query || ('matching' in s && s.matching?.length)) &&
      (!action ||
        s.commands.some((command) => normalize(command).includes(action)) ||
        evidence?.flowCatalog?.some(
          (flow) =>
            flow.screen === s.id &&
            normalize(`${flow.id} ${flow.title} ${flow.commands.join(' ')}`).includes(action),
        )),
  );
const findings = screens.flatMap((screen) => [
  ...screen.errors.map((error) => ({
    severity: 'error',
    screen: screen.id,
    observation: error,
    hypothesis:
      'Falha de renderização ou da fixture; consultar o estado capturado antes de atribuir causa.',
    nextExperiment: `npm run lab:capture -- --screen=${screen.id} --force`,
  })),
  ...screen.states
    .filter((state) => state.overflow || state.unnamed)
    .map((state) => ({
      severity: 'review',
      screen: screen.id,
      observation: `${state.state}/${state.viewport}: overflow=${state.overflow}; controles sem nome=${state.unnamed}`,
      evidence: state.screenshot,
      hypothesis: state.overflow
        ? 'Algum conteúdo pode exceder a largura disponível.'
        : 'Algum controle pode não ter nome acessível pela heurística atual.',
      nextExperiment: `Reproduzir ${screen.task} com teclado em ${state.viewport}; confirmar origem no DOM.`,
    })),
]);
const context = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope:
    'Índice para orientar leitura rápida. Inventário estático pode conter ramos não capturados. Metadados e heurísticas não substituem teste de tarefa humana.',
  ui: {
    summary: evidence?.summary ?? null,
    report: uiPath,
    flows: evidence?.flowCatalog
      ?.filter(
        (flow) =>
          (!selected || flow.screen === selected) &&
          (!action ||
            normalize(`${flow.id} ${flow.title} ${flow.commands.join(' ')}`).includes(action)),
      )
      .map((flow) => ({
        ...flow,
        evidence: evidence?.flowRuns
          ?.filter((run) => run.flowId === flow.id)
          .map((run) => ({
            viewport: run.viewport,
            status: run.status,
            assertions: run.assertions,
            requests: run.requests.map((request) => ({
              type: request.command.type,
              status: request.status,
              error: request.error,
            })),
            error: run.error,
            captures: run.captures,
          })),
      })),
    comparison: evidence?.comparison
      ? {
          baseline: evidence.comparison.baseline,
          summary: evidence.comparison.summary,
          changes: evidence.comparison.flowChanges,
        }
      : undefined,
    screens:
      selected || query || detailed
        ? screens
        : screens.map(({ states, ...screen }) => ({
            ...screen,
            observedStates: states.length,
            screenshots: states.slice(0, 2).map((s) => s.screenshot),
          })),
  },
  economics: economic
    ? {
        generatedAt: economic.generatedAt,
        sourceFingerprint: economic.sourceFingerprint,
        evidence: economic.sourceFingerprint === labSourceFingerprint() ? 'current' : 'stale',
        elapsedMs: economic.elapsedMs,
        runs: economic.runs.map(
          (r: {
            label: string;
            options: unknown;
            performance: unknown;
            final: unknown;
            report: string;
            alerts: unknown[];
          }) => ({
            label: r.label,
            options: r.options,
            performance: r.performance,
            final: r.final,
            alerts: r.alerts,
            report: r.report,
          }),
        ),
        pairs: economic.pairs,
        detail: economicPath,
      }
    : null,
  nextActions: [
    ...(!evidence ? ['Executar npm run lab:capture para observar DOM e gerar capturas.'] : []),
    ...screens.filter((s) => s.evidence === 'stale').map((s) => `Recapturar ${s.id}: fonte mudou.`),
    ...(!economic ? ['Executar npm run lab:batch para medir temporadas.'] : []),
  ],
};
if (process.argv.includes('--write')) {
  mkdirSync(resolve('.runtime/lab'), { recursive: true });
  writeFileSync(resolve('.runtime/lab/context.json'), JSON.stringify(context, null, 2) + '\n');
  writeFileSync(
    resolve('.runtime/lab/review.json'),
    JSON.stringify(
      {
        generatedAt: context.generatedAt,
        findings,
        economicRuns: context.economics?.runs,
        note: 'Triagem automática. Observação, hipótese e próximo experimento são distintos; não comprova usabilidade humana nem causalidade econômica.',
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify(
    process.argv.includes('--quiet')
      ? {
          context: resolve('.runtime/lab/context.json'),
          review: resolve('.runtime/lab/review.json'),
          screens: screens.length,
          ui: evidence?.summary,
          flows: evidence?.flowRuns?.reduce(
            (counts, flow) => {
              counts[flow.status] = (counts[flow.status] ?? 0) + 1;
              return counts;
            },
            {} as Record<string, number>,
          ),
          comparison: evidence?.comparison?.summary,
          economicRuns: context.economics?.runs.length,
          nextActions: context.nextActions,
        }
      : context,
    null,
    2,
  ),
);
