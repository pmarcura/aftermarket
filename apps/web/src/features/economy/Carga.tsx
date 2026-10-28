import { useState } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import {
  products,
  TIME_SCALE,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { melhorFrete, procuraDiaria, type Frete } from './compra';

// Como o jogador chama cada unidade. Toneladas e quilos ficam como estão.
const nomes: Partial<Record<ProductId, [string, string]>> = {
  oil: ['garrafa', 'garrafas'],
  rice: ['pacote', 'pacotes'],
  beans: ['pacote', 'pacotes'],
  sugar: ['pacote', 'pacotes'],
  milk: ['caixa', 'caixas'],
  utensils: ['kit', 'kits'],
  truckHeavy: ['caminhão', 'caminhões'],
  truckLight: ['caminhão', 'caminhões'],
  cow: ['vaca', 'vacas'],
};
export function unidade(product: ProductId, n = 2) {
  const nome = nomes[product];
  if (nome) return n === 1 ? nome[0] : nome[1];
  return products[product].unit;
}

/** Quantas unidades do produto cabem num caminhão: o limite é o peso ou o volume. */
function cabe(capT: number, capM3: number, product: ProductId) {
  const p = products[product];
  return Math.max(1, Math.min(Math.floor(capT / p.massT), Math.floor(capM3 / p.volumeM3)));
}

const partes = [
  ['fuel', 'Combustível', '#d9b16b'],
  ['maintenance', 'Desgaste do caminhão', '#82929b'],
  ['driver', 'Motorista', '#72b2d1'],
  ['tolls', 'Pedágio', '#b68abc'],
  ['handling', 'Carregar e descarregar', '#62c89e'],
] as const;

/**
 * O transporte de uma compra contado para quem nunca jogou: se o frete pesa, por onde a carga
 * vai, quão cheio vai o caminhão e o que faria o frete cair. Só lê a cotação do motor.
 */
export function Carga({
  frete,
  product,
  quantidade,
  origem,
  destino,
  estoque,
  precoUnidade,
  precoVenda,
  onQuantidade,
}: {
  frete: Frete;
  product: ProductId;
  quantidade: number;
  origem: Establishment;
  destino: Establishment;
  estoque: number;
  precoUnidade: number;
  precoVenda?: number;
  onQuantidade: (q: number) => void;
}) {
  const { world, actor } = useGame();
  const [aberto, setAberto] = useState(false);
  const caminhoes = frete.parts.map((part) => {
    const v = world.vehicles.find((v) => v.id === part.vehicleId);
    const capacidade = v ? cabe(v.capacityT, v.capacityM3, product) : part.quantity;
    return { ...part, capacidade, cheio: Math.min(1, part.quantity / capacidade) };
  });
  const ultimo = caminhoes[caminhoes.length - 1];
  const capacidadeTotal = caminhoes.reduce((n, c) => n + c.capacidade, 0);
  const ocupacao = quantidade / Math.max(1, capacidadeTotal);
  const porUnidade = frete.price / quantidade;
  const referencia = precoVenda ?? precoUnidade;
  const peso = porUnidade / Math.max(1, referencia);
  const nivel = peso < 0.05 ? 'leve' : peso < 0.12 ? 'medio' : 'pesado';
  const op = world.properties.find((p) => p.id === origem.propertyId)!;
  const dp = world.properties.find((p) => p.id === destino.propertyId)!;
  const quem =
    frete.carrierId === actor
      ? 'a sua frota'
      : (world.companies.find((c) => c.id === frete.carrierId)?.name ?? 'uma transportadora');
  const minutos = Math.max(1, Math.round(frete.durationMs / 60000));
  const horasJogo = Math.max(1, Math.round((frete.durationMs * TIME_SCALE) / 3600000));
  const kmTotal = caminhoes.reduce((n, c) => n + c.km, 0);
  const buscar = Math.max(0, kmTotal - caminhoes.length * frete.distanceKm);
  // Completar o último caminhão quando ele vai com folga e o fornecedor tem o estoque.
  const folga = ultimo ? ultimo.capacidade - ultimo.quantity : 0;
  const encher =
    ultimo && ultimo.cheio < 0.8 && quantidade + folga <= estoque ? quantidade + folga : undefined;
  const freteCheio = encher
    ? melhorFrete(world, actor, origem.id, destino.id, product, encher)
    : undefined;
  const diasCheio =
    encher && destino.category === 'retail'
      ? encher / Math.max(1e-9, procuraDiaria(world, destino, product))
      : undefined;
  const custos = frete.costs;
  const lucro = Math.max(0, frete.price - custos.operatingCost);
  const fatias = [
    ...partes.map(([k, rotulo, cor]) => ({ rotulo, cor, valor: custos[k] })),
    {
      rotulo: frete.carrierId === actor ? 'Sobra para a sua frota' : 'Lucro da transportadora',
      cor: '#e7edef',
      valor: lucro,
    },
  ]
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const minimo = caminhoes.some((c) => c.price === 28000);
  const u1 = unidade(product, 1),
    u = unidade(product);
  return (
    <section className="carga" aria-label="Transporte da compra">
      <header className="carga-cab">
        <h3>Transporte</h3>
        <span className={`carga-veredito ${nivel}`}>
          {nivel === 'leve' ? 'Frete leve' : nivel === 'medio' ? 'Frete médio' : 'Frete pesado'} ·{' '}
          {num(peso * 100)}% do {precoVenda ? 'preço de venda' : 'preço da mercadoria'}
        </span>
      </header>
      <div className="carga-rota">
        <span>
          <MapPin size={13} aria-hidden="true" /> {op.city}, {op.state}
        </span>
        <span className="carga-estrada" aria-hidden="true">
          <i />
        </span>
        <span>
          <MapPin size={13} aria-hidden="true" /> {dp.city}, {dp.state}
        </span>
        <p>
          {num(frete.distanceKm, 0)} km de estrada. A carga chega em cerca de {minutos}{' '}
          {minutos === 1 ? 'minuto' : 'minutos'} ({horasJogo} {horasJogo === 1 ? 'hora' : 'horas'}{' '}
          no jogo), levada por {quem}.
        </p>
      </div>
      <div className="carga-frota">
        <div className="carga-caminhoes">
          {caminhoes.slice(0, 3).map((c) => (
            <figure key={c.vehicleId} className="carga-caminhao">
              <PixelArt name="caminhao" scale={1} />
              <span
                className="carga-cheio"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(c.cheio * 100)}
                aria-label="Quanto o caminhão vai cheio"
              >
                <i
                  className={c.cheio < 0.5 ? 'pouco' : c.cheio < 0.8 ? 'medio' : ''}
                  style={{ width: `${c.cheio * 100}%` }}
                />
              </span>
              <figcaption>{num(c.cheio * 100)}% cheio</figcaption>
            </figure>
          ))}
          {caminhoes.length > 3 && <span className="carga-mais">+{caminhoes.length - 3}</span>}
        </div>
        <div className="carga-valor">
          <strong>{cr(frete.price)}</strong>
          <span>
            de frete por {caminhoes.length} {caminhoes.length === 1 ? 'caminhão' : 'caminhões'}
          </span>
          <span>
            levando {num(quantidade)} de {num(capacidadeTotal)} {u} que cabem
          </span>
        </div>
      </div>
      <p className="carga-traducao">
        {precoVenda ? (
          <>
            De cada {u1} vendido a {cr(precoVenda)}, <b>{cr(porUnidade)}</b> pagam o frete.
          </>
        ) : (
          <>
            O frete soma <b>{cr(porUnidade)}</b> a cada {u1}, que custa {cr(precoUnidade)} no
            fornecedor.
          </>
        )}
      </p>
      {encher && freteCheio ? (
        <div className="carga-dica">
          <strong>O caminhão vai {ocupacao < 0.5 ? 'quase vazio' : 'com espaço sobrando'}</strong>
          <p>
            O frete é cobrado pela viagem, não pelo peso. Quanto mais cheio o caminhão, menos frete
            cada {u1} carrega.
          </p>
          <div className="carga-comparar">
            <div>
              <small>Como está</small>
              <b>{cr(porUnidade)}</b>
              <small>
                de frete por {u1}, {num(quantidade)} {u}
              </small>
            </div>
            <div className="melhor">
              <small>Com o caminhão cheio</small>
              <b>{cr(freteCheio.price / encher)}</b>
              <small>
                por {u1}, {num(encher)} {u}
                {diasCheio !== undefined && ` · estoque para ${num(diasCheio)} dias`}
              </small>
            </div>
          </div>
          <button className="secondary" onClick={() => onQuantidade(encher)}>
            Encher o caminhão (+{num(folga)} {u})
          </button>
        </div>
      ) : (
        ocupacao >= 0.8 && (
          <p className="carga-ok">
            <Check size={14} aria-hidden="true" /> Caminhão bem aproveitado: vai{' '}
            {num(ocupacao * 100)}% cheio.
          </p>
        )
      )}
      <button
        className="text-button carga-abrir"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <ChevronDown size={14} className={aberto ? 'virado' : ''} /> Para onde vai o dinheiro do
        frete
      </button>
      {aberto && (
        <div className="carga-custos">
          <div className="carga-barra" aria-hidden="true">
            {fatias.map((f) => (
              <i key={f.rotulo} style={{ flex: f.valor, background: f.cor }} />
            ))}
          </div>
          <ul>
            {fatias.map((f) => (
              <li key={f.rotulo}>
                <i style={{ background: f.cor }} /> {f.rotulo}
                <b>{cr(f.valor, 0)}</b>
                <small>{num((f.valor / frete.price) * 100)}%</small>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {buscar > 1
              ? `O caminhão roda ${num(kmTotal, 0)} km: ${num(buscar, 0)} km só para chegar ao fornecedor e ${num(kmTotal - buscar, 0)} km com a carga.`
              : `O caminhão já está perto do fornecedor e roda ${num(kmTotal, 0)} km.`}
            {minimo && ' Toda viagem custa no mínimo R$ 280, mesmo com o caminhão quase vazio.'}
          </p>
        </div>
      )}
    </section>
  );
}
