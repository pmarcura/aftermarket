import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute } from '../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL, type ProductId, type World } from '../packages/simulation/src/model';
import { GAME_DAY, productionCapacity } from '../packages/simulation/src/operations';
import {
  householdDemand,
  marketView,
  operatingCosts,
  productionCharges,
} from '../packages/simulation/src/metrics';
import { dailyNeed } from '../packages/simulation/src/supply';
import { botRecoveryPlan } from '../packages/simulation/src/director';
import { householdProducts } from '../packages/simulation/src/channels';
import type { LabReport } from '../packages/simulation/src/lab';
import { labSourceFingerprint } from './lib/lab-fingerprint';

const args = process.argv.slice(2);
if (args.some((a) => a !== '--write-doc'))
  throw new Error('Use somente --write-doc, opcional. Nunca lê SQLite.');
const NOW = Date.UTC(2026, 9, 30, 12);
const fingerprint = labSourceFingerprint();
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const locate = (file: string, text: string) => {
  const line =
    readFileSync(resolve(file), 'utf8')
      .split(/\r?\n/)
      .findIndex((s) => s.includes(text)) + 1;
  if (!line) throw new Error(`Referência não encontrada: ${file} / ${text}`);
  return { file, line, symbol: text };
};
interface Finding {
  id: string;
  priority: 'P1' | 'P2';
  kind: 'bug' | 'calibration' | 'policy' | 'feedback';
  title: string;
  confirmed: boolean;
  invariant: string;
  explanation: string;
  impact: string;
  remedy: string;
  evidence: unknown;
  sources: ReturnType<typeof locate>[];
}
const findings: Finding[] = [];
const checks: { name: string; moneyConserved: boolean }[] = [];
function quiet() {
  const w = createWorld(NOW);
  w.nextEconomicAt = Infinity;
  for (const c of w.companies) c.bot = false;
  for (const e of w.establishments) {
    e.enabled = false;
    e.automation = false;
    e.mothballed = true;
    e.employees = 0;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  return w;
}
function checkMoney(name: string, w: World, before: number) {
  const conserved =
    money(w) === before &&
    w.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0);
  checks.push({ name, moneyConserved: conserved });
  if (!conserved) throw new Error(`Conservação monetária falhou: ${name}`);
}
function standardPlant(w: World, recipeId: string) {
  const r = w.season.config.recipes.find((r) => r.id === recipeId)!;
  const profile = w.season.config.operations.profiles[r.id];
  const property = {
    ...w.properties[0],
    id: 'math-site',
    category: r.category,
    state: 'SP',
    area: profile.areaM2,
  };
  const plant = {
    ...w.establishments[0],
    category: r.category,
    propertyId: property.id,
    employees: profile.workers,
    installed: true,
    equipmentLines: 1,
    enabled: true,
    mothballed: false,
  };
  return {
    r,
    plant,
    world: { ...w, properties: [property], establishments: [plant], stateWages: {} },
  };
}

// Limite superior: entradas físicas, manutenção, estrutura e CAPEX gratuitos;
// cobra apenas processamento e folha mínima. Ignorar também as utilidades
// torna o limite independente do arredondamento das cobranças por lote.
const opening = createWorld(NOW);
const farmBounds = ['rice-harvest', 'beans-harvest', 'sugar-harvest', 'milk-production'].map(
  (id) => {
    const { r, plant, world } = standardPlant(opening, id);
    const gross = Object.entries(r.output).reduce(
      (n, [id, q]) => n + q! * world.season.config.basePrices[id as ProductId],
      0,
    );
    const cyclesPerDay = GAME_DAY / r.duration;
    const processingUtilities = productionCharges(world, plant, id, 1).total;
    const payroll = operatingCosts(world, plant).payroll;
    return {
      id,
      workers: plant.employees,
      cyclesPerDay,
      gross,
      processingUtilities,
      payroll,
      bestPossibleDailyMarginBeforePayroll: (gross - r.cost) * cyclesPerDay,
      upperProfitPerDay: (gross - r.cost) * cyclesPerDay - payroll,
    };
  },
);
findings.push({
  id: 'M01',
  priority: 'P1',
  kind: 'calibration',
  title:
    'Quatro fazendas não cobrem nem a folha mínima aos preços de abertura, em qualquer número de linhas',
  confirmed: farmBounds.every((r) => r.upperProfitPerDay < 0),
  invariant:
    'Resultado(n linhas) ≤ n × [(receita bruta − processamento) × ciclos/dia − folha mínima por linha]. Se o termo é negativo, aumentar n não resolve.',
  explanation: `Em SP, seis empregados custam ${brl(farmBounds[0].payroll)}/dia de folha. Mesmo com entradas físicas, todas as utilidades, manutenção, imóvel e equipamento gratuitos, a contribuição máxima de arroz é ${brl(farmBounds[0].bestPossibleDailyMarginBeforePayroll)}/dia e a de leite ${brl(farmBounds[3].bestPossibleDailyMarginBeforePayroll)}/dia. As quatro margens superiores ficam negativas.`,
  impact:
    'Oferta inicial mascara operações incapazes de se sustentar nesses preços. Mais linhas ampliam a perda sob as mesmas premissas. Não é prova de prejuízo se o preço realizado, salário, duração ou receita mudar.',
  remedy:
    'Reconciliar preço de saída, rendimento, tempo e equipe por linha antes de ajustar demanda ou financiar os produtores. Comparar custo completo por unidade vendável, com e sem retenção de semente.',
  evidence: farmBounds,
  sources: [
    locate('packages/simulation/src/operations.ts', "'rice-harvest': { workers"),
    locate('packages/simulation/src/metrics.ts', 'export function operatingCosts'),
    locate('packages/simulation/src/operations.ts', "id: 'milk-production'"),
  ],
});

// Mesma hipótese de preço/insumo usada pelo planejador; muda somente o limite temporal.
const recoveryWorld = createWorld(NOW);
const dairy = recoveryWorld.establishments.find((e) => e.specialization === 'milk-production')!;
dairy.enabled = false;
dairy.mothballed = true;
dairy.employees = 0;
const plan = botRecoveryPlan(recoveryWorld, dairy, NOW);
const dairyRecipe = recoveryWorld.season.config.recipes.find((r) => r.id === dairy.specialization)!;
const recovered = {
  ...dairy,
  employees: recoveryWorld.season.config.operations.profiles[dairyRecipe.id].workers,
  enabled: true,
  mothballed: false,
};
const dairyCapacity = productionCapacity(recoveryWorld, recovered, dairyRecipe);
const dairyPrice =
  marketView(recoveryWorld, 'milk').price ?? recoveryWorld.season.config.basePrices.milk;
const dairyCycleCost =
  productionCharges(recoveryWorld, recovered, dairyRecipe.id, 1).total +
  dairyRecipe.input.soymeal! * dairy.unitCosts.soymeal!;
const dairyCycles =
  GAME_DAY / (Math.ceil(dairyCapacity.durationMs / ECONOMIC_INTERVAL) * ECONOMIC_INTERVAL);
const dairyTrueProfit =
  (dairyPrice * dairyRecipe.output.milk! - dairyCycleCost) * dairyCycles -
  operatingCosts(recoveryWorld, recovered).total;
findings.push({
  id: 'M02',
  priority: 'P1',
  kind: 'bug',
  title: 'O bot aprova recuperação de leite usando produtividade diária fisicamente impossível',
  confirmed: Boolean(plan && plan.contribution > 0 && dairyTrueProfit < 0),
  invariant:
    'Quantidade diária projetada ≤ saída por ciclo × ciclos fisicamente concluíveis por dia.',
  explanation: `O plano retorna resultado de ${brl(plan?.contribution ?? 0)}/dia, mas a mesma unidade e o mesmo preço dão ${brl(dairyTrueProfit)}/dia respeitando a duração. Uma linha faz ${num(dairyRecipe.output.milk! * dairyCycles)} unidades/dia; o teto usado no planejador permite ${num(dairyRecipe.output.milk! * 12)} antes do corte por demanda.`,
  impact:
    'Pode gastar caixa/crédito para reabrir uma operação inviável, aumentando atrasados. A projeção não apenas omite risco: ultrapassa o limite de tempo da receita.',
  remedy:
    'Usar a capacidade de lote/tick/linhas compartilhada com a execução e avaliar caixa de ciclo, estoque inicial e todos os coprodutos separadamente.',
  evidence: {
    plan,
    dairyPrice,
    dairyCycleCost,
    lines: dairyCapacity.lines,
    trueCyclesPerDay: dairyCycles,
    trueProfitPerDay: dairyTrueProfit,
  },
  sources: [
    locate('packages/simulation/src/director.ts', 'const dailyQuantity = Math.min'),
    locate(
      'packages/simulation/src/director.ts',
      'const contribution = (price - perCycle / quantity)',
    ),
  ],
});

// Usa comandos normais; caixa, estoque e espaço não são gargalos nesta fixture.
const throughputWorld = quiet();
const steel = throughputWorld.establishments.find((e) => e.id === 'e-industry')!;
steel.enabled = true;
steel.mothballed = false;
steel.installed = true;
steel.equipmentLines = 2;
steel.employees = 36;
steel.inventory = { iron: 5000, coal: 1500 };
steel.capacityT = 1000000;
steel.capacityM3 = 1000000;
throughputWorld.properties.find((p) => p.id === steel.propertyId)!.area = 12000;
execute(
  throughputWorld,
  steel.companyId,
  {
    type: 'configureProduction',
    establishmentId: steel.id,
    recipeId: 'steel-bars',
    cycles: 5,
    dailyBudget: 1000000000,
    enabled: true,
  },
  NOW,
);
const estimatedCycles = dailyNeed(throughputWorld, steel, 'iron') / 12;
const marketCycles = marketView(throughputWorld, 'iron').industrialDemand / 12;
const throughputMoney = money(throughputWorld);
throughputWorld.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
advance(throughputWorld, NOW + 3 * GAME_DAY);
const actualStartedCycles = throughputWorld.jobs
  .filter(
    (j) =>
      j.establishmentId === steel.id &&
      j.startedAt >= NOW + GAME_DAY &&
      j.startedAt < NOW + 2 * GAME_DAY,
  )
  .reduce((n, j) => n + j.cycles, 0);
checkMoney('capacidade em três dias', throughputWorld, throughputMoney);
findings.push({
  id: 'M03',
  priority: 'P1',
  kind: 'bug',
  title: 'A projeção anuncia 48 ciclos/dia onde a automação executa 30',
  confirmed: estimatedCycles === 48 && marketCycles === 48 && actualStartedCycles === 30,
  invariant:
    'Cadência da automação em regime, sem outros bloqueios ou fila manual: C(c,l) = c × dia / [intervalo × teto(duração_por_ciclo × teto(c/l) / intervalo)]. Exige insumos, caixa, espaço e orçamento suficientes; não equivale a vendas previstas.',
  explanation: `Aço, duas linhas e lotes de cinco: o lote leva teto(5/2) = 3 horas e só reinicia na próxima rodada de duas horas. A cadência é quatro horas; 6 lotes/dia ×5 =30. dailyNeed e demanda industrial mostram ${num(estimatedCycles)} e ${num(marketCycles)}. Execução medida em regime entre os dias 1 e 2: ${actualStartedCycles} ciclos iniciados.`,
  impact:
    'Superestima necessidade, cobertura de custos e compra de insumos em 60% neste caso. Em outros lotes, o erro pode ter outro sentido/magnitude.',
  remedy:
    'Compartilhar o cálculo exato de cadência, incluindo os dois tetos e fila. Identificar previsão de início versus conclusão e horizonte de aquecimento.',
  evidence: {
    lines: 2,
    batchCycles: 5,
    predictedSupplyCyclesPerDay: estimatedCycles,
    predictedMarketCyclesPerDay: marketCycles,
    actualStartedCycles,
    jobs: throughputWorld.jobs
      .filter((j) => j.establishmentId === steel.id)
      .map((j) => ({
        cycles: j.cycles,
        startHour: ((j.startedAt - NOW) / GAME_DAY) * 24,
        endHour: ((j.finishesAt - NOW) / GAME_DAY) * 24,
      })),
  },
  sources: [
    locate('packages/simulation/src/supply.ts', 'Math.min(12 * (e.automationCycles'),
    locate('packages/simulation/src/metrics.ts', 'Math.min(24, 86400000'),
    locate('packages/simulation/src/operations.ts', 'durationMs: lines ? r.duration * Math.ceil'),
  ],
});

function retailCase(count: number, city: string, allProducts = false, employees = 12) {
  const w = quiet(),
    original = money(w);
  w.season.config.operations.weekday = [1, 1, 1, 1, 1, 1, 1];
  const stores = w.establishments.filter((e) => e.category === 'retail').slice(0, count);
  const productIds = allProducts ? householdProducts : (['rice'] as ProductId[]);
  for (const shop of stores) {
    const p = w.properties.find((p) => p.id === shop.propertyId)!;
    p.city = city;
    shop.enabled = true;
    shop.mothballed = false;
    shop.installed = true;
    shop.employees = employees;
    shop.inventory = Object.fromEntries(productIds.map((id) => [id, 10000]));
    shop.prices = Object.fromEntries(productIds.map((id) => [id, w.season.config.basePrices[id]]));
    shop.quality = Object.fromEntries(productIds.map((id) => [id, 70]));
  }
  w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
  advance(w, w.nextEconomicAt);
  checkMoney(`varejo ${city}/${count}/${allProducts}`, w, original);
  return {
    w,
    sales: w.consumptionHistory
      .filter((h) => stores.some((e) => e.id === h.establishmentId))
      .map((h) => ({ product: h.product, desired: h.desired, sold: h.sold })),
  };
}
const single = retailCase(1, 'Itabira'),
  double = retailCase(2, 'Itabira');
const singleSales = single.sales.reduce((n, s) => n + s.sold, 0),
  doubleSales = double.sales.reduce((n, s) => n + s.sold, 0);
const modeledRiceDemand = householdDemand(single.w, '3131703', 'rice');
const tickRiceDemand = modeledRiceDemand / 12;
// Preço igual ao base e qualidade 70 na fixture: score = 1 × (0,5 + 0,7).
const retailScore = 0.5 + 70 / 100;
const elasticTickRiceDemand = tickRiceDemand * Math.min(1.2, retailScore);
findings.push({
  id: 'M04',
  priority: 'P1',
  kind: 'bug',
  title: 'Adicionar uma loja idêntica elimina vendas: frações da demanda desaparecem',
  confirmed: singleSales === 1 && doubleSales === 0,
  invariant:
    'Duplicar oferta idêntica, mantendo preço, qualidade, orçamento e capacidade folgada, não deve zerar demanda agregada positiva por arredondamento.',
  explanation: `Itabira tem ${num(modeledRiceDemand)} pacotes/dia de potencial. Com calendário unitário, a rodada tem ${num(tickRiceDemand)}; o multiplicador de score dá ${num(elasticTickRiceDemand)}. Uma loja vende ${singleSales}; duas recebem ${num(elasticTickRiceDemand / 2)} cada e ambas vendem ${doubleSales}. O piso é aplicado por loja e por tick sem carregar fração.`,
  impact:
    'Concorrência destrói demanda, sobretudo em itens de baixo giro. O histórico registra desejado=0, escondendo essa perda do indicador vendido/desejado.',
  remedy:
    'Acumular frações por mercado e distribuir unidades inteiras de forma conservativa, com rotação de restos e desempate reproduzível.',
  evidence: {
    single: single.sales,
    double: double.sales,
    modeledDailyDemand: modeledRiceDemand,
    tickRiceDemand,
    retailScore,
    elasticTickRiceDemand,
  },
  sources: [
    locate('packages/simulation/src/engine.ts', 'Math.floor(((demand * score(e))'),
    locate(
      'packages/simulation/src/design.ts',
      'retailFulfillment: desired ? sold / desired : null',
    ),
  ],
});

const priority = retailCase(1, 'Campinas', true, 1);
const oilSale = priority.sales.find((s) => s.product === 'oil')!,
  milkSale = priority.sales.find((s) => s.product === 'milk')!;
findings.push({
  id: 'M05',
  priority: 'P2',
  kind: 'policy',
  title: 'A ordem fixa dos produtos pode deixar leite sem venda apesar de demanda e estoque',
  confirmed: oilSale.sold === 20 && milkSale.sold === 0 && milkSale.desired > oilSale.desired,
  invariant:
    'A política de distribuição da capacidade compartilhada precisa ser explícita; a posição no array não deve ser confundida com demanda ou rentabilidade.',
  explanation: `Uma loja de Campinas com um empregado atende 20 unidades/rodada. Óleo aparece primeiro e usa as 20; leite deseja ${milkSale.desired} e recebe zero. Não faltam estoque nem dinheiro.`,
  impact:
    'Há prioridade econômica implícita que pode inviabilizar leite/itens posteriores. A redução de produção pode parecer falta de compradores quando é alocação da loja.',
  remedy:
    'Escolher e expor prioridade, rateio por demanda/margem ou rotação. Medir o efeito antes de alterar coeficientes de consumo.',
  evidence: priority.sales,
  sources: [
    locate('packages/simulation/src/engine.ts', 'const remainingService = new Map'),
    locate('packages/simulation/src/engine.ts', 'for (const product of householdProducts)'),
  ],
});

// Controle positivo: custo dos coprodutos, dinheiro e conclusão única.
const costWorld = quiet();
const oilPlant = costWorld.establishments.find((e) => e.specialization === 'soy-oil')!;
const oilRecipe = costWorld.season.config.recipes.find((r) => r.id === 'soy-oil')!;
oilPlant.enabled = true;
oilPlant.mothballed = false;
oilPlant.installed = true;
oilPlant.employees = 8;
oilPlant.equipmentLines = 1;
oilPlant.inventory = { soy: 1 };
oilPlant.capacityT = oilPlant.capacityM3 = 1000000;
const oilProperty = costWorld.properties.find((p) => p.id === oilPlant.propertyId)!;
oilProperty.area = 1800;
oilProperty.water = oilProperty.energyConnected = true;
const costMoney = money(costWorld);
execute(
  costWorld,
  oilPlant.companyId,
  { type: 'produce', establishmentId: oilPlant.id, recipeId: oilRecipe.id, cycles: 1 },
  NOW,
);
const oilJob = costWorld.jobs.at(-1)!;
const allocatedCost = Object.values(oilJob.outputCosts!).reduce((n, value) => n + value!, 0);
if (allocatedCost !== oilJob.cost) throw Error('Custo dos coprodutos não conserva o lote.');
advance(costWorld, oilJob.finishesAt);
const inventoryAfterCompletion = JSON.stringify(oilPlant.inventory);
advance(costWorld, oilJob.finishesAt);
if (inventoryAfterCompletion !== JSON.stringify(oilPlant.inventory))
  throw Error('Produção duplicada ao repetir advance.');
checkMoney('coprodutos e conclusão única', costWorld, costMoney);
const beforeRejection = JSON.stringify(costWorld);
let rejected = false;
try {
  execute(
    costWorld,
    oilPlant.companyId,
    { type: 'produce', establishmentId: oilPlant.id, recipeId: oilRecipe.id, cycles: 1 },
    oilJob.finishesAt,
  );
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('Insumo insuficiente')) throw error;
  rejected = true;
}
if (!rejected || JSON.stringify(costWorld) !== beforeRejection)
  throw Error('Falha de insumo deveria rejeitar sem mutação.');

// Os relatórios de /lab já existem: leitura sem executar outra season nem
// substituir a referência A/B. Evidência desatualizada não vira evidência atual.
const latestPath = resolve('.runtime/lab/simulations/latest.json');
type Batch = {
  generatedAt: string;
  sourceFingerprint: string;
  runs: { label: string; options: LabReport['options']; report: string }[];
};
const batch: Batch | undefined = existsSync(latestPath)
  ? JSON.parse(readFileSync(latestPath, 'utf8'))
  : undefined;
const baselineRun = batch?.runs.find(
  (run) =>
    run.label === 'A' &&
    run.options.scenario === 'baseline' &&
    run.options.seed === 0 &&
    run.options.days === 90,
);
const baseline: LabReport | undefined =
  baselineRun && existsSync(baselineRun.report)
    ? JSON.parse(readFileSync(baselineRun.report, 'utf8'))
    : undefined;
const currentBaseline =
  baseline?.schemaVersion === 2 &&
  batch?.sourceFingerprint === fingerprint &&
  baseline.metadata.sourceFingerprint === fingerprint;
const final = baseline?.observations.at(-1);
const chain = (['oil', 'soymeal', 'milk'] as const)
  .map((id) => {
    const start = baseline?.observations[0].items.find((item) => item.id === id);
    const end = final?.items.find((item) => item.id === id);
    return start && end ? { initial: start.physical + start.inTransit, ...end } : undefined;
  })
  .filter((item) => item !== undefined);
const meal = chain.find((item) => item.id === 'soymeal');
const milkRecipe = opening.season.config.recipes.find((r) => r.id === 'milk-production')!;
const coproductRatio = oilRecipe.output.soymeal! / oilRecipe.output.oil!;
const mealPerMilk = milkRecipe.input.soymeal! / milkRecipe.output.milk!;
const neededMilkPerOil = coproductRatio / mealPerMilk;
const familyMilkPerOil =
  opening.season.config.consumption.milk! / opening.season.config.consumption.oil!;
const theoreticalExcess = 1 - familyMilkPerOil / neededMilkPerOil;
findings.push({
  id: 'M06',
  priority: 'P1',
  kind: 'calibration',
  title: 'Óleo/farelo/leite não fecham proporções de absorção na hipótese apenas familiar',
  confirmed: theoreticalExcess > 0,
  invariant:
    'Com óleo e leite atendidos só por estas receitas e sem outros destinos, farelo produzido por óleo deve ser igual ao farelo necessário ao leite demandado por óleo.',
  explanation: `Cada óleo produz ${num(coproductRatio)} kg de farelo; consumir esse farelo exige ${num(neededMilkPerOil)} L de leite por óleo. O consumo familiar relativo é ${num(familyMilkPerOil)}. Sob essa hipótese, ${num(theoreticalExcess * 100)}% do farelo fica sem destino. ${currentBaseline && meal ? `Na execução de 90 dias, o consumo produtivo acumulado foi ${num(meal.productionInputs)} kg, equivalente a ${num((meal.productionInputs / meal.produced) * 100)}% da produção acumulada de ${num(meal.produced)} kg; o estoque final é ${num(meal.physical)} kg. Não há rastreamento que atribua esse consumo ao estoque inaugural ou à produção nova.` : 'A execução de 90 dias está ausente ou desatualizada; os números históricos ficam separados da prova algébrica.'}`,
  impact:
    'Reduzir velocidade isoladamente não corrige a proporção. Estoque inicial, produção interrompida e distribuição afetam o excesso observado; a razão teórica não explica sozinha a trajetória.',
  remedy:
    'Calibrar conjuntamente proporção de coprodutos, destinos executados, consumo e menor operação viável. Medir entradas/saídas efetivas e margem após fixos/frete; evitar financiar acúmulo.',
  evidence: {
    coproductRatio,
    mealPerMilk,
    neededMilkPerOil,
    familyMilkPerOil,
    theoreticalExcess,
    currentBaseline,
    chain,
  },
  sources: [
    locate('packages/simulation/src/model.ts', "id: 'soy-oil'"),
    locate('packages/simulation/src/operations.ts', "id: 'milk-production'"),
    locate('packages/simulation/src/calibration.ts', 'consumption:'),
  ],
});

const oilDemand = marketView(opening, 'oil').householdDemand;
const oilProducers = opening.establishments.filter(
  (e) =>
    e.specialization === 'soy-oil' &&
    e.enabled &&
    e.automation &&
    opening.companies.find((c) => c.id === e.companyId)?.bot,
);
const targetPerProducer = Math.max(600, oilDemand * 3);
findings.push({
  id: 'M07',
  priority: 'P2',
  kind: 'policy',
  title: 'Cada produtor de óleo mira três dias da demanda global, sem repartir mercado',
  confirmed: oilProducers.length > 1 && targetPerProducer > 0,
  invariant:
    'Alvo agregado = número de produtores × max(600, 3 × demanda familiar global potencial), antes de considerar lotes em processamento.',
  explanation: `Na abertura, ${oilProducers.length} produtores bots automatizados habilitados recebem alvo individual de ${num(targetPerProducer)} unidades, ou ${num(oilProducers.length * targetPerProducer)} agregadas. A mesma demanda potencial diária de ${num(oilDemand)} é usada por todos.`,
  impact:
    'Adicionar concorrentes amplia o estoque-alvo agregado. Essa regra pode contribuir para excesso; esta auditoria não mede a causalidade isolada. Cobertura calculada com demanda potencial não é prazo de venda observada.',
  remedy:
    'Experimentar alvo por participação/vendas observadas e lead time, com limite para aquecimento sem histórico. Comparar contra a referência preservada, sem alterar consumo junto.',
  evidence: {
    oilDemand,
    targetPerProducer,
    producers: oilProducers.map((e) => e.id),
    aggregateTarget: targetPerProducer * oilProducers.length,
  },
  sources: [
    locate(
      'packages/simulation/src/engine.ts',
      "? Math.max(600, marketView(w, 'oil').householdDemand * 3)",
    ),
    locate('packages/simulation/src/metrics.ts', 'coverageDays: demand ? stock / demand : null'),
  ],
});

const fixedCosts = operatingCosts(
  opening,
  opening.establishments.find((e) => e.id === 'e-botfactory')!,
);
const chargedPerDay = [
  fixedCosts.payroll,
  fixedCosts.maintenance,
  fixedCosts.energy,
  fixedCosts.water,
].reduce((n, value) => n + 12 * Math.round(value / 12), 0);
const studyPath = resolve('.runtime/lab/studies/oil-meal-milk-and-carrier.json');
const study = existsSync(studyPath)
  ? (JSON.parse(readFileSync(studyPath, 'utf8')) as {
      sourceFingerprint: string;
      economics: {
        evaluations: unknown[];
        decision: string;
        intervention?: string[];
        a?: { options: LabReport['options']; items: LabReport['observations'][number]['items'] };
        b?: { options: LabReport['options']; items: LabReport['observations'][number]['items'] };
      };
    })
  : undefined;
const chainTimeline = (baseline?.observations ?? [])
  .filter((snapshot) => [30, 60, 90].includes(snapshot.day))
  .flatMap((snapshot) =>
    snapshot.items
      .filter((item) => ['oil', 'soymeal', 'milk'].includes(item.id))
      .map(({ id, produced, householdConsumption, productionInputs, physical }) => ({
        day: snapshot.day,
        id,
        produced,
        householdConsumption,
        productionInputs,
        physical,
      })),
  );
const studyMealA = study?.economics.a?.items.find((item) => item.id === 'soymeal');
const studyMealB = study?.economics.b?.items.find((item) => item.id === 'soymeal');
const labEvidence = {
  batch: existsSync(latestPath) ? latestPath : null,
  generatedAt: batch?.generatedAt ?? null,
  report: baselineRun?.report ?? null,
  current: currentBaseline,
  fingerprint: baseline?.metadata.sourceFingerprint ?? null,
  options: baseline?.options ?? null,
  chainTimeline,
  limits: baseline?.metadata.metricNotes ?? [],
  final: final
    ? {
        moneyConserved: final.moneyConserved,
        health: final.health,
        healthWindow: final.healthWindow,
        chain,
      }
    : null,
  study: study
    ? { path: studyPath, current: study.sourceFingerprint === fingerprint, ...study.economics }
    : null,
};
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  simulationAt: new Date(NOW).toISOString(),
  sourceFingerprint: fingerprint,
  auditFingerprint: createHash('sha256')
    .update(readFileSync(resolve('scripts/audit-mathematics.ts')))
    .digest('hex'),
  scope:
    'Aberturas isoladas e leitura dos artefatos de /lab. Sem SQLite, store, API ou tick do jogador. Não altera o motor nem a season salva; fixtures isoladas controlam calendário, equipe, estoque e instalações.',
  balanced: false,
  findings,
  checks,
  positiveControls: {
    allocatedCost,
    jobCost: oilJob.cost,
    outputs: oilJob.output,
    outputCosts: oilJob.outputCosts,
    completionIdempotent: true,
    insufficientInputRejectedWithoutMutation: true,
  },
  minorLimits: {
    dailyFixedCostRounding: {
      projected: fixedCosts.total,
      executed: chargedPerDay,
      difference: chargedPerDay - fixedCosts.total,
      source: locate('packages/simulation/src/engine.ts', 'Math.round(costs.payroll / 12)'),
    },
    mixedInputQuality:
      'A média atual pondera quantidade. Ferro/carvão usam ambos t; exigir peso explícito antes de misturar unidades distintas.',
  },
  labEvidence,
};
const sourceLink = (source: Finding['sources'][number]) =>
  `[${source.file}:${source.line}](../../${source.file}#L${source.line})`;
const kindLabel = {
  bug: 'Erro de fórmula',
  calibration: 'Calibração',
  policy: 'Política implícita',
  feedback: 'Informação',
};
const markdown = `# Auditoria matemática · capacidade, demanda e sustentabilidade

Gerado por \`npm run mathematics:audit -- --write-doc\`. Números simulados; dinheiro em centavos no JSON e reais neste documento. Cenários fixos de auditoria em ${new Date(NOW).toISOString()}; geração em ${report.generatedAt}. A fase 05 permanece parcial, sem aprovação de equilíbrio.

## Escopo e validade

${report.scope}

Fonte do motor: \`${fingerprint}\`. Auditor: \`${report.auditFingerprint}\`. As fontes abaixo apontam para a versão auditada; conferir os hashes ao repetir. Executar o auditor reproduz os casos e atualiza somente os anexos. \`--write-doc\` também regenera este documento. Uma prova que deixe de reproduzir retorna erro; isso exige revisar o achado e não significa que corrigir o bug deva ser revertido. Não integra o gate de equilíbrio do jogo.

Laboratório: ${currentBaseline ? 'baseline A:0 atual, 90 dias, sem humanos e com rotas estimadas.' : 'baseline de 90 dias ausente ou desatualizado; não usar seus números como evidência atual.'} A consulta reutiliza os artefatos de /lab; não substitui o A/B nem sua referência. Concentração/atrasados são observações, não diagnóstico causal de cada bot. Gates de candidatos não provam inação total. Séries são diárias e podem perder rupturas intradiárias; atendimento tem a janela de retenção registrada no JSON.

## Achados priorizados

| ID | Prioridade | Natureza | Achado | Prova reproduzida |
| --- | --- | --- | --- | --- |
${findings.map((f) => `| ${f.id} | ${f.priority} | ${kindLabel[f.kind]} | ${f.title} | ${f.confirmed ? 'Sim' : 'Não'} |`).join('\n')}

${findings
  .map(
    (f) => `## ${f.id} · ${f.title}

**Fórmula/invariante:** ${f.invariant}

${f.explanation}

**Efeito:** ${f.impact}

**Próxima ação:** ${f.remedy}

Fontes: ${f.sources.map(sourceLink).join(', ')}.
`,
  )
  .join('\n')}

## Limite agrícola por linha em SP

| Receita | Ciclos/dia, teto contínuo | Contribuição máxima antes da folha | Folha mínima/dia | Resultado máximo/dia |
| --- | ---: | ---: | ---: | ---: |
${farmBounds.map((row) => `| ${row.id} | ${num(row.cyclesPerDay)} | ${brl(row.bestPossibleDailyMarginBeforePayroll)} | ${brl(row.payroll)} | ${brl(row.upperProfitPerDay)} |`).join('\n')}

Este teto ignora insumos físicos, retenção de sementes, todas as utilidades, manutenção, frete, instalação e equipamento. Assume venda integral ao preço inaugural e ocupação contínua em média de longo prazo; não descreve cada dia de uma colheita em lotes. O custo real é maior; o teto é usado para demonstrar incompatibilidade, não como orçamento de operação. Preço realizado, salários, rendimento ou duração diferentes exigem novo cálculo.

## Fluxos observados no laboratório

| Item | Estoque inaugural | Produção concluída | Entrada em produção | Consumo familiar | Consumo público | Estoque físico final | Em trânsito final |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${chain.map((row) => `| ${row.id} | ${num(row.initial)} | ${num(row.produced)} | ${num(row.productionInputs)} | ${num(row.householdConsumption)} | ${num(row.publicConsumption)} | ${num(row.physical)} | ${num(row.inTransit)} |`).join('\n')}

Unidades: óleo/leite em embalagens de 1 L; farelo em kg. Identidade: estoque físico + trânsito = inaugural + produção concluída − entradas consumidas − consumo familiar − consumo público. Saídas comprometidas de jobs ainda não concluídos ficam separadas. Não contar comércio de atacado como consumo final.

${currentBaseline && final ? `No fim dos 90 dias: obrigações de ${brl(final.health.obligations)}, HHI agregado de ${final.health.hhi === null ? 'não disponível' : num(final.health.hhi)} e dinheiro conservado=${final.moneyConserved}. O HHI usa receita por vendedor na janela final de até sete dias; não equivale à concentração de estoque nem às vendas de toda a season.` : 'Conferir a validade da referência antes de interpretar os dados históricos.'}

${study ? `Experimento já registrado: ${study.economics.decision} Seu fingerprint está ${study.sourceFingerprint === fingerprint ? 'atual' : 'desatualizado'}. Intervenção registrada: ${study.economics.intervention?.join(' ') ?? 'não disponível'}. ${studyMealA && studyMealB ? `Farelo físico final: A = ${num(studyMealA.physical)} kg e B = ${num(studyMealB.physical)} kg, nos horizontes de ${study.economics.a!.options.days}/${study.economics.b!.options.days} dias.` : 'Comparativo por item não disponível.'} Esses fatos não atribuem uma causa única à distribuição.` : 'Estudo anterior indisponível; consultar os anexos existentes antes de repetir experimentos.'}

Marcos extraídos da série da referência, com validade indicada acima. Quantidades acumuladas de produção/consumo e estoque observado; não inferir produção contínua durante os 90 dias de totais finais estáveis.

| Dia | Item | Produção acumulada | Consumo familiar acumulado | Entrada em produção acumulada | Estoque físico |
| ---: | --- | ---: | ---: | ---: | ---: |
${chainTimeline.map((row) => `| ${row.day} | ${row.id} | ${num(row.produced)} | ${num(row.householdConsumption)} | ${num(row.productionInputs)} | ${num(row.physical)} |`).join('\n')}

## Controles aprovados e limites menores

- ${checks.length} cenários preservaram dinheiro inteiro e não negativo; as duas lojas são comparadas em mundos separados com o mesmo capital inaugural.
- Custo do lote de óleo: ${brl(oilJob.cost)}; alocação de ${brl(allocatedCost)} entre coprodutos. Conclusão repetida não duplica saída; tentativa sem insumo rejeita sem mutação.
- O laboratório registra conservação física e monetária; isso não demonstra rentabilidade, demanda realizada suficiente ou ausência geral de arbitragem.
- Arredondamento dos fixos: projeção de ${fixedCosts.total}¢/dia versus execução de ${chargedPerDay}¢; diferença de ${chargedPerDay - fixedCosts.total}¢ por dia na unidade de controle. Cada parcela é arredondada por tick. Impacto baixo; conferir no ajuste do custeio.
- Qualidade com múltiplas entradas é ponderada por quantidade. Hoje ferro/carvão estão ambos em toneladas; não foi demonstrado bug atual de unidade nesse recorte. Exigir pesos explícitos para futuras receitas com unidades diferentes.

## Sequência de correção e experimentos

1. Corrigir M02/M03 compartilhando a cadência real entre execução, recuperação, reposição, preços e projeções. Critério: mesma fixture de aço retorna 30 ciclos/dia e recuperação do leite não usa mais de 300 un/dia por linha. Separar capacidade máxima, programação e venda provável.
2. Corrigir M04 conservando frações e distribuindo unidades sem perda por concorrência; testar cidades pequenas, orçamento/capacidade insuficientes, calendário e repetição online/offline. Decidir M05 explicitamente antes de medir demanda de leite.
3. Reconciliar trabalho, duração, rendimento e preço nas quatro receitas de M01. Buscar a menor operação viável por especialidade com caixa finito e custo completo, sem resgate invisível. Antes de alterar receita/item, preencher RESOURCE-TEMPLATE e regenerar/verificar o catálogo.
4. Testar M07 isoladamente: alvo de estoque por participação/lead time, preservando consumo, receitas e custos. Comparar 30/90 dias e sementes pareadas. Critérios candidatos: reduzir estoque de farelo em 20%, preservar ao menos 95% do consumo de óleo/leite, não elevar obrigações mais de 5%, conservar dinheiro e fluxos físicos. São critérios propostos, sem aprovação automática.
5. Somente depois testar M06 como cadeia: coeficientes/destinos executados e consumo em conjunto. Medir margem após fixos/frete, produção, consumo efetivo, estoques, atrasados e concentração por item. Preservar a referência anterior; corrigir um problema por experimento para identificar efeitos.

Os achados não autorizam recalibrar retroativamente a season salva. Esta entrega conclui as provas de auditoria, sem aplicar mudanças ao motor ou aos parâmetros.
`;
const formatted = await format(markdown, {
  ...(await resolveConfig(resolve('docs/product/MATHEMATICS-AUDIT.md'))),
  parser: 'markdown',
});
const outputDirectory = resolve('.runtime/mathematics');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(outputDirectory, 'audit.md'), formatted);
if (args.includes('--write-doc'))
  writeFileSync(resolve('docs/product/MATHEMATICS-AUDIT.md'), formatted);
const unconfirmed = findings.filter((finding) => !finding.confirmed).map((finding) => finding.id);
console.log(
  JSON.stringify(
    {
      output: resolve(outputDirectory, 'audit.json'),
      sourceFingerprint: fingerprint,
      findings: findings.map(({ id, priority, kind, confirmed }) => ({
        id,
        priority,
        kind,
        confirmed,
      })),
      moneyChecks: checks.length,
      currentBaseline,
      unconfirmed,
    },
    null,
    2,
  ),
);
if (unconfirmed.length) process.exitCode = 1;
