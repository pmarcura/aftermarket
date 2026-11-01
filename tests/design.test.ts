import { describe, it, expect } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { execute, advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import {
  arrears,
  equipmentCostFor,
  freeCash,
  outstandingLoans,
  recoveryQuote,
  updatePublicBenchmarks,
  economyHealth,
} from '../packages/simulation/src/design';
import {
  publicReference,
  institutional,
  defaultSupplyPolicy,
} from '../packages/simulation/src/competition';
import { operatingCosts } from '../packages/simulation/src/metrics';
import { supplyForecast } from '../packages/simulation/src/supply';
import { marketView } from '../packages/simulation/src/metrics';
import { runBotDirector, botRecoveryPlan } from '../packages/simulation/src/director';
import { migrateWorld } from '../packages/simulation/src/migrate';
import { ECONOMIC_INTERVAL, type World } from '../packages/simulation/src/model';
const NOW = Date.UTC(2026, 9, 27, 4);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
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
const company = (w: World, id = 'player') => w.companies.find((c) => c.id === id)!;
// Lotes livres são gerados por polo e cidade: o primeiro terreno industrial à venda em SP
// (os testes de crédito pedem o tesouro paulista e recusam o mineiro).
const freeLot = (w: World, category = 'industry') =>
  w.properties.find((p) => p.ownerId === null && p.category === category && p.state === 'SP')!;
function openFactory(w: World) {
  const lot = freeLot(w);
  execute(
    w,
    'player2',
    { type: 'buyProperty', propertyId: lot.id, name: 'Fábrica Recuperável' },
    NOW,
  );
  execute(
    w,
    'player2',
    { type: 'installBusiness', establishmentId: `e-${lot.id}`, recipeId: 'steel-bars', lines: 1 },
    NOW,
  );
  execute(
    w,
    'player2',
    { type: 'setWorkforce', establishmentId: `e-${lot.id}`, employees: 18 },
    NOW,
  );
  return w.establishments.find((e) => e.id === `e-${lot.id}`)!;
}
describe('recuperação sem emissão', () => {
  it('estoque anunciado permanece à venda com produção suspensa', () => {
    const w = quiet(),
      e = w.establishments.find((e) => e.id === 'e-ferrovale')!;
    e.enabled = false;
    e.mothballed = true;
    expect(marketView(w, 'iron').offers.some((o) => o.establishmentId === e.id)).toBe(true);
  });
  it('bot reavalia retomada lucrativa com caixa próprio e não recebe resgate grátis', () => {
    const w = quiet(),
      e = w.establishments.find((e) => e.id === 'e-rival-1')!,
      c = company(w, e.companyId);
    c.bot = true;
    e.enabled = false;
    e.mothballed = true;
    e.employees = 0;
    e.automation = false;
    e.supplyPolicy!.enabled = false;
    const at = NOW + GAME_DAY * 8;
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    const template = w.infrastructure.find((c) => c.product === 'steel')!;
    for (let i = 0; i < 20; i++)
      w.infrastructure.push({
        ...structuredClone(template),
        id: `opportunity-${i}`,
        createdAt: at - GAME_DAY,
        biddingEndsAt: at - 1,
        deadline: at + GAME_DAY,
        status: 'expired',
        bids: [],
      });
    expect(botRecoveryPlan(w, e, at)).toBeDefined();
    const total = money(w);
    runBotDirector(w, at);
    expect(e.mothballed).toBe(false);
    expect(e.enabled).toBe(true);
    expect(e.employees).toBeGreaterThan(0);
    expect(money(w)).toBe(total);
    expect(c.lastRecoveryAt).toBe(at);
  });
  it('compra imóvel sem contratar; equipamentos são pagos e limitam linhas antes da operação', () => {
    const w = quiet(),
      total = money(w),
      lot = freeLot(w);
    execute(w, 'player2', { type: 'buyProperty', propertyId: lot.id, name: 'Nova indústria' }, NOW);
    const e = w.establishments.find((e) => e.id === `e-${lot.id}`)!;
    expect(e.employees).toBe(0);
    expect(e.enabled).toBe(false);
    expect(e.installed).toBe(false);
    expect(e.capacityT).toBe(0);
    execute(
      w,
      'player2',
      { type: 'installBusiness', establishmentId: e.id, recipeId: 'steel-bars', lines: 1 },
      NOW,
    );
    expect(e.employees).toBe(0);
    expect(e.installationValue).toBe(equipmentCostFor(w, 'industry', 'steel-bars'));
    expect(money(w)).toBe(total);
    const before = structuredClone(w);
    expect(() =>
      execute(
        w,
        'player2',
        { type: 'installBusiness', establishmentId: e.id, recipeId: 'steel-bars', lines: 100 },
        NOW,
      ),
    ).toThrow(/área/);
    expect(w).toEqual(before);
  });
  it('registra obrigação e despesa sem inventar pagamento quando falta caixa', () => {
    const w = quiet(),
      e = openFactory(w);
    company(w, 'consumers').balance += company(w, 'player2').balance;
    company(w, 'player2').balance = 0;
    const total = money(w),
      prior = e.expenses;
    w.nextEconomicAt = NOW + ECONOMIC_INTERVAL;
    advance(w, NOW + ECONOMIC_INTERVAL);
    expect(e.enabled).toBe(false);
    expect(arrears(w, 'player2')).toBeGreaterThan(0);
    expect(e.expenses - prior).toBe(arrears(w, 'player2'));
    expect(money(w)).toBe(total);
    expect(
      w.ledger.filter((l) => l.from === 'player2' && l.at === NOW + ECONOMIC_INTERVAL),
    ).toHaveLength(0);
  });
  it('suspensão zera equipe, reduz manutenção e preserva estoques; reativação não contrata grátis', () => {
    const w = quiet(),
      e = w.establishments.find((e) => e.id === 'e-industry')!,
      stock = { ...e.inventory },
      prior = operatingCosts(w, e).total;
    execute(w, 'player', { type: 'mothball', establishmentId: e.id, enabled: true }, NOW);
    expect(e.inventory).toEqual(stock);
    expect(e.employees).toBe(0);
    expect(e.education).toBe(0);
    expect(operatingCosts(w, e).total).toBeLessThan(prior / 10);
    expect(() =>
      execute(w, 'player', { type: 'setWorkforce', establishmentId: e.id, employees: 10 }, NOW),
    ).toThrow(/Reative/);
    execute(w, 'player', { type: 'mothball', establishmentId: e.id, enabled: false }, NOW);
    expect(e.employees).toBe(0);
    expect(e.enabled).toBe(false);
  });
  it('crédito paga custo único, mantém principal e permite quitar dívida sem dupla despesa', () => {
    const w = quiet();
    openFactory(w);
    const total = money(w),
      before = company(w, 'player2').balance;
    execute(w, 'player2', { type: 'takeRecoveryLoan', state: 'SP', amount: 10000000 }, NOW);
    expect(company(w, 'player2').balance - before).toBe(9800000);
    expect(outstandingLoans(w, 'player2')).toBe(10000000);
    expect(company(w, 'player2').financingExpense).toBe(200000);
    expect(money(w)).toBe(total);
    const loan = w.loans![0];
    execute(w, 'player2', { type: 'repayLoan', loanId: loan.id, amount: 10000000 }, NOW);
    expect(outstandingLoans(w, 'player2')).toBe(0);
    expect(money(w)).toBe(total);
  });
  it('garantia e verba limitam crédito; rejeição não altera caixa ou histórico', () => {
    const w = quiet();
    openFactory(w);
    const q = recoveryQuote(w, 'player2', 'SP', 10000000),
      before = structuredClone(w);
    expect(() =>
      execute(w, 'player2', { type: 'takeRecoveryLoan', state: 'SP', amount: q.maximum + 1 }, NOW),
    ).toThrow(/garantia|verba/);
    expect(w).toEqual(before);
    expect(() =>
      execute(w, 'player2', { type: 'takeRecoveryLoan', state: 'MG', amount: 1000000 }, NOW),
    ).toThrow(/estado/);
    expect(w).toEqual(before);
  });
  it('regularização prioriza salários e não reconhece despesa duas vezes', () => {
    const w = quiet(),
      e = openFactory(w),
      total = money(w),
      expense = e.expenses;
    w.obligations!.push(
      {
        id: 'a',
        companyId: 'player2',
        establishmentId: e.id,
        to: 'treasury:SP',
        kind: 'water',
        description: 'Água',
        amount: 100000,
        paid: 0,
        dueAt: NOW - 100,
      },
      {
        id: 'b',
        companyId: 'player2',
        establishmentId: e.id,
        to: 'consumers',
        kind: 'payroll',
        description: 'Folha',
        amount: 100000,
        paid: 0,
        dueAt: NOW,
      },
    );
    execute(w, 'player2', { type: 'payObligations', amount: 120000 }, NOW);
    expect(w.obligations![1].paid).toBe(100000);
    expect(w.obligations![0].paid).toBe(20000);
    expect(e.expenses).toBe(expense);
    expect(money(w)).toBe(total);
  });
  it('parcelas amortizam só o principal vencido; dívida continua se falta caixa', () => {
    const w = quiet();
    openFactory(w);
    execute(w, 'player2', { type: 'takeRecoveryLoan', state: 'SP', amount: 3000000 }, NOW);
    const total = money(w);
    w.nextEconomicAt = NOW + GAME_DAY;
    advance(w, NOW + GAME_DAY);
    expect(w.loans![0].repaid).toBe(100000);
    expect(money(w)).toBe(total);
  });
});
describe('caixa vinculado a pedidos', () => {
  it('reserva bloqueia outras despesas e cancelamento libera o saldo', () => {
    const w = quiet(),
      before = freeCash(w, 'player');
    execute(
      w,
      'player',
      {
        type: 'createPurchaseRequest',
        destinationId: 'e-industry',
        product: 'iron',
        quantity: 20,
        unitPrice: 50000,
        maxFreight: 500000,
        deliveryDays: 3,
        reserveFunds: true,
      },
      NOW,
    );
    const o = w.orders.at(-1)!;
    expect(freeCash(w, 'player')).toBe(before - 1500000);
    expect(w.ledger.filter((l) => l.from === 'player')).toHaveLength(0);
    company(w).balance = o.escrowReserved!;
    const snapshot = structuredClone(w);
    expect(() =>
      execute(w, 'player', { type: 'trainWorkforce', establishmentId: 'e-industry' }, NOW),
    ).toThrow(/Saldo|vinculado/);
    expect(w).toEqual(snapshot);
    execute(w, 'player', { type: 'rejectOrder', orderId: o.id }, NOW);
    expect(freeCash(w, 'player')).toBe(company(w).balance);
  });
  it('o próprio aceite usa a reserva, despacha e libera a sobra', () => {
    const w = quiet(),
      total = money(w);
    execute(
      w,
      'player',
      {
        type: 'requestOrder',
        offerId: 'offer-ferrovale',
        destinationId: 'e-industry',
        quantity: 10,
        carrierId: 'transbrasil',
        maxFreight: 1000000,
        deliveryDays: 3,
        reserveFunds: true,
      },
      NOW,
    );
    const o = w.orders.at(-1)!;
    execute(w, 'ferrovale', { type: 'acceptOrder', orderId: o.id }, NOW);
    expect(o.status).toBe('accepted');
    expect(o.escrowReserved).toBe(0);
    expect(money(w)).toBe(total);
  });
});
describe('referência protegida e informação', () => {
  it('anúncios coordenados e negócios concentrados não alteram a referência', () => {
    const w = quiet(),
      base = publicReference(w, 'steel');
    for (const o of w.offers.filter((o) => o.product === 'steel')) o.price *= 100;
    for (let i = 0; i < 10; i++)
      w.ledger.push({
        id: `t${i}`,
        at: NOW,
        from: 'player',
        to: 'ferrovale',
        amount: base * 100,
        kind: 'trade',
        description: 'Teste',
        product: 'steel',
        quantity: 1,
        unitPrice: base * 100,
        channel: 'wholesale',
      });
    updatePublicBenchmarks(w, NOW + GAME_DAY);
    expect(publicReference(w, 'steel')).toBe(base);
  });
  it('negócios de várias empresas atualizam no máximo 5% ao dia, sem aumentar pelo número de consultas', () => {
    const w = quiet(),
      base = publicReference(w, 'steel');
    for (let i = 0; i < 3; i++)
      w.ledger.push({
        id: `d${i}`,
        at: NOW,
        from: ['player', 'player2', 'aurora'][i],
        to: ['ferrovale', 'minas', 'metais'][i],
        amount: base * 10,
        kind: 'trade',
        description: 'Teste',
        product: 'steel',
        quantity: 1,
        unitPrice: base * 10,
        channel: 'wholesale',
      });
    updatePublicBenchmarks(w, NOW + GAME_DAY);
    expect(publicReference(w, 'steel')).toBe(Math.floor(base * 1.05));
    updatePublicBenchmarks(w, NOW + GAME_DAY + 100);
    expect(publicReference(w, 'steel')).toBe(Math.floor(base * 1.05));
  });
  it('projeção não eleva produção industrial acima do plano e saúde preserva total por setor', () => {
    const w = quiet(),
      e = w.establishments.find((e) => e.id === 'e-industry')!,
      f = supplyForecast(w, e, defaultSupplyPolicy(w, e));
    expect(f.highResult).toBe(f.estimatedResult);
    const h = economyHealth(w);
    expect(h.families + h.privateCash + h.governments).toBe(money(w));
  });
  it('migração aditiva não cria débitos retroativos nem altera remessas econômicas', () => {
    const w = quiet();
    delete w.designVersion;
    delete w.obligations;
    delete w.loans;
    delete w.publicBenchmarks;
    const before = structuredClone(w);
    const m = migrateWorld(w, NOW + GAME_DAY * 3).world;
    expect(m.obligations).toEqual([]);
    expect(m.loans).toEqual([]);
    expect(m.ledger).toEqual(before.ledger);
    expect(m.companies).toEqual(before.companies);
    expect(migrateWorld(m).changed).toBe(false);
  });
  it('venda de caminhão não pode esvaziar garantia de empréstimo ativo', () => {
    const w = quiet();
    for (const p of w.properties) if (p.ownerId === 'player') p.ownerId = null;
    const site = w.properties.find((p) => p.id === 'industry')!;
    site.ownerId = 'player';
    site.price = 0;
    w.vehicles = w.vehicles.filter((v) => v.companyId !== 'player');
    w.vehicles.push({
      id: 'guarantee',
      companyId: 'player',
      name: 'Garantia',
      capacityT: 30,
      capacityM3: 80,
      propertyId: 'industry',
      status: 'available',
      purchasePrice: 10000000,
    });
    execute(w, 'player', { type: 'takeRecoveryLoan', state: 'SP', amount: 4500000 }, NOW);
    const before = structuredClone(w);
    expect(() =>
      execute(w, 'player', { type: 'sellVehicle', vehicleId: 'guarantee' }, NOW),
    ).toThrow(/garante crédito/);
    expect(w).toEqual(before);
    execute(w, 'player', { type: 'repayLoan', loanId: w.loans!.at(-1)!.id, amount: 4500000 }, NOW);
    execute(w, 'player', { type: 'sellVehicle', vehicleId: 'guarantee' }, NOW);
    expect(w.vehicles.find((v) => v.id === 'guarantee')!.companyId).toBe('treasury:SP');
    expect(money(w)).toBe(money(before));
  });
});
