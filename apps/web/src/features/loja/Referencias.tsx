import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { IconePixel, type NomeIcone } from '../../components/IconePixel';
import { Carimbo } from '../../components/Livro';
import { unidade } from '../economy/Carga';
import { SeloEmpresa } from '../inicio/Perfil';
import { haQuanto } from '../inicio/vivo';
import type { Mercado } from '../business/precificacao';
import {
  products,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import {
  availableStock,
  inventoryQuality,
} from '../../../../../packages/simulation/src/operations';
import { HOUR_MS, realToGame } from '../../../../../packages/simulation/src/clock';
import '../../design/inicio.css';
import '../../design/loja-referencias.css';

export type Referencia = 'custo' | 'rival' | 'pais' | 'justo';

const TITULOS: Record<Referencia, { icone: NomeIcone; titulo: string }> = {
  custo: { icone: 'custo', titulo: 'Por que o seu custo é esse' },
  rival: { icone: 'rival', titulo: 'Quem vende mais barato na sua cidade' },
  pais: { icone: 'mapa', titulo: 'Quem vende mais barato no mapa' },
  justo: { icone: 'justo', titulo: 'O que é o preço justo' },
};

const nomeDaEmpresa = (world: World, id: string) =>
  world.companies.find((c) => c.id === id)?.name ?? 'Empresa';
const cidadeDe = (world: World, e: Establishment) =>
  world.properties.find((p) => p.id === e.propertyId)?.city ?? '';

/** Uma linha de quem vende: selo da empresa, onde fica, preço e o que mais pesa na escolha. */
function Vendedor({
  id,
  empresaId,
  nome,
  cidade,
  preco,
  destaque,
  extra,
  voce,
}: {
  id: string;
  empresaId: string;
  nome: string;
  cidade: string;
  preco: number;
  destaque?: boolean;
  extra?: string;
  voce?: boolean;
}) {
  const { world } = useGame();
  return (
    <li key={id} className={`ref-vend ${destaque ? 'menor' : ''} ${voce ? 'voce' : ''}`}>
      <SeloEmpresa id={empresaId} nome={nomeDaEmpresa(world, empresaId)} voce={voce} />
      <span className="ref-vend-nome">
        <b>{voce ? `${nome} (você)` : nome}</b>
        <small>
          {nomeDaEmpresa(world, empresaId) === nome ? '' : `${nomeDaEmpresa(world, empresaId)} · `}
          {cidade}
          {extra ? ` · ${extra}` : ''}
        </small>
      </span>
      <b className="ref-preco">{cr(preco)}</b>
    </li>
  );
}

/** O custo vem das cargas que chegaram: mercadoria e frete por unidade, e de quem foi comprado. */
function NotaCusto({ loja, product, m }: { loja: Establishment; product: ProductId; m: Mercado }) {
  const { world, openRepor } = useGame();
  const un = unidade(product, 1);
  const entregas = useMemo(
    () =>
      world.shipments
        .filter((s) => s.destinationId === loja.id && s.product === product && s.delivered)
        .sort((a, b) => b.arrivesAt - a.arrivesAt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, product],
  );
  const qtd = entregas.reduce((n, s) => n + s.quantity, 0);
  const mercadoria = entregas.reduce((n, s) => n + s.cost, 0);
  const frete = entregas.reduce((n, s) => n + s.freight, 0);
  const porUnMerc = qtd ? mercadoria / qtd : 0;
  const porUnFrete = qtd ? frete / qtd : 0;
  const partFrete = mercadoria + frete > 0 ? frete / (mercadoria + frete) : 0;
  const estoque = loja.inventory[product] ?? 0;

  // O menor preço de atacado de quem tem o produto em estoque agora.
  const ofertas = useMemo(() => {
    const porId = new Map(world.establishments.map((e) => [e.id, e]));
    return world.offers
      .filter((o) => o.product === product)
      .map((o) => ({ o, e: porId.get(o.establishmentId)! }))
      .filter(
        ({ e }) => e && e.enabled && e.id !== loja.id && availableStock(world, e, product) >= 1,
      )
      .sort((a, b) => a.o.price - b.o.price)
      .slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, product, loja.id]);
  const melhorAtacado = ofertas[0]?.o.price;
  // Quanto o atacado de hoje cobra a menos do que a média que você pagou (nunca passa de 100%).
  const aMenos = melhorAtacado && m.custo > 0 ? 1 - melhorAtacado / m.custo : 0;

  return (
    <>
      <p className="ref-resumo">
        Cada {un} que você tem custou, em média, <b>{cr(m.custo)}</b>. É uma média do que você pagou
        pela mercadoria e pelo frete em cada carga, misturada com o que já estava no armazém.
        {melhorAtacado !== undefined && aMenos > 0.13 && (
          <>
            {' '}
            Hoje o atacado mais barato cobra <b>{cr(melhorAtacado)}</b>:{' '}
            <b>{num(aMenos * 100)}% menos</b> do que você pagou.
          </>
        )}
      </p>

      {qtd > 0 ? (
        <section aria-label="De onde vem o custo">
          <h4 className="lv-rotulo">
            O que pesou nas últimas cargas ({num(qtd)} {unidade(product, qtd)})
          </h4>
          <div
            className="ref-barra"
            role="img"
            aria-label={`Mercadoria ${cr(porUnMerc)}, frete ${cr(porUnFrete)} por ${un}`}
          >
            <i className="merc" style={{ width: `${(1 - partFrete) * 100}%` }} />
            {partFrete > 0.02 && <i className="frete" style={{ width: `${partFrete * 100}%` }} />}
          </div>
          <p className="ref-legenda">
            <span className="merc">Mercadoria {cr(porUnMerc)}</span>
            <span className="frete">Frete {cr(porUnFrete)}</span>
            <small>por {un}, média das últimas cargas</small>
          </p>
          {partFrete > 0.3 && (
            <p className="ref-dica">
              O frete é <b>{num(partFrete * 100)}%</b> do custo. A viagem custa quase o mesmo para
              pouca carga, então pedir mais de uma vez diminui o custo por {un}.
            </p>
          )}
          <ol className="ref-lista">
            {entregas.slice(0, 5).map((s) => {
              const origem = world.establishments.find((e) => e.id === s.originId);
              return (
                <li key={s.id}>
                  <b>
                    {num(s.quantity)} {unidade(product, s.quantity)}
                  </b>
                  <span>
                    de {origem?.name ?? nomeDaEmpresa(world, s.sellerId)}
                    <small>
                      {' '}
                      · {cr(s.cost / s.quantity)} + frete {cr(s.freight / s.quantity)} ={' '}
                      <b>{cr((s.cost + s.freight) / s.quantity)}</b> por {un}
                    </small>
                  </span>
                  <small>
                    {haQuanto(realToGame(world, world.updatedAt - s.arrivesAt) / HOUR_MS)}
                  </small>
                </li>
              );
            })}
          </ol>
        </section>
      ) : (
        <p className="ref-dica">
          Não há cargas recentes para explicar o custo: ele vem do estoque inicial ({num(estoque)}{' '}
          {unidade(product, estoque)}) e das compras mais antigas.
        </p>
      )}

      <section aria-label="Onde comprar mais barato hoje">
        <h4 className="lv-rotulo">Onde comprar mais barato hoje (preço sem frete)</h4>
        {ofertas.length ? (
          <ul className="ref-vendedores">
            {ofertas.map(({ o, e }, i) => (
              <Vendedor
                key={o.id}
                id={o.id}
                empresaId={e.companyId}
                nome={e.name}
                cidade={cidadeDe(world, e)}
                preco={o.price}
                destaque={i === 0}
                extra={`${num(availableStock(world, e, product))} ${unidade(product, availableStock(world, e, product))}`}
              />
            ))}
          </ul>
        ) : (
          <p className="ref-dica">Ninguém tem este produto à venda no atacado agora.</p>
        )}
        <button className="primary" onClick={() => openRepor({ destinationId: loja.id, product })}>
          Mandar buscar
        </button>
      </section>
    </>
  );
}

/** A concorrência: preços na cidade (ou no mapa) e a fatia da procura que cada loja leva. */
function NotaConcorrencia({
  loja,
  product,
  m,
  escopo,
  preco,
}: {
  loja: Establishment;
  product: ProductId;
  m: Mercado;
  escopo: 'rival' | 'pais';
  preco: number;
}) {
  const { world } = useGame();
  const lista = useMemo(() => {
    const lojas = world.establishments.filter(
      (e) =>
        e.category === 'retail' &&
        e.enabled &&
        e.id !== loja.id &&
        (e.prices[product] ?? 0) > 0 &&
        (e.inventory[product] ?? 0) > 0 &&
        (escopo === 'pais' || cidadeDe(world, e) === m.cidade),
    );
    const peso = (e: Establishment, p: number) =>
      Math.pow(m.justo / p, 1.4) * (0.5 + inventoryQuality(e, product) / 100);
    const meu = peso(loja, preco);
    const soma = lojas.reduce((n, e) => n + peso(e, e.prices[product]!), 0) + meu;
    return {
      linhas: lojas
        .map((e) => ({ e, preco: e.prices[product]!, fatia: peso(e, e.prices[product]!) / soma }))
        .sort((a, b) => a.preco - b.preco)
        .slice(0, 6),
      minha: meu / soma,
      total: lojas.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, loja.id, product, escopo, preco]);
  const menor = lista.linhas[0]?.preco;
  const difere = menor ? preco / menor - 1 : 0;
  const onde = escopo === 'rival' ? `em ${m.cidade}` : 'no mapa';
  return (
    <>
      <p className="ref-resumo">
        {menor === undefined ? (
          <>
            Nenhuma outra loja {onde} tem {products[product].name.toLocaleLowerCase('pt-BR')} em
            estoque agora.
          </>
        ) : (
          <>
            O menor preço {onde} é <b>{cr(menor)}</b>. O seu está{' '}
            <b>
              {num(Math.abs(difere) * 100)}% {difere >= 0 ? 'acima' : 'abaixo'}
            </b>
            .{' '}
            {escopo === 'rival'
              ? 'As famílias da cidade dividem a compra entre as lojas pelo preço e pela qualidade do estoque.'
              : 'Lojas de outras cidades não tiram a sua venda: só as da sua cidade competem com você.'}
          </>
        )}
      </p>
      {lista.linhas.length > 0 && (
        <ul className="ref-vendedores">
          {lista.linhas.map(({ e, preco: p, fatia }, i) => (
            <Vendedor
              key={e.id}
              id={e.id}
              empresaId={e.companyId}
              nome={e.name}
              cidade={cidadeDe(world, e)}
              preco={p}
              destaque={i === 0}
              extra={`qualidade ${num(inventoryQuality(e, product))}${escopo === 'rival' ? ` · leva ~${num(fatia * 100)}%` : ''}`}
            />
          ))}
        </ul>
      )}
      {escopo === 'rival' && (
        <div className="ref-fatia">
          <span className="lv-rotulo">Sua fatia da procura na cidade, ao preço de {cr(preco)}</span>
          <div
            className="ref-barra"
            role="img"
            aria-label={`Você leva cerca de ${num(lista.minha * 100)}%`}
          >
            <i className="merc" style={{ width: `${lista.minha * 100}%` }}>
              ~{num(lista.minha * 100)}%
            </i>
          </div>
          <small>
            {lista.total} {lista.total === 1 ? 'concorrente' : 'concorrentes'} com estoque. Baixar o
            preço aumenta a fatia; a régua acima mostra quanto isso vale em lucro.
          </small>
        </div>
      )}
    </>
  );
}

/** O preço justo: a referência da temporada e o que acontece quando você se afasta dela. */
function NotaJusto({ product, m }: { product: ProductId; m: Mercado }) {
  const degraus = [0.8, 0.9, 1, 1.1, 1.2, 1.4];
  const base = m.vendas(m.justo);
  return (
    <>
      <p className="ref-resumo">
        O preço justo de {products[product].name.toLocaleLowerCase('pt-BR')} é <b>{cr(m.justo)}</b>:
        a referência da temporada, o que as famílias consideram normal. Quem cobra mais perde
        compradores para as lojas mais baratas; quem cobra menos vende mais, mas lucra menos por{' '}
        {unidade(product, 1)}.
      </p>
      <table className="ref-tabela">
        <caption className="lv-rotulo">O que muda ao se afastar do justo</caption>
        <thead>
          <tr>
            <th scope="col">Preço</th>
            <th scope="col">Vende por dia</th>
            <th scope="col">Lucro por dia</th>
          </tr>
        </thead>
        <tbody>
          {degraus.map((d) => {
            const p = Math.round(m.justo * d);
            const l = m.lucro(p);
            return (
              <tr key={d} className={d === 1 ? 'justo' : ''}>
                <th scope="row">
                  {cr(p)}{' '}
                  <small>
                    {d === 1 ? 'justo' : `${d > 1 ? '+' : '−'}${num(Math.abs(d - 1) * 100)}%`}
                  </small>
                </th>
                <td>
                  ~{num(m.vendas(p))}
                  {base > 0 && d !== 1 && (
                    <small>
                      {' '}
                      ({m.vendas(p) >= base ? '+' : ''}
                      {num((m.vendas(p) / base - 1) * 100)}%)
                    </small>
                  )}
                </td>
                <td className={l >= 0 ? 'pos' : 'neg'}>{cr(l, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ref-dica">
        Seu ponto de maior lucro é <b>{cr(m.melhor)}</b>
        {m.melhor > m.justo
          ? ' (acima do justo, porque os rivais cobram caro)'
          : m.melhor < m.justo
            ? ' (abaixo do justo, para ganhar volume)'
            : ''}
        .
      </p>
    </>
  );
}

/**
 * A nota de detalhe de uma referência do painel de preço: explica de onde vem aquele número com os
 * dados reais da sua loja e do mercado, e leva para a ação certa.
 */
export function DetalheReferencia({
  referencia,
  loja,
  product,
  m,
  preco,
  onFechar,
}: {
  referencia: Referencia;
  loja: Establishment;
  product: ProductId;
  m: Mercado;
  preco: number;
  onFechar: () => void;
}) {
  const { icone, titulo } = TITULOS[referencia];
  return (
    <aside className="ref" aria-label={titulo} role="region">
      <header>
        <IconePixel nome={icone} tamanho={36} />
        <h4 className="lv-grande">{titulo}</h4>
        <Carimbo tom="ceu" giro={3}>
          {products[product].name}
        </Carimbo>
        <button className="ref-fechar" onClick={onFechar} aria-label="Fechar detalhe">
          <X size={20} strokeWidth={3} aria-hidden="true" />
        </button>
      </header>
      {referencia === 'custo' && <NotaCusto loja={loja} product={product} m={m} />}
      {(referencia === 'rival' || referencia === 'pais') && (
        <NotaConcorrencia loja={loja} product={product} m={m} escopo={referencia} preco={preco} />
      )}
      {referencia === 'justo' && <NotaJusto product={product} m={m} />}
    </aside>
  );
}
