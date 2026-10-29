import { useMemo } from 'react';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Empty } from '../../components/ui';
import { products, type Establishment } from '../../../../../packages/simulation/src/model';
import { gameCalendar } from '../../../../../packages/simulation/src/operations';
import { unidade } from '../economy/Carga';
import { contaDaPrateleira } from './precificacao';
import { LinhaPreco } from './LinhaPreco';

/**
 * A prateleira da loja: o que acaba primeiro vem primeiro. Cada produto com o anel de estoque, a
 * régua de preço e a estimativa de venda e lucro por dia para qualquer preço testado.
 */
export function Prateleira({ loja }: { loja: Establishment }) {
  const { world, run, pending, openMarket } = useGame();
  const conta = useMemo(
    () => contaDaPrateleira(world, loja),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id],
  );
  if (!conta.itens.length)
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
  const ganho = conta.melhor - conta.agora;
  return (
    <div className="prat">
      {conta.ajustar.length > 0 && ganho > 100 && (
        <div className="prat-dica">
          <Sparkles size={18} aria-hidden="true" />
          <p>
            Ajustando {conta.ajustar.length} {conta.ajustar.length === 1 ? 'preço' : 'preços'}, a
            prateleira lucra cerca de <b>+{cr(ganho, 0)}</b> a mais por dia (estimativa).
          </p>
          <button
            className="primary"
            disabled={pending}
            onClick={async () => {
              for (const [i, x] of conta.ajustar.entries())
                await run(
                  { type: 'setPrice', establishmentId: loja.id, product: x.id, price: x.m.melhor },
                  `Preços ajustados (${i + 1} de ${conta.ajustar.length}).`,
                );
            }}
          >
            Usar os melhores preços
          </button>
        </div>
      )}
      {conta.itens.map((x) => (
        <LinhaPreco key={x.id} loja={loja} product={x.id} m={x.m} />
      ))}
      <p className="muted small">
        Estimativa com a procura da cidade, a qualidade do estoque e os preços das lojas
        concorrentes, pela mesma regra que decide as vendas. Equipe, área e estoque podem limitar a
        venda real.
      </p>
      <Caixa loja={loja} />
    </div>
  );
}

/** As últimas vendas às famílias, como a fita de uma caixa registradora. */
function Caixa({ loja }: { loja: Establishment }) {
  const { world } = useGame();
  const vendas = world.ledger
    .filter((l) => l.establishmentId === loja.id && l.kind === 'retail')
    .slice(-8)
    .reverse();
  return (
    <section className="prat-caixa" aria-labelledby="prat-caixa">
      <h3 id="prat-caixa">Últimas vendas</h3>
      {vendas.length ? (
        <ol>
          {vendas.map((l, i) => {
            const quando = gameCalendar(world, l.at).date;
            return (
              <li key={l.id} className={i === 0 ? 'nova' : ''}>
                <time>
                  {quando.getUTCHours().toString().padStart(2, '0')}h
                  {quando.getUTCMinutes().toString().padStart(2, '0')}
                </time>
                <span>
                  {num(l.quantity ?? 0)} {l.product ? unidade(l.product, l.quantity ?? 0) : ''} de{' '}
                  {l.product ? products[l.product].name : l.description}
                </span>
                <b>+{cr(l.amount, 0)}</b>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted small">
          As famílias compram a cada 2 horas de jogo. A primeira venda aparece aqui.
        </p>
      )}
    </section>
  );
}
