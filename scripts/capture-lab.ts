import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance, execute, quote } from '../packages/simulation/src/engine';
import { arrears } from '../packages/simulation/src/design';
import type { Command, World, ProductId } from '../packages/simulation/src/model';
import { regions } from '../packages/world/src/regions';
import { writeUiCatalog } from './ui-catalog';
import { labSourceFingerprint } from './lib/lab-fingerprint';
import { compareScreenshotPng } from './lib/visual-diff';
import { uiFlows } from '../apps/web/src/devlab/ui-flows';
import type {
  UiCapture,
  UiEvidence,
  UiScreenEvidence,
  UiFlowRun,
  UiWorldObservation,
  UiComparison,
  UiCaptureComparison,
} from '../apps/web/src/devlab/ui-evidence';

const catalog = writeUiCatalog();
const output = resolve('.runtime/lab/ui');
mkdirSync(output, { recursive: true });
const index = resolve(output, 'index.json');
const previous: UiEvidence | undefined = existsSync(index)
  ? JSON.parse(readFileSync(index, 'utf8'))
  : undefined;
const engineFingerprint = labSourceFingerprint([
  'scripts/capture-lab.ts',
  'apps/web/src/devlab/ui-flows.ts',
  'apps/web/src/devlab/ui-evidence.ts',
  'scripts/lib/visual-diff.ts',
]);
const force = process.argv.includes('--force');
const runFlows = process.argv.includes('--flows') || process.argv.includes('--run-flows');
const compare = process.argv.includes('--compare');
const acceptBaseline = process.argv.includes('--accept-baseline');
const flowFilter = process.argv
  .find((a) => a.startsWith('--flow='))
  ?.slice('--flow='.length)
  .split(',');
if (flowFilter?.some((id) => !uiFlows.some((flow) => flow.id === id)))
  throw Error('Fluxo desconhecido em --flow. Consulte ui-flows.ts.');
if (flowFilter && acceptBaseline)
  throw Error('Aceitação de baseline exige coleta completa, sem --flow.');
if (acceptBaseline && process.argv.some((a) => a.startsWith('--screen=')))
  throw Error('Aceitação de baseline exige captura completa; remova --screen.');
const allCaptures = (r: UiEvidence) => [...r.screens.flatMap((s) => s.captures), ...r.globalStates];
const hasFlowEvidence = (r: UiEvidence) =>
  !runFlows ||
  uiFlows
    .filter((f) => f.exercisedBy)
    .every((f) =>
      ['desktop', 'mobile'].every((viewport) =>
        r.flowRuns?.some(
          (run) => run.flowId === f.id && run.viewport === viewport && run.status === 'passed',
        ),
      ),
    );
const only = process.argv.find((a) => a.startsWith('--screen='))?.split('=')[1];
if (only && !catalog.screens.some((s) => s.id === only))
  throw Error('Tela desconhecida. Consulte npm run lab:catalog.');
if (only && previous && previous.engineFingerprint !== engineFingerprint)
  throw Error(
    'O motor ou a fixture mudou. Execute lab:capture sem --screen para atualizar todas as telas.',
  );
if (
  !force &&
  !only &&
  previous?.engineFingerprint === engineFingerprint &&
  hasFlowEvidence(previous) &&
  previous.globalStates.length === 2 &&
  previous.globalStates.every((c) => existsSync(resolve(output, c.screenshot))) &&
  catalog.screens.every((screen) => {
    const old = previous.screens.find((s) => s.id === screen.id);
    return (
      old?.fingerprint === screen.fingerprint &&
      !old.errors.length &&
      old.captures.length >= 2 &&
      old.captures.every((c) => existsSync(resolve(output, c.screenshot)))
    );
  })
) {
  previous.summary.captured = 0;
  previous.summary.reused = catalog.screens.length;
  writeFileSync(index, JSON.stringify(previous, null, 2) + '\n');
  const summaryPath = resolve(output, 'summary.json');
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    summary.summary = previous.summary;
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  }
  if (acceptBaseline) saveBaseline(previous);
  if (compare || acceptBaseline) {
    previous.comparison = compareBaseline(previous, acceptBaseline);
    writeFileSync(index, JSON.stringify(previous, null, 2) + '\n');
    if (existsSync(summaryPath)) {
      const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
      summary.comparison = previous.comparison;
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
    }
  }
  console.log(
    JSON.stringify({
      report: index,
      ...previous.summary,
      browserStarted: false,
      comparison: previous.comparison?.summary,
    }),
  );
  process.exit(0);
}
const port = Number(process.env.AFTERMARKET_LAB_PORT ?? 5186);
const server = await createServer({
  configFile: resolve('vite.config.ts'),
  server: { port, host: '127.0.0.1', strictPort: true, open: false, hmr: false },
});
await server.listen();
const browser = await chromium
  .launch({
    channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
    headless: true,
  })
  .catch(async (error: unknown) => {
    await server.close();
    throw error;
  });
const report: UiEvidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  fixture:
    'baseline, seed 0, época fixa; somente memória, sem API/SQLite. Com --flows, cenários novos por tarefa e comandos reais transacionais em memória; avanço temporal explícito para entregas/produção. Rotas sintéticas e tiles vazios controlados, sem geografia real. Estados declarados não equivalem a estados exercitados. Não prova todos os ramos nem usabilidade humana.',
  engineFingerprint,
  screens: [],
  globalStates: [],
  flowCatalog: uiFlows,
  flowRuns: [],
  summary: { captured: 0, reused: 0, states: 0, errors: 0, overflow: 0, unnamed: 0 },
};
if (flowFilter)
  report.fixture += ` Coleta parcial de depuração --flow=${flowFilter.join(',')}; não usar como cobertura completa nem aceitar como baseline.`;
const at = Date.UTC(2026, 9, 26, 12);
let uuidSequence = 0;
function deterministic<T>(fn: () => T): T {
  const original = globalThis.crypto.randomUUID;
  globalThis.crypto.randomUUID = (() =>
    `00000000-0000-4000-8000-${String(++uuidSequence).padStart(12, '0')}`) as typeof original;
  try {
    return fn();
  } finally {
    globalThis.crypto.randomUUID = original;
  }
}
function freshWorld() {
  uuidSequence = 0;
  return deterministic(() => createScenario(at));
}
let world = freshWorld();
let activeRun: UiFlowRun | undefined;
function observe(w: World): UiWorldObservation {
  return {
    money: w.companies.reduce((n, c) => n + c.balance, 0),
    balances: Object.fromEntries(w.companies.map((c) => [c.id, c.balance])),
    inventory: Object.fromEntries(
      w.establishments.map((e) => [e.id, { ...e.inventory } as Record<string, number>]),
    ),
    shipments: w.shipments.length,
    delivered: w.shipments.filter((s) => s.delivered).length,
    jobs: w.jobs.length,
    completedJobs: w.jobs.filter((j) => j.completed).length,
    orders: w.orders.length,
    ledgerEntries: w.ledger.length,
  };
}
function saveBaseline(r: UiEvidence) {
  if (r.summary.errors || r.flowRuns?.some((run) => run.status === 'failed'))
    throw Error('Baseline não aceita: corrija as falhas funcionais/de captura antes de aprovar.');
  const version = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 8)}`;
  const folder = resolve(output, 'baseline', 'versions', version);
  mkdirSync(folder, { recursive: true });
  const baseline = structuredClone(r);
  for (const c of allCaptures(baseline)) {
    const source = c.screenshot;
    copyFileSync(resolve(output, source), resolve(folder, source));
    c.screenshot = `versions/${version}/${source}`;
  }
  delete baseline.comparison;
  const serialized = JSON.stringify({ ...baseline, baselineVersion: version }, null, 2) + '\n';
  writeFileSync(resolve(folder, 'index.json'), serialized);
  writeFileSync(resolve(output, 'baseline/index.json'), serialized);
}
function compareBaseline(r: UiEvidence, accepted: boolean): UiComparison {
  const path = resolve(output, 'baseline/index.json');
  const result: UiComparison = {
    baseline: existsSync(path) ? (accepted ? 'accepted' : 'available') : 'missing',
    generatedAt: new Date().toISOString(),
    entries: [],
    flowChanges: [],
    summary: { compared: 0, changed: 0, missing: 0, visualUnavailable: 0, functionalChanged: 0 },
    limits: [
      'PNG RGB/RGBA 8-bit: pixel alterado quando algum canal difere mais de 16/255; não usa análise perceptual.',
      'Diferenças são evidência de mudança; não certificam melhora/piora de UX. Época, IDs e fixture controlados.',
      'Baseline só muda com --accept-baseline; versões anteriores permanecem em baseline/versions.',
      'Sem referência para um estado ou fluxo, a comparação informa ausência; não considera aprovado.',
      'Diferenças contra referências antigas com títulos ausentes podem refletir espera de carregamento ou navegação estabilizada no coletor; não atribuir automaticamente uma regressão ao produto.',
    ],
  };
  if (!existsSync(path)) {
    result.summary.missing = allCaptures(r).length;
    writeFileSync(resolve(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  }
  const baseline: UiEvidence = JSON.parse(readFileSync(path, 'utf8'));
  const key = (c: { screen: string; state: string; viewport: string }) =>
    `${c.screen}:${c.state}:${c.viewport}`;
  const before = new Map(allCaptures(baseline).map((c) => [key(c), c]));
  mkdirSync(resolve(output, 'diff'), { recursive: true });
  for (const c of allCaptures(r)) {
    const old = before.get(key(c));
    before.delete(key(c));
    const entry: UiCaptureComparison = {
      screen: c.screen,
      state: c.state,
      viewport: c.viewport,
      structuralChanged: false,
      structureChanges: [],
      visual: 'missing',
      current: c.screenshot,
    };
    if (!old) {
      result.summary.missing++;
      entry.structureChanges.push('Estado sem baseline.');
      result.entries.push(entry);
      continue;
    }
    entry.baseline = `baseline/${old.screenshot}`;
    for (const field of [
      'headings',
      'controls',
      'text',
      'overflow',
      'unnamed',
      'keyboard',
    ] as const)
      if (JSON.stringify(old[field]) !== JSON.stringify(c[field]))
        entry.structureChanges.push(`${field} alterado`);
    entry.structuralChanged = entry.structureChanges.length > 0;
    try {
      const baselinePng = readFileSync(resolve(output, entry.baseline));
      const currentPng = readFileSync(resolve(output, c.screenshot));
      const comparison = baselinePng.equals(currentPng)
        ? { status: 'unchanged' as const, changedPixels: 0, changedRatio: 0, diff: undefined }
        : compareScreenshotPng(baselinePng, currentPng);
      entry.visual = comparison.status;
      if ('changedPixels' in comparison) {
        entry.changedPixels = comparison.changedPixels;
        entry.changedRatio = comparison.changedRatio;
        if (comparison.diff) {
          entry.diff = `diff/${c.screenshot}`;
          writeFileSync(resolve(output, entry.diff), comparison.diff);
        }
      }
    } catch (e) {
      entry.visual = 'unavailable';
      entry.structureChanges.push(`PNG: ${e instanceof Error ? e.message : String(e)}`);
      result.summary.visualUnavailable++;
    }
    result.summary.compared++;
    if (entry.structuralChanged || ['changed', 'size-mismatch'].includes(entry.visual))
      result.summary.changed++;
    result.entries.push(entry);
  }
  for (const c of before.values()) {
    result.summary.missing++;
    result.entries.push({
      screen: c.screen,
      state: c.state,
      viewport: c.viewport,
      structuralChanged: true,
      structureChanges: ['Estado presente na referência e ausente na coleta atual.'],
      visual: 'missing',
      current: '',
      baseline: `baseline/${c.screenshot}`,
    });
  }
  const flowKey = (run: UiFlowRun) => `${run.flowId}:${run.viewport}`;
  const oldRuns = new Map((baseline.flowRuns ?? []).map((run) => [flowKey(run), run]));
  for (const run of r.flowRuns ?? []) {
    const old = oldRuns.get(flowKey(run));
    oldRuns.delete(flowKey(run));
    const details: string[] = [];
    if (!old) details.push('Fluxo sem execução de referência.');
    else {
      if (old.status !== run.status) details.push('Resultado funcional alterado.');
      if (JSON.stringify(old.states) !== JSON.stringify(run.states))
        details.push('Estados exercitados alterados.');
      if (
        JSON.stringify(old.assertions.map((a) => [a.label, a.passed, a.expected, a.actual])) !==
        JSON.stringify(run.assertions.map((a) => [a.label, a.passed, a.expected, a.actual]))
      )
        details.push('Asserções ou efeitos observados alterados.');
      if (
        JSON.stringify(old.requests.map((q) => [q.command.type, q.status, q.error])) !==
        JSON.stringify(run.requests.map((q) => [q.command.type, q.status, q.error]))
      )
        details.push('Comandos ou rejeições alterados.');
    }
    if (details.length)
      result.flowChanges!.push({
        flowId: run.flowId,
        viewport: run.viewport,
        before: old?.status ?? 'missing',
        after: run.status,
        details,
      });
  }
  for (const old of oldRuns.values())
    result.flowChanges!.push({
      flowId: old.flowId,
      viewport: old.viewport,
      before: old.status,
      after: 'missing',
      details: ['Fluxo não consta na execução atual.'],
    });
  result.summary.functionalChanged = result.flowChanges!.length;
  writeFileSync(resolve(output, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
async function snapshot(
  page: Page,
  screen: string,
  state: string,
  viewport: string,
): Promise<UiCapture> {
  await page.evaluate(() => document.fonts.ready);
  // A financial response can navigate into a lazy page after the POST resolves.
  // A success capture must show that page, not its transient Suspense fallback.
  await page
    .getByText('Carregando painel…', { exact: true })
    .waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(180);
  const main = page.locator('main').first();
  if (await main.count()) await main.focus().catch(() => undefined);
  await page.keyboard.press('Tab');
  const keyboard = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    return e
      ? `${e.tagName}: ${e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 100) ?? ''}`
      : '';
  });
  const data = await page.evaluate(() => {
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'button,input,select,textarea,a[href],summary,[role="switch"]',
      ),
    ]
      .filter(visible)
      .map((e) => {
        const input = e as HTMLInputElement;
        const labelled = e
          .getAttribute('aria-labelledby')
          ?.split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        const labels =
          'labels' in input && input.labels
            ? [...input.labels].map((l) => l.textContent).join(' ')
            : '';
        return {
          tag: e.tagName.toLowerCase(),
          role: e.getAttribute('role') ?? '',
          name: (
            e.getAttribute('aria-label') ||
            labelled ||
            labels ||
            (e.tagName === 'INPUT' ? '' : e.textContent) ||
            e.getAttribute('title') ||
            ''
          )
            .replace(/\s+/g, ' ')
            .trim(),
          value: ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) ? input.value : undefined,
          disabled: input.disabled ?? false,
        };
      });
    return {
      headings: [...document.querySelectorAll('h1,h2,h3,[role="dialog"]')]
        .filter(visible)
        .map(
          (e) =>
            e.getAttribute('aria-label') ||
            e.querySelector('h2')?.textContent ||
            e.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) ||
            '',
        ),
      controls,
      text: (document.querySelector('main') ?? document.body).innerText,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      unnamed: controls.filter(
        (c) => !c.name && !(c.tag === 'input' && ['hidden'].includes(c.role)),
      ).length,
    };
  });
  const screenshot = `${screen}-${slug(state)}-${viewport}.png`;
  await page.screenshot({
    path: resolve(output, screenshot),
    fullPage: true,
    animations: 'disabled',
  });
  return { screen, state, viewport, screenshot, keyboard, ...data };
}
async function exerciseFlow(page: Page, id: string, viewport: string, evidence: UiScreenEvidence) {
  const run = activeRun!;
  run.observations = [];
  const check = (label: string, actual: unknown, expected: unknown = true) => {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    run.assertions.push({ label, passed, expected, actual });
    if (!passed)
      throw Error(
        `${label}: esperado ${JSON.stringify(expected)}, observado ${JSON.stringify(actual)}.`,
      );
  };
  const shot = async (
    state: import('../apps/web/src/devlab/ui-evidence').UiFlowState,
    suffix = '',
  ) => {
    if (!run.states.includes(state)) run.states.push(state);
    const c = await snapshot(
      page,
      evidence.id,
      `fluxo ${id} ${state}${suffix ? ` ${suffix}` : ''}`,
      viewport,
    );
    evidence.captures.push(c);
    run.captures.push(c.screenshot);
  };
  const submit = async (name: string | RegExp, expectedStatus = 200, inDialog = true) => {
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
      { timeout: 10000 },
    );
    const scope = inDialog ? page.getByRole('dialog') : page;
    await scope.getByRole('button', { name, exact: typeof name === 'string' }).click();
    check(`Resposta de ${String(name)}`, (await response).status(), expectedStatus);
    await page.waitForTimeout(80);
  };
  const unit = (unitId = 'e-industry') => world.establishments.find((e) => e.id === unitId)!;
  const balance = () => world.companies.find((c) => c.id === 'player')!.balance;
  const advanceTo = async (time: number) => {
    deterministic(() => advance(world, time));
    run.observations!.push({ phase: 'avanço temporal pelo motor', world: observe(world) });
    await page.clock.setFixedTime(time);
    await page.reload();
    await page.locator('#main-content').waitFor();
    await page.locator('#main-content').getByRole('heading').first().waitFor();
  };
  const prepare = (actor: string, command: Command) => {
    deterministic(() => execute(world, actor, command, world.updatedAt));
    run.observations!.push({
      phase: `Preparação por comando normal: ${command.type}`,
      world: observe(world),
    });
  };
  const showAs = async (actor: string, screen = evidence.id, business?: string) => {
    await page.evaluate(
      ({ actor, screen, business }) => {
        localStorage.setItem('aftermarket.company', actor);
        localStorage.setItem('aftermarket.page', screen);
        if (business) localStorage.setItem('aftermarket.business', business);
      },
      { actor, screen, business },
    );
    await page.reload();
    await page.locator('#main-content').waitFor();
    await page.locator('#main-content').getByRole('heading').first().waitFor();
  };
  const openSection = async (name: string) => {
    const summary = page.locator('summary').filter({ hasText: name }).first();
    if (!(await summary.evaluate((element) => (element.parentElement as HTMLDetailsElement).open)))
      await summary.click();
  };
  world = freshWorld();
  if (id === 'purchase-insufficient-cash' || id === 'carrier-purchase-error') {
    const player = world.companies.find((c) => c.id === 'player')!,
      treasury = world.companies.find((c) => c.id === 'treasury')!;
    treasury.balance += player.balance;
    player.balance = 0;
  }
  if (id === 'industry-production-error') unit().inventory.coal = 0;
  if (
    [
      'market-negotiation',
      'market-infrastructure',
      'logistics-order',
      'company-obligations',
      'company-vehicle-sale',
      'business-installation',
    ].includes(id)
  ) {
    for (const establishment of world.establishments) {
      establishment.automation = false;
      if (establishment.supplyPolicy) establishment.supplyPolicy.enabled = false;
    }
    for (const company of world.companies)
      if (
        !['consumers', 'transbrasil', 'rodoleste', 'expresso'].includes(company.id) &&
        !company.id.startsWith('treasury')
      )
        company.bot = false;
  }
  if (id === 'market-negotiation') {
    prepare('player2', {
      type: 'buyProperty',
      propertyId: 'newindustry',
      name: 'Destino da negociação',
    });
    prepare('player2', {
      type: 'installBusiness',
      establishmentId: 'e-newindustry',
      recipeId: 'steel-bars',
      lines: 1,
    });
  }
  if (id === 'business-installation')
    prepare('player', {
      type: 'buyProperty',
      propertyId: 'hortolandia',
      name: 'Instalação do laboratório',
    });
  if (id === 'market-infrastructure') {
    prepare('player', {
      type: 'produce',
      establishmentId: 'e-industry',
      recipeId: 'steel-bars',
      cycles: 6,
    });
    deterministic(() =>
      advance(world, Math.max(world.nextEconomicAt, world.jobs.at(-1)!.finishesAt)),
    );
  }
  if (id === 'logistics-order') {
    const offer = world.offers.find(
      (o) => o.product === 'iron' && o.establishmentId === 'e-ferrovale',
    )!;
    prepare('player', {
      type: 'requestOrder',
      offerId: offer.id,
      destinationId: 'e-industry',
      quantity: 65,
      carrierId: 'transbrasil',
      maxFreight: 1000000,
      deliveryDays: 3,
    });
    prepare('ferrovale', { type: 'acceptOrder', orderId: world.orders.at(-1)!.id });
  }
  if (id === 'company-obligations') {
    const player = world.companies.find((c) => c.id === 'player')!,
      treasury = world.companies.find((c) => c.id === 'treasury')!;
    treasury.balance += player.balance;
    player.balance = 0;
    for (const e of world.establishments.filter((e) => e.companyId === 'player')) e.enabled = false;
    deterministic(() => advance(world, world.nextEconomicAt));
  }
  const money = observe(world).money;
  run.observations.push({ phase: 'fixture inicial explícita', world: observe(world) });
  await page.clock.setFixedTime(world.updatedAt);
  await showAs(
    'player',
    evidence.id,
    id === 'business-installation'
      ? 'e-hortolandia'
      : evidence.id === 'industry'
        ? 'e-industry'
        : evidence.id === 'retail'
          ? 'e-retail'
          : evidence.id === 'carrier'
            ? 'e-logistics'
            : undefined,
  );
  await page.locator('#main-content').waitFor({ timeout: 15000 });
  page.setDefaultTimeout(10000);
  switch (id) {
    case 'map-ownership':
      await page.getByLabel('Filtrar titularidade no mapa', { exact: true }).selectOption('mine');
      check(
        'Filtro por titularidade aplicado',
        await page.getByLabel('Filtrar titularidade no mapa', { exact: true }).inputValue(),
        'mine',
      );
      check(
        'Detalhes de propriedade de outro titular fechados',
        await page.locator('.property-sidebar').count(),
        0,
      );
      await shot('sucesso');
      break;
    case 'purchase-insufficient-cash':
      check(
        'Compra bloqueada antes de comando',
        await page.getByRole('button', { name: /^Confirmar compra/ }).isDisabled(),
      );
      check(
        'Motivo de caixa insuficiente visível',
        await page
          .getByText('Saldo insuficiente para esta propriedade', { exact: true })
          .isVisible(),
      );
      await shot('bloqueado');
      break;
    case 'purchase-property': {
      const property = world.properties.find((p) => p.id === 'hortolandia')!,
        before = balance();
      await page.getByRole('button', { name: /^Confirmar compra/ }).click();
      await page
        .getByRole('dialog')
        .getByLabel('Nome do estabelecimento')
        .fill('Laboratório de Aquisição');
      await shot('confirmacao');
      await submit(/^Comprar por/);
      check(
        'Titularidade da propriedade',
        world.properties.find((p) => p.id === property.id)!.ownerId,
        'player',
      );
      check('Preço debitado', balance(), before - property.price);
      const created = world.establishments.find((e) => e.id === `e-${property.id}`)!;
      check(
        'Unidade vazia e sem equipe',
        Object.values(created.inventory).every((q) => q === 0) && created.employees === 0,
      );
      check('Equipamento não instalado', created.installed, false);
      await shot('sucesso');
      break;
    }
    case 'opportunities-filter': {
      const select = page.getByLabel('Mercadoria de oportunidade', { exact: true });
      await select.selectOption('coal');
      check('Filtro por produto aplicado', await select.inputValue(), 'coal');
      await shot('sucesso');
      break;
    }
    case 'business-search':
      await page.getByLabel('Buscar estabelecimento', { exact: true }).fill('inexistente-lab');
      check(
        'Estado vazio da busca',
        await page.getByText('Nenhuma unidade encontrada', { exact: true }).isVisible(),
      );
      await shot('vazio');
      await page.getByLabel('Buscar estabelecimento', { exact: true }).fill('');
      check(
        'Lista recuperada',
        (await page.getByRole('button', { name: 'Gerenciar', exact: true }).count()) > 0,
      );
      await shot('sucesso');
      break;
    case 'business-connection': {
      await page.getByRole('button', { name: 'Conectar estruturas', exact: true }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Origem da conexão', { exact: true }).selectOption('e-mine');
      await d.getByLabel('Destino da conexão', { exact: true }).selectOption('e-industry');
      await d.getByLabel('Produto da conexão', { exact: true }).selectOption('iron');
      await d.getByLabel('Mínimo da conexão', { exact: true }).fill('10');
      await d.getByLabel('Alvo da conexão', { exact: true }).fill('100');
      await d.getByLabel('Orçamento da conexão', { exact: true }).fill('5000');
      await shot('preenchimento');
      await submit('Ativar conexão de reposição');
      const rule = unit().supplyPolicy!.rules.find((r) => r.product === 'iron')!;
      check('Origem fixa persistida', rule.originId, 'e-mine');
      check('Alvo persistido', rule.target, 100);
      check('Nenhum transporte disparado ao configurar', world.shipments.length, 0);
      await shot('sucesso');
      break;
    }
    case 'industry-production':
    case 'industry-production-error': {
      const before = structuredClone(unit().inventory),
        beforeBalance = balance();
      if (id === 'industry-production') await shot('vazio');
      await page.getByRole('button', { name: 'Adicionar produção', exact: true }).click();
      await shot('confirmacao');
      await submit('Confirmar produção', id.endsWith('error') ? 409 : 200);
      if (id.endsWith('error')) {
        check(
          'Erro de insumo no modal ativo',
          await page.getByRole('dialog').getByRole('alert').isVisible(),
        );
        check('Estoque intacto após rejeição', unit().inventory, before);
        check('Caixa intacto após rejeição', balance(), beforeBalance);
        check('Nenhum job criado', world.jobs.length, 0);
        await shot('erro');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Fechar janela', exact: true })
          .click();
        check('Modal pode ser fechado após erro', await page.getByRole('dialog').count(), 0);
      } else {
        const job = world.jobs.at(-1)!,
          recipe = world.season.config.recipes.find((r) => r.id === job.recipeId)!;
        for (const [product, quantity] of Object.entries(recipe.input))
          check(
            `Reserva de ${product}`,
            unit().inventory[product as ProductId],
            (before[product as ProductId] ?? 0) - quantity!,
          );
        check('Saída não aparece antes do prazo', unit().inventory.steel, before.steel);
        check('Custo realmente pago', balance() < beforeBalance);
        await advanceTo(job.finishesAt);
        check('Job concluído pelo motor', world.jobs.find((j) => j.id === job.id)!.completed);
        check(
          'Saída de aço recebida',
          unit().inventory.steel,
          (before.steel ?? 0) + (recipe.output.steel ?? 0),
        );
        await shot('sucesso');
      }
      break;
    }
    case 'industry-automation':
      await page.getByRole('button', { name: 'Produção automática', exact: true }).click();
      await page.getByLabel('Ciclos automáticos', { exact: true }).fill('2');
      await page.getByLabel('Orçamento diário de produção', { exact: true }).fill('5000');
      await shot('confirmacao');
      await submit('Salvar e ativar automação');
      check('Automação habilitada', unit().automation);
      check('Ciclos persistidos', unit().automationCycles, 2);
      check('Orçamento em centavos', unit().automationDailyBudget, 500000);
      check('Configuração não fabrica', world.jobs.length, 0);
      await shot('sucesso');
      break;
    case 'industry-toggle': {
      const before = structuredClone(unit().inventory);
      await submit('Pausar novos ciclos', 200, false);
      check('Operação pausada', unit().enabled, false);
      await shot('sucesso', 'pausada');
      await submit('Retomar operação', 200, false);
      check('Operação retomada', unit().enabled);
      check('Estoque preservado', unit().inventory, before);
      await shot('sucesso', 'retomada');
      break;
    }
    case 'industry-offer': {
      const before = structuredClone(unit().inventory);
      await page.getByRole('tab', { name: 'Vendas', exact: true }).click();
      await page
        .getByRole('button', { name: /^(Anunciar|Alterar preço)$/ })
        .first()
        .click();
      await page.getByRole('dialog').locator('input[type="number"]').fill('1234.56');
      await shot('confirmacao');
      await submit('Publicar oferta');
      check(
        'Oferta ao preço confirmado',
        world.offers.some((o) => o.establishmentId === 'e-industry' && o.price === 123456),
      );
      check('Anunciar conserva estoque', unit().inventory, before);
      await shot('sucesso');
      break;
    }
    case 'industry-workforce': {
      await page.getByRole('tab', { name: 'Funcionários', exact: true }).click();
      await page.getByLabel('Funcionários desejados', { exact: true }).fill('100');
      await submit('Aplicar equipe', 200, false);
      check('Equipe persistida', unit().employees, 100);
      const education = unit().education ?? 0,
        before = balance();
      await page
        .getByRole('button', { name: 'Planejar investimento em educação', exact: true })
        .click();
      await shot('confirmacao');
      await submit('Pagar educação e iniciar', 200, false);
      check(
        'Treinamento registrado pendente',
        world.training?.some((t) => t.establishmentId === 'e-industry' && !t.completed),
      );
      check('Educação não é antecipada', unit().education ?? 0, education);
      check('Treinamento pago', balance() < before);
      await shot('sucesso');
      break;
    }
    case 'industry-transfer':
    case 'industry-transfer-limit': {
      await page.getByRole('tab', { name: 'Estoque', exact: true }).click();
      await page.getByRole('button', { name: 'Trazer de outro estoque', exact: true }).click();
      const d = page.getByRole('dialog');
      await d.getByLabel('Origem da transferência', { exact: true }).selectOption('e-mine');
      await d.getByLabel('Produto da transferência', { exact: true }).selectOption('iron');
      await d
        .getByLabel('Quantidade para transferir', { exact: true })
        .fill(id.endsWith('limit') ? '99999' : '1');
      const own = d.locator('[data-carrier="player"]');
      if (id.endsWith('limit')) {
        check(
          'Selecionar frota desabilitado acima do máximo',
          await own
            .getByRole('button', { name: 'Selecionar Minha frota', exact: true })
            .isDisabled(),
        );
        await shot('bloqueado');
        await own.getByRole('button', { name: /Usar máximo/ }).click();
        check(
          'Quantidade ajustada ao limite',
          Number(await d.getByLabel('Quantidade para transferir', { exact: true }).inputValue()) >
            0,
        );
        check(
          'Frota torna-se selecionável',
          await own
            .getByRole('button', { name: 'Selecionar Minha frota', exact: true })
            .isEnabled(),
        );
        check('Ajuste de máximo não emite comando', run.requests.length, 0);
        await shot('sucesso');
      } else {
        const originBefore = unit('e-mine').inventory.iron!,
          destBefore = unit().inventory.iron ?? 0;
        await own.getByRole('button', { name: 'Selecionar Minha frota', exact: true }).click();
        await shot('confirmacao');
        await submit('Confirmar transferência e transporte');
        check('Origem reservada', unit('e-mine').inventory.iron, originBefore - 1);
        check('Destino não recebe antes da chegada', unit().inventory.iron ?? 0, destBefore);
        const shipment = world.shipments.at(-1)!;
        await advanceTo(shipment.arrivesAt);
        check(
          'Entrega concluída pelo motor',
          world.shipments.find((s) => s.id === shipment.id)!.delivered,
        );
        check('Destino recebeu estoque', unit().inventory.iron, destBefore + 1);
        check(
          'Veículo liberado',
          world.vehicles.find((v) => v.id === shipment.vehicleId)!.status,
          'available',
        );
        await shot('sucesso');
      }
      break;
    }
    case 'retail-price': {
      const before = structuredClone(unit('e-retail').inventory),
        cash = balance();
      await page.getByRole('tab', { name: 'Preços', exact: true }).click();
      await page
        .getByRole('button', { name: /^(Alterar preço|Editar preço|Editar)$/ })
        .first()
        .click();
      await page.getByLabel('Preço de venda', { exact: true }).fill('12.34');
      await shot('confirmacao');
      await submit('Salvar preço');
      check('Preço em centavos persistido', Object.values(unit('e-retail').prices).includes(1234));
      check('Alterar preço conserva estoque', unit('e-retail').inventory, before);
      check('Alterar preço conserva caixa', balance(), cash);
      await shot('sucesso');
      break;
    }
    case 'retail-supply': {
      const before = observe(world);
      await page.getByRole('tab', { name: 'Abastecimento', exact: true }).click();
      const planner = page.locator('.supply-planner');
      await planner.getByRole('tab', { name: 'Avançada', exact: true }).click();
      await planner.getByLabel('Ativar abastecimento automático', { exact: true }).check();
      await planner.getByLabel('Orçamento de abastecimento', { exact: true }).fill('5000');
      await planner
        .getByLabel('Origem do abastecimento', { exact: true })
        .selectOption('internal-only');
      await shot('preenchimento');
      await submit('Salvar regras de abastecimento', 200, false);
      check('Reposição habilitada', unit('e-retail').supplyPolicy!.enabled);
      check('Orçamento em centavos', unit('e-retail').supplyPolicy!.dailyBudget, 500000);
      check('Salvar não compra estoque', observe(world).inventory, before.inventory);
      check('Salvar não cobra', observe(world).balances, before.balances);
      await shot('sucesso');
      break;
    }
    case 'market-open-request': {
      const before = observe(world);
      await page.locator('summary').filter({ hasText: 'Pedidos e negociações' }).click();
      await page.getByRole('button', { name: 'Publicar pedido de compra', exact: true }).click();
      const d = page.getByRole('dialog');
      check(
        'Pedido incompleto bloqueado',
        await d
          .getByRole('button', { name: 'Publicar pedido sem cobrança', exact: true })
          .isDisabled(),
      );
      await shot('bloqueado');
      await d.getByLabel('Destino do pedido aberto', { exact: true }).selectOption('e-industry');
      await d.getByLabel('Mercadoria do pedido aberto', { exact: true }).selectOption('coal');
      await d.getByLabel('Quantidade do pedido aberto', { exact: true }).fill('3');
      await d.getByLabel('Preço do pedido aberto', { exact: true }).fill('500');
      await d.getByLabel('Frete do pedido aberto', { exact: true }).fill('5000');
      await shot('preenchimento');
      await submit('Publicar pedido sem cobrança');
      check(
        'Pedido pendente e sem vendedor',
        world.orders.at(-1)!.status === 'pending' && world.orders.at(-1)!.sellerId === '',
      );
      check('Sem cobrança antes de aceite', observe(world).balances, before.balances);
      check('Sem transporte antes de aceite', world.shipments.length, 0);
      await shot('sucesso');
      break;
    }
    case 'market-purchase-delivery': {
      await page.getByLabel('Produto', { exact: true }).selectOption('coal');
      await page.getByLabel('Destino da compra', { exact: true }).selectOption('e-industry');
      await page.getByLabel('Quantidade de mercadoria', { exact: true }).fill('3');
      await page
        .getByRole('row')
        .filter({ hasText: 'FerroVale Comercial' })
        .getByRole('button', { name: 'Selecionar', exact: true })
        .click();
      await shot('preenchimento');
      await page.getByRole('button', { name: 'Continuar para frete', exact: true }).click();
      await page
        .getByRole('button', { name: /^Selecionar / })
        .first()
        .click();
      await page.getByRole('button', { name: 'Contratar e comprar', exact: true }).click();
      await shot('confirmacao');
      const before = balance(),
        inventory = unit().inventory.coal ?? 0;
      await submit(/^Pagar /);
      const shipment = world.shipments.at(-1)!;
      check(
        'Compra gera remessa',
        !!shipment && shipment.product === 'coal' && shipment.quantity === 3,
      );
      check('Pagamento debitado', balance() < before);
      check('Carvão ainda em trânsito', unit().inventory.coal ?? 0, inventory);
      await advanceTo(
        Math.max(...world.shipments.filter((s) => !s.delivered).map((s) => s.arrivesAt)),
      );
      check('Mercadoria recebida após prazo', unit().inventory.coal, inventory + 3);
      check(
        'Todas as partes entregues',
        world.shipments.every((s) => s.delivered),
      );
      await shot('sucesso');
      break;
    }
    case 'market-negotiation': {
      await showAs('player2');
      await openSection('Pedidos e negociações');
      await page.getByRole('button', { name: 'Publicar pedido de compra', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog
        .getByLabel('Destino do pedido aberto', { exact: true })
        .selectOption('e-newindustry');
      await dialog.getByLabel('Mercadoria do pedido aberto', { exact: true }).selectOption('iron');
      await dialog.getByLabel('Quantidade do pedido aberto', { exact: true }).fill('65');
      await dialog.getByLabel('Preço do pedido aberto', { exact: true }).fill('500');
      await dialog.getByLabel('Frete do pedido aberto', { exact: true }).fill('10000');
      await submit('Publicar pedido sem cobrança');
      const orderId = world.orders.at(-1)!.id;
      const buyerBefore = world.companies.find((c) => c.id === 'player2')!.balance;
      await showAs('player');
      await openSection('Pedidos e negociações');
      await page
        .locator('.commercial-order')
        .filter({ hasText: `#${orderId.slice(0, 6)}` })
        .getByRole('button', { name: 'Fazer proposta', exact: true })
        .click();
      check(
        'Proposta sem origem bloqueada',
        await dialog.getByRole('button', { name: 'Enviar proposta', exact: true }).isDisabled(),
      );
      await shot('bloqueado');
      await dialog.getByLabel('Origem da proposta', { exact: true }).selectOption('e-industry');
      await dialog.getByLabel('Preço proposto', { exact: true }).fill('490');
      await dialog
        .getByRole('button', { name: 'Selecionar TransBrasil Logística', exact: true })
        .click();
      await shot('preenchimento');
      await submit('Enviar proposta');
      check(
        'Proposta não cobra comprador',
        world.companies.find((c) => c.id === 'player2')!.balance,
        buyerBefore,
      );
      await showAs('player2');
      await openSection('Pedidos e negociações');
      await page
        .locator('.commercial-order')
        .filter({ hasText: `#${orderId.slice(0, 6)}` })
        .getByRole('button', { name: 'Contrapropor', exact: true })
        .click();
      await dialog.getByLabel('Preço proposto', { exact: true }).fill('480');
      await submit('Enviar proposta');
      check(
        'Contraproposta registrada pela contraparte',
        world.orders.find((o) => o.id === orderId)!.proposals!.at(-1)!.proposedBy,
        'player2',
      );
      await showAs('player');
      await openSection('Pedidos e negociações');
      await page
        .locator('.commercial-order')
        .filter({ hasText: `#${orderId.slice(0, 6)}` })
        .getByRole('button', { name: 'Revisar e aceitar', exact: true })
        .click();
      await shot('confirmacao');
      await submit('Confirmar aceitação e transporte');
      const order = world.orders.find((o) => o.id === orderId)!;
      check(
        'Pedido aceito com preço contraproposto',
        order.status === 'accepted' && order.unitPrice === 48000,
      );
      check(
        'Três caminhões realmente despachados',
        world.shipments.filter((s) => s.orderId === orderId).length,
        3,
      );
      check(
        'Comprador pagou somente no aceite',
        world.companies.find((c) => c.id === 'player2')!.balance < buyerBefore,
      );
      await shot('sucesso');
      break;
    }
    case 'market-infrastructure': {
      const contract = world.infrastructure.find(
        (c) => c.state === 'SP' && c.product === 'steel' && c.status === 'open',
      )!;
      check(
        'Edital criado pelo tick normal',
        !!contract && contract.quantity <= (unit().inventory.steel ?? 0),
      );
      await openSection('Contratos de infraestrutura');
      await page.getByLabel('Estado dos contratos públicos', { exact: true }).selectOption('SP');
      const card = page
        .locator('.commercial-order')
        .filter({ hasText: `#${contract.id.slice(0, 6)}` });
      await card.getByRole('button', { name: 'Participar da disputa', exact: true }).click();
      const dialog = page.getByRole('dialog');
      check(
        'Proposta incompleta bloqueada',
        await dialog.getByRole('button', { name: 'Registrar proposta', exact: true }).isDisabled(),
      );
      await shot('bloqueado');
      await dialog
        .getByLabel('Origem da proposta pública', { exact: true })
        .selectOption('e-industry');
      await shot('preenchimento');
      await dialog
        .getByRole('button', { name: 'Selecionar TransBrasil Logística', exact: true })
        .click();
      await shot('confirmacao');
      const before = balance();
      await submit('Registrar proposta');
      check('Participar não paga fornecedor', balance(), before);
      check(
        'Proposta válida registrada',
        world.infrastructure
          .find((c) => c.id === contract.id)!
          .bids!.some((bid) => bid.supplierId === 'player' && bid.status === 'valid'),
      );
      await advanceTo(contract.biddingEndsAt!);
      check(
        'Adjudicação pelo motor',
        world.infrastructure.find((c) => c.id === contract.id)!.supplierId,
        'player',
      );
      const shipments = world.shipments.filter((s) => s.infrastructureId === contract.id);
      check('Contrato público tem partes físicas', shipments.length > 1);
      await shot('sucesso', 'adjudicado');
      await advanceTo(Math.max(...shipments.map((s) => s.arrivesAt)));
      check(
        'Contrato concluído após última entrega',
        world.infrastructure.find((c) => c.id === contract.id)!.status,
        'completed',
      );
      check('Aço consumido pelo destino público', world.consumedMaterials.steel, contract.quantity);
      await shot('sucesso', 'entregue');
      break;
    }
    case 'logistics-order': {
      const order = world.orders.at(-1)!,
        shipments = world.shipments.filter((s) => s.orderId === order.id);
      check(
        'Fixture contratada por comandos normais',
        order.status === 'accepted' && shipments.length === 3,
      );
      await page
        .locator('.shipment-item')
        .filter({ hasText: order.id.slice(0, 6).toUpperCase() })
        .click();
      await page.getByRole('heading', { name: 'Caminhões deste pedido', exact: true }).waitFor();
      await page.locator('.shipment-dashboard table tbody tr').nth(2).waitFor();
      check(
        'Três caminhões observáveis na interface',
        await page.locator('.shipment-dashboard table tbody tr').count(),
        3,
      );
      await shot('preenchimento');
      const lastAt = Math.max(...shipments.map((s) => s.arrivesAt));
      await advanceTo(lastAt - 1);
      check(
        'Pedido permanece em entrega antes da última chegada',
        world.orders.find((o) => o.id === order.id)!.status,
        'accepted',
      );
      await advanceTo(lastAt);
      check(
        'Pedido concluído na última chegada',
        world.orders.find((o) => o.id === order.id)!.status,
        'delivered',
      );
      check(
        'Todas as partes foram entregues',
        world.shipments.filter((s) => s.orderId === order.id).every((s) => s.delivered),
      );
      await shot('sucesso');
      break;
    }
    case 'logistics-empty':
      await page.getByRole('tab', { name: 'Contratar frete', exact: true }).click();
      check(
        'Estado vazio explica compra prévia',
        await page.getByText('Monte a compra antes de contratar', { exact: true }).isVisible(),
      );
      await shot('vazio');
      await page.getByRole('button', { name: 'Abrir mercado', exact: true }).click();
      await page.getByRole('heading', { name: 'Mercado de mercadorias', exact: true }).waitFor();
      check(
        'Próxima ação abre mercado',
        await page
          .getByRole('heading', { name: 'Mercado de mercadorias', exact: true })
          .isVisible(),
      );
      await shot('sucesso');
      break;
    case 'carrier-purchase':
    case 'carrier-purchase-error': {
      const before = balance(),
        fleet = world.vehicles.filter((v) => v.companyId === 'player').length;
      await page.getByRole('button', { name: 'Comprar veículo', exact: true }).click();
      await shot('confirmacao');
      const button = page.getByRole('dialog').getByRole('button', { name: /^Comprar por/ });
      if (id.endsWith('error') && (await button.isDisabled())) {
        check('Compra bloqueada com caixa insuficiente', true);
        check(
          'Motivo recuperável de caixa aparece antes de tentar',
          await page.locator('#vehicle-purchase-blocked').isVisible(),
        );
        check('Bloqueio preventivo não envia comando financeiro', run.requests.length, 0);
        await shot('bloqueado');
      } else {
        await submit(/^Comprar por/, id.endsWith('error') ? 409 : 200);
        if (id.endsWith('error')) {
          check(
            'Erro recuperável no modal',
            await page.getByRole('dialog').getByRole('alert').isVisible(),
          );
          await shot('erro');
        } else await shot('sucesso');
      }
      check(
        'Quantidade de veículos esperada',
        world.vehicles.filter((v) => v.companyId === 'player').length,
        fleet + (id.endsWith('error') ? 0 : 1),
      );
      check('Saldo após tentativa', balance(), before - (id.endsWith('error') ? 0 : 28000000));
      break;
    }
    case 'company-recovery-loan': {
      await page
        .locator('summary')
        .filter({ hasText: 'Planejar recuperação e ver compromissos' })
        .click();
      await page.getByLabel('Estado do crédito', { exact: true }).selectOption('SP');
      await page.getByLabel('Principal solicitado', { exact: true }).fill('1000');
      await page.getByRole('button', { name: 'Revisar crédito e parcelas', exact: true }).click();
      await shot('confirmacao');
      const before = balance();
      await submit('Confirmar operação');
      const loan = world.loans!.at(-1)!;
      check('Principal registrado', loan.principal, 100000);
      check('Entrada líquida após taxa de 2%', balance(), before + 98000);
      await page.getByRole('button', { name: 'Revisar quitação', exact: true }).click();
      await submit('Confirmar operação');
      check('Principal quitado', world.loans!.find((l) => l.id === loan.id)!.repaid, 100000);
      check('Custo líquido é a taxa', balance(), before - 2000);
      await shot('sucesso');
      break;
    }
    case 'company-suspension': {
      const before = structuredClone(unit().inventory);
      await page
        .locator('summary')
        .filter({ hasText: 'Planejar recuperação e ver compromissos' })
        .click();
      const row = page.getByRole('row').filter({ hasText: 'Indústria de Aço' });
      await row.getByRole('button', { name: 'Suspender estrutura', exact: true }).click();
      await shot('confirmacao');
      await submit('Confirmar operação');
      check('Suspensão persistida', unit().mothballed);
      check('Equipe encerrada', unit().employees, 0);
      check('Estoque preservado na suspensão', unit().inventory, before);
      await shot('sucesso', 'suspensa');
      await row.getByRole('button', { name: 'Reativar estrutura', exact: true }).click();
      await submit('Confirmar operação');
      check('Estrutura reativada', unit().mothballed, false);
      check('Reativação não recontrata', unit().employees, 0);
      await shot('sucesso', 'reativada');
      break;
    }
    case 'company-obligations': {
      const due = arrears(world, 'player');
      check('Obrigações geradas por tick sem caixa', due > 0);
      check(
        'Pagamento sem valor ou caixa bloqueado',
        await page.getByRole('button', { name: 'Revisar pagamento', exact: true }).isDisabled(),
      );
      await shot('bloqueado');
      await page.getByLabel('Estado do crédito', { exact: true }).selectOption('SP');
      await page.getByLabel('Principal solicitado', { exact: true }).fill('100000');
      await page.getByRole('button', { name: 'Revisar crédito e parcelas', exact: true }).click();
      await submit('Confirmar operação');
      const before = balance(),
        expenses = world.establishments
          .filter((e) => e.companyId === 'player')
          .reduce((n, e) => n + e.expenses, 0);
      await page.getByLabel('Pagamento de atrasados', { exact: true }).fill((due / 100).toFixed(2));
      await page.getByRole('button', { name: 'Revisar pagamento', exact: true }).click();
      await shot('confirmacao');
      await submit('Confirmar operação');
      check('Atrasados quitados', arrears(world, 'player'), 0);
      check('Pagamento debitou o valor devido', balance(), before - due);
      check(
        'Despesa não foi reconhecida duas vezes',
        world.establishments
          .filter((e) => e.companyId === 'player')
          .reduce((n, e) => n + e.expenses, 0),
        expenses,
      );
      await shot('sucesso');
      break;
    }
    case 'company-vehicle-sale': {
      const quoted = quote(world, 'e-mine', 'e-industry', 'iron', 1, 'player');
      const vehicleId = quoted.parts[0].vehicleId;
      const vehicle = world.vehicles.find((v) => v.id === vehicleId)!;
      await openSection('Planejar recuperação e ver compromissos');
      await page.getByLabel('Veículo para vender', { exact: true }).selectOption(vehicleId);
      await page.getByRole('button', { name: 'Revisar venda do veículo', exact: true }).click();
      await shot('confirmacao');
      prepare('player', {
        type: 'transferStock',
        originId: 'e-mine',
        destinationId: 'e-industry',
        product: 'iron',
        quantity: 1,
        carrierId: 'player',
      });
      check(
        'Veículo foi ocupado por transferência concorrente real',
        world.vehicles.find((v) => v.id === vehicleId)!.status,
        'route',
      );
      const cashBeforeError = balance();
      await submit('Confirmar operação', 409);
      check(
        'Rejeição mantém titularidade',
        world.vehicles.find((v) => v.id === vehicleId)!.companyId,
        'player',
      );
      check('Rejeição não cria recebimento', balance(), cashBeforeError);
      await shot('erro');
      const shipment = world.shipments.find((s) => s.vehicleId === vehicleId)!;
      await advanceTo(shipment.arrivesAt);
      await openSection('Planejar recuperação e ver compromissos');
      await page.getByLabel('Veículo para vender', { exact: true }).selectOption(vehicleId);
      await page.getByRole('button', { name: 'Revisar venda do veículo', exact: true }).click();
      const before = balance(),
        price = Math.floor((vehicle.purchasePrice ?? 28000000) * 0.65);
      await submit('Confirmar operação');
      check(
        'Venda transfere titularidade ao tesouro estadual',
        world.vehicles.find((v) => v.id === vehicleId)!.companyId.startsWith('treasury:'),
      );
      check('Liquidação paga exatamente o valor declarado', balance(), before + price);
      await shot('sucesso');
      break;
    }
    case 'business-installation': {
      const target = unit('e-hortolandia');
      check('Imóvel adquirido ainda sem equipamento', target.installed, false);
      await page
        .getByLabel('Especialidade da instalação', { exact: true })
        .selectOption('steel-bars');
      await page.getByLabel('Linhas de equipamento', { exact: true }).fill('1');
      await shot('preenchimento');
      await page
        .getByRole('button', { name: 'Revisar investimento em equipamento', exact: true })
        .click();
      await shot('confirmacao');
      const before = balance(),
        price = world.season.config.design.equipmentCost.industry;
      await submit('Pagar equipamento e instalar');
      const installed = unit('e-hortolandia');
      check('Equipamento instalado na unidade adquirida', installed.installed);
      check(
        'Linha e especialidade persistidas',
        installed.equipmentLines === 1 && installed.specialization === 'steel-bars',
      );
      check('Equipamento foi pago', balance(), before - price);
      check('Instalação não contrata equipe', installed.employees, 0);
      check(
        'Instalação não abastece nem produz',
        Object.values(installed.inventory).every((q) => q === 0) && world.jobs.length === 0,
      );
      await shot('sucesso');
      break;
    }
    default:
      throw Error(`Fluxo ${id} está marcado exercitável mas não tem executor.`);
  }
  check('Dinheiro conservado no fluxo', observe(world).money, money);
  check(
    'Saldos válidos em centavos',
    world.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0),
  );
  check(
    'Estoques físicos não negativos',
    world.establishments.every((e) =>
      Object.values(e.inventory).every((q) => Number.isFinite(q) && q! >= 0),
    ),
  );
  run.observations.push({ phase: 'estado final observado', world: observe(world) });
}
try {
  for (const screen of catalog.screens.filter(
    (screen) =>
      !flowFilter ||
      uiFlows.some((flow) => flow.screen === screen.id && flowFilter.includes(flow.id)),
  )) {
    const old = previous?.screens.find((s) => s.id === screen.id);
    const fresh =
      previous?.engineFingerprint === engineFingerprint &&
      old?.fingerprint === screen.fingerprint &&
      (!runFlows ||
        uiFlows
          .filter((f) => f.screen === screen.id && f.exercisedBy)
          .every((f) =>
            ['desktop', 'mobile'].every((viewport) =>
              previous.flowRuns?.some(
                (run) =>
                  run.flowId === f.id && run.viewport === viewport && run.status === 'passed',
              ),
            ),
          )) &&
      !old.errors.length &&
      old.captures.every((c) => existsSync(resolve(output, c.screenshot)));
    if ((!force && fresh) || (only && only !== screen.id)) {
      if (old) {
        report.screens.push(old);
        report.flowRuns!.push(
          ...(previous?.flowRuns?.filter((run) =>
            uiFlows.some((f) => f.id === run.flowId && f.screen === screen.id),
          ) ?? []),
        );
        report.summary.reused++;
      }
      continue;
    }
    const evidence: UiScreenEvidence = {
      id: screen.id,
      fingerprint: screen.fingerprint,
      capturedAt: new Date().toISOString(),
      captures: [],
      errors: [],
      flowIds: uiFlows.filter((f) => f.screen === screen.id).map((f) => f.id),
    };
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      world = freshWorld();
      const context = await browser.newContext({
        viewport,
        reducedMotion: 'reduce',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      });
      // tsx preserva nomes de funções locais ao serializar callbacks de page.evaluate.
      await context.addInitScript('globalThis.__name = (fn) => fn;');
      const page = await context.newPage();
      page.on('pageerror', (e) => evidence.errors.push(e.message));
      page.on('console', (message) => {
        // Rejeições de regra esperadas ficam no request/asserção do fluxo, sem virar erro de captura.
        const expectedRuleRejection =
          message.text().includes('409 (Conflict)') &&
          activeRun?.requests.some((request) => request.status === 409);
        if (message.type() === 'error' && !expectedRuleRejection)
          evidence.errors.push(message.text());
      });
      await page.clock.setFixedTime(at);
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/world') return route.fulfill({ json: world });
        if (runFlows && url.pathname === '/api/commands' && route.request().method() === 'POST') {
          const command = route.request().postDataJSON() as Command;
          const actor = route.request().headers()['x-company-id'] ?? 'player';
          const before = observe(world);
          let status = 200,
            error: string | undefined;
          try {
            const next = structuredClone(world);
            deterministic(() => execute(next, actor, command, next.updatedAt));
            if (
              observe(next).money !== before.money ||
              next.companies.some((c) => c.balance < 0 || !Number.isSafeInteger(c.balance))
            )
              throw Error('Invariante monetário violado pela execução.');
            world = next;
          } catch (e) {
            status = 409;
            error = e instanceof Error ? e.message : String(e);
          }
          activeRun?.requests.push({
            command,
            actor,
            status,
            error,
            before,
            after: observe(world),
          });
          return route.fulfill({ status, json: error ? { error } : world });
        }
        if (url.pathname === '/api/route') {
          const origin = world.properties.find((p) => p.id === url.searchParams.get('origin'));
          const destination = world.properties.find(
            (p) => p.id === url.searchParams.get('destination'),
          );
          if (!origin || !destination)
            return route.fulfill({
              status: 404,
              json: { error: 'Origem/destino da fixture não encontrados.' },
            });
          const road = {
            source: 'osrm' as const,
            profile: 'driving' as const,
            distanceKm: 10,
            durationSeconds: 600,
            coordinates: [origin.coordinates, destination.coordinates],
            steps: [],
          };
          world.routes[`${origin.id}:${destination.id}`] = road;
          return route.fulfill({ json: road });
        }
        if (url.pathname === '/api/market-history') {
          const product = url.searchParams.get('product'),
            regionId = url.searchParams.get('region') ?? '';
          return route.fulfill({
            json: {
              product,
              regionId,
              startedAt: world.economyStartedAt,
              seasonId: world.season.id,
              samples: world.marketHistory
                .filter((s) => s.product === product && s.regionId === regionId)
                .slice(-1000),
              trades: world.ledger
                .filter(
                  (entry) =>
                    entry.product === product &&
                    entry.channel === 'wholesale' &&
                    (!regionId ||
                      (regionId.startsWith('state:')
                        ? regions.find((r) => r.id === entry.regionId)?.state === regionId.slice(6)
                        : entry.regionId === regionId)),
                )
                .slice(-2000),
            },
          });
        }
        if (url.pathname === '/__lab/empty.pbf')
          return route.fulfill({ body: Buffer.alloc(0), contentType: 'application/x-protobuf' });
        if (url.pathname.startsWith('/api/')) {
          evidence.errors.push(`API não prevista: ${url.pathname}`);
          return route.fulfill({
            status: 503,
            json: { error: 'Fixture de inspeção: operação não executada.' },
          });
        }
        if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
          if (url.hostname === 'tiles.openfreemap.org')
            return route.fulfill({
              json: {
                tilejson: '3.0.0',
                tiles: [`http://127.0.0.1:${port}/__lab/empty.pbf?z={z}&x={x}&y={y}`],
                minzoom: 0,
                maxzoom: 14,
                vector_layers: ['landcover', 'water', 'waterway', 'transportation'].map((id) => ({
                  id,
                  fields: {},
                })),
              },
            });
          return route.fulfill({ status: 200, body: '', contentType: 'application/octet-stream' });
        }
        return route.continue();
      });
      await page.addInitScript(
        ({ id, business }) => {
          if (localStorage.getItem('aftermarket.lab-fixture') !== '1') {
            localStorage.clear();
            localStorage.setItem('aftermarket.lab-fixture', '1');
            localStorage.setItem('aftermarket.page', id);
            if (business) localStorage.setItem('aftermarket.business', business);
          }
        },
        { id: screen.id, business: 'business' in screen ? screen.business : undefined },
      );
      try {
        await page.goto(`http://127.0.0.1:${port}/jogar`, { waitUntil: 'domcontentloaded' });
        await page.locator('#main-content').waitFor({ timeout: 15000 });
        await page
          .locator('#main-content')
          .getByRole('heading')
          .first()
          .waitFor({ timeout: 15000 });
        if (await page.locator('[data-map-ready]:visible').count())
          await page.locator('[data-map-ready="true"]:visible').first().waitFor({ timeout: 10000 });
        evidence.captures.push(await snapshot(page, screen.id, 'abertura', viewport.name));
        const tabs = await page.getByRole('tab').allTextContents();
        for (const tab of tabs) {
          const button = page.getByRole('tab', { name: tab, exact: true }).first();
          if ((await button.getAttribute('aria-selected')) === 'true') continue;
          await button.click();
          evidence.captures.push(await snapshot(page, screen.id, `aba ${tab}`, viewport.name));
        }
        // Modais não financeiros: abrir e inspecionar sem confirmar comandos.
        const modals: Record<string, (string | RegExp)[]> = {
          industry: ['Adicionar produção'],
          company: ['Abrir finanças detalhadas'],
          carrier: ['Comprar veículo'],
          purchase: [/^Confirmar compra/],
          market: ['Publicar pedido de compra'],
          opportunities: [/^Ver mais/],
        };
        if (tabs.length)
          await page.getByRole('tab', { name: tabs[0], exact: true }).first().click();
        for (const name of modals[screen.id] ?? []) {
          const button = page.getByRole('button', { name, exact: true }).first();
          if (!(await button.count()) || !(await button.isVisible()) || !(await button.isEnabled()))
            continue;
          await button.click();
          if (await page.getByRole('dialog').count()) {
            evidence.captures.push(
              await snapshot(page, screen.id, `janela ${name}`, viewport.name),
            );
            await page.getByRole('button', { name: 'Fechar janela', exact: true }).last().click();
          }
        }
        if (runFlows) {
          for (const definition of uiFlows.filter(
            (f) => f.screen === screen.id && (!flowFilter || flowFilter.includes(f.id)),
          )) {
            const run: UiFlowRun = {
              flowId: definition.id,
              viewport: viewport.name,
              status: definition.exercisedBy ? 'passed' : 'not-exercised',
              states: [],
              assertions: [],
              requests: [],
              captures: [],
            };
            report.flowRuns!.push(run);
            if (!definition.exercisedBy) {
              run.reason =
                'Contrato catalogado; percurso completo ainda não automatizado nesta coleta.';
              continue;
            }
            activeRun = run;
            try {
              await exerciseFlow(page, definition.id, viewport.name, evidence);
            } catch (e) {
              run.status = 'failed';
              run.error = e instanceof Error ? e.message : String(e);
              evidence.errors.push(`${viewport.name}/${definition.id}: ${run.error}`);
            } finally {
              activeRun = undefined;
            }
          }
        }
      } catch (e) {
        evidence.errors.push(`${viewport.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        await context.close();
      }
    }
    report.screens.push(evidence);
    report.summary.captured++;
    writeFileSync(index, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify({
        screen: screen.id,
        states: evidence.captures.length,
        errors: evidence.errors.length,
      }),
    );
  }
  // Estados globais: carga e falha de conexão, sem depender de desligar a API real.
  for (const state of ['carregamento', 'conexao indisponivel']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript('globalThis.__name = (fn) => fn;');
    const page = await context.newPage();
    await page.route('**/api/world', async (route) => {
      if (state === 'carregamento') await new Promise((done) => setTimeout(done, 3000));
      await route
        .fulfill({ status: 503, json: { error: 'Falha controlada' } })
        .catch(() => undefined);
    });
    await page.goto(`http://127.0.0.1:${port}/jogar`);
    await page
      .getByText(
        state === 'carregamento'
          ? 'Conectando à economia…'
          : 'Não foi possível conectar ao mundo. Verifique se o servidor está em execução.',
      )
      .waitFor();
    report.globalStates.push(await snapshot(page, 'global', state, 'mobile'));
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
const captures = [...report.screens.flatMap((s) => s.captures), ...report.globalStates];
report.summary.states = captures.length;
report.summary.errors = report.screens.reduce((n, s) => n + s.errors.length, 0);
report.summary.overflow = captures.filter((s) => s.overflow).length;
report.summary.unnamed = captures.reduce((n, s) => n + s.unnamed, 0);
if (acceptBaseline) saveBaseline(report);
if (compare || acceptBaseline) report.comparison = compareBaseline(report, acceptBaseline);
writeFileSync(index, JSON.stringify(report, null, 2) + '\n');
// Resumo compacto para agentes: abrir detalhes/screenshot somente quando necessário.
writeFileSync(
  resolve(output, 'summary.json'),
  JSON.stringify(
    {
      generatedAt: report.generatedAt,
      fixture: report.fixture,
      summary: report.summary,
      flowCatalog: report.flowCatalog,
      flowRuns: report.flowRuns?.map(({ observations: _observations, requests, ...run }) => ({
        ...run,
        requests: requests.map((q) => ({
          command: q.command,
          actor: q.actor,
          status: q.status,
          error: q.error,
        })),
      })),
      comparison: report.comparison,
      screens: report.screens.map((s) => ({
        id: s.id,
        fingerprint: s.fingerprint,
        capturedAt: s.capturedAt,
        errors: s.errors,
        states: s.captures.map((c) => ({
          state: c.state,
          viewport: c.viewport,
          headings: c.headings,
          controls: c.controls.length,
          overflow: c.overflow,
          unnamed: c.unnamed,
          screenshot: c.screenshot,
        })),
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    report: index,
    ...report.summary,
    flows: {
      passed: report.flowRuns?.filter((r) => r.status === 'passed').length,
      failed: report.flowRuns?.filter((r) => r.status === 'failed').length,
      notExercised: report.flowRuns?.filter((r) => r.status === 'not-exercised').length,
    },
    comparison: report.comparison?.summary,
  }),
);
if (report.summary.errors) process.exitCode = 1;
