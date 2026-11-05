// Fotos reais do jogo para o vídeo (só leitura: nada é alterado no mundo além de abrir telas).
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = 'http://localhost:5191';
const destino = process.argv[2];
mkdirSync(destino, { recursive: true });
const TOPO = 66; // barra de cima do celular (saldo de teste): fora do recorte

async function abrir(page: Page, pagina: string, business?: string) {
  await page.goto(`${url}/jogar`);
  await page.evaluate(
    ([p, b]) => {
      localStorage.setItem('aftermarket.page', p);
      localStorage.setItem('aftermarket.company', 'player');
      localStorage.setItem('aftermarket.firstSteps', 'closed');
      if (b) localStorage.setItem('aftermarket.business', b);
      for (const k of Object.keys(localStorage))
        if (k.startsWith('aftermarket.welcome')) localStorage.setItem(k, 'seen');
    },
    [pagina, business ?? ''],
  );
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
}
async function foto(page: Page, nome: string) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const w = page.viewportSize()!.width;
  await page.screenshot({
    path: `${destino}/${nome}.png`,
    fullPage: true,
    clip: { x: 0, y: TOPO, width: w, height: Math.min(h, 4200) - TOPO },
  });
  console.log(nome, w, h);
}

const browser = await chromium.launch({ headless: true });
const cel = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await abrir(cel, 'inicio');
await foto(cel, 'cel-inicio');
await abrir(cel, 'businesses');
await foto(cel, 'cel-negocios');
await abrir(cel, 'industry', 'e-industry');
await foto(cel, 'cel-industria');
await cel
  .getByRole('tab', { name: /vendas/i })
  .first()
  .click()
  .catch(async () => {
    await cel
      .getByText(/^vendas$/i)
      .first()
      .click();
  });
await cel.waitForTimeout(2000);
await foto(cel, 'cel-industria-vendas');
await abrir(cel, 'retail', 'e-retail');
await foto(cel, 'cel-loja');
await abrir(cel, 'market');
await foto(cel, 'cel-comprar');
await abrir(cel, 'map');
await cel.waitForTimeout(4000);
await foto(cel, 'cel-mapa');

// Tabuleiro da cadeia no computador: o elemento sozinho, nítido.
const pc = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
await abrir(pc, 'businesses');
const cb = pc.locator('section.cb').first();
await cb.scrollIntoViewIfNeeded();
await pc.waitForTimeout(1500);
await cb.screenshot({ path: `${destino}/pc-cadeia.png` });
console.log('pc-cadeia');
await browser.close();
