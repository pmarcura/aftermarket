import express from 'express';
import { regions } from '../../../packages/world/src/regions';
import { z } from 'zod';
import { resolve } from 'node:path';
import { createStore } from './store';
import { RuleError } from '../../../packages/simulation/src/engine';
import {
  products,
  type ProductId,
  type Route,
  type World,
} from '../../../packages/simulation/src/model';

const app = express();
const port = Number(process.env.AFTERMARKET_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Porta local inválida.');
const store = createStore(resolve(process.env.AFTERMARKET_DB_FILE ?? '.runtime/world.sqlite'));
const allowedOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  `http://127.0.0.1:${process.env.AFTERMARKET_WEB_PORT ?? 5173}`,
  `http://localhost:${process.env.AFTERMARKET_WEB_PORT ?? 5173}`,
]);
const product = z.enum(Object.keys(products) as [ProductId, ...ProductId[]]);
const id = z.string().min(1).max(100),
  amount = z.number().int().positive();
const commandSchema = z.discriminatedUnion('type', [
  z
    .object({ type: z.literal('buyProperty'), propertyId: id, name: z.string().min(3).max(70) })
    .strict(),
  z
    .object({
      type: z.literal('trade'),
      offerId: id,
      quantity: amount.max(1000000),
      destinationId: id,
      carrierId: id,
      expectedTotal: amount.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('produce'),
      establishmentId: id,
      recipeId: id,
      cycles: amount.max(100),
    })
    .strict(),
  z.object({ type: z.literal('extract'), establishmentId: id, quantity: amount.max(100) }).strict(),
  z
    .object({
      type: z.literal('setPrice'),
      establishmentId: id,
      product,
      price: amount.max(100000000),
    })
    .strict(),
  z
    .object({
      type: z.literal('publishOffer'),
      establishmentId: id,
      product,
      price: amount.max(100000000),
    })
    .strict(),
  z.object({ type: z.literal('toggleOperation'), establishmentId: id }).strict(),
  z
    .object({ type: z.literal('setAutomation'), establishmentId: id, enabled: z.boolean() })
    .strict(),
  z.object({ type: z.literal('buyVehicle') }).strict(),
]);
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, mode: 'local-development', version: '0.2.0' }),
);
const worldView = (w: World) => ({ ...w, marketHistory: w.marketHistory.slice(-220) });
app.get('/api/world', (_req, res) => res.json(worldView(store.tick())));
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
              ? regions.find((r) => r.id === e.regionId)?.state === regionId.slice(6)
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
    res.json(worldView(store.command(actor, commandSchema.parse(req.body), key)));
  } catch (error) {
    next(error);
  }
});
const pending = new Map<string, Promise<Route | undefined>>();
app.get('/api/route', async (req, res, next) => {
  try {
    const w = store.read();
    const origin = w.properties.find((x) => x.id === req.query.origin),
      dest = w.properties.find((x) => x.id === req.query.destination);
    if (!origin || !dest) return res.status(400).json({ error: 'Origem ou destino inválido.' });
    const key = `${origin.id}:${dest.id}`;
    if (w.routes[key]) return res.json(w.routes[key]);
    if (!pending.has(key))
      pending.set(
        key,
        (async () => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${origin.coordinates.join(',')};${dest.coordinates.join(',')}?overview=full&geometries=geojson`;
            const response = await fetch(url, {
              signal: AbortSignal.timeout(8000),
              headers: { 'User-Agent': 'Aftermarket-local-prototype/0.1' },
            });
            if (!response.ok) return;
            const json = (await response.json()) as {
              code: string;
              routes: {
                distance: number;
                duration: number;
                geometry: { coordinates: [number, number][] };
              }[];
            };
            const result = json.routes?.[0];
            if (json.code !== 'Ok' || !result) return;
            const route: Route = {
              coordinates: result.geometry.coordinates,
              distanceKm: result.distance / 1000,
              durationSeconds: result.duration,
              source: 'osrm',
            };
            store.route(key, route);
            return route;
          } catch {
            return;
          } finally {
            pending.delete(key);
          }
        })(),
      );
    const route = await pending.get(key);
    if (!route)
      return res.status(503).json({
        error:
          'Roteamento indisponível. A cotação usa uma estimativa geográfica identificada na tela.',
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
    store.tick();
  } catch (e) {
    console.error('Falha ao processar eventos', e);
  }
}, 2000);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`AFTERMARKET API · http://127.0.0.1:${port} · SQLite persistente`),
);
function stop() {
  clearInterval(tick);
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
