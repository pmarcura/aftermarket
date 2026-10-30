import { useState } from 'react';
import { useGame, cr, num } from '../lib/game';
import { PixelArt } from './PixelArt';
import { IconePixel } from './IconePixel';
import { GavetaFrota } from '../features/frota/GavetaFrota';
import { products, type Command, type Vehicle } from '../../../../packages/simulation/src/model';
import { scrapRecovery, vehicleModels } from '../../../../packages/simulation/src/catalog';
import { vehicleSalePrice, vehicleWear } from '../../../../packages/simulation/src/engine';

export const vehicleStatus = (v: Vehicle) =>
  v.status === 'available' ? 'Disponível' : v.status === 'route' ? 'Na estrada' : 'Manutenção';
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
    <GavetaFrota titulo={v.name} matiz={205} onClose={onClose}>
      <header className="gaveta-cab">
        <div className="gaveta-cena">
          <PixelArt name="caminhao" scale={2} />
        </div>
        <div>
          <h2>{v.name}</h2>
          <p>
            {vehicleType(v)} · <b>{v.capacityT} t</b> e <b>{v.capacityM3} m³</b>
          </p>
          <p className="gaveta-situacao">
            {place ? `${place.city}, ${place.state}` : 'Sem base'} · {vehicleStatus(v)}
          </p>
        </div>
      </header>

      <section className="gaveta-bloco" aria-label="Estado do caminhão">
        <dl className="fro-card-fatos">
          <div>
            <dt>Valor pago na compra</dt>
            <dd>{cr(v.purchasePrice ?? 28000000, 0)}</dd>
          </div>
          <div>
            <dt>Valor de revenda hoje</dt>
            <dd>{cr(sale, 0)}</dd>
          </div>
          {v2 && v.model && (
            <>
              <div>
                <dt>Quilometragem rodada</dt>
                <dd>
                  {num(v.odometerKm ?? 0)} / {num(vehicleModels[v.model].lifeKm)} km
                </dd>
              </div>
              <div>
                <dt>Custo de manutenção</dt>
                <dd>{wear > 0.005 ? `+${num(wear * 100)}% por km` : 'Como novo'}</dd>
              </div>
            </>
          )}
        </dl>
        {v2 && v.model && (
          <div className="fro-vida">
            <div className="fro-vida-topo">
              <span>Desgaste acumulado</span>
              <b>{num(wear * 100)}%</b>
            </div>
            <div
              className={`fro-vida-barra ${wear >= 0.85 ? 'ruim' : wear >= 0.6 ? 'alerta' : ''}`}
            >
              <i style={{ width: `${Math.min(100, wear * 100)}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="gaveta-bloco" aria-labelledby="fro-destino">
        <h3 id="fro-destino">Vender ou desmontar</h3>
        {confirm ? (
          <div className="lote-bloco">
            <p role="status">{confirm.text}</p>
            <button className="primary full" disabled={pending} onClick={act}>
              Confirmar
            </button>
            <button className="secondary full" onClick={() => setConfirm(undefined)}>
              Voltar
            </button>
          </div>
        ) : (
          <ul className="gaveta-opcoes">
            <li>
              <button
                type="button"
                className="gaveta-opcao"
                disabled={pending || !free}
                onClick={() =>
                  setConfirm({
                    text: `Receber ${cr(sale, 0)} do fundo estadual de ${place?.state} e entregar ${v.name}. A venda é definitiva.`,
                    label: 'Caminhão vendido ao fundo estadual.',
                    command: { type: 'sellVehicle', vehicleId: v.id },
                  })
                }
              >
                <strong>Vender ao fundo estadual</strong>
                <span className="gaveta-preco">
                  <IconePixel nome="moeda" tamanho={22} />
                  <b>{cr(sale, 0)}</b>
                  <small>dinheiro entra na hora no caixa</small>
                </span>
              </button>
            </li>
            {v2 && (
              <li>
                <button
                  type="button"
                  className="gaveta-opcao"
                  disabled={pending || !free || !yard}
                  onClick={() =>
                    setConfirm({
                      text: `Desmontar ${v.name} em ${yard!.name}. Ficam ${num(scrapT, 1)} t de sucata no estoque da unidade, para vender a uma siderúrgica ou reciclar. O caminhão deixa de existir.`,
                      label: 'Caminhão desmontado; a sucata está no estoque.',
                      command: { type: 'scrapVehicle', vehicleId: v.id },
                    })
                  }
                >
                  <strong>Desmontar em sucata</strong>
                  <span className="gaveta-preco">
                    <IconePixel nome="caixa" tamanho={22} />
                    <b>{num(scrapT, 1)} t de sucata</b>
                    <small>vale cerca de {cr(scrapValue, 0)}</small>
                  </span>
                  {free && !yard && (
                    <span className="gaveta-prazo">
                      Para desmontar, o caminhão precisa estar numa unidade sua.
                    </span>
                  )}
                </button>
              </li>
            )}
          </ul>
        )}
        {!free && (
          <p className="fro-nota">
            Este caminhão está na estrada agora. Espere a entrega terminar para vender ou desmontar.
          </p>
        )}
      </section>
    </GavetaFrota>
  );
}
