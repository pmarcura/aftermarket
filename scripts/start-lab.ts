import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

const port = Number(process.env.AFTERMARKET_WEB_PORT ?? 5173);
const children: ChildProcess[] = [];
let stopping = false;
function child(args: string[], env = process.env) {
  const processChild = spawn(process.execPath, args, {
    cwd: resolve('.'),
    stdio: 'inherit',
    windowsHide: true,
    env,
  });
  children.push(processChild);
  processChild.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  processChild.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const processChild of children) {
    if (processChild.exitCode !== null || !processChild.pid) continue;
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(processChild.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    else processChild.kill('SIGTERM');
  }
  process.exitCode = code;
}
let existing = false;
try {
  const response = await fetch(`http://127.0.0.1:${port}/__lab/ui/index.json`, {
    signal: AbortSignal.timeout(1500),
  });
  if (response.ok) {
    const report = (await response.json()) as { screens?: { id: string }[] };
    existing = Boolean(report.screens?.some((s) => s.id === 'carrier'));
  }
} catch {
  /* Start only the web presentation; no world API is needed. */
}
if (!existing)
  child(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)]);
child(['--import', 'tsx', 'scripts/refresh-lab.ts', '--watch', ...process.argv.slice(2)]);
console.log(
  `Laboratório: http://127.0.0.1:${port}/lab · coleta automática ativa · Ctrl+C encerra os processos iniciados por este comando.`,
);
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
