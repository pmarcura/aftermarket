import { ShoppingCart, Truck } from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { avaliar, procuraDiaria, quantidadeSugerida } from '../economy/compra';
import { mercadoDaCidade } from './precificacao';

/**
 * Cabeçalho da loja: a peça, quem ela é e a conta do dia. Margem estimada da prateleira (com a
 * concorrência da cidade, a mesma conta da Prateleira) contra o custo de manter as portas abertas.
 */
export function LojaCabecalho({ loja }: { loja: Establishment }) {
  const { world, actor, openMarket, openBusiness } = useGame();
  const p = world.properties.find((x) => x.id === loja.propertyId)!;
  const fixo = loja.dailyCost;
  const naPrateleira = (Object.entries(loja.inventory) as [ProductId, number][]).filter(
    ([id, q]) => q > 0 && (loja.prices[id] ?? 0) > 0,
  );
  const ganho = naPrateleira.reduce(
    (n, [id]) => n + mercadoDaCidade(world, loja, id).lucro(loja.prices[id]!),
    0,
  );
  const aCaminho = new Set(
    world.shipments
      .filter((s) => s.destinationId === loja.id && !s.delivered)
      .map((s) => s.product),
  );
  const saldo = ganho - fixo;
  // Só quando falta: os produtos que a loja não vende e mais ajudam, com a melhor oferta na porta.
  const ideias =
    saldo >= 0
      ? []
      : householdItems(world)
          .filter((id) => !((loja.inventory[id] ?? 0) > 0) && !aCaminho.has(id))
          .map((id) => {
            const a = world.offers
              .filter((o) => o.product === id)
              .map((o) => {
                const vendedor = world.establishments.find((e) => e.id === o.establishmentId)!;
                const q = quantidadeSugerida(world, loja, id, vendedor.inventory[id] ?? 0);
                return q > 0 ? avaliar(world, actor, o, loja, q) : undefined;
              })
              .filter((x) => x?.frete)
              .sort((x, y) => x!.naPorta - y!.naPorta)[0];
            const porDia = a
              ? procuraDiaria(world, loja, id) * (seasonPrice(world, id) - a.naPorta)
              : 0;
            return { id, porDia };
          })
          .filter((x) => x.porDia > 0)
          .sort((a, b) => b.porDia - a.porDia)
          .slice(0, 3);
  // Barra em blocos: 24 blocos; a linha marca o custo fixo.
  const escala = Math.max(fixo * 1.6, ganho * 1.05, 1);
  const blocos = 24;
  const cheios = Math.round((Math.max(0, ganho) / escala) * blocos);
  const empate = (fixo / escala) * 100;
  const outras = world.establishments.filter(
    (x) => x.companyId === actor && x.category === 'retail',
  );
  return (
    <header className="loja-cab">
      <div className="loja-peca">
        <PixelArt name="loja" scale={2} />
      </div>
      <div className="loja-id">
        <span className="eyebrow">Meus Negócios › Loja</span>
        <h1>{loja.name}</h1>
        <small>
          {p.city}, {p.state} · {loja.enabled ? 'portas abertas' : 'pausada'} ·{' '}
          {num(loja.employees)} {loja.employees === 1 ? 'funcionário' : 'funcionários'}
        </small>
        {outras.length > 1 && (
          <select
            aria-label="Trocar de loja"
            value={loja.id}
            onChange={(ev) => openBusiness(ev.target.value)}
          >
            {outras.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="loja-dia">
        <div className="loja-nums">
          <div>
            <b>{cr(Math.max(0, ganho), 0)}</b>
            <span>margem da prateleira por dia</span>
          </div>
          <div>
            <b>{cr(fixo, 0)}</b>
            <span>para manter as portas abertas</span>
          </div>
          <div className={saldo >= 0 ? 'bom' : 'ruim'}>
            <b>
              {saldo >= 0 ? '+' : '−'}
              {cr(Math.abs(saldo), 0)}
            </b>
            <span>{saldo >= 0 ? 'sobra por dia' : 'falta por dia'}</span>
          </div>
        </div>
        <div
          className="loja-barra"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={Math.round(escala)}
          aria-valuenow={Math.round(Math.max(0, ganho))}
          aria-label="Margem por dia comparada ao custo de manter a loja"
        >
          {Array.from({ length: blocos }, (_, i) => (
            <i
              key={i}
              className={
                i < cheios ? (((i + 0.5) / blocos) * 100 < empate ? 'abaixo' : 'acima') : ''
              }
            />
          ))}
          <span className="loja-empate" style={{ left: `${empate}%` }}>
            <small>empate</small>
          </span>
        </div>
        {aCaminho.size > 0 && (
          <small className="loja-caminho">
            <Truck size={13} aria-hidden="true" /> {aCaminho.size}{' '}
            {aCaminho.size === 1
              ? 'carga a caminho ainda não entra'
              : 'cargas a caminho ainda não entram'}{' '}
            na conta.
          </small>
        )}
      </div>
      <div className="loja-acoes">
        <button className="primary" onClick={() => openMarket({ destinationId: loja.id })}>
          <ShoppingCart size={16} /> Comprar mercadorias
        </button>
      </div>
      {ideias.length > 0 && (
        <div className="loja-ideias">
          <span>Para empatar, o que mais ajuda vender:</span>
          {ideias.map(({ id, porDia }) => (
            <button
              key={id}
              className="secondary"
              onClick={() => openMarket({ destinationId: loja.id, product: id })}
            >
              <ProductIcon product={id} /> {products[id].name}
              <b>+{cr(porDia, 0)}/dia</b>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
