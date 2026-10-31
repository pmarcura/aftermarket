import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { applyLabOpening } from '../packages/simulation/src/lab-experiments';
import { cyclesPerDay, dailyFlows, designRecipes } from '../packages/simulation/src/economy-design';
import type { ProductId, World } from '../packages/simulation/src/model';

// Prova da fatia 10: mundo versão 2 por N dias em várias sementes, medido contra a ECONOMIA-ALVO.
// Uso: npm run economy:proof -- --days=90 --seeds=0,1,2 [--write-doc]
// Sementes em paralelo: rode uma por processo com --out e junte com --from=a.json,b.json --write-doc.
const arg = (name: string, fallback: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const from = arg('from', '')
  .split(',')
  .filter(Boolean)
  .map(
    (f) =>
      JSON.parse(readFileSync(f, 'utf8')) as {
        days: number;
        window?: number;
        scale?: number;
        results: SeedResult[];
      },
  );
const days = from[0]?.days ?? Number(arg('days', '90'));
const seeds = from.length
  ? from.flatMap((f) => f.results.map((r) => r.seed))
  : arg('seeds', '0,1,2').split(',').map(Number);
// Janela medida: os últimos dias, depois da partida (padrão: até 30 dias, metade em rodadas curtas).
const window = from[0]?.window ?? Number(arg('window', String(Math.min(30, Math.ceil(days / 2)))));
const out = arg('out', 'test-results/economy-proof.json');
const scale = from[0]?.scale ?? Number(arg('scale', '1'));
const AT = Date.UTC(2026, 9, 26, 12);
const flows = dailyFlows();

interface SeedResult {
  seed: number;
  msPerDay: number;
  moneyDrift: number;
  coverage: Record<string, number>;
  coverageAll: number;
  lines: Record<string, { reference: number; observed: number }>;
  governmentSteelPerDay: number;
  trucksBoughtPerDay: { heavy: number; light: number; imported: number };
  trucksRetiredPerDay: number;
  broke: string[];
  margins: Record<string, number>;
  idleStockDays: Record<string, number>;
  concentration: Record<string, number>;
}

const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
// Estoque de cada empresa ao preço de referência: o caixa sozinho chama de prejuízo o estoque formado.
const stockValue = (w: World) => {
  const value = new Map<string, number>();
  for (const e of w.establishments)
    for (const [id, q] of Object.entries(e.inventory) as [ProductId, number][])
      value.set(
        e.companyId,
        (value.get(e.companyId) ?? 0) + q * (w.season.config.wholesalePrices[id] ?? 0),
      );
  return value;
};

function run(seed: number): SeedResult {
  const w = createScenario(AT, 'playtest', seed, { scale });
  applyLabOpening(w, {
    seed,
    seedMode: 'conditions',
    demandMultiplier: 1,
    costMultiplier: 1,
    capacityMultiplier: 1,
    freightMultiplier: 1,
    botPolicy: 'mixed',
  });
  const opening = money(w);
  const from = AT + (days - window) * GAME_DAY;
  const desired: Record<string, number> = {},
    sold: Record<string, number> = {};
  const completed = new Set(
    w.infrastructure.filter((c) => c.status === 'completed').map((c) => c.id),
  );
  let governmentSteel = 0,
    retired = 0,
    drift = 0;
  let fleet = new Map(w.vehicles.map((v) => [v.id, v.companyId]));
  let startStock = stockValue(w);
  const started = performance.now();
  for (let d = 1; d <= days; d++) {
    const dayStart = AT + (d - 1) * GAME_DAY;
    advance(w, AT + d * GAME_DAY);
    drift = Math.max(drift, Math.abs(money(w) - opening));
    if (AT + d * GAME_DAY === from) startStock = stockValue(w);
    if (dayStart < from) {
      fleet = new Map(w.vehicles.map((v) => [v.id, v.companyId]));
      for (const c of w.infrastructure) if (c.status === 'completed') completed.add(c.id);
      continue;
    }
    for (const s of w.consumptionHistory)
      if (s.at > dayStart && s.at <= AT + d * GAME_DAY) {
        desired[s.product] = (desired[s.product] ?? 0) + s.desired;
        sold[s.product] = (sold[s.product] ?? 0) + s.sold;
      }
    for (const c of w.infrastructure)
      if (c.status === 'completed' && !completed.has(c.id)) {
        completed.add(c.id);
        if (c.product === 'steel') governmentSteel += c.quantity;
      }
    // Caminhão que some da frota privada: desmontado ou vendido ao fundo estadual.
    const now = new Map(w.vehicles.map((v) => [v.id, v.companyId]));
    for (const [id, owner] of fleet)
      if (!owner.startsWith('treasury') && (!now.has(id) || now.get(id)!.startsWith('treasury')))
        retired++;
    fleet = now;
  }
  const msPerDay = (performance.now() - started) / days;
  const recent = w.ledger.filter((l) => l.at > from);
  const coverage = Object.fromEntries(
    Object.keys(desired).map((id) => [id, sold[id]! / desired[id]!]),
  );
  const totalDesired = Object.values(desired).reduce((n, v) => n + v, 0);
  const totalSold = Object.values(sold).reduce((n, v) => n + v, 0);
  const lines: SeedResult['lines'] = {};
  for (const r of designRecipes) {
    const cycles = w.jobs
      .filter((j) => j.recipeId === r.id && j.completed && j.finishesAt > from)
      .reduce((n, j) => n + j.cycles, 0);
    lines[r.id] = {
      reference: (flows.lines[r.id] ?? 0) * scale,
      observed: cycles / window / cyclesPerDay(r),
    };
  }
  const bought = (re: RegExp) =>
    recent.filter((l) => (l.kind === 'trade' || l.kind === 'vehicle') && re.test(l.description))
      .length / window;
  // Resultado operacional por especialidade dos rivais: entradas menos saídas mais o estoque
  // formado, sem capital (imóveis, crédito, caminhões comprados e vendidos, educação da equipe).
  // Uma vez por empresa: antes, empresa com duas unidades entrava duas vezes.
  const margins: Record<string, number> = {};
  const capital = new Set([
    'property',
    'loan',
    'repayment',
    'budget',
    'asset-sale',
    'vehicle',
    'education',
  ]);
  const flowOf = new Map<string, number>();
  for (const l of recent)
    if (!capital.has(l.kind)) {
      flowOf.set(l.to, (flowOf.get(l.to) ?? 0) + l.amount);
      flowOf.set(l.from, (flowOf.get(l.from) ?? 0) - l.amount);
    }
  const endStock = stockValue(w);
  for (const c of w.companies.filter((c) => c.id.startsWith('rival-'))) {
    const units = w.establishments.filter((e) => e.companyId === c.id);
    if (!units.length) continue;
    const key = units[0].specialization ?? units[0].category;
    const stock = (endStock.get(c.id) ?? 0) - (startStock.get(c.id) ?? 0);
    margins[key] = (margins[key] ?? 0) + ((flowOf.get(c.id) ?? 0) + stock) / window;
  }
  // Estoque parado: dias de venda que o estoque total cobre, pelo atacado e varejo recentes.
  const idleStockDays: Record<string, number> = {};
  const moved: Record<string, number> = {};
  for (const l of recent)
    if (l.product && l.quantity) moved[l.product] = (moved[l.product] ?? 0) + l.quantity;
  for (const e of w.establishments)
    for (const [id, q] of Object.entries(e.inventory) as [ProductId, number][])
      idleStockDays[id] = (idleStockDays[id] ?? 0) + q;
  for (const id of Object.keys(idleStockDays))
    idleStockDays[id] = moved[id] ? idleStockDays[id] / (moved[id] / window) : Infinity;
  // Concentração (HHI 0–10.000) das vendas no atacado por empresa vendedora.
  const concentration: Record<string, number> = {};
  const byProduct: Record<string, Record<string, number>> = {};
  for (const l of recent.filter((l) => l.channel === 'wholesale' && l.product)) {
    const p = (byProduct[l.product!] ??= {});
    p[l.to] = (p[l.to] ?? 0) + l.amount;
  }
  for (const [id, sellers] of Object.entries(byProduct)) {
    const total = Object.values(sellers).reduce((n, v) => n + v, 0);
    concentration[id] = Object.values(sellers).reduce((n, v) => n + (v / total) ** 2 * 10000, 0);
  }
  const specialty = (id: string) =>
    w.establishments
      .filter((e) => e.companyId === id)
      .map((e) => e.specialization ?? e.category)
      .join('+');
  const broke = w.companies
    .filter((c) => c.id.startsWith('rival-') && c.balance < 0)
    .map((c) => `${c.id} ${specialty(c.id)}`)
    .concat(
      w.establishments
        .filter((e) => e.companyId.startsWith('rival-') && e.mothballed)
        .map((e) => `${e.companyId} ${e.specialization ?? e.category} suspensa`),
    );
  return {
    seed,
    msPerDay,
    moneyDrift: drift,
    coverage,
    coverageAll: totalSold / totalDesired,
    lines,
    governmentSteelPerDay: governmentSteel / window,
    trucksBoughtPerDay: {
      heavy: bought(/Caminhão pesado/),
      light: bought(/Caminhão leve/),
      imported: bought(/importado/),
    },
    trucksRetiredPerDay: retired / window,
    broke,
    margins,
    idleStockDays,
    concentration,
  };
}

const results: SeedResult[] = from.flatMap((f) => f.results);
for (const seed of from.length ? [] : seeds) {
  const r = run(seed);
  results.push(r);
  console.log(
    `semente ${seed}: ${Math.round(r.msPerDay)} ms/dia · vendas ${(r.coverageAll * 100).toFixed(0)}% · aço ao governo ${r.governmentSteelPerDay.toFixed(1)} t/dia · caminhões ${r.trucksBoughtPerDay.heavy.toFixed(2)} pesado + ${r.trucksBoughtPerDay.light.toFixed(2)} leve/dia, ${r.trucksRetiredPerDay.toFixed(2)} aposentados/dia · quebras ${r.broke.length}`,
  );
}
mkdirSync('test-results', { recursive: true });
writeFileSync(out, JSON.stringify({ days, window, scale, seeds, results }, null, 2));
console.log(`Relatório completo em ${out}`);
if (process.argv.includes('--write-doc')) writeDoc();

function writeDoc() {
  const avg = (f: (r: SeedResult) => number) =>
    results.reduce((n, r) => n + f(r), 0) / results.length;
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const fmt = (n: number, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
  const rows = designRecipes.map((r) => {
    const observed = avg((x) => x.lines[r.id].observed),
      reference = (flows.lines[r.id] ?? 0) * scale;
    return `| ${r.name} | ${fmt(reference)} | ${fmt(observed)} | ${reference ? pct(observed / reference) : '—'} | ${fmt(
      avg((x) => (x.margins[r.id] ?? 0) / 100),
      0,
    )} |`;
  });
  for (const [key, name] of [
    ['retail', 'Lojas'],
    ['warehouse', 'Distribuidores'],
  ])
    rows.push(
      `| ${name} | — | — | — | ${fmt(
        avg((x) => (x.margins[key] ?? 0) / 100),
        0,
      )} |`,
    );
  const products = Object.keys(results[0].coverage).sort();
  const doc = `# Prova da economia versão 2

Gerado por \`npm run economy:proof -- --days=${days} --window=${window} --scale=${scale} --seeds=${seeds.join(',')} --write-doc\`, escala ${scale} do mundo de referência. Médias de ${seeds.length} sementes nos últimos ${window} dias de ${days}. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em \`test-results/economy-proof.json\`.

## Resumo

| Critério | Alvo | Observado |
| --- | --- | --- |
| Dinheiro conservado | diferença 0 | ${results.every((r) => r.moneyDrift === 0) ? 'sim, em todas as sementes' : 'NÃO'} |
| Empresas quebradas ou suspensas | nenhuma | ${results.map((r) => r.broke.length).join(' / ')} |
| Procura atendida pelas lojas | 70% | ${pct(avg((r) => r.coverageAll))} |
| Aço ao governo | ${fmt(16 * scale, 0)} t/dia | ${fmt(avg((r) => r.governmentSteelPerDay))} t/dia |
| Caminhões comprados | ${fmt(0.8 * scale)} pesado + ${fmt(0.8 * scale)} leve/dia | ${fmt(
    avg((r) => r.trucksBoughtPerDay.heavy),
    2,
  )} + ${fmt(
    avg((r) => r.trucksBoughtPerDay.light),
    2,
  )}/dia (${fmt(
    avg((r) => r.trucksBoughtPerDay.imported),
    2,
  )} importados) |
| Caminhões aposentados | reposição | ${fmt(
    avg((r) => r.trucksRetiredPerDay),
    2,
  )}/dia |
| Tempo de simulação | — | ${fmt(avg((r) => r.msPerDay) / 1000, 1)} s por dia de jogo |

## Desvios explicados

- **Procura atendida abaixo de 70%:** as lojas-bot contratam equipe para 60% da procura da cidade (D-031). O resto fica para as lojas dos jogadores; sem humanos, a prova mede só os bots.
- **Linhas abaixo da referência:** os bots abrem com 60% a 90% das linhas da calculadora; a diferença é espaço para os jogadores.
- **Montadoras com pouca procura:** a frota cresce pouco depois de cheia, e a reposição depende do desgaste (vida útil comprimida, D-033). Uma montadora de jogador concorre com a de bot pela mesma procura.
- **Aço ao governo abaixo da meta:** cada edital pede de 6 a 24 t de uma só usina; as fábricas compram o aço assim que sai do forno, as usinas raramente juntam 24 t e os editais maiores expiram sem lance (D-038).
- **Tempo de simulação:** as sementes rodam em paralelo no mesmo computador; o tempo por dia é maior do que numa rodada isolada.

## Produção por negócio

"Linhas" é a produção diária dividida pela de uma linha a plena capacidade. Resultado é o lucro operacional diário dos bots da especialidade: entradas menos saídas mais o estoque formado a preço de referência, sem imóveis, crédito, caminhões e educação da equipe.

| Negócio | Linhas na referência | Linhas observadas | % | Resultado dos bots/dia (R$) |
| --- | ---: | ---: | ---: | ---: |
${rows.join('\n')}

## Procura atendida por produto

| Produto | Atendida |
| --- | ---: |
${products.map((id) => `| ${id} | ${pct(avg((r) => r.coverage[id] ?? 0))} |`).join('\n')}

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto | Dias de estoque | Concentração |
| --- | ---: | ---: |
${Object.keys(results[0].idleStockDays)
  .sort()
  .map(
    (id) =>
      `| ${id} | ${fmt(
        avg((r) => Math.min(999, r.idleStockDays[id] ?? 0)),
        0,
      )} | ${fmt(
        avg((r) => r.concentration[id] ?? 0),
        0,
      )} |`,
  )
  .join('\n')}
`;
  const target = arg('doc', 'docs/product/PROVA-V2.md');
  writeFileSync(target, doc);
  console.log(`Documento em ${target}`);
}
