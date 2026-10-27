import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('laboratório executa A/B real, conserva dinheiro e exporta sem acessar o mundo salvo', async ({
  page,
}, testInfo) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(world|commands)(?:\?|$)/.test(request.url())) apiRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Entender antes de ajustar.' })).toBeVisible();
  await page.getByLabel('Dias simulados').fill('1');
  await page.getByRole('button', { name: 'Iniciar lote' }).click();
  await expect(page.getByRole('status')).toContainText('Lote concluído', { timeout: 45000 });
  await expect(page.getByRole('progressbar', { name: 'Progresso do lote' })).toHaveAttribute(
    'value',
    '100',
  );
  await expect(page.getByRole('region', { name: 'Comparação pareada' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Tabela de mercadorias' }).locator('tbody tr'),
  ).toHaveCount(10);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar lote JSON' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('lab-report.json');
  await download.saveAs(path);
  const report = JSON.parse(await readFile(path, 'utf8'));
  expect(report.results).toHaveLength(2);
  expect(report.results.map((r: { side: string }) => r.side)).toEqual(['A', 'B']);
  for (const result of report.results) {
    expect(result.seed).toBe(0);
    expect(result.report.options.days).toBe(1);
    expect(result.report.observations).toHaveLength(2);
    expect(result.report.summary.moneyConserved).toBe(true);
    expect(result.report.metadata.humanActions).toBe(false);
    expect(result.report.metadata.routingMode).toBe('estimate');
  }
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('lab-simulation-desktop.png'),
    fullPage: true,
  });
});

test('cancelamento interrompe worker e permite iniciar outro lote', async ({ page }) => {
  await page.goto('/lab');
  await page.getByLabel('Dias simulados').fill('365');
  await page.getByLabel('Sementes no lote').selectOption('2');
  await page.getByRole('button', { name: 'Iniciar lote' }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Lote cancelado');
  await expect(page.getByLabel('Dias simulados')).toBeEnabled();
  await page.getByLabel('Dias simulados').fill('1');
  await page.getByLabel('Sementes no lote').selectOption('1');
  await page.getByRole('button', { name: 'Iniciar lote' }).click();
  await expect(page.getByRole('status')).toContainText('Lote concluído', { timeout: 45000 });
  await expect(page.getByRole('region', { name: 'Comparação pareada' })).toBeVisible();
});

test('catálogo funciona sem evidência, busca pelo teclado e cabe em 390px', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let evidenceRequests = 0;
  await page.route('**/__lab/ui/index.json', (route) => {
    evidenceRequests++;
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/__lab/ui/comparison.json', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/lab');
  const interfaces = page.getByRole('button', { name: 'Interfaces', exact: true });
  await interfaces.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mapa das interfaces' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Ainda não há capturas locais');
  await expect(page.getByRole('region', { name: 'Comparação com baseline' })).toContainText(
    'Nenhuma referência aprovada disponível',
  );
  const screens = page.getByRole('navigation', { name: 'Telas do jogo' });
  await expect(screens.getByRole('button')).toHaveCount(10);
  await page.getByLabel('Buscar tela').fill('Mercado');
  await expect(screens.getByRole('button')).toHaveCount(2);
  await screens.getByRole('button', { name: /^Mercado/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Mercado', exact: true })).toBeVisible();
  await expect(page.getByText('Sem captura', { exact: true })).toBeVisible();
  const beforeReload = evidenceRequests;
  await page.getByRole('button', { name: 'Recarregar evidência' }).click();
  await expect(page.getByRole('status')).toContainText('Ainda não há capturas locais');
  await expect.poll(() => evidenceRequests).toBe(beforeReload + 1);
  await page.screenshot({ path: testInfo.outputPath('lab-catalog-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const method = page.getByRole('button', { name: 'Método', exact: true });
  await method.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Da observação à decisão' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('consulta bot, produto e dia com parâmetros e registra um experimento real', async ({
  page,
}, testInfo) => {
  await page.goto('/lab');
  await page.getByLabel('Dias simulados').fill('1');
  await page.getByLabel('Variação das sementes').selectOption('conditions');
  const scenarioB = page.getByRole('group', { name: 'Cenário B', exact: true });
  await scenarioB
    .getByRole('combobox', { name: 'Configuração', exact: true })
    .selectOption('baseline');
  await scenarioB
    .locator('summary')
    .filter({ hasText: 'Custos, capacidade e comportamento' })
    .click();
  await scenarioB.getByLabel('Multiplicador de custo operacional').fill('1.1');
  await scenarioB.getByLabel('Multiplicador de velocidade de produção').fill('1.05');
  await scenarioB.getByLabel('Receita alvo da velocidade (opcional)').selectOption('soy-oil');
  await scenarioB.getByLabel('Multiplicador de frete', { exact: true }).fill('1.2');
  await scenarioB.getByLabel('Política dos bots').selectOption('value');
  await scenarioB.getByLabel('Aplicar choque durante a simulação').check();
  await scenarioB.getByLabel('Dia do choque').fill('1');
  await page.getByRole('button', { name: 'Iniciar lote' }).click();
  await expect(page.getByRole('status')).toContainText('Lote concluído', { timeout: 45000 });
  await page.getByRole('combobox', { name: 'Execução', exact: true }).selectOption('B-0');
  await page.getByLabel('Bot observado').selectOption({ index: 1 });
  await expect(page.getByRole('img', { name: /Evolução do caixa e obrigações/ })).toBeVisible();
  await page.getByLabel('Dia observado').fill('0');
  await expect(page.locator('.lab-query-summary')).toContainText('Consulta no dia 0');
  await page.getByLabel('Dia observado').fill('1');
  await page.getByLabel('Produto observado').selectOption('iron');
  await expect(
    page.getByRole('img', { name: 'Evolução de Minério de ferro', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('O filtro de produto inclui apenas eventos', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Produto observado').selectOption('');
  await page.getByLabel('Resultado da decisão').selectOption('rejected');
  await page.getByLabel('Buscar motivo').fill('caixa');
  await expect(page.getByRole('region', { name: 'Consulta por bot, produto e dia' })).toContainText(
    'Decisões e impedimentos reais',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar lote JSON' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('experiment-report.json');
  await download.saveAs(path);
  const exported = JSON.parse(await readFile(path, 'utf8'));
  const report = exported.results.find((entry: { side: string }) => entry.side === 'B').report;
  expect(report.options.costMultiplier).toBe(1.1);
  expect(report.options.capacityMultiplier).toBe(1.05);
  expect(report.options.capacityRecipe).toBe('soy-oil');
  expect(report.options.freightMultiplier).toBe(1.2);
  expect(report.options.botPolicy).toBe('value');
  expect(report.options.seedMode).toBe('conditions');
  expect(report.metadata.experiment.events).toHaveLength(1);
  expect(report.trace.length).toBeGreaterThan(0);
  expect(report.metadata.replay.options).toEqual(report.options);
  await page.getByRole('button', { name: 'Método', exact: true }).click();
  await page
    .getByLabel('Observação medida')
    .fill('Dia 1: custo maior no cenário B do relatório exportado.');
  await page
    .getByLabel('Hipótese a investigar')
    .fill('O custo operacional maior reduz a liquidez dos bots.');
  await page
    .getByLabel('Critério de aceitação')
    .fill('Comparar caixa e obrigações no par com mesma semente.');
  await page
    .getByLabel('Resultado observado')
    .fill('Rodada piloto executada; ainda precisa de horizonte maior.');
  await page.getByRole('combobox', { name: 'Decisão', exact: true }).selectOption('inconclusive');
  await page.getByLabel('Anexar execução concluída').selectOption('B-0');
  await page
    .getByLabel('Referências de evidência')
    .fill('experiment-report.json / B / seed 0 / dia 1');
  await page.getByRole('button', { name: 'Salvar experimento' }).click();
  await expect(page.getByRole('status')).toHaveText('Experimento registrado neste dispositivo.');
  await page.reload();
  await page.getByRole('button', { name: 'Método', exact: true }).click();
  await expect(page.locator('.lab-journal-records')).toContainText(
    'Dia 1: custo maior no cenário B',
  );
  const journalDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar registros JSON' }).click();
  const journalDownload = await journalDownloadPromise;
  const journalPath = testInfo.outputPath('experiments.json');
  await journalDownload.saveAs(journalPath);
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  expect(journal.records).toHaveLength(1);
  expect(journal.records[0].decision).toBe('inconclusive');
  expect(journal.records[0].report.options).toEqual(report.options);
});

test('interfaces distinguem contrato, falha funcional e diferenças contra baseline', async ({
  page,
}) => {
  await page.route('**/__lab/ui/index.json', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        generatedAt: '2026-10-27T12:00:00.000Z',
        fixture: 'relatório controlado de teste de renderização',
        engineFingerprint: 'test',
        screens: [
          {
            id: 'map',
            fingerprint: 'captura-anterior',
            capturedAt: '2026-10-27T12:00:00.000Z',
            captures: [],
            errors: [],
          },
        ],
        globalStates: [],
        summary: { captured: 1, reused: 0, states: 1, errors: 0, overflow: 0, unnamed: 0 },
        flowRuns: [
          {
            flowId: 'map-ownership',
            viewport: 'desktop',
            status: 'failed',
            states: ['preenchimento'],
            assertions: [
              { label: 'Filtro aplicado ao mapa', passed: false, expected: 'own', actual: 'all' },
            ],
            requests: [],
            captures: [],
            error: 'Filtro não foi aplicado na fixture de teste.',
          },
        ],
        comparison: {
          baseline: 'available',
          generatedAt: '2026-10-27T12:00:00.000Z',
          summary: {
            compared: 1,
            changed: 1,
            missing: 0,
            visualUnavailable: 0,
            functionalChanged: 1,
          },
          limits: [
            'Fixture valida apresentação do relatório; comparação de imagens é testada separadamente.',
          ],
          entries: [
            {
              screen: 'map',
              state: 'abertura',
              viewport: 'desktop',
              structuralChanged: true,
              structureChanges: ['Nome acessível do filtro alterado'],
              visual: 'changed',
              changedPixels: 10,
              changedRatio: 0.01,
              current: 'current.png',
              baseline: 'baseline.png',
              diff: 'diff.png',
            },
          ],
          flowChanges: [
            {
              flowId: 'map-ownership',
              viewport: 'desktop',
              before: 'passed',
              after: 'failed',
              details: ['Filtro de titularidade não foi aplicado'],
            },
          ],
        },
      },
    }),
  );
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Interfaces', exact: true }).click();
  await expect(page.getByText('Captura desatualizada', { exact: true })).toBeVisible();
  await page.locator('.lab-flow > summary').filter({ hasText: 'Filtrar titularidade' }).click();
  await expect(page.getByText('desktop: Falhou na execução', { exact: true })).toBeVisible();
  await expect(page.getByText('Filtro aplicado ao mapa', { exact: false })).toBeVisible();
  const comparison = page.getByRole('region', { name: 'Comparação com baseline' });
  await expect(comparison).toContainText('1 mudanças funcionais');
  await expect(comparison).toContainText('Filtro de titularidade não foi aplicado');
  await comparison.locator('summary').filter({ hasText: 'abertura / desktop' }).click();
  await expect(comparison).toContainText('Nome acessível do filtro alterado');
  await expect(comparison.getByRole('img')).toHaveCount(3);
});
