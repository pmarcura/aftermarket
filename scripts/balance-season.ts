import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorld } from '../packages/simulation/src/seed';
import { advance } from '../packages/simulation/src/engine';
import { products, TIME_SCALE, type ProductId } from '../packages/simulation/src/model';
import { marketView } from '../packages/simulation/src/metrics';

const days = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 365)
  throw new Error('Use --days=1 até --days=365.');
// Laboratório determinístico: nunca abre o banco do jogador nem consulta serviços externos.
const at = Date.UTC(2026, 9, 26, 12),
  world = createWorld(at);
const money = world.companies.reduce((n, c) => n + c.balance, 0),
  output = [];
for (let day = 0; day <= days; day++) {
  if (day) advance(world, at + (day * 86400000) / TIME_SCALE);
  const total = world.companies.reduce((n, c) => n + c.balance, 0);
  if (
    total !== money ||
    world.companies.some((c) => c.balance < 0 || !Number.isSafeInteger(c.balance))
  )
    throw new Error(`Invariante monetário violado no dia ${day}.`);
  output.push({
    day,
    money,
    totalTreasury: world.companies.find((c) => c.id === 'treasury')!.balance,
    consumers: world.companies.find((c) => c.id === 'consumers')!.balance,
    paused: world.establishments.filter((e) => !e.enabled).map((e) => e.id),
    shipments: world.shipments.length,
    delivered: world.shipments.filter((s) => s.delivered).length,
    jobs: world.jobs.length,
    items: (Object.keys(products) as ProductId[]).map((id) => {
      const m = marketView(world, id);
      return {
        id,
        name: products[id].name,
        unit: products[id].unit,
        price: m.price,
        offered: m.stock,
        physical: world.establishments.reduce((n, e) => n + (e.inventory[id] ?? 0), 0),
        traded: m.tradedQuantity,
        coverage: m.coverageDays,
      };
    }),
  });
}
const report = {
  scenario: 'Carteira demonstrativa; ações humanas desativadas; bots com regras comuns',
  days,
  config: world.season.config,
  observations: output,
};
const path = resolve('.runtime/balance', `season-${world.season.config.version}-${days}d.json`);
mkdirSync(resolve('.runtime/balance'), { recursive: true });
writeFileSync(path, JSON.stringify(report, null, 2));
const last = output.at(-1)!;
console.log(
  JSON.stringify(
    {
      report: path,
      days,
      moneyConserved: true,
      paused: last.paused,
      withoutOffers: last.items.filter((i) => i.offered === 0).map((i) => i.name),
      shipments: last.shipments,
      completedJobs: world.jobs.filter((j) => j.completed).length,
      consumerBalance: last.consumers,
      treasuryBalance: last.totalTreasury,
    },
    null,
    2,
  ),
);
