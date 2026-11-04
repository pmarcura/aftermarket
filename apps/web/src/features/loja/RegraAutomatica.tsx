import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Interruptor, Passo } from '../business/Abastecimento';
import { BotaoEspera } from '../../components/Espera';
import { Carimbo } from '../../components/Livro';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { unidade } from '../economy/Carga';
import {
  products,
  type Establishment,
  type ProductId,
  type SupplyPolicy,
  type SupplyRule,
  type World,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import { retailCeiling, supplyForecast } from '../../../../../packages/simulation/src/supply';
import { supplyHistoryOf } from '../../../../../packages/simulation/src/indexes';
import { nomeTransportadora } from './frete';
import { mercadoDaCidade } from '../business/precificacao';

/** Margem que a proteção deixa entre o custo entregue (mercadoria + frete) e o preço de venda. */
const MARGEM_TRAVA = 0.1;
/** Frete máximo por unidade, como parte do preço de venda da loja. */
const FRETE_MAXIMO = 0.15;
/** Quantos dias de venda a loja mantém: pede quando cai à metade e enche até o total. */
const DIAS = [
  { dias: 3, ajuda: 'Pouco dinheiro parado, mas o caminhão sai mais vezes.' },
  { dias: 7, ajuda: 'Uma semana de venda: o equilíbrio para a maioria das lojas.' },
  { dias: 15, ajuda: 'Cargas grandes e frete mais barato por unidade; mais dinheiro parado.' },
] as const;

export const tetoDeFrete = (world: World, loja: Establishment, product: ProductId) =>
  Math.max(
    1,
    Math.round((loja.prices[product] ?? world.season.config.basePrices[product]) * FRETE_MAXIMO),
  );

/** A regra de repor sozinho de um produto da loja: liga, desliga e ajusta aqui mesmo. */
export function useRegra(loja: Establishment, product: ProductId) {
  const { world } = useGame();
  const salva = loja.supplyPolicy;
  const politica = useMemo<SupplyPolicy>(
    () => salva ?? { ...defaultSupplyPolicy(world, loja), rules: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salva, loja.id],
  );
  const regra = politica.rules.find((r) => r.product === product);
  return { politica, regra, ligada: Boolean(regra) && politica.enabled };
}

/** A proteção vale quando há a trava de lucro e cada regra tem teto de frete. */
const protegida = (p: SupplyPolicy) =>
  p.shelfMargin !== undefined && p.rules.every((r) => r.maxFreightPerUnit !== undefined);

export const protegerTudo = (world: World, loja: Establishment, p: SupplyPolicy): SupplyPolicy => ({
  ...p,
  shelfMargin: p.shelfMargin ?? MARGEM_TRAVA,
  rules: p.rules.map((x) => ({
    ...x,
    maxFreightPerUnit: x.maxFreightPerUnit ?? tetoDeFrete(world, loja, x.product),
  })),
});

/** Uma lacuna do bilhete: mostra a escolha atual e abre as opções com uma linha de ajuda cada. */
function Lacuna<T extends string | number>({
  valor,
  rotulo,
  opcoes,
  desabilitada,
  onEscolher,
}: {
  valor: ReactNode;
  rotulo: string;
  opcoes: { id: T; nome: string; ajuda: string; atual: boolean; bloqueada?: boolean }[];
  desabilitada?: boolean;
  onEscolher: (id: T) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const fora = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setAberta(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setAberta(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberta]);
  return (
    <span className="bl-lacuna" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberta}
        aria-label={`${rotulo}: trocar`}
        disabled={desabilitada}
        onClick={() => setAberta(!aberta)}
      >
        {valor}
        <i aria-hidden="true">▾</i>
      </button>
      {aberta && (
        <span className="bl-lacuna-menu" role="listbox" aria-label={rotulo}>
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.atual}
              className={o.atual ? 'on' : ''}
              disabled={o.bloqueada}
              onClick={() => {
                setAberta(false);
                if (!o.atual) onEscolher(o.id);
              }}
            >
              <strong>{o.nome}</strong>
              <small>{o.ajuda}</small>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Régua do estoque: quanto há, quanto vem na estrada, onde o gerente pede e até onde enche. */
function ReguaEstoque({
  atual,
  aCaminho,
  pede,
  enche,
  un,
}: {
  atual: number;
  aCaminho: number;
  pede: number;
  enche: number;
  un: string;
}) {
  const fim = Math.max(enche * 1.12, atual + aCaminho, 1);
  const x = (v: number) => `${Math.min(100, (v / fim) * 100)}%`;
  const abaixo = atual <= pede;
  return (
    <div
      className="bl-regua"
      role="img"
      aria-label={`Estoque ${num(atual)} ${un}${aCaminho ? `, mais ${num(aCaminho)} a caminho` : ''}. O gerente pede quando cai para ${num(pede)} e enche até ${num(enche)}.`}
    >
      <div className="bl-regua-trilho">
        <i className={`atual ${abaixo ? 'baixo' : ''}`} style={{ width: x(atual) }} />
        {aCaminho > 0 && <i className="estrada" style={{ left: x(atual), width: x(aCaminho) }} />}
        <span className="marca pede" style={{ left: x(pede) }} />
        <span className="marca enche" style={{ left: x(enche) }} />
      </div>
      <div className="bl-regua-rotulos" aria-hidden="true">
        <span style={{ left: x(pede) }}>
          pede aqui
          <b>{num(pede)}</b>
        </span>
        <span style={{ left: x(enche) }}>
          enche até
          <b>{num(enche)}</b>
        </span>
      </div>
      <p className="bl-regua-legenda">
        <span>
          <i className="atual" /> na loja: <b>{num(atual)}</b>
        </span>
        {aCaminho > 0 && (
          <span>
            <i className="estrada" /> na estrada: <b>{num(aCaminho)}</b>
          </span>
        )}
      </p>
    </div>
  );
}

interface Aviso {
  tom: 'brasa' | 'ouro';
  icone: NomeIcone;
  texto: string;
  acao?: { rotulo: string; agir: () => void };
}

export function RegraAutomatica({ loja, product }: { loja: Establishment; product: ProductId }) {
  const { world, actor, run, pending, navigate, openRepor } = useGame();
  const [trocando, setTrocando] = useState(false);
  const { politica, regra } = useRegra(loja, product);
  const [r, setR] = useState<SupplyRule | undefined>(regra);
  useEffect(
    () => setR(regra),
    [regra?.minimum, regra?.target, regra?.maxBuy, regra?.maxPrice, regra?.originId],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const previsao = useMemo(
    () => supplyForecast(world, loja, politica),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, politica],
  );
  const un = unidade(product, 2);
  const nome = products[product].name;
  // Venda por dia no preço de hoje: a mesma conta do cartão da prateleira.
  const vendeDia = useMemo(
    () =>
      Math.max(
        0.1,
        mercadoDaCidade(world, loja, product).vendas(
          loja.prices[product] ?? world.season.config.basePrices[product],
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, product],
  );
  const salvar = (proxima: SupplyPolicy, mensagem: string) =>
    run({ type: 'configureSupply', establishmentId: loja.id, policy: proxima }, mensagem);
  const paraDias = (base: SupplyRule, dias: number): SupplyRule => {
    const target = Math.max(2, Math.ceil(vendeDia * dias));
    return {
      ...base,
      minimum: Math.min(target - 1, Math.ceil(target / 2)),
      target,
      maxBuy: target,
    };
  };
  const modelo = (): SupplyRule =>
    paraDias(
      defaultSupplyPolicy(world, loja).rules.find((x) => x.product === product) ?? {
        product,
        minimum: 10,
        target: 100,
        maxBuy: 100,
        maxPrice: Math.round(world.season.config.basePrices[product] * 1.5),
      },
      7,
    );
  // A regra nova nasce protegida: comprar no prejuízo ou com frete de viagem vazia nunca é o padrão.
  const ligar = () =>
    salvar(
      protegerTudo(world, loja, {
        ...politica,
        enabled: politica.rules.length === 0 ? true : politica.enabled,
        rules: [...politica.rules, modelo()],
      }),
      `Combinado: o gerente repõe ${nome} sozinho.`,
    );
  const desligar = () =>
    salvar(
      { ...politica, rules: politica.rules.filter((x) => x.product !== product) },
      `${nome} deixou de ser reposto sozinho.`,
    );
  const trocarRegra = (nova: SupplyRule, mensagem: string) =>
    salvar(
      { ...politica, rules: politica.rules.map((x) => (x.product === product ? nova : x)) },
      mensagem,
    );

  const mudou =
    r &&
    regra &&
    (r.minimum !== regra.minimum || r.target !== regra.target || r.maxBuy !== regra.maxBuy);
  const valido = r ? Number.isInteger(r.minimum) && r.minimum >= 0 && r.minimum < r.target : true;
  const passo = Math.max(1, Math.round((r?.target ?? 100) / 20));
  const linha = previsao.rows.find((x) => x.product === product);
  const preco = loja.prices[product] ?? world.season.config.basePrices[product];
  const compensa = protegida(politica);
  const teto = retailCeiling(world, loja, product, { ...politica, shelfMargin: MARGEM_TRAVA });
  const freteMax = regra?.maxFreightPerUnit ?? tetoDeFrete(world, loja, product);
  const ultima = supplyHistoryOf(world, loja.id)
    .filter((h) => h.product === product && h.quantity > 0)
    .at(-1);
  const ultimaUn = ultima ? ultima.cost / ultima.quantity : 0;
  const diasAtuais = regra
    ? DIAS.find(
        (d) => Math.abs(regra.target - Math.ceil(vendeDia * d.dias)) <= vendeDia * d.dias * 0.15,
      )?.dias
    : undefined;

  const caminhoes = world.vehicles.filter((v) => v.companyId === actor);
  const livres = caminhoes.filter((v) => v.status === 'available').length;
  const viagens = world.shipments.filter((s) => s.destinationId === loja.id && s.quantity > 0);
  const media = (lista: typeof viagens) =>
    lista.length ? lista.reduce((n, s) => n + s.freight, 0) / lista.length : undefined;
  const fretePropria = media(viagens.filter((s) => s.carrierId === actor));
  const freteTerceiros = media(viagens.filter((s) => s.carrierId !== actor));
  const soFrota = politica.carrierId === 'own' || politica.carrierId === actor;
  const estoque = loja.inventory[product] ?? 0;
  const aCaminho = (linha?.incoming ?? 0) + (linha?.promised ?? 0);

  // O que o gerente diz agora, numa frase.
  const fala = linha?.want
    ? linha.best
      ? `Vou buscar ${num(linha.best.quantity)} ${un} em ${linha.best.origin.name}: ${cr(linha.best.total, 0)}, com ${cr(linha.best.q.price / linha.best.quantity)} de frete por unidade (${nomeTransportadora(world, linha.best.q.carrierId, loja.companyId)}).`
      : `O estoque baixou do combinado, mas ainda não achei uma compra dentro das regras.`
    : aCaminho > 0
      ? `${estoque <= 0 ? 'A prateleira está vazia, mas ' : ''}${num(aCaminho)} ${un} já ${linha?.incoming ? 'estão na estrada' : 'foram pedidos'}. Não peço mais nada por enquanto.`
      : `Tudo dentro do combinado. Peço de novo quando baixar de ${num(regra?.minimum ?? 0)} ${un}.`;

  // O que pode dar errado, só quando está dando.
  const avisos: Aviso[] = [];
  if (regra && !politica.enabled)
    avisos.push({
      tom: 'ouro',
      icone: 'alerta',
      texto: 'O abastecimento automático da loja está pausado: o gerente não compra nada.',
      acao: {
        rotulo: 'Retomar',
        agir: () => void salvar({ ...politica, enabled: true }, 'O gerente voltou a repor.'),
      },
    });
  if (regra && linha?.want && !linha.best)
    avisos.push({
      tom: 'brasa',
      icone: 'alerta',
      texto:
        soFrota && livres === 0
          ? `Seu caminhão está na estrada e o combinado é buscar só com ele. Se ${nome} acabar antes de ele voltar, a loja fica sem vender.`
          : compensa
            ? `Nenhum fornecedor entrega ${nome} com frete de até ${cr(freteMax)} e custo de até ${cr(teto)} por unidade. Se demorar, a prateleira esvazia.`
            : `Nenhum fornecedor atende agora. Se demorar, a prateleira esvazia.`,
      acao: {
        rotulo: 'Mandar buscar agora',
        agir: () => openRepor({ destinationId: loja.id, product }),
      },
    });
  if (regra && !compensa)
    avisos.push({
      tom: 'ouro',
      icone: 'moeda',
      texto:
        'O gerente está comprando sem olhar o frete: compras pequenas podem pagar um caminhão inteiro e dar prejuízo.',
      acao: {
        rotulo: 'Só com lucro',
        agir: () =>
          void salvar(protegerTudo(world, loja, politica), 'O gerente só compra o que compensa.'),
      },
    });
  if (regra && ultima && ultimaUn > preco)
    avisos.push({
      tom: 'brasa',
      icone: 'custo',
      texto: `A última compra chegou a ${cr(ultimaUn)} por unidade, mais do que você vende (${cr(preco)}).`,
    });

  return (
    <section className="bl-regra" aria-label={`Repor ${nome} sozinho`}>
      <header>
        <span className="lv-rotulo">Repor sozinho</span>
        <Interruptor
          ligado={Boolean(regra)}
          desabilitado={pending || trocando}
          ocupado={trocando}
          rotulo={`Repor ${nome} sozinho`}
          onChange={async () => {
            setTrocando(true);
            try {
              await (regra ? desligar() : ligar());
            } finally {
              setTrocando(false);
            }
          }}
        />
      </header>

      {!regra ? (
        <div className="bl-como">
          <p>O gerente da loja pode cuidar do {nome} por você:</p>
          <ol>
            <li>
              <IconePixel nome="caixa" tamanho={32} />
              <span>Você diz quantos dias de venda quer ter na prateleira.</span>
            </li>
            <li>
              <IconePixel nome="caminhao" tamanho={32} />
              <span>Quando o estoque cai à metade, ele manda buscar.</span>
            </li>
            <li>
              <IconePixel nome="moeda" tamanho={32} />
              <span>Ele só compra o que chega com lucro, frete incluído.</span>
            </li>
          </ol>
          <button className="primary" disabled={pending || trocando} onClick={() => void ligar()}>
            Combinar com o gerente
          </button>
        </div>
      ) : (
        r && (
          <>
            <article className="lv-nota bl-bilhete">
              <span className="lv-fita a" aria-hidden="true" />
              <p className="lv-mao">Combinado com o gerente</p>
              <p className="bl-frase">
                Manter{' '}
                <Lacuna
                  rotulo="Dias de venda na prateleira"
                  valor={diasAtuais ? `${diasAtuais} dias` : 'regra própria'}
                  desabilitada={pending}
                  opcoes={DIAS.map((d) => ({
                    id: d.dias,
                    nome: `${d.dias} dias · ~${num(Math.ceil(vendeDia * d.dias))} ${un}`,
                    ajuda: d.ajuda,
                    atual: diasAtuais === d.dias,
                  }))}
                  onEscolher={(d) =>
                    void trocarRegra(
                      paraDias(regra, d),
                      `Combinado: ${d} dias de ${nome} na prateleira.`,
                    )
                  }
                />{' '}
                de {nome} na prateleira, umas{' '}
                <b>
                  {num(regra.target)} {un}
                </b>
                . Quando baixar de <b>{num(regra.minimum)}</b>, buscar com{' '}
                <Lacuna
                  rotulo="Quem busca"
                  valor={soFrota ? 'meu caminhão' : 'quem cobrar menos'}
                  desabilitada={pending}
                  opcoes={[
                    {
                      id: 'own',
                      nome: 'Meu caminhão',
                      ajuda:
                        caminhoes.length === 0
                          ? 'Você ainda não tem caminhão.'
                          : `Mais barato (${fretePropria !== undefined ? `${cr(fretePropria, 0)} por viagem` : 'só diesel, pedágio e motorista'}), mas espera o caminhão voltar.`,
                      atual: soFrota,
                      bloqueada: caminhoes.length === 0,
                    },
                    {
                      id: 'auto',
                      nome: 'Quem cobrar menos',
                      ajuda: `Seu caminhão ou uma transportadora, o que sair mais barato${freteTerceiros !== undefined ? ` (transportadoras: ${cr(freteTerceiros, 0)} por viagem)` : ''}. Não espera.`,
                      atual: !soFrota,
                    },
                  ]}
                  onEscolher={(id) =>
                    void salvar(
                      { ...politica, carrierId: id },
                      id === 'own'
                        ? 'Combinado: a loja busca com o seu caminhão.'
                        : 'Combinado: a loja chama quem cobrar menos.',
                    )
                  }
                />
                .
              </p>
              {compensa && (
                <div className="bl-bilhete-carimbo">
                  <Carimbo tom="lavoura" giro={-6}>
                    só com lucro
                  </Carimbo>
                  <small>
                    Não compra se o frete passar de {cr(freteMax)} por unidade ou se a unidade
                    chegar acima de {cr(teto)}.
                  </small>
                </div>
              )}
            </article>

            <ReguaEstoque
              atual={estoque}
              aCaminho={aCaminho}
              pede={regra.minimum}
              enche={regra.target}
              un={un}
            />

            <div className="bl-gerente">
              <IconePixel nome="equipe" tamanho={28} />
              <p>
                <b>Gerente:</b> {fala}
                {ultima && (
                  <small>
                    Última compra: {num(ultima.quantity)} {unidade(product, ultima.quantity)},{' '}
                    {cr(ultimaUn)} cada com frete.
                  </small>
                )}
              </p>
            </div>

            {avisos.length > 0 && (
              <ul className="bl-avisos">
                {avisos.map((a) => (
                  <li key={a.texto} className={`tom-${a.tom}`}>
                    <IconePixel nome={a.icone} tamanho={24} />
                    <span>{a.texto}</span>
                    {a.acao && (
                      <button className="secondary" disabled={pending} onClick={a.acao.agir}>
                        {a.acao.rotulo}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <details className="bl-ajuste">
              <summary>Ajuste fino</summary>
              <div className="bl-ajuste-corpo">
                <div className="bl-regra-passos">
                  <Passo
                    rotulo="Pedir quando cair a"
                    valor={r.minimum}
                    passo={passo}
                    max={Math.max(0, r.target - 1)}
                    unidade={un}
                    onChange={(v) => setR({ ...r, minimum: v })}
                  />
                  <Passo
                    rotulo="Encher até"
                    valor={r.target}
                    passo={passo}
                    min={1}
                    unidade={un}
                    onChange={(v) =>
                      setR({ ...r, target: v, maxBuy: Math.max(r.maxBuy, v - r.minimum) })
                    }
                  />
                </div>
                {(mudou || !valido) && (
                  <footer className="bl-regra-salvar">
                    {!valido && (
                      <span className="bl-erro">
                        O valor de pedir precisa ser menor que o de encher.
                      </span>
                    )}
                    <BotaoEspera
                      className="primary"
                      esperando="Salvando…"
                      disabled={!valido || pending}
                      onClick={() => trocarRegra(r, `Regra de ${nome} salva.`)}
                    >
                      Salvar
                    </BotaoEspera>
                    <button className="text-button" onClick={() => setR(regra)}>
                      Desfazer
                    </button>
                  </footer>
                )}
                <p className="bl-ajuste-linha">
                  Gasto do gerente hoje: {cr(previsao.spent.executed, 0)} de{' '}
                  {cr(politica.dailyBudget, 0)} por dia.{' '}
                  <button className="text-button" onClick={() => navigate('carrier')}>
                    {caminhoes.length === 0 ? 'Comprar um caminhão' : 'Ver minha frota'}
                  </button>
                </p>
                <div className="bl-ajuste-linha bl-ajuste-trava">
                  <span>
                    Só com lucro: não comprar se o frete passar de 15% do preço de venda ou se a
                    unidade chegar a menos de 10% abaixo dele. Desligar só faz sentido para
                    abastecer de qualquer jeito, mesmo no prejuízo.
                  </span>
                  <Interruptor
                    ligado={compensa}
                    desabilitado={pending}
                    rotulo="Só comprar com lucro"
                    onChange={() =>
                      void salvar(
                        compensa
                          ? {
                              ...politica,
                              shelfMargin: undefined,
                              rules: politica.rules.map(({ maxFreightPerUnit: _, ...x }) => x),
                            }
                          : protegerTudo(world, loja, politica),
                        compensa
                          ? 'O gerente volta a comprar sem olhar frete e lucro.'
                          : 'O gerente só compra o que compensa.',
                      )
                    }
                  />
                </div>
              </div>
            </details>
          </>
        )
      )}
    </section>
  );
}
