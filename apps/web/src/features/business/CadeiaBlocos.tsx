import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useGame, num } from '../../lib/game';
import { PixelArt } from '../../components/PixelArt';
import { IconePixel } from '../../components/IconePixel';
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

/** Três colunas na ordem da cadeia; as famílias são a ponta de cada loja, não uma coluna. */
const COLUNAS = ['De fora e do campo', 'Indústria', 'Loja'] as const;
const colunaDe = (e: Establishment) =>
  e.category === 'farm' || e.category === 'mine' ? 0 : e.category === 'retail' ? 2 : 1;

/**
 * Cor de cada produto na peça e no encaixe, tirada da ilustração. O verde fica de fora: é a cor do
 * fio "seu negócio", e uma peça verde pareceria uma ligação.
 */
const CORES: Partial<Record<ProductId, string>> = {
  soy: '#d9b26a',
  oil: '#f2c84b',
  soymeal: '#c9a27e',
  rice: '#e8dcc0',
  beans: '#c08462',
  sugar: '#c7dcf0',
  milk: '#9cc7ee',
  utensils: '#b8c2c9',
  iron: '#cf927e',
  coal: '#9a9a96',
  steel: '#a9b8c8',
  scrap: '#ab9f8e',
  feed: '#d6c38a',
  cow: '#e0b9a0',
};
const corDe = (id: ProductId) => {
  if (CORES[id]) return CORES[id];
  let h = (id.split('').reduce((n, c) => n + c.charCodeAt(0), 0) * 47) % 360;
  if (h > 60 && h < 150) h += 120;
  return `hsl(${h} 50% 72%)`;
};

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

/** Quanto o estoque de uma loja dura, em dias, no preço de hoje. */
function diasNaLoja(world: World, loja: Establishment, p: ProductId) {
  const estoque = loja.inventory[p] ?? 0;
  if (estoque <= 0) return 0;
  const vende = mercadoDaCidade(world, loja, p).vendas(
    loja.prices[p] ?? world.season.config.basePrices[p],
  );
  return vende > 0.01 ? estoque / vende : Infinity;
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
 * que precisa (à esquerda). O mercado é um bloco também, de onde sai o que o gerente compra.
 * Encaixar uma peça cria a rota entre os dois negócios; tocar num encaixe mostra de onde a
 * mercadoria pode vir. Tudo pelo comando `configureSupply`.
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
  // Dias de estoque de cada encaixe de loja: a pergunta que o jogador faz a cada encaixe.
  const dias = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of meus)
      if (e.category === 'retail')
        for (const p of usosDe(world, e)) m.set(`${e.id}:${p}`, diasNaLoja(world, e, p));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, meus]);
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

  // Fios: recalculados pela posição real de peças, encaixes e do bloco do mercado.
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
    const mercado = t.querySelector('[data-mercado]');
    const lista: { d: string; tipo: string; chave: string }[] = [];
    t.querySelectorAll<HTMLElement>('[data-encaixe]').forEach((enc) => {
      const [destino, p] = enc.dataset.encaixe!.split(':');
      const e = meus.find((x) => x.id === destino);
      const fonte = e && fonteDe(e, p as ProductId);
      if (!fonte) return;
      const b = ponto(enc, 'esq');
      const origem = fonte === 'mercado' ? mercado : t.querySelector(`[data-peca="${fonte}:${p}"]`);
      if (origem)
        lista.push({
          d: curva(ponto(origem, 'dir'), b),
          tipo: fonte === 'mercado' ? 'mercado' : 'proprio',
          chave: enc.dataset.encaixe!,
        });
    });
    setFios(lista);
    const colunas = t.querySelector<HTMLElement>('.cb-colunas');
    setTamanho({
      w: (colunas?.offsetWidth ?? 0) + (colunas?.offsetLeft ?? 0),
      h: (colunas?.offsetHeight ?? 0) + (colunas?.offsetTop ?? 0),
    });
  };
  useLayoutEffect(medir, [world.revision, meus.length, escolhido]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!naMao && !escolhido) return;
    const esc = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      setNaMao(null);
      setEscolhido(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [naMao, escolhido]);

  if (meus.length === 0) return null;
  const segurando = arrasto?.mexeu ? arrasto.p : naMao?.p;
  const escolhidoE = escolhido && meus.find((e) => e.id === escolhido.destino);
  const fonteEscolhida = escolhidoE && escolhido ? fonteDe(escolhidoE, escolhido.p) : null;
  const doMercado = meus.reduce(
    (n, e) => n + [...usosDe(world, e)].filter((p) => fonteDe(e, p) === 'mercado').length,
    0,
  );
  const faltam = meus.reduce(
    (n, e) =>
      n +
      [...usosDe(world, e)].filter((p) => fonteDe(e, p) === null && (e.inventory[p] ?? 0) <= 0)
        .length,
    0,
  );

  /** O que acontece com o que um negócio faz: vai para outro negócio seu, à venda ou parado. */
  const destinoDaPeca = (origem: Establishment, p: ProductId) => {
    const destinos = meus.filter((d) => fonteDe(d, p) === origem.id);
    const aVenda = world.offers.some((o) => o.establishmentId === origem.id && o.product === p);
    const estoque = Math.floor(origem.inventory[p] ?? 0);
    const precisam = destinos.reduce(
      (n, d) => n + (d.supplyPolicy?.rules.find((r) => r.product === p)?.target ?? 0),
      0,
    );
    // Sobra: o que está no armazém passa de cinco vezes o que os seus negócios pedem de uma vez.
    const sobra = destinos.length > 0 && !aVenda && estoque > precisam * 5 ? estoque - precisam : 0;
    return { destinos, aVenda, estoque, sobra };
  };

  const tocarEncaixe = (destino: string, p: ProductId) => {
    if (naMao) {
      if (naMao.p === p && naMao.de !== destino) {
        encaixar(destino, p, naMao.de);
        setNaMao(null);
      }
      return;
    }
    setEscolhido((atual) => (atual?.destino === destino && atual.p === p ? null : { destino, p }));
  };

  const textoEncaixe = (e: Establishment, p: ProductId, fonte: Fonte) => {
    const estoque = Math.floor(e.inventory[p] ?? 0);
    const d = dias.get(`${e.id}:${p}`);
    const duracao =
      d === undefined
        ? ''
        : d === 0
          ? ' · acabou'
          : d === Infinity
            ? ''
            : d > 60
              ? ' · dura mais de 60 d'
              : ` · dura ${num(d, d < 10 ? 1 : 0)} d`;
    if (fonte === null) return estoque <= 0 ? 'falta · de onde vem?' : `na mão${duracao}`;
    if (fonte === 'mercado') return `do mercado${duracao}`;
    return `de ${meus.find((x) => x.id === fonte)?.name}${duracao}`;
  };

  return (
    <section className="cb" aria-labelledby="cb-titulo">
      <header className="cb-cab">
        <div>
          <h2 id="cb-titulo" className="lv-grande">
            Sua cadeia
          </h2>
          <p>
            Arraste o que um negócio faz até o que outro precisa. Toque num encaixe para escolher de
            onde vem.
          </p>
        </div>
        <ul className="cb-legenda" aria-label="Legenda">
          <li>
            <i className="proprio" /> do seu negócio
          </li>
          <li>
            <i className="mercado" /> do mercado
          </li>
          <li className={faltam ? 'falta' : ''}>
            <i className="falta" /> {faltam ? `${num(faltam)} faltando` : 'nada faltando'}
          </li>
        </ul>
      </header>

      <div className={`cb-palco ${escolhidoE ? 'com-lado' : ''}`}>
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
                {i === 0 && (
                  <article className="cb-bloco mercado">
                    <div className="cb-bloco-cab estatico" data-mercado>
                      <IconePixel nome="rival" tamanho={40} />
                      <span>
                        <strong>Mercado</strong>
                        <small>
                          {doMercado
                            ? `O gerente compra ${num(doMercado)} ${doMercado === 1 ? 'produto' : 'produtos'} de outras empresas`
                            : 'Outras empresas vendem aqui'}
                        </small>
                      </span>
                    </div>
                  </article>
                )}
                {meus
                  .filter((e) => colunaDe(e) === i)
                  .map((e) => {
                    const precisa = [...usosDe(world, e)];
                    const faz = saidasDe(world, e);
                    return (
                      <article
                        key={e.id}
                        className={`cb-bloco ${!e.enabled || e.mothballed ? 'parado' : ''}`}
                      >
                        <button
                          className="cb-bloco-cab"
                          onClick={() => openBusiness(e.id)}
                          aria-label={`Abrir ${e.name}`}
                        >
                          <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
                          <span>
                            <strong>{e.name}</strong>
                            <small>
                              {!e.enabled ? 'pausado' : e.mothballed ? 'suspenso' : 'abrir'}
                            </small>
                          </span>
                        </button>
                        {precisa.length > 0 && (
                          <ul className="cb-encaixes" aria-label={`O que ${e.name} precisa`}>
                            {precisa.map((p) => {
                              const fonte = fonteDe(e, p);
                              const estoque = Math.floor(e.inventory[p] ?? 0);
                              const chave = `${e.id}:${p}`;
                              const serve = segurando === p && (naMao?.de ?? arrasto?.de) !== e.id;
                              const d = dias.get(chave);
                              const curto = d !== undefined && d < 2;
                              return (
                                <li key={p}>
                                  <button
                                    data-encaixe={chave}
                                    className={`cb-encaixe ${fonte === null ? (estoque <= 0 ? 'falta' : 'mao') : fonte === 'mercado' ? 'mercado' : 'proprio'} ${curto ? 'curto' : ''} ${serve ? 'serve' : ''} ${alvo === chave ? 'alvo' : ''} ${escolhido?.destino === e.id && escolhido.p === p ? 'escolhido' : ''}`}
                                    style={{ ['--cor' as string]: corDe(p) }}
                                    onClick={() => tocarEncaixe(e.id, p)}
                                    aria-expanded={escolhido?.destino === e.id && escolhido.p === p}
                                    aria-label={`${products[p].name} para ${e.name}: ${textoEncaixe(e, p, fonte)}. Escolher de onde vem`}
                                  >
                                    <ProdutoMini product={p} tamanho={26} />
                                    <span>
                                      {products[p].name}
                                      <small>{textoEncaixe(e, p, fonte)}</small>
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <ul className="cb-pecas" aria-label={`O que ${e.name} faz`}>
                          {faz.map((p) => {
                            const mao = naMao?.de === e.id && naMao.p === p;
                            const { destinos, aVenda, estoque, sobra } = destinoDaPeca(e, p);
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
                                  aria-label={`${products[p].name} de ${e.name}, ${num(estoque)} no armazém. Arraste ou toque para encaixar`}
                                >
                                  <ProdutoMini product={p} tamanho={26} />
                                  <span>
                                    {products[p].name}
                                    <small>
                                      {num(estoque)} {unidade(p, estoque)}
                                    </small>
                                  </span>
                                </button>
                                {destinos.length === 0 && !aVenda && estoque > 0 ? (
                                  <button
                                    className="cb-destino parado"
                                    onClick={() => openBusiness(e.id, 'Vendas')}
                                  >
                                    Parado, sem comprador · <b>Pôr à venda</b>
                                  </button>
                                ) : sobra > 0 ? (
                                  <button
                                    className="cb-destino parado"
                                    onClick={() => openBusiness(e.id, 'Vendas')}
                                  >
                                    Sobram {num(sobra)} · <b>Vender o excedente</b>
                                  </button>
                                ) : destinos.length > 0 ? (
                                  <span className="cb-destino">
                                    vai para {destinos.map((d) => d.name).join(', ')}
                                  </span>
                                ) : aVenda ? (
                                  <span className="cb-destino ok">à venda no mercado</span>
                                ) : null}
                              </li>
                            );
                          })}
                          {e.category === 'retail' && (
                            <li>
                              <span className="cb-peca familias">
                                <IconePixel nome="equipe" tamanho={24} />
                                <span>
                                  Famílias
                                  <small>vende a quem passa</small>
                                </span>
                              </span>
                            </li>
                          )}
                        </ul>
                      </article>
                    );
                  })}
                {i === 0 && !meus.some((e) => colunaDe(e) === 0) && (
                  <button className="cb-fantasma" onClick={() => navigate('map')}>
                    <b>+ Fazenda ou mina</b>
                    <small>Matéria-prima sua corta o frete e o preço de compra.</small>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {escolhidoE && escolhido && (
          <aside className="cb-lado" aria-label="De onde vem" aria-live="polite">
            <article className="lv-nota cb-nota">
              <button className="cb-fechar" onClick={() => setEscolhido(null)} aria-label="Fechar">
                <X size={18} />
              </button>
              <p className="lv-mao cb-recado">
                {products[escolhido.p].name} → {escolhidoE.name}
              </p>
              <p>
                {fonteEscolhida === null
                  ? `Ninguém repõe sozinho. ${escolhidoE.name} tem ${num(Math.floor(escolhidoE.inventory[escolhido.p] ?? 0))} ${unidade(escolhido.p, 2)}.`
                  : fonteEscolhida === 'mercado'
                    ? 'O gerente compra de quem cobrar menos, e só o que chega com lucro.'
                    : `Sua ${meus.find((x) => x.id === fonteEscolhida)?.name} manda, e sua frota leva: você paga só diesel, pedágio e motorista.`}
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
                      aria-pressed={fonteEscolhida === x.id}
                      disabled={pending}
                      onClick={() =>
                        fonteEscolhida !== x.id && encaixar(escolhidoE.id, escolhido.p, x.id)
                      }
                    >
                      {x.name}
                      <small>
                        Seu negócio · {num(Math.floor(x.inventory[escolhido.p] ?? 0))} no armazém
                      </small>
                    </button>
                  ))}
                <button
                  aria-pressed={fonteEscolhida === 'mercado'}
                  disabled={pending}
                  onClick={() =>
                    fonteEscolhida !== 'mercado' && encaixar(escolhidoE.id, escolhido.p, 'mercado')
                  }
                >
                  Mercado
                  <small>
                    O gerente compra
                    {escolhidoE.category === 'retail' ? ', só com lucro' : ''}
                  </small>
                </button>
                <button
                  aria-pressed={fonteEscolhida === null}
                  disabled={pending}
                  onClick={() =>
                    fonteEscolhida !== null && encaixar(escolhidoE.id, escolhido.p, null)
                  }
                >
                  Na mão
                  <small>Você manda buscar quando quiser</small>
                </button>
              </div>
              <button
                className="text-button cb-ajustar"
                onClick={() =>
                  openBusiness(
                    escolhidoE.id,
                    escolhidoE.category === 'retail' ? 'Prateleira' : 'Abastecimento',
                  )
                }
              >
                Ajustar quantidade e frete
              </button>
            </article>
          </aside>
        )}
      </div>
    </section>
  );
}
