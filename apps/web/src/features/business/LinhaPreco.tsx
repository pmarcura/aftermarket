import { useEffect, useRef, useState } from 'react';
import { BotaoProduto } from '../../components/BotaoProduto';
import { ShoppingCart } from 'lucide-react';
import { BotaoEspera } from '../../components/Espera';
import { DetalheReferencia, type Referencia } from '../loja/Referencias';
import { useGame, cr, num } from '../../lib/game';
import { ProdutoArte } from '../economy/Vitrine';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { EstadoEstoque } from '../../components/EstadoEstoque';
import { matizDoProduto } from '../../design/arte';
import { unidade } from '../economy/Carga';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import type { Mercado } from './precificacao';
import '../../design/item.css';

/** Cor de cada faixa de preço do trilho, do prejuízo ao maior lucro. */
const COR_FAIXA = {
  prej: 'var(--brasa)',
  fraco: 'var(--ouro)',
  bom: 'var(--lavoura-clara)',
  otimo: 'var(--lavoura)',
} as const;

/**
 * Um produto da prateleira como um cartão de jogo: faixa colorida com a imagem grande, o estado do
 * estoque em uma palavra e, embaixo, o trilho de preço com marcos ilustrados. O preço é a moeda que
 * se arrasta sobre o trilho; a cor do trilho mostra o lucro por dia em cada preço.
 */
export function LinhaPreco({
  loja,
  product,
  m,
  compacto = false,
}: {
  loja: Establishment;
  product: ProductId;
  m: Mercado;
  /** Sem o cabeçalho do produto: o painel do balcão já mostra o produto. */
  compacto?: boolean;
}) {
  const { world, run, pending, openRepor } = useGame();
  const aCaminho = world.shipments.some(
    (s) => s.destinationId === loja.id && s.product === product && !s.delivered,
  );
  const salvo = loja.prices[product] ?? m.justo;
  const [preco, setPreco] = useState(salvo);
  useEffect(() => setPreco(salvo), [salvo]);
  // O que o jogador digita fica como texto: reformatar a cada tecla apagava "12,5" no meio.
  const formatado = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');
  const [texto, setTexto] = useState(() => formatado(salvo));
  const editando = useRef(false);
  useEffect(() => {
    if (!editando.current) setTexto(formatado(preco));
  }, [preco]);
  const [verCurva, setVerCurva] = useState(false);
  // A referência aberta (custo, cidade, mapa ou justo): explica de onde vem aquele número.
  const [referencia, setReferencia] = useState<Referencia | null>(null);
  const abrirReferencia = (chave: string) =>
    setReferencia((atual) => (atual === chave ? null : (chave as Referencia)));
  const estoque = loja.inventory[product] ?? 0;
  const vende = m.vendas(preco);
  const lucro = m.lucro(preco);
  const lucroMelhor = m.lucro(m.melhor);
  const dias = estoque <= 0 ? 0 : vende > 0.01 ? estoque / vende : Infinity;
  const u1 = unidade(product, 1);
  // Escala: do menor entre custo e 60% do justo até um pouco além do pico de lucro.
  const inicio = Math.round(Math.min(m.custo > 0 ? m.custo * 0.85 : m.justo, m.justo * 0.6));
  const fim = Math.round(Math.max(m.justo * 1.8, m.melhor * 1.15, m.custo * 1.3));
  const x = (v: number) => Math.max(0, Math.min(100, ((v - inicio) / (fim - inicio)) * 100));
  const passo = Math.max(1, Math.round(m.justo / 200));
  const pontos = Array.from({ length: 90 }, (_, i) => {
    const v = inicio + ((fim - inicio) * i) / 89;
    return { v, l: m.lucro(v) };
  });
  const teto = Math.max(1, ...pontos.map((p) => p.l));
  const piso = Math.min(0, ...pontos.map((p) => p.l));
  const y = (l: number) => 56 - ((l - piso) / (teto - piso)) * 50;
  const zero = y(0);
  const curva = pontos.map((p) => `${x(p.v).toFixed(2)},${y(p.l).toFixed(2)}`).join(' ');
  const fora = m.concorrentes.filter((c) => c.preco > fim);
  const faltam = lucroMelhor - lucro;
  const menorCidade = m.concorrentes[0]?.preco;

  // Marcos do trilho: cada um com a sua ilustração.
  const marcos: {
    chave: string;
    icone: NomeIcone;
    rotulo: string;
    nome: string;
    v: number;
  }[] = [
    ...(m.custo > inicio
      ? [
          {
            chave: 'custo',
            icone: 'custo' as const,
            rotulo: 'Seu custo',
            nome: 'custo',
            v: m.custo,
          },
        ]
      : []),
    ...(menorCidade !== undefined && menorCidade <= fim
      ? [
          {
            chave: 'rival',
            icone: 'rival' as const,
            rotulo: `Menor em ${m.cidade}`,
            nome: m.concorrentes[0].loja.name,
            v: menorCidade,
          },
        ]
      : []),
    ...(m.menorDoPais !== undefined && m.menorDoPais <= fim && m.menorDoPais >= inicio
      ? [
          {
            chave: 'pais',
            icone: 'mapa' as const,
            rotulo: 'Menor do mapa',
            nome: 'mapa',
            v: m.menorDoPais,
          },
        ]
      : []),
    {
      chave: 'justo',
      icone: 'justo' as const,
      rotulo: 'Preço justo',
      nome: 'justo',
      v: m.justo,
    },
  ].sort((a, b) => a.v - b.v);
  // Marcos perto um do outro viram um grupo só, lado a lado sobre uma haste, em vez de uma torre.
  const grupos: (typeof marcos)[] = [];
  for (const mk of marcos) {
    const ultimo = grupos.at(-1);
    if (ultimo && x(mk.v) - x(ultimo[0].v) < 10) ultimo.push(mk);
    else grupos.push([mk]);
  }

  // Uma frase que diz o que fazer.
  const veredito =
    estoque <= 0
      ? { tom: 'ruim', texto: 'Acabou! Sem produto, o preço não importa. Mande buscar mais.' }
      : m.custo > 0 && preco < m.custo
        ? {
            tom: 'ruim',
            texto: `Abaixo do custo: cada ${u1} vendido perde ${cr(m.custo - preco)}.`,
          }
        : vende < 0.5 && preco > m.justo
          ? { tom: 'ruim', texto: 'Caro demais: as famílias estão comprando nas outras lojas.' }
          : faltam > Math.max(50, lucroMelhor * 0.03)
            ? {
                tom: 'meio',
                texto: `${m.melhor > preco ? 'Subindo' : 'Baixando'} para ${cr(m.melhor)}${m.melhorNoTeto ? ' ou mais' : ''}, você lucra ${cr(faltam, 0)} a mais por dia.`,
              }
            : { tom: 'bom', texto: 'Preço no ponto de maior lucro. Nada a ajustar.' };

  // Trilho: o gradiente junta as faixas de lucro em uma só cor contínua.
  const nFaixas = 32;
  const faixas = Array.from({ length: nFaixas }, (_, i) => {
    const l = m.lucro(inicio + ((fim - inicio) * (i + 0.5)) / nFaixas);
    const r = l / Math.max(1, lucroMelhor);
    return l <= 0
      ? COR_FAIXA.prej
      : r >= 0.9
        ? COR_FAIXA.otimo
        : r >= 0.6
          ? COR_FAIXA.bom
          : COR_FAIXA.fraco;
  });
  const gradiente = `linear-gradient(90deg, ${faixas
    .map((c, i) => `${c} ${(((i + 0.5) / nFaixas) * 100).toFixed(1)}%`)
    .join(', ')})`;

  return (
    <article
      className={`item ${estoque <= 0 ? 'esgotado' : ''} ${compacto ? 'item-compacto' : ''}`}
      style={{ ['--h' as string]: matizDoProduto(product) }}
    >
      {!compacto && (
        <header className="item-hero">
          <span className="lv-preco item-etiqueta">{cr(preco)}</span>
          <div className="item-arte">
            <BotaoProduto product={product}>
              <ProdutoArte product={product} escala={3} />
            </BotaoProduto>
          </div>
          <div className="item-ident">
            <h3>
              <BotaoProduto product={product}>{products[product].name}</BotaoProduto>
            </h3>
            <EstadoEstoque estoque={estoque} dias={dias} />
            <dl className="item-fatos">
              <div>
                <IconePixel nome="caixa" tamanho={22} />
                <dt>No armazém</dt>
                <dd>
                  {num(estoque)} {unidade(product, estoque)}
                </dd>
              </div>
              <div>
                <dt>Qualidade</dt>
                <dd>{num(inventoryQuality(loja, product))}</dd>
              </div>
            </dl>
          </div>
          {(estoque <= 0 || dias < 3) && (
            <button
              className={`item-repor ${estoque <= 0 && !aCaminho ? 'primary' : 'secondary'}`}
              onClick={() => openRepor({ destinationId: loja.id, product })}
            >
              <ShoppingCart size={18} /> {aCaminho ? 'Já pedido · pedir mais' : 'Mandar buscar'}
            </button>
          )}
        </header>
      )}

      <div className="item-corpo">
        <p className={`item-veredito ${veredito.tom}`}>{veredito.texto}</p>
        <div className="item-pista">
          <div className="pista" aria-label="Trilho de preço">
            <div className="pista-marcos">
              {grupos.map((g) => (
                <span
                  key={g[0].chave}
                  className="pista-grupo"
                  style={{
                    left: `${x(g.reduce((n, mk) => n + mk.v, 0) / g.length)}%`,
                  }}
                >
                  {g.map((mk) => (
                    <button
                      type="button"
                      key={mk.chave}
                      className={`pista-marco ${referencia === mk.chave ? 'aberto' : ''}`}
                      title={`${mk.rotulo}: ${cr(mk.v)}. Clique para entender.`}
                      aria-label={`${mk.rotulo}: ${cr(mk.v)}. Ver detalhes`}
                      onClick={() => abrirReferencia(mk.chave)}
                    >
                      <IconePixel nome={mk.icone} tamanho={26} />
                    </button>
                  ))}
                </span>
              ))}
            </div>
            <div className="pista-trilho" style={{ background: gradiente }}>
              <span className="pista-voce" style={{ left: `${x(preco)}%` }}>
                <IconePixel nome="moeda" tamanho={40} />
                <b>{cr(preco)}</b>
              </span>
              <input
                type="range"
                min={inicio}
                max={fim}
                step={passo}
                value={Math.min(fim, Math.max(inicio, preco))}
                onChange={(e) => setPreco(Number(e.target.value))}
                aria-label={`Preço de ${products[product].name}: arraste para testar`}
                aria-valuetext={`${cr(preco)}, vende cerca de ${num(vende)} por dia e lucra ${cr(lucro, 0)} por dia`}
              />
            </div>
            <div className="pista-escala">
              <span>
                <i style={{ background: COR_FAIXA.prej }} /> prejuízo
              </span>
              <span>
                <i style={{ background: COR_FAIXA.fraco }} /> lucra pouco
              </span>
              <span>
                <i style={{ background: COR_FAIXA.bom }} /> lucra bem
              </span>
              <span>
                <i style={{ background: COR_FAIXA.otimo }} /> maior lucro
              </span>
            </div>
          </div>

          <ul className="marcos-lista" aria-label="Referências de preço">
            {[...marcos].reverse().map((mk) => (
              <li key={mk.chave}>
                <button
                  type="button"
                  className={`marco-botao ${referencia === mk.chave ? 'aberto' : ''}`}
                  aria-expanded={referencia === mk.chave}
                  onClick={() => abrirReferencia(mk.chave)}
                >
                  <IconePixel nome={mk.icone} tamanho={28} />
                  <span>
                    <small>{mk.rotulo}</small>
                    <b>{cr(mk.v)}</b>
                  </span>
                  <em aria-hidden="true">{referencia === mk.chave ? 'fechar' : 'por quê?'}</em>
                </button>
              </li>
            ))}
          </ul>
          {referencia && (
            <DetalheReferencia
              referencia={referencia}
              loja={loja}
              product={product}
              m={m}
              preco={preco}
              onFechar={() => setReferencia(null)}
            />
          )}
          <button className="text-button pr-curva" onClick={() => setVerCurva(!verCurva)}>
            {verCurva ? 'Esconder a curva de lucro' : 'Ver a curva de lucro'}
          </button>
          {verCurva && (
            <div className="prat-grafico">
              <div className="prat-plano">
                <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                  {m.custo > inicio && (
                    <rect x="0" y="0" width={x(m.custo)} height="60" className="zona-prejuizo" />
                  )}
                  <line x1="0" x2="100" y1={zero} y2={zero} className="eixo" />
                  <polygon points={`0,${zero} ${curva} 100,${zero}`} className="area" />
                  <polyline points={curva} className="linha" />
                </svg>
                {fora.length > 0 && (
                  <span
                    className="pm-fora"
                    title={fora.map((c) => `${c.loja.name}: ${cr(c.preco)}`).join(', ')}
                  >
                    {fora[0].loja.name.split(' ')[0]} cobra {cr(fora[0].preco)} →
                  </span>
                )}
              </div>
              <div className="prat-eixo" aria-hidden="true">
                <span>{cr(inicio)}</span>
                <span>preço de venda · altura = lucro por dia</span>
                <span>{cr(fim)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="item-decisao">
          <label className="item-preco">
            <span>Seu preço</span>
            <div>
              <button
                className="secondary"
                aria-label="Baixar o preço"
                onClick={() => setPreco(Math.max(1, preco - passo * 5))}
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={texto}
                onFocus={(e) => {
                  editando.current = true;
                  e.currentTarget.select();
                }}
                onChange={(e) => {
                  const bruto = e.target.value;
                  // Aceita vírgula ou ponto; só números e um separador.
                  if (!/^\d*[.,]?\d{0,2}$/.test(bruto)) return;
                  setTexto(bruto);
                  const n = Number(bruto.replace(',', '.'));
                  if (bruto !== '' && Number.isFinite(n) && n > 0) setPreco(Math.round(n * 100));
                }}
                onBlur={() => {
                  editando.current = false;
                  const n = Number(texto.replace(',', '.'));
                  const valido = Number.isFinite(n) && n > 0 ? Math.round(n * 100) : preco;
                  setPreco(valido);
                  setTexto(formatado(valido));
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label={`Preço de venda de ${products[product].name} em reais`}
              />
              <button
                className="secondary"
                aria-label="Subir o preço"
                onClick={() => setPreco(preco + passo * 5)}
              >
                +
              </button>
            </div>
          </label>
          <div className="item-efeito">
            <div>
              <b>~{num(vende)}</b>
              <span>{unidade(product, Math.round(vende))} por dia</span>
            </div>
            <div className={lucro >= 0 ? 'bom' : 'ruim'}>
              <b>{cr(lucro, 0)}</b>
              <span>de lucro por dia</span>
            </div>
          </div>
          <div className="item-botoes">
            {preco === salvo ? (
              <span className="item-salvo">
                <IconePixel nome="estrela" tamanho={18} /> Este é o preço na prateleira
              </span>
            ) : (
              <>
                <BotaoEspera
                  className="primary"
                  esperando="Salvando…"
                  disabled={pending}
                  onClick={() =>
                    run(
                      { type: 'setPrice', establishmentId: loja.id, product, price: preco },
                      `Preço de ${products[product].name} ajustado para ${cr(preco)}.`,
                    )
                  }
                >
                  Salvar {cr(preco)}
                </BotaoEspera>
                <button className="text-button" onClick={() => setPreco(salvo)}>
                  Voltar para {cr(salvo)}
                </button>
              </>
            )}
            {veredito.tom !== 'bom' && Math.abs(preco - m.melhor) > passo && (
              <button className="text-button" onClick={() => setPreco(m.melhor)}>
                Testar o de maior lucro: {cr(m.melhor)}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
