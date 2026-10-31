import { describe, expect, it } from 'vitest';
import { createScenario, leanStartCash } from '../packages/simulation/src/scenarios';
import { createWorld } from '../packages/simulation/src/seed';
import { advance } from '../packages/simulation/src/engine';
import { GAME_DAY } from '../packages/simulation/src/operations';
import { v2LotArea } from '../packages/simulation/src/opening-v2';

// Começo enxuto do mundo jogável da versão 2 (D-033).
const NOW = Date.UTC(2026, 9, 26, 12);
const money = (w: ReturnType<typeof createWorld>) => w.companies.reduce((n, c) => n + c.balance, 0);

describe('começo enxuto do mundo jogável', () => {
  const w = createScenario(NOW, 'playtest');
  it('cada jogador começa com uma loja vazia, equipe mínima e R$ 1 milhão', () => {
    for (const actor of ['player', 'player2']) {
      const owned = w.establishments.filter((e) => e.companyId === actor);
      expect(owned).toHaveLength(1);
      expect(owned[0]).toMatchObject({ category: 'retail', employees: 8, enabled: true });
      expect(Object.keys(owned[0].inventory)).toHaveLength(0);
      expect(w.companies.find((c) => c.id === actor)!.balance).toBe(leanStartCash);
      expect(w.vehicles.some((v) => v.companyId === actor)).toBe(false);
      expect(w.properties.filter((p) => p.ownerId === actor)).toHaveLength(1);
    }
  });

  it('libera os outros imóveis para compra sem deixar referências soltas', () => {
    const ids = new Set(w.establishments.map((e) => e.id));
    for (const id of ['farm', 'mine', 'industry', 'logistics'])
      expect(w.properties.find((p) => p.id === id)!.ownerId).toBeNull();
    for (const o of w.offers) expect(ids.has(o.establishmentId)).toBe(true);
    for (const j of w.jobs) expect(ids.has(j.establishmentId)).toBe(true);
    for (const o of w.orders) expect(ids.has(o.originId) && ids.has(o.destinationId)).toBe(true);
  });

  it('lotes livres têm tamanho de poucas linhas e preço da calculadora', () => {
    for (const p of w.properties.filter((p) => p.ownerId === null)) {
      expect(p.area).toBe(v2LotArea[p.category]);
      expect(p.price).toBeLessThanOrEqual(13200000);
    }
  });

  it('conserva o dinheiro, segue rodando e os bots não levam os lotes livres', () => {
    expect(money(w)).toBe(money(createWorld(NOW)));
    const before = money(w),
      free = w.properties.filter((p) => p.ownerId === null).map((p) => p.id);
    advance(w, NOW + GAME_DAY * 2);
    expect(money(w)).toBe(before);
    expect(w.properties.filter((p) => p.ownerId === null).map((p) => p.id)).toEqual(free);
  });
});
