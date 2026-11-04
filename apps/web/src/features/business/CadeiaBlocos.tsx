import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame, num } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import { spriteDoNegocio } from '../../design/arte';
import { ProdutoMini } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { mercadoDaCidade } from './precificacao';
import { usosDe, sugestoesDaCadeia } from './cadeia';
import { protegerTudo } from '../loja/RegraAutomatica';
import {
  products,
  type Establishment,
  type ProductId,
  type SupplyPolicy,
  type SupplyRule,
  type World,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import '../../design/cadeia.css';

/** De onde vem um encaixe: um negócio do jogador, o mercado (o gerente compra) ou a mão do dono. */
export type Fonte = string | 'mercado' | null;

const COLUNAS = ['Campo', 'Indústria', 'Loja', 'Famílias'] as const;
const colunaDe = (e: Establishment) =>
  e.category === 'farm' || e.category === 'mine' ? 0 : e.category === 'retail' ? 2 : 1;

/** Cor de cada produto na peça e no encaixe: o jogador encaixa pela cor e pela figura. */
const corDe = (id: ProductId) =>
  `hsl(${(id.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 47) % 360} 55% 68%)`;

const saidasDe = (world: World, e: Establishment) =>
  e.category === 'retail'
    ? []
    : (Object.keys(
        world.season.config.recipes.find((r) => r.id === e.specialization)?.output ?? {},
      ) as ProductId[]);

function fonteDe(e: Establishment, p: ProductId): Fonte {
  const regra = e.supplyPolicy?.rules.find((r) => r.product === p);
  if (!regra) return null;
  return regra.originId ?? 'mercado';
}

/** Regra nova de um encaixe: na loja, uma semana de venda; na produção, a regra padrão. */
function regraNova(world: World, destino: Establishment, p: ProductId): SupplyRule {
  const maxPrice = Math.round(world.season.config.basePrices[p] * 1.5);
  if (destino.category === 'retail') {
    const preco = destino.prices[p] ?? world.season.config.basePrices[p];
    const target = Math.max(2, Math.ceil(mercadoDaCidade(world, destino, p).vendas(preco) * 7));
    return { product: p, minimum: Math.ceil(target / 2), target, maxBuy: target, maxPrice };
  }
  return (
    defaultSupplyPolicy(world, destino).rules.find((r) => r.product === p) ?? {
      product: p,
      minimum: 10,
      target: 100,
      maxBuy: 100,
      maxPrice,
    }
  );
}

/** A política do destino com o encaixe do produto trocado: mesmo comando de sempre. */
export function politicaCom(
  world: World,
  destino: Establishment,
  p: ProductId,
  fonte: Fonte,
): SupplyPolicy {
  const base = destino.supplyPolicy ?? { ...defaultSupplyPolicy(world, destino), rules: [] };
  const atual = base.rules.find((r) => r.product === p);
  const resto = base.rules.filter((r) => r.product !== p);
  let politica: SupplyPolicy = { ...base, rules: resto };
  if (fonte !== null) {
    const { originId: _, ...semOrigem } = atual ?? regraNova(world, destino, p);
    const regra: SupplyRule = fonte === 'mercado' ? semOrigem : { ...semOrigem, originId: fonte };
    politica = { ...politica, enabled: true, rules: [...resto, regra] };
    // Loja nasce protegida: o gerente só compra o que chega com lucro, frete incluído.
    if (destino.category === 'retail') politica = protegerTudo(world, destino, politica);
  }
  return politica;
}

interface Arrasto {
  de: string;
  p: ProductId;
  x: number;
  y: number;
  mexeu: boolean;
}

/**
 * A cadeia do jogador em blocos: cada negócio com as peças do que faz (à direita) e os encaixes do
 * que precisa (à esquerda). Encaixar uma peça cria a rota entre os dois negócios; tocar num encaixe
 * mostra de onde a mercadoria pode vir. Tudo pelo comando `configureSupply`.
 */
export function CadeiaBlocos() {
  const { world, actor, run, pending, openBusiness, navigate } = useGame();
  const meus = useMemo(
    () =>
      world.establishments.filter(
        (e) => e.companyId === actor && e.installed !== false && e.category !== 'logistics',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const sugeridas = useMemo(
    () =>
      new Set(
        sugestoesDaCadeia(world, actor)
          .filter((s) => s.tipo === 'abastecer')
          .map((s) => `${s.origem.id}:${s.produto}`),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, actor],
  );
  const [escolhido, setEscolhido] = useState<{ destino: string; p: ProductId } | null>(null);
  const [naMao, setNaMao] = useState<{ de: string; p: ProductId } | null>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const tabuleiro = useRef<HTMLDivElement>(null);
  const [fios, setFios] = useState<{ d: string; tipo: string; chave: string }[]>([]);
  const [tamanho, setTamanho] = useState({ w: 0, h: 0 });
  const [linhaArrasto, setLinhaArrasto] = useState<string | null>(null);

  const encaixar = (destinoId: string, p: ProductId, fonte: Fonte) => {
    const destino = meus.find((e) => e.id === destinoId);
    if (!destino) return;
    const texto =
      fonte === null
        ? `${products[p].name} de ${destino.name}: agora você compra na mão.`
        : fonte === 'mercado'
          ? `${products[p].name} de ${destino.name}: o gerente compra no mercado.`
          : `${products[p].name}: ${meus.find((e) => e.id === fonte)?.name} abastece ${destino.name}.`;
    setEscolhido({ destino: destinoId, p });
    void run(
      {
        type: 'configureSupply',
        establishmentId: destinoId,
        policy: politicaCom(world, destino, p, fonte),
      },
      texto,
    );
  };

  // Fios: recalculados pela posição real de peças e encaixes a cada mudança de layout.
  const medir = () => {
    const t = tabuleiro.current;
    if (!t) return;
    const caixa = t.getBoundingClientRect();
    const ponto = (el: Element, lado: 'esq' | 'dir') => {
      const r = el.getBoundingClientRect();
      return {
        x: (lado === 'dir' ? r.right : r.left) - caixa.left + t.scrollLeft,
        y: r.top + r.height / 2 - caixa.top + t.scrollTop,
      };
    };
    const curva = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = Math.max(40, (b.x - a.x) / 2);
      return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
    };
    const lista: { d: string; tipo: string; chave: string }[] = [];
    t.querySelectorAll<HTMLElement>('[data-encaixe]').forEach((enc) => {
      const [destino, p] = enc.dataset.encaixe!.split(':');
      const e = meus.find((x) => x.id === destino);
      const fonte = e && fonteDe(e, p as ProductId);
      if (!fonte) return;
      const b = ponto(enc, 'esq');
      if (fonte === 'mercado') {
        lista.push({
          d: `M${b.x - 40},${b.y} L${b.x},${b.y}`,
          tipo: 'mercado',
          chave: enc.dataset.encaixe!,
        });
        return;
      }
      const peca = t.querySelector(`[data-peca="${fonte}:${p}"]`);
      if (peca)
        lista.push({
          d: curva(ponto(peca, 'dir'), b),
          tipo: 'proprio',
          chave: enc.dataset.encaixe!,
        });
    });
    t.querySelectorAll<HTMLElement>('[data-familias]').forEach((peca) => {
      const fam = t.querySelector('[data-bloco-familias]');
      if (fam)
        lista.push({
          d: curva(ponto(peca, 'dir'), ponto(fam, 'esq')),
          tipo: 'familias',
          chave: peca.dataset.familias!,
        });
    });
    setFios(lista);
    setTamanho({ w: t.scrollWidth, h: t.scrollHeight });
  };
  useLayoutEffect(medir, [world.revision, meus.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = tabuleiro.current;
    if (!t) return;
    const obs = new ResizeObserver(() => medir());
    obs.observe(t);
    return () => obs.disconnect();
  }, [meus.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrastar uma peça: o encaixe do mesmo produto acende; soltar nele encaixa.
  useEffect(() => {
    if (!arrasto) return;
    const mover = (ev: PointerEvent) => {
      const mexeu = arrasto.mexeu || Math.hypot(ev.clientX - arrasto.x, ev.clientY - arrasto.y) > 6;
      if (!mexeu) return;
      if (!arrasto.mexeu) setArrasto({ ...arrasto, mexeu: true });
      const sob = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-encaixe]');
      setAlvo(sob && sob.dataset.encaixe!.endsWith(`:${arrasto.p}`) ? sob.dataset.encaixe! : null);
      const t = tabuleiro.current;
      const peca = t?.querySelector(`[data-peca="${arrasto.de}:${arrasto.p}"]`);
      if (t && peca) {
        const c = t.getBoundingClientRect();
        const r = peca.getBoundingClientRect();
        const a = {
          x: r.right - c.left + t.scrollLeft,
          y: r.top + r.height / 2 - c.top + t.scrollTop,
        };
        const b = { x: ev.clientX - c.left + t.scrollLeft, y: ev.clientY - c.top + t.scrollTop };
        const dx = Math.max(40, (b.x - a.x) / 2);
        setLinhaArrasto(`M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`);
      }
    };
    const soltar = (ev: PointerEvent) => {
      const sob = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest<HTMLElement>('[data-encaixe]');
      const foi = arrasto;
      setArrasto(null);
      setAlvo(null);
      setLinhaArrasto(null);
      if (!foi.mexeu) {
        // Toque: a peça fica na mão até tocar num encaixe.
        setNaMao((m) => (m && m.de === foi.de && m.p === foi.p ? null : { de: foi.de, p: foi.p }));
        return;
      }
      if (sob) {
        const [destino, p] = sob.dataset.encaixe!.split(':');
        if (p === foi.p && destino !== foi.de) encaixar(destino, foi.p, foi.de);
      }
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar, { once: true });
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [arrasto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!naMao) return;
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setNaMao(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [naMao]);

  if (meus.length === 0) return null;
  const segurando = arrasto?.mexeu ? arrasto.p : naMao?.p;
  const lojas = meus.filter((e) => e.category === 'retail');
  const escolhidoE = escolhido && meus.find((e) => e.id === escolhido.destino);
  const fonteEscolhida = escolhidoE && escolhido ? fonteDe(escolhidoE, escolhido.p) : null;

  const tocarEncaixe = (destino: string, p: ProductId) => {
    if (naMao) {
      if (naMao.p === p && naMao.de !== destino) {
        encaixar(destino, p, naMao.de);
        setNaMao(null);
      }
      return;
    }
    setEscolhido({ destino, p });
  };

  return (
    <section className="cb" aria-labelledby="cb-titulo">
      <header className="cb-cab">
        <h2 id="cb-titulo" className="lv-grande">
          Sua cadeia
        </h2>
        <p>
          Arraste uma peça (o que um negócio faz) até o encaixe da mesma cor (o que outro precisa),
          ou toque na peça e depois no encaixe. Toque num encaixe para escolher de onde a mercadoria
          vem.
        </p>
        <ul className="cb-legenda" aria-label="Legenda dos fios">
          <li>
            <i className="proprio" /> do seu negócio
          </li>
          <li>
            <i className="mercado" /> do mercado (o gerente compra)
          </li>
          <li>
            <i className="mao" /> você compra na mão
          </li>
        </ul>
      </header>

      <div className="cb-palco">
        <div
          className={`cb-tabuleiro ${segurando ? 'segurando' : ''}`}
          ref={tabuleiro}
          onScroll={medir}
        >
          <svg className="cb-fios" width={tamanho.w} height={tamanho.h} aria-hidden="true">
            {fios.map((f) => (
              <path
                key={`${f.tipo}:${f.chave}`}
                d={f.d}
                className={`${f.tipo} ${escolhido && f.chave === `${escolhido.destino}:${escolhido.p}` ? 'escolhido' : ''}`}
              />
            ))}
            {linhaArrasto && <path d={linhaArrasto} className="arrastando" />}
          </svg>
          <div className="cb-colunas">
            {COLUNAS.map((titulo, i) => (
              <div key={titulo} className="cb-coluna">
                <h3>{titulo}</h3>
                {i < 3 &&
                  meus
                    .filter((e) => colunaDe(e) === i)
                    .map((e) => {
                      const precisa = [...usosDe(world, e)];
                      const faz = saidasDe(world, e);
                      return (
                        <article
                          key={e.id}
                          className={`cb-bloco ${!e.enabled || e.mothballed ? 'parado' : ''}`}
                        >
                          <button className="cb-bloco-cab" onClick={() => openBusiness(e.id)}>
                            <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
                            <span>
                              <strong>{e.name}</strong>
                              <small>abrir</small>
                            </span>
                          </button>
                          {precisa.length > 0 && (
                            <ul className="cb-encaixes" aria-label={`O que ${e.name} precisa`}>
                              {precisa.map((p) => {
                                const fonte = fonteDe(e, p);
                                const estoque = Math.floor(e.inventory[p] ?? 0);
                                const chave = `${e.id}:${p}`;
                                const serve =
                                  segurando === p && (naMao?.de ?? arrasto?.de) !== e.id;
                                return (
                                  <li key={p}>
                                    <button
                                      data-encaixe={chave}
                                      className={`cb-encaixe ${fonte === null ? (estoque <= 0 ? 'falta' : 'mao') : fonte === 'mercado' ? 'mercado' : 'proprio'} ${serve ? 'serve' : ''} ${alvo === chave ? 'alvo' : ''} ${escolhido?.destino === e.id && escolhido.p === p ? 'escolhido' : ''}`}
                                      style={{ ['--cor' as string]: corDe(p) }}
                                      onClick={() => tocarEncaixe(e.id, p)}
                                      aria-label={`${products[p].name} para ${e.name}: ${fonte === null ? 'você compra na mão' : fonte === 'mercado' ? 'o gerente compra no mercado' : `vem de ${meus.find((x) => x.id === fonte)?.name}`}. Escolher de onde vem`}
                                    >
                                      <ProdutoMini product={p} tamanho={26} />
                                      <span>
                                        {products[p].name}
                                        <small>
                                          {fonte === null
                                            ? estoque <= 0
                                              ? 'falta · de onde vem?'
                                              : 'você compra na mão'
                                            : fonte === 'mercado'
                                              ? 'do mercado'
                                              : `de ${meus.find((x) => x.id === fonte)?.name}`}
                                        </small>
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <ul className="cb-pecas" aria-label={`O que ${e.name} faz`}>
                            {faz.map((p) => {
                              const q = Math.floor(e.inventory[p] ?? 0);
                              const mao = naMao?.de === e.id && naMao.p === p;
                              return (
                                <li key={p}>
                                  <button
                                    data-peca={`${e.id}:${p}`}
                                    className={`cb-peca ${mao ? 'na-mao' : ''} ${sugeridas.has(`${e.id}:${p}`) ? 'sugerida' : ''}`}
                                    style={{ ['--cor' as string]: corDe(p) }}
                                    disabled={pending}
                                    onPointerDown={(ev) => {
                                      ev.preventDefault();
                                      setArrasto({
                                        de: e.id,
                                        p,
                                        x: ev.clientX,
                                        y: ev.clientY,
                                        mexeu: false,
                                      });
                                    }}
                                    onKeyDown={(ev) => {
                                      if (ev.key === 'Enter' || ev.key === ' ') {
                                        ev.preventDefault();
                                        setNaMao(mao ? null : { de: e.id, p });
                                      }
                                    }}
                                    aria-pressed={mao}
                                    aria-label={`${products[p].name} de ${e.name}, ${num(q)} no armazém. Arraste ou toque para encaixar`}
                                  >
                                    <ProdutoMini product={p} tamanho={26} />
                                    <span>
                                      {products[p].name}
                                      <small>
                                        {num(q)} {unidade(p, q)}
                                      </small>
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                            {e.category === 'retail' && (
                              <li>
                                <span className="cb-peca familias" data-familias={e.id}>
                                  <span>
                                    Famílias
                                    <small>vende sozinha a quem passa</small>
                                  </span>
                                </span>
                              </li>
                            )}
                          </ul>
                        </article>
                      );
                    })}
                {i === 0 && !meus.some((e) => colunaDe(e) === 0) && (
                  <button className="cb-bloco fantasma" onClick={() => navigate('map')}>
                    <strong>Nenhuma fazenda ou mina</strong>
                    <small>
                      Produzir a própria matéria-prima corta o frete. Escolher um terreno no mapa.
                    </small>
                  </button>
                )}
                {i === 3 && lojas.length > 0 && (
                  <article className="cb-bloco familias" data-bloco-familias>
                    <strong>Famílias</strong>
                    <small>
                      Compram todo dia nas suas{' '}
                      {lojas.length === 1 ? 'loja' : `${lojas.length} lojas`}. O preço e a qualidade
                      decidem quanto.
                    </small>
                  </article>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="cb-lado" aria-live="polite">
          {escolhidoE && escolhido ? (
            <article className="lv-nota cb-nota">
              <p className="lv-mao cb-recado">
                {products[escolhido.p].name} → {escolhidoE.name}
              </p>
              <p>
                {fonteEscolhida === null
                  ? `Hoje ninguém repõe sozinho: ${escolhidoE.name} tem ${num(Math.floor(escolhidoE.inventory[escolhido.p] ?? 0))} ${unidade(escolhido.p, 2)} e você compra na mão.`
                  : fonteEscolhida === 'mercado'
                    ? 'O gerente compra no mercado, de quem cobrar menos, e só o que chega com lucro.'
                    : `Vem da sua ${meus.find((x) => x.id === fonteEscolhida)?.name}: sua frota leva e você paga só diesel, pedágio e motorista.`}
              </p>
              <p>
                <b>De onde deve vir?</b>
              </p>
              <div className="cb-opcoes">
                {meus
                  .filter((x) => x.id !== escolhidoE.id && saidasDe(world, x).includes(escolhido.p))
                  .map((x) => (
                    <button
                      key={x.id}
                      disabled={pending || fonteEscolhida === x.id}
                      onClick={() => encaixar(escolhidoE.id, escolhido.p, x.id)}
                    >
                      {x.name}
                      <small>
                        Seu negócio · {num(Math.floor(x.inventory[escolhido.p] ?? 0))} no armazém
                      </small>
                    </button>
                  ))}
                <button
                  disabled={pending || fonteEscolhida === 'mercado'}
                  onClick={() => encaixar(escolhidoE.id, escolhido.p, 'mercado')}
                >
                  Mercado
                  <small>
                    O gerente compra
                    {escolhidoE.category === 'retail' ? ' e só aceita o que dá lucro' : ''}
                  </small>
                </button>
                <button
                  disabled={pending || fonteEscolhida === null}
                  onClick={() => encaixar(escolhidoE.id, escolhido.p, null)}
                >
                  Na mão
                  <small>Ninguém repõe sozinho; você manda buscar quando quiser</small>
                </button>
              </div>
              <div className="cb-nota-pe">
                <button
                  className="text-button"
                  onClick={() =>
                    openBusiness(
                      escolhidoE.id,
                      escolhidoE.category === 'retail' ? 'Prateleira' : 'Abastecimento',
                    )
                  }
                >
                  Ajustar quantidade e frete
                </button>
              </div>
            </article>
          ) : (
            <article className="lv-nota cb-nota">
              <p className="lv-mao cb-recado">Como ligar</p>
              <p>
                Peças piscando são encaixes que você ainda não fez: um negócio seu tem o que outro
                compra de fora.
              </p>
              <p>
                Encaixe vermelho é o que falta: toque nele para escolher de onde vem. Cada encaixe
                guarda quanto manter em estoque; para mudar, use “Ajustar quantidade e frete”.
              </p>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}
