import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { resolve } from 'node:path';

const watching = process.argv.includes('--watch');
let active = false,
  pending = false;
let timer: ReturnType<typeof setTimeout>;
function script(path: string, args: string[] = []) {
  return new Promise<number>((done, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', path, ...args], {
      cwd: resolve('.'),
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => done(code ?? 1));
  });
}
async function refresh() {
  if (active) {
    pending = true;
    return;
  }
  active = true;
  try {
    const capture = await script('scripts/capture-lab.ts', ['--flows', '--compare']);
    const batch = await script(
      'scripts/lab-batch.ts',
      process.argv.filter((a) =>
        /^--(?:compare-)?(days|seeds|seed|scenario|compare|demand|cost|capacity|capacity-recipe|freight|policy|seed-mode|shock-day|shock-type|shock-multiplier)=/.test(
          a,
        ),
      ),
    );
    const context = await script('scripts/lab-context.ts', ['--write', '--quiet']);
    if (!watching) process.exitCode = capture || batch || context;
    console.log(
      JSON.stringify({
        refreshed: new Date().toISOString(),
        capture,
        batch,
        context,
        lab: 'http://127.0.0.1:5173/lab',
        contextFile: '.runtime/lab/context.json',
      }),
    );
  } finally {
    active = false;
    if (pending) {
      pending = false;
      void refresh();
    }
  }
}
if (watching) {
  for (const folder of ['apps/web/src', 'packages/simulation/src', 'packages/world/src'])
    watch(resolve(folder), { recursive: true }, (_event, name) => {
      if (!name || !/\.(tsx?|css|json)$/.test(String(name))) return;
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 1200);
    });
  console.log('Laboratório observa alterações. Ctrl+C encerra. Coleta repetitiva sem agentes.');
}
await refresh();
