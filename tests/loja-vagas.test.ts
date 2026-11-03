import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { vagasDaLoja } from '../apps/web/src/features/loja/vagas';

// Vagas vazias da prateleira (spec 008, tela 2): produtos que a cidade procura e a loja não tem.
describe('vagas da loja', () => {
  const world = createWorld(Date.UTC(2026, 0, 5, 12));
  const loja = world.establishments.find(
    (e) => e.companyId === 'player' && e.category === 'retail',
  )!;

  it('lista só o que a loja não tem, do que mais rende para o que menos rende', () => {
    const vagas = vagasDaLoja(world, loja);
    for (const v of vagas) {
      expect(v.id in loja.inventory).toBe(false);
      expect(v.procuraDia).toBeGreaterThan(0);
      expect(v.custo).toBeLessThan(v.preco);
      expect(v.lucroDia).toBeGreaterThan(0);
    }
    const lucros = vagas.map((v) => v.lucroDia);
    expect(lucros).toEqual([...lucros].sort((a, b) => b - a));
  });

  it('um produto que entra na prateleira deixa de ser vaga', () => {
    const antes = vagasDaLoja(world, loja);
    if (!antes.length) return;
    const id = antes[0].id;
    const copia = { ...loja, inventory: { ...loja.inventory, [id]: 100 } };
    expect(vagasDaLoja(world, copia).some((v) => v.id === id)).toBe(false);
  });

  it('carga já a caminho marca a vaga como pedida', () => {
    const antes = vagasDaLoja(world, loja);
    if (!antes.length) return;
    const id = antes[0].id;
    const comCarga = {
      ...world,
      shipments: [
        ...world.shipments,
        { destinationId: loja.id, product: id, quantity: 10, delivered: false } as never,
      ],
    };
    expect(vagasDaLoja(comCarga, loja).find((v) => v.id === id)?.aCaminho).toBe(true);
  });
});
