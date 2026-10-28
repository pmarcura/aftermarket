import { useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Select, Rows } from '../../components/ui';
import { FleetPicker } from '../../components/FleetPicker';
import {
  products,
  type ProductId,
  type SupplyPolicy,
  seasonProducts,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import { dailyNeed, supplyForecast } from '../../../../../packages/simulation/src/supply';
import { availableStock } from '../../../../../packages/simulation/src/operations';
import { fleetAvailability } from '../../../../../packages/simulation/src/transport';
import { useRoute } from '../../lib/routing';

export function SupplyConnection({
  initialOrigin = '',
  initialDestination = '',
  initialProduct = '',
  onSaved,
}: {
  initialOrigin?: string;
  initialDestination?: string;
  initialProduct?: ProductId | '';
  onSaved?: (policy: SupplyPolicy) => void;
}) {
  const { world, actor, run, pending } = useGame();
  const [originId, setOrigin] = useState(initialOrigin),
    [destinationId, setDestination] = useState(initialDestination),
    [product, setProduct] = useState<ProductId | ''>(initialProduct),
    [minimum, setMinimum] = useState(''),
    [target, setTarget] = useState(''),
    [budget, setBudget] = useState(''),
    [carrier, setCarrier] = useState('auto');
  const units = world.establishments.filter((e) => e.companyId === actor),
    origin = units.find((e) => e.id === originId),
    destination = units.find((e) => e.id === destinationId);
  const loading = useRoute(origin?.propertyId, destination?.propertyId);
  const base = destination
    ? (destination.supplyPolicy ?? defaultSupplyPolicy(world, destination))
    : undefined;
  const daily = Number(budget) * 100;
  const valid = !!(
    origin &&
    destination &&
    origin.id !== destination.id &&
    product &&
    minimum !== '' &&
    Number.isSafeInteger(Number(minimum)) &&
    Number(minimum) >= 0 &&
    Number.isSafeInteger(Number(target)) &&
    Number(target) > Number(minimum) &&
    Number(target) <= 1e6 &&
    Number.isSafeInteger(Math.round(daily)) &&
    daily > 0
  );
  const policy =
    base && product
      ? {
          ...base,
          enabled: true,
          dailyBudget: Math.round(daily),
          carrierId: carrier,
          rules: [
            ...base.rules.filter((r) => r.product !== product),
            {
              product,
              originId,
              minimum: Number(minimum),
              target: Number(target),
              maxBuy: Number(target),
              maxPrice: 0,
            },
          ],
        }
      : undefined;
  const forecast =
    valid && policy && destination ? supplyForecast(world, destination, policy) : undefined;
  const currentRule = forecast?.rows.find((r) => r.product === product);
  const best = currentRule?.best;
  const own = product ? fleetAvailability(world, actor, product) : undefined;
  const existing = base?.rules.find((r) => r.product === product);
  return (
    <section className="supply-connection" aria-label="Conectar estruturas para reposição">
      <div className="section-title">
        <div>
          <h3>
            <Link2 size={17} /> Conectar estruturas
          </h3>
          <p className="small muted">
            Uma origem fixa por produto. Ao atingir o mínimo, o destino solicita reposição até o
            alvo. Cargas a caminho já contam.
          </p>
        </div>
      </div>
      <div className="connection-flow">
        <Select
          label="Origem da conexão"
          value={originId}
          onChange={(e) => setOrigin(e.target.value)}
        >
          <option value="">Escolher minha produtora ou estoque</option>
          {units
            .filter((e) => e.id !== destinationId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </Select>
        <ArrowRight size={19} />
        <Select
          label="Destino da conexão"
          value={destinationId}
          onChange={(e) => setDestination(e.target.value)}
        >
          <option value="">Escolher fábrica ou armazenamento</option>
          {units
            .filter((e) => e.id !== originId)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </Select>
      </div>
      <Select
        label="Produto da conexão"
        value={product}
        onChange={(e) => setProduct(e.target.value as ProductId)}
      >
        <option value="">Escolher mercadoria</option>
        {seasonProducts(world)
          .map((id) => [id, products[id]] as const)
          .map(([id, p]) => (
            <option key={id} value={id}>
              {p.name}
              {origin ? ` · ${num(availableStock(world, origin, id as ProductId))} livres` : ''}
            </option>
          ))}
      </Select>
      {origin && destination && product && (
        <>
          <div className="connection-path">
            <strong>{origin.name}</strong>
            <ArrowRight size={18} />
            <span>{products[product].name}</span>
            <ArrowRight size={18} />
            <strong>{destination.name}</strong>
          </div>
          <p className="small muted">
            Consumo estimado do destino: {num(dailyNeed(world, destination, product), 1)}{' '}
            {products[product].unit}/dia. Minha frota: {own?.available}/{own?.total} livres · até{' '}
            {num(own?.maxQuantity ?? 0)} {products[product].unit} por despacho.
          </p>
        </>
      )}
      <div className="connection-fields">
        <label className="field">
          Repor ao atingir
          <input
            aria-label="Mínimo da conexão"
            type="number"
            min="0"
            value={minimum}
            onChange={(e) => setMinimum(e.target.value)}
          />
        </label>
        <label className="field">
          Estoque alvo
          <input
            aria-label="Alvo da conexão"
            type="number"
            min="1"
            max="1000000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className="field">
          Orçamento total do destino / dia (R$)
          <input
            aria-label="Orçamento da conexão"
            type="number"
            min=".01"
            step=".01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
      </div>
      <div className="inline-actions">
        <button
          className={carrier === 'auto' ? 'primary' : 'secondary'}
          onClick={() => setCarrier('auto')}
        >
          Melhor frete disponível
        </button>
        <button
          className={carrier === 'own' ? 'primary' : 'secondary'}
          onClick={() => setCarrier('own')}
        >
          Somente minha frota
        </button>
      </div>
      {origin && destination && product && (
        <FleetPicker
          originId={originId}
          destinationId={destinationId}
          product={product}
          quantity={Math.max(0, Number(target) - (destination.inventory[product] ?? 0))}
          value={carrier === 'own' ? actor : carrier === 'auto' ? '' : carrier}
          onChange={setCarrier}
          label="Comparar frota da conexão"
        />
      )}
      {valid && (
        <Rows
          rows={[
            {
              label: 'Reposição possível agora',
              value: best
                ? `${num(best.quantity)} ${products[product as ProductId].unit} · ${best.q.parts.length} caminhões`
                : loading
                  ? 'Calculando rota pelas estradas…'
                  : currentRule?.want === 0
                    ? 'Estoque e entradas já cobrem o mínimo'
                    : 'Aguardar estoque, espaço ou frota',
            },
            { label: 'Custo de mercadoria interna', value: cr(0) },
            {
              label: 'Desembolso sinalizado por todas as regras',
              value: cr(forecast?.cashNeeded ?? 0),
            },
            { label: 'Frete da reposição possível', value: best ? cr(best.q.price) : '—' },
            {
              label: 'Orçamento diário compartilhado por todas as regras',
              value: cr(Math.round(daily)),
            },
            { label: 'Reserva de caixa preservada', value: cr(base?.cashReserve ?? 0) },
          ]}
        />
      )}
      {best && best.total > daily && (
        <p className="fleet-warning">
          O orçamento diário é menor que o frete mostrado. A automação poderá reduzir a quantidade
          ou aguardar; não gastará acima do limite.
        </p>
      )}
      {policy && (
        <div className="fleet-warning">
          <strong>
            {base?.enabled
              ? 'Política do destino já ativa.'
              : 'Ao salvar, todas estas regras do destino ficam ativas:'}
          </strong>
          <p>
            {policy.rules
              .map(
                (r) =>
                  `${products[r.product].name}: mínimo ${num(r.minimum)} / alvo ${num(r.target)}`,
              )
              .join(' · ')}
          </p>
        </div>
      )}
      <p className="small muted">
        {existing ? 'Esta conexão substitui a regra deste produto. ' : ''}As outras regras do
        destino permanecem; orçamento e escolha de frota passam a valer para todas elas. O destino
        deve estar operacional. Sem estoque nesta origem, a conexão aguarda e não compra fora dela.
        Revise limites de distância, qualidade e caixa em Abastecimento avançado.
      </p>
      <button
        className="primary full"
        disabled={pending || !valid}
        onClick={async () => {
          if (
            destination &&
            policy &&
            (await run(
              { type: 'configureSupply', establishmentId: destination.id, policy },
              'Conexão salva. A reposição será avaliada na próxima rodada, dentro dos limites.',
            ))
          )
            onSaved?.(policy);
        }}
      >
        Ativar conexão de reposição
      </button>
    </section>
  );
}
