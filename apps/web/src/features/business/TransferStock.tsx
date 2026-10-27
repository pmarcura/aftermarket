import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Modal, Rows, Select } from '../../components/ui';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { FleetPicker } from '../../components/FleetPicker';
import { SupplyConnection } from './SupplyConnection';
import { availableStock } from '../../../../../packages/simulation/src/operations';
import { useRoute } from '../../lib/routing';
import { storageQuantity } from '../../../../../packages/simulation/src/transport';
import { freeCash } from '../../../../../packages/simulation/src/design';
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
    [carrier, setCarrier] = useState(''),
    [recurring, setRecurring] = useState(false);
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
    <Modal title="Transferir entre minhas unidades" onClose={onClose} wide formLayout>
      <div className="inline-actions transfer-modes">
        <button
          className={!recurring ? 'primary' : 'secondary'}
          onClick={() => setRecurring(false)}
        >
          Transferência única
        </button>
        <button className={recurring ? 'primary' : 'secondary'} onClick={() => setRecurring(true)}>
          Reposição automática
        </button>
      </div>
      {recurring ? (
        <SupplyConnection
          initialOrigin={originId}
          initialDestination={destinationId}
          initialProduct={product}
          onSaved={onClose}
        />
      ) : (
        <>
          <p>
            O material mantém seu custo e qualidade. Você paga o transporte; a transferência não
            cria receita de venda.
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
              .map(([id]) => (
                <option key={id} value={id}>
                  {products[id as ProductId].name} ·{' '}
                  {num(availableStock(world, origin!, id as ProductId))}{' '}
                  {products[id as ProductId].unit} livres
                </option>
              ))}
          </Select>
          <label className="field">
            Quantidade
            <input
              aria-label="Quantidade para transferir"
              type="number"
              min="1"
              max={
                q && origin && destination && product
                  ? Math.min(
                      q.fleet.maxQuantity,
                      availableStock(world, origin, product),
                      storageQuantity(world, destination, product),
                    )
                  : undefined
              }
              value={quantity}
              onChange={(ev) => setQuantity(ev.target.value)}
            />
          </label>
          <FleetPicker
            originId={originId}
            destinationId={destinationId}
            product={product}
            quantity={amount}
            value={carrier}
            onChange={setCarrier}
            onQuantityChange={(n) => setQuantity(String(n))}
            label="Transportadora da transferência"
          />
          {q && (
            <Rows
              rows={[
                { label: 'Mercadoria · sem pagamento interno', value: cr(0) },
                {
                  label: q.compatible
                    ? 'Custo total de transporte'
                    : 'Frete apenas da parte alocada',
                  value: cr(q.price),
                },
                {
                  label: 'Veículos necessários',
                  value: q.compatible ? q.parts.length : 'Frota insuficiente',
                },
                { label: 'Prazo real estimado', value: `${Math.ceil(q.durationMs / 1000)} s` },
              ]}
            />
          )}
          {q && q.price > freeCash(world, actor) && (
            <p className="fleet-warning" role="status">
              Frete acima do caixa livre de {cr(freeCash(world, actor))}. Reduza a quantidade ou
              escolha outra frota.
            </p>
          )}
          <button
            className="primary full"
            disabled={
              pending ||
              loading ||
              !q?.compatible ||
              (q?.price ?? 0) > freeCash(world, actor) ||
              (destination && product
                ? amount > storageQuantity(world, destination, product)
                : true) ||
              !product ||
              amount > (origin && product ? availableStock(world, origin, product) : 0)
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
        </>
      )}
    </Modal>
  );
}
