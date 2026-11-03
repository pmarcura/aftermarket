import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';

// Servidor de produção e mundo exclusivos do teste. Nunca abre os bancos locais do jogador.
const root = resolve('.runtime/online-test');
const currentFile = resolve(root, 'current.json');
const stopping = process.argv.includes('--stop');
type Session = {
  url: string;
  token: string;
  controlUrl: string;
  database: string;
  startedAt: string;
  stoppedAt?: string;
};

if (stopping) {
  if (!existsSync(currentFile)) throw new Error('Não há teste online registrado.');
  const current = JSON.parse(readFileSync(currentFile, 'utf8')) as Session;
  const response = await fetch(`${current.controlUrl}/stop`, {
    method: 'POST',
    headers: { authorization: `Bearer ${current.token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Não foi possível encerrar o teste registrado.');
  console.log('Teste online encerrado. O banco de teste foi preservado.');
} else {
  await start();
}

async function start() {
  if (!existsSync('dist/web/index.html'))
    throw new Error('Execute npm run build antes de abrir o teste online.');
  const connector = resolve(
    process.env.AFTERMARKET_CLOUDFLARED ??
      `.runtime/tools/cloudflared${process.platform === 'win32' ? '.exe' : ''}`,
  );
  if (!existsSync(connector))
    throw new Error('Conector ausente. Consulte docs/operations/ONLINE-PREVIEW.md.');
  const port = Number(process.env.AFTERMARKET_PREVIEW_PORT ?? 3020);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Porta de teste inválida.');
  const directory = resolve(root, new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(directory, { recursive: true });
  const database = resolve(directory, 'world.sqlite');
  const token = randomBytes(32).toString('hex');
  const children: ChildProcess[] = [];
  let session: Session | undefined;
  let closed = false;
  let control: Server | undefined;
  // Reserva a porta antes de criar o túnel: nunca expor outro servidor já em execução.
  const placeholder = createServer((_req, res) => {
    res.writeHead(503, { 'Cache-Control': 'no-store' });
    res.end('Preparando o teste.');
  });
  const shutdown = () => {
    if (closed) return;
    closed = true;
    for (const child of children) child.kill();
    placeholder.close();
    control?.close();
    if (session)
      writeFileSync(
        currentFile,
        JSON.stringify({ ...session, stoppedAt: new Date().toISOString() }, null, 2),
      );
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', shutdown);
  try {
    await listen(placeholder, port);
    const tunnel = spawn(
      connector,
      ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    children.push(tunnel);
    const origin = await new Promise<string>((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('O túnel não abriu em 60 segundos.')), 60000);
      let tail = '';
      const consume = (chunk: Buffer) => {
        const message = chunk.toString();
        process.stderr.write(message);
        tail = (tail + message).slice(-10000);
        const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearTimeout(timer);
          accept(match[0]);
        }
      };
      tunnel.stdout!.on('data', consume);
      tunnel.stderr!.on('data', consume);
      tunnel.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      tunnel.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('O conector encerrou antes de abrir o túnel.'));
        shutdown();
      });
    });
    await new Promise<void>((done) => placeholder.close(() => done()));
    const api = spawn(
      process.execPath,
      ['--import', 'tsx', 'apps/server/src/index.ts', '--production'],
      {
        env: {
          ...process.env,
          AFTERMARKET_PORT: String(port),
          AFTERMARKET_DB_FILE: database,
          AFTERMARKET_SCENARIO: 'economy-2',
          AFTERMARKET_WORLD_SCALE: '20',
          AFTERMARKET_PREVIEW_TOKEN: token,
          AFTERMARKET_PUBLIC_ORIGIN: origin,
        },
        windowsHide: true,
        stdio: ['ignore', 'inherit', 'inherit'],
      },
    );
    children.push(api);
    api.once('error', shutdown);
    api.once('exit', shutdown);
    // Controle só em loopback, fora do túnel, para encerrar os dois processos pelo npm.
    control = createServer((req, res) => {
      if (
        req.method !== 'POST' ||
        req.url !== '/stop' ||
        req.headers.authorization !== `Bearer ${token}`
      ) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200).end('Encerrado.');
      res.once('finish', shutdown);
    });
    await listen(control, 0);
    const address = control.address();
    if (!address || typeof address === 'string')
      throw new Error('Falha ao abrir o controle local.');
    session = {
      url: `${origin}/preview?key=${token}`,
      token,
      controlUrl: `http://127.0.0.1:${address.port}`,
      database,
      startedAt: new Date().toISOString(),
    };
    writeFileSync(currentFile, JSON.stringify(session, null, 2));
    console.log(`Mundo de teste: ${database}`);
    console.log(`Link privado (compartilhe somente com os participantes): ${session.url}`);
    console.log('Temporário: mantenha este computador ligado. Encerrar: npm run preview:stop');
  } catch (error) {
    shutdown();
    throw error;
  }
}

function listen(server: Server, port: number) {
  return new Promise<void>((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      accept();
    });
  });
}
