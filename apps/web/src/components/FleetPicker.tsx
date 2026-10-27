import { useState } from 'react';
import { Truck, Search, Check } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { Badge, Rows } from './ui';
import { products, TIME_SCALE, type ProductId } from '../../../../packages/simulation/src/model';
import { quote } from '../../../../packages/simulation/src/engine';
import { fleetAvailability, storageQuantity } from '../../../../packages/simulation/src/transport';
import { availableStock } from '../../../../packages/simulation/src/operations';

export function FleetPicker({
  originId,
  destinationId,
  product,
  quantity,
  value,
  onChange,
  onQuantityChange,
  label = 'Escolher frota',
}: {
  originId?: string;
  destinationId?: string;
  product?: ProductId | '';
  quantity: number;
  value: string;
  onChange: (id: string) => void;
  onQuantityChange?: (n: number) => void;
  label?: string;
}) {
  const { world, actor } = useGame();
  const [search, setSearch] = useState(''),
    [expanded, setExpanded] = useState(false);
  const origin = world.establishments.find((e) => e.id === originId);
  const destination = world.establishments.find((e) => e.id === destinationId);
  if (!origin || !destination || !product)
    return (
      <div className="fleet-empty">
        Escolha origem, destino e mercadoria para consultar as frotas.
      </div>
    );
  const p = products[product],
    stock = availableStock(world, origin, product),
    space = storageQuantity(world, destination, product);
  const rows = world.companies
    .filter(
      (c) =>
        (c.id === actor || (c.bot && !c.id.startsWith('treasury'))) &&
        (c.id === actor || world.vehicles.some((v) => v.companyId === c.id)),
    )
    .map((c) => {
      const fleet = fleetAvailability(world, c.id, product),
        max = Math.min(stock, space, fleet.maxQuantity);
      const amount = Math.min(Math.max(0, Math.floor(quantity)), max);
      const q =
        amount > 0 ? quote(world, origin.id, destination.id, product, amount, c.id) : undefined;
      const full = quantity > 0 && Number.isSafeInteger(quantity) && quantity <= max;
      const reason = !fleet.available
        ? 'Nenhum veículo livre'
        : !fleet.maxQuantity
          ? 'Produto não cabe nos veículos'
          : !stock
            ? 'Origem sem estoque livre'
            : !space
              ? 'Destino sem espaço'
              : quantity > max
                ? 'Quantidade acima do máximo'
                : q?.routeRequired
                  ? 'Aguardando rota rodoviária'
                  : quantity <= 0
                    ? 'Informe uma quantidade'
                    : '';
      return { c, fleet, max, q, full, reason };
    })
    .sort(
      (a, b) =>
        Number(b.full) - Number(a.full) ||
        Number(b.max > 0) - Number(a.max > 0) ||
        (a.q?.price ?? Infinity) - (b.q?.price ?? Infinity) ||
        a.c.name.localeCompare(b.c.name),
    );
  const selected = rows.find((r) => r.c.id === value),
    shown = expanded || !selected;
  const filtered = rows.filter((r) =>
    `${r.c.id === actor ? 'Minha frota' : ''} ${r.c.name}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  const eligibleCount = rows.filter((r) => r.full && !r.q?.routeRequired).length;
  return (
    <section className="fleet-picker" aria-label={label}>
      <div className="section-title">
        <div>
          <h3>
            <Truck size={17} /> {label}
          </h3>
          <p className="small muted">
            {eligibleCount} {eligibleCount === 1 ? 'frota atende' : 'frotas atendem'} a quantidade ·
            capacidade livre agora
          </p>
        </div>
        {selected && (
          <button type="button" className="secondary" onClick={() => setExpanded(!expanded)}>
            {shown ? 'Recolher opções' : 'Comparar frotas'}
          </button>
        )}
      </div>
      <div className="fleet-load">
        <span>
          {num(Math.max(0, quantity) * p.massT, 2)} t · {num(Math.max(0, quantity) * p.volumeM3, 2)}{' '}
          m³
        </span>
        <span>
          Estoque livre:{' '}
          <b>
            {num(stock)} {p.unit}
          </b>
        </span>
        <span>
          Espaço no destino:{' '}
          <b>
            {num(space)} {p.unit}
          </b>
        </span>
      </div>
      {shown && (
        <label className="fleet-search">
          <Search size={16} />
          <input
            aria-label={`Buscar ${label.toLowerCase()}`}
            placeholder="Buscar empresa ou minha frota…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      )}
      <div className={shown ? 'fleet-options' : 'fleet-summary'}>
        {(shown ? filtered : selected ? [selected] : []).map(
          ({ c, fleet, max, q, full, reason }) => (
            <article
              className={`fleet-card ${value === c.id ? 'selected' : ''}`}
              key={c.id}
              data-carrier={c.id}
            >
              <div className="section-title">
                <div>
                  <strong>{c.id === actor ? 'Minha frota' : c.name}</strong>
                  <small>
                    {fleet.available} livres / {fleet.total} veículos · {fleet.busy} em rota ·{' '}
                    {fleet.maintenance} em manutenção
                  </small>
                </div>
                <Badge tone={full && !q?.routeRequired ? 'green' : 'gold'}>
                  {reason || 'Atende a carga'}
                </Badge>
              </div>
              <div className="fleet-card-metrics">
                <div>
                  <span>Máximo da frota</span>
                  <b>
                    {num(fleet.maxQuantity)} {p.unit}
                  </b>
                  <small>
                    {num(fleet.mass, 1)} t · {num(fleet.volume, 1)} m³ livres
                  </small>
                </div>
                <div>
                  <span>Máximo nesta operação</span>
                  <b>
                    {num(max)} {p.unit}
                  </b>
                  <small>frota, estoque e destino</small>
                </div>
                <div>
                  <span>{full ? 'Frete da quantidade' : 'Frete parcial estimado'}</span>
                  <b>{q ? cr(q.price) : '—'}</b>
                  <small>
                    {q
                      ? `${q.parts.length} veículos · ${num((q.durationMs * TIME_SCALE) / 3600000, 1)} h no jogo`
                      : 'Sem despacho possível'}
                  </small>
                </div>
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className={value === c.id ? 'primary' : 'secondary'}
                  aria-label={`Selecionar ${c.id === actor ? 'Minha frota' : c.name}`}
                  aria-pressed={value === c.id}
                  disabled={!full || !q?.compatible}
                  onClick={() => {
                    onChange(c.id);
                    setExpanded(false);
                  }}
                >
                  {value === c.id ? (
                    <>
                      <Check size={15} /> Selecionada
                    </>
                  ) : (
                    'Usar esta frota'
                  )}
                </button>
                {onQuantityChange && max > 0 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      onQuantityChange(max);
                      onChange(c.id);
                      setExpanded(false);
                    }}
                  >
                    Usar máximo · {num(max)} {p.unit}
                  </button>
                )}
              </div>
              {value === c.id && q && (
                <details>
                  <summary>Ver caminhões e custos</summary>
                  <Rows
                    rows={q.parts.map((part) => ({
                      label:
                        world.vehicles.find((v) => v.id === part.vehicleId)?.name ?? part.vehicleId,
                      value: `${num(part.quantity)} ${p.unit} · ${cr(part.price)}`,
                    }))}
                  />
                  <p className="small muted">
                    {q.ownFleet
                      ? 'Frota própria: combustível, motorista, manutenção, pedágio estimado e manuseio.'
                      : 'Serviço terceirizado: operação e margem da transportadora.'}{' '}
                    A disponibilidade e o preço são revalidados no aceite.
                  </p>
                </details>
              )}
            </article>
          ),
        )}
        {shown && !filtered.length && <p className="muted">Nenhuma frota corresponde à busca.</p>}
      </div>
      {selected?.reason && (
        <p className="fleet-warning" role="status">
          {selected.reason}. Ajuste a quantidade ou compare outra frota antes de confirmar.
        </p>
      )}
    </section>
  );
}
