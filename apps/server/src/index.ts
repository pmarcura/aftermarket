import express from 'express';
import { regionsOf } from '../../../packages/simulation/src/metrics';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createStore } from './store';
import { createRoutingService } from './routing';
import { createRoadAccessService, createRoadFetcher } from './road-access';
import type { ScenarioName } from '../../../packages/simulation/src/scenarios';
import { RuleError } from '../../../packages/simulation/src/engine';
import { commandSchema, product } from './commands';
import { worldView } from './view';
import { gzipSync } from 'node:zlib';

const app = express();
const port = Number(process.env.AFTERMARKET_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Porta local inválida.');
const scenario = z
  .enum(['baseline', 'starter', 'low-demand', 'economy-2'])
  .parse(process.env.AFTERMARKET_SCENARIO ?? 'baseline') as ScenarioName;
const store = createStore(resolve(process.env.AFTERMARKET_DB_FILE ?? '.runtime/world.sqlite'), {
  // Todo mundo jogável valida o acesso dos imóveis e desenha rotas reais. O frete exige rota
  // confirmada no mundo principal; no mundo versão 2, com ~500 bots, segue a distância estimada
  // (D-034, D-036): esperar o serviço público de rotas (1 pedido a cada 1,2 s) travaria a economia.
  requireRoadRoutes: scenario !== 'economy-2',
  roadAccess: true,
  // Escala do mundo versão 2: 20 dá cerca de 500 empresas-bot.
  scale: Number(process.env.AFTERMARKET_WORLD_SCALE ?? 1),
  scenario,
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
]);
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
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
  if (json.length > 2048 && /gzip/.test(req.get('accept-encoding') ?? '')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.end(gzipSync(json, { level: 6 }));
  } else res.end(json);
}
app.get('/api/world', (req, res) => {
  const w = store.tick();
  routing.prepare(w);
  const actor = actorOf(req);
  if (Number(req.query.since) === w.revision && req.query.actor === actor)
    return res.status(204).end();
  sendJson(req, res, worldView(w, actor));
});
app.get('/api/routing-status', (_req, res) =>
  res.json({ ...routing.status(), access: roadAccess.status() }),
);
app.get('/api/market-history', (req, res) => {
  const parsed = product.safeParse(req.query.product);
  if (!parsed.success)
    return res.status(400).json({ error: 'Escolha uma mercadoria para consultar o histórico.' });
  const w = store.read(),
    regionId = typeof req.query.region === 'string' ? req.query.region : '';
  return res.json({
    product: parsed.data,
    regionId,
    startedAt: w.economyStartedAt,
    seasonId: w.season.id,
    samples: w.marketHistory
      .filter((s) => s.product === parsed.data && s.regionId === regionId)
      .slice(-1000),
    trades: w.ledger
      .filter(
        (e) =>
          e.product === parsed.data &&
          e.channel === 'wholesale' &&
          (!regionId ||
            (regionId.startsWith('state:')
              ? regionsOf(w).find((r) => r.id === e.regionId)?.state === regionId.slice(6)
              : e.regionId === regionId)),
      )
      .slice(-2000),
  });
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
    sendJson(req, res, worldView(store.command(actor, commandSchema.parse(req.body), key), actor));
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
  console.log(`AFTERMARKET API · http://127.0.0.1:${port} · SQLite persistente`),
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
