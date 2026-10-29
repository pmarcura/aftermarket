import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { useRouteStatus } from '../../lib/routing';
import { IconePixel } from '../../components/IconePixel';
import { PixelArt } from '../../components/PixelArt';
import { matizDoProduto } from '../../design/arte';
import { ProdutoArte } from './Vitrine';
import { unidade } from './Carga';
import { avaliar, type Avaliacao } from './compra';
import { horasDeJogo } from '../inicio/tempo';
import { products, type Offer } from '../../../../../packages/simulation/src/model';
import { dailyNeed } from '../../../../../packages/simulation/src/supply';
import { freeCash } from '../../../../../packages/simulation/src/design';
import '../../design/gaveta.css';

interface Opcao {
  oferta: Offer;
  vendedor: string;
  cidade: string;
  propriedadeId: string;
  aval: Avaliacao;
  distanciaKm: number;
  horas: number;
}

const PRAZOS = [
  { dias: 3, rotulo: 'Pouco', ajuda: 'o básico' },
  { dias: 7, rotulo: 'Normal', ajuda: 'uma semana' },
  { dias: 15, rotulo: 'Bastante', ajuda: 'frete mais barato' },
] as const;

/**
 * Mandar buscar: a reposição como uma pequena cena. Escolhe-se quanto, quem leva e despacha-se o
 * caminhão. Usa as mesmas contas e o mesmo comando (`trade`) da tela de compra.
 */
export function ReporGaveta() {
  const { repor } = useGame();
  return repor ? <Gaveta key={`${repor.destinationId}:${repor.product}`} /> : null;
}

function Gaveta() {
  const { world, actor, repor, openRepor, run, pending, navigate } = useGame();
  const ref = useRef<HTMLDialogElement>(null);
  const loja = world.establishments.find((e) => e.id === repor!.destinationId)!;
  const produto = repor!.product;
  const info = products[produto];
  // Ritmo real de venda: já respeita a equipe e o espaço da loja.
  const porDia = Math.max(0.1, dailyNeed(world, loja, produto));
  const estoque = loja.inventory[produto] ?? 0;
  const [dias, setDias] = useState<number>(7);
  // Teto do que cabe nos caminhões e no estoque dos fornecedores; desce sozinho até haver entrega.
  const [teto, setTeto] = useState(Infinity);
  const [mexeu, setMexeu] = useState(false);
  const [quantidade, setQuantidade] = useState(() => Math.max(1, Math.ceil(porDia * 7)));
  const [escolhida, setEscolhida] = useState('');
  const [enviado, setEnviado] = useState<{ minutos: number; horas: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    const no = ref.current!;
    const antes = document.activeElement as HTMLElement | null;
    no.showModal();
    return () => {
      no.close();
      antes?.focus();
    };
  }, []);

  const fornecedores = useMemo(
    () =>
      world.offers.filter((o) => {
        const e = world.establishments.find((x) => x.id === o.establishmentId);
        return (
          o.product === produto &&
          e &&
          e.enabled &&
          e.id !== loja.id &&
          (e.inventory[produto] ?? 0) > 0
        );
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, produto, loja.id],
  );

  const opcoes = useMemo<Opcao[]>(() => {
    const candidatas = world.offers
      .filter((o) => o.product === produto)
      .map((o) => ({ o, e: world.establishments.find((x) => x.id === o.establishmentId)! }))
      .filter(({ e }) => e && e.enabled && e.id !== loja.id && (e.inventory[produto] ?? 0) > 0)
      .sort((a, b) => a.o.price - b.o.price)
      .slice(0, 8);
    const lista: Opcao[] = [];
    for (const { o, e } of candidatas) {
      const q = Math.min(quantidade, Math.floor(e.inventory[produto] ?? 0));
      const aval = avaliar(world, actor, o, loja, q);
      if (!aval?.frete) continue;
      const p = world.properties.find((x) => x.id === e.propertyId)!;
      lista.push({
        oferta: o,
        vendedor: e.name,
        cidade: `${p.city}, ${p.state}`,
        propriedadeId: p.id,
        aval,
        distanciaKm: aval.frete.distanceKm,
        horas: Math.max(1, horasDeJogo(aval.frete.durationMs)),
      });
    }
    return lista.sort((a, b) => a.aval.naPorta - b.aval.naPorta).slice(0, 3);
    // O mundo muda por revisão; o resto são as escolhas do jogador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, produto, loja.id, quantidade]);

  useEffect(() => {
    if (opcoes.length === 0 && quantidade > 1 && !mexeu) {
      const menor = Math.max(1, Math.floor(quantidade / 2));
      setTeto(menor);
      setQuantidade(menor);
    }
  }, [opcoes.length, quantidade, mexeu]);

  // Começa com o que o caixa aguenta: se a quantidade pedida não cabe, encolhe até caber.
  const totalAtual = (opcoes.find((o) => o.oferta.id === escolhida) ?? opcoes[0])?.aval.total ?? 0;
  const caixaLivre = freeCash(world, actor);
  useEffect(() => {
    if (!mexeu && totalAtual > caixaLivre && quantidade > 1) {
      setQuantidade(Math.max(1, Math.floor(quantidade * Math.min(0.95, caixaLivre / totalAtual))));
    }
  }, [mexeu, totalAtual, caixaLivre, quantidade]);

  const atual = opcoes.find((o) => o.oferta.id === escolhida) ?? opcoes[0];
  const maisBarata = opcoes.reduce<Opcao | undefined>(
    (m, o) => (!m || o.aval.naPorta < m.aval.naPorta ? o : m),
    undefined,
  );
  const maisRapida = opcoes.reduce<Opcao | undefined>(
    (m, o) => (!m || o.horas < m.horas ? o : m),
    undefined,
  );
  const maisPerto = opcoes.reduce<Opcao | undefined>(
    (m, o) => (!m || o.distanciaKm < m.distanciaKm ? o : m),
    undefined,
  );
  const rota = useRouteStatus(atual?.propriedadeId, loja.propertyId);
  const caixa = freeCash(world, actor);
  const total = atual?.aval.total ?? 0;
  const semCaixa = total > caixa;
  const duraDias = (estoque + quantidade) / porDia;

  const fechar = () => openRepor(null);
  const despachar = async () => {
    if (!atual?.aval.frete) return;
    const frete = atual.aval.frete;
    const ok = await run(
      {
        type: 'trade',
        offerId: atual.oferta.id,
        quantity: atual.aval.quantidade,
        destinationId: loja.id,
        carrierId: frete.carrierId,
        expectedTotal: atual.aval.total,
      },
      `Comprado: ${num(atual.aval.quantidade)} ${info.name}. O caminhão já saiu.`,
    );
    if (ok)
      setEnviado({
        minutos: Math.max(1, Math.round(frete.durationMs / 60000)),
        horas: atual.horas,
        total: atual.aval.total,
      });
  };

  const escolherDias = (d: number) => {
    setDias(d);
    setMexeu(true);
    setQuantidade(Math.max(1, Math.min(teto, Math.ceil(porDia * d))));
  };

  return (
    <dialog
      ref={ref}
      className="gaveta"
      aria-labelledby="gaveta-titulo"
      onCancel={fechar}
      onClick={(ev) => ev.target === ev.currentTarget && fechar()}
    >
      <div className="gaveta-painel">
        <button className="gaveta-fechar" onClick={fechar} aria-label="Fechar">
          <X size={20} />
        </button>

        {enviado ? (
          <section className="gaveta-ok" aria-live="polite">
            <div className="gaveta-estrada" aria-hidden="true">
              <PixelArt name="caminhao" scale={1} className="gaveta-caminhao" />
            </div>
            <h2>O caminhão saiu!</h2>
            <p>
              <b>
                {num(quantidade)} {unidade(produto, quantidade)}
              </b>{' '}
              de {info.name} a caminho da {loja.name}.
            </p>
            <p className="gaveta-chega">
              <IconePixel nome="prazo" tamanho={22} /> Chega em cerca de {num(enviado.horas)} h de
              jogo
            </p>
            <div className="gaveta-acoes">
              <button className="secondary" onClick={fechar}>
                Continuar jogando
              </button>
              <button
                className="primary"
                onClick={() => {
                  fechar();
                  navigate('inicio');
                }}
              >
                Acompanhar no Início
              </button>
            </div>
          </section>
        ) : (
          <>
            <header className="gaveta-cab" style={{ ['--h' as string]: matizDoProduto(produto) }}>
              <div className="gaveta-cena">
                <ProdutoArte product={produto} escala={4} />
              </div>
              <div>
                <h2 id="gaveta-titulo">Mandar buscar {info.name}</h2>
                <p>
                  para <b>{loja.name}</b>
                </p>
                <p className="gaveta-situacao">
                  {estoque > 0 ? (
                    <>
                      Hoje você tem {num(estoque)} {unidade(produto, estoque)}.
                    </>
                  ) : (
                    <>Hoje a prateleira está vazia.</>
                  )}{' '}
                  Vende cerca de {num(porDia, 1)} por dia.
                </p>
              </div>
            </header>

            <section className="gaveta-bloco" aria-labelledby="gaveta-quanto">
              <h3 id="gaveta-quanto">Quanto você quer?</h3>
              <div className="gaveta-prazos" role="radiogroup" aria-label="Quantidade">
                {PRAZOS.map((p) => (
                  <button
                    key={p.dias}
                    role="radio"
                    aria-checked={dias === p.dias}
                    className={dias === p.dias ? 'on' : ''}
                    onClick={() => escolherDias(p.dias)}
                  >
                    <strong>{p.rotulo}</strong>
                    <span>
                      {num(Math.min(teto, Math.ceil(porDia * p.dias)))}{' '}
                      {unidade(produto, Math.min(teto, Math.ceil(porDia * p.dias)))}
                    </span>
                    <small>{p.ajuda}</small>
                  </button>
                ))}
              </div>
              <label className="gaveta-ajuste">
                <span>Ou escolha a quantidade</span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(
                    10,
                    Math.min(
                      teto === Infinity ? Math.ceil(porDia * 30) : teto * 2,
                      Math.ceil(porDia * 30),
                    ),
                  )}
                  value={quantidade}
                  onChange={(ev) => {
                    setDias(0);
                    setMexeu(true);
                    setQuantidade(Number(ev.target.value));
                  }}
                />
                <b>
                  {num(quantidade)} {unidade(produto, quantidade)}
                </b>
              </label>
              <p className="gaveta-dura">
                Com isso o estoque dura cerca de <b>{num(duraDias, 1)} dias</b>.
              </p>
            </section>

            <section className="gaveta-bloco" aria-labelledby="gaveta-quem">
              <h3 id="gaveta-quem">Quem leva?</h3>
              {opcoes.length === 0 ? (
                <div className="gaveta-vazio">
                  <IconePixel nome="caixa" tamanho={40} />
                  <p>
                    {fornecedores === 0
                      ? `Ninguém tem ${info.name} em estoque agora. Os fornecedores repõem com o tempo: volte daqui a pouco.`
                      : 'Nenhum caminhão disponível leva essa quantidade agora. Tente uma quantidade menor.'}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      fechar();
                      navigate('quotes');
                    }}
                  >
                    Ver o mercado
                  </button>
                </div>
              ) : (
                <ul className="gaveta-opcoes">
                  {opcoes.map((o) => {
                    const sel = atual?.oferta.id === o.oferta.id;
                    return (
                      <li key={o.oferta.id}>
                        <button
                          className={`gaveta-opcao ${sel ? 'on' : ''}`}
                          aria-pressed={sel}
                          onClick={() => setEscolhida(o.oferta.id)}
                        >
                          <span className="gaveta-selos">
                            {maisBarata === o && opcoes.length > 1 && (
                              <em className="barato">
                                <IconePixel nome="estrela" tamanho={16} /> Mais barato
                              </em>
                            )}
                            {maisRapida === o && opcoes.length > 1 && (
                              <em className="rapido">Mais rápido</em>
                            )}
                            {maisPerto === o && opcoes.length > 1 && (
                              <em className="perto">Mais perto</em>
                            )}
                          </span>
                          <strong>{o.vendedor}</strong>
                          <span className="gaveta-onde">
                            <IconePixel nome="mapa" tamanho={18} /> {o.cidade} ·{' '}
                            {num(o.distanciaKm)} km
                          </span>
                          <span className="gaveta-preco">
                            <IconePixel nome="moeda" tamanho={22} />
                            <b>{cr(o.aval.naPorta)}</b>
                            <small>cada, já com frete</small>
                          </span>
                          <span className="gaveta-prazo">
                            <IconePixel nome="prazo" tamanho={18} /> ~{num(o.horas)} h · total{' '}
                            {cr(o.aval.total, 0)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <footer className="gaveta-rodape">
              <div className="gaveta-conta">
                <span>Total a pagar</span>
                <b>{cr(total, 0)}</b>
                <small className={semCaixa ? 'falta' : ''}>
                  {semCaixa
                    ? `Faltam ${cr(total - caixa, 0)} no caixa`
                    : `Sobram ${cr(caixa - total, 0)} no caixa`}
                </small>
              </div>
              <button
                className="primary gaveta-despachar"
                disabled={!atual || semCaixa || pending || (!rota.ready && rota.loading)}
                onClick={despachar}
              >
                {rota.loading ? 'Traçando a estrada…' : 'Despachar caminhão'}
              </button>
              {rota.error && <p className="gaveta-erro">{rota.error}</p>}
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
