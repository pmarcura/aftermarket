import { test, expect } from './fixtures';
import { type Page } from '@playwright/test';
import type { World } from '../../packages/simulation/src/model';

// Lote industrial livre do mundo de referência (São Paulo); a unidade comprada leva o id do lote.
const LOT = 'lot-industry-3550308-0',
  UNIT = `e-${LOT}`,
  NOME = 'Unidade de Teste Comercial';

/** Troca a empresa ativa como as Preferências fazem e reabre Pedidos. */
async function actor(page: Page, id: string) {
  await page.evaluate((id) => {
    localStorage.setItem('aftermarket.company', id);
    localStorage.setItem('aftermarket.page', 'orders');
  }, id);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Pedidos e entregas' })).toBeVisible();
}
const comando = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST');

test('negocia pedido real, agrupa caminhões e configura abastecimento e educação', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // O servidor valida o acesso rodoviário de todos os lotes em segundo plano; pedir uma rota a
  // partir do lote coloca este na frente da fila (roteador falso na porta 3014).
  const acesso = await request.get(`/api/route?origin=${LOT}&destination=industry`);
  expect(acesso.ok(), await acesso.text()).toBe(true);
  for (const data of [
    { type: 'buyProperty', propertyId: LOT, name: NOME },
    { type: 'installBusiness', establishmentId: UNIT, recipeId: 'steel-bars', lines: 1 },
  ]) {
    const r = await request.post('/api/commands', {
      headers: { 'x-company-id': 'player2', 'Idempotency-Key': crypto.randomUUID() },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
  }
  const inicio = (await (await request.get('/api/world')).json()) as World;
  const empresa = (id: string) => inicio.companies.find((c) => c.id === id)!.name;
  await page.addInitScript((season) => {
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
    localStorage.setItem(`aftermarket.welcome.${season}.player2`, 'seen');
  }, inicio.season.id);
  await page.goto('/jogar');
  const dialog = page.getByRole('dialog');
  const procuram = page
    .locator('section.ped-secao')
    .filter({ has: page.getByRole('heading', { name: /^Procuram o que você tem/ }) });
  const precisam = page
    .locator('section.ped-secao')
    .filter({ has: page.getByRole('heading', { name: /^Precisam de você/ }) });
  let order: World['orders'][number];

  await test.step('Marina publica um pedido aberto de minério', async () => {
    await actor(page, 'player2');
    await page.getByRole('button', { name: 'Pedir mercadoria', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Pedir mercadoria' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: NOME })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('radio', { name: 'Minério de ferro', exact: true }).click();
    await dialog.getByLabel('Quantidade', { exact: true }).fill('65');
    await dialog.getByLabel('Preço máximo por unidade (R$)', { exact: true }).fill('500');
    await dialog.getByLabel('Verba de frete (R$)', { exact: true }).fill('10000');
    const created = comando(page);
    await dialog.getByRole('button', { name: 'Publicar pedido', exact: true }).click();
    const world = (await (await created).json()) as World;
    order = world.orders.at(-1)!;
    expect(order).toMatchObject({
      buyerId: 'player2',
      sellerId: '',
      destinationId: UNIT,
      product: 'iron',
      quantity: 65,
      unitPrice: 50000,
    });
    await expect(dialog).not.toBeVisible();
  });

  await test.step('João propõe, Marina contrapropõe e João aceita', async () => {
    await actor(page, 'player');
    let card = procuram.getByRole('article').filter({ hasText: empresa('player2') });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: 'Fazer uma proposta', exact: true }).click();
    await dialog.getByRole('radio', { name: /^Indústria de Aço/ }).click();
    await dialog.getByLabel('Preço por unidade (R$)', { exact: true }).fill('490');
    // Frota própria: os caminhões das transportadoras-bot podem estar ocupados pela economia viva.
    await dialog.getByRole('button', { name: 'Selecionar Minha frota', exact: true }).click();
    await dialog.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await actor(page, 'player2');
    card = precisam.getByRole('article').filter({ hasText: 'Minério de ferro' });
    await card
      .getByRole('list', { name: 'Propostas recebidas' })
      .getByRole('button', { name: 'Responder', exact: true })
      .click();
    await expect(
      dialog.getByRole('heading', { name: 'Responder com outra proposta' }),
    ).toBeVisible();
    await dialog.getByLabel('Preço por unidade (R$)', { exact: true }).fill('480');
    await dialog.getByRole('button', { name: 'Enviar proposta', exact: true }).click();
    await expect(dialog).not.toBeVisible();

    await actor(page, 'player');
    card = precisam.getByRole('article').filter({ hasText: empresa('player2') });
    await card.getByRole('button', { name: 'Aceitar proposta', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Aceitar e despachar' })).toBeVisible();
    const accepted = comando(page);
    await dialog.getByRole('button', { name: 'Aceitar e despachar', exact: true }).click();
    const after = (await (await accepted).json()) as World;
    const aceito = after.orders.find((o) => o.id === order.id)!;
    expect(aceito.status).toBe('accepted');
    expect(aceito.proposals?.at(-1)?.unitPrice).toBe(48000);
    expect(after.shipments.filter((s) => s.orderId === order.id)).toHaveLength(3);
  });

  await test.step('os três caminhões aparecem juntos na carga do pedido', async () => {
    await page.getByRole('tab', { name: /^A caminho/ }).click();
    const carga = page
      .getByRole('article')
      .filter({ hasText: `Você entrega de Indústria de Aço a ${empresa('player2')}` });
    await expect(carga).toHaveCount(1);
    await expect(carga).toContainText('0 de 3 caminhões chegaram');
    await carga.getByRole('button', { name: 'Ver no mapa', exact: true }).click();
    await expect(carga.getByRole('button', { name: 'Localizar', exact: true })).toHaveCount(3);
    await expect(carga.locator('.shipment-truck')).toHaveCount(3, { timeout: 25000 });
    await page.screenshot({ path: 'test-results/competition/private-order.png', fullPage: true });
  });

  await test.step('João envia minério da mina para a fábrica com a própria frota', async () => {
    await page
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('button', { name: 'Negócios', exact: true })
      .click();
    await page
      .locator('article.ng-card')
      .filter({ has: page.getByRole('heading', { name: 'Mineradora Horizonte', exact: true }) })
      .getByRole('button', { name: /^Abrir/ })
      .click();
    await page
      .getByRole('region', { name: 'Armazém', exact: true })
      .getByRole('article')
      .filter({ hasText: 'Minério de ferro' })
      .getByRole('button', { name: 'Enviar para outra unidade', exact: true })
      .click();
    await expect(
      dialog.getByRole('heading', { name: 'Transferir entre minhas unidades', exact: true }),
    ).toBeVisible();
    await expect(dialog.getByLabel('Origem da transferência', { exact: true })).toHaveValue(
      'e-mine',
    );
    await dialog.getByLabel('Destino da transferência', { exact: true }).selectOption('e-industry');
    await expect(dialog.getByLabel('Produto da transferência', { exact: true })).toHaveValue(
      'iron',
    );
    await dialog.getByLabel('Quantidade para transferir', { exact: true }).fill('1');
    await dialog.getByRole('button', { name: 'Selecionar Minha frota', exact: true }).click();
    const moved = comando(page);
    await dialog
      .getByRole('button', { name: 'Confirmar transferência e transporte', exact: true })
      .click();
    const movedWorld = (await (await moved).json()) as World;
    expect(
      movedWorld.shipments.some(
        (s) =>
          s.originId === 'e-mine' &&
          s.destinationId === 'e-industry' &&
          s.quantity === 1 &&
          s.carrierId === 'player',
      ),
    ).toBe(true);
    await expect(dialog).not.toBeVisible();
  });

  await test.step('Marina configura o abastecimento da nova unidade', async () => {
    // A unidade da Marina é a única dela: "só minhas unidades" não dispara compra nem transferência.
    await page.evaluate(() => localStorage.setItem('aftermarket.company', 'player2'));
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('button', { name: 'Negócios', exact: true })
      .click();
    await page
      .locator('article.ng-card')
      .filter({ has: page.getByRole('heading', { name: NOME, exact: true }) })
      .getByRole('button', { name: /^Abrir/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: NOME, exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Abastecimento', exact: true }).click();
    const minerio = page
      .getByRole('region', { name: /^Repostos sozinhos/ })
      .getByRole('article')
      .filter({ hasText: 'Minério de ferro' });
    await minerio.getByLabel('Encher até', { exact: true }).fill('200');
    await minerio.getByLabel('Repor quando cair a', { exact: true }).fill('100');
    await minerio.getByRole('button', { name: 'Salvar mudanças', exact: true }).click();
    await expect(page.getByText('Regra de Minério de ferro salva.')).toBeVisible();

    await page.locator('summary').filter({ hasText: 'Regras gerais de compra' }).click();
    await page
      .getByRole('radiogroup', { name: 'Origem do abastecimento', exact: true })
      .getByRole('radio', { name: 'Só minhas unidades', exact: true })
      .click();
    await page.getByLabel('Orçamento por dia (R$)', { exact: true }).fill('50000');
    await page.getByRole('button', { name: 'Salvar regras gerais', exact: true }).click();
    await expect(page.getByText('Regras gerais salvas.')).toBeVisible();
    const chave = page.getByRole('switch', { name: 'Abastecimento automático', exact: true });
    await chave.click();
    await expect(chave).toHaveAttribute('aria-checked', 'true');

    // O pacote do mundo é por empresa: a política da unidade só vem no pacote da Marina.
    const daMarina = (await (
      await request.get('/api/world', { headers: { 'x-company-id': 'player2' } })
    ).json()) as World;
    const salvo = daMarina.establishments.find((e) => e.id === UNIT)!.supplyPolicy!;
    expect(salvo).toMatchObject({ enabled: true, source: 'internal-only', dailyBudget: 5000000 });
    expect(salvo.rules.find((r) => r.product === 'iron')).toMatchObject({
      minimum: 100,
      target: 200,
    });
    await page.screenshot({ path: 'test-results/competition/supply-desktop.png', fullPage: true });
  });

  await test.step('Marina contrata a equipe e paga a educação', async () => {
    await page.getByRole('tab', { name: 'Equipe', exact: true }).click();
    await page.getByLabel('Funcionários desejados', { exact: true }).fill('18');
    await page.getByRole('button', { name: 'Contratar 18', exact: true }).click();
    await expect(page.getByText('18 pessoas contratadas.')).toBeVisible();
    await page.getByRole('button', { name: /^Treinar equipe · / }).click();
    const treino = comando(page);
    await page.getByRole('button', { name: 'Pagar e iniciar', exact: true }).click();
    expect((await treino).ok()).toBe(true);
    await expect(page.getByText(/^Treinando para o nível/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({
      path: 'test-results/competition/workforce-mobile.png',
      fullPage: true,
    });
  });
  expect(errors).toEqual([]);
});
