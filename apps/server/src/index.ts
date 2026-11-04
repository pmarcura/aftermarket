import express from 'express';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createStore } from './store';
import { createRoutingService } from './routing';
import { createRoadAccessService, createRoadFetcher } from './road-access';
import type { ScenarioName } from '../../../packages/simulation/src/scenarios';
import { RuleError } from '../../../packages/simulation/src/engine';
import { commandSchema, product } from './commands';
import { worldView } from './view';
import { gzip } from 'node:zlib';
import { createClock } from '../../../packages/simulation/src/clock';
import { createWorldPacketCache } from './world-packet';
import { marketHistories } from './market-history';

const app = express();
const port = Number(process.env.AFTERMARKET_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Porta local inválida.');
const scenario = z
  .enum(['baseline', 'playtest'])
  .parse(process.env.AFTERMARKET_SCENARIO ?? 'playtest') as ScenarioName;
// Escala do mundo: 1 é o mundo de referência da calculadora; 20 dá cerca de 500 empresas-bot.
const scale = Number(process.env.AFTERMARKET_WORLD_SCALE ?? 1);
if (!Number.isFinite(scale) || scale < 1) throw new Error('AFTERMARKET_WORLD_SCALE inválida.');
// Velocidade do relógio de um mundo novo (spec 004): padrão 120 (1 min real = 2 h de jogo); o
// playtest lento usa 6 (dia de jogo = 4 h reais). Mundo existente segue a velocidade em que nasceu.
const timeScale = process.env.AFTERMARKET_TIME_SCALE
  ? createClock(Number(process.env.AFTERMARKET_TIME_SCALE)).timeScale
  : undefined;
// Mundos de teste e design param quando ninguém joga (spec 013): sem isso, um mundo esquecido
// ligado no relógio rápido crescia ~1,6 GB por dia. O mundo principal (.runtime/world.sqlite)
// continua andando; AFTERMARKET_IDLE_PAUSE=0 ou =1 força o comportamento.
const dbFile = resolve(process.env.AFTERMARKET_DB_FILE ?? '.runtime/world.sqlite');
const IDLE_PAUSE_MS = 3 * 60_000;
const pauseWhenIdle =
  process.env.AFTERMARKET_IDLE_PAUSE !== undefined
    ? process.env.AFTERMARKET_IDLE_PAUSE === '1'
    : dbFile !== resolve('.runtime/world.sqlite');
const store = createStore(dbFile, {
  pauseWhenIdleMs: pauseWhenIdle ? IDLE_PAUSE_MS : undefined,
  // Todo mundo jogável valida o acesso dos imóveis e desenha rotas reais. O frete exige rota
  // confirmada só na escala 1; com ~500 bots segue a distância estimada (D-034, D-036): esperar
  // o serviço público de rotas (1 pedido a cada 1,2 s) travaria a economia.
  requireRoadRoutes: scale === 1,
  roadAccess: true,
  scale,
  scenario,
  timeScale,
});
const roadFetcher = createRoadFetcher();
const roadAccess = createRoadAccessService(store, { fetcher: roadFetcher });
const routing = createRoutingService(store, {
  fetcher: roadFetcher,
  intervalMs: 0,
  ensureAccess: (ids) => roadAccess.ensure(ids),
});
roadAccess.prepare();
const allowedOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  `http://127.0.0.1:${process.env.AFTERMARKET_WEB_PORT ?? 5173}`,
  `http://localhost:${process.env.AFTERMARKET_WEB_PORT ?? 5173}`,
  `http://127.0.0.1:${process.env.AFTERMARKET_PREVIEW_PORT ?? 4173}`,
  `http://localhost:${process.env.AFTERMARKET_PREVIEW_PORT ?? 4173}`,
]);
app.use(express.json({ limit: '16kb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  // Qualquer pedido do navegador conta como alguém jogando (a tela aberta consulta o mundo).
  if (req.path !== '/health') store.atividade();
  next();
});
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, mode: 'local-development', version: '0.4.0' }),
);
// Pacote enxuto por jogador, comprimido; sem mudança desde a revisão que o navegador tem,
// responde 204 sem corpo.
const actorOf = (req: express.Request) => {
  const actor = req.get('x-company-id') ?? 'player';
  return actor === 'player2' ? 'player2' : 'player';
};
function sendJson(req: express.Request, res: express.Response, body: unknown) {
  const json = Buffer.from(JSON.stringify(body));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Accept-Encoding, x-company-id');
  if (json.length > 2048 && /\bgzip\b/.test(req.get('accept-encoding') ?? '')) {
    gzip(json, { level: 6 }, (error, encoded) => {
      if (res.destroyed) return;
      if (error) {
        res.status(500).json({ error: 'Não foi possível preparar a resposta.' });
        return;
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.end(encoded);
    });
  } else res.end(json);
}
const worldPacket = createWorldPacketCache();
app.get('/api/world', async (req, res, next) => {
  try {
    // Reads never run offline catch-up; the background tick owns progression.
    const w = store.read();
    const actor = actorOf(req);
    if (Number(req.query.since) === w.revision && req.query.actor === actor)
      return res.status(204).end();
    const inicio = performance.now();
    const packet = worldPacket(w, actor);
    res.setHeader('Server-Timing', `pacote;dur=${(performance.now() - inicio).toFixed(1)}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Vary', 'Accept-Encoding, x-company-id');
    if (packet.json.length > 2048 && /\bgzip\b/.test(req.get('accept-encoding') ?? '')) {
      const encoded = await packet.gzip;
      if (res.destroyed) return;
      res.setHeader('Content-Encoding', 'gzip');
      res.end(encoded);
    } else res.end(packet.json);
  } catch (error) {
    next(error);
  }
});
app.get('/api/routing-status', (_req, res) =>
  res.json({ ...routing.status(), access: roadAccess.status() }),
);
app.get('/api/market-history', (req, res) => {
  const multiple = typeof req.query.products === 'string';
  const parsed = z
    .array(product)
    .min(1)
    .max(20)
    .safeParse(multiple ? String(req.query.products).split(',') : [req.query.product]);
  if (!parsed.success)
    return res.status(400).json({ error: 'Escolha uma mercadoria para consultar o histórico.' });
  const w = store.read(),
    regionId = typeof req.query.region === 'string' ? req.query.region : '';
  const histories = marketHistories(w, parsed.data, regionId);
  if (multiple) {
    // The board and company cards consume these six fields, not the full ledger.
    const board = Object.fromEntries(
      Object.entries(histories).map(([id, value]) => [
        id,
        {
          ...value,
          trades: value.trades.map(({ at, from, to, product, quantity, unitPrice }) => ({
            at,
            from,
            to,
            product,
            quantity,
            unitPrice,
          })),
        },
      ]),
    );
    return sendJson(req, res, board);
  }
  return sendJson(req, res, histories[parsed.data[0]]);
});
app.post('/api/commands', (req, res, next) => {
  try {
    const origin = req.get('origin');
    if (origin && !allowedOrigins.has(origin))
      return res.status(403).json({ error: 'Origem não autorizada.' });
    const actor = req.get('x-company-id');
    if (actor !== 'player' && actor !== 'player2')
      return res.status(403).json({ error: 'Escolha uma empresa de teste válida.' });
    const key = z.uuid().parse(req.get('idempotency-key'));
    const inicio = performance.now();
    const parsed = commandSchema.parse(req.body);
    const mundo = store.command(actor, parsed, key);
    const antesDaVista = performance.now();
    const vista = worldView(mundo, actor);
    const fim = performance.now();
    // Tempo de cada etapa visível no navegador (aba Rede → Timing) e no log quando passa de 500 ms.
    const etapas = {
      ...(store.ultimoClique() ?? {}),
      vista: fim - antesDaVista,
      total: fim - inicio,
    };
    res.setHeader(
      'Server-Timing',
      Object.entries(etapas)
        .map(([nome, ms]) => `${nome};dur=${ms.toFixed(1)}`)
        .join(', '),
    );
    if (etapas.total > 500)
      console.warn(
        `Clique lento (${parsed.type}): ${Object.entries(etapas)
          .map(([nome, ms]) => `${nome} ${Math.round(ms)} ms`)
          .join(' · ')}`,
      );
    sendJson(req, res, vista);
  } catch (error) {
    next(error);
  }
});
app.get('/api/route', async (req, res, next) => {
  try {
    const w = store.read();
    const origin = w.properties.find((p) => p.id === req.query.origin),
      dest = w.properties.find((p) => p.id === req.query.destination);
    if (!origin || !dest || origin.id === dest.id)
      return res.status(400).json({ error: 'Origem ou destino inválido.' });
    const route = await routing.request(origin.id, dest.id);
    if (!route)
      return res.status(503).json({
        error:
          [origin.id, dest.id]
            .map((id) => store.read().properties.find((p) => p.id === id))
            .find((p) => p?.roadAccess?.status === 'unreachable')?.roadAccess?.reason ??
          'Não foi possível confirmar o acesso e a rota pelas estradas. Nenhum transporte foi contratado; tente novamente em um minuto.',
      });
    res.json(route);
  } catch (error) {
    next(error);
  }
});
if (process.argv.includes('--production')) {
  app.use(express.static(resolve('dist/web')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/web/index.html')));
}
app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: 'Dados inválidos. Revise quantidades, preços e identificação da operação.',
      });
    if (error instanceof RuleError) return res.status(409).json({ error: error.message });
    console.error(error);
    return res
      .status(500)
      .json({ error: 'Não foi possível salvar a operação. Atualize a página e tente novamente.' });
  },
);
const tick = setInterval(() => {
  try {
    const w = store.tick();
    roadAccess.prepare();
    routing.prepare(w);
  } catch (e) {
    console.error('Falha ao processar eventos', e);
  }
}, 2000);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(
    `AFTERMARKET API · http://127.0.0.1:${port} · SQLite persistente${pauseWhenIdle ? ' · para quando ninguém joga' : ''}`,
  ),
);
function stop() {
  clearInterval(tick);
  routing.stop();
  roadAccess.stop();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
