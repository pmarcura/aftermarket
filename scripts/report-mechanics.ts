import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as ts from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';
import { format, resolveConfig } from 'prettier';
import { createWorld } from '../packages/simulation/src/seed';
import {
  products,
  ECONOMIC_INTERVAL,
  TIME_SCALE,
  type Category,
  type ProductId,
} from '../packages/simulation/src/model';
import { auditResources } from '../packages/simulation/src/resource-audit';
import { materialBoundaries } from '../packages/simulation/src/resource-policy';
import { householdProducts, infrastructurePrograms } from '../packages/simulation/src/channels';
import { economyHealth } from '../packages/simulation/src/design';
import { execute } from '../packages/simulation/src/engine';
import { availableStock, GAME_DAY, openingWorkers } from '../packages/simulation/src/operations';
import { householdDemand, operatingCosts } from '../packages/simulation/src/metrics';
import { regions } from '../packages/world/src/regions';
import { readSavedWorld } from './lib/read-world';
import { mechanicsGaps } from './lib/mechanics-gaps';

const args = process.argv.slice(2);
if (args.some((a) => a !== '--write-doc' && !a.startsWith('--world=')))
  throw new Error('Use --world=caminho.sqlite e/ou --write-doc.');
const worldArg = args.find((a) => a.startsWith('--world='));
const outputRoot = `.runtime/mechanics/${worldArg ? 'saved-world' : 'opening'}`;
const opening = createWorld(Date.UTC(2026, 9, 27, 12));
const w = worldArg ? readSavedWorld(worldArg.slice('--world='.length)) : opening;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before = hash(w),
  audit = auditResources(w),
  cfg = w.season.config;
if (!audit.structurallyValid)
  throw new Error('Estrutura inválida; gere resources:audit antes do relatório.');
const money = (n: number) =>
  (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const unitCost = (n: number) =>
  `R$ ${(n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const pct = (n: number) => `${num(n * 100)}%`;
const qty = (values: Partial<Record<ProductId, number>>) =>
  Object.entries(values)
    .map(
      ([id, n]) => `${num(n!)} ${products[id as ProductId].unit} ${products[id as ProductId].name}`,
    )
    .join(' + ') || 'Sem item de estoque';
const table = (headers: string[], rows: (string | number)[][]) =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) =>
        `| ${row.map((v) => String(v).replaceAll('|', '/').replaceAll('\n', ' ')).join(' | ')} |`,
    ),
    '',
  ].join('\n');
const categories = Object.keys(cfg.salaries) as Category[];
const ids = Object.keys(products) as ProductId[];
const sourceFiles = [
  'model',
  'calibration',
  'seed',
  'operations',
  'engine',
  'metrics',
  'competition',
  'design',
  'director',
  'supply',
  'scenarios',
  'channels',
  'resource-policy',
  'transport',
  'migrate',
  'shipment',
  'geometry',
]
  .map((name) => `packages/simulation/src/${name}.ts`)
  .concat([
    'packages/world/src/regions.ts',
    'apps/server/src/index.ts',
    'apps/server/src/store.ts',
    'apps/server/src/routing.ts',
  ]);
const literals: { file: string; line: number; literal: string; value: number; context: string }[] =
  [];
const api = new API({ cwd: resolve('.') });
const snapshot = api.updateSnapshot({ openProjects: [resolve('tsconfig.json')] });
let sources: { file: string; hash: string }[];
try {
  const program = snapshot.getProject(resolve('tsconfig.json'))!.program;
  sources = sourceFiles.map((file) => {
    const text = readFileSync(resolve(file), 'utf8');
    const source = program.getSourceFile(resolve(file));
    if (!source) throw new Error(`Fonte não carregada: ${file}`);
    const lines = text.split(/\r?\n/);
    const visit = (node: ts.Node) => {
      if (ts.isNumericLiteral(node)) {
        const parent = node.parent;
        const target =
          ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.MinusToken
            ? parent
            : node;
        const line = source.getLineAndCharacterOfPosition(target.getStart(source)).line;
        const literal = target.getText(source);
        literals.push({
          file,
          line: line + 1,
          literal,
          value: Number(literal.replaceAll('_', '').replace(/\s/g, '')),
          context: lines[line].trim(),
        });
      }
      node.forEachChild(visit);
    };
    visit(source);
    return { file, hash: createHash('sha256').update(text).digest('hex') };
  });
} finally {
  snapshot.dispose();
  api.close();
}
const initialStocks = ids.map((id) => {
  const legacy = opening.establishments
    .filter((e) => !e.companyId.startsWith('rival-'))
    .reduce((n, e) => n + (e.inventory[id] ?? 0), 0);
  const paid = opening.establishments
    .filter((e) => e.companyId.startsWith('rival-'))
    .reduce((n, e) => n + (e.inventory[id] ?? 0), 0);
  const paidValue = opening.ledger
    .filter(
      (l) =>
        l.from.startsWith('rival-') &&
        l.description === `Estoque inaugural finito · ${products[id].name}`,
    )
    .reduce((n, l) => n + l.amount, 0);
  return { id, legacy, paid, total: legacy + paid, paidValue };
});
const seedRecipes = cfg.recipes.filter(
  (r) => r.category === 'farm' && Object.keys(r.input).some((id) => r.output[id as ProductId]),
);
const seedHoldings = opening.establishments
  .filter((e) => e.category === 'farm')
  .flatMap((e) => {
    const r = opening.season.config.recipes.find((r) => r.id === e.specialization);
    if (!r) return [];
    return Object.keys(r.input)
      .filter((id) => r.output[id as ProductId])
      .map((key) => {
        const id = key as ProductId;
        return {
          id,
          name: e.name,
          establishmentId: e.id,
          companyId: e.companyId,
          city: opening.properties.find((p) => p.id === e.propertyId)!.city,
          quantity: e.inventory[id] ?? 0,
          cost: e.unitCosts[id] ?? 0,
          free: availableStock(opening, e, id),
        };
      });
  });
// A produção explicativa usa somente cópia isolada da abertura, nunca o snapshot salvo.
const allocationWorld = structuredClone(opening);
allocationWorld.nextEconomicAt = Infinity;
const crusher = allocationWorld.establishments.find((e) => e.specialization === 'soy-oil')!;
crusher.unitCosts.soy = cfg.basePrices.soy;
allocationWorld.season.config.recipes = structuredClone(cfg.recipes);
allocationWorld.season.config.utilities = structuredClone(cfg.utilities);
allocationWorld.properties.find((p) => p.id === crusher.propertyId)!.state = 'SP';
execute(
  allocationWorld,
  crusher.companyId,
  { type: 'produce', establishmentId: crusher.id, recipeId: 'soy-oil', cycles: 1 },
  allocationWorld.updatedAt,
);
const oilJob = allocationWorld.jobs.at(-1)!;
if (Object.values(oilJob.outputCosts!).reduce((n, value) => n + value!, 0) !== oilJob.cost)
  throw new Error('Alocação do custo não conserva o lote.');
const fixedCosts = categories.map((category) => {
  const property = { ...w.properties[0], id: `report-${category}`, state: 'SP', category };
  const plant = {
    ...w.establishments[0],
    propertyId: property.id,
    category,
    employees: openingWorkers(category),
    installed: true,
    mothballed: false,
  };
  const standard = { ...w, properties: [property], stateWages: {} };
  const c = operatingCosts(standard, plant);
  return {
    category,
    workers: plant.employees,
    ...c,
    effectivePerDay: [c.payroll, c.maintenance, c.energy, c.water].reduce(
      (n, value) => n + Math.round(value / 12) * 12,
      0,
    ),
  };
});
const health = economyHealth(w);
const labContextAvailable = existsSync(resolve('.runtime/lab/context.json'));
const labReviewAvailable = existsSync(resolve('.runtime/lab/review.json'));
const configChanges: { path: string; opening: unknown; saved: unknown }[] = [];
function compare(a: unknown, b: unknown, path = 'config') {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  )
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
      compare(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
  else configChanges.push({ path, opening: a, saved: b });
}
compare(opening.season.config, cfg);
const observedAt = new Date(w.updatedAt).toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour12: false,
});
const sections: string[] = [
  '# Relatório das mecânicas, origem dos recursos e fluxos incompletos',
  '',
  '**Sementes não existem como item próprio.** As primeiras unidades agrícolas são inseridas na abertura. Óleo e farelo são saídas conjuntas da soja. Leite consome farelo, sem rebanho modelado. Produção e venda funcionam, mas isso não completa as origens físicas nem demonstra equilíbrio.',
  '',
  `Fonte econômica: **${worldArg ? 'configuração/snapshot salvos, somente leitura' : 'abertura isolada do código'}**. Estado observado: **${observedAt}, America/Sao_Paulo**; revisão **${num(w.revision)}**; season \`${w.season.id}\`. Estoques inaugurais abaixo são da abertura do código atual e não uma reconstrução histórica do banco.`,
  '',
  'Preços em reais. Separar referência de abertura, anúncio, custo médio do estoque e custo de fabricação. Valores são parâmetros de jogo, sem verificação de cotações/agronomia reais nesta entrega. Nenhuma regra, saldo ou estoque da season foi alterado.',
  '',
  'Conteúdo: sementes; óleo/farelo/leite; catálogo/estoque inicial; receitas/custos; tempo/CAPEX; trabalho/utilidades; demanda/varejo; abastecimento; logística; governo; finanças; agentes/snapshot; fluxos incompletos; fontes e reprodução.',
  '',
];
const add = (title: string, ...text: string[]) => sections.push(`## ${title}`, '', ...text, '');

add(
  '1. Sementes: de onde vêm e quanto valem',
  'Os próprios IDs de soja, arroz, feijão e açúcar são usados como entrada agrícola. Não existe preço específico de semente nem produtor desse insumo. O açúcar embalado inicia uma cadeia de cana por convenção fictícia; não representa propagação real de cana.',
  table(
    [
      'Entrada usada como semente',
      'Por ciclo',
      'Referência da entrada',
      'Saída bruta',
      'Retenção para repetir',
      'Excedente líquido',
    ],
    seedRecipes.map((r) => {
      const id = Object.keys(r.input).find((id) => r.output[id as ProductId]) as ProductId;
      const q = r.input[id]!,
        out = r.output[id]!;
      return [
        products[id].name,
        `${num(q)} ${products[id].unit}`,
        money(q * cfg.basePrices[id]),
        `${num(out)} ${products[id].unit}`,
        `${num(q)} ${products[id].unit}`,
        `${num(out - q)} ${products[id].unit}`,
      ];
    }),
  ),
  '**Primeira unidade:** atores antigos recebem estoque diretamente em `seed.ts`, sem compra/fabricação anterior. Novos rivais recebem capital finito e pagam ao tesouro pelo estoque criado em `competition.ts`; não compram de um produtor anterior. Depois, precisam produzir ou comprar estoque existente. Nenhum tick repõe sementes gratuitamente.',
  table(
    [
      'Produto',
      'Fazenda / ID',
      'Praça',
      'Quantidade inaugural',
      'Custo contábil/unidade',
      'Livre para venda',
      'Origem',
    ],
    seedHoldings.map((s) => [
      products[s.id].name,
      `${s.name} / ${s.establishmentId}`,
      s.city,
      `${num(s.quantity)} ${products[s.id].unit}`,
      unitCost(s.cost),
      num(s.free),
      s.companyId.startsWith('rival-')
        ? 'Criado e pago ao tesouro'
        : 'Demonstrativo sem compra anterior',
    ]),
  ),
  'Com automação agrícola, a entrada × ciclos configurados fica protegida da venda. Desligada, a proteção deixa de existir; vender a última entrada pode paralisar a cadeia. Compra de outro fornecedor paga preço anunciado + frete. O custo médio da semente retida muda conforme os lotes recebidos/produzidos.',
  '`--seed` dos experimentos é a semente de calendário/estratégia da simulação, não uma mercadoria. Fontes: `seed.ts`, `competition.ts: portfolio`, `operations.ts: availableStock`, `engine.ts: produce`.',
);

const crushing = audit.recipes.find((r) => r.id === 'soy-oil')!;
const milk = audit.recipes.find((r) => r.id === 'milk-production')!;
add(
  '2. Óleo, farelo e leite: origem e valor',
  '```mermaid\nflowchart LR\n  I["Abertura cria estoque finito"] --> S["Soja usada como semente"]\n  S --> F["Fazenda produz soja"]\n  F --> E["Esmagamento integrado"]\n  E --> O["Óleo embalado"]\n  E --> R["Farelo"]\n  R --> L["Leite, sem rebanho modelado"]\n  O --> V["Varejo"]\n  L --> V\n  V --> C["Consumo das famílias"]\n  L --> P["Programa público"]\n  I --> D["Produtos prontos inaugurais"]\n  D --> V\n```',
  `**Óleo/farelo:** ${qty(crushing.input)} → ${qty(crushing.output)}, em ${num(crushing.hours)} hora virtual. Soja de referência: ${money(crushing.materials)}; processamento: ${money(crushing.charges.processing)}; energia/SP: ${money(crushing.charges.energy)}; água/SP: ${money(crushing.charges.water)}. Custo variável do lote: **${money(crushing.variableCost)}**, antes de fixos/frete/CAPEX.`,
  'As saídas são obrigatoriamente conjuntas. Farelo não tem receita própria nem consumidor familiar. Seu único uso produtivo atual é leite. Esmagamento, refino e envase são agregados; embalagens não são compradas como item.',
  `**Leite:** ${qty(milk.input)} → ${qty(milk.output)}, em ${num(milk.hours)} horas virtuais. Farelo de referência: ${money(milk.materials)}; processamento: ${money(milk.charges.processing)}; energia/SP: ${money(milk.charges.energy)}; água/SP: ${money(milk.charges.water)}. Custo variável: **${money(milk.variableCost)}**, ou **${unitCost(milk.variableCost / milk.output.milk!)} por unidade**, antes de fixos/frete/CAPEX.`,
  '**Faltam no leite:** compra/criação de vacas, tamanho/reprodução/mortalidade do rebanho, pastagem, alimentação complementar, ordenha separada, refrigeração, embalagem e validade. Há fazenda, equipe, água/energia, tempo e farelo; o resto é abstração.',
  'O motor aloca o custo do esmagamento pelo valor interno das saídas na contratação; sem oferta usa abertura (×0,82 para unidade `un`). A soma alocada conserva o custo. Não atribuir o custo integral simultaneamente ao óleo e ao farelo.',
  table(
    ['Saída', 'Quantidade', 'Custo alocado pelo motor', 'Custo alocado/unidade'],
    Object.entries(oilJob.output!).map(([id, n]) => [
      products[id as ProductId].name,
      `${num(n!)} ${products[id as ProductId].unit}`,
      money(oilJob.outputCosts![id as ProductId]!),
      unitCost(oilJob.outputCosts![id as ProductId]! / n!),
    ]),
  ),
  'Demonstração em cópia da abertura, com soja à referência analisada, utilidades/SP e anúncios da abertura. Não é custo atual de todos os estoques nem venda garantida.',
  ...audit.jointProduction.map(
    (j) =>
      `**Oferta conjunta:** 1 unidade de ${j.primary} gera ${num(j.coproductPerPrimary)} unidades de ${j.coproduct}, equivalentes a ${num(j.linkedOutputPerPrimary)} unidades de ${j.finalProduct}. Consumo familiar relativo: ${num(j.householdRatio)}. Excesso teórico do coproduto: **${pct(j.surplusFraction)}** na hipótese somente familiar; programas públicos, lojas ativas, estoques e outras origens mudam o realizado.`,
  ),
  'O estoque inicial de óleo, farelo e leite também é criado na abertura, conforme a tabela seguinte; existir no primeiro instante não comprova fabricação.',
);

add(
  '3. Itens, unidades, preços e estoque criado na abertura',
  table(
    [
      'Item / ID',
      'Unidade',
      'kg/unidade',
      'm³/unidade',
      'Referência da season',
      'Faixa de calibração',
    ],
    audit.items.map((p) => [
      p.name + ' / ' + p.id,
      p.unit,
      num(p.massKg),
      num(p.volumeM3),
      money(p.openingPrice),
      `${money(p.priceBand.low)} a ${money(p.priceBand.high)}`,
    ]),
  ),
  'Óleo/leite: unidade de 1 litro; arroz/açúcar: pacote de 5 kg; feijão: pacote de 1 kg. Faixas não são limites de mercado e não foram verificadas como cotações nesta entrega.',
  table(
    [
      'Item',
      'Criado para atores antigos',
      'Criado/pago pelos novos rivais',
      'Total inaugural',
      'Valor pago ao tesouro pelos rivais',
    ],
    initialStocks.map((s) => [
      products[s.id].name,
      num(s.legacy),
      num(s.paid),
      `${num(s.total)} ${products[s.id].unit}`,
      money(s.paidValue),
    ]),
  ),
  'Custo contábil demonstrativo antigo = 67% da referência nas lojas e 75% nas demais unidades, arredondado. Rivais novos pagam 100% da referência do estoque inaugural. São escolhas da abertura, não cálculo de fabricação. Patrimônio antigo também é atribuído diretamente.',
);

add(
  '4. Receitas, produtividade e custos comparáveis',
  table(
    [
      'Receita',
      'Entrada → saída bruta',
      'Horas virtuais/ciclo',
      'Pessoas / m² por linha',
      'kWh / m³ água',
      'Processamento',
      'Energia + água/SP',
    ],
    audit.recipes.map((r) => [
      r.id,
      `${qty(r.input)} → ${qty(r.output)}`,
      num(r.hours),
      `${r.workers} / ${num(r.areaM2)}`,
      `${num(r.energyKwh)} / ${num(r.waterM3)}`,
      money(r.charges.processing),
      money(r.charges.energy + r.charges.water),
    ]),
  ),
  'Entradas/reserva são debitadas antes do início. Saída só entra ao terminar. Linhas = menor limite de equipe, área e equipamento. Duração do lote = duração por ciclo × teto(ciclos/linhas). A unidade mantém fila serial. Falta de insumo, água, energia, equipe, espaço ou caixa impede produzir.',
  '**Hipótese comparável:** uma linha/SP, equipe mínima, índice salarial 1, lotes automáticos de um ciclo, materiais/saídas à referência, venda integral. Sem frete, investimento, financiamento, limite de demanda/caixa ou ociosidade. Semente retida é valorada dos dois lados e não contabilizada como venda real.',
  table(
    [
      'Receita',
      'Material/ciclo',
      'Variável/ciclo',
      'Valor bruto/ciclo',
      'Contribuição/ciclo',
      'Fixos/dia',
      'Ciclos/dia',
      'Resultado/dia nesta hipótese',
      'Utilização de equilíbrio',
    ],
    audit.recipes.map((r) => [
      r.id,
      money(r.materials),
      money(r.variableCost),
      money(r.outputValue),
      money(r.contribution),
      money(r.fixedPerDay),
      num(r.cyclesPerDay),
      money(r.resultPerDay),
      r.breakEvenUtilization === null ? 'Sem contribuição positiva' : pct(r.breakEvenUtilization),
    ]),
  ),
  'Cadência automática = teto(duração do lote/intervalo econômico) × intervalo. Uma receita de uma hora, em lotes unitários, reinicia até 12 vezes/dia, não 24. Início/fim de safra alteram janelas curtas.',
  ...audit.recipes
    .filter((r) => r.category === 'mine')
    .map((r) => {
      const duration = cfg.recipes.find((x) => x.id === r.id)!.duration * 10;
      const cycles =
        (10 * GAME_DAY) / (Math.ceil(duration / ECONOMIC_INTERVAL) * ECONOMIC_INTERVAL);
      return `Uma linha de ${r.id} em lotes de **dez ciclos**: ${num(cycles)} ciclos/dia, resultado teórico **${money(r.contribution * cycles - r.fixedPerDay)}/dia**, mesma hipótese de venda. Reserva de 15.000 duraria ${num(15000 / cycles)} dias. Prejuízo no lote unitário não significa prejuízo em qualquer escala.`;
    }),
  'Custo médio = (valor anterior + custo recebido/produzido)/quantidade total. Frete é capitalizado no destino. Fixos não são automaticamente capitalizados nos jobs; são despesa da estrutura. Margem sobre venda m exige preço = custo completo/(1−m); custo × (1+m) é markup.',
  table(
    [
      'Receita',
      'Entrada kg',
      'Saída kg',
      'Origem externa agregada kg',
      'Residual sem estoque kg',
      'Limite',
    ],
    audit.recipes.map((r) => [
      r.id,
      num(r.inputMassKg),
      num(r.outputMassKg),
      num(r.boundary.externalMassT * 1000),
      num(r.boundary.residualMassT * 1000),
      r.boundary.note,
    ]),
  ),
  'Origem externa/residual declarados tornam a fronteira visível; não são bens adicionados ao motor nem comprovação físico-química.',
);

add(
  '5. Tempo, capital, imóveis e equipamentos',
  table(
    ['Regra', 'Número / significado'],
    [
      [
        'Relógio',
        `${TIME_SCALE}×; 1 s real = ${TIME_SCALE / 60} min virtuais; um dia virtual = ${num(GAME_DAY / 60000)} min reais`,
      ],
      [
        'Tick econômico',
        `${ECONOMIC_INTERVAL / 1000} s reais = ${(ECONOMIC_INTERVAL * TIME_SCALE) / 3600000} h virtuais; ${GAME_DAY / ECONOMIC_INTERVAL} ticks/dia`,
      ],
      [
        'Versões salvas',
        `world=${w.version}; operations=${w.operationsVersion}; competition=${w.competitionVersion}; design=${w.designVersion}; config=${cfg.version}`,
      ],
      [
        'Capital humano demonstrativo',
        'R$ 2.850.625,00 por conta; duas contas; patrimônio inicial já atribuído',
      ],
      ['Bots antigos', 'Oito contas com R$ 6.500.000,00 cada antes das ações'],
      ['Consumidores antes dos novos rivais', 'R$ 50.000.000,00; dinheiro não é recriado por tick'],
      [
        'Capital dos novos rivais',
        `${cfg.competition.botCount} empresas; até ${money(cfg.competition.botCapital)} cada; limitado a 60% do caixa institucional dividido entre faltantes`,
      ],
      [
        'Imóvel inaugural dos rivais',
        'Mínimo de 35% do capital e R$ 420 mil, pagos ao tesouro; instalação/equipe legadas preservadas',
      ],
      [
        'Reserva da mina',
        '12.000 ao adquirir imóvel novo; 15.000 por mina dos novos rivais; valores próprios nas minas antigas',
      ],
      [
        'Frota inaugural',
        `${opening.vehicles.length} veículos: 12 da primeira conta humana, 13 das transportadoras antigas, 30 dos novos rivais`,
      ],
      [
        'Starter',
        'R$ 120 mil por conta humana; loja 60 m², seis empregados, 21 t/84 m³; sem estoque/frota próprios',
      ],
      ['Low-demand', 'Participação consumidora × 0,25; 25% do potencial familiar baseline'],
    ],
  ),
  table(
    ['Categoria', 'Equipamento/linha', 'Armazenamento t/m²', 'Armazenamento m³/m²'],
    categories.map((c) => [
      c,
      money(cfg.design.equipmentCost[c]),
      num(cfg.design.storageMassPerM2[c]),
      num(cfg.design.storageVolumePerM2[c]),
    ]),
  ),
  'Aquisição nova paga somente imóvel, sem equipe/equipamento. Instalação aceita 1–100 linhas, dentro da área; atividade não produtora limita a uma linha. Instalação é imediata e capacidade = piso(área × fator), mínimo 1. Legado preserva equipamentos/capacidades anteriores. Não há obra ou fabricante de máquinas.',
  table(
    ['Imóvel disponível na abertura', 'Categoria', 'Área m²', 'Preço'],
    opening.properties
      .filter((p) => p.ownerId === null)
      .map((p) => [p.name, p.category, num(p.area), money(p.price)]),
  ),
  'Calibração dos imóveis disponíveis: indústria até 12.000 m² a R$ 200/m²; loja até 180 m² a R$ 3.500/m²; logística até 15.000 m² a R$ 250/m²; fazenda R$ 7/m²; concessão mineira virtual R$ 720 mil. Não são ofertas imobiliárias reais.',
);

add(
  '6. Trabalho, utilidades, manutenção e qualidade',
  table(
    [
      'Categoria',
      'Salário-base/mês',
      'Manutenção/mês',
      'Equipe comparada',
      'Folha/dia SP',
      'Energia fixa/dia SP',
      'Água fixa/dia SP',
      'Fixos efetivos/dia',
    ],
    fixedCosts.map((c) => [
      c.category,
      money(cfg.salaries[c.category]),
      money(cfg.maintenance[c.category]),
      c.workers,
      money(c.payroll),
      money(c.energy),
      money(c.water),
      money(c.effectivePerDay),
    ]),
  ),
  `Salário = arredondar(máximo entre ${money(cfg.parameters.minimumWage)} e salário-base × fator estadual × índice salarial). Folha diária = empregados × salário × ${num(cfg.parameters.payrollBurden)} / 30. Índice começa em 1 e cresce semanalmente por min(0,02; 0,002 + folha paga/10¹¹ centavos): 0,2%–2%. Teto técnico: 1.000 empregados/unidade, sem pool de candidatos.`,
  table(
    ['UF', 'Fator salarial'],
    Object.entries(cfg.competition.stateFactors).map(([uf, factor]) => [uf, num(factor)]),
  ),
  table(
    ['UF tarifária', 'R$/kWh', 'R$/m³ água+esgoto', 'kWh/empregado/dia', 'm³/empregado/dia'],
    Object.entries(cfg.utilities).map(([uf, r]) => [
      uf,
      money(r.electricity),
      money(r.water),
      num(r.standingKwhPerEmployee),
      num(r.standingM3PerEmployee),
    ]),
  ),
  'UF sem tarifa usa SP. Produção paga utilidades adicionais da receita. Cada componente fixo é dividido/arredondado em 12 cobranças/dia; há diferenças de centavos. Pausa mantém fixos; suspensão zera equipe e mantém 10% da manutenção.',
  table(
    ['Qualidade/educação', 'Número / consequência'],
    [
      ['Sem qualidade salva', '70/100'],
      ['Qualidade do local', '60 + soma dos códigos dos caracteres do ID módulo 26; faixa 60–85'],
      [
        'Qualidade produtiva',
        '80% média das entradas + 20% local + 3 × formação; arredondada, teto 100',
      ],
      ['Sem entrada', 'Base é a qualidade do local; sem teor mineral próprio'],
      [
        'Treinamento',
        `${money(cfg.competition.educationPerWorker)} × empregados × nível de destino; ${cfg.competition.educationHours} h virtuais; até nível ${cfg.competition.educationMaxLevel}`,
      ],
      [
        'Contratação após treinamento',
        'Formação × equipe antiga/equipe nova; equipe zero perde formação',
      ],
      [
        'Efeito temporal',
        'Só jobs futuros; estoque/lotes contratados não melhoram retroativamente',
      ],
    ],
  ),
  'Média das entradas usa quantidades comerciais, sem normalizar kg/t/un. Antes de misturar unidades novas, definir pesos explícitos.',
  `**Configurados sem controle de contratação identificado:** participação ${pct(cfg.parameters.participation)}, desemprego ${pct(cfg.parameters.unemployment)}, idade laboral ${pct(cfg.parameters.workingAgeShare)}, fração laboral jogável ${pct(cfg.parameters.playableLaborShare)}; qualification=${JSON.stringify(cfg.qualification)}. Não equivalem a trabalhadores regionais disponíveis no motor.`,
);

add(
  '7. Consumo, demanda e varejo',
  table(
    ['Produto', 'Por pessoa representada/mês', 'Equivalência física'],
    householdProducts.map((id) => [
      products[id].name,
      `${num(cfg.consumption[id] ?? 0)} ${products[id].unit}`,
      ['oil', 'milk'].includes(id)
        ? `${num(cfg.consumption[id] ?? 0)} litros`
        : `${num((cfg.consumption[id] ?? 0) * products[id].massT * 1000)} kg`,
    ]),
  ),
  `Representada = população salva × ${pct(cfg.parameters.playableConsumerShare)}; potencial/dia = representada × consumo mensal / 30. Praças sem lojas ainda têm potencial modelado, sem vendas executadas ali.`,
  table(
    [
      'Praça',
      'População configurada',
      'Representada',
      'Lojas ativas',
      ...householdProducts.map((id) => `${id}/dia`),
    ],
    regions.map((r) => [
      r.name,
      num(cfg.population[r.id]),
      num(cfg.population[r.id] * cfg.parameters.playableConsumerShare),
      w.establishments.filter(
        (e) =>
          e.category === 'retail' &&
          e.enabled &&
          w.properties.find((p) => p.id === e.propertyId)!.city === r.name,
      ).length,
      ...householdProducts.map((id) => num(householdDemand(w, r.id, id))),
    ]),
  ),
  table(
    ['Dia virtual', 'Fator de consumo'],
    cfg.operations.weekday.map((factor, i) => [
      ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][i],
      num(factor),
    ]),
  ),
  'O calendário virtual usa dia UTC. Por tick: demanda/dia × fator/12. Score = (abertura/preço)^1,4 × (0,5 + qualidade/100). Desejado = piso(demanda × score/soma de scores × min(1,2; score)). Vendido = mínimo de desejado, estoque, atendimento restante e caixa das famílias/preço.',
  `Atendimento/tick = piso(min(equipe × ${cfg.operations.retailUnitsPerWorker}, área × ${cfg.operations.retailUnitsPerM2})); é compartilhado entre produtos. Ordem: ${householdProducts.join(' → ')}. Pisos, capacidade e ordem podem afetar vendas.`,
  'Demanda industrial de marketView = entrada × min(24; dia/duração) × linhas; não é pedido pago. dailyNeed usa min(12 × ciclos automáticos; linhas × dia/duração). A execução real ainda depende de fila, orçamento, caixa, chegada e planos. Cobertura = oferta/demanda modelada. Recortes municipais usam raio padrão de 120 km e podem sobrepor fornecedores; não somar praças sobrepostas.',
);

add(
  '8. Compra, abastecimento e automação',
  table(
    ['Regra', 'Número / limite'],
    [
      ['Política humana', 'Inicialmente desligada; configurar não compra imediatamente'],
      ['Orçamento padrão', 'R$ 100 mil/dia ou valor já salvo; separado da produção'],
      ['Caixa protegido padrão', 'R$ 20 mil; novos rivais usam R$ 5 mil'],
      [
        'Distância padrão',
        '800 km; complementos de produtores/rivais usam 1.500 km; permitido 1–6.000 km',
      ],
      ['Qualidade mínima', 'Padrão 40; permitido 0–100'],
      ['Regra de insumo', 'Mínimo 2 × entrada; alvo/máximo por compra 4 × entrada'],
      ['Regra de loja', 'Alvo 400 unidades/item, leite 1.200; mínimo teto(alvo/3)'],
      ['Preço máximo padrão', '1,5 × abertura; teto de preço/frete zero significa sem esse teto'],
      ['Quantidades', 'Inteiras, até 1 milhão por compra/alvo'],
      ['Orçamentos e verba de frete', 'Até 1e9 centavos = R$ 10 milhões por campo'],
      ['Produção', '1–100 ciclos por lote; orçamento R$ 0,01 a R$ 10 milhões/dia'],
      ['Novos rivais', 'Orçamento produtivo inicial R$ 120 mil/dia; minas lote de dez, demais um'],
      ['Pedidos', 'Prazo 1–14 dias; vínculo de caixa opcional: quantidade × preço + frete máximo'],
      [
        'Preço em pedido/proposta/edital',
        'Teto efetivo R$ 10 mil/unidade em vários comandos; API admite até R$ 10 milhões',
      ],
      ['Preço de anúncio/varejo', 'R$ 0,01 a R$ 1 milhão/unidade'],
      ['Origem fixa', 'Aguarda se faltar mercadoria; não troca silenciosamente de fornecedor'],
    ],
  ),
  'Posição de reposição considera físico, cargas e pedidos pendentes. Orçamento/frota são compartilhados pelo destino. Transferência própria paga frete e conserva custo/qualidade, sem receita. Proposta não reserva estoque; aceite revalida e despacha. Pedido conclui após todas as chegadas.',
  'Metas dos bots usam a primeira saída: óleo = máximo de 600 e três dias da demanda familiar global; outras indústrias = máximo de 64 e quantidades dos editais desse produto; demais = 200. Job pendente impede novo início automático. Orçamento produtivo cobre processamento/utilidades, sem substituir compra de entradas.',
);

add(
  '9. Transporte e capacidade física',
  table(
    ['Componente', 'Número / fórmula'],
    [
      ['Caminhão novo', 'R$ 280 mil; 30 t/85 m³; exige armazém/pátio próprio'],
      ['Frota antiga', 'Há 30 t/85 m³, 16 t/45 m³ e 8 t/45 m³'],
      [
        'Diesel',
        `${money(cfg.parameters.dieselPerLiter)}/L; ${num(cfg.parameters.kmPerLiter)} km/L`,
      ],
      ['Manutenção', `${money(cfg.parameters.maintenancePerKm)}/km`],
      ['Motorista', `${money(cfg.parameters.driverPerHour)}/hora, com deslocamento/carregamento`],
      ['Pedágio estimado', `${money(cfg.parameters.estimatedTollPerKm)}/km`],
      ['Manuseio/caminhão', 'R$ 180 + R$ 5 × toneladas carregadas'],
      [
        'Velocidade estimada',
        `${cfg.parameters.averageSpeedKmH} km/h; trecho OSRM pode ter duração própria`,
      ],
      ['Carregamento', `${cfg.parameters.loadingMinutes} minutos virtuais`],
      [
        'Preço de transportadora',
        'Custo ×1,15; RodoLeste ×1,20; Expresso ×1,30; mínimo R$ 280/caminhão',
      ],
      ['Frota de origem/destino', 'Sem markup/mínimo comercial; comprador paga custo operacional'],
      [
        'Sem rota',
        'Estimativa = máximo de 3 km e geodésica ×1,3; novo despacho do servidor exige OSRM',
      ],
      ['Coleta vazia', 'Geodésica veículo→origem ×1,3; sem retorno vazio planejado'],
      ['Prazo mínimo por parte', '15 s reais = 30 min virtuais'],
      [
        'Roteamento',
        'Driving automotivo; fila até 64; intervalo 1.200 ms; timeout 12 s; retry 60 s',
      ],
    ],
  ),
  table(
    ['Item', 'Máximo inteiro em 30 t/85 m³'],
    audit.items.map((p) => [p.name, `${num(p.maxPerStandardTruck)} ${p.unit}`]),
  ),
  'Calcular piso de massa/volume por caminhão, depois somar. Operação limita também estoque e espaço comprometido; caixa/prazo/frete são restrições adicionais. Motorista recebe na conta dos consumidores; combustível/manutenção/pedágio/manuseio vão ao tesouro, sem comprar diesel/peças físicos.',
  'Índice logístico: 35% acesso + 35% frota + 30% fornecedor. Acesso = limitar 100−km até rodovia ×12; frota = limitar veículos livres até 150 km/5 ×100; fornecedor = limitar 100−distância estimada/3. Favorável ≥70; intermediária ≥40. Não garante capacidade.',
);

add(
  '10. Governo, editais e referência de preços',
  table(
    [
      'Programa',
      'Item',
      'Quantidade',
      'Qualidade mínima',
      'Teto unitário à abertura',
      'Materiais + frete reservado à abertura',
    ],
    infrastructurePrograms.map((p) => {
      const price = Math.round(cfg.basePrices[p.product] * cfg.competition.governmentBonus);
      return [
        p.name,
        p.product,
        `${num(p.quantity)} ${products[p.product].unit}`,
        p.quality,
        money(price),
        money(price * p.quantity + Math.max(250000, Math.round(price * p.quantity * 0.2))),
      ];
    }),
  ),
  `27 tesouros estaduais; somente praças piloto têm destinos municipais. Teto = referência ×${cfg.competition.governmentBonus}. Frete reservado = máximo de R$ 2.500 e 20% dos materiais. Até ${cfg.competition.maxOpenContracts} editais/UF, limitado também por piso(caixa livre/R$ 200 mil)+1; no máximo um novo a cada 12 h virtuais/UF. Disputa de ${cfg.competition.biddingHours} h; entrega até quatro dias desde abertura. Sem verba, não abre.`,
  'Pontuação: qualidade até 45; desconto até 25 (máximo ao descontar 25% do teto); prazo até 20; frete até dez. Maior pontuação válida vence; empate favorece anterior. Revalida estoque, qualidade, frota, frete e prazo. Pagamento no despacho, consumo na chegada; não cria ponte/escola com efeito funcional.',
  `Referência usa atacado executado em ${cfg.design.referenceWindowDays} dias, pelo menos três compradores, três vendedores e três pares. Calcula centro por par e centro entre pares (centro superior para quantidade par). Atualização no máximo diária, até ±${pct(cfg.design.referenceDailyChange)}. Sem diversidade, mantém abertura/referência anterior. Transferência própria/anúncio não entram; contratos abertos preservam termos.`,
);

add(
  '11. Dinheiro, obrigações e recuperação',
  table(
    ['Regra', 'Número / consequência'],
    [
      [
        'Conservação monetária',
        'Transferências entre contas existentes; estoque/patrimônio inaugural não prova fabricação histórica',
      ],
      ['Folha/motorista', 'Pagos aos consumidores; varejo recircula esse dinheiro às empresas'],
      [
        'Processamento/utilidades/manutenção/imóveis/equipamentos',
        'Pagos ao tesouro estadual aplicável',
      ],
      [
        'Falta de caixa para fixos',
        'Desliga operação e reconhece obrigação; pagamento posterior não duplica despesa',
      ],
      [
        'Suspensão',
        'Concluir jobs/treinamento; equipe zero; automação desligada; 10% da manutenção',
      ],
      [
        'Crédito',
        `Mínimo R$ 1 mil; teto técnico R$ 10 milhões; até ${pct(cfg.design.collateralRatio)} dos ativos fixos menos principal existente`,
      ],
      [
        'Verba de crédito estadual',
        `${pct(cfg.design.treasuryCreditShare)} do caixa/carteira, descontando créditos concedidos e reservas`,
      ],
      [
        'Custo e prazo',
        `${pct(cfg.design.loanFee)} única na contratação; ${cfg.design.loanDays} dias de principal, sem juros compostos`,
      ],
      [
        'Exemplo',
        'Principal R$ 100 mil → taxa R$ 2 mil → caixa líquido R$ 98 mil e passivo de R$ 100 mil',
      ],
      [
        'Amortização',
        'Indicativa teto(principal/30); cobrança acumulada piso(principal × dias/30)−reembolsado; ajusta centavos',
      ],
      [
        'Vencimento',
        'Principal continua devido; novo crédito bloqueado com empréstimo pendente após 30 dias; sem execução automática',
      ],
      [
        'Venda de veículo',
        '65% do custo de aquisição; exige livre, verba estadual e garantia remanescente; diferença é perda',
      ],
      [
        'Depreciação/dividendos',
        'Sem regra completa de vida útil/reposição/dividendos; CAPEX e principal não são receita operacional',
      ],
    ],
  ),
  'Reserva de pedido marca caixa indisponível sem mover para outra conta; libera no aceite/cancelamento/expiração. Pausa, suspensão, liquidação de estoque e empréstimo são ações distintas. Não há resgate por emissão de saldo/material.',
);

add(
  '12. Bots, observação e snapshot',
  table(
    ['Heurística / observação', 'Número / significado'],
    [
      [
        'Participantes',
        '8 bots antigos +30 novos; regional/quality/value; mesmos comandos humanos',
      ],
      [
        'Preço inicial de oferta por estoque',
        'Custo ×(1,12 + escassez ×0,18); escassez relativa a três dias de demanda',
      ],
      [
        'Ajuste posterior por fixos',
        '(Custo + parcela operacional) ×1,10 value ou ×1,18 demais; não reduz a oferta anterior nesse passo',
      ],
      [
        'Varejo do bot',
        '(Custo + fixos/máximo de 100 e cinco vezes demanda recente) ×1,25 quality ou ×1,14 demais',
      ],
      [
        'Negociação',
        'Piso 1,08 × custo; tenta até quatro fornecedores; prazo padrão três dias; comprador espera ao menos 60 s reais antes de avaliar',
      ],
      [
        'Lance público',
        'Teto ×0,94 value /0,99 quality /0,97 regional, menos 2% por derrota até 12%; piso com fixos e fator 1,08',
      ],
      [
        'Recuperação',
        'Histórico público de 14 dias; estima 20% da demanda/concorrente; exige contribuição acima de 15% dos fixos e caixa para quatro lotes +sete dias +atrasados',
      ],
      ['Educação', 'Caixa para treinamento +15 dias de fixos; até nível cinco'],
      [
        'Expansão geral',
        `Até cinco unidades; intervalo mínimo um dia; aquisição +equipamento +${cfg.operations.expansionReserveDays} dias de custos protegidos`,
      ],
      ['Mercado', 'Retém 33.000 amostras multidimensionais, não 33.000 dias'],
      [
        'Consumo/reposição/bots/salários',
        'Retém 20.000 consumos; 5.000 reposições; 1.000 ações de bot; 104 observações salariais semanais',
      ],
      [
        'API de observação',
        'Visão comum contém 220 amostras; endpoints históricos usam limites de 1.000/2.000',
      ],
      ['Tempo offline', 'Até 5.000 eventos/chamada; API tenta tick a cada dois segundos reais'],
      [
        'HHI',
        'Σ participação² ×10.000; janela de faturamento de sete dias; agregado não é concentração de um item',
      ],
      [
        'Atendimento',
        'Vendido/desejado nas observações disponíveis; retenção pode encurtar a janela',
      ],
    ],
  ),
  table(
    ['Medida observada', 'Valor'],
    [
      ['Dinheiro total entre contas', money(health.all)],
      ['Caixa das famílias', money(health.families)],
      ['Caixa público', money(health.governments)],
      ['Caixa privado', money(health.privateCash)],
      ['Obrigações não pagas', money(health.obligations)],
      ['Giro comercial em sete dias', money(health.turnover)],
      ['HHI agregado', health.hhi === null ? 'Sem vendas' : num(health.hhi)],
      ['Unidades habilitadas / suspensas', `${health.active} / ${health.mothballed}`],
      [
        'Remessas totais / pendentes',
        `${w.shipments.length} / ${w.shipments.filter((s) => !s.delivered).length}`,
      ],
      [
        'Jobs totais / pendentes',
        `${w.jobs.length} / ${w.jobs.filter((j) => !j.completed).length}`,
      ],
    ],
  ),
  table(
    [
      'Item',
      'Estoque físico',
      'Em trânsito',
      'Saída em produção',
      'Ofertado livre',
      'Preço anunciado médio',
      'Atacado registrado',
      'Varejo registrado',
      'Consumo público acumulado',
    ],
    audit.items.map((p) => [
      p.name,
      `${num(p.stock)} ${p.unit}`,
      num(p.inTransit),
      num(p.inProduction),
      num(p.offered),
      p.quotedPrice === null ? 'Sem oferta' : money(p.quotedPrice),
      num(p.wholesaleSold),
      num(p.retailSold),
      num(p.publicConsumed),
    ]),
  ),
  'Atacado pode revender a mesma mercadoria várias vezes, sem consumo final. Ledger, consumo público e históricos móveis têm janelas/semânticas distintas. Não somar t, kg e embalagens. Estoque em produção já consumiu entradas e não deve ser contado duas vezes.',
  `Diferenças entre configuração analisada e template atual: **${configChanges.length}**. Ver caminhos/valores no JSON. Catálogo físico e canais ainda vêm do código e não possuem isolamento integral por season.`,
  table(
    ['Caminho divergente', 'Abertura do código', 'Season analisada', 'Uso identificado'],
    configChanges.map((change) => [
      change.path,
      JSON.stringify(change.opening) ?? 'Ausente',
      JSON.stringify(change.saved) ?? 'Ausente',
      change.path.includes('infrastructureShare') ||
      change.path.includes('infrastructureMaxQuantity') ||
      change.path.includes('infrastructureMinQuality')
        ? 'Campo legado salvo, sem consumidor no motor atual; não confundir com regra vigente de edital'
        : change.path.endsWith('playableLaborShare')
          ? 'Declarado sem controle de contratação identificado'
          : 'Conferir fonte/consumidor antes de comparar seasons',
    ]),
  ),
);

add(
  '13. Todos os fluxos incompletos identificados',
  `Inventário de **${mechanicsGaps.length} fluxos/limites**. Ausente = não implementado; abstração = representação simplificada; parcial = existe parte operacional; divergência = regras/estimativas precisam ser alinhadas; não demonstrado = falta evidência. Não são ${mechanicsGaps.length} bugs equivalentes nem autorização para implementar tudo.`,
  table(
    ['ID / fluxo', 'Estado', 'Falta e consequência', 'Próxima ação concreta'],
    mechanicsGaps.map((g) => [
      `${g.id} / ${g.area}`,
      g.status,
      `${g.missing} ${g.impact}`,
      g.nextStep,
    ]),
  ),
  'Fontes específicas por lacuna constam no JSON anexo, com arquivo/símbolo. Prioridade: semente/partida (F01–F02), leite/farelo (F05–F07), menor escala viável, reserva mineral (F09–F10), demanda executável (F23–F25) e versionamento integral (F32). Não adicionar itens para esconder esses problemas.',
  'Fusões, cidade e renderização 3D obrigatória são exclusões do projeto; não entram como pendência de implementação.',
);

add(
  '14. Fontes, limites e reprodução',
  `Configuração SHA-256: \`${hash(cfg)}\`. Snapshot SHA-256: \`${before}\`. O anexo enumera **${literals.length} ocorrências numéricas literais** em **${sources.length} arquivos de regras**, com arquivo, linha, valor e contexto. Inclui limites técnicos/índices; não atribui significado econômico a cada zero do código. Configuração integral e valores derivados também estão no JSON.`,
  `Anexos: \`${outputRoot}/report.json\` (configuração, custos, origens, snapshot resumido, lacunas/fontes); \`${outputRoot}/numeric-register.csv\` (registro bruto dos números); \`${outputRoot}/report.md\` (relatório). Os hashes indicam a versão lida. Abertura e mundo salvo ficam em pastas separadas para não sobrescrever a evidência um do outro. São artefatos locais, sem publicação.`,
  'A conexão SQLite é somente leitura e faz SELECT do estado, sem store, migração, tick ou comando no mundo. A única produção explicativa é em cópia isolada da abertura. A análise verifica que o snapshot em memória não mudou. Não foi rodada outra season de 30/90 dias nem consultado preço externo.',
  `Contexto/triagem do laboratório: ${labContextAvailable ? 'context.json disponível' : 'context.json ausente'}; ${labReviewAvailable ? 'review.json disponível' : 'review.json ausente'} nesta coleta. Esta análise usa regras e snapshot diretamente, sem iniciar watcher/captura/simulação adicional. Evidência antiga de UI não prova vigência de parâmetro econômico.`,
  '```powershell\nnpm run mechanics:report -- --world=.runtime/world.sqlite --write-doc\nnpm run resources:check\n```',
  'Sem `--world`, analisa somente abertura isolada; sem `--write-doc`, grava apenas em `.runtime/mechanics`. O flag grava `docs/product/MECHANICS-REPORT.md`. O snapshot histórico não pode ser reproduzido lendo um banco que já avançou: preservar revisão/hash.',
  'Ver [catálogo de fornecedores](RESOURCE-CATALOG.md), [padrão matemático](RESOURCE-STANDARD.md), [ficha de admissão](RESOURCE-TEMPLATE.md), [economia](ECONOMY.md) e [bancada](../design/DEVELOPMENT-LAB.md).',
);

if (hash(w) !== before)
  throw new Error('A análise alterou o snapshot em memória. Relatório não aprovado.');
const dir = resolve(outputRoot);
mkdirSync(dir, { recursive: true });
const markdown = await format(sections.join('\n\n'), {
  ...(await resolveConfig(resolve('docs/product/MECHANICS-REPORT.md'))),
  parser: 'markdown',
});
const data = {
  observedAt: new Date(w.updatedAt).toISOString(),
  source: worldArg ? 'saved-world-read-only' : 'opening-template',
  seasonId: w.season.id,
  revision: w.revision,
  snapshotHash: before,
  configHash: hash(cfg),
  sources,
  labContextAvailable,
  labReviewAvailable,
  config: cfg,
  configChanges,
  products,
  householdProducts,
  infrastructurePrograms,
  materialBoundaries,
  audit,
  health,
  initialStocks,
  seedHoldings,
  fixedCosts,
  demonstrationAllocation: {
    note: 'Cópia da abertura; soja à referência, utilidades/SP, anúncios da abertura',
    cost: oilJob.cost,
    quantities: oilJob.output,
    outputCosts: oilJob.outputCosts,
  },
  incompleteFlows: mechanicsGaps,
  numericLiterals: literals,
};
writeFileSync(resolve(dir, 'report.json'), JSON.stringify(data, null, 2) + '\n');
writeFileSync(resolve(dir, 'report.md'), markdown);
const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
writeFileSync(
  resolve(dir, 'numeric-register.csv'),
  '\uFEFF' +
    [
      ['arquivo', 'linha', 'literal', 'valor', 'contexto'].map(cell).join(';'),
      ...literals.map((n) => [n.file, n.line, n.literal, n.value, n.context].map(cell).join(';')),
    ].join('\r\n'),
);
if (args.includes('--write-doc'))
  writeFileSync(resolve('docs/product/MECHANICS-REPORT.md'), markdown);
console.log(
  JSON.stringify(
    {
      report: resolve(dir, 'report.md'),
      json: resolve(dir, 'report.json'),
      numericRegister: resolve(dir, 'numeric-register.csv'),
      revision: w.revision,
      unchangedInMemory: true,
      source: data.source,
      items: audit.items.length,
      recipes: audit.recipes.length,
      incompleteFlows: mechanicsGaps.length,
      numericLiterals: literals.length,
      configChanges: configChanges.length,
    },
    null,
    2,
  ),
);
