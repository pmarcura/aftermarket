import { spawn } from 'node:child_process';
// Campanha separada; nunca altera .runtime/world.sqlite.
const env = {
  ...process.env,
  AFTERMARKET_DB_FILE: '.runtime/starter.sqlite',
  AFTERMARKET_SCENARIO: 'starter',
  AFTERMARKET_PORT: '3015',
  AFTERMARKET_WEB_PORT: '5185',
};
const api = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/server/src/index.ts'], {
  env,
  stdio: 'inherit',
});
const web = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5185', '--strictPort'],
  { env, stdio: 'inherit' },
);
console.log(
  'Campanha iniciante separada: http://127.0.0.1:5185 · dados em .runtime/starter.sqlite',
);
function stop() {
  api.kill();
  web.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', () => web.kill());
web.on('exit', () => api.kill());
