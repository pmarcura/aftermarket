import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { applyLabOpening } from '../packages/simulation/src/lab-experiments';
import {
  analyzeDesign,
  cyclesPerDay,
  dailyFlows,
  designRecipes,
  designWorld,
} from '../packages/simulation/src/economy-design';
import type { ProductId, World } from '../packages/simulation/src/model';

// Prova da economia: mundo jogável por N dias em várias sementes, medido contra a ECONOMIA-ALVO.
// Uso: npm run economy:proof -- [--days=60] [--window=30] [--seeds=0,1,2,3,4] [--scale=1] [--write-doc]
// A régua padrão (constituição §5) é a dos valores padrão; a escala do playtest grande é --scale=20.
// Sementes em paralelo: rode uma por processo com --out e junte com --from=a.json,b.json --write-doc:
//   for s in 0 1 2 3 4; do npm run economy:proof -- --scale=20 --seeds=$s --out=test-results/p20-s$s.json & done; wait
//   npm run economy:proof -- --from=test-results/p20-s0.json,...,test-results/p20-s4.json --write-doc
// Cada métrica sai como mediana, mínimo e máximo entre sementes; nunca só a média.
//
// Resultado por negócio (spec 003, R1), por empresa-bot e somado por especialidade, por dia da janela:
//   caixa operacional da janela (entradas − saídas do extrato, sem imóvel e equipamento, crédito,
//   verba do cenário, educação, caminhões comprados para a frota e venda de ativos)
//   + Δ(estoque a custo médio + lotes em curso a custo + mercadoria comprada em trânsito a custo)
// Nenhum preço de referência entra no resultado: o estoque vale o custo médio ponderado que o
// motor mantém (`unitCosts`), o lote em curso vale o insumo e o processamento já pagos
// (`Job.outputCosts`, totais por produto) e a carga em trânsito vale mercadoria + frete
// (`Shipment.cost + freight`), exatamente o que entra no custo médio do destino na entrega.
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
const days = from[0]?.days ?? Number(arg('days', '60'));
const seeds = from.length
  ? from.flatMap((f) => f.results.map((r) => r.seed))
  : arg('seeds', '0,1,2,3,4').split(',').map(Number);
// Janela medida: os últimos dias, depois da partida (padrão: 30 dias, metade em rodadas curtas).
const window = from[0]?.window ?? Number(arg('window', String(Math.min(30, Math.ceil(days / 2)))));
const out = arg('out', 'test-results/economy-proof.json');
const scale = from[0]?.scale ?? Number(arg('scale', '1'));
if (
  from.some((f) => f.days !== days || (f.window ?? window) !== window || (f.scale ?? 1) !== scale)
)
  throw new Error('Os arquivos de --from precisam ter os mesmos dias, janela e escala.');
if (new Set(seeds).size !== seeds.length) throw new Error('Semente repetida na prova.');
const AT = Date.UTC(2026, 9, 26, 12);
const flows = dailyFlows();
const design = analyzeDesign();

// Alvos dos KPIs (spec 003, R4/R5): o documento lê daqui. Faixas fechadas [mín, máx].
export const targets = {
  coverageAll: { min: 0.55, note: 'procura atendida pelas lojas-bot (D-031: equipe para 60%)' },
  idleStockDays: { min: 1, max: 7 },
  concentration: {
    max: 2500,
    fromScale: 20,
    note: 'HHI das vendas no atacado; alvo só na escala 20',
  },
  broke: { max: 0 },
  governmentSteel: { minShare: 0.8, perDay: designWorld.government.steelTonnesPerDay },
  moneyDrift: { max: 0 },
  profitRatio: { min: 0.8, max: 1.2 },
  utilization: { min: 0.7, max: 0.95 },
};

// KPIs por receita (R4). A receita alternativa (aço reciclado) roda nas unidades da receita base e
// entra no grupo dela: utilização e resultado são das unidades, que trocam de receita lote a lote.
interface RecipeKpi {
  installedLines: number; // linhas de equipamento instaladas nas unidades da especialidade
  utilization: number | null; // linhas-dia usadas ÷ linhas-dia instaladas na janela
  profitPerLine: number | null; // resultado/dia dos bots da especialidade ÷ linhas observadas
  projectProfitPerLine: number; // lucro de projeto da calculadora (utilização e preço realizado)
  profitRatio: number | null; // observado ÷ projeto
  realizedPrice: number | null; // preço médio das vendas no atacado dos produtores ÷ referência
}

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
  recipes: Record<string, RecipeKpi>;
  uncostedStock: number;
  idleStockDays: Record<string, number>;
  concentration: Record<string, number>;
}

const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
// Ativo circulante de cada empresa a custo: estoque a custo médio, lotes em curso e cargas
// compradas ainda na estrada. O caixa sozinho chama de prejuízo o estoque formado.
const stockValue = (w: World) => {
  const value = new Map<string, number>();
  const add = (company: string, v: number) => value.set(company, (value.get(company) ?? 0) + v);
  const owner = new Map(w.establishments.map((e) => [e.id, e.companyId]));
  for (const e of w.establishments)
    for (const [id, q] of Object.entries(e.inventory) as [ProductId, number][])
      add(e.companyId, q * (e.unitCosts[id] ?? 0));
  // Lote em curso: o insumo já saiu do estoque e o processamento já foi pago.
  for (const j of w.jobs)
    if (!j.completed)
      add(
        owner.get(j.establishmentId) ?? '',
        j.outputCosts ? Object.values(j.outputCosts).reduce((n, v) => n + (v ?? 0), 0) : j.cost,
      );
  // Carga em trânsito: compra paga (ou custo do estoque transferido entre unidades) mais o frete.
  for (const s of w.shipments)
    if (!s.delivered && !s.infrastructureId) add(s.buyerId, s.cost + s.freight);
  return value;
};
// Estoque sem custo médio registrado: não deveria existir; medido para a régua não esconder valor.
const uncostedStock = (w: World) =>
  w.establishments.reduce(
    (n, e) =>
      n +
      (Object.entries(e.inventory) as [ProductId, number][]).filter(
        ([id, q]) => q > 0 && e.unitCosts[id] === undefined,
      ).length,
    0,
  );

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
  // Resultado operacional por especialidade dos rivais (fórmula no topo do arquivo).
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
  // Caminhão montado comprado para a frota é capital do comprador (vai para a frota, não para o
  // estoque); para a montadora continua sendo venda.
  const fleetPurchase = (l: (typeof recent)[number]) =>
    l.kind === 'trade' && /^Compra de Caminhão/.test(l.description);
  const flowOf = new Map<string, number>();
  for (const l of recent)
    if (!capital.has(l.kind)) {
      if (fleetPurchase(l)) {
        flowOf.set(l.to, (flowOf.get(l.to) ?? 0) + l.amount);
        continue;
      }
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
  // KPIs por receita: utilização, lucro por linha observado ÷ projeto e preço realizado.
  const keyOf = new Map(
    w.companies.map((c) => {
      const unit = w.establishments.find((e) => e.companyId === c.id);
      return [c.id, unit ? (unit.specialization ?? unit.category) : ''];
    }),
  );
  const recipes: Record<string, RecipeKpi> = {};
  for (const r of designRecipes.filter((r) => !r.alternativeOf)) {
    const group = designRecipes.filter((x) => x.id === r.id || x.alternativeOf === r.id);
    const units = w.establishments.filter((e) => e.specialization === r.id);
    const installedLines = units.reduce((n, e) => {
      const area = w.properties.find((p) => p.id === e.propertyId)?.area ?? 0;
      const profile = w.season.config.operations.profiles[r.id];
      return (
        n +
        (e.installed === false
          ? 0
          : (e.equipmentLines ?? (profile ? Math.floor(area / profile.areaM2) : 0)))
      );
    }, 0);
    const unitIds = new Set(units.map((e) => e.id));
    const usedLineDays = w.jobs
      .filter((j) => j.completed && j.finishesAt > from && unitIds.has(j.establishmentId))
      .reduce((n, j) => {
        const recipe = group.find((x) => x.id === j.recipeId);
        return n + (recipe ? j.cycles / cyclesPerDay(recipe) : 0);
      }, 0);
    const observedLines = usedLineDays / window;
    const projectProfitPerLine = design.recipes.find((x) => x.id === r.id)?.profit ?? 0;
    const profitPerLine =
      margins[r.id] !== undefined && observedLines > 0 ? margins[r.id] / observedLines : null;
    let quantity = 0,
      value = 0;
    if (r.priced)
      for (const l of recent)
        if (
          l.channel === 'wholesale' &&
          l.product === r.priced &&
          l.quantity &&
          keyOf.get(l.to) === r.id
        ) {
          quantity += l.quantity;
          value += l.amount;
        }
    const reference = r.priced ? w.season.config.wholesalePrices[r.priced as ProductId] : 0;
    recipes[r.id] = {
      installedLines,
      utilization: installedLines ? usedLineDays / (installedLines * window) : null,
      profitPerLine,
      projectProfitPerLine,
      profitRatio:
        profitPerLine !== null && projectProfitPerLine
          ? profitPerLine / projectProfitPerLine
          : null,
      realizedPrice: quantity && reference ? value / quantity / reference : null,
    };
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
    recipes,
    uncostedStock: uncostedStock(w),
    idleStockDays,
    concentration,
  };
}

// Mediana, mínimo e máximo entre sementes. Valores ausentes (KPI sem base na semente) ficam fora e
// são contados em `n`; Infinity (estoque sem venda) entra como valor.
export interface Stat {
  median: number | null;
  min: number | null;
  max: number | null;
  n: number;
}
export function stat(values: (number | null | undefined)[]): Stat {
  const v = values
    .filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
    .sort((a, b) => a - b);
  if (!v.length) return { median: null, min: null, max: null, n: 0 };
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return { median, min: v[0], max: v[v.length - 1], n: v.length };
}
// JSON grava Infinity como null: estoque sem venda volta como Infinity ao juntar arquivos.
const days_ = (x: number | null | undefined) => (x === null ? Infinity : x);

function summarize(results: SeedResult[]) {
  const by = (f: (r: SeedResult) => number | null | undefined) => stat(results.map(f));
  const keys = (f: (r: SeedResult) => object) =>
    [...new Set(results.flatMap((r) => Object.keys(f(r))))].sort();
  return {
    moneyDrift: by((r) => r.moneyDrift),
    broke: by((r) => r.broke.length),
    coverageAll: by((r) => r.coverageAll),
    governmentSteelPerDay: by((r) => r.governmentSteelPerDay),
    trucksBoughtPerDay: {
      heavy: by((r) => r.trucksBoughtPerDay.heavy),
      light: by((r) => r.trucksBoughtPerDay.light),
      imported: by((r) => r.trucksBoughtPerDay.imported),
    },
    trucksRetiredPerDay: by((r) => r.trucksRetiredPerDay),
    msPerDay: by((r) => r.msPerDay),
    coverage: Object.fromEntries(
      keys((r) => r.coverage).map((id) => [id, by((r) => r.coverage[id])]),
    ),
    idleStockDays: Object.fromEntries(
      keys((r) => r.idleStockDays).map((id) => [id, by((r) => days_(r.idleStockDays[id]))]),
    ),
    concentration: Object.fromEntries(
      keys((r) => r.concentration).map((id) => [id, by((r) => r.concentration[id])]),
    ),
    lines: Object.fromEntries(designRecipes.map((r) => [r.id, by((x) => x.lines[r.id]?.observed)])),
    margins: Object.fromEntries(keys((r) => r.margins).map((k) => [k, by((r) => r.margins[k])])),
    recipes: Object.fromEntries(
      keys((r) => r.recipes).map((id) => [
        id,
        {
          installedLines: by((r) => r.recipes[id]?.installedLines),
          utilization: by((r) => r.recipes[id]?.utilization),
          profitPerLine: by((r) => r.recipes[id]?.profitPerLine),
          projectProfitPerLine: by((r) => r.recipes[id]?.projectProfitPerLine),
          profitRatio: by((r) => r.recipes[id]?.profitRatio),
          realizedPrice: by((r) => r.recipes[id]?.realizedPrice),
        },
      ]),
    ),
  };
}

const results: SeedResult[] = from.flatMap((f) => f.results);
const range = (x: Stat, f: (n: number) => string) =>
  x.median === null ? '—' : `${f(x.median)} [${f(x.min!)}–${f(x.max!)}]`;
for (const seed of from.length ? [] : seeds) {
  const r = run(seed);
  results.push(r);
  console.log(
    `semente ${seed}: ${Math.round(r.msPerDay)} ms/dia · vendas ${(r.coverageAll * 100).toFixed(0)}% · aço ao governo ${r.governmentSteelPerDay.toFixed(1)} t/dia · caminhões ${r.trucksBoughtPerDay.heavy.toFixed(2)} pesado + ${r.trucksBoughtPerDay.light.toFixed(2)} leve/dia, ${r.trucksRetiredPerDay.toFixed(2)} aposentados/dia · quebras ${r.broke.length}`,
  );
}
const summary = summarize(results);
if (results.length > 1) {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const one = (n: number) => n.toFixed(1);
  console.log(
    `${results.length} sementes, mediana [mín–máx]: vendas ${range(summary.coverageAll, pct)} · aço ao governo ${range(summary.governmentSteelPerDay, one)} t/dia · quebras ${range(summary.broke, String)} · dinheiro ${range(summary.moneyDrift, String)}`,
  );
}
mkdirSync('test-results', { recursive: true });
writeFileSync(out, JSON.stringify({ days, window, scale, seeds, results, summary }, null, 2));
console.log(`Relatório completo em ${out}`);
if (process.argv.includes('--write-doc')) writeDoc();

function writeDoc() {
  // Mediana entre sementes (spec 003, R3); o formato completo com faixa vem na T6.
  const avg = (f: (r: SeedResult) => number) => stat(results.map(f)).median ?? 0;
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
