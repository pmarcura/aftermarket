import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScenario, type ScenarioName } from '../packages/simulation/src/scenarios';
import { economyHealth, outstandingLoans } from '../packages/simulation/src/design';
import { advance } from '../packages/simulation/src/engine';
import { products, TIME_SCALE, type ProductId } from '../packages/simulation/src/model';
import { marketView } from '../packages/simulation/src/metrics';
import { treasuryReserved } from '../packages/simulation/src/operations';

const days = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 365)
  throw new Error('Use --days=1 até --days=365.');
// Laboratório determinístico: nunca abre o banco do jogador nem consulta serviços externos.
const scenario = (process.argv.find((a) => a.startsWith('--scenario='))?.split('=')[1] ??
  'baseline') as ScenarioName;
const seed = Number(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 0);
const at = Date.UTC(2026, 9, 26 + seed, 12),
  world = createScenario(at, scenario, seed);
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
    health: economyHealth(world),
    principal: world.companies.reduce((n, c) => n + outstandingLoans(world, c.id), 0),
    mothballed: world.establishments.filter((e) => e.mothballed).length,
    routingMode: 'estimativa explícita da simulação offline, sem rede',
    totalTreasury: world.companies
      .filter((c) => c.id === 'treasury' || c.id.startsWith('treasury:'))
      .reduce((n, c) => n + c.balance, 0),
    reservedTreasury: treasuryReserved(world),
    infrastructureCompleted: world.infrastructure.filter((c) => c.status === 'completed').length,
    infrastructureSpent: world.infrastructure.reduce((n, c) => n + (c.paid ?? 0), 0),
    consumedSteel: world.consumedMaterials.steel ?? 0,
    rivalsActive: world.companies.filter(
      (c) =>
        c.id.startsWith('rival-') &&
        world.establishments.some((e) => e.companyId === c.id && e.enabled),
    ).length,
    rivalBalances: world.companies
      .filter((c) => c.id.startsWith('rival-'))
      .map((c) => ({ id: c.id, balance: c.balance })),
    pendingOrders: world.orders.filter((o) => o.status === 'pending').length,
    expansions: world.establishments.filter(
      (e) => e.id.startsWith('e-') && !e.id.startsWith('e-public'),
    ).length,
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
  scenario,
  seed,
  note: 'Cenário isolado; ações humanas desativadas; geografia estimada para teste sem rede',
  days,
  config: world.season.config,
  observations: output,
};
const path = resolve('.runtime/balance', `season-0.4-${scenario}-${seed}-${days}d.json`);
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
      treasuryReserved: last.reservedTreasury,
      infrastructureCompleted: last.infrastructureCompleted,
      infrastructureSpent: last.infrastructureSpent,
      consumedSteel: last.consumedSteel,
      pendingOrders: last.pendingOrders,
      rivalsActive: last.rivalsActive,
      arrears: last.health.obligations,
      outstandingPrincipal: last.principal,
      mothballed: last.mothballed,
      velocity: last.health.velocity,
      hhi: last.health.hhi,
    },
    null,
    2,
  ),
);
