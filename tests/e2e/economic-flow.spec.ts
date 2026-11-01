import { test, expect } from './fixtures';
import type { Command, World } from '../../packages/simulation/src/model';

// Fluxo contra o servidor real (cenário `baseline`): a compra, a entrega e a produção mudam o
// mundo salvo no SQLite do e2e e sobrevivem à recarga. A fábrica de aço (Piracicaba) compra
// minério da Distribuidora Aurora (Americana), a viagem mais curta do mundo de referência.
test('compra, frete, entrega e produção alteram o estado real e persistem após recarregar', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mundo = async () => (await (await request.get('/api/world')).json()) as World;
  const fabrica = (w: World) => w.establishments.find((e) => e.id === 'e-industry')!;
  // Minério já entregue na fábrica; separa a nossa compra de outra carga que chegue no meio.
  const recebido = (w: World) =>
    w.shipments
      .filter((s) => s.destinationId === 'e-industry' && s.product === 'iron' && s.delivered)
      .reduce((n, s) => n + s.quantity, 0);
  const comando = () =>
    page.waitForResponse(
      (r) => r.url().endsWith('/api/commands') && r.request().method() === 'POST',
    );
  const before = await mundo();
  // Só a primeira carga começa em Comprar; as recargas preservam a página em que o jogador está.
  await page.addInitScript((season) => {
    if (!localStorage.getItem('aftermarket.e2e-fluxo')) {
      localStorage.setItem('aftermarket.e2e-fluxo', '1');
      localStorage.setItem('aftermarket.company', 'player');
      localStorage.setItem('aftermarket.page', 'market');
    }
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, before.season.id);
  await page.goto('/jogar');

  await test.step('comprar minério com frete pela gaveta Mandar buscar', async () => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comprar mercadorias' }),
    ).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Destino da carga', exact: true })
      .getByRole('radio', { name: /^Indústria de Aço/ })
      .click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Ver detalhes de Minério de ferro' }) })
      .getByRole('button', { name: 'Mandar buscar', exact: true })
      .click();
    const gaveta = page.getByRole('dialog', { name: 'Mandar buscar Minério de ferro' });
    await gaveta.getByRole('radio', { name: /^Pouco/ }).click();
    // A Aurora é a viagem mais curta; se os bots esgotaram o estoque dela, vale a mais rápida.
    const opcoes = gaveta.getByRole('list').getByRole('button');
    await expect(opcoes.first()).toBeVisible({ timeout: 20000 });
    const aurora = opcoes.filter({ hasText: 'Distribuidora Aurora' });
    const rapida = opcoes.filter({ hasText: 'Mais rápido' });
    if (await aurora.count()) await aurora.click();
    else if (await rapida.count()) await rapida.click();
    const despachar = gaveta.getByRole('button', { name: 'Despachar caminhão', exact: true });
    await expect(despachar).toBeEnabled({ timeout: 20000 });
    const resposta = comando();
    await despachar.click();
    const r = await resposta;
    expect(r.ok(), await r.text()).toBe(true);
    const pedido = r.request().postDataJSON() as Extract<Command, { type: 'trade' }>;
    const bought = (await r.json()) as World;
    const novas = bought.shipments.filter((s) => !before.shipments.some((o) => o.id === s.id));
    expect(pedido).toMatchObject({ type: 'trade', destinationId: 'e-industry' });
    expect(novas.length).toBeGreaterThan(0);
    expect(novas.every((s) => s.product === 'iron' && s.destinationId === 'e-industry')).toBe(true);
    expect(novas.reduce((n, s) => n + s.quantity, 0)).toBe(pedido.quantity);
    // Mercadoria só entra no estoque quando o caminhão chega.
    expect(fabrica(bought).inventory.iron).toBe(fabrica(before).inventory.iron);
    const origem = bought.establishments.find((e) => e.id === novas[0].originId)!.name;
    // Depois do envio a gaveta perde o nome acessível (ver Achados da 001b); segue pelo papel.
    const enviado = page.getByRole('dialog').filter({ hasText: 'O caminhão saiu!' });
    await expect(enviado.getByRole('heading', { name: 'O caminhão saiu!' })).toBeVisible();
    await enviado.getByRole('button', { name: 'Continuar jogando', exact: true }).click();

    await page.reload();
    await page
      .getByRole('navigation', { name: 'Comércio' })
      .getByRole('button', { name: 'Pedidos', exact: true })
      .click();
    await page.getByRole('tab', { name: /^A caminho/ }).click();
    await expect(
      page.getByRole('article').filter({ hasText: `Você recebe de ${origem} em Indústria de Aço` }),
    ).not.toHaveCount(0);

    const ids = novas.map((s) => s.id);
    await expect
      .poll(
        async () =>
          (await mundo()).shipments.filter((s) => ids.includes(s.id)).every((s) => s.delivered),
        { timeout: 120000, intervals: [2000] },
      )
      .toBe(true);
    const entregue = await mundo();
    expect(recebido(entregue) - recebido(before)).toBeGreaterThanOrEqual(pedido.quantity);
    expect(fabrica(entregue).inventory.iron).toBe(
      fabrica(before).inventory.iron! + recebido(entregue) - recebido(before),
    );
  });

  await test.step('produzir aço com o minério entregue e persistir após recarga', async () => {
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Menu principal' })
      .getByRole('button', { name: 'Negócios', exact: true })
      .click();
    await page
      .locator('article.neg-item')
      .filter({ has: page.getByRole('heading', { name: 'Indústria de Aço', exact: true }) })
      .getByRole('button', { name: /^Abrir/ })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Indústria de Aço', exact: true }),
    ).toBeVisible();
    const delivered = await mundo();
    await page.getByRole('button', { name: 'Produzir agora', exact: true }).click();
    // O Modal genérico não liga o título ao <dialog> (ver Achados da 001b).
    const modal = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: 'Começar a produzir' }) });
    const resposta = comando();
    await modal.getByRole('button', { name: 'Começar a produzir', exact: true }).click();
    const r = await resposta;
    expect(r.ok(), await r.text()).toBe(true);
    const pedido = r.request().postDataJSON() as Extract<Command, { type: 'produce' }>;
    const queued = (await r.json()) as World;
    const job = queued.jobs.find((j) => !delivered.jobs.some((old) => old.id === j.id))!;
    expect(job).toBeTruthy();
    // Insumos saem do estoque no momento em que o lote começa.
    expect(fabrica(queued).inventory.iron).toBeCloseTo(
      fabrica(delivered).inventory.iron! - 1.6 * pedido.cycles,
      6,
    );
    expect(fabrica(queued).inventory.coal).toBeCloseTo(
      fabrica(delivered).inventory.coal! - 0.5 * pedido.cycles,
      6,
    );
    // Um lote de aço leva 120 s reais; a conclusão (insumo vira aço, sem duplicar estoque nem
    // dinheiro) é coberta em tests/economy.test.ts. Aqui basta o lote gravado e de volta na tela.
    expect(job).toMatchObject({ establishmentId: 'e-industry', recipeId: 'steel-bars' });
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Indústria de Aço', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('progressbar', { name: 'Progresso do lote de Aço em alto-forno' }),
    ).toHaveCount(1);
    const persisted = (await mundo()).jobs.find((j) => j.id === job.id)!;
    expect([persisted.startedAt, persisted.finishesAt, persisted.cycles]).toEqual([
      job.startedAt,
      job.finishesAt,
      job.cycles,
    ]);
  });
  expect(errors).toEqual([]);
});
