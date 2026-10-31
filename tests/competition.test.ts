import { describe, it, expect } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, advance, quote } from '../packages/simulation/src/engine';
import {
  GAME_DAY,
  inventoryQuality,
  productionQuality,
  treasuryReserved,
  availableStock,
} from '../packages/simulation/src/operations';
import {
  defaultSupplyPolicy,
  initializeCompetition,
  institutional,
  trainingQuote,
  updateWages,
  publicReference,
} from '../packages/simulation/src/competition';
import {
  runSupplyPolicies,
  supplySpent,
  supplyProjection,
} from '../packages/simulation/src/supply';
import { runBotDirector } from '../packages/simulation/src/director';
import { laborMarket } from '../packages/simulation/src/metrics';
import { ECONOMIC_INTERVAL, type World } from '../packages/simulation/src/model';
import { migrateWorld } from '../packages/simulation/src/migrate';
import { v2PortfolioFor } from '../packages/simulation/src/opening-v2';
const NOW = Date.UTC(2026, 9, 26, 12),
  sum = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0),
  unit = (w: World, id = 'e-industry') => w.establishments.find((e) => e.id === id)!;
function quiet() {
  const w = createWorld(NOW);
  for (const e of w.establishments) {
    e.automation = false;
    if (e.supplyPolicy) e.supplyPolicy.enabled = false;
  }
  for (const c of w.companies)
    if (!institutional(c.id) && !['transbrasil', 'rodoleste', 'expresso'].includes(c.id))
      c.bot = false;
  w.nextEconomicAt = NOW + GAME_DAY * 100;
  return w;
}
function move(w: World, from: string, to: string, amount: number) {
  w.companies.find((c) => c.id === from)!.balance -= amount;
  w.companies.find((c) => c.id === to)!.balance += amount;
}
function publicOrder(w: World) {
  execute(
    w,
    'player',
    {
      type: 'createPurchaseRequest',
      destinationId: 'e-industry',
      product: 'iron',
      quantity: 65,
      unitPrice: 50000,
      maxFreight: 1000000,
      deliveryDays: 3,
    },
    NOW,
  );
  return w.orders.at(-1)!;
}
describe('população de bots e salários estaduais', () => {
  it('abre exatamente os concorrentes da carteira da calculadora, financiados sem emitir dinheiro', () => {
    const w = createWorld(NOW),
      rivals = v2PortfolioFor(w).length;
    expect(rivals).toBeGreaterThan(20);
    expect(w.companies.filter((c) => c.id.startsWith('rival-'))).toHaveLength(rivals);
    expect(w.companies.filter((c) => c.id.startsWith('carrier-'))).toHaveLength(22);
    expect(w.companies.filter((c) => c.id.startsWith('treasury:'))).toHaveLength(27);
    expect(sum(w)).toBe(2 * 285062500 + 8 * 650000000 + 8000000000);
    expect(
      w.ledger.filter((l) => l.description === 'Capital finito de abertura · concorrente'),
    ).toHaveLength(rivals);
    expect(
      w.ledger.filter((l) => l.description === 'Capital finito de abertura · transportadora'),
    ).toHaveLength(22);
    expect(w.companies.every((c) => Number.isSafeInteger(c.balance) && c.balance >= 0)).toBe(true);
    const before = structuredClone(w);
    initializeCompetition(w, NOW);
    expect(w).toEqual(before);
  });
  it('todas as receitas têm concorrente e perfil de capacidade, obrigando atualização do registro', () => {
    const w = createWorld(NOW);
    for (const r of w.season.config.recipes) {
      expect(w.season.config.operations.profiles[r.id]).toBeDefined();
      // A receita alternativa (reciclagem) roda na instalação da principal.
      const id = r.alternativeOf ?? r.id;
      expect(
        w.establishments.some((e) => e.companyId.startsWith('rival-') && e.specialization === id),
      ).toBe(true);
    }
  });
  it('contrata sem candidatos, remunera por estado e varia por tempo interno', () => {
    const w = quiet(),
      e = unit(w),
      p = w.properties.find((p) => p.id === e.propertyId)!;
    execute(w, 'player', { type: 'setWorkforce', establishmentId: e.id, employees: 1000 }, NOW);
    expect(e.employees).toBe(1000);
    const sp = laborMarket(w, { ...p, state: 'SP' }),
      mg = laborMarket(w, { ...p, state: 'MG' });
    expect(sp.monthlySalary).toBeGreaterThan(mg.monthlySalary);
    updateWages(w, NOW + GAME_DAY * 7);
    expect(laborMarket(w, { ...p, state: 'SP' }).monthlySalary).toBeGreaterThan(sp.monthlySalary);
  });
  it('protege semente de produção automática sem inventar estoque', () => {
    const w = createWorld(NOW),
      e = w.establishments.find((e) => e.specialization === 'rice-harvest')!,
      seed = w.season.config.recipes.find((r) => r.id === 'rice-harvest')!.input.riceSeed!;
    expect(e.inventory.riceSeed).toBeGreaterThan(0);
    expect(availableStock(w, e, 'riceSeed')).toBe(
      e.inventory.riceSeed! - seed * (e.automationCycles ?? 1),
    );
    e.automation = false;
    expect(availableStock(w, e, 'riceSeed')).toBe(e.inventory.riceSeed);
  });
});
describe('propostas e contrapropostas', () => {
  it('pedido aberto não cobra; fornecedor propõe e só a contraparte aceita termos', () => {
    const w = quiet(),
      before = sum(w),
      o = publicOrder(w),
      ledger = w.ledger.length;
    execute(
      w,
      'aurora',
      {
        type: 'proposeOrder',
        orderId: o.id,
        establishmentId: 'e-supplier',
        quantity: 60,
        unitPrice: 49000,
        maxFreight: 1000000,
        deliveryDays: 3,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    expect(w.ledger).toHaveLength(ledger);
    expect(w.shipments).toHaveLength(0);
    const proposal = o.proposals![0];
    const unchanged = structuredClone(w);
    expect(() =>
      execute(w, 'aurora', { type: 'acceptProposal', orderId: o.id, proposalId: proposal.id }, NOW),
    ).toThrow(/contraparte/);
    expect(w).toEqual(unchanged);
    expect(() =>
      execute(
        w,
        'player2',
        { type: 'acceptProposal', orderId: o.id, proposalId: proposal.id },
        NOW,
      ),
    ).toThrow(/contraparte/);
    execute(w, 'player', { type: 'acceptProposal', orderId: o.id, proposalId: proposal.id }, NOW);
    expect(o.status).toBe('accepted');
    expect(o.quantity).toBe(60);
    expect(w.shipments).toHaveLength(2);
    expect(w.shipments.reduce((n, s) => n + s.cost, 0)).toBe(60 * 49000);
    expect(sum(w)).toBe(before);
    advance(w, Math.max(...w.shipments.map((s) => s.arrivesAt)));
    expect(o.status).toBe('delivered');
  });
  it('permite ao comprador contrapropor e ao fornecedor aprovar a alteração', () => {
    const w = quiet(),
      o = publicOrder(w);
    execute(
      w,
      'aurora',
      {
        type: 'proposeOrder',
        orderId: o.id,
        establishmentId: 'e-supplier',
        quantity: 65,
        unitPrice: 51000,
        maxFreight: 1000000,
        deliveryDays: 3,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    execute(
      w,
      'player',
      {
        type: 'proposeOrder',
        orderId: o.id,
        establishmentId: 'e-supplier',
        quantity: 55,
        unitPrice: 48000,
        maxFreight: 1000000,
        deliveryDays: 3,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    execute(
      w,
      'aurora',
      { type: 'acceptProposal', orderId: o.id, proposalId: o.proposals!.at(-1)!.id },
      NOW,
    );
    expect(o.quantity).toBe(55);
    expect(o.unitPrice).toBe(48000);
    expect(o.sellerId).toBe('aurora');
  });
  it('aceitação com falta de estoque não altera caixa, proposta ou frota', () => {
    const w = quiet(),
      o = publicOrder(w);
    execute(
      w,
      'aurora',
      {
        type: 'proposeOrder',
        orderId: o.id,
        establishmentId: 'e-supplier',
        quantity: 65,
        unitPrice: 50000,
        maxFreight: 1000000,
        deliveryDays: 3,
        carrierId: 'transbrasil',
      },
      NOW,
    );
    unit(w, 'e-supplier').inventory.iron = 0;
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player',
        { type: 'acceptProposal', orderId: o.id, proposalId: o.proposals![0].id },
        NOW,
      ),
    ).toThrow(/Estoque insuficiente/);
    expect(w).toEqual(before);
  });
  it('pedidos pendentes não permitem comprometer mais dinheiro do que o caixa', () => {
    const w = quiet();
    w.companies.find((c) => c.id === 'player')!.balance = 5000000;
    publicOrder(w);
    expect(() => publicOrder(w)).toThrow(/caixa livre/);
  });
});
describe('transferência e abastecimento configurável', () => {
  it('movimenta material próprio sem receita artificial e conserva custo, qualidade e frete', () => {
    const w = quiet(),
      e = unit(w),
      source = unit(w, 'e-mine'),
      revenue = source.revenue,
      total = sum(w),
      prior = e.inventory.iron!,
      book = e.unitCosts.iron!;
    const q = quote(w, source.id, e.id, 'iron', 50, 'player');
    execute(
      w,
      'player',
      {
        type: 'transferStock',
        originId: source.id,
        destinationId: e.id,
        product: 'iron',
        quantity: 50,
        carrierId: 'player',
        expectedFreight: q.price,
      },
      NOW,
    );
    expect(source.revenue).toBe(revenue);
    expect(e.inventory.iron).toBe(prior);
    expect(w.shipments).toHaveLength(2);
    advance(w, Math.max(...w.shipments.map((s) => s.arrivesAt)));
    expect(e.inventory.iron).toBe(prior + 50);
    expect(e.unitCosts.iron).toBeCloseTo(
      (prior * book + 50 * source.unitCosts.iron! + q.price) / (prior + 50),
    );
    expect(sum(w)).toBe(total);
  });
  it('planeja entradas próprias, evita duplicações e respeita o orçamento', () => {
    const w = quiet(),
      e = unit(w),
      policy = defaultSupplyPolicy(w, e);
    policy.enabled = true;
    policy.source = 'internal-only';
    policy.carrierId = 'own';
    policy.cashReserve = 0;
    policy.dailyBudget = 10000000;
    policy.maxDistanceKm = 6000;
    policy.rules = [{ product: 'iron', minimum: 150, target: 170, maxBuy: 50, maxPrice: 0 }];
    execute(w, 'player', { type: 'configureSupply', establishmentId: e.id, policy }, NOW);
    runSupplyPolicies(w, NOW);
    expect(w.shipments.reduce((n, s) => n + s.quantity, 0)).toBe(50);
    const count = w.shipments.length;
    runSupplyPolicies(w, NOW);
    expect(w.shipments).toHaveLength(count);
    expect(supplySpent(w, e, NOW).total).toBeLessThanOrEqual(policy.dailyBudget);
    expect(e.supplyStatus).toBeDefined();
  });
  it('reserva de caixa bloqueia abastecimento e política inválida é rejeitada sem efeito', () => {
    const w = quiet(),
      e = unit(w),
      policy = defaultSupplyPolicy(w, e);
    policy.enabled = true;
    policy.source = 'internal-only';
    policy.cashReserve = 1e9;
    policy.rules = [{ product: 'iron', minimum: 150, target: 200, maxBuy: 80, maxPrice: 0 }];
    execute(w, 'player', { type: 'configureSupply', establishmentId: e.id, policy }, NOW);
    runSupplyPolicies(w, NOW);
    expect(w.shipments).toHaveLength(0);
    const before = structuredClone(w);
    policy.rules[0].minimum = 300;
    expect(() =>
      execute(w, 'player', { type: 'configureSupply', establishmentId: e.id, policy }, NOW),
    ).toThrow(/mínimo menor/);
    expect(w).toEqual(before);
  });
});
describe('educação e qualidade', () => {
  it('contratar depois da educação dilui a formação e impede multiplicar treinamento grátis', () => {
    const w = quiet(),
      e = unit(w);
    e.education = 2;
    const prior = e.employees;
    execute(
      w,
      'player',
      { type: 'setWorkforce', establishmentId: e.id, employees: prior * 2 },
      NOW,
    );
    expect(e.education).toBe(1);
    expect(trainingQuote(w, e).targetLevel).toBe(2);
    execute(w, 'player', { type: 'setWorkforce', establishmentId: e.id, employees: 0 }, NOW);
    expect(e.education).toBe(0);
  });
  it('cobra uma vez, exige tempo e melhora somente novos lotes', () => {
    const w = quiet(),
      e = unit(w),
      cost = trainingQuote(w, e),
      recipe = w.season.config.recipes[0],
      quality = productionQuality(w, e, recipe),
      stock = inventoryQuality(e, 'steel'),
      total = sum(w);
    execute(w, 'player', { type: 'trainWorkforce', establishmentId: e.id }, NOW);
    expect(e.education).toBe(0);
    expect(w.ledger.at(-1)!.amount).toBe(cost.cost);
    expect(() =>
      execute(w, 'player', { type: 'trainWorkforce', establishmentId: e.id }, NOW),
    ).toThrow(/treinamento/);
    expect(() =>
      execute(w, 'player', { type: 'setWorkforce', establishmentId: e.id, employees: 100 }, NOW),
    ).toThrow(/treinamento/);
    advance(w, w.training![0].finishesAt);
    expect(e.education).toBe(1);
    expect(productionQuality(w, e, recipe)).toBe(quality + 3);
    expect(inventoryQuality(e, 'steel')).toBe(stock);
    expect(sum(w)).toBe(total);
  });
});
describe('disputa e entrega aos tesouros estaduais', () => {
  it('desclassifica melhor proposta sem estoque e adjudica a concorrente válida', () => {
    const w = quiet();
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const c = w.infrastructure.find((c) => c.state === 'SP')!;
    const a = unit(w),
      b = unit(w, 'e-rival-1');
    for (const e of [a, b]) {
      e.inventory.steel = 200;
      e.quality!.steel = 95;
    }
    execute(
      w,
      'player',
      {
        type: 'bidInfrastructure',
        contractId: c.id,
        establishmentId: a.id,
        carrierId: 'transbrasil',
        unitPrice: Math.round(c.unitPrice * 0.75),
      },
      w.updatedAt,
    );
    execute(
      w,
      b.companyId,
      {
        type: 'bidInfrastructure',
        contractId: c.id,
        establishmentId: b.id,
        carrierId: 'transbrasil',
        unitPrice: c.unitPrice,
      },
      w.updatedAt,
    );
    expect(c.bids![0].score).toBeGreaterThan(c.bids![1].score);
    a.inventory.steel = 0;
    advance(w, c.biddingEndsAt!);
    expect(c.supplierId).toBe(b.companyId);
    expect(c.bids![0].status).toBe('invalid');
    expect(c.bids![1].status).toBe('won');
  });
  it('abre editais por caixa estadual, fixa referência +25% e adjudica somente proposta viável', () => {
    const w = quiet();
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    for (const c of w.companies.filter((c) => c.id.startsWith('treasury:')))
      move(w, c.id, 'consumers', c.balance);
    move(w, 'player', 'treasury:SP', 100000000);
    const total = sum(w);
    unit(w).inventory.steel = 200;
    unit(w).quality!.steel = 95;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const c = w.infrastructure.find((c) => c.state === 'SP')!;
    expect(c).toBeDefined();
    expect(c.unitPrice).toBe(Math.round(c.referencePrice! * 1.25));
    expect(c.treasuryId).toBe('treasury:SP');
    expect(w.establishments.find((e) => e.id === c.destinationId)!.name).toContain('Prefeitura');
    expect(treasuryReserved(w, 'SP')).toBeLessThanOrEqual(
      w.companies.find((x) => x.id === 'treasury:SP')!.balance,
    );
    execute(
      w,
      'player',
      {
        type: 'bidInfrastructure',
        contractId: c.id,
        establishmentId: 'e-industry',
        carrierId: 'transbrasil',
        unitPrice: c.unitPrice,
      },
      w.updatedAt,
    );
    expect(c.status).toBe('open');
    expect(w.shipments.filter((s) => s.infrastructureId === c.id)).toHaveLength(0);
    advance(w, c.biddingEndsAt!);
    expect(c.status).toBe('delivering');
    expect(c.bids![0].status).toBe('won');
    const shipments = w.shipments.filter((s) => s.infrastructureId === c.id);
    expect(shipments.length).toBeGreaterThanOrEqual(1); // editais a 1/4 do lote cabem num caminhão
    expect(shipments.reduce((n, s) => n + s.quantity, 0)).toBe(c.quantity);
    advance(w, Math.max(...shipments.map((s) => s.arrivesAt)));
    expect(c.status).toBe('completed');
    expect(c.deliveredQuantity).toBe(c.quantity);
    expect(w.consumedMaterials.steel).toBe(c.quantity);
    expect(sum(w)).toBe(total);
  });
  it('qualidade ou preço inadequado não comprometem orçamento nem recebem bônus', () => {
    const w = quiet();
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const c = w.infrastructure.find((c) => c.state === 'SP')!;
    unit(w).inventory.steel = 100;
    unit(w).quality!.steel = 10;
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player',
        {
          type: 'bidInfrastructure',
          contractId: c.id,
          establishmentId: 'e-industry',
          carrierId: 'transbrasil',
          unitPrice: c.unitPrice,
        },
        w.updatedAt,
      ),
    ).toThrow(/qualidade/);
    expect(w).toEqual(before);
  });
  it('a referência de várias empresas é interna e o edital não acompanha mudanças posteriores', () => {
    const w = quiet();
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const c = w.infrastructure[0],
      fixed = c.referencePrice;
    for (const o of w.offers.filter((o) => o.product === c.product)) o.price *= 2;
    expect(publicReference(w, c.product)).toBe(fixed!);
    expect(c.referencePrice).toBe(fixed);
  });
});
it('bot não aceita contraproposta ruinosa, mas negocia novamente pelos mesmos comandos', () => {
  const w = quiet(),
    o = publicOrder(w);
  w.companies.find((c) => c.id === 'aurora')!.bot = true;
  execute(
    w,
    'aurora',
    {
      type: 'proposeOrder',
      orderId: o.id,
      establishmentId: 'e-supplier',
      quantity: 65,
      unitPrice: 50000,
      maxFreight: 1000000,
      deliveryDays: 3,
      carrierId: 'transbrasil',
    },
    NOW,
  );
  execute(
    w,
    'player',
    {
      type: 'proposeOrder',
      orderId: o.id,
      establishmentId: 'e-supplier',
      quantity: 65,
      unitPrice: 1,
      maxFreight: 1000000,
      deliveryDays: 3,
      carrierId: 'transbrasil',
    },
    NOW,
  );
  runBotDirector(w, NOW);
  expect(o.status).toBe('pending');
  expect(o.proposals!.at(-1)!.proposedBy).toBe('aurora');
  expect(o.proposals!.at(-1)!.unitPrice).toBeGreaterThan(1);
  expect(w.shipments).toHaveLength(0);
});
it('bot publica necessidade real e aceita oferta de jogador com débito, frota e entrega', () => {
  const w = quiet(),
    // Uma siderúrgica-bot: a receita compra minério.
    e = w.establishments.find(
      (e) => e.companyId.startsWith('rival-') && e.specialization === 'steel-bars',
    )!,
    at = NOW + GAME_DAY / 3,
    total = sum(w);
  w.companies.find((c) => c.id === e.companyId)!.bot = true;
  e.inventory.iron = 0;
  e.supplyPolicy!.enabled = true;
  runBotDirector(w, at);
  const o = w.orders.find((o) => o.buyerId === e.companyId && o.product === 'iron')!;
  expect(o).toBeDefined();
  expect(o.sellerId).toBe('');
  // A mina do jogador fica em Itabira, perto da usina; o teto de frete do bot é 30% do item.
  execute(
    w,
    'player',
    {
      type: 'proposeOrder',
      orderId: o.id,
      establishmentId: 'e-mine',
      quantity: o.quantity,
      unitPrice: o.unitPrice,
      maxFreight: o.maxFreight,
      deliveryDays: 3,
      carrierId: 'rodoleste', // pátio em Belo Horizonte, a transportadora mais perto
    },
    at + 1,
  );
  runBotDirector(w, at + 60001);
  expect(o.status).toBe('accepted');
  expect(o.sellerId).toBe('player');
  expect(w.shipments.some((s) => s.orderId === o.id)).toBe(true);
  expect(sum(w)).toBe(total);
});
it('transferência de estoque funciona com produção pausada e projeção respeita chegada', () => {
  const w = quiet(),
    e = unit(w),
    mine = unit(w, 'e-mine');
  e.enabled = false;
  mine.enabled = false;
  e.inventory.iron = 0;
  execute(
    w,
    'player',
    {
      type: 'transferStock',
      originId: mine.id,
      destinationId: e.id,
      product: 'iron',
      quantity: 20,
      carrierId: 'player',
    },
    NOW,
  );
  const shipment = w.shipments[0];
  shipment.arrivesAt = NOW + GAME_DAY * 2;
  const values = supplyProjection(w, e, 'iron', 5);
  expect(values[0]).toBe(0);
  expect(values[1]).toBe(0);
  expect(values[2]).toBe(20);
  expect(values[3]).toBe(15);
});
it('migração aditiva mantém saldos humanos e contratos existentes enquanto cria concorrentes financiados', () => {
  const w = createWorld(NOW),
    old = structuredClone(w);
  old.competitionVersion = undefined;
  const total = sum(old),
    balance = old.companies.find((c) => c.id === 'player')!.balance;
  const m = migrateWorld(old, NOW + 100).world;
  expect(sum(m)).toBe(total);
  expect(m.companies.find((c) => c.id === 'player')!.balance).toBe(balance);
  expect(m.jobs).toEqual(old.jobs);
  expect(migrateWorld(m).changed).toBe(false);
});
it('migração após manutenção não cobra novas regras no passado e conserva horários contratados', () => {
  const w = quiet();
  execute(
    w,
    'player',
    {
      type: 'transferStock',
      originId: 'e-mine',
      destinationId: 'e-industry',
      product: 'iron',
      quantity: 1,
      carrierId: 'player',
    },
    NOW,
  );
  w.operationsVersion = 2;
  w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
  const arrival = w.shipments[0].arrivesAt,
    at = NOW + GAME_DAY * 30;
  const migrated = migrateWorld(w, at).world;
  expect(migrated.nextEconomicAt).toBe(at);
  expect(migrated.shipments[0].arrivesAt).toBe(arrival);
  expect(sum(migrated)).toBe(sum(w));
  expect(migrated.ledger).toEqual(w.ledger);
});
