import { ECONOMIC_INTERVAL, products, TIME_SCALE, type ProductId, type World } from './model';
import { householdProducts, infrastructurePrograms } from './channels';
import { GAME_DAY, availableStock, productionCapacity } from './operations';
import { operatingCosts, productionCharges } from './metrics';
import { materialBoundaries, type MaterialBoundary } from './resource-policy';

export interface ResourceIssue {
  severity: 'error' | 'warning';
  code: string;
  subject: string;
  detail: string;
}
export interface AuditPolicy {
  boundaries: Record<string, MaterialBoundary>;
  household: readonly ProductId[];
  programs: typeof infrastructurePrograms;
}
const defaultPolicy: AuditPolicy = {
  boundaries: materialBoundaries,
  household: householdProducts,
  programs: infrastructurePrograms,
};
const ids = Object.keys(products) as ProductId[];
const entries = (q: Partial<Record<ProductId, number>>) =>
  Object.entries(q) as [ProductId, number][];
const positive = (n: number) => Number.isFinite(n) && n > 0;
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;

/** Leitura pura. Não avança tempo, não consulta rede e não cria estoque nem dinheiro. */
export function auditResources(w: World, policy: AuditPolicy = defaultPolicy) {
  const cfg = w.season.config;
  const issues: ResourceIssue[] = [];
  const add = (
    severity: ResourceIssue['severity'],
    code: string,
    subject: string,
    detail: string,
  ) => issues.push({ severity, code, subject, detail });
  const error = (code: string, subject: string, detail: string) =>
    add('error', code, subject, detail);
  const warning = (code: string, subject: string, detail: string) =>
    add('warning', code, subject, detail);
  for (const id of ids) {
    const p = products[id];
    if (!p.name || !p.unit || !positive(p.massT) || !positive(p.volumeM3))
      error('PRODUCT_DIMENSIONS', id, 'Nome, unidade, massa e volume positivos são obrigatórios.');
    if (!Number.isSafeInteger(cfg.basePrices[id]) || cfg.basePrices[id] <= 0)
      error('BASE_PRICE', id, 'Preço de abertura deve ser inteiro positivo em centavos.');
    const band = cfg.priceBands[id];
    if (!band || !positive(band.low) || band.high < band.low || !band.note || !band.source)
      error('PRICE_PROVENANCE', id, 'Faltam faixa, origem e justificativa da calibração.');
    const demand = cfg.consumption[id];
    if (demand !== undefined && !nonnegative(demand))
      error('CONSUMPTION', id, 'Consumo precisa ser finito e não negativo.');
    if (demand && !policy.household.includes(id))
      error(
        'CHANNEL_NOT_EXECUTED',
        id,
        'Há consumo configurado, mas o motor não executa varejo deste item.',
      );
  }
  for (const id of policy.household) {
    if (!products[id] || !positive(cfg.consumption[id] ?? 0))
      error(
        'HOUSEHOLD_CHANNEL',
        id,
        'Canal familiar precisa de item conhecido e consumo positivo.',
      );
  }
  for (const p of policy.programs) {
    if (
      !products[p.product] ||
      !Number.isSafeInteger(p.quantity) ||
      p.quantity <= 0 ||
      !Number.isInteger(p.quality) ||
      p.quality < 0 ||
      p.quality > 100
    )
      error(
        'PUBLIC_CHANNEL',
        p.name,
        'Programa precisa de produto, quantidade e qualidade válidos.',
      );
  }
  const seen = new Set<string>();
  for (const r of cfg.recipes) {
    if (!r.id || seen.has(r.id)) error('RECIPE_ID', r.id, 'Identificador ausente ou duplicado.');
    seen.add(r.id);
    if (!['industry', 'farm', 'mine'].includes(r.category))
      error('RECIPE_CATEGORY', r.id, 'Receita exige categoria produtora executada pelo motor.');
    if (
      !Number.isSafeInteger(r.cost) ||
      r.cost < 0 ||
      !positive(r.duration) ||
      !nonnegative(r.energyKwh) ||
      !nonnegative(r.waterM3)
    )
      error(
        'RECIPE_PARAMETERS',
        r.id,
        'Custo inteiro, duração positiva e utilidades não negativas são obrigatórios.',
      );
    if (!Object.keys(r.output).length) error('EMPTY_OUTPUT', r.id, 'Receita sem saída.');
    for (const [id, quantity] of [...entries(r.input), ...entries(r.output)]) {
      if (!products[id]) error('UNKNOWN_PRODUCT', r.id, `Produto desconhecido: ${id}.`);
      if (!Number.isSafeInteger(quantity) || quantity <= 0)
        error(
          'RECIPE_QUANTITY',
          r.id,
          `Quantidade de ${id} deve ser inteira positiva na unidade comercial.`,
        );
    }
    const profile = cfg.operations.profiles[r.id];
    if (
      !profile ||
      !Number.isSafeInteger(profile.workers) ||
      profile.workers < 1 ||
      profile.workers > 1000 ||
      !positive(profile.areaM2)
    )
      error(
        'CAPACITY_PROFILE',
        r.id,
        'Perfil precisa de 1–1.000 trabalhadores e área positiva por linha.',
      );
    const producers = w.establishments.filter(
      (e) => e.specialization === r.id && e.category === r.category,
    );
    if (!producers.some((e) => w.companies.some((c) => c.id === e.companyId && c.bot)))
      error('BOT_PRODUCER', r.id, 'Não existe produtor bot desta receita no cenário.');
    const boundary = policy.boundaries[r.id];
    if (
      !boundary ||
      !['extraction', 'transformation', 'biological'].includes(boundary.kind) ||
      !nonnegative(boundary.externalMassT) ||
      !nonnegative(boundary.residualMassT) ||
      !boundary.note
    )
      error(
        'MATERIAL_BOUNDARY',
        r.id,
        'Declare origem externa, residual e limite de representação da massa.',
      );
    else if ([...entries(r.input), ...entries(r.output)].every(([id]) => products[id])) {
      const inputMass = entries(r.input).reduce((n, [id, q]) => n + products[id].massT * q, 0);
      const outputMass = entries(r.output).reduce((n, [id, q]) => n + products[id].massT * q, 0);
      if (Math.abs(inputMass + boundary.externalMassT - outputMass - boundary.residualMassT) > 1e-8)
        error(
          'MASS_BALANCE',
          r.id,
          'Entrada + origem externa deve igualar saída + residual declarado.',
        );
      if (boundary.kind === 'transformation' && boundary.externalMassT > 0)
        error(
          'UNMODELED_TRANSFORMATION_INPUT',
          r.id,
          'Transformação exige cadastrar a origem física adicional.',
        );
      if ((r.category === 'mine') !== (boundary.kind === 'extraction'))
        error(
          'EXTRACTION_CATEGORY',
          r.id,
          'Extração e categoria mine precisam coincidir para consumir reserva.',
        );
      if (r.category === 'mine' && entries(r.output).reduce((n, [, q]) => n + q, 0) !== 1)
        error(
          'RESERVE_UNIT',
          r.id,
          'O motor debita uma unidade de reserva por ciclo; revise a semântica antes de mudar o rendimento mineral.',
        );
      if (boundary.kind !== 'extraction') warning('AGGREGATE_BOUNDARY', r.id, boundary.note);
    }
  }
  // Erros numéricos/referenciais impedem cálculos; o diagnóstico permanece serializável.
  if (issues.some((i) => i.severity === 'error'))
    return {
      issues,
      items: [],
      recipes: [],
      jointProduction: [],
      structurallyValid: false,
      balanced: false as const,
    };

  const inTransit = (id: ProductId) =>
    w.shipments.filter((s) => !s.delivered && s.product === id).reduce((n, s) => n + s.quantity, 0);
  const inProduction = (id: ProductId) =>
    w.jobs
      .filter((j) => !j.completed)
      .reduce(
        (n, j) =>
          n +
          (j.output?.[id] ??
            (cfg.recipes.find((r) => r.id === j.recipeId)?.output[id] ?? 0) * j.cycles),
        0,
      );

  const closure = (initial: Set<ProductId>) => {
    const result = new Set(initial);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of cfg.recipes) {
        if (!entries(r.input).every(([id]) => result.has(id))) continue;
        if (
          r.category === 'mine' &&
          !w.establishments.some((e) => e.category === 'mine' && (e.reserve ?? 0) > 0)
        )
          continue;
        for (const [id] of entries(r.output))
          if (!result.has(id)) {
            result.add(id);
            changed = true;
          }
      }
    }
    return result;
  };
  const opening = new Set(
    ids.filter(
      (id) =>
        w.establishments.some((e) => (e.inventory[id] ?? 0) > 0) ||
        inTransit(id) > 0 ||
        inProduction(id) > 0,
    ),
  );
  const reachable = closure(opening),
    independent = closure(new Set());
  const final = new Set<ProductId>([
    ...policy.household.filter((id) => (cfg.consumption[id] ?? 0) > 0),
    ...policy.programs.map((p) => p.product),
  ]);
  const finalPath = (start: ProductId): ProductId[] | null => {
    const queue: ProductId[][] = [[start]],
      visited = new Set<ProductId>([start]);
    while (queue.length) {
      const path = queue.shift()!,
        id = path.at(-1)!;
      if (final.has(id)) return path;
      for (const r of cfg.recipes.filter((r) => (r.input[id] ?? 0) > (r.output[id] ?? 0)))
        for (const [next] of entries(r.output))
          if (!visited.has(next)) {
            visited.add(next);
            queue.push([...path, next]);
          }
    }
    return null;
  };
  const items = ids.map((id) => {
    const p = products[id],
      madeBy = cfg.recipes.filter((r) => (r.output[id] ?? 0) > 0),
      path = finalPath(id);
    if (!madeBy.length) error('NO_RECIPE', id, 'Não há extração/produção para repor este item.');
    if (!reachable.has(id))
      error(
        'NO_BOOTSTRAP',
        id,
        'Cadeia sem partida: falta estoque inicial ou origem produtiva alcançável.',
      );
    if (!path)
      error(
        'NO_FINAL_SINK',
        id,
        'Nenhum caminho de consumo líquido leva a famílias ou programa público.',
      );
    if (!independent.has(id))
      warning(
        'OPENING_DEPENDENCY',
        id,
        'A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.',
      );
    if (path?.every((next) => !policy.household.includes(next)))
      warning('PUBLIC_ONLY', id, 'Consumo final depende de orçamento/contratação pública.');
    const offers = w.offers
      .filter((o) => o.product === id)
      .map((o) => ({
        ...o,
        quantity: availableStock(
          w,
          w.establishments.find((e) => e.id === o.establishmentId)!,
          id,
        ),
      }))
      .filter((o) => o.quantity > 0);
    const offered = offers.reduce((n, o) => n + o.quantity, 0);
    const producers = w.establishments.filter((e) => madeBy.some((r) => e.specialization === r.id));
    return {
      id,
      name: p.name,
      unit: p.unit,
      massKg: p.massT * 1000,
      volumeM3: p.volumeM3,
      openingPrice: cfg.basePrices[id],
      priceBand: cfg.priceBands[id],
      madeBy: madeBy.map((r) => r.id),
      usedBy: cfg.recipes.filter((r) => (r.input[id] ?? 0) > 0).map((r) => r.id),
      householdMonthlyPerPerson: cfg.consumption[id] ?? 0,
      publicPrograms: policy.programs.filter((r) => r.product === id).map((r) => r.name),
      finalPath: path,
      bootstrapWithoutStock: independent.has(id),
      stock: w.establishments.reduce((n, e) => n + (e.inventory[id] ?? 0), 0),
      offered,
      inTransit: inTransit(id),
      inProduction: inProduction(id),
      quotedPrice: offered
        ? Math.round(offers.reduce((n, o) => n + o.price * o.quantity, 0) / offered)
        : null,
      suppliers: new Set(
        offers.map((o) => w.establishments.find((e) => e.id === o.establishmentId)!.companyId),
      ).size,
      sources: offers.map((o) => {
        const e = w.establishments.find((e) => e.id === o.establishmentId)!;
        const site = w.properties.find((p) => p.id === e.propertyId)!;
        return {
          establishmentId: e.id,
          name: e.name,
          companyId: e.companyId,
          city: site.city,
          state: site.state,
          quantity: o.quantity,
          price: o.price,
        };
      }),
      producers: producers.map((e) => ({
        id: e.id,
        name: e.name,
        companyId: e.companyId,
        state: w.properties.find((p) => p.id === e.propertyId)!.state,
        enabled: e.enabled,
        reserve: e.reserve ?? null,
        lines: productionCapacity(
          w,
          e,
          madeBy.find((r) => r.id === e.specialization)!,
        ).lines,
      })),
      wholesaleSold: w.ledger
        .filter((l) => l.product === id && l.channel === 'wholesale')
        .reduce((n, l) => n + (l.quantity ?? 0), 0),
      retailSold: w.ledger
        .filter((l) => l.product === id && l.channel === 'retail')
        .reduce((n, l) => n + (l.quantity ?? 0), 0),
      publicConsumed: w.consumedMaterials[id] ?? 0,
      maxPerStandardTruck: Math.min(
        Math.floor((30 + 1e-9) / p.massT),
        Math.floor((85 + 1e-9) / p.volumeM3),
      ),
    };
  });
  const recipes = cfg.recipes.map((r) => {
    const profile = cfg.operations.profiles[r.id];
    // Planta comparável: uma linha, SP, salário no índice 1. Não reusa patrimônio/equipe do laboratório.
    const property = {
      ...w.properties[0],
      id: 'audit-site',
      state: 'SP',
      category: r.category,
      area: profile.areaM2,
    };
    const plant = {
      ...w.establishments[0],
      id: 'audit-plant',
      propertyId: property.id,
      category: r.category,
      employees: profile.workers,
      installed: true,
      equipmentLines: 1,
      enabled: true,
      mothballed: false,
    };
    const standard = { ...w, properties: [property], establishments: [plant], stateWages: {} };
    const charges = productionCharges(standard, plant, r.id, 1);
    const fixed = operatingCosts(standard, plant);
    // O motor cobra cada componente arredondado em 12 ticks/dia.
    const fixedPerDay = [fixed.payroll, fixed.maintenance, fixed.energy, fixed.water].reduce(
      (n, cost) => n + Math.round(cost / 12) * 12,
      0,
    );
    const materials = entries(r.input).reduce((n, [id, q]) => n + cfg.basePrices[id] * q, 0);
    const outputValue = entries(r.output).reduce((n, [id, q]) => n + cfg.basePrices[id] * q, 0);
    const variableCost = materials + charges.total;
    const contribution = outputValue - variableCost;
    const cyclesPerDay = GAME_DAY / (Math.ceil(r.duration / ECONOMIC_INTERVAL) * ECONOMIC_INTERVAL);
    const resultPerDay = contribution * cyclesPerDay - fixedPerDay;
    if (resultPerDay < 0)
      warning(
        'NEGATIVE_STANDARD_RESULT',
        r.id,
        'Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.',
      );
    const selfSeed = entries(r.input).filter(([id]) => (r.output[id] ?? 0) > 0);
    if (selfSeed.length)
      warning(
        'SELF_SEED',
        r.id,
        'Parte da saída precisa ser retida; venda manual pode extinguir a semente.',
      );
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      input: r.input,
      output: r.output,
      hours: (r.duration * TIME_SCALE) / 3600000,
      workers: profile.workers,
      areaM2: profile.areaM2,
      energyKwh: r.energyKwh,
      waterM3: r.waterM3,
      charges,
      materials,
      variableCost,
      outputValue,
      contribution,
      fixedPerDay,
      cyclesPerDay,
      resultPerDay,
      breakEvenUtilization: contribution > 0 ? fixedPerDay / (contribution * cyclesPerDay) : null,
      boundary: policy.boundaries[r.id],
      selfSeed: Object.fromEntries(selfSeed),
      inputMassKg: entries(r.input).reduce((n, [id, q]) => n + products[id].massT * q * 1000, 0),
      outputMassKg: entries(r.output).reduce((n, [id, q]) => n + products[id].massT * q * 1000, 0),
    };
  });
  const jointProduction = cfg.recipes.flatMap((r) =>
    entries(r.output).flatMap(([primary, quantity]) => {
      if (!(cfg.consumption[primary] ?? 0)) return [];
      return entries(r.output)
        .filter(([coproduct]) => coproduct !== primary)
        .flatMap(([coproduct, coproductQuantity]) => {
          const consumers = cfg.recipes.filter(
            (next) => (next.input[coproduct] ?? 0) > (next.output[coproduct] ?? 0),
          );
          if (consumers.length !== 1) return [];
          const next = consumers[0];
          return entries(next.output)
            .filter(([id]) => (cfg.consumption[id] ?? 0) > 0)
            .map(([finalProduct, finalQuantity]) => {
              const coproductPerPrimary = coproductQuantity / quantity;
              const linkedOutputPerPrimary =
                (coproductPerPrimary / next.input[coproduct]!) * finalQuantity;
              const householdRatio = cfg.consumption[finalProduct]! / cfg.consumption[primary]!;
              return {
                recipeId: r.id,
                primary,
                coproduct,
                downstreamRecipe: next.id,
                finalProduct,
                coproductPerPrimary,
                linkedOutputPerPrimary,
                householdRatio,
                surplusFraction: Math.max(0, 1 - householdRatio / linkedOutputPerPrimary),
              };
            });
        });
    }),
  );
  for (const link of jointProduction.filter((link) => link.surplusFraction > 0))
    warning(
      'JOINT_DEMAND_MISMATCH',
      link.coproduct,
      'A proporção dos consumos familiares não absorve todo o coproduto se esta cadeia for a única destinação; medir também compras públicas e estoques.',
    );
  warning(
    'GENERIC_RESERVE',
    'mine',
    'A reserva não identifica mineral. O comando manual aceita receitas da mesma categoria sem exigir especialização.',
  );
  warning(
    'SCHEMA_NOT_FROZEN',
    'season',
    'Massa/volume dos produtos e canais de consumo ainda vêm do código; só os parâmetros/receitas estão na configuração persistida. Versionar o esquema antes de ampliá-lo.',
  );
  return {
    issues,
    items,
    recipes,
    jointProduction,
    structurallyValid: !issues.some((i) => i.severity === 'error'),
    balanced: false as const,
  };
}

export type ResourceAudit = ReturnType<typeof auditResources>;

export function renderResourceCatalog(report: ResourceAudit, source: string) {
  const brl = (n: number) =>
    (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  const quantities = (q: Partial<Record<ProductId, number>>) =>
    entries(q)
      .map(([id, n]) => `${num(n)} ${products[id].unit} ${products[id].name}`)
      .join(' + ') || 'Sem item de entrada';
  const lines = [
    '# Catálogo verificável de recursos',
    '',
    `Fonte: ${source}. Gerado por \`npm run resources:catalog\`. Não editar tabelas manualmente.`,
    '',
    'Parâmetros de jogo; nenhuma cotação externa foi verificada. Valores de abertura não são ofertas garantidas. Estoques são a observação desta fonte, não reposição gratuita. Veja [padrão matemático e admissão](RESOURCE-STANDARD.md).',
    '',
    `Estrutura: **${report.structurallyValid ? 'válida' : 'com erros'}**. Equilíbrio: **não demonstrado**. ${report.items.length} itens / ${report.recipes.length} receitas.`,
    '',
    '## Itens, obtenção e destinos',
    '',
    '| Item / ID | Unidade; kg; m³ | Abertura | Receita de origem | Uso produtivo | Destino final alcançável | Estoque; ofertado; fornecedores |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
    ...report.items.map(
      (p) =>
        `| ${p.name} / \`${p.id}\` | ${p.unit}; ${num(p.massKg)}; ${num(p.volumeM3)} | ${brl(p.openingPrice)} | ${p.madeBy.join(', ')} | ${p.usedBy.join(', ') || '—'} | ${p.finalPath?.join(' → ') ?? 'SEM DESTINO'} | ${num(p.stock)}; ${num(p.offered)}; ${p.suppliers} |`,
    ),
    '',
    'Todos os itens podem ser anunciados no atacado e negociados/transferidos com estoque, caixa, espaço e frota. Somente os cinco itens nos canais familiares são efetivamente consumidos pelas lojas. Aço é consumido pelos editais; farelo depende da produção de leite. Um caminho no grafo não garante demanda, margem, rota disponível ou compra.',
    '',
    '## Fornecedores observados nesta fonte',
    '',
    '| Produto | Unidade anunciante | Cidade/UF | Estoque livre anunciado | Preço por unidade, antes do frete |',
    '| --- | --- | --- | ---: | ---: |',
    ...report.items.flatMap((p) =>
      p.sources.map(
        (s) =>
          `| ${p.name} | ${s.name} / ${s.establishmentId} | ${s.city}/${s.state} | ${num(s.quantity)} ${p.unit} | ${brl(s.price)} |`,
      ),
    ),
    '',
    'Lista de anúncios com estoque livre naquele instante; pode incluir unidades pausadas. Transferência própria também pode usar estoque sem anúncio. Insumos/sementes protegidos pela automação não são oferta livre. A contratação revalida tudo.',
    '',
    '## Receitas por ciclo',
    '',
    '| Receita | Entradas → saídas brutas | Horas virtuais | Pessoas; m² por linha | kWh; m³ água | Processamento | Energia + água/SP |',
    '| --- | --- | ---: | --- | --- | ---: | ---: |',
    ...report.recipes.map(
      (r) =>
        `| \`${r.id}\` | ${quantities(r.input)} → ${quantities(r.output)} | ${num(r.hours)} | ${r.workers}; ${num(r.areaM2)} | ${num(r.energyKwh)}; ${num(r.waterM3)} | ${brl(r.charges.processing)} | ${brl(r.charges.energy + r.charges.water)} |`,
    ),
    '',
    'Horas são do jogo: dividir por 120 para tempo real do laboratório. Receitas agrícolas com autorreposição retêm a entrada do próximo ciclo; a saída bruta não é toda excedente vendável. Reserva mineral cai uma unidade por ciclo, antes de produzir.',
    '',
    '## Comparação econômica padronizada',
    '',
    'Uma linha instalada em SP, equipe mínima, índice salarial 1, ciclos unitários automáticos, custos/receitas aos preços de abertura e venda de toda saída. Sem frete, CAPEX, financiamento, estoque ocioso, escassez, limite de demanda ou caixa. A coluna de resultado é sensibilidade matemática, não lucro esperado. O custo da semente retida é contabilizado como entrada e sua saída bruta como valor: não representa uma venda dessa semente.',
    '',
    '| Receita | Materiais | Variável/ciclo, com utilidades | Valor bruto/ciclo | Contribuição/ciclo | Fixos/dia | Ciclos/dia automáticos | Resultado/dia | Utilização de equilíbrio |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.recipes.map(
      (r) =>
        `| \`${r.id}\` | ${brl(r.materials)} | ${brl(r.variableCost)} | ${brl(r.outputValue)} | ${brl(r.contribution)} | ${brl(r.fixedPerDay)} | ${num(r.cyclesPerDay)} | ${brl(r.resultPerDay)} | ${r.breakEvenUtilization === null ? 'inviável' : num(r.breakEvenUtilization * 100) + '%'} |`,
    ),
    '',
    'Cadência automática: 12 / teto(duração em horas / 2) ciclos por dia para esta hipótese de uma linha e um ciclo por lote; não usar esse número para lotes/linhas diferentes. Utilização acima de 100% exige mudar a hipótese/preço/custo; não é uma recomendação de aumentar produção sem compradores.',
    '',
    '## Consumo final e transporte',
    '',
    '| Item | Consumo familiar mensal por pessoa representada | Programas públicos | Máximo num caminhão 30 t / 85 m³ |',
    '| --- | ---: | --- | ---: |',
    ...report.items.map(
      (p) =>
        `| ${p.name} | ${num(p.householdMonthlyPerPerson)} ${p.unit} | ${p.publicPrograms.join('; ') || '—'} | ${num(p.maxPerStandardTruck)} ${p.unit} |`,
    ),
    '',
    'População representada = população configurada × participação de consumidores da season (abertura: 1%). Demanda diária é consumo mensal / 30; vendas ainda sofrem qualidade, elasticidade, calendário, capacidade e caixa. Programas exigem verba, qualidade e entrega: não são consumo diário fixo. Caminhão padrão é exemplo, não disponibilidade de frota.',
    '',
    '## Fronteiras materiais declaradas',
    '',
    '| Receita | Entrada física kg | Saída física kg | Origem externa agregada kg | Residual não rastreado kg | Limite |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...report.recipes.map(
      (r) =>
        `| ${r.id} | ${num(r.inputMassKg)} | ${num(r.outputMassKg)} | ${num(r.boundary.externalMassT * 1000)} | ${num(r.boundary.residualMassT * 1000)} | ${r.boundary.note} |`,
    ),
    '',
    'Água de serviço é paga em m³, não item de estoque. Estes termos explicitam a abstração atual e não demonstram conservação físico-química completa nem validam rendimento real. Não criar balanço fictício para aprovar conteúdo.',
    '',
    '## Proporção dos coprodutos e demanda',
    '',
    ...report.jointProduction.map(
      (link) =>
        `- ${link.recipeId}: cada unidade de ${link.primary} implica ${num(link.coproductPerPrimary)} unidades de ${link.coproduct}, capazes de gerar ${num(link.linkedOutputPerPrimary)} unidades de ${link.finalProduct}. Consumo familiar relativo: ${num(link.householdRatio)}. Excesso teórico do coproduto: ${num(link.surplusFraction * 100)}%, antes de compras públicas, estoques, outras origens e limites de operação.`,
    ),
    '',
    '## Diagnósticos',
    '',
    '| Nível | Código | Item/receita | Diagnóstico |',
    '| --- | --- | --- | --- |',
    ...report.issues.map((i) => `| ${i.severity} | ${i.code} | ${i.subject} | ${i.detail} |`),
    '',
  ];
  return lines.join('\n');
}
