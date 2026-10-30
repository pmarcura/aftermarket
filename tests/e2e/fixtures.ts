import { test as base, type Page } from '@playwright/test';

export { expect } from '@playwright/test';

/** Hosts que o jogo consulta na internet. Nenhum teste pode depender deles. */
const hostsExternos = ['tiles.openfreemap.org', 'router.project-osrm.org'];
const hostsLocais = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** Respostas sintéticas: TileJSON apontando para tiles vazios locais; nada sai da máquina. */
const tileJson = (baseURL: string) => ({
  tilejson: '3.0.0',
  tiles: [`${baseURL}/__e2e/vazio.pbf?z={z}&x={x}&y={y}`],
  minzoom: 0,
  maxzoom: 14,
  vector_layers: ['landcover', 'water', 'waterway', 'transportation'].map((id) => ({
    id,
    fields: {},
  })),
});

/**
 * Bloqueia toda a rede externa do navegador de teste. Os tiles do OpenFreeMap viram um TileJSON
 * local com tiles vazios (o mapa inicia sem cartografia real); o roteador OSRM e qualquer outro
 * host fora de 127.0.0.1 recebem 204. Os specs registram as próprias rotas depois desta e, por
 * isso, têm precedência (o Playwright consulta a rota registrada por último primeiro).
 */
export async function bloquearRedeExterna(page: Page, baseURL = 'http://127.0.0.1:5183') {
  const bloqueadas: string[] = [];
  await page.route('**/__e2e/vazio.pbf?**', (route) =>
    route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }),
  );
  await page.route(
    (url) => url.protocol.startsWith('http') && !hostsLocais.has(url.hostname),
    (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'tiles.openfreemap.org')
        return route.fulfill({ json: tileJson(baseURL) });
      bloqueadas.push(url.toString());
      return route.fulfill({ status: 204, body: '' });
    },
  );
  return { hostsExternos, bloqueadas };
}

/** `test` com a rede externa bloqueada em toda página, antes de qualquer rota do spec. */
export const test = base.extend<{ redeExterna: { bloqueadas: string[] } }>({
  redeExterna: [
    async ({ page, baseURL }, use) => {
      const estado = await bloquearRedeExterna(page, baseURL ?? 'http://127.0.0.1:5183');
      await use(estado);
    },
    { auto: true },
  ],
});
