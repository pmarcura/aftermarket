import { useState } from 'react';
import { FleetPicker } from '../../components/FleetPicker';
import { IconePixel } from '../../components/IconePixel';
import { Modal } from '../../components/ui';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade as unidadeDe } from '../economy/Carga';
import { CampoNumero } from '../pedidos/CampoNumero';
import { useGame, cr, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { useRoute } from '../../lib/routing';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  type InfrastructureContract,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import { quote } from '../../../../../packages/simulation/src/engine';
import '../../design/pedidos.css';
import '../../design/contratos.css';

/** Entrar numa disputa pública: de qual estoque sai, quem leva e por quanto. */
export function ModalDisputa({
  contrato: c,
  onClose,
}: {
  contrato: InfrastructureContract;
  onClose: () => void;
}) {
  const { world, actor, run, pending } = useGame();
  const agora = useClock();
  const meus = world.establishments.filter(
    (e) => e.companyId === actor && (e.inventory[c.product] ?? 0) > 0,
  );
  const [origemId, setOrigem] = useState(
    meus.find((e) => (e.inventory[c.product] ?? 0) >= c.quantity)?.id ?? '',
  );
  const [transportadora, setTransportadora] = useState('');
  const [preco, setPreco] = useState(c.unitPrice);
  const origem = meus.find((e) => e.id === origemId);
  const destino = world.establishments.find((e) => e.id === c.destinationId);
  const q =
    origem && transportadora
      ? quote(world, origem.id, c.destinationId, c.product, c.quantity, transportadora)
      : undefined;
  const carregando = useRoute(origem?.propertyId, destino?.propertyId);
  const info = products[c.product];
  const qualidade = origem ? inventoryQuality(origem, c.product) : 0;
  const problema =
    c.status !== 'open'
      ? 'Este contrato não está mais aberto.'
      : !origem
        ? 'Escolha de qual estoque a carga sai.'
        : (origem.inventory[c.product] ?? 0) < c.quantity
          ? `Esse estoque tem ${num(origem.inventory[c.product] ?? 0)} e o contrato pede ${num(c.quantity)}.`
          : qualidade < c.minQuality
            ? `A qualidade (${num(qualidade)}) está abaixo do mínimo de ${c.minQuality}.`
            : !q
              ? 'Escolha quem vai levar a carga.'
              : !q.compatible
                ? 'A frota escolhida não leva essa carga.'
                : q.price > c.maxFreight
                  ? `O frete (${cr(q.price)}) passa do teto do contrato (${cr(c.maxFreight)}).`
                  : (c.biddingEndsAt ?? agora) + q.durationMs > c.deadline
                    ? 'A viagem não chega dentro do prazo do contrato.'
                    : price(preco, c)
                      ? 'O preço passa do teto por unidade.'
                      : c.biddingEndsAt && agora >= c.biddingEndsAt
                        ? 'A disputa já encerrou.'
                        : '';
  return (
    <Modal
      title={c.biddingEndsAt ? 'Participar da disputa' : 'Atender contrato'}
      onClose={onClose}
      wide
    >
      <div className="ped-modal">
        <section className="ped-recibo" style={{ ['--h' as string]: matizDoProduto(c.product) }}>
          <header>
            <ProdutoArte product={c.product} escala={2} />
            <h3>
              Prefeitura de {c.municipality ?? destino?.name}: {num(c.quantity)}{' '}
              {unidadeDe(c.product, c.quantity)} de {info.name}
            </h3>
          </header>
          <dl>
            <div>
              <IconePixel nome="moeda" tamanho={24} />
              <dt>Paga no máximo, por unidade</dt>
              <dd>{cr(c.unitPrice)}</dd>
            </div>
            <div>
              <IconePixel nome="estrela" tamanho={24} />
              <dt>Qualidade mínima</dt>
              <dd>{c.minQuality}</dd>
            </div>
          </dl>
        </section>

        <div className="ped-escolha">
          <span id="ctr-origem">De qual estoque sai?</span>
          {meus.length ? (
            <div role="radiogroup" aria-labelledby="ctr-origem" className="ped-cartas">
              {meus.map((e) => {
                const tem = e.inventory[c.product] ?? 0;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={origemId === e.id}
                    className={origemId === e.id ? 'on' : ''}
                    onClick={() => setOrigem(e.id)}
                  >
                    <strong>{e.name}</strong>
                    <small>
                      {num(tem)} {unidadeDe(c.product, tem)} · qualidade{' '}
                      {num(inventoryQuality(e, c.product))}
                      {tem < c.quantity ? ' · não chega ao total' : ''}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="ped-aviso">Você não tem {info.name} em nenhum estoque.</p>
          )}
        </div>

        <FleetPicker
          originId={origemId}
          destinationId={c.destinationId}
          product={c.product}
          quantity={c.quantity}
          value={transportadora}
          onChange={setTransportadora}
          label="Quem leva a carga"
        />

        {c.biddingEndsAt && (
          <div className="ped-campos">
            <CampoNumero
              rotulo="Seu preço por unidade (R$)"
              valor={preco / 100}
              onChange={(v) => setPreco(Math.round(v * 100))}
              min={0.01}
              max={c.unitPrice / 100}
              casas={2}
              passo={0.5}
              ajuda={`Teto do contrato: ${cr(c.unitPrice)}. Preço menor ganha mais pontos.`}
            />
          </div>
        )}

        {origem && (
          <section className="ped-recibo">
            <dl>
              <div>
                <IconePixel nome="custo" tamanho={24} />
                <dt>Você receberia pelo material</dt>
                <dd>{cr(preco * c.quantity)}</dd>
              </div>
              <div>
                <IconePixel nome="caminhao" tamanho={24} />
                <dt>Frete estimado</dt>
                <dd>
                  {q
                    ? `${cr(q.price)} · ${q.compatible ? q.parts.length : 0} caminhões`
                    : 'Escolha quem leva'}
                </dd>
              </div>
              <div>
                <IconePixel nome="caixa" tamanho={24} />
                <dt>Custo do material para você</dt>
                <dd>{cr((origem.unitCosts[c.product] ?? 0) * c.quantity)}</dd>
              </div>
            </dl>
          </section>
        )}
        {problema && (
          <p className="ped-aviso" role="status">
            {problema}
          </p>
        )}
        <p className="ped-nota">
          {c.biddingEndsAt
            ? 'Participar não despacha nem paga nada. A melhor proposta viável é contratada quando a disputa encerra, e o estoque precisa continuar lá.'
            : 'Ao confirmar, o estoque é despachado pelo preço do contrato. Caixa, estoque e transporte são conferidos novamente.'}
        </p>
        <button
          className="primary ped-grande"
          disabled={pending || carregando || Boolean(problema)}
          onClick={async () => {
            if (!origem || !q) return;
            if (
              await run(
                c.biddingEndsAt
                  ? {
                      type: 'bidInfrastructure',
                      contractId: c.id,
                      establishmentId: origem.id,
                      carrierId: transportadora,
                      unitPrice: preco,
                    }
                  : {
                      type: 'fulfillInfrastructure',
                      contractId: c.id,
                      establishmentId: origem.id,
                      carrierId: transportadora,
                      expectedFreight: q.price,
                    },
                c.biddingEndsAt
                  ? 'Proposta registrada. Agora é torcer pela nota!'
                  : 'Contrato despachado.',
              )
            )
              onClose();
          }}
        >
          {carregando
            ? 'Traçando a estrada…'
            : c.biddingEndsAt
              ? 'Registrar proposta'
              : 'Aceitar e despachar'}
        </button>
      </div>
    </Modal>
  );
}

const price = (preco: number, c: InfrastructureContract) =>
  !Number.isSafeInteger(preco) || preco <= 0 || preco > c.unitPrice;
