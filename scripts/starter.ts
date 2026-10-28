import { spawn } from 'node:child_process';
// Campanhas separadas; nunca alteram .runtime/world.sqlite.
// `npm run dev:starter` abre o cenário iniciante; `npm run dev:v2`, o mundo da economia versão 2.
const campaigns = {
  starter: { db: '.runtime/starter.sqlite', api: '3015', web: '5185', label: 'Campanha iniciante' },
  'economy-2': {
    db: '.runtime/economy-2.sqlite',
    api: '3016',
    web: '5186',
    label: 'Economia versão 2',
  },
} as const;
const name = (process.argv.find((a) => a.startsWith('--scenario='))?.split('=')[1] ??
  'starter') as keyof typeof campaigns;
const campaign = campaigns[name];
if (!campaign) throw new Error(`Cenário desconhecido: ${name}`);
const env = {
  ...process.env,
  AFTERMARKET_DB_FILE: campaign.db,
  AFTERMARKET_SCENARIO: name,
  AFTERMARKET_PORT: campaign.api,
  AFTERMARKET_WEB_PORT: campaign.web,
};
const api = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/server/src/index.ts'], {
  env,
  stdio: 'inherit',
});
const web = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', campaign.web, '--strictPort'],
  { env, stdio: 'inherit' },
);
console.log(
  `${campaign.label} separada: http://127.0.0.1:${campaign.web} · dados em ${campaign.db}`,
);
function stop() {
  api.kill();
  web.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', () => web.kill());
web.on('exit', () => api.kill());
