import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance, execute, quote, loadOf } from '../packages/simulation/src/engine';
import {
  ECONOMIC_INTERVAL,
  recipes,
  type World,
  type Command,
} from '../packages/simulation/src/model';
import { createStore } from '../apps/server/src/store';
const NOW = 1_000_000;
const balance = (w: World, id = 'player') => w.companies.find((c) => c.id === id)!.balance;
const totalMoney = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);
const unit = (w: World, id = 'e-industry') => w.establishments.find((e) => e.id === id)!;
const trade: Command = {
  type: 'trade',
  offerId: 'offer-ferrovale',
  quantity: 24,
  destinationId: 'e-industry',
  carrierId: 'transbrasil',
};
describe('integridade econômica', () => {
  it('transfere a propriedade uma única vez, debitando o valor correto', () => {
    const w = createWorld(NOW),
      initial = balance(w),
      money = totalMoney(w);
    execute(
      w,
      'player',
      { type: 'buyProperty', propertyId: 'hortolandia', name: 'Indústria Hortolândia' },
      NOW,
    );
    expect(balance(w)).toBe(initial - w.properties[0].price);
    expect(w.properties[0].ownerId).toBe('player');
    expect(() =>
      execute(
        w,
        'player2',
        { type: 'buyProperty', propertyId: 'hortolandia', name: 'Outra indústria' },
        NOW,
      ),
    ).toThrow(/já foi adquirida/);
    expect(totalMoney(w)).toBe(money);
  });
  it('rejeita compra sem saldo antes de alterar a titularidade', () => {
    const w = createWorld(NOW);
    w.companies[0].balance = 0;
    expect(() =>
      execute(w, 'player', { type: 'buyProperty', propertyId: 'hortolandia', name: 'Teste' }, NOW),
    ).toThrow(/Saldo insuficiente/);
    expect(w.properties[0].ownerId).toBeNull();
    expect(w.ledger.filter((e) => e.from === 'player')).toHaveLength(0);
  });
  it('reserva estoque na origem sem crédito antecipado no destino', () => {
    const w = createWorld(NOW),
      old = balance(w),
      money = totalMoney(w);
    execute(w, 'player', trade, NOW);
    expect(unit(w, 'e-ferrovale').inventory.iron).toBe(156);
    expect(unit(w).inventory.iron).toBe(120);
    expect(w.shipments).toHaveLength(1);
    const s = w.shipments[0];
    expect(balance(w)).toBe(old - 24 * w.season.config.basePrices.iron - s.freight);
    expect(w.vehicles.find((v) => v.id === s.vehicleId)!.status).toBe('route');
    expect(totalMoney(w)).toBe(money);
  });
  it('entrega exatamente uma vez e incorpora o frete ao custo médio', () => {
    const w = createWorld(NOW),
      priorCost = unit(w).unitCosts.iron!;
    execute(w, 'player', trade, NOW);
    const s = w.shipments[0];
    advance(w, s.arrivesAt + 1);
    expect(unit(w).inventory.iron).toBe(144);
    expect(unit(w).unitCosts.iron).toBeCloseTo((120 * priorCost + s.cost + s.freight) / 144);
    advance(w, s.arrivesAt + 1);
    expect(unit(w).inventory.iron).toBe(144);
    expect(w.vehicles.find((v) => v.id === s.vehicleId)!.status).toBe('available');
  });
  it('limita peso e volume dos veículos', () => {
    const w = createWorld(NOW);
    expect(quote(w, 'e-ferrovale', 'e-industry', 'iron', 151, 'transbrasil').compatible).toBe(
      false,
    );
    expect(quote(w, 'e-ferrovale', 'e-industry', 'oil', 400000, 'transbrasil').compatible).toBe(
      false,
    );
    expect(() => execute(w, 'player', { ...trade, type: 'trade', quantity: 151 }, NOW)).toThrow(
      /massa e o volume/,
    );
  });
  it('considera cargas já reservadas na capacidade do armazém', () => {
    const w = createWorld(NOW);
    const d = unit(w);
    d.capacityT = loadOf(d.inventory).mass + 30;
    execute(w, 'player', trade, NOW);
    expect(() => execute(w, 'player', { ...trade, type: 'trade', quantity: 10 }, NOW)).toThrow(
      /não tem espaço/,
    );
  });
  it('não duplica estoque nem cria dinheiro em produções', () => {
    const w = createWorld(NOW),
      money = totalMoney(w),
      oldBalance = balance(w),
      r = recipes[0];
    execute(
      w,
      'player',
      { type: 'produce', establishmentId: 'e-industry', recipeId: r.id, cycles: 2 },
      NOW,
    );
    expect(unit(w).inventory.iron).toBe(96);
    expect(unit(w).inventory.coal).toBe(12);
    expect(unit(w).inventory.steel).toBe(24);
    expect(balance(w)).toBe(oldBalance - 3305600); // 2 × (R$ 12.000 + 4.400 kWh × R$ .92 + 24 m³ × R$ 20)
    expect(totalMoney(w)).toBe(money);
    advance(w, NOW + r.duration * 2);
    expect(unit(w).inventory.steel).toBe(40);
    advance(w, NOW + r.duration * 2);
    expect(unit(w).inventory.steel).toBe(40);
  });
  it('rejeita produção sem insumos e tentativas de operar unidades alheias', () => {
    const w = createWorld(NOW);
    unit(w).inventory.coal = 0;
    expect(() =>
      execute(
        w,
        'player',
        { type: 'produce', establishmentId: 'e-industry', recipeId: 'steel-bars', cycles: 1 },
        NOW,
      ),
    ).toThrow(/Insumo insuficiente/);
    expect(w.jobs).toHaveLength(0);
    expect(() =>
      execute(w, 'player2', { type: 'toggleOperation', establishmentId: 'e-industry' }, NOW),
    ).toThrow(/outra empresa/);
  });
  it('reserva a jazida e cobra extração antes de disponibilizar o material', () => {
    const w = createWorld(NOW),
      e = unit(w, 'e-mine');
    execute(w, 'player', { type: 'extract', establishmentId: e.id, quantity: 20 }, NOW);
    expect(e.reserve).toBe(19980);
    expect(e.inventory.iron).toBe(650);
    advance(w, NOW + 60000);
    expect(e.inventory.iron).toBe(670);
    expect(() =>
      execute(w, 'player', { type: 'extract', establishmentId: e.id, quantity: 0 }, NOW + 60000),
    ).toThrow(/inteiro positivo/);
  });
  it('consumidores têm orçamento e só compram estoque existente', () => {
    const w = createWorld(NOW);
    unit(w, 'e-retail').inventory.milk = 3;
    const money = totalMoney(w);
    advance(w, NOW + ECONOMIC_INTERVAL);
    expect(unit(w, 'e-retail').inventory.milk).toBeGreaterThanOrEqual(0);
    expect(totalMoney(w)).toBe(money);
    const consumer = w.companies.find((c) => c.id === 'consumers')!;
    consumer.balance = 0;
    const revenue = unit(w, 'e-retail').revenue;
    advance(w, NOW + ECONOMIC_INTERVAL * 2);
    expect(unit(w, 'e-retail').revenue).toBe(revenue);
  });
  it('processa o tempo offline com os mesmos saldos e estoques do tempo online', () => {
    const online = createWorld(NOW),
      offline = createWorld(NOW);
    for (const w of [online, offline])
      execute(
        w,
        'player',
        { type: 'produce', establishmentId: 'e-industry', recipeId: 'steel-bars', cycles: 1 },
        NOW,
      );
    for (let t = 5000; t <= 180000; t += 5000) advance(online, NOW + t);
    advance(offline, NOW + 180000);
    expect(online.companies.map((c) => c.balance)).toEqual(offline.companies.map((c) => c.balance));
    expect(online.establishments.map((e) => e.inventory)).toEqual(
      offline.establishments.map((e) => e.inventory),
    );
  });
  it('não usa oferta maior que o estoque atual nem aceita quantidades não inteiras', () => {
    const w = createWorld(NOW);
    expect(() => execute(w, 'player', { ...trade, type: 'trade', quantity: 181 }, NOW)).toThrow(
      /Estoque insuficiente/,
    );
    expect(() => execute(w, 'player', { ...trade, type: 'trade', quantity: 1.2 }, NOW)).toThrow(
      /inteiro positivo/,
    );
  });
});
describe('transações SQLite e repetição de solicitações', () => {
  it('reprocessar uma mesma chave não cobra duas vezes', () => {
    const store = createStore(':memory:');
    try {
      const key = crypto.randomUUID(),
        command: Command = {
          type: 'buyProperty',
          propertyId: 'hortolandia',
          name: 'Teste transacional',
        };
      const first = store.command('player', command, key);
      const second = store.command('player', command, key);
      expect(balance(first)).toBe(balance(second));
      expect(second.establishments.filter((e) => e.propertyId === 'hortolandia')).toHaveLength(1);
      expect(() => store.command('player2', command, key)).toThrow(/já foi usado/);
    } finally {
      store.close();
    }
  });
  it('um erro desfaz integralmente a transação e não registra cobrança', () => {
    const store = createStore(':memory:');
    try {
      const before = store.read();
      expect(() =>
        store.command('player', { ...trade, type: 'trade', quantity: 500 }, crypto.randomUUID()),
      ).toThrow();
      expect(store.read()).toEqual(before);
    } finally {
      store.close();
    }
  });
  it('duas empresas disputando a mesma propriedade têm um único vencedor', () => {
    const store = createStore(':memory:');
    try {
      const command: Command = {
        type: 'buyProperty',
        propertyId: 'hortolandia',
        name: 'Nova unidade',
      };
      store.command('player', command, crypto.randomUUID());
      expect(() => store.command('player2', command, crypto.randomUUID())).toThrow(
        /já foi adquirida/,
      );
      expect(store.read().properties[0].ownerId).toBe('player');
      expect(store.read().ledger.filter((e) => e.kind === 'property')).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
