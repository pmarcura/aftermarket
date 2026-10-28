import { useState } from 'react';
import { useGame, num } from '../../lib/game';
import { Modal } from '../../components/ui';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';

export function OfferModal({
  establishment: e,
  product,
  onClose,
}: {
  establishment: Establishment;
  product: ProductId;
  onClose: () => void;
}) {
  const { world, run, pending } = useGame();
  const [price, setPrice] = useState(
    () =>
      world.offers.find((o) => o.establishmentId === e.id && o.product === product)?.price ??
      seasonPrice(world, product),
  );
  return (
    <Modal title="Anunciar no mercado" onClose={onClose}>
      <p>
        {products[product].name} · {num(e.inventory[product] ?? 0, 2)} {products[product].unit} em
        estoque
      </p>
      <label className="field">
        Preço por {products[product].unit} (R$)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={price / 100}
          onChange={(event) => setPrice(Math.round(Number(event.target.value) * 100))}
        />
      </label>
      <p className="muted small">
        A oferta permite vender apenas o estoque existente. A quantidade disponível diminui a cada
        compra.
      </p>
      <button
        className="primary full"
        disabled={pending || price <= 0}
        onClick={async () => {
          if (
            await run(
              { type: 'publishOffer', establishmentId: e.id, product, price },
              'Oferta publicada no mercado compartilhado.',
            )
          )
            onClose();
        }}
      >
        Publicar oferta
      </button>
    </Modal>
  );
}
