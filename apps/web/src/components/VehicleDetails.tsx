import { useState } from 'react';
import { useGame, cr, num } from '../lib/game';
import { Modal, Rows, Progress } from './ui';
import { products, type Command, type Vehicle } from '../../../../packages/simulation/src/model';
import { scrapRecovery, vehicleModels } from '../../../../packages/simulation/src/catalog';
import { vehicleSalePrice, vehicleWear } from '../../../../packages/simulation/src/engine';

export const vehicleStatus = (v: Vehicle) =>
  v.status === 'available' ? 'Disponível' : v.status === 'route' ? 'Em rota' : 'Manutenção';
export const vehicleType = (v: Vehicle) =>
  v.model
    ? vehicleModels[v.model].label
    : `Caminhão ${v.capacityT === 30 ? 'pesado' : v.capacityT === 16 ? 'médio' : 'leve'}`;

export function VehicleDetails({ vehicle: v, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { world, actor, run, pending } = useGame();
  const [confirm, setConfirm] = useState<{ text: string; label: string; command: Command }>();
  const v2 = !!world.season.config.economyVersion;
  const place = world.properties.find((p) => p.id === v.propertyId);
  const yard = world.establishments.find(
    (e) => e.propertyId === v.propertyId && e.companyId === actor,
  );
  const wear = vehicleWear(world, v),
    sale = vehicleSalePrice(world, v);
  const scrapT = (products[v.model ?? 'truckHeavy'].massT ?? 9) * scrapRecovery,
    scrapValue = Math.round(scrapT * (world.season.config.basePrices.scrap ?? 0));
  const free = v.status === 'available';
  const act = async () => {
    if (confirm && (await run(confirm.command, confirm.label))) onClose();
  };
  return (
    <Modal title={v.name} onClose={onClose}>
      <Rows
        rows={[
          { label: 'Modelo', value: vehicleType(v) },
          { label: 'Capacidade', value: `${v.capacityT} t / ${v.capacityM3} m³` },
          { label: 'Localização', value: place ? `${place.city} — ${place.state}` : '—' },
          { label: 'Estado', value: vehicleStatus(v) },
          { label: 'Valor pago', value: cr(v.purchasePrice ?? 28000000, 0) },
          ...(v2 && v.model
            ? [
                {
                  label: 'Quilometragem',
                  value: `${num(v.odometerKm ?? 0)} de ${num(vehicleModels[v.model].lifeKm)} km`,
                },
                {
                  label: 'Manutenção por km',
                  value: wear > 0.005 ? `+${num(wear * 100)}% sobre um caminhão novo` : 'Como nova',
                },
              ]
            : []),
        ]}
      />
      {v2 && v.model && <Progress value={wear * 100} color={wear >= 0.8 ? 'gold' : 'green'} />}
      {confirm ? (
        <>
          <p role="status">{confirm.text}</p>
          <button className="primary full" disabled={pending} onClick={act}>
            Confirmar
          </button>
          <button className="secondary full" onClick={() => setConfirm(undefined)}>
            Voltar
          </button>
        </>
      ) : (
        <>
          <h3>Vender ou desmontar</h3>
          <Rows
            rows={[
              { label: 'Venda ao fundo estadual', value: cr(sale, 0) },
              ...(v2
                ? [
                    {
                      label: 'Desmontagem',
                      value: `${num(scrapT, 1)} t de sucata · ≈ ${cr(scrapValue, 0)}`,
                    },
                  ]
                : []),
            ]}
          />
          {!free && (
            <p className="muted small">Espere o caminhão voltar livre para vender ou desmontar.</p>
          )}
          <button
            className="secondary full"
            disabled={pending || !free}
            onClick={() =>
              setConfirm({
                text: `Receber ${cr(sale, 0)} do fundo estadual de ${place?.state} e entregar ${v.name}. A venda é definitiva.`,
                label: 'Caminhão vendido ao fundo estadual.',
                command: { type: 'sellVehicle', vehicleId: v.id },
              })
            }
          >
            Vender por {cr(sale, 0)}
          </button>
          {v2 && (
            <>
              <button
                className="secondary full"
                disabled={pending || !free || !yard}
                onClick={() =>
                  setConfirm({
                    text: `Desmontar ${v.name} em ${yard!.name}. Ficam ${num(scrapT, 1)} t de sucata no estoque da unidade, para vender a uma siderúrgica ou reciclar. O caminhão deixa de existir.`,
                    label: 'Caminhão desmontado; a sucata está no estoque.',
                    command: { type: 'scrapVehicle', vehicleId: v.id },
                  })
                }
              >
                Desmontar em sucata
              </button>
              {free && !yard && (
                <p className="muted small">
                  Para desmontar, o caminhão precisa estar numa unidade sua.
                </p>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
