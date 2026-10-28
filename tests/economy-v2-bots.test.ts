import { beforeAll, describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY, SCRAP_COLLECTION } from '../packages/simulation/src/operations';
import { seasonPrice, wholesaleReference } from '../packages/simulation/src/metrics';
import { householdItems } from '../packages/simulation/src/channels';
import { v2PortfolioFor } from '../packages/simulation/src/opening-v2';
import type { World } from '../packages/simulation/src/model';

// Fatia 8 da etapa B: rivais em todas as especialidades do mundo versão 2, com os mesmos comandos.
const NOW = Date.UTC(2026, 9, 27, 12);
const money = (w: World) => w.companies.reduce((n, c) => n + c.balance, 0);

describe('mundo versão 2 · abertura dos bots', () => {
  it('cada especialidade da economia alvo tem rival, e tudo o que ele tem foi pago', () => {
    const w = createWorld(NOW, { economy: 2 });
    const rivals = w.establishments.filter((e) => e.companyId.startsWith('rival-'));
    expect(rivals).toHaveLength(v2PortfolioFor(w).length);
    const specialties = w.season.config.recipes.filter((r) => !r.alternativeOf).map((r) => r.id);
    for (const id of specialties) expect(rivals.some((e) => e.specialization === id)).toBe(true);
    for (const e of rivals) {
      const capital = w.ledger.find((l) => l.to === e.companyId && l.from === 'consumers')!.amount;
      const spent = w.ledger
        .filter((l) => l.from === e.companyId)
        .reduce((n, l) => n + l.amount, 0);
      expect(spent + w.companies.find((c) => c.id === e.companyId)!.balance).toBe(capital);
      const r = w.season.config.recipes.find((x) => x.id === e.specialization);
      // Rebanho das linhas presente desde o início; semente para duas plantas.
      for (const [id, q] of Object.entries(r?.requires ?? {}))
        expect(e.inventory[id as 'cow']).toBeGreaterThanOrEqual(q! * e.equipmentLines!);
      // A semente que a colheita devolve não entra nas compras automáticas.
      for (const rule of e.supplyPolicy?.rules ?? []) expect(r?.output[rule.product]).toBeFalsy();
    }
  });

  it('lojas-bot vão às cidades sem loja, da mais populosa para a menor', () => {
    const w = createWorld(NOW, { economy: 2 });
    const stores = w.establishments.filter(
      (e) => e.companyId.startsWith('rival-') && e.category === 'retail',
    );
    const cities = stores.map((e) => w.properties.find((p) => p.id === e.propertyId)!.city);
    expect(cities).toContain('São Paulo');
    expect(new Set(cities).size).toBe(stores.length);
  });

  it('o mundo da versão 1 continua sem a abertura nova', () => {
    const w = createWorld(NOW);
    expect(w.establishments.some((e) => e.id.startsWith('e-yard-'))).toBe(false);
    expect(w.vehicles.some((v) => v.model)).toBe(false);
    expect(w.establishments.some((e) => e.companyId === 'rival-1' && e.equipmentLines)).toBe(false);
  });
});

describe('mundo versão 2 · vinte dias de bots', () => {
  let w: World, before: number;
  beforeAll(() => {
    w = createWorld(NOW, { economy: 2 });
    before = money(w);
    advance(w, NOW + 20 * GAME_DAY);
  }, 120000);

  it('nenhuma especialidade fica parada e o dinheiro se conserva', () => {
    const produced = new Set(w.jobs.filter((j) => j.completed).map((j) => j.recipeId));
    for (const r of w.season.config.recipes) expect(produced.has(r.id), r.id).toBe(true);
    expect(money(w)).toBe(before);
  });

  it('bots compram caminhões montados pelos mesmos comandos dos jogadores', () => {
    const manufactured = w.ledger.filter(
      (l) => l.product === 'truckHeavy' || l.product === 'truckLight',
    );
    expect(manufactured.length).toBeGreaterThan(0);
    expect(w.botActivity!.some((a) => a.kind === 'buyVehicle')).toBe(true);
  });

  it('o governo devolve a arrecadação às famílias, que seguem comprando', () => {
    expect(w.ledger.some((l) => l.from.startsWith('treasury:') && l.to === 'consumers')).toBe(true);
    expect(w.companies.find((c) => c.id === 'consumers')!.balance).toBeGreaterThan(0);
    const late = w.consumptionHistory.filter((h) => h.at > NOW + 15 * GAME_DAY);
    const sold = late.reduce((n, h) => n + h.sold, 0),
      desired = late.reduce((n, h) => n + h.desired, 0);
    expect(sold / desired).toBeGreaterThan(0.3);
  });

  it('editais públicos menores e espaçados, no ritmo do aço público alvo', () => {
    const { lotScale, contractIntervalMs } = w.season.config.government!;
    expect(lotScale).toBe(0.25);
    for (const c of w.infrastructure.filter((c) => c.product === 'steel'))
      expect(c.quantity).toBeLessThanOrEqual(24);
    for (const state of new Set(w.infrastructure.map((c) => c.state))) {
      const opened = w.infrastructure.filter((c) => c.state === state).map((c) => c.createdAt);
      for (let i = 1; i < opened.length; i++)
        expect(opened[i] - opened[i - 1]).toBeGreaterThanOrEqual(contractIntervalMs);
    }
  });

  it('atacado dos bots fica abaixo da prateleira e a sucata mantém o preço da coleta', () => {
    for (const id of householdItems(w)) {
      const cheapest = Math.min(
        ...w.offers
          .filter((o) => o.product === id && o.establishmentId.startsWith('e-rival-'))
          .map((o) => o.price),
      );
      expect(cheapest, id).toBeLessThan(seasonPrice(w, id));
      expect(cheapest, id).toBeGreaterThan(wholesaleReference(w, id) * 0.9);
    }
    const collection = w.offers.find((o) => o.establishmentId === SCRAP_COLLECTION)!;
    expect(collection.price).toBe(w.season.config.recycling!.scrapPrice);
  });

  it('insumo comprado para a própria receita não volta à venda', () => {
    for (const e of w.establishments.filter((e) => e.specialization === 'feed-mill'))
      expect(w.offers.some((o) => o.establishmentId === e.id && o.product === 'soymeal')).toBe(
        false,
      );
  });
});
