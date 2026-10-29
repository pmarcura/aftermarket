import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import type { mercadoDaCidade } from './precificacao';

/**
 * Um produto da prateleira: o gráfico de lucro por dia em função do preço, com custo,
 * concorrentes, preço justo e o pico marcados. O preço é a linha dourada que se arrasta.
 */
export function LinhaPreco({
  loja,
  product,
  m,
}: {
  loja: Establishment;
  product: ProductId;
  m: ReturnType<typeof mercadoDaCidade>;
}) {
  const { run, pending, openMarket } = useGame();
  const salvo = loja.prices[product] ?? m.justo;
  const [preco, setPreco] = useState(salvo);
  useEffect(() => setPreco(salvo), [salvo]);
  const [verCurva, setVerCurva] = useState(false);
  const estoque = loja.inventory[product] ?? 0;
  const vende = m.vendas(preco);
  const lucro = m.lucro(preco);
  const lucroMelhor = m.lucro(m.melhor);
  const dias = vende > 0.01 ? estoque / vende : Infinity;
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
  const dentro = m.concorrentes.filter((c) => c.preco <= fim);
  const fora = m.concorrentes.filter((c) => c.preco > fim);
  const faltam = lucroMelhor - lucro;
  const marcas = [
    ...(m.custo > inicio
      ? [{ chave: 'custo', classe: 'custo', v: m.custo, rotulo: 'custo', dica: '' }]
      : []),
    ...dentro.map((c) => ({
      chave: c.loja.id,
      classe: 'rival',
      v: c.preco,
      rotulo: c.loja.name.split(' ')[0],
      dica: `${c.loja.name}: ${cr(c.preco)}`,
    })),
    { chave: 'justo', classe: 'justo', v: m.justo, rotulo: 'justo', dica: '' },
  ]
    .sort((a, b) => a.v - b.v)
    .map((mk) => ({ ...mk, linha: 0 }));
  for (let i = 1; i < marcas.length; i++)
    if (x(marcas[i].v) - x(marcas[i - 1].v) < 9 && marcas[i - 1].linha === 0) marcas[i].linha = 1;
  const ancora = (p: number) => (p > 88 ? 'fim' : p < 12 ? 'inicio' : '');
  // Uma frase que diz o que fazer.
  const veredito =
    estoque <= 0
      ? {
          tom: 'ruim',
          texto: 'Acabou o estoque: sem produto, o preço não importa. Reponha primeiro.',
        }
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
  // Termômetro: cada bloco é uma faixa de preço pintada pelo lucro que dá.
  const nBlocos = 32;
  const blocos = Array.from({ length: nBlocos }, (_, i) => {
    const l = m.lucro(inicio + ((fim - inicio) * (i + 0.5)) / nBlocos);
    const r = l / Math.max(1, lucroMelhor);
    return l <= 0 ? 'prej' : r >= 0.9 ? 'otimo' : r >= 0.6 ? 'bom' : 'fraco';
  });
  const menorCidade = m.concorrentes[0]?.preco;
  return (
    <article className="prat-item">
      <div className="prat-produto">
        <ProdutoArte product={product} />
        <h3>{products[product].name}</h3>
        <div className="prat-fichas">
          <span>
            <b>{num(estoque)}</b> {unidade(product, estoque)}
          </span>
          <span>
            <b>{estoque <= 0 ? '0' : dias === Infinity ? '—' : num(Math.min(dias, 999))}</b> dias de
            estoque
          </span>
          <span>
            <b>{num(inventoryQuality(loja, product))}</b> de qualidade
          </span>
        </div>
        {(estoque <= 0 || dias < 3) && (
          <button
            className="secondary"
            onClick={() => openMarket({ destinationId: loja.id, product })}
          >
            <ShoppingCart size={14} /> Repor
          </button>
        )}
      </div>
      <div className="pr-centro">
        <p className={`prat-veredito ${veredito.tom}`}>{veredito.texto}</p>
        <div className="pr-termo">
          <div className="pr-blocos" aria-hidden="true">
            {blocos.map((c, i) => (
              <i key={i} className={c} />
            ))}
          </div>
          <span className="pr-tick justo" style={{ left: `${x(m.justo)}%` }}>
            <small>justo</small>
          </span>
          {menorCidade !== undefined && menorCidade <= fim && (
            <span className="pr-tick rival" style={{ left: `${x(menorCidade)}%` }}>
              <small>{m.concorrentes[0].loja.name.split(' ')[0]}</small>
            </span>
          )}
          <span className={`pr-voce ${ancora(x(preco))}`} style={{ left: `${x(preco)}%` }}>
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
        <div className="pr-legenda">
          <span className="otimo">maior lucro</span>
          <span className="bom">lucra bem</span>
          <span className="fraco">lucra pouco</span>
          <span className="prej">prejuízo</span>
          <em>
            justo {cr(m.justo)}
            {menorCidade !== undefined && ` · menor em ${m.cidade} ${cr(menorCidade)}`}
            {m.menorDoPais !== undefined && ` · menor do mapa ${cr(m.menorDoPais)}`}
          </em>
        </div>
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
              {marcas.map((mk) => (
                <span
                  key={mk.chave}
                  className={`pm ${mk.classe} ${ancora(x(mk.v))}`}
                  style={{ left: `${x(mk.v)}%` }}
                  title={mk.dica || undefined}
                >
                  <small style={{ top: 18 + mk.linha * 12 }}>{mk.rotulo}</small>
                </span>
              ))}
              <span
                className="pm melhor"
                style={{
                  left: `${x(m.melhor)}%`,
                  top: `calc(44px + (100% - 44px) * ${(y(lucroMelhor) / 60).toFixed(3)})`,
                }}
              >
                <i />
              </span>
              <span className={`pm voce ${ancora(x(preco))}`} style={{ left: `${x(preco)}%` }}>
                <b>{cr(preco)}</b>
              </span>
              {fora.length > 0 && (
                <span
                  className="pm-fora"
                  title={fora.map((c) => `${c.loja.name}: ${cr(c.preco)}`).join(', ')}
                >
                  {fora[0].loja.name.split(' ')[0]} cobra {cr(fora[0].preco)} →
                </span>
              )}
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
            <div className="prat-eixo" aria-hidden="true">
              <span>{cr(inicio)}</span>
              <span>preço de venda · altura = lucro por dia</span>
              <span>{cr(fim)}</span>
            </div>
            <p className="prat-legenda">
              {m.custo > 0 && (
                <span className="custo">
                  custo <b>{cr(m.custo)}</b>
                </span>
              )}
              <span className="rival">
                {m.concorrentes.length ? (
                  <>
                    menor em {m.cidade} <b>{cr(m.concorrentes[0].preco)}</b>
                  </>
                ) : (
                  <>sem concorrente em {m.cidade}</>
                )}
              </span>
              <span className="justo">
                justo <b>{cr(m.justo)}</b>
              </span>
              <span className="melhor">
                mais lucro{' '}
                <b>
                  {cr(m.melhor)}
                  {m.melhorNoTeto ? '+' : ''}
                </b>
              </span>
              {m.menorDoPais !== undefined && (
                <span className="pais">
                  menor do mapa <b>{cr(m.menorDoPais)}</b>
                </span>
              )}
            </p>
          </div>
        )}
      </div>
      <div className="prat-decisao">
        <div className="prat-preco">
          <button
            className="secondary"
            aria-label="Baixar o preço"
            onClick={() => setPreco(Math.max(1, preco - passo * 5))}
          >
            −
          </button>
          <label>
            <span>Seu preço</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={(preco / 100).toFixed(2)}
              onChange={(e) => setPreco(Math.max(1, Math.round(Number(e.target.value) * 100)))}
              aria-label={`Preço de venda de ${products[product].name} em reais`}
            />
          </label>
          <button
            className="secondary"
            aria-label="Subir o preço"
            onClick={() => setPreco(preco + passo * 5)}
          >
            +
          </button>
        </div>
        <div className="prat-efeito">
          <div>
            <b>~{num(vende)}</b>
            <span>{unidade(product, Math.round(vende))} por dia</span>
          </div>
          <div className={lucro >= 0 ? 'bom' : 'ruim'}>
            <b>{cr(lucro, 0)}</b>
            <span>de lucro por dia</span>
          </div>
        </div>
        <div className="prat-botoes">
          {Math.abs(preco - m.melhor) > passo && (
            <button className="text-button" onClick={() => setPreco(m.melhor)}>
              Testar {cr(m.melhor)}
            </button>
          )}
          <button
            className="primary"
            disabled={pending || preco === salvo}
            onClick={() =>
              void run(
                { type: 'setPrice', establishmentId: loja.id, product, price: preco },
                `Preço de ${products[product].name} ajustado para ${cr(preco)}.`,
              )
            }
          >
            {preco === salvo ? 'Preço salvo' : `Salvar ${cr(preco)}`}
          </button>
        </div>
      </div>
    </article>
  );
}
