import type { Plugin } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/** Somente leitura, somente dev, arquivos de evidência dentro da pasta autorizada. */
export function labArtifacts(): Plugin {
  return {
    name: 'aftermarket-lab-artifacts',
    configureServer(server) {
      for (const section of ['ui', 'studies'])
        server.middlewares.use(`/__lab/${section}`, (req, res, next) => {
          const root = resolve('.runtime/lab', section);
          let name: string;
          try {
            name = decodeURIComponent((req.url ?? '').split('?')[0]);
          } catch {
            res.statusCode = 400;
            res.end();
            return;
          }
          const path = resolve(root, `.${name}`);
          if (!path.startsWith(root + sep) || !/\.(json|png)$/.test(path) || !existsSync(path)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.statusCode = 405;
            res.end();
            return;
          }
          res.setHeader('Content-Type', path.endsWith('.png') ? 'image/png' : 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          const stream = createReadStream(path);
          stream.on('error', next);
          stream.pipe(res);
        });
    },
  };
}
