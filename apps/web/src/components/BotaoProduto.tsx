import type { ReactNode } from 'react';
import { useGame } from '../lib/game';
import { products, type ProductId } from '../../../../packages/simulation/src/model';
import '../design/produto-ficha.css';

/**
 * Torna a imagem ou o nome de um produto clicável: abre a ficha com o gráfico de preço, quem
 * produz e quem vende. Usar em volta de qualquer imagem/nome de produto.
 */
export function BotaoProduto({
  product,
  children,
  className = '',
}: {
  product: ProductId;
  children: ReactNode;
  className?: string;
}) {
  const { openProduto } = useGame();
  return (
    <button
      type="button"
      className={`abre-produto ${className}`}
      aria-label={`Ver detalhes de ${products[product].name}`}
      onClick={(ev) => {
        ev.stopPropagation();
        openProduto(product);
      }}
    >
      {children}
    </button>
  );
}
