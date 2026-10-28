import { describe, expect, it } from 'vitest';
import { generateUiCatalog } from '../scripts/ui-catalog';

describe('catálogo de interfaces', () => {
  it('segue reexports até a implementação real e mantém o laboratório fora das telas do jogo', () => {
    const catalog = generateUiCatalog();
    const market = catalog.screens.find((s) => s.id === 'market')!;
    expect(catalog.screens).toHaveLength(13);
    expect(market.files).toContain('apps/web/src/features/economy/Market.tsx');
    expect(market.files).not.toContain('apps/web/src/devlab/LabPage.tsx');
    // Pedidos saíram da compra para a aba própria de Comércio.
    const orders = catalog.screens.find((s) => s.id === 'orders')!;
    expect(orders.files).toContain('apps/web/src/features/business/Orders.tsx');
    const files = catalog.files.filter((f) => orders.files.includes(f.path));
    expect(files.flatMap((f) => f.commands).length).toBeGreaterThan(0);
    expect(files.flatMap((f) => f.literals.map((l) => l.text))).toContain(
      'Publicar pedido de compra',
    );
  });
});
