import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance } from '../packages/simulation/src/engine';
import { createClock, gameDay } from '../packages/simulation/src/clock';
import { applyLabOpening } from '../packages/simulation/src/lab-experiments';
import { archiveHistory } from '../packages/simulation/src/history';
import { setInvariantChecks } from '../packages/simulation/src/invariants';
import type { Entry, Job } from '../packages/simulation/src/model';
import {
  analyzeDesign,
  cyclesPerDay,
  dailyFlows,
  designItems,
  designRecipes,
  designWorld,
  type DesignItemId,
} from '../packages/simulation/src/economy-design';
import type { ProductId, World } from '../packages/simulation/src/model';

// Prova da economia: mundo jogável por N dias em várias sementes, medido contra a ECONOMIA-ALVO.
// Uso: npm run economy:proof -- [--days=60] [--window=30] [--seeds=0,1,2,3,4] [--scale=1] [--timeScale=120] [--write-doc]
// Dias e janela são de jogo; --timeScale muda só a velocidade do relógio (spec 004, R4): a prova
// avança o relógio do mundo, não espera tempo real, então um dia de jogo custa a mesma CPU.
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
        timeScale?: number;
        commit?: string;
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
const standardTimeScale = createClock().timeScale;
const timeScale = createClock(
  from[0]?.timeScale ?? Number(arg('timeScale', String(standardTimeScale))),
).timeScale;
// Arquiva o histórico como o servidor (padrão). --no-archive mantém tudo na memória: os resultados
// são idênticos (provado na spec 003, escala 1, 60 dias, sementes 0 e 3), só mais lentos.
const archive = !process.argv.includes('--no-archive');
if (
  from.some(
    (f) =>
      f.days !== days ||
      (f.window ?? window) !== window ||
      (f.scale ?? 1) !== scale ||
      (f.timeScale ?? standardTimeScale) !== timeScale,
  )
)
  throw new Error('Os arquivos de --from precisam ter os mesmos dias, janela, escala e relógio.');
if (new Set(seeds).size !== seeds.length) throw new Error('Semente repetida na prova.');
const AT = Date.UTC(2026, 9, 26, 12);
// A prova é ferramenta do laboratório: conservação do dinheiro verificada a cada comando e evento.
setInvariantChecks(true);
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
  // Resultado/dia dos bots da especialidade ÷ linhas instaladas: o lucro de projeto já é por linha
  // instalada a 70% de utilização, então dividir pelas linhas observadas contaria a utilização duas
  // vezes. Derivado de `margins` e `installedLines` por `deriveRecipeKpis`.
  profitPerLine: number | null;
  projectProfitPerLine: number; // lucro de projeto da calculadora (utilização e preço realizado)
  profitRatio: number | null; // observado ÷ projeto
  realizedPrice: number | null; // preço médio das vendas no atacado dos produtores ÷ referência
}

interface SeedResult {
  seed: number;
  seasonHash: string; // sha256 do season.config do mundo criado (12 primeiros dígitos)
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
  const w = createScenario(AT, 'playtest', seed, { scale, timeScale });
  const dayMs = gameDay(w); // dia de jogo em ms reais, na velocidade deste mundo
  const seasonHash = createHash('sha256')
    .update(JSON.stringify(w.season.config))
    .digest('hex')
    .slice(0, 12);
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
  const from = AT + (days - window) * dayMs;
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
  // Arquivo do histórico como no servidor (extrato, lotes e entregas com mais de keepDays dias saem
  // do mundo); a prova guarda o que cai dentro da janela para medir.
  const archivedLedger: Entry[] = [],
    archivedJobs: Job[] = [];
  const started = performance.now();
  for (let d = 1; d <= days; d++) {
    const dayStart = AT + (d - 1) * dayMs;
    advance(w, AT + d * dayMs);
    if (archive) {
      const old = archiveHistory(w, AT + d * dayMs, w.season.config.history.keepDays);
      archivedLedger.push(...old.ledger.filter((l) => l.at > from));
      archivedJobs.push(...old.jobs.filter((j) => j.finishesAt > from));
    }
    // Progresso a cada 5 dias (stderr), para acompanhar rodadas longas na escala 20.
    if (d % 5 === 0 && d < days)
      console.error(
        `semente ${seed}: dia ${d}/${days} · ${((performance.now() - started) / 1000).toFixed(0)} s`,
      );
    drift = Math.max(drift, Math.abs(money(w) - opening));
    if (AT + d * dayMs === from) startStock = stockValue(w);
    if (dayStart < from) {
      fleet = new Map(w.vehicles.map((v) => [v.id, v.companyId]));
      for (const c of w.infrastructure) if (c.status === 'completed') completed.add(c.id);
      continue;
    }
    for (const s of w.consumptionHistory)
      if (s.at > dayStart && s.at <= AT + d * dayMs) {
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
  const recent = [...archivedLedger, ...w.ledger].filter((l) => l.at > from);
  const jobs = [...archivedJobs, ...w.jobs];
  const coverage = Object.fromEntries(
    Object.keys(desired).map((id) => [id, sold[id]! / desired[id]!]),
  );
  const totalDesired = Object.values(desired).reduce((n, v) => n + v, 0);
  const totalSold = Object.values(sold).reduce((n, v) => n + v, 0);
  const lines: SeedResult['lines'] = {};
  for (const r of designRecipes) {
    const cycles = jobs
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
    const usedLineDays = jobs
      .filter((j) => j.completed && j.finishesAt > from && unitIds.has(j.establishmentId))
      .reduce((n, j) => {
        const recipe = group.find((x) => x.id === j.recipeId);
        return n + (recipe ? j.cycles / cyclesPerDay(recipe) : 0);
      }, 0);
    const projectProfitPerLine = design.recipes.find((x) => x.id === r.id)?.profit ?? 0;
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
      profitPerLine: null,
      projectProfitPerLine,
      profitRatio: null,
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
  return deriveRecipeKpis({
    seed,
    seasonHash,
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
  });
}

// Lucro por linha e quociente sobre o projeto, a partir dos dados brutos da semente. Aplicado também
// aos arquivos de --from, para que uma correção da definição não exija rodar a simulação de novo.
function deriveRecipeKpis(r: SeedResult): SeedResult {
  for (const [id, k] of Object.entries(r.recipes)) {
    const margin = r.margins[id];
    k.profitPerLine =
      margin !== undefined && k.installedLines > 0 ? margin / k.installedLines : null;
    k.profitRatio =
      k.profitPerLine !== null && k.projectProfitPerLine
        ? k.profitPerLine / k.projectProfitPerLine
        : null;
  }
  return r;
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

const results: SeedResult[] = from.flatMap((f) => f.results.map(deriveRecipeKpis));
// Código medido: commit do repositório (com "+alterações" se a árvore não estiver limpa).
const commit =
  from[0]?.commit ??
  (() => {
    try {
      const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      const dirty = execSync('git status --porcelain -- packages scripts', {
        encoding: 'utf8',
      }).trim();
      return dirty ? `${head}+alterações` : head;
    } catch {
      return 'desconhecido';
    }
  })();
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
writeFileSync(
  out,
  JSON.stringify(
    {
      days,
      window,
      scale,
      // Só aparece fora do padrão: o JSON a 120× fica comparável com o de antes da spec 004.
      ...(timeScale === standardTimeScale ? {} : { timeScale }),
      seeds,
      commit,
      results,
      summary,
    },
    null,
    2,
  ),
);
console.log(`Relatório completo em ${out}`);
if (process.argv.includes('--write-doc')) writeDoc();

// Documento único da prova (spec 003, R7): uma seção por escala, regenerada sem tocar nas outras.
function writeDoc() {
  const target = arg('doc', 'docs/product/PROVA.md');
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  // Arredonda antes de formatar para não escrever "-0".
  const fmt = (n: number, d = 1) =>
    Number.isFinite(n)
      ? (Math.round(n * 10 ** d) / 10 ** d || 0).toLocaleString('pt-BR', {
          maximumFractionDigits: d,
        })
      : 'sem venda';
  const brl = (cents: number) => fmt(cents / 100, 0);
  const show = (x: Stat, f: (n: number) => string) => (x.median === null ? '—' : range(x, f));
  const name = (id: string) => designItems[id as DesignItemId]?.name ?? id;
  const by = (f: (r: SeedResult) => number | null | undefined) => stat(results.map(f));
  // Situação de um KPI com alvo: a mediana e o pior caso (o extremo do lado do alvo).
  const judge = (x: Stat, t: { min?: number; max?: number }) => {
    const ok = (v: number | null) =>
      v !== null && (t.min === undefined || v >= t.min) && (t.max === undefined || v <= t.max);
    if (x.median === null) return '— | —';
    const worst = [t.min !== undefined ? x.min : null, t.max !== undefined ? x.max : null].filter(
      (v) => v !== null,
    );
    return `${ok(x.median) ? 'dentro' : 'fora'} | ${worst.every(ok) ? 'dentro' : 'fora'}`;
  };
  const inRange = (v: number | null | undefined, t: { min: number; max: number }) =>
    typeof v === 'number' && v >= t.min && v <= t.max;
  // Produtos vendidos em alguma semente: os demais (sementes, vacas) só circulam dentro da empresa.
  const traded = [...new Set(results.flatMap((r) => Object.keys(r.idleStockDays)))]
    .filter((id) => results.some((r) => Number.isFinite(days_(r.idleStockDays[id]))))
    .sort();
  const hhiTarget = scale >= targets.concentration.fromScale;
  const steelTarget = targets.governmentSteel.minShare * targets.governmentSteel.perDay * scale;
  const recipeIds = Object.keys(summary.recipes);
  const outside = (f: (k: RecipeKpi) => number | null, t: { min: number; max: number }) =>
    by(
      (r) =>
        recipeIds.filter((id) => {
          const v = r.recipes[id] ? f(r.recipes[id]) : null;
          return v !== null && !inRange(v, t);
        }).length,
    );
  const world: [string, string, Stat, (n: number) => string, string][] = [
    [
      'Dinheiro conservado (diferença em centavos)',
      '0',
      summary.moneyDrift,
      String,
      judge(summary.moneyDrift, { max: 0 }),
    ],
    [
      'Empresas-bot quebradas ou suspensas',
      '0',
      summary.broke,
      String,
      judge(summary.broke, { max: 0 }),
    ],
    [
      'Procura atendida pelas lojas',
      `≥ ${pct(targets.coverageAll.min)}`,
      summary.coverageAll,
      pct,
      judge(summary.coverageAll, { min: targets.coverageAll.min }),
    ],
    [
      'Aço entregue ao governo (t/dia)',
      `≥ ${fmt(steelTarget, 1)} (80% de ${fmt(targets.governmentSteel.perDay * scale, 0)})`,
      summary.governmentSteelPerDay,
      (n) => fmt(n, 1),
      judge(summary.governmentSteelPerDay, { min: steelTarget }),
    ],
    [
      'Produtos vendidos com estoque fora de 1–7 dias',
      '0',
      by(
        (r) =>
          traded.filter((id) => !inRange(days_(r.idleStockDays[id]), targets.idleStockDays)).length,
      ),
      String,
      judge(
        by(
          (r) =>
            traded.filter((id) => !inRange(days_(r.idleStockDays[id]), targets.idleStockDays))
              .length,
        ),
        { max: 0 },
      ),
    ],
    [
      'Produtos com HHI ≥ 2.500 no atacado',
      hhiTarget ? '0' : 'sem alvo nesta escala',
      by(
        (r) => Object.values(r.concentration).filter((v) => v >= targets.concentration.max).length,
      ),
      String,
      hhiTarget
        ? judge(
            by(
              (r) =>
                Object.values(r.concentration).filter((v) => v >= targets.concentration.max).length,
            ),
            { max: 0 },
          )
        : '— | —',
    ],
    [
      'Receitas com utilização fora de 70–95%',
      '0',
      outside((k) => k.utilization, targets.utilization),
      String,
      judge(
        outside((k) => k.utilization, targets.utilization),
        { max: 0 },
      ),
    ],
    [
      'Receitas com lucro/linha ÷ projeto fora de 0,8–1,2',
      '0',
      outside((k) => k.profitRatio, targets.profitRatio),
      String,
      judge(
        outside((k) => k.profitRatio, targets.profitRatio),
        { max: 0 },
      ),
    ],
    [
      'Caminhões pesados comprados por dia',
      `referência ${fmt(designWorld.fleet.heavyPerDay * scale, 1)}, sem alvo`,
      summary.trucksBoughtPerDay.heavy,
      (n) => fmt(n, 2),
      '— | —',
    ],
    [
      'Caminhões leves comprados por dia',
      `referência ${fmt(designWorld.fleet.lightPerDay * scale, 1)}, sem alvo`,
      summary.trucksBoughtPerDay.light,
      (n) => fmt(n, 2),
      '— | —',
    ],
    [
      'Caminhões importados por dia',
      'sem alvo',
      summary.trucksBoughtPerDay.imported,
      (n) => fmt(n, 2),
      '— | —',
    ],
    [
      'Caminhões aposentados por dia',
      'sem alvo',
      summary.trucksRetiredPerDay,
      (n) => fmt(n, 2),
      '— | —',
    ],
  ];
  const recipeRows = designRecipes
    .filter((r) => !r.alternativeOf)
    .map((r) => {
      const k = summary.recipes[r.id];
      const alt = designRecipes.filter((x) => x.alternativeOf === r.id).map((x) => x.name);
      return `| ${r.name}${alt.length ? ` (com ${alt.join(', ').toLowerCase()})` : ''} | ${show(k.installedLines, (n) => fmt(n, 0))} | ${fmt((flows.lines[r.id] ?? 0) * scale, 1)} | ${show(summary.lines[r.id], (n) => fmt(n, 1))} | ${show(k.utilization, pct)} | ${show(summary.margins[r.id] ?? by(() => null), brl)} | ${show(k.profitPerLine, brl)} | ${brl(k.projectProfitPerLine.median ?? 0)} | ${show(k.profitRatio, (n) => fmt(n, 2))} | ${show(k.realizedPrice, (n) => fmt(n, 2))} |`;
    });
  for (const [key, label] of [
    ['retail', 'Lojas'],
    ['warehouse', 'Distribuidores'],
    ['logistics', 'Transportadoras'],
  ])
    if (summary.margins[key])
      recipeRows.push(
        `| ${label} | — | — | — | — | ${show(summary.margins[key], brl)} | — | — | — | — |`,
      );
  const hashes = [...new Set(results.map((r) => r.seasonHash))].join(', ');
  const section = `<!-- escala:${scale} início -->
## Escala ${scale}

\`npm run economy:proof -- --days=${days} --window=${window} --seeds=${seeds.join(',')} --scale=${scale}${timeScale === standardTimeScale ? '' : ` --timeScale=${timeScale}`} --write-doc\`${from.length > 1 ? ' (uma semente por processo, juntadas com \`--from\`)' : ''}. Código \`${commit}\`; temporada \`${hashes}\`. ${results.length} sementes, janela dos últimos ${window} dias de ${days}. Simulação: ${show(summary.msPerDay, (n) => fmt(n / 1000, 1))} s por dia de jogo por semente.

### KPIs de mundo

| KPI | Alvo | Mediana [mín–máx] | Mediana | Pior caso |
| --- | --- | ---: | --- | --- |
${world.map(([label, goal, x, f, status]) => `| ${label} | ${goal} | ${show(x, f)} | ${status} |`).join('\n')}

Quebras por semente: ${results.map((r) => `${r.seed}: ${r.broke.length ? r.broke.join(', ') : 'nenhuma'}`).join('; ')}.

### Por negócio

Linhas instaladas: equipamento das unidades da especialidade. Linhas de referência: calculadora × escala. Linhas observadas: produção ÷ uma linha a plena capacidade. Utilização: linhas-dia usadas ÷ instaladas (alvo 70–95%). Resultado dos bots: R$/dia da especialidade (fórmula no topo). Lucro/linha: resultado ÷ linhas instaladas, comparado ao lucro de projeto da calculadora (alvo 0,8–1,2). Preço realizado: vendas no atacado dos produtores ÷ preço de referência.

| Negócio | Linhas instaladas | Linhas na referência | Linhas observadas | Utilização | Resultado dos bots/dia (R$) | Lucro/linha/dia (R$) | Projeto/linha/dia (R$) | Observado ÷ projeto | Preço realizado ÷ referência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${recipeRows.join('\n')}

### Procura atendida por produto

| Produto | Atendida |
| --- | ---: |
${Object.entries(summary.coverage)
  .map(([id, x]) => `| ${name(id)} | ${show(x, pct)} |`)
  .join('\n')}

### Estoque e concentração

Dias de estoque: quanto o estoque do mundo dura no ritmo de vendas da janela (alvo 1–7). HHI: concentração das vendas no atacado por vendedor (2.500 ou mais é concentrado; 10.000 é um vendedor só${hhiTarget ? '' : '; sem alvo nesta escala'}).

| Produto | Dias de estoque | HHI |
| --- | ---: | ---: |
${traded
  .map(
    (id) =>
      `| ${name(id)} | ${show(summary.idleStockDays[id], (n) => fmt(n, 1))} | ${summary.concentration[id] ? show(summary.concentration[id], (n) => fmt(n, 0)) : '—'} |`,
  )
  .join('\n')}
<!-- escala:${scale} fim -->`;
  let previous = '';
  try {
    previous = readFileSync(target, 'utf8');
  } catch {
    previous = '';
  }
  const sections = new Map<number, string>();
  for (const m of previous.matchAll(/<!-- escala:(\d+) início -->[\s\S]*?<!-- escala:\1 fim -->/g))
    sections.set(Number(m[1]), m[0]);
  sections.set(scale, section);
  const doc = `# Prova da economia

Régua oficial de balanceamento (constituição §5, spec 003), gerada por \`npm run economy:proof -- --write-doc\`. Cada escala tem sua seção; rodar a prova numa escala regenera só a seção dela. O detalhe por semente fica no JSON de \`test-results/\`.

## Como ler

- **Mundo medido:** mundo jogável (\`playtest\`) criado do zero, só bots, sem jogadores humanos. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias.
- **Números:** mediana [mínimo–máximo] entre sementes, nunca média. A janela são os últimos dias da rodada, depois da partida.
- **Resultado dos bots:** caixa operacional da janela (sem imóvel e equipamento, crédito, verba do cenário, educação, caminhões da frota e venda de ativos) mais a variação do estoque a custo médio, dos lotes em curso a custo e das cargas compradas em trânsito. Nenhum preço de referência entra no resultado.
- **Projeto:** lucro por linha instalada da calculadora (\`npm run economy:design\`) com 70% de utilização e 95% do preço de referência. As receitas que não fecham na própria calculadora estão em \`knownBalanceDebt\` (\`tests/economy-design.test.ts\`).
- **Situação:** "Mediana" diz se a mediana atende o alvo; "Pior caso" avalia o extremo do lado do alvo (o mínimo para alvo mínimo, o máximo para alvo máximo). Regra de aceitação de uma mudança de balanceamento: a mediana melhora e o pior caso não piora em todos os KPIs com alvo.
- **Referência sem alvo:** compras de caminhão comparadas à frota da calculadora; não decidem aceitação.

${[...sections.entries()]
  .sort(([a], [b]) => a - b)
  .map(([, text]) => text)
  .join('\n\n')}
`;
  writeFileSync(target, doc);
  console.log(`Documento em ${target}`);
}
