import { useMemo } from 'react';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useGame, cr } from '../../lib/game';
import { Empty } from '../../components/ui';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { mercadoDaCidade } from './precificacao';
import { LinhaPreco } from './LinhaPreco';

/**
 * A prateleira da loja: cada produto com a régua de preço (custo, concorrência, preço justo e o
 * preço de maior lucro) e a estimativa de venda e lucro por dia para qualquer preço testado.
 */
export function Prateleira({ loja }: { loja: Establishment }) {
  const { world, run, pending, openMarket } = useGame();
  const itens = (Object.keys(loja.inventory) as ProductId[]).sort(
    (a, b) => (loja.inventory[b] ?? 0) - (loja.inventory[a] ?? 0),
  );
  const mercados = useMemo(
    () => Object.fromEntries(itens.map((id) => [id, mercadoDaCidade(world, loja, id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, itens.join()],
  );
  if (!itens.length)
    return (
      <Empty
        title="A prateleira está vazia"
        description="Compre o primeiro produto no Comércio. Quando a carga chegar, ele aparece aqui com o preço sugerido."
        action={
          <button className="primary" onClick={() => openMarket({ destinationId: loja.id })}>
            <ShoppingCart size={16} /> Comprar mercadorias
          </button>
        }
      />
    );
  const atual = itens.reduce(
    (n, id) => n + mercados[id].lucro(loja.prices[id] ?? mercados[id].justo),
    0,
  );
  const possivel = itens.reduce((n, id) => n + mercados[id].lucro(mercados[id].melhor), 0);
  const ajustar = itens.filter((id) => {
    const p = loja.prices[id] ?? 0;
    return Math.abs(p - mercados[id].melhor) / mercados[id].melhor > 0.03;
  });
  return (
    <div className="prat">
      <div className="prat-resumo">
        <div>
          <span>Com os preços de agora</span>
          <b className={atual >= 0 ? '' : 'negative'}>{cr(atual, 0)}</b>
          <small>de lucro bruto por dia na prateleira</small>
        </div>
        <div className="melhor">
          <span>Com os melhores preços</span>
          <b>{cr(possivel, 0)}</b>
          <small>
            {possivel - atual > 100
              ? `+${cr(possivel - atual, 0)} por dia ajustando ${ajustar.length} ${ajustar.length === 1 ? 'preço' : 'preços'}`
              : 'seus preços já estão perto do melhor'}
          </small>
        </div>
        {ajustar.length > 0 && possivel - atual > 100 && (
          <button
            className="primary"
            disabled={pending}
            onClick={async () => {
              for (const id of ajustar)
                await run(
                  {
                    type: 'setPrice',
                    establishmentId: loja.id,
                    product: id,
                    price: mercados[id].melhor,
                  },
                  `Preço de ${products[id].name} ajustado para ${cr(mercados[id].melhor)}.`,
                );
            }}
          >
            <Sparkles size={16} /> Usar os melhores preços
          </button>
        )}
      </div>
      {itens.map((id) => (
        <LinhaPreco key={id} loja={loja} product={id} m={mercados[id]} />
      ))}
      <p className="muted small">
        Estimativa com a procura da cidade, a qualidade do estoque e os preços das lojas
        concorrentes, pela mesma regra que decide as vendas. Equipe, área e estoque podem limitar a
        venda real.
      </p>
    </div>
  );
}
