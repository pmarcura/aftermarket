import { test, expect } from './fixtures';
import { createWorld } from '../../packages/simulation/src/seed';
import { execute, advance, RuleError } from '../../packages/simulation/src/engine';
import { type Command } from '../../packages/simulation/src/model';
import { institutional } from '../../packages/simulation/src/competition';
import { createClock, economicInterval } from '../../packages/simulation/src/clock';

// Os mundos destes testes nascem no relógio padrão (120×).
const ROUND = economicInterval(createClock());
test('edital estadual mostra referência, disputa e todos os caminhões indo à prefeitura', async ({
  page,
}) => {
  const now = Date.now(),
    w = createWorld(now);
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  for (const c of w.companies)
    if (!institutional(c.id) && !['transbrasil', 'rodoleste', 'expresso'].includes(c.id))
      c.bot = false;
  const factory = w.establishments.find((e) => e.id === 'e-industry')!;
  factory.inventory.steel = 200;
  factory.quality!.steel = 95;
  advance(w, now + ROUND);
  const contract = w.infrastructure.find((c) => c.state === 'SP')!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/world*', (route) => route.fulfill({ json: w }));
  await page.route('**/api/commands', async (route) => {
    try {
      execute(
        w,
        route.request().headers()['x-company-id'],
        route.request().postDataJSON() as Command,
        w.updatedAt,
      );
      // Encerra a disputa logo após a proposta: o motor escolhe a vencedora e despacha.
      advance(w, contract.biddingEndsAt!);
      w.revision++;
      await route.fulfill({ json: w });
    } catch (error) {
      await route.fulfill({
        status: error instanceof RuleError ? 409 : 500,
        json: { error: String(error) },
      });
    }
  });
  await page.addInitScript((season) => {
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.page', 'contracts');
    localStorage.setItem(`aftermarket.welcome.${season}.player`, 'seen');
  }, w.season.id);
  await page.goto('/jogar');
  await page
    .getByRole('group', { name: 'Estado dos contratos públicos', exact: true })
    .getByRole('button', { name: 'SP', exact: true })
    .click();
  const card = page.getByRole('article').filter({ hasText: `#${contract.id.slice(0, 6)}` });
  // Teto do edital: preço de referência mais 25%, por unidade e no total.
  await expect(card.getByText(/^até R\$\s?[\d.,]+ por /)).toBeVisible();
  await expect(card.getByText('Paga até', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Participar da disputa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Participar da disputa', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('radio', { name: /^Indústria de Aço/ }).click();
  await dialog
    .getByRole('button', { name: 'Selecionar TransBrasil Logística', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Registrar proposta', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(w.infrastructure.find((c) => c.id === contract.id)?.supplierId).toBe('player');
  const entrega = page
    .locator('section.ped-secao')
    .filter({ has: page.getByRole('heading', { name: /^Em entrega/ }) });
  const vencido = entrega.getByRole('article').filter({ hasText: `#${contract.id.slice(0, 6)}` });
  await expect(vencido.getByText('Você venceu', { exact: true })).toBeVisible();
  const empresa = w.companies.find((c) => c.id === 'player')!.name;
  await expect(
    vencido.getByRole('figure', { name: new RegExp(`^Pódio: 1º ${empresa}`) }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/competition/public-contract.png', fullPage: true });
  const viagens = w.shipments.filter((s) => s.infrastructureId === contract.id);
  expect(viagens.length).toBeGreaterThan(0);
  expect(viagens.every((s) => s.destinationId === contract.destinationId)).toBe(true);
  await vencido.getByRole('button', { name: 'Acompanhar os caminhões', exact: true }).click();
  const prefeitura = `Contrato público: Prefeitura de ${contract.municipality}`;
  const carga = page.getByRole('article').filter({ hasText: prefeitura });
  await expect(carga).toHaveCount(1);
  await carga.getByRole('button', { name: 'Ver no mapa', exact: true }).click();
  await expect(carga.getByRole('button', { name: 'Localizar', exact: true })).toHaveCount(
    viagens.length,
  );
  await page.screenshot({ path: 'test-results/competition/public-delivery.png', fullPage: true });
  expect(errors).toEqual([]);
});
