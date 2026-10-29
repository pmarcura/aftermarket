import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { v2SeasonConfig } from '../packages/simulation/src/economy-v2';
import {
  freightPerTonne,
  haulKm,
  priceList,
  storeEconomics,
} from '../packages/simulation/src/economy-design';
import { vehicleModels } from '../packages/simulation/src/catalog';
import { products } from '../packages/simulation/src/model';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { supplySpent } from '../packages/simulation/src/supply';

const NOW = Date.UTC(2026, 9, 27, 12);

// D-036: a economia versão 2 no Brasil real paga o frete das distâncias de verdade.
describe('economia versão 2 no mapa real', () => {
  it('mede a distância de cada item pelos polos reais', () => {
    const km = haulKm();
    // Arroz de Uruguaiana e carvão de Santa Catarina viajam mais de mil quilômetros;
    // ferro do Quadrilátero fica perto das usinas de Minas.
    expect(km.rice).toBeGreaterThan(1000);
    expect(km.coal).toBeGreaterThan(1000);
    expect(km.iron).toBeLessThan(150);
    expect(freightPerTonne('rice')).toBeGreaterThan(freightPerTonne('iron'));
  });

  it('desconta da porta da fazenda o frete, a loja e o atacadista', () => {
    const price = priceList(),
      { markup } = storeEconomics();
    // Prateleira de referência do arroz: R$ 24,50 o pacote de 5 kg.
    const shelf = (price.rice + (5 / 1000) * freightPerTonne('rice')) * 1.04 * (1 + markup);
    expect(shelf).toBeCloseTo(2450, 0);
    expect(price.rice).toBeLessThan(2039); // era R$ 20,39 com 110 km
  });

  it('faz a obra pública crescer com a escala do mundo', () => {
    const one = v2SeasonConfig(1).government!.contractIntervalMs;
    const twenty = v2SeasonConfig(20).government!.contractIntervalMs;
    expect(one / twenty).toBeCloseTo(20, 0);
  });

  it('dá ao atacadista margem própria e pedido de caminhão cheio', () => {
    const w = createWorld(NOW, { economy: 2, scale: 2 });
    expect(w.season.config.design.wholesaleMargin).toBe(0.04);
    const distributors = w.establishments.filter(
      (e) => e.companyId.startsWith('rival-') && e.category === 'warehouse',
    );
    expect(distributors.length).toBeGreaterThan(0);
    for (const e of distributors)
      for (const rule of e.supplyPolicy!.rules) {
        const truckload = Math.floor(
          vehicleModels.truckHeavy.capacityT / products[rule.product].massT,
        );
        expect(rule.target - rule.minimum, rule.product).toBeGreaterThanOrEqual(truckload);
      }
  });

  it('deixa o carvão distante caber no teto de frete das usinas', () => {
    const w = createWorld(NOW, { economy: 2, scale: 2 });
    const mill = w.establishments.find(
      (e) => e.companyId.startsWith('rival-') && e.specialization === 'steel-bars',
    )!;
    const coal = mill.supplyPolicy!.rules.find((r) => r.product === 'coal')!;
    expect(coal.maxFreightPerUnit!).toBeGreaterThanOrEqual(Math.round(2 * freightPerTonne('coal')));
    // O orçamento diário cabe o maior pedido da regra.
    expect(mill.supplyPolicy!.dailyBudget).toBeGreaterThanOrEqual(
      coal.target * w.season.config.basePrices.coal,
    );
  });

  // D-038: anúncio de procura sem resposta não ocupa o orçamento do dia.
  it('não conta pedido aberto sem vendedor como gasto da reposição', () => {
    const w = createWorld(NOW, { economy: 2, scale: 2 });
    const mill = w.establishments.find(
      (e) => e.companyId.startsWith('rival-') && e.specialization === 'steel-bars',
    )!;
    const order = {
      id: 'anuncio',
      buyerId: mill.companyId,
      sellerId: '',
      originId: '',
      destinationId: mill.id,
      product: 'iron' as const,
      quantity: 58,
      unitPrice: 50000,
      carrierId: 'transbrasil',
      maxFreight: 200000,
      createdAt: NOW,
      deadline: NOW + 3 * GAME_DAY,
      status: 'pending' as const,
      proposals: [],
    };
    w.orders.push(order);
    expect(supplySpent(w, mill, NOW).promised).toBe(0);
    // Com vendedor definido o pedido passa a ser compromisso.
    order.sellerId = 'rival-2';
    expect(supplySpent(w, mill, NOW).promised).toBe(58 * 50000 + 200000);
  });
});
