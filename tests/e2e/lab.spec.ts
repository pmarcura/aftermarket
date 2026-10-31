import { expect, test } from './fixtures';
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
  // Uma linha por item do catálogo (20 itens).
  await expect(
    page.getByRole('region', { name: 'Tabela de mercadorias' }).locator('tbody tr'),
  ).toHaveCount(20);
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

test('consulta bot, produto e dia com parâmetros reais', async ({ page }, testInfo) => {
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
});
