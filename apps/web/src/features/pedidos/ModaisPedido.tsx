import { useState } from 'react';
import { FleetPicker } from '../../components/FleetPicker';
import { IconePixel } from '../../components/IconePixel';
import { Modal } from '../../components/ui';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade as unidadeDe } from '../economy/Carga';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { useRoute } from '../../lib/routing';
import { useClock } from '../../lib/clock';
import { matizDoProduto } from '../../design/arte';
import {
  products,
  seasonProducts,
  type Establishment,
  type OrderProposal,
  type ProductId,
  type PurchaseOrder,
} from '../../../../../packages/simulation/src/model';
import { quote } from '../../../../../packages/simulation/src/engine';
import { GAME_DAY, availableStock } from '../../../../../packages/simulation/src/operations';
import { storageQuantity } from '../../../../../packages/simulation/src/transport';
import { freeCash } from '../../../../../packages/simulation/src/design';
import { CampoNumero } from './CampoNumero';
import { acoesDoPedido } from './dados';
import '../../design/pedidos.css';

const PRAZOS = [1, 3, 7, 14] as const;

function Prazos({ valor, onChange }: { valor: number; onChange: (d: number) => void }) {
  return (
    <div className="ped-escolha">
      <span id="ped-prazo">Em quantos dias do jogo a carga precisa chegar?</span>
      <div role="radiogroup" aria-labelledby="ped-prazo" className="ped-chips">
        {PRAZOS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={valor === d}
            className={valor === d ? 'on' : ''}
            onClick={() => onChange(d)}
          >
            {d} {d === 1 ? 'dia' : 'dias'}
          </button>
        ))}
      </div>
    </div>
  );
}

function Recibo({
  produto,
  titulo,
  linhas,
  total,
  rotuloTotal,
}: {
  produto: ProductId;
  titulo: string;
  linhas: {
    icone: 'caixa' | 'moeda' | 'caminhao' | 'prazo' | 'custo';
    rotulo: string;
    valor: string;
  }[];
  total?: string;
  rotuloTotal?: string;
}) {
  return (
    <section className="ped-recibo" style={{ ['--h' as string]: matizDoProduto(produto) }}>
      <header>
        <ProdutoArte product={produto} escala={2} />
        <h3>{titulo}</h3>
      </header>
      <dl>
        {linhas.map((l) => (
          <div key={l.rotulo}>
            <IconePixel nome={l.icone} tamanho={24} />
            <dt>{l.rotulo}</dt>
            <dd>{l.valor}</dd>
          </div>
        ))}
      </dl>
      {total && (
        <p className="ped-recibo-total">
          <span>{rotuloTotal ?? 'Total'}</span>
          <b>{total}</b>
        </p>
      )}
    </section>
  );
}

/** Aceitar um pedido ou uma proposta: confere frete e caminhões na hora e despacha. */
export function ModalAceitar({
  pedido,
  proposta,
  onClose,
}: {
  pedido: PurchaseOrder;
  proposta?: OrderProposal;
  onClose: () => void;
}) {
  const { world, actor, run, pending } = useGame();
  const agora = useClock();
  const acoes = acoesDoPedido(pedido, actor, agora);
  const podeAceitar = proposta
    ? acoes.propostas.some((p) => p.id === proposta.id)
    : acoes.aceitarPedido;
  const origemId = proposta?.originId ?? pedido.originId;
  const quantidade = proposta?.quantity ?? pedido.quantity;
  const preco = proposta?.unitPrice ?? pedido.unitPrice;
  const tetoFrete = proposta?.maxFreight ?? pedido.maxFreight;
  const q = quote(
    world,
    origemId,
    pedido.destinationId,
    pedido.product,
    quantidade,
    proposta?.carrierId ?? pedido.carrierId,
  );
  const carregando = useRoute(
    world.establishments.find((e) => e.id === origemId)?.propertyId,
    world.establishments.find((e) => e.id === pedido.destinationId)?.propertyId,
  );
  const info = products[pedido.product];
  const vendendo = pedido.sellerId === actor || proposta?.sellerId === actor;
  const aviso = !podeAceitar
    ? 'Este pedido ou proposta não pode mais ser aceito. Feche e confira os termos atuais.'
    : agora + q.durationMs > (proposta?.deadline ?? pedido.deadline)
      ? 'A carga não chega dentro do prazo combinado.'
      : !q.compatible
        ? 'Nenhum caminhão disponível leva essa carga agora.'
        : q.price > tetoFrete
          ? `O frete subiu para ${cr(q.price)}, acima do teto combinado de ${cr(tetoFrete)}.`
          : '';
  return (
    <Modal title="Aceitar e despachar" onClose={onClose}>
      <div className="ped-modal">
        <Recibo
          produto={pedido.product}
          titulo={`${vendendo ? 'Você entrega' : 'Você recebe'} ${num(quantidade)} ${unidadeDe(pedido.product, quantidade)} de ${info.name}`}
          linhas={[
            { icone: 'moeda', rotulo: 'Preço por unidade', valor: cr(preco) },
            { icone: 'custo', rotulo: 'Mercadoria', valor: cr(quantidade * preco) },
            {
              icone: 'caminhao',
              rotulo: q.compatible
                ? `Frete · ${q.parts.length} ${q.parts.length === 1 ? 'caminhão' : 'caminhões'}`
                : 'Frete',
              valor: q.compatible ? cr(q.price) : '—',
            },
          ]}
          total={cr(quantidade * preco + (q.compatible ? q.price : 0))}
          rotuloTotal="Mercadoria + frete"
        />
        {aviso && <p className="ped-aviso">{aviso}</p>}
        <p className="ped-nota">
          Ao aceitar, preço, prazo, caixa, espaço e caminhões são conferidos de novo. Nada é cobrado
          antes disso.
        </p>
        <button
          className="primary ped-grande"
          disabled={pending || carregando || Boolean(aviso)}
          onClick={async () => {
            if (
              await run(
                proposta
                  ? { type: 'acceptProposal', orderId: pedido.id, proposalId: proposta.id }
                  : { type: 'acceptOrder', orderId: pedido.id },
                'Combinado! O pedido foi despachado.',
              )
            )
              onClose();
          }}
        >
          {carregando ? 'Traçando a estrada…' : 'Aceitar e despachar'}
        </button>
      </div>
    </Modal>
  );
}

/** Fazer ou melhorar uma proposta: quanto, por quanto, até quando e quem leva. */
export function ModalProposta({
  pedido,
  base,
  unidadeFixa,
  onClose,
}: {
  pedido: PurchaseOrder;
  base?: OrderProposal;
  unidadeFixa?: Establishment;
  onClose: () => void;
}) {
  const { world, actor, run, pending } = useGame();
  const compra = pedido.buyerId === actor;
  const agora = useClock();
  const meus = world.establishments.filter((u) => u.companyId === actor);
  const [origem, setOrigem] = useState(
    base?.originId ||
      (compra
        ? pedido.originId || pedido.proposals?.at(-1)?.originId || ''
        : (unidadeFixa?.id ?? '')),
  );
  const [quantidade, setQuantidade] = useState(base?.quantity ?? pedido.quantity);
  const [preco, setPreco] = useState(base?.unitPrice ?? pedido.unitPrice);
  const [frete, setFrete] = useState(base?.maxFreight ?? pedido.maxFreight);
  const [dias, setDias] = useState(3);
  const [transportadora, setTransportadora] = useState(base?.carrierId ?? '');
  const info = products[pedido.product];
  const origemE = world.establishments.find((e) => e.id === origem);
  const cotacao =
    origem && transportadora && quantidade > 0
      ? quote(world, origem, pedido.destinationId, pedido.product, quantidade, transportadora)
      : undefined;
  const destino = world.establishments.find((e) => e.id === pedido.destinationId);
  const problema =
    pedido.status !== 'pending' || pedido.deadline <= agora
      ? 'Este pedido está encerrado ou expirado.'
      : !cotacao
        ? 'Escolha quem vai levar a carga para calcular o frete.'
        : origemE && quantidade > availableStock(world, origemE, pedido.product)
          ? 'Você não tem tudo isso livre no estoque de origem.'
          : destino && quantidade > storageQuantity(world, destino, pedido.product)
            ? 'Não cabe no armazém de destino, contando o que já está a caminho.'
            : !cotacao.compatible
              ? 'A frota escolhida não leva essa quantidade, ou a estrada ainda está sendo traçada.'
              : cotacao.price > frete
                ? 'O teto de frete está abaixo do preço atual. Suba o teto para enviar.'
                : cotacao.durationMs > dias * GAME_DAY
                  ? 'O prazo é menor que o tempo de viagem. Escolha mais dias.'
                  : '';
  const carregando = useRoute(origemE?.propertyId, destino?.propertyId);
  return (
    <Modal
      title={base ? 'Responder com outra proposta' : 'Fazer uma proposta'}
      onClose={onClose}
      wide
    >
      <div className="ped-modal">
        <Recibo
          produto={pedido.product}
          titulo={`${info.name} para ${destino?.name ?? 'o comprador'}`}
          linhas={[
            {
              icone: 'caixa',
              rotulo: 'Pedido original',
              valor: `${num(pedido.quantity)} ${unidadeDe(pedido.product, pedido.quantity)}`,
            },
            { icone: 'moeda', rotulo: 'Preço original', valor: cr(pedido.unitPrice) },
          ]}
        />
        {!compra && (
          <div className="ped-escolha">
            <span id="ped-origem">De qual estoque sai?</span>
            <div role="radiogroup" aria-labelledby="ped-origem" className="ped-cartas">
              {meus.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={origem === u.id}
                  className={origem === u.id ? 'on' : ''}
                  onClick={() => setOrigem(u.id)}
                >
                  <strong>{u.name}</strong>
                  <small>
                    {num(u.inventory[pedido.product] ?? 0)} {unidadeDe(pedido.product, 2)} em
                    estoque
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="ped-campos">
          <CampoNumero
            rotulo="Quantidade"
            valor={quantidade}
            onChange={setQuantidade}
            min={1}
            passo={Math.max(1, Math.round(pedido.quantity / 20))}
            sufixo={unidadeDe(pedido.product, 2)}
          />
          <CampoNumero
            rotulo="Preço por unidade (R$)"
            valor={preco / 100}
            onChange={(v) => setPreco(Math.round(v * 100))}
            min={0.01}
            casas={2}
            passo={0.5}
          />
          <CampoNumero
            rotulo="Frete máximo (R$)"
            valor={frete / 100}
            onChange={(v) => setFrete(Math.round(v * 100))}
            min={0.01}
            casas={2}
            passo={10}
          />
        </div>
        <Prazos valor={dias} onChange={setDias} />
        <FleetPicker
          originId={origem}
          destinationId={pedido.destinationId}
          product={pedido.product}
          quantity={quantidade}
          value={transportadora}
          onChange={setTransportadora}
          onQuantityChange={setQuantidade}
          label="Quem leva a carga"
        />
        {cotacao && (
          <Recibo
            produto={pedido.product}
            titulo="Resumo da sua proposta"
            linhas={[
              { icone: 'custo', rotulo: 'Mercadoria', valor: cr(quantidade * preco) },
              { icone: 'caminhao', rotulo: 'Frete hoje', valor: cr(cotacao.price) },
            ]}
            total={cr(quantidade * preco + cotacao.price)}
            rotuloTotal="Mercadoria + frete"
          />
        )}
        {cotacao && cotacao.price > frete && (
          <button type="button" className="secondary" onClick={() => setFrete(cotacao.price)}>
            Usar o frete de hoje: {cr(cotacao.price)}
          </button>
        )}
        {problema && (
          <p className="ped-aviso" role="status">
            {problema}
          </p>
        )}
        <p className="ped-nota">
          A outra empresa precisa aceitar. O pagamento só é conferido quando ela aceitar.
        </p>
        <button
          className="primary ped-grande"
          disabled={
            pending ||
            carregando ||
            !origem ||
            !transportadora ||
            Boolean(problema) ||
            quantidade <= 0 ||
            preco <= 0 ||
            frete <= 0
          }
          onClick={async () => {
            if (
              await run(
                {
                  type: 'proposeOrder',
                  orderId: pedido.id,
                  establishmentId: origem,
                  unitPrice: preco,
                  quantity: quantidade,
                  maxFreight: frete,
                  deliveryDays: dias,
                  carrierId: transportadora,
                },
                'Proposta enviada. Agora é esperar a resposta.',
              )
            )
              onClose();
          }}
        >
          Enviar proposta
        </button>
      </div>
    </Modal>
  );
}

/** Pedir mercadoria: publica uma necessidade para que fornecedores mandem propostas. */
export function ModalPublicar({
  unidadeFixa,
  onClose,
}: {
  unidadeFixa?: Establishment;
  onClose: () => void;
}) {
  const { world, actor, run, pending } = useGame();
  const meus = world.establishments.filter((u) => u.companyId === actor);
  const [destino, setDestino] = useState(unidadeFixa?.id ?? meus[0]?.id ?? '');
  const [produto, setProduto] = useState<ProductId | ''>('');
  const [quantidade, setQuantidade] = useState(100);
  const [preco, setPreco] = useState(0);
  const [frete, setFrete] = useState(0);
  const [dias, setDias] = useState(3);
  const [reservar, setReservar] = useState(false);
  const total = quantidade * preco + frete;
  const caixa = freeCash(world, actor);
  const semCaixa = total > caixa;
  return (
    <Modal title="Pedir mercadoria" onClose={onClose} wide>
      <div className="ped-modal">
        <p className="ped-nota">
          Você diz o que precisa e quanto pagaria. Fornecedores mandam propostas e você escolhe.
          Nada é cobrado agora.
        </p>
        <div className="ped-escolha">
          <span id="ped-destino">Para qual unidade?</span>
          <div role="radiogroup" aria-labelledby="ped-destino" className="ped-cartas">
            {meus.map((u) => (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={destino === u.id}
                className={destino === u.id ? 'on' : ''}
                onClick={() => setDestino(u.id)}
              >
                <strong>{u.name}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="ped-escolha">
          <span id="ped-produto">O que você precisa?</span>
          <div role="radiogroup" aria-labelledby="ped-produto" className="ped-chips ped-produtos">
            {seasonProducts(world).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={produto === id}
                className={produto === id ? 'on' : ''}
                onClick={() => setProduto(id)}
              >
                <ProductIcon product={id} size={16} /> {products[id].name}
              </button>
            ))}
          </div>
        </div>
        <div className="ped-campos">
          <CampoNumero
            rotulo="Quantidade"
            valor={quantidade}
            onChange={setQuantidade}
            min={1}
            passo={Math.max(1, Math.round(quantidade / 10))}
            sufixo={produto ? unidadeDe(produto, 2) : undefined}
          />
          <CampoNumero
            rotulo="Preço máximo por unidade (R$)"
            valor={preco / 100}
            onChange={(v) => setPreco(Math.round(v * 100))}
            casas={2}
            passo={0.5}
          />
          <CampoNumero
            rotulo="Verba de frete (R$)"
            valor={frete / 100}
            onChange={(v) => setFrete(Math.round(v * 100))}
            casas={2}
            passo={10}
          />
        </div>
        <Prazos valor={dias} onChange={setDias} />
        <label className="ped-marca">
          <input
            type="checkbox"
            checked={reservar}
            onChange={(ev) => setReservar(ev.target.checked)}
          />
          Separar esse dinheiro até alguém aceitar, até você cancelar ou até vencer
        </label>
        {produto && (
          <Recibo
            produto={produto}
            titulo={`Você autoriza até ${cr(total)}`}
            linhas={[
              { icone: 'custo', rotulo: 'Mercadoria no máximo', valor: cr(quantidade * preco) },
              { icone: 'caminhao', rotulo: 'Frete no máximo', valor: cr(frete) },
            ]}
          />
        )}
        {semCaixa && total > 0 && (
          <p className="ped-aviso" role="status">
            O pedido autoriza {cr(total)}, mas o seu caixa livre é {cr(caixa)}. Peça menos ou espere
            entrar dinheiro.
          </p>
        )}
        <button
          className="primary ped-grande"
          disabled={
            pending ||
            semCaixa ||
            !destino ||
            !produto ||
            quantidade <= 0 ||
            preco <= 0 ||
            frete <= 0
          }
          onClick={async () => {
            if (
              await run(
                {
                  type: 'createPurchaseRequest',
                  reserveFunds: reservar,
                  destinationId: destino,
                  product: produto as ProductId,
                  quantity: quantidade,
                  unitPrice: preco,
                  maxFreight: frete,
                  deliveryDays: dias,
                },
                'Pedido publicado. Os fornecedores já podem mandar propostas.',
              )
            )
              onClose();
          }}
        >
          Publicar pedido
        </button>
      </div>
    </Modal>
  );
}
