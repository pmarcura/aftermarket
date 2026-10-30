import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Sobe só a apresentação (Vite) e aponta para a bancada de simulações em /lab.
// Não precisa de API nem de banco: as simulações rodam num worker do navegador.
const port = Number(process.env.AFTERMARKET_WEB_PORT ?? 5173);
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: resolve('.'), stdio: 'inherit', windowsHide: true, env: process.env },
);
vite.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
vite.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
console.log(`Laboratório: http://127.0.0.1:${port}/lab · Ctrl+C encerra o servidor.`);
const stop = () => {
  if (vite.exitCode === null) vite.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
