import { useState } from 'react';
import { useGame, cr, num, ProductIcon } from '../lib/game';
import { Modal, Rows, Tabs, Badge } from './ui';
import { products, type Establishment } from '../../../../packages/simulation/src/model';
import {
  dealershipMarkup,
  vehicleModels,
  type VehicleModel,
} from '../../../../packages/simulation/src/catalog';
import { freeCash } from '../../../../packages/simulation/src/design';

// Versão 2: o caminhão vem de uma montadora (de jogador ou bot) ou da concessionária importadora.
const models: { label: string; id: VehicleModel }[] = [
  { label: 'Pesado 30 t', id: 'truckHeavy' },
  { label: 'Leve 8 t', id: 'truckLight' },
];
interface Seller {
  id?: string;
  name: string;
  where: string;
  price: number;
  note: string;
  own?: boolean;
}

export function TruckPurchase({ depot, onClose }: { depot?: Establishment; onClose: () => void }) {
  const { world, actor, run, pending } = useGame();
  const [label, setLabel] = useState(models[0].label);
  const model = models.find((m) => m.label === label)!.id,
    spec = vehicleModels[model];
  const cash = freeCash(world, actor);
  const city = (e: Establishment) => {
    const p = world.properties.find((p) => p.id === e.propertyId)!;
    return `${p.city} — ${p.state}`;
  };
  const companyName = (id: string) => world.companies.find((c) => c.id === id)?.name ?? id;
  const sellers: Seller[] = [
    // Montadora própria entrega pelo custo do estoque, sem pagamento.
    ...world.establishments
      .filter((e) => e.companyId === actor && (e.inventory[model] ?? 0) >= 1)
      .map((e) => ({
        id: e.id,
        name: e.name,
        where: city(e),
        price: Math.round(e.unitCosts[model] ?? 0),
        note: 'Sua montadora · sai do estoque pelo custo',
        own: true,
      })),
    ...world.offers
      .filter((o) => o.product === model)
      .flatMap((o) => {
        const e = world.establishments.find((x) => x.id === o.establishmentId);
        return e && e.companyId !== actor && (e.inventory[model] ?? 0) >= 1
          ? [
              {
                id: e.id,
                name: e.name,
                where: city(e),
                price: o.price,
                note: [
                  ...(companyName(e.companyId) === e.name ? [] : [companyName(e.companyId)]),
                  `${num(e.inventory[model] ?? 0)} em estoque`,
                ].join(' · '),
              },
            ]
          : [];
      })
      .sort((a, b) => a.price - b.price),
    {
      name: 'Concessionária',
      where: 'Importado',
      price: Math.round(products[model].basePrice * dealershipMarkup),
      note: `${num((dealershipMarkup - 1) * 100)}% acima da referência; o dinheiro sai da economia`,
    },
  ];
  const buy = async (s: Seller) => {
    if (
      await run(
        { type: 'buyVehicle', model, ...(s.id ? { sellerEstablishmentId: s.id } : {}) },
        `${spec.label} registrado na frota.`,
      )
    )
      onClose();
  };
  return (
    <Modal title="Comprar caminhão" onClose={onClose}>
      <Tabs values={models.map((m) => m.label)} value={label} onChange={setLabel} />
      <Rows
        rows={[
          { label: 'Capacidade', value: `${spec.capacityT} t / ${spec.capacityM3} m³` },
          {
            label: 'Vida útil',
            value: `${num(spec.lifeKm)} km · depois a manutenção custa o dobro`,
          },
          { label: 'Caixa livre disponível', value: cr(cash) },
          {
            label: 'Registro na frota',
            value: depot ? `${depot.name} · ${city(depot)}` : 'Sem unidade para receber',
          },
        ]}
      />
      {!depot && (
        <p role="status" className="form-message error">
          Adquira qualquer unidade para receber o caminhão.
        </p>
      )}
      <div className="seller-list" role="list" aria-label="Vendedores">
        {sellers.map((s) => {
          const short = !s.own && s.price > cash;
          return (
            <div className="simple-entry seller-entry" role="listitem" key={s.id ?? 'dealership'}>
              <div className="table-name">
                <i className="table-icon">
                  <ProductIcon product={model} size={17} />
                </i>
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {s.where} · {s.note}
                  </small>
                </div>
              </div>
              <div className="seller-action">
                <div>
                  <strong>{cr(s.price, 0)}</strong>
                  {short && <Badge tone="red">Caixa insuficiente</Badge>}
                </div>
                <button
                  className={s.id ? 'primary' : 'secondary'}
                  disabled={pending || short || !depot}
                  aria-label={`Comprar ${spec.label.toLowerCase()} de ${s.name} por ${cr(s.price, 0)}`}
                  onClick={() => buy(s)}
                >
                  Comprar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted small">
        {sellers.length > 1
          ? 'Montadoras do país vendem pelo preço que anunciam; a concessionária é o teto.'
          : 'Nenhuma montadora tem este caminhão anunciado agora; só a concessionária vende.'}
      </p>
    </Modal>
  );
}
