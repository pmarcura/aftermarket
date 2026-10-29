// Fotografa telas reais do jogo para a vitrine da landing (apps/web/public/arte/landing/tela-*.jpg).
// Uso: com `npm run dev:v2` aberto, `npm run landing:telas` (ou `-- --url=http://localhost:5185`).
// A barra superior do computador fica de fora do recorte: ela mostra saldo e resultado da empresa
// de teste, que não são informação de apresentação. Nada é alterado no mundo.
import { chromium, type Page } from '@playwright/test';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5186';
const destino = 'apps/web/public/arte/landing';
const cenas = [
  { nome: 'mapa', pagina: 'map', espera: '.main-map [data-map-ready="true"]' },
  { nome: 'comprar', pagina: 'market', espera: '.vitrine' },
  { nome: 'loja', pagina: 'retail', espera: '.loja-pagina' },
] as const;
// Fotos em densidade 2× para continuarem nítidas em telas de alta resolução; 1360 px de largura
// deixa a interface legível no tamanho do aparelho da landing.
const aparelhos = [
  { sufixo: 'pc', largura: 1360, altura: 933, recorteTopo: 73 },
  { sufixo: 'cel', largura: 390, altura: 844, recorteTopo: 0 },
] as const;

async function abrir(page: Page, pagina: string, espera: string) {
  await page.goto(`${url}/jogar`);
  await page.evaluate((p) => {
    localStorage.setItem('aftermarket.page', p);
    localStorage.setItem('aftermarket.company', 'player');
    localStorage.setItem('aftermarket.firstSteps', 'closed');
    for (const k of Object.keys(localStorage))
      if (k.startsWith('aftermarket.welcome')) localStorage.setItem(k, 'seen');
  }, pagina);
  await page.reload();
  await page.locator(espera).first().waitFor({ timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const a of aparelhos)
  for (const c of cenas) {
    const page = await browser.newPage({
      viewport: { width: a.largura, height: a.altura },
      deviceScaleFactor: 2,
    });
    await abrir(page, c.pagina, c.espera);
    const arquivo = `${destino}/tela-${c.nome}-${a.sufixo}.jpg`;
    await page.screenshot({
      path: arquivo,
      type: 'jpeg',
      quality: 80,
      clip: { x: 0, y: a.recorteTopo, width: a.largura, height: a.altura - a.recorteTopo },
    });
    console.log(arquivo);
    await page.close();
  }
await browser.close();
