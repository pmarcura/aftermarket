import type { Establishment } from '../../../../../packages/simulation/src/model';
import { Pedidos } from '../pedidos/Pedidos';

/**
 * Pedidos e entregas da empresa, ou só de uma unidade quando `establishment` vem de uma página de
 * unidade. A tela inteira vive em `features/pedidos`.
 */
export function Orders({ establishment }: { establishment?: Establishment }) {
  return <Pedidos unidade={establishment} />;
}
