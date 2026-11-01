import { useState } from 'react';
import { useGame, cr, num } from '../lib/game';
import { PixelArt } from './PixelArt';
import { IconePixel } from './IconePixel';
import { GavetaFrota } from '../features/frota/GavetaFrota';
import type { Establishment } from '../../../../packages/simulation/src/model';
import {
  dealershipMarkup,
  referencePrice,
  vehicleModels,
  type VehicleModel,
} from '../../../../packages/simulation/src/catalog';
import { freeCash } from '../../../../packages/simulation/src/design';

// Versão 2: o caminhão vem de uma montadora (de jogador ou bot) ou da concessionária importadora.
const models: { label: string; id: VehicleModel; nome: string; ajuda: string }[] = [
  { label: 'Pesado 30 t', id: 'truckHeavy', nome: 'Pesado', ajuda: 'carga grande, rota longa' },
  { label: 'Leve 8 t', id: 'truckLight', nome: 'Leve', ajuda: 'entrega pequena e barata' },
];

interface Vendedor {
  chave: string;
  id?: string;
  name: string;
  where: string;
  price: number;
  note: string;
  own?: boolean;
}

/**
 * Comprar caminhão: escolhe-se o modelo, depois quem vende, e o caminhão entra na frota. Mesmos
 * vendedores, preços e comando (`buyVehicle`) de antes; só o jeito de escolher mudou.
 */
export function TruckPurchase({ depot, onClose }: { depot?: Establishment; onClose: () => void }) {
  const { world, actor, run, pending } = useGame();
  const [modeloId, setModeloId] = useState<VehicleModel>(models[0].id);
  const [escolhido, setEscolhido] = useState('');
  const [comprado, setComprado] = useState<string>();
  const model = modeloId,
    spec = vehicleModels[model];
  const cash = freeCash(world, actor);
  const city = (e: Establishment) => {
    const p = world.properties.find((p) => p.id === e.propertyId)!;
    return `${p.city}, ${p.state}`;
  };
  const companyName = (id: string) => world.companies.find((c) => c.id === id)?.name ?? id;

  const vendedores: Vendedor[] = [
    // Montadora própria entrega pelo custo do estoque, sem pagamento.
    ...world.establishments
      .filter((e) => e.companyId === actor && (e.inventory[model] ?? 0) >= 1)
      .map((e) => ({
        chave: e.id,
        id: e.id,
        name: e.name,
        where: city(e),
        price: Math.round(e.unitCosts[model] ?? 0),
        note: 'Sua montadora: sai do estoque pelo custo',
        own: true,
      })),
    ...world.offers
      .filter((o) => o.product === model)
      .flatMap((o) => {
        const e = world.establishments.find((x) => x.id === o.establishmentId);
        return e && e.companyId !== actor && (e.inventory[model] ?? 0) >= 1
          ? [
              {
                chave: e.id,
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
      chave: 'concessionaria',
      name: 'Concessionária importadora',
      where: 'Importado',
      price: Math.round(referencePrice(model) * dealershipMarkup),
      note: `${num((dealershipMarkup - 1) * 100)}% acima da referência; o dinheiro sai da economia`,
    },
  ];
  const pagos = vendedores.filter((s) => !s.own);
  const maisBarato =
    pagos.length > 1 ? pagos.reduce((m, s) => (s.price < m.price ? s : m)) : undefined;
  const cabe = (s: Vendedor) => s.own || s.price <= cash;
  const atual =
    vendedores.find((s) => s.chave === escolhido) ?? vendedores.find(cabe) ?? vendedores[0];
  const total = atual && !atual.own ? atual.price : 0;
  const falta = Math.max(0, total - cash);

  const comprar = async () => {
    if (!atual || !depot) return;
    const ok = await run(
      { type: 'buyVehicle', model, ...(atual.id ? { sellerEstablishmentId: atual.id } : {}) },
      `${spec.label} registrado na frota.`,
    );
    if (ok) setComprado(atual.name);
  };

  return (
    <GavetaFrota
      titulo="Comprar caminhão"
      matiz={model === 'truckHeavy' ? 214 : 150}
      onClose={onClose}
    >
      {comprado ? (
        <section className="gaveta-ok" aria-live="polite">
          <div className="gaveta-estrada" aria-hidden="true">
            <PixelArt name="caminhao" scale={1} className="gaveta-caminhao" />
          </div>
          <h2>Caminhão novo!</h2>
          <p>
            Comprado de <b>{comprado}</b> e registrado em <b>{depot?.name}</b>.
          </p>
          <div className="gaveta-acoes">
            <button className="primary" onClick={onClose}>
              Ver a frota
            </button>
          </div>
        </section>
      ) : (
        <>
          <header className="gaveta-cab">
            <div className="gaveta-cena">
              <PixelArt name="caminhao" scale={2} />
            </div>
            <div>
              <h2>Comprar caminhão</h2>
              <p>
                {depot ? (
                  <>
                    Ele vai para <b>{depot.name}</b> ({city(depot)}).
                  </>
                ) : (
                  'Você precisa de uma unidade para receber o caminhão.'
                )}
              </p>
              <p className="gaveta-situacao">Caixa livre: {cr(cash, 0)}</p>
            </div>
          </header>

          <section className="gaveta-bloco" aria-labelledby="fro-modelo">
            <h3 id="fro-modelo">Qual caminhão?</h3>
            <div className="fro-modelos" role="radiogroup" aria-label="Modelo">
              {models.map((m) => {
                const s = vehicleModels[m.id];
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={modeloId === m.id}
                    className={modeloId === m.id ? 'on' : ''}
                    onClick={() => {
                      setModeloId(m.id);
                      setEscolhido('');
                    }}
                  >
                    <strong>{m.nome}</strong>
                    <span>
                      {s.capacityT} t · {s.capacityM3} m³
                    </span>
                    <small>
                      {m.ajuda}. Dura {num(s.lifeKm)} km.
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="gaveta-bloco" aria-labelledby="fro-quem">
            <h3 id="fro-quem">Quem vende?</h3>
            <ul className="gaveta-opcoes">
              {vendedores.map((s) => {
                const sel = atual?.chave === s.chave;
                return (
                  <li key={s.chave}>
                    <button
                      type="button"
                      className={`gaveta-opcao ${sel ? 'on' : ''}`}
                      aria-pressed={sel}
                      disabled={!cabe(s)}
                      onClick={() => setEscolhido(s.chave)}
                    >
                      <span className="gaveta-selos">
                        {s.own && <em className="barato">Sua montadora</em>}
                        {maisBarato === s && (
                          <em className="barato">
                            <IconePixel nome="estrela" tamanho={16} /> Mais barato
                          </em>
                        )}
                        {s.chave === 'concessionaria' && <em>Importado</em>}
                        {!cabe(s) && <em className="sem">Caixa insuficiente</em>}
                      </span>
                      <strong>{s.name}</strong>
                      <span className="gaveta-onde">
                        <IconePixel nome="mapa" tamanho={18} /> {s.where}
                      </span>
                      <span className="gaveta-preco">
                        <IconePixel nome="moeda" tamanho={22} />
                        <b>{s.own ? 'Sem pagar' : cr(s.price, 0)}</b>
                        <small>{s.own ? 'sai do seu estoque' : 'preço do caminhão'}</small>
                      </span>
                      <span className="gaveta-prazo">{s.note}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="fro-nota">
              {vendedores.length > 1
                ? 'Montadoras do país vendem pelo preço que anunciam; a concessionária é o teto.'
                : 'Nenhuma montadora tem este caminhão anunciado agora; só a concessionária vende.'}
            </p>
          </section>

          <footer className="gaveta-rodape">
            <div className="gaveta-conta">
              <span>Você paga</span>
              <b>{total ? cr(total, 0) : 'Nada'}</b>
              <small className={falta ? 'falta' : ''}>
                {falta
                  ? `Faltam ${cr(falta, 0)} no caixa`
                  : `Sobram ${cr(cash - total, 0)} no caixa`}
              </small>
            </div>
            <button
              type="button"
              className="primary gaveta-despachar"
              disabled={pending || !depot || !atual || falta > 0}
              onClick={comprar}
            >
              Comprar caminhão
            </button>
            {!depot && (
              <p className="gaveta-erro" role="status">
                Compre qualquer unidade para receber o caminhão.
              </p>
            )}
          </footer>
        </>
      )}
    </GavetaFrota>
  );
}
