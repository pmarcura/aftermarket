import { expect, test } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute } from '../../packages/simulation/src/engine';

for (const initialPage of ['inicio', 'orders'] as const) {
  test(`aviso de entrega abre Concluídos a partir de ${initialPage} e pode ser reaberto`, async ({
    page,
  }, testInfo) => {
    const now = Date.now();
    const world = createWorld(now);
    execute(
      world,
      'player',
      {
        type: 'transferStock',
        originId: 'e-mine',
        destinationId: 'e-industry',
        product: 'iron',
        quantity: 65,
        carrierId: 'player',
      },
      now,
    );
    expect(world.shipments.length).toBeGreaterThan(1);
    // Fixture de apresentação: entrega física e conservação têm testes de domínio próprios.
    for (const shipment of world.shipments) {
      shipment.delivered = true;
      shipment.arrivesAt = now - 1;
    }
    const errors: string[] = [];
    const unexpectedApi: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/**', async (route) => {
      if (new URL(route.request().url()).pathname === '/api/world') {
        await route.fulfill({ json: world });
        return;
      }
      unexpectedApi.push(route.request().url());
      await route.fulfill({ status: 503, json: { error: 'API não prevista na fixture.' } });
    });
    await page.addInitScript(
      ({ seasonId, initialPage }) => {
        localStorage.setItem('aftermarket.company', 'player');
        localStorage.setItem('aftermarket.page', initialPage);
        localStorage.setItem(`aftermarket.welcome.${seasonId}.player`, 'seen');
      },
      { seasonId: world.season.id, initialPage },
    );
    await page.goto('/jogar');
    const notices = page.getByRole('region', { name: 'Avisos do jogo', exact: true });
    const finished = page.getByRole('tab', { name: /^Concluídos/ });
    const respond = page.getByRole('tab', { name: /^Responder/ });
    const card = page.getByRole('article').filter({ hasText: 'Minério de ferro' });

    if (initialPage === 'orders') {
      await expect(respond).toHaveAttribute('aria-selected', 'true');
    }
    await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
    await expect(notices.getByText('Chegaram agora · 1', { exact: true })).toBeVisible();
    const delivery = notices.getByRole('button', { name: /Mercadoria entregue/ });
    await expect(delivery).toHaveCount(1);
    await delivery.focus();
    await page.keyboard.press('Enter');
    await expect(notices).not.toBeVisible();
    await expect(finished).toHaveAttribute('aria-selected', 'true');
    await expect(card).toHaveCount(1);
    await expect(card.getByText('Entregue', { exact: true })).toBeVisible();
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    // O segundo aviso deve mudar a aba mesmo sem desmontar a página de Pedidos.
    await respond.click();
    await expect(card).not.toBeVisible();
    await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
    await delivery.click();
    await expect(finished).toHaveAttribute('aria-selected', 'true');
    await expect(card.getByText('Entregue', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('entrega-concluida.png'), fullPage: true });

    // Voltar pela navegação comum não deve herdar a intenção do aviso anterior.
    await page
      .getByRole('navigation', { name: 'Comércio', exact: true })
      .getByRole('button', { name: 'Pedidos', exact: true })
      .click();
    await expect(respond).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
    await notices.getByRole('button', { name: 'Limpar entregas lidas', exact: true }).click();
    await expect(notices.getByText('Nenhuma entrega nova.', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
    await expect(notices.getByText('Chegaram agora · 0', { exact: true })).toBeVisible();
    expect(unexpectedApi).toEqual([]);
    expect(errors).toEqual([]);
  });
}
