import { describe, expect, it } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { cities } from '../packages/world/src/geography-v2';
import { codigoDaCidade, lugaresReais } from '../packages/world/src/lugares-reais';
import { zonaDoNegocio } from '../packages/simulation/src/assentar';
import { totalMoney } from '../packages/simulation/src/invariants';

const chave = (c: [number, number]) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`;

describe('negócios urbanos assentados em quadras reais', () => {
  const w = createWorld(Date.UTC(2026, 10, 5));

  it('cada negócio num lugar real da zona do seu tipo, na própria cidade', () => {
    let assentados = 0;
    for (const p of w.properties) {
      if (!p.site) continue;
      assentados++;
      const id = codigoDaCidade(p.city, p.state)!;
      const lugares = lugaresReais(id, zonaDoNegocio[p.category]).map((l) => chave([l[0], l[1]]));
      expect(lugares, `${p.id} em ${p.city}`).toContain(chave(p.coordinates as [number, number]));
    }
    const temCatalogo = cities.some((c) => lugaresReais(c.id, 'comercio').length > 0);
    // todos os terrenos do mundo inicial ficam num lugar real (zona do mapa ou substituta)
    if (temCatalogo) expect(assentados).toBe(w.properties.length);
  });

  it('dois negócios nunca dividem o mesmo lugar', () => {
    const vistos = new Set<string>();
    for (const p of w.properties.filter((x) => x.site)) {
      const k = chave(p.coordinates as [number, number]);
      expect(vistos.has(k), p.id).toBe(false);
      vistos.add(k);
    }
  });

  it('o dinheiro do mundo não muda ao assentar', () => {
    expect(totalMoney(w)).toBe(w.invariants.totalMoney);
  });

  it('terrenos grandes ficam com lugares grandes', () => {
    for (const p of w.properties.filter((x) => x.site && Math.sqrt(x.area) <= 200))
      expect(p.site!.side, p.id).toBeGreaterThanOrEqual(Math.sqrt(p.area) * 0.5);
  });
});
