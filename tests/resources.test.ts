import { describe, expect, it } from 'vitest';
import { auditResources } from '../packages/simulation/src/resource-audit';
import { materialBoundaries } from '../packages/simulation/src/resource-policy';
import {
  householdProducts,
  infrastructurePrograms,
  recycledProducts,
} from '../packages/simulation/src/channels';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute } from '../packages/simulation/src/engine';
import {
  ECONOMIC_INTERVAL,
  type ProductId,
  type Recipe,
  type World,
} from '../packages/simulation/src/model';
import { GAME_DAY } from '../packages/simulation/src/operations';

const NOW = Date.UTC(2026, 9, 27, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
const codes = (w: World) =>
  auditResources(w)
    .issues.filter((i) => i.severity === 'error')
    .map((i) => i.code);
function isolated() {
  const w = createWorld(NOW);
  w.nextEconomicAt = Infinity;
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  return w;
}
// Receita alternativa (reciclagem) roda na instalação da principal, lote a lote.
const producerOf = (w: World, recipe: Recipe, bot = true) =>
  w.establishments.find(
    (e) =>
      e.specialization === (recipe.alternativeOf ?? recipe.id) &&
      e.category === recipe.category &&
      (!bot || w.companies.find((c) => c.id === e.companyId)!.bot),
  )!;

describe('admissão de recursos', () => {
  it('audita sem mutação e distingue estrutura de equilíbrio', () => {
    const w = createWorld(NOW),
      before = structuredClone(w),
      report = auditResources(w);
    expect(w).toEqual(before);
    expect(report.structurallyValid).toBe(true);
    expect(report.balanced).toBe(false);
    expect(report.items).toHaveLength(20);
    expect(report.recipes).toHaveLength(14);
    // Sucata não tem receita: vem da coleta municipal dos utensílios vendidos.
    expect(
      report.items.every(
        (p) => (p.madeBy.length || recycledProducts.includes(p.id)) && p.finalPath?.length,
      ),
    ).toBe(true);
    expect(report.issues.some((i) => i.code === 'NEGATIVE_STANDARD_RESULT')).toBe(false);
    // Linha que não cobre os fixos é apontada como aviso, sem invalidar a estrutura.
    const loss = createWorld(NOW);
    loss.season.config.basePrices.rice = 1;
    const lossReport = auditResources(loss);
    expect(
      lossReport.issues.some(
        (i) => i.code === 'NEGATIVE_STANDARD_RESULT' && i.subject === 'rice-harvest',
      ),
    ).toBe(true);
    expect(lossReport.structurallyValid).toBe(true);
  });
  it('não confunde estoque de abertura com reposição produtiva', () => {
    const w = createWorld(NOW);
    w.season.config.recipes = w.season.config.recipes.filter((r) => r.id !== 'milk-production');
    expect(codes(w)).toContain('NO_RECIPE');
    expect(codes(w)).toContain('NO_FINAL_SINK'); // Ração perde seu único consumo líquido.
  });
  it('identifica dependência de semente e bloqueia cadeia sem partida', () => {
    const w = createWorld(NOW);
    expect(auditResources(w).items.find((p) => p.id === 'soySeed')!.bootstrapWithoutStock).toBe(
      false,
    );
    for (const e of w.establishments) e.inventory.soySeed = 0;
    expect(codes(w)).toContain('NO_BOOTSTRAP');
  });
  it('considera semente já comprometida em produção sem inventar sua chegada', () => {
    const w = isolated(),
      e = w.establishments.find((e) => e.specialization === 'rice-harvest')!;
    e.inventory.riceSeed = 100;
    for (const other of w.establishments.filter((other) => other.id !== e.id))
      other.inventory.riceSeed = 0;
    execute(
      w,
      e.companyId,
      { type: 'produce', establishmentId: e.id, recipeId: 'rice-harvest', cycles: 1 },
      NOW,
    );
    const report = auditResources(w);
    expect(report.issues.some((i) => i.code === 'NO_BOOTSTRAP' && i.subject === 'riceSeed')).toBe(
      false,
    );
    expect(report.items.find((p) => p.id === 'riceSeed')!.inProduction).toBe(110);
    expect(e.inventory.riceSeed).toBe(0);
  });
  it('mede pressão do farelo pelas receitas e consumos efetivos', () => {
    // Na temporada, o farelo vai à ração e a ração ao leite: nenhuma família compra o elo seguinte
    // direto, então não há pressão de coproduto a medir.
    const report = auditResources(createWorld(NOW));
    expect(report.jointProduction).toEqual([]);
    expect(report.issues.some((i) => i.code === 'JOINT_DEMAND_MISMATCH')).toBe(false);
    // Se as famílias comprassem ração, cada kg de óleo arrastaria 3,8 kg de farelo → 3,762 kg de ração.
    const w = createWorld(NOW);
    w.season.config.consumption.feed = 1;
    const linked = auditResources(w, {
      boundaries: materialBoundaries,
      household: [...householdProducts, 'feed'],
      programs: infrastructurePrograms,
      recycled: recycledProducts,
    });
    const link = linked.jointProduction[0];
    expect(link.coproduct).toBe('soymeal');
    expect(link.coproductPerPrimary).toBeCloseTo(3.8);
    expect(link.linkedOutputPerPrimary).toBeCloseTo(3.762);
    expect(link.householdRatio).toBeCloseTo(1.25);
    expect(link.surplusFraction).toBeCloseTo(1 - 1.25 / 3.762);
    expect(linked.issues.some((i) => i.code === 'JOINT_DEMAND_MISMATCH')).toBe(true);
  });
  it('não aceita consumo declarado sem execução no motor', () => {
    const w = createWorld(NOW);
    w.season.config.consumption.steel = 1;
    expect(codes(w)).toContain('CHANNEL_NOT_EXECUTED');
  });
  it('rejeita perfil ausente, receita duplicada e preço em fração de centavo', () => {
    const w = createWorld(NOW);
    delete w.season.config.operations.profiles['steel-bars'];
    w.season.config.recipes.push(structuredClone(w.season.config.recipes[0]));
    w.season.config.basePrices.iron = 0.5;
    expect(codes(w)).toEqual(
      expect.arrayContaining(['CAPACITY_PROFILE', 'RECIPE_ID', 'BASE_PRICE']),
    );
  });
  it('rejeita produto inexistente e quantidade incompatível com a unidade comercial', () => {
    const w = createWorld(NOW);
    // Massa aceita fração; unidade contada (caminhão) não.
    Object.assign(w.season.config.recipes[0].input, { unknown: 1, truckHeavy: 0.25 });
    expect(codes(w)).toEqual(expect.arrayContaining(['UNKNOWN_PRODUCT', 'RECIPE_QUANTITY']));
  });
  it('bloqueia alteração silenciosa do rendimento e fronteira ausente', () => {
    const w = createWorld(NOW);
    w.season.config.recipes[0].output.steel = 9;
    expect(codes(w)).toContain('MASS_BALANCE');
    const report = auditResources(createWorld(NOW), {
      boundaries: {},
      household: householdProducts,
      programs: infrastructurePrograms,
    });
    expect(report.issues.some((i) => i.code === 'MATERIAL_BOUNDARY')).toBe(true);
  });
  it('não permite esconder criação de massa numa transformação', () => {
    const boundaries = structuredClone(materialBoundaries);
    const w = createWorld(NOW);
    w.season.config.recipes[0].output.steel = 9;
    boundaries['steel-bars'].externalMassT = 1;
    const report = auditResources(w, {
      boundaries,
      household: householdProducts,
      programs: infrastructurePrograms,
    });
    expect(report.issues.some((i) => i.code === 'UNMODELED_TRANSFORMATION_INPUT')).toBe(true);
  });
  it('bloqueia receita sem concorrente produtor e consumo familiar sem taxa', () => {
    const w = createWorld(NOW);
    for (const e of w.establishments.filter((e) => e.specialization === 'coal-extraction'))
      e.specialization = 'iron-extraction';
    w.season.config.consumption.milk = 0;
    expect(codes(w)).toEqual(expect.arrayContaining(['BOT_PRODUCER', 'HOUSEHOLD_CHANNEL']));
  });
  it('usa horas virtuais, cadência dos ticks e custos do motor na comparação', () => {
    const report = auditResources(createWorld(NOW));
    const steel = report.recipes.find((r) => r.id === 'steel-bars')!;
    expect(steel.hours).toBe(4);
    expect(steel.cyclesPerDay).toBe(6);
    expect(steel.charges.total).toBe(79000);
    expect(steel.variableCost).toBe(251500);
    const rice = report.recipes.find((r) => r.id === 'rice-harvest')!;
    expect(rice.hours).toBe(96);
    expect(rice.cyclesPerDay).toBeCloseTo(1 / 4);
    expect(rice.breakEvenUtilization).toBeCloseTo(0.2083, 3);
  });
});

describe.each(createWorld(NOW).season.config.recipes)('produção e venda de $id', (recipe) => {
  it('consome entradas/reserva, entrega uma vez, aloca custos e vende cada saída com frete real do motor', () => {
    const w = isolated(),
      total = money(w);
    const e = producerOf(w, recipe);
    // Comércio é em unidades inteiras (t, kg, un): ciclos suficientes para cada saída render ao menos 1.
    const cycles = Math.max(1, ...Object.values(recipe.output).map((q) => Math.ceil(1 / q!)));
    // A alternativa (sucata) só roda com o insumo no pátio; o motor não o inventa.
    for (const [id, n] of Object.entries(recipe.input) as [ProductId, number][])
      e.inventory[id] = Math.max(e.inventory[id] ?? 0, n * cycles);
    const initial = { ...e.inventory },
      reserve = e.reserve;
    execute(
      w,
      e.companyId,
      { type: 'produce', establishmentId: e.id, recipeId: recipe.id, cycles },
      NOW,
    );
    for (const [id, n] of Object.entries(recipe.input))
      expect(e.inventory[id as ProductId]).toBe((initial[id as ProductId] ?? 0) - n! * cycles);
    if (recipe.category === 'mine') expect(e.reserve).toBe(reserve! - cycles);
    const job = w.jobs.at(-1)!;
    expect(Object.values(job.outputCosts!).reduce((n, q) => n + q!, 0)).toBe(job.cost);
    const reserved = { ...e.inventory };
    advance(w, job.finishesAt);
    for (const [id, n] of Object.entries(recipe.output))
      expect(e.inventory[id as ProductId]).toBe((reserved[id as ProductId] ?? 0) + n! * cycles);
    const produced = { ...e.inventory };
    advance(w, job.finishesAt);
    expect(e.inventory).toEqual(produced);
    const dest = w.establishments.find((e) => e.id === 'e-warehouse')!;
    for (const [product, made] of Object.entries(recipe.output) as [ProductId, number][]) {
      const quantity = Math.floor(made * cycles); // a fração produzida fica no estoque
      execute(
        w,
        e.companyId,
        {
          type: 'publishOffer',
          establishmentId: e.id,
          product,
          price: w.season.config.basePrices[product],
        },
        w.updatedAt,
      );
      const offer = w.offers.find((o) => o.establishmentId === e.id && o.product === product)!;
      const beforeSource = e.inventory[product]!,
        beforeDest = dest.inventory[product] ?? 0;
      execute(
        w,
        'player',
        {
          type: 'trade',
          offerId: offer.id,
          destinationId: dest.id,
          quantity,
          carrierId: 'transbrasil',
        },
        w.updatedAt,
      );
      expect(e.inventory[product]).toBe(beforeSource - quantity);
      expect(dest.inventory[product] ?? 0).toBe(beforeDest);
      const shipments = w.shipments.filter((s) => !s.delivered);
      expect(shipments.reduce((n, s) => n + s.quantity, 0)).toBe(quantity);
      expect(shipments.reduce((n, s) => n + s.freight, 0)).toBeGreaterThan(0);
      const arrival = Math.max(...shipments.map((s) => s.arrivesAt));
      advance(w, arrival);
      expect(dest.inventory[product]).toBe(beforeDest + quantity);
      const cost = dest.unitCosts[product];
      advance(w, arrival);
      expect(dest.inventory[product]).toBe(beforeDest + quantity);
      expect(dest.unitCosts[product]).toBe(cost);
    }
    expect(money(w)).toBe(total);
    expect(w.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0)).toBe(true);
  });
  it('rejeita falta de entrada ou reserva sem mutação', () => {
    const w = isolated();
    const e = producerOf(w, recipe, false);
    if (recipe.category === 'mine') e.reserve = 0;
    else e.inventory[Object.keys(recipe.input)[0] as ProductId] = 0;
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        e.companyId,
        { type: 'produce', establishmentId: e.id, recipeId: recipe.id, cycles: 1 },
        NOW,
      ),
    ).toThrow(/insuficiente/);
    expect(w).toEqual(before);
  });
});

describe.each(householdProducts)('consumo final de %s', (product) => {
  it('famílias pagam e retiram estoque pelo tick, conservando dinheiro', () => {
    const w = isolated(),
      total = money(w);
    for (const c of w.companies) c.bot = false;
    for (const e of w.establishments.filter((e) => e.category === 'retail')) e.enabled = false;
    const shop = w.establishments.find((e) => e.id === 'e-retail')!;
    shop.enabled = true;
    shop.inventory = { [product]: 10000 };
    shop.prices = { [product]: w.season.config.basePrices[product] };
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, w.nextEconomicAt);
    const sold = w.ledger.filter(
      (l) => l.channel === 'retail' && l.product === product && l.establishmentId === shop.id,
    );
    const quantity = sold.reduce((n, l) => n + l.quantity!, 0);
    expect(quantity).toBeGreaterThan(0);
    expect(shop.inventory[product]).toBe(10000 - quantity);
    expect(
      sold.every((l) => l.from === 'consumers' && l.amount === l.quantity! * shop.prices[product]!),
    ).toBe(true);
    expect(money(w)).toBe(total);
  });
});

describe.each(infrastructurePrograms)('consumo público: $name', (program) => {
  it('adjudica, paga, transporta e consome o material uma única vez', () => {
    const w = isolated(),
      total = money(w);
    for (const c of w.companies) c.bot = c.id === 'transbrasil';
    // Estoque e edital controlados; as mesmas funções de proposta/entrega do jogo são executadas.
    const e = w.establishments.find(
      (e) => e.id === (program.product === 'steel' ? 'e-industry' : 'e-supplier'),
    )!;
    e.inventory[program.product] = program.quantity;
    e.quality![program.product] = 100;
    const unitPrice = Math.round(w.season.config.basePrices[program.product] * 1.25);
    const c: World['infrastructure'][number] = {
      id: 'catalog-contract',
      title: program.name,
      program: program.name,
      destinationId: w.establishments.find(
        (e) => e.propertyId.startsWith('municipal-') && e.companyId === 'treasury:SP',
      )!.id,
      product: program.product,
      state: 'SP',
      treasuryId: 'treasury:SP',
      quantity: program.quantity,
      unitPrice,
      minQuality: program.quality,
      maxFreight: 10000000,
      reserved: unitPrice * program.quantity + 10000000,
      createdAt: NOW,
      biddingEndsAt: NOW + GAME_DAY / 4,
      deadline: NOW + GAME_DAY * 4,
      status: 'open',
      deliveredQuantity: 0,
      bids: [],
    };
    w.infrastructure.push(c);
    execute(
      w,
      e.companyId,
      {
        type: 'bidInfrastructure',
        contractId: c.id,
        establishmentId: e.id,
        carrierId: 'transbrasil',
        unitPrice,
      },
      NOW,
    );
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, c.biddingEndsAt!);
    expect(c.status).toBe('delivering');
    const shipments = w.shipments.filter((s) => s.infrastructureId === c.id);
    expect(shipments.reduce((n, s) => n + s.quantity, 0)).toBe(c.quantity);
    const at = Math.max(...shipments.map((s) => s.arrivesAt));
    advance(w, at);
    expect(c.status).toBe('completed');
    expect(w.consumedMaterials[program.product]).toBe(c.quantity);
    expect(
      w.establishments.find((e) => e.id === c.destinationId)!.inventory[program.product] ?? 0,
    ).toBe(0);
    advance(w, at);
    expect(w.consumedMaterials[program.product]).toBe(c.quantity);
    expect(money(w)).toBe(total);
  });
});
