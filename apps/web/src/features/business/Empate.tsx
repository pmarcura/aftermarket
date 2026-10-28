import { ShoppingCart, Truck } from 'lucide-react';
import { useGame, cr, ProductIcon } from '../../lib/game';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { avaliar, procuraDiaria, quantidadeSugerida } from '../economy/compra';

/**
 * Quanto a loja precisa ganhar por dia para pagar equipe e contas, quanto a prateleira de hoje
 * rende e quais produtos fecham a diferença. Tudo é estimativa com a procura média da cidade.
 */
export function Empate({ loja }: { loja: Establishment }) {
  const { world, actor, openMarket } = useGame();
  const fixo = loja.dailyCost;
  const naPrateleira = (Object.entries(loja.inventory) as [ProductId, number][]).filter(
    ([id, q]) => q > 0 && (loja.prices[id] ?? 0) > 0,
  );
  const ganho = naPrateleira.reduce(
    (n, [id]) =>
      n + procuraDiaria(world, loja, id) * ((loja.prices[id] ?? 0) - (loja.unitCosts[id] ?? 0)),
    0,
  );
  const aCaminho = new Set(
    world.shipments
      .filter((s) => s.destinationId === loja.id && !s.delivered)
      .map((s) => s.product),
  );
  // Produtos que a loja ainda não vende, com a melhor oferta já posta na porta.
  const ideias = householdItems(world)
    .filter((id) => !((loja.inventory[id] ?? 0) > 0) && !aCaminho.has(id))
    .map((id) => {
      const melhores = world.offers
        .filter((o) => o.product === id)
        .map((o) => {
          const vendedor = world.establishments.find((e) => e.id === o.establishmentId)!;
          const estoque = vendedor.inventory[id] ?? 0;
          const q = quantidadeSugerida(world, loja, id, estoque);
          return q > 0 ? avaliar(world, actor, o, loja, q) : undefined;
        })
        .filter((a) => a?.frete)
        .sort((a, b) => a!.naPorta - b!.naPorta);
      const a = melhores[0];
      const porDia = a ? procuraDiaria(world, loja, id) * (seasonPrice(world, id) - a.naPorta) : 0;
      return { id, porDia };
    })
    .filter((x) => x.porDia > 0)
    .sort((a, b) => b.porDia - a.porDia)
    .slice(0, 3);
  const saldo = ganho - fixo;
  const teto = Math.max(fixo, ganho, 1) * 1.15;
  return (
    <section className="empate" aria-label="Quanto falta para a loja empatar">
      <div className="empate-texto">
        <h2>
          {saldo >= 0
            ? `A loja paga as contas e sobra ${cr(saldo, 0)} por dia`
            : `Faltam ${cr(-saldo, 0)} por dia para a loja empatar`}
        </h2>
        <p>
          Equipe, energia, água e manutenção custam {cr(fixo, 0)} por dia. O que está na prateleira
          rende cerca de {cr(Math.max(0, ganho), 0)} por dia em margem.
          {aCaminho.size > 0 && (
            <span className="empate-caminho">
              {' '}
              <Truck size={13} aria-hidden="true" /> {aCaminho.size} produto
              {aCaminho.size > 1 ? 's' : ''} a caminho ainda não entra na conta.
            </span>
          )}
        </p>
      </div>
      <div
        className="empate-medidor"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.round(teto)}
        aria-valuenow={Math.round(Math.max(0, ganho))}
        aria-label="Margem por dia comparada ao custo fixo"
      >
        <span
          className={`empate-barra ${saldo >= 0 ? 'ok' : ''}`}
          style={{ width: `${(Math.max(0, ganho) / teto) * 100}%` }}
        />
        <span className="empate-linha" style={{ left: `${(fixo / teto) * 100}%` }}>
          <small>empate</small>
        </span>
      </div>
      {saldo < 0 && ideias.length > 0 && (
        <div className="empate-ideias">
          <span>Produtos que mais ajudam, com frete:</span>
          {ideias.map(({ id, porDia }) => (
            <button
              key={id}
              className="secondary"
              onClick={() => openMarket({ destinationId: loja.id, product: id })}
            >
              <ProductIcon product={id} /> {products[id].name}
              <b className="positive">+{cr(porDia, 0)}/dia</b>
              <ShoppingCart size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <small className="muted">
        Estimativa com a procura média da cidade e as lojas concorrentes. Preço, qualidade e estoque
        dos rivais mudam a venda real.
      </small>
    </section>
  );
}
