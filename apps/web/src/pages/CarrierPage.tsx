import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading } from '../components/ui';
import { SecaoAbas } from '../components/SecaoAbas';
import { PixelArt } from '../components/PixelArt';
import { IconePixel } from '../components/IconePixel';
import { CargaCaminho } from '../components/CargaCaminho';
import { BotaoProduto } from '../components/BotaoProduto';
import { agoraDoMundo, horasDeJogo } from '../features/inicio/tempo';
import { products, type Vehicle } from '../../../../packages/simulation/src/model';
import { Stock } from '../features/business/Stock';
import { Vendas } from '../features/business/producao/Vendas';
import { vehicleWear } from '../../../../packages/simulation/src/engine';
import { vehicleModels } from '../../../../packages/simulation/src/catalog';
import { TruckPurchase } from '../components/TruckPurchase';
import { VehicleDetails, vehicleStatus } from '../components/VehicleDetails';
import '../design/item.css';
import '../design/frota.css';

export function CarrierPage() {
  const { world, actor, navigate } = useGame();
  const [vehicle, setVehicle] = useState<Vehicle>(),
    [buy, setBuy] = useState(false);
  const fleet = world.vehicles.filter((v) => v.companyId === actor),
    available = fleet.filter((v) => v.status === 'available');
  const shipments = world.shipments.filter((s) => s.carrierId === actor),
    emViagem = shipments.filter((s) => !s.delivered);
  const revenue =
    world.view?.totals.freight?.in ??
    world.ledger
      .filter((l) => l.to === actor && l.kind === 'freight')
      .reduce((n, l) => n + l.amount, 0);
  const logistics = world.establishments.find(
    (e) => e.companyId === actor && e.category === 'logistics',
  );
  const vehicleDepot =
    world.establishments.find(
      (e) => e.companyId === actor && (e.category === 'logistics' || e.category === 'warehouse'),
    ) ?? world.establishments.find((e) => e.companyId === actor);
  const capTotal = fleet.reduce((n, v) => n + v.capacityT, 0);
  const capLivre = available.reduce((n, v) => n + v.capacityT, 0);

  return (
    <>
      <SecaoAbas secao="negocios" />
      <PageHeading
        title={logistics?.name ?? 'Minha frota'}
        description="Seus caminhões levam as compras e vendas da empresa sem pagar transportadora de fora."
        action={
          <button className="primary" onClick={() => setBuy(true)}>
            <Plus size={17} /> Comprar caminhão
          </button>
        }
      />
      <div className="page-body fro-pagina">
        <section className="fro-faixa" aria-label="Resumo da frota">
          <div>
            <IconePixel nome="caminhao" tamanho={32} />
            <b>
              {num(available.length)} / {num(fleet.length)}
            </b>
            <span>caminhões livres agora</span>
          </div>
          <div>
            <IconePixel nome="caixa" tamanho={32} />
            <b>{num(capLivre)} t</b>
            <span>livres de {num(capTotal)} t na frota</span>
          </div>
          <div>
            <IconePixel nome="mapa" tamanho={32} />
            <b>{num(emViagem.length)}</b>
            <span>{emViagem.length === 1 ? 'carga viajando' : 'cargas viajando'}</span>
          </div>
          <div>
            <IconePixel nome="moeda" tamanho={32} />
            <b>{cr(revenue, 0)}</b>
            <span>recebidos em fretes</span>
          </div>
        </section>

        <ul className="fro-grade" aria-label="Caminhões da frota">
          {fleet.map((v) => {
            const p = world.properties.find((x) => x.id === v.propertyId);
            const wear = vehicleWear(world, v);
            const lifeKm = v.model ? vehicleModels[v.model].lifeKm : undefined;
            const carga = world.shipments.find((x) => x.vehicleId === v.id && !x.delivered);
            const destinoDe = (id: string) =>
              world.establishments.find((e) => e.id === id)?.name ?? 'o destino';
            return (
              <li key={v.id}>
                <article
                  className={`item fro-item ${v.status === 'maintenance' ? 'parado' : ''}`}
                  style={{ ['--h' as string]: v.model === 'truckLight' ? 150 : 214 }}
                >
                  <header className="item-hero">
                    <div className="item-arte">
                      <PixelArt name="caminhao" scale={2} />
                    </div>
                    <div className="item-ident">
                      <h3>{v.name}</h3>
                      <span
                        className={`item-estado tom-${v.status === 'available' ? 'lavoura' : v.status === 'route' ? 'ceu' : 'brasa'}`}
                      >
                        {vehicleStatus(v)}
                      </span>
                      {lifeKm && (
                        <>
                          <div
                            className="item-medidor"
                            role="img"
                            aria-label={`${num(Math.max(0, (1 - wear) * 100))}% da vida útil restante`}
                          >
                            <i
                              className={`tom-${wear >= 0.85 ? 'brasa' : wear >= 0.6 ? 'ouro' : 'lavoura'}`}
                              style={{ width: `${Math.max(4, (1 - wear) * 100)}%` }}
                            />
                          </div>
                          <small className="fro-vida-txt">
                            {num(Math.max(0, (1 - wear) * 100))}% de vida · {num(v.odometerKm ?? 0)}{' '}
                            de {num(lifeKm)} km
                          </small>
                        </>
                      )}
                      <dl className="item-fatos">
                        <div>
                          <IconePixel nome="caixa" tamanho={22} />
                          <dt>Carrega</dt>
                          <dd>
                            {v.capacityT} t · {v.capacityM3} m³
                          </dd>
                        </div>
                        <div>
                          <IconePixel nome="mapa" tamanho={22} />
                          <dt>Onde</dt>
                          <dd>{p ? `${p.city}, ${p.state}` : 'Na estrada'}</dd>
                        </div>
                      </dl>
                    </div>
                  </header>
                  <div className="item-corpo fro-corpo">
                    <p className="fro-agora">
                      {carga ? (
                        <>
                          <IconePixel nome="caminhao" tamanho={24} />
                          <span>
                            Levando {num(carga.quantity)} {products[carga.product].unit} de{' '}
                            <BotaoProduto product={carga.product} className="fro-produto">
                              {products[carga.product].name}
                            </BotaoProduto>{' '}
                            para {destinoDe(carga.destinationId)} · chega em ~
                            {num(Math.max(1, horasDeJogo(carga.arrivesAt - agoraDoMundo(world))))} h
                          </span>
                        </>
                      ) : (
                        <span>
                          {v.status === 'maintenance'
                            ? 'Na manutenção, volta a ficar livre em breve.'
                            : 'Parado e pronto para carregar a próxima carga.'}
                        </span>
                      )}
                    </p>
                    <button type="button" className="primary" onClick={() => setVehicle(v)}>
                      Ver caminhão
                    </button>
                  </div>
                </article>
              </li>
            );
          })}

          <li>
            <button type="button" className="fro-novo" onClick={() => setBuy(true)}>
              {fleet.length === 0 ? (
                <PixelArt name="caminhao" scale={2} />
              ) : (
                <Plus size={40} aria-hidden="true" />
              )}
              <strong>
                {fleet.length === 0 ? 'Compre seu primeiro caminhão' : 'Comprar caminhão'}
              </strong>
              <small>Compare montadoras e aumente a capacidade de transporte</small>
            </button>
          </li>
        </ul>

        {emViagem.length > 0 && (
          <section className="fro-bloco" aria-labelledby="fro-viagens">
            <header className="fro-bloco-cab">
              <h2 id="fro-viagens">Seus caminhões na estrada</h2>
              <button type="button" className="secondary" onClick={() => navigate('orders')}>
                Ver todos os pedidos
              </button>
            </header>
            <ul className="cam-lista">
              {emViagem.slice(0, 6).map((s) => (
                <CargaCaminho key={s.id} s={s} world={world} />
              ))}
            </ul>
          </section>
        )}

        {logistics && (
          <section className="fro-bloco" aria-labelledby="fro-patio">
            <header className="fro-bloco-cab">
              <h2 id="fro-patio">Pátio e sucata de {logistics.name}</h2>
            </header>
            <Stock establishment={logistics} />
            <Vendas establishment={logistics} />
          </section>
        )}
      </div>

      {vehicle && <VehicleDetails vehicle={vehicle} onClose={() => setVehicle(undefined)} />}
      {buy && <TruckPurchase depot={vehicleDepot} onClose={() => setBuy(false)} />}
    </>
  );
}
