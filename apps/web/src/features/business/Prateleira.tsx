import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Sparkles } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Empty } from '../../components/ui';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import { mercadoDaCidade } from './precificacao';

/**
 * A prateleira da loja: cada produto com a régua de preço (custo, concorrência, preço justo e o
 * preço de maior lucro) e a estimativa de venda e lucro por dia para qualquer preço testado.
 */
export function Prateleira({ loja }: { loja: Establishment }) {
  const { world, run, pending, openMarket } = useGame();
  const itens = (Object.keys(loja.inventory) as ProductId[]).sort(
    (a, b) => (loja.inventory[b] ?? 0) - (loja.inventory[a] ?? 0),
  );
  const mercados = useMemo(
    () => Object.fromEntries(itens.map((id) => [id, mercadoDaCidade(world, loja, id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, itens.join()],
  );
  if (!itens.length)
    return (
      <Empty
        title="A prateleira está vazia"
        description="Compre o primeiro produto no Comércio. Quando a carga chegar, ele aparece aqui com o preço sugerido."
        action={
          <button className="primary" onClick={() => openMarket({ destinationId: loja.id })}>
            <ShoppingCart size={16} /> Comprar mercadorias
          </button>
        }
      />
    );
  const atual = itens.reduce(
    (n, id) => n + mercados[id].lucro(loja.prices[id] ?? mercados[id].justo),
    0,
  );
  const possivel = itens.reduce((n, id) => n + mercados[id].lucro(mercados[id].melhor), 0);
  const ajustar = itens.filter((id) => {
    const p = loja.prices[id] ?? 0;
    return Math.abs(p - mercados[id].melhor) / mercados[id].melhor > 0.03;
  });
  return (
    <div className="prat">
      <div className="prat-resumo">
        <div>
          <span>Com os preços de agora</span>
          <b className={atual >= 0 ? '' : 'negative'}>{cr(atual, 0)}</b>
          <small>de lucro bruto por dia na prateleira</small>
        </div>
        <div className="melhor">
          <span>Com os melhores preços</span>
          <b>{cr(possivel, 0)}</b>
          <small>
            {possivel - atual > 100
              ? `+${cr(possivel - atual, 0)} por dia ajustando ${ajustar.length} ${ajustar.length === 1 ? 'preço' : 'preços'}`
              : 'seus preços já estão perto do melhor'}
          </small>
        </div>
        {ajustar.length > 0 && possivel - atual > 100 && (
          <button
            className="primary"
            disabled={pending}
            onClick={async () => {
              for (const id of ajustar)
                await run(
                  {
                    type: 'setPrice',
                    establishmentId: loja.id,
                    product: id,
                    price: mercados[id].melhor,
                  },
                  `Preço de ${products[id].name} ajustado para ${cr(mercados[id].melhor)}.`,
                );
            }}
          >
            <Sparkles size={16} /> Usar os melhores preços
          </button>
        )}
      </div>
      {itens.map((id) => (
        <LinhaPreco key={id} loja={loja} product={id} m={mercados[id]} />
      ))}
      <p className="muted small">
        Estimativa com a procura da cidade, a qualidade do estoque e os preços das lojas
        concorrentes, pela mesma regra que decide as vendas. Equipe, área e estoque podem limitar a
        venda real.
      </p>
    </div>
  );
}

function LinhaPreco({
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
  const estoque = loja.inventory[product] ?? 0;
  const vende = m.vendas(preco);
  const lucro = m.lucro(preco);
  const dias = vende > 0.01 ? estoque / vende : Infinity;
  const menorCidade = m.concorrentes[0]?.preco;
  // Régua de 50% do custo a 220% do preço justo; preço fora dela fica preso na ponta.
  const inicio = Math.round(Math.min(m.custo || m.justo, m.justo) * 0.5);
  const fim = Math.round(m.justo * 2.2);
  const pos = (v: number) =>
    `${Math.max(0, Math.min(100, ((v - inicio) / (fim - inicio)) * 100))}%`;
  const passo = Math.max(1, Math.round(m.justo / 200));
  // Curva de lucro por dia ao longo da régua.
  const pontos = Array.from({ length: 60 }, (_, i) => {
    const v = inicio + ((fim - inicio) * i) / 59;
    return { v, l: m.lucro(v) };
  });
  const topo = Math.max(1, ...pontos.map((p) => p.l));
  const curva = pontos
    .map((p, i) => `${(i / 59) * 100},${40 - Math.max(0, p.l / topo) * 36}`)
    .join(' ');
  const u1 = unidade(product, 1);
  const caro = vende < 0.5 && preco > m.justo;
  const prejuizo = m.custo > 0 && preco < m.custo;
  return (
    <article className="prat-item">
      <div className="prat-produto">
        <ProdutoArte product={product} escala={1} />
        <div>
          <h3>{products[product].name}</h3>
          <small>
            {num(estoque)} {unidade(product, estoque)} · qualidade{' '}
            {num(inventoryQuality(loja, product))}
          </small>
          <small>
            {estoque <= 0
              ? 'Acabou'
              : dias === Infinity
                ? 'Não está vendendo'
                : `Dura ~${num(Math.min(dias, 999))} dias`}
          </small>
          {estoque <= 0 || dias < 2 ? (
            <button
              className="text-button"
              onClick={() => openMarket({ destinationId: loja.id, product })}
            >
              <ShoppingCart size={13} /> Repor
            </button>
          ) : null}
        </div>
      </div>
      <div className="prat-regua-bloco">
        <svg
          className="prat-curva"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline points={`0,40 ${curva} 100,40`} className="area" />
          <polyline points={curva} className="linha" />
        </svg>
        <div className="prat-regua">
          {m.custo > 0 && (
            <span className="marco custo" style={{ left: pos(m.custo) }}>
              <i />
            </span>
          )}
          {menorCidade !== undefined && (
            <span className="marco rival" style={{ left: pos(menorCidade) }}>
              <i />
            </span>
          )}
          <span className="marco justo" style={{ left: pos(m.justo) }}>
            <i />
          </span>
          <span className="marco melhor" style={{ left: pos(m.melhor) }}>
            <i />
          </span>
          <input
            type="range"
            min={inicio}
            max={fim}
            step={passo}
            value={Math.min(fim, Math.max(inicio, preco))}
            onChange={(e) => setPreco(Number(e.target.value))}
            aria-label={`Preço de ${products[product].name}`}
          />
        </div>
        <p className="prat-legenda">
          {m.custo > 0 && (
            <span className="custo">
              custo <b>{cr(m.custo)}</b>
            </span>
          )}
          {menorCidade !== undefined && (
            <span className="rival">
              menor na cidade <b>{cr(menorCidade)}</b>
            </span>
          )}
          <span className="justo">
            justo <b>{cr(m.justo)}</b>
          </span>
          <span className="melhor">
            mais lucro <b>{cr(m.melhor)}</b>
          </span>
        </p>
        <p className="prat-rivais">
          {m.concorrentes.length
            ? `Em ${m.cidade}: ${m.concorrentes
                .slice(0, 3)
                .map((c) => `${c.loja.name} ${cr(c.preco)}`)
                .join(
                  ' · ',
                )}${m.concorrentes.length > 3 ? ` e mais ${m.concorrentes.length - 3}` : ''}`
            : `Nenhuma outra loja vende ${products[product].name} em ${m.cidade}.`}
          {m.menorDoPais !== undefined && ` Menor preço do mapa: ${cr(m.menorDoPais)}.`}
        </p>
      </div>
      <div className="prat-decisao">
        <label className="prat-preco">
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
        <div className="prat-efeito">
          <div>
            <b>~{num(vende)}</b>
            <span>vendidos por dia</span>
          </div>
          <div className={lucro >= 0 ? 'bom' : 'ruim'}>
            <b>{cr(lucro, 0)}</b>
            <span>de lucro por dia</span>
          </div>
        </div>
        {caro && <p className="prat-aviso">Caro demais: as famílias compram nas outras lojas.</p>}
        {prejuizo && <p className="prat-aviso">Abaixo do custo: cada {u1} vendido dá prejuízo.</p>}
        <div className="prat-botoes">
          {Math.abs(preco - m.melhor) > passo && (
            <button className="text-button" onClick={() => setPreco(m.melhor)}>
              Usar {cr(m.melhor)}
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
