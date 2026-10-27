import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLabOptions } from '../packages/simulation/src/lab';
import { runLabCached } from './lib/lab-run';
import { labSourceFingerprint } from './lib/lab-fingerprint';

const days = Number(process.argv.find((a) => a.startsWith('--days='))?.slice(7) ?? 90);
const sourceFingerprint = labSourceFingerprint();
const opening = validateLabOptions({ days });
const a = runLabCached(opening, { sourceFingerprint });
const b = runLabCached(
  validateLabOptions({ ...opening, capacityMultiplier: 0.75, capacityRecipe: 'soy-oil' }),
  {
    sourceFingerprint,
    hooks: {
      onProgress: (p) => {
        if (p.day && p.day % 30 === 0)
          console.log(JSON.stringify({ variant: 'B', day: p.day, days }));
      },
    },
  },
);
const lastA = a.report.observations.at(-1)!,
  lastB = b.report.observations.at(-1)!;
const item = (snapshot: typeof lastA, id: string) => snapshot.items.find((i) => i.id === id)!;
const evaluations = [
  {
    criterion: 'Reduzir estoque físico final de farelo em ao menos 20%',
    unit: 'kg',
    a: item(lastA, 'soymeal').physical,
    b: item(lastB, 'soymeal').physical,
    passed: item(lastB, 'soymeal').physical <= item(lastA, 'soymeal').physical * 0.8,
  },
  {
    criterion: 'Preservar ao menos 95% do consumo familiar de leite',
    unit: 'unidades de 1 L',
    a: item(lastA, 'milk').householdConsumption,
    b: item(lastB, 'milk').householdConsumption,
    passed:
      item(lastB, 'milk').householdConsumption >= item(lastA, 'milk').householdConsumption * 0.95,
  },
  {
    criterion: 'Preservar ao menos 95% do consumo familiar de óleo',
    unit: 'unidades de 1 L',
    a: item(lastA, 'oil').householdConsumption,
    b: item(lastB, 'oil').householdConsumption,
    passed:
      item(lastB, 'oil').householdConsumption >= item(lastA, 'oil').householdConsumption * 0.95,
  },
  {
    criterion: 'Não elevar obrigações em aberto acima de 5%',
    unit: 'BRL-cents',
    a: lastA.health.obligations,
    b: lastB.health.obligations,
    passed: lastB.health.obligations <= lastA.health.obligations * 1.05,
  },
  {
    criterion: 'Conservar dinheiro e fluxos físicos',
    a: a.report.summary.moneyConserved,
    b: b.report.summary.moneyConserved,
    passed: [a.report, b.report].every(
      (r) =>
        r.summary.moneyConserved &&
        r.observations.every((o) =>
          o.items.every((i) => Math.abs(i.physicalBalanceDifference) <= 1e-6),
        ),
    ),
  },
];
const historicalComparison = resolve('.runtime/lab/studies/carrier-before-after-comparison.json');
const comparisonPath = existsSync(historicalComparison)
  ? historicalComparison
  : resolve('.runtime/lab/ui/comparison.json');
const uiComparison = existsSync(comparisonPath)
  ? JSON.parse(readFileSync(comparisonPath, 'utf8'))
  : undefined;
const uiPath = resolve('.runtime/lab/ui/index.json');
const ui = existsSync(uiPath)
  ? (JSON.parse(readFileSync(uiPath, 'utf8')) as {
      flowRuns?: {
        flowId: string;
        viewport: string;
        status: string;
        states: string[];
        requests: { command: { type: string }; status: number }[];
      }[];
    })
  : undefined;
const blockedBeforeSending = ['desktop', 'mobile'].every((viewport) =>
  ui?.flowRuns?.some(
    (run) =>
      run.flowId === 'carrier-purchase-error' &&
      run.viewport === viewport &&
      run.status === 'passed' &&
      run.states.includes('bloqueado') &&
      !run.requests.some((request) => request.command.type === 'buyVehicle'),
  ),
);
const validPurchasePreserved = ['desktop', 'mobile'].every((viewport) =>
  ui?.flowRuns?.some(
    (run) =>
      run.flowId === 'carrier-purchase' &&
      run.viewport === viewport &&
      run.status === 'passed' &&
      run.requests.some(
        (request) => request.command.type === 'buyVehicle' && request.status === 200,
      ),
  ),
);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceFingerprint,
  economics: {
    observation:
      'Óleo e farelo compartilham a receita; leite usa farelo. Medir produção, absorção e estoques antes de alterar a economia.',
    hypothesis:
      'Reduzir somente a velocidade de soy-oil para 0,75 reduz excesso de farelo sem prejudicar consumo final de óleo/leite.',
    intervention: b.report.metadata.experiment.changes,
    evaluations,
    decision: evaluations.every((e) => e.passed)
      ? 'Aceitar como candidata para playtest, sem aplicar à season salva.'
      : 'Rejeitar esta intervenção pelos critérios pré-definidos; manter evidência e investigar demanda/margem/escala.',
    a: {
      options: a.report.options,
      report: a.path,
      elapsedMs: a.report.performance.elapsedMs,
      items: ['oil', 'soymeal', 'milk'].map((id) => item(lastA, id)),
    },
    b: {
      options: b.report.options,
      report: b.path,
      elapsedMs: b.report.performance.elapsedMs,
      items: ['oil', 'soymeal', 'milk'].map((id) => item(lastB, id)),
    },
  },
  interface: {
    observation:
      'O modal de caminhão oferecia confirmação com caixa insuficiente e projetava saldo negativo; a fixture registrou rejeição sem mudança de saldo/frota.',
    hypothesis:
      'Exibir caixa livre, valor faltante e impedimento antes da confirmação evita uma tentativa inválida.',
    criterion:
      'Com caixa insuficiente, confirmação desabilitada, mensagem recuperável e nenhum comando enviado; com caixa suficiente, compra mantém débito/frota autoritativos.',
    comparison: comparisonPath,
    result:
      uiComparison?.flowChanges?.filter((c: { flowId: string }) => c.flowId.includes('carrier')) ??
      [],
    baseline: uiComparison?.baseline ?? 'missing',
    assertions: { blockedBeforeSending, validPurchasePreserved },
    decision:
      blockedBeforeSending && validPurchasePreserved
        ? 'Refinamento validado em desktop e celular: tentativa sem caixa impedida antes do envio e compra viável preservada. Referência anterior mantida.'
        : 'Refinamento aplicado; aguardar conclusão das asserções de ambos os viewports antes de fechar a validação.',
  },
};
mkdirSync(resolve('.runtime/lab/studies'), { recursive: true });
writeFileSync(
  resolve('.runtime/lab/studies/oil-meal-milk-and-carrier.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    report: resolve('.runtime/lab/studies/oil-meal-milk-and-carrier.json'),
    decision: report.economics.decision,
    evaluations,
  }),
);
