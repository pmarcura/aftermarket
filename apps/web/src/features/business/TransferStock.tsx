import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Modal, Rows, Select } from '../../components/ui';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useRoute } from '../../lib/routing';
export function TransferStock({
  originId: initialOrigin = '',
  destinationId: initialDestination = '',
  product: initialProduct = '',
  onClose,
}: {
  originId?: string;
  destinationId?: string;
  product?: ProductId | '';
  onClose: () => void;
}) {
  const { world, actor, run, pending } = useGame();
  const [originId, setOrigin] = useState(initialOrigin),
    [destinationId, setDestination] = useState(initialDestination),
    [product, setProduct] = useState(initialProduct),
    [quantity, setQuantity] = useState(''),
    [carrier, setCarrier] = useState('');
  const units = world.establishments.filter((e) => e.companyId === actor),
    origin = units.find((e) => e.id === originId),
    destination = units.find((e) => e.id === destinationId),
    amount = Number(quantity);
  const loading = useRoute(origin?.propertyId, destination?.propertyId);
  const q =
    origin && destination && product && carrier && Number.isInteger(amount) && amount > 0
      ? quote(world, origin.id, destination.id, product as ProductId, amount, carrier)
      : undefined;
  return (
    <Modal title="Transferir entre minhas unidades" onClose={onClose}>
      <p>
        O material mantém seu custo e qualidade. Você paga o transporte; a transferência não cria
        receita de venda.
      </p>
      <Select
        label="Origem da transferência"
        value={originId}
        onChange={(ev) => {
          setOrigin(ev.target.value);
          setProduct('');
        }}
      >
        <option value="">Escolher estoque de origem</option>
        {units
          .filter((e) => e.id !== destinationId)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </Select>
      <Select
        label="Destino da transferência"
        value={destinationId}
        onChange={(ev) => setDestination(ev.target.value)}
      >
        <option value="">Escolher destino</option>
        {units
          .filter((e) => e.id !== originId)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
      </Select>
      <Select
        label="Produto da transferência"
        value={product}
        onChange={(ev) => setProduct(ev.target.value as ProductId)}
      >
        <option value="">Escolher mercadoria</option>
        {Object.entries(origin?.inventory ?? {})
          .filter(([, q]) => q! > 0)
          .map(([id, q]) => (
            <option key={id} value={id}>
              {products[id as ProductId].name} · {num(q!)} disponíveis
            </option>
          ))}
      </Select>
      <label className="field">
        Quantidade
        <input
          aria-label="Quantidade para transferir"
          type="number"
          min="1"
          value={quantity}
          onChange={(ev) => setQuantity(ev.target.value)}
        />
      </label>
      <Select
        label="Transportadora da transferência"
        value={carrier}
        onChange={(ev) => setCarrier(ev.target.value)}
      >
        <option value="">Escolher frota</option>
        {world.companies
          .filter(
            (c) => (c.id === actor || c.bot) && world.vehicles.some((v) => v.companyId === c.id),
          )
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.id === actor ? 'Minha frota' : c.name}
            </option>
          ))}
      </Select>
      {q && (
        <Rows
          rows={[
            { label: 'Mercadoria · sem pagamento interno', value: cr(0) },
            { label: 'Custo de transporte', value: cr(q.price) },
            {
              label: 'Veículos necessários',
              value: q.compatible ? q.parts.length : 'Frota insuficiente',
            },
            { label: 'Prazo real estimado', value: `${Math.ceil(q.durationMs / 1000)} s` },
          ]}
        />
      )}
      <button
        className="primary full"
        disabled={
          pending ||
          loading ||
          !q?.compatible ||
          !product ||
          amount > (origin?.inventory[product as ProductId] ?? 0)
        }
        onClick={async () => {
          if (
            await run(
              {
                type: 'transferStock',
                originId,
                destinationId,
                product: product as ProductId,
                quantity: amount,
                carrierId: carrier,
                expectedFreight: q!.price,
              },
              'Transferência despachada. Pedido disponível na logística.',
            )
          )
            onClose();
        }}
      >
        Confirmar transferência e transporte
      </button>
    </Modal>
  );
}
