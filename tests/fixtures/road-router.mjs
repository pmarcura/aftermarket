import { createServer } from 'node:http';
// Fixture geométrica deliberadamente curva. Não representa uma rodovia real.
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/health') {
    res.end('ok');
    return;
  }
  const points = decodeURIComponent(path.split('/').at(-1))
    .split(';')
    .map((p) => p.split(',').map(Number));
  if (points.length < 2 || points.some((p) => p.length !== 2 || !p.every(Number.isFinite))) {
    res.writeHead(400);
    res.end('{}');
    return;
  }
  const waypoints = points.map((location) => ({ location, name: 'Estrada de teste', distance: 0 }));
  if (path.startsWith('/table/')) {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        code: 'Ok',
        sources: waypoints,
        destinations: waypoints,
        durations: points.map((a) =>
          points.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 5000),
        ),
      }),
    );
    return;
  }
  const [a, b] = points,
    middle = [(a[0] + b[0]) / 2 + 0.003, (a[1] + b[1]) / 2 - 0.004];
  const km = Math.max(0.5, Math.hypot((a[0] - b[0]) * 103, (a[1] - b[1]) * 111) * 1.3);
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      code: 'Ok',
      waypoints,
      routes: [
        {
          distance: km * 1000,
          duration: (km / 65) * 3600,
          geometry: { coordinates: [a, middle, b] },
          legs: [
            {
              steps: [
                {
                  name: 'Estrada de teste',
                  distance: km * 1000,
                  duration: (km / 65) * 3600,
                  maneuver: { location: a },
                },
              ],
            },
          ],
        },
      ],
    }),
  );
});
server.listen(3014, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
