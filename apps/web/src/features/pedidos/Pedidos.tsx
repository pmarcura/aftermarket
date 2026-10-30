import { useId, useState } from 'react';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { useGame } from '../../lib/game';
import type {
  Establishment,
  OrderProposal,
  PurchaseOrder,
} from '../../../../../packages/simulation/src/model';
import { CartaoCarga } from './CartaoCarga';
import { CartaoPedido } from './CartaoPedido';
import { ModalAceitar, ModalProposta, ModalPublicar } from './ModaisPedido';
import { useDadosPedidos } from './dados';
import '../../design/pedidos.css';

type Aba = 'responder' | 'caminho' | 'concluidos';
const POR_VEZ = 8;

function Secao({
  titulo,
  contagem,
  ajuda,
  children,
}: {
  titulo: string;
  contagem: number;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ped-secao">
      <h2>
        {titulo} <span className="ped-conta">{contagem}</span>
      </h2>
      {ajuda && <p className="ped-nota">{ajuda}</p>}
      <div className="ped-lista">{children}</div>
    </section>
  );
}

function Vazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: NomeIcone;
  titulo: string;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="ped-vazio">
      <IconePixel nome={icone} tamanho={56} />
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {acao}
    </div>
  );
}

/**
 * Pedidos e entregas num só lugar: o que espera resposta sua, o que está na estrada e o que já
 * terminou. Serve a tela de Comércio e as páginas de cada unidade (`unidade`).
 */
export function Pedidos({ unidade, inicial }: { unidade?: Establishment; inicial?: Aba }) {
  const { navigate, world } = useGame();
  const id = useId();
  const d = useDadosPedidos(unidade);
  const nResponder = d.precisa.length;
  const nCaminho = d.emCaminho.length + d.semViagem.length;
  const nFim = d.concluidosPedido.length + d.concluidosCarga.length;
  const [aba, setAba] = useState<Aba>(
    inicial ?? (nResponder > 0 ? 'responder' : nCaminho > 0 ? 'caminho' : 'responder'),
  );
  const [aceitar, setAceitar] = useState<{ pedido: PurchaseOrder; proposta?: OrderProposal }>();
  const [propor, setPropor] = useState<{ pedido: PurchaseOrder; base?: OrderProposal }>();
  const [publicar, setPublicar] = useState(false);
  const [maisAbertos, setMaisAbertos] = useState(POR_VEZ);
  const [maisFim, setMaisFim] = useState(POR_VEZ);

  const abas: { id: Aba; rotulo: string; icone: NomeIcone; n: number }[] = [
    { id: 'responder', rotulo: 'Responder', icone: 'carta', n: nResponder },
    { id: 'caminho', rotulo: 'A caminho', icone: 'caminhao', n: nCaminho },
    { id: 'concluidos', rotulo: 'Concluídos', icone: 'caixa', n: nFim },
  ];
  const cartao = (o: PurchaseOrder, s: Parameters<typeof CartaoPedido>[0]['situacao']) => (
    <CartaoPedido
      key={o.id}
      o={o}
      situacao={s}
      onAceitar={(proposta) => setAceitar({ pedido: o, proposta })}
      onProposta={(base) => setPropor({ pedido: o, base })}
    />
  );
  const fim: { chave: string; no: React.ReactNode }[] = [
    ...d.concluidosPedido.map((o) => ({ chave: o.id, no: cartao(o, 'fim') })),
    ...d.concluidosCarga.map((g) => ({ chave: g.id, no: <CartaoCarga key={g.id} g={g} /> })),
  ];

  return (
    <div className="ped">
      <div className="ped-topo">
        <div className="ped-abas" role="tablist" aria-label="Pedidos">
          {abas.map((a) => (
            <button
              key={a.id}
              role="tab"
              id={`${id}-aba-${a.id}`}
              aria-selected={aba === a.id}
              aria-controls={`${id}-painel-${a.id}`}
              tabIndex={aba === a.id ? 0 : -1}
              onKeyDown={(ev) => {
                const i = abas.findIndex((b) => b.id === a.id);
                const proxima =
                  ev.key === 'ArrowRight'
                    ? (i + 1) % abas.length
                    : ev.key === 'ArrowLeft'
                      ? (i + abas.length - 1) % abas.length
                      : ev.key === 'Home'
                        ? 0
                        : ev.key === 'End'
                          ? abas.length - 1
                          : -1;
                if (proxima < 0) return;
                ev.preventDefault();
                setAba(abas[proxima].id);
                document.getElementById(`${id}-aba-${abas[proxima].id}`)?.focus();
              }}
              className={aba === a.id ? 'on' : ''}
              onClick={() => setAba(a.id)}
            >
              <IconePixel nome={a.icone} tamanho={28} />
              <span>{a.rotulo}</span>
              <b className={a.id === 'responder' && a.n > 0 ? 'chama' : ''}>{a.n}</b>
            </button>
          ))}
        </div>
        <button className="primary ped-novo" onClick={() => setPublicar(true)}>
          Pedir mercadoria
        </button>
      </div>

      <div
        role="tabpanel"
        id={`${id}-painel-${aba}`}
        aria-labelledby={`${id}-aba-${aba}`}
        tabIndex={0}
      >
        {aba === 'responder' && (
          <>
            {nResponder > 0 ? (
              <Secao titulo="Precisam de você" contagem={nResponder}>
                {d.precisa.map((o) => cartao(o, 'precisa'))}
              </Secao>
            ) : d.espera.length + d.abertos.length > 0 ? (
              <p className="ped-livre">
                <IconePixel nome="carta" tamanho={28} /> Nada esperando você agora.
              </p>
            ) : (
              <Vazio
                icone="carta"
                titulo="Nada esperando você"
                texto="Quando alguém mandar uma proposta ou fizer um pedido para você, ele aparece aqui."
              />
            )}
            {d.espera.length > 0 && (
              <Secao
                titulo="Esperando a outra empresa"
                contagem={d.espera.length}
                ajuda="Aguarde a resposta. Pedidos de compra seus podem ser cancelados enquanto estiverem abertos."
              >
                {d.espera.map((o) => cartao(o, 'espera'))}
              </Secao>
            )}
            {d.abertos.length > 0 && (
              <Secao
                titulo="Procuram o que você tem"
                contagem={d.abertos.length}
                ajuda="Pedidos abertos de outras empresas para produtos que você tem em estoque."
              >
                {d.abertos.slice(0, maisAbertos).map((o) => cartao(o, 'aberto'))}
                {d.abertos.length > maisAbertos && (
                  <button
                    className="secondary ped-mais"
                    onClick={() => setMaisAbertos(maisAbertos + POR_VEZ)}
                  >
                    Mostrar mais pedidos
                  </button>
                )}
              </Secao>
            )}
          </>
        )}

        {aba === 'caminho' &&
          (nCaminho > 0 ? (
            <Secao titulo="Na estrada" contagem={nCaminho}>
              {d.emCaminho.map((g) => (
                <CartaoCarga key={g.id} g={g} />
              ))}
              {d.semViagem.map((o) => cartao(o, 'caminho'))}
            </Secao>
          ) : (
            <Vazio
              icone="caminhao"
              titulo="Nenhuma carga na estrada"
              texto="Compras, vendas e contratos aparecem aqui assim que o caminhão sai."
              acao={
                <button className="secondary" onClick={() => navigate('market')}>
                  Ir ao mercado
                </button>
              }
            />
          ))}

        {aba === 'concluidos' &&
          (fim.length > 0 ? (
            <Secao titulo="Já terminaram" contagem={fim.length}>
              {fim.slice(0, maisFim).map((f) => f.no)}
              {fim.length > maisFim && (
                <button
                  className="secondary ped-mais"
                  onClick={() => setMaisFim(maisFim + POR_VEZ)}
                >
                  Mostrar mais
                </button>
              )}
            </Secao>
          ) : (
            <Vazio
              icone="caixa"
              titulo="Ainda não há pedidos concluídos"
              texto="Pedidos entregues, cancelados ou vencidos ficam guardados aqui."
            />
          ))}
      </div>

      <p className="ped-nota ped-rodape-geral">
        Conversar não reserva estoque nem cobra. Na hora de aceitar, preço, prazo, caixa, espaço e
        caminhões são conferidos de novo.
      </p>

      {aceitar && (
        <ModalAceitar
          pedido={world.orders.find((o) => o.id === aceitar.pedido.id) ?? aceitar.pedido}
          proposta={aceitar.proposta}
          onClose={() => setAceitar(undefined)}
        />
      )}
      {propor && (
        <ModalProposta
          pedido={world.orders.find((o) => o.id === propor.pedido.id) ?? propor.pedido}
          base={propor.base}
          unidadeFixa={unidade}
          onClose={() => setPropor(undefined)}
        />
      )}
      {publicar && <ModalPublicar unidadeFixa={unidade} onClose={() => setPublicar(false)} />}
    </div>
  );
}
