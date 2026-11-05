import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Empty } from '../../components/ui';
import { BotaoEspera } from '../../components/Espera';
import { Carimbo } from '../../components/Livro';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { contaDaPrateleira } from '../business/precificacao';
import { LinhaPreco } from '../business/LinhaPreco';
import { Fita } from './Fita';
import { IconePixel } from '../../components/IconePixel';
import { openShipmentsTo } from '../../../../../packages/simulation/src/indexes';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { RegraAutomatica, useRegra } from './RegraAutomatica';
import { FRETE_ALTO, freteRecente, type FreteDoProduto } from './frete';
import { vagasDaLoja, type Vaga } from './vagas';
import '../../design/inicio-ajustes.css';
import '../../design/loja-balcao.css';

type Item = ReturnType<typeof contaDaPrateleira>['itens'][number];
type Vista = 'prateleira' | 'lista';

/** Uma semana de vendas enche a barra do estoque. */
const SEMANA = 7;
const tomDe = (dias: number) => (dias < 1 ? 'brasa' : dias < 3 ? 'ouro' : 'lavoura');
const duraTexto = (dias: number) =>
  dias === 0
    ? 'esgotado'
    : dias === Infinity
      ? 'sem vendas'
      : `dura ~${num(dias, dias < 10 ? 1 : 0)} d`;

function lerVista(): Vista {
  try {
    return localStorage.getItem('aftermarket.loja.vista') === 'lista' ? 'lista' : 'prateleira';
  } catch {
    return 'prateleira';
  }
}

/** Quanto do estoque resta, de vazio a uma semana de vendas, numa barra contínua. */
function BarraEstoque({ dias }: { dias: number }) {
  const parte = dias === Infinity ? 1 : Math.min(1, dias / SEMANA);
  return (
    <span className={`bl-barra-estoque tom-${tomDe(dias)}`} aria-hidden="true">
      <i style={{ width: `${Math.max(parte > 0 ? 4 : 0, parte * 100)}%` }} />
    </span>
  );
}

interface Estado {
  tom: 'brasa' | 'ouro' | 'lavoura' | 'ceu';
  palavra: string;
}

/** Uma palavra de estado por produto, na ordem do que mais pede atenção. */
function estadoDe(x: Item, aCaminho: number): Estado {
  if (x.estoque <= 0)
    return aCaminho > 0
      ? { tom: 'ceu', palavra: 'A caminho' }
      : { tom: 'brasa', palavra: 'Esgotado' };
  if (x.lucro < 0) return { tom: 'brasa', palavra: 'Dá prejuízo' };
  if (x.dias < 2) return { tom: 'ouro', palavra: 'Acabando' };
  return { tom: 'lavoura', palavra: 'Vendendo' };
}

function SlotProduto({
  loja,
  x,
  frete,
  aberto,
  onAbrir,
}: {
  loja: Establishment;
  x: Item;
  frete?: FreteDoProduto;
  aberto: boolean;
  onAbrir: () => void;
}) {
  const { world, openRepor } = useGame();
  const { regra, ligada } = useRegra(loja, x.id);
  const nome = products[x.id].name;
  const aCaminho = openShipmentsTo(world, loja.id, x.id).reduce((n, s) => n + s.quantity, 0);
  const estado = estadoDe(x, aCaminho);
  const repor = () => openRepor({ destinationId: loja.id, product: x.id });
  // Uma ação principal: repor o que acabou, rever o preço do que dá prejuízo.
  const principal =
    estado.palavra === 'Esgotado' || estado.palavra === 'Acabando'
      ? { rotulo: 'Repor', agir: repor }
      : estado.palavra === 'Dá prejuízo'
        ? { rotulo: 'Rever preço', agir: onAbrir }
        : null;
  return (
    <li className={`bl-card tom-${estado.tom} ${aberto ? 'aberto' : ''}`}>
      <button className="bl-card-abrir" onClick={onAbrir} aria-pressed={aberto}>
        <span className="sr-only">Abrir o painel do balcão de {nome}. </span>
        <span className="bl-palco">
          <span className="bl-sprite lv-adesivo">
            <ProdutoArte product={x.id} escala={2} />
          </span>
        </span>
        <span className="bl-cabeca">
          <span className="bl-estado">{estado.palavra}</span>
          <strong className="bl-nome">{nome}</strong>
          <span className="lv-preco bl-preco">{cr(x.preco)}</span>
          {frete && frete.parte > FRETE_ALTO && (
            <span className="bl-frete-alto">
              <IconePixel nome="caminhao" tamanho={16} /> Frete {num(frete.parte * 100)}% do custo
            </span>
          )}
        </span>
      </button>

      <dl className="bl-numeros">
        <div className={`bl-lucro ${x.estoque <= 0 ? 'nada' : x.lucro < 0 ? 'neg' : 'pos'}`}>
          <dt>Lucro por dia</dt>
          <dd>{x.estoque <= 0 ? '—' : `${x.lucro < 0 ? '−' : '+'}${cr(Math.abs(x.lucro), 0)}`}</dd>
        </div>
        <div>
          <dt>Vende</dt>
          <dd>~{num(x.vende)}/dia</dd>
        </div>
        <div className="bl-estoque">
          <dt>Estoque</dt>
          <dd>
            {num(x.estoque)} {unidade(x.id, x.estoque)}
            <small>
              {x.estoque <= 0 && aCaminho > 0 ? `${num(aCaminho)} na estrada` : duraTexto(x.dias)}
            </small>
          </dd>
          <BarraEstoque dias={x.dias} />
        </div>
      </dl>

      <footer className="bl-card-pe">
        {principal ? (
          <button className="primary" onClick={principal.agir}>
            {principal.rotulo}
          </button>
        ) : (
          <button className="secondary" onClick={repor}>
            Repor
          </button>
        )}
        <button
          className={`bl-auto ${ligada ? 'ligada' : regra ? 'pausada' : ''}`}
          onClick={onAbrir}
          aria-label={`Repor ${nome} sozinho: ${ligada ? 'ligado' : regra ? 'pausado' : 'desligado'}. Abrir o painel`}
        >
          <IconePixel nome="caminhao" tamanho={20} />
          <span>
            Repõe sozinho <b>{ligada ? 'ligado' : regra ? 'pausado' : 'desligado'}</b>
          </span>
        </button>
      </footer>
    </li>
  );
}

function SlotVazio({ loja, v }: { loja: Establishment; v: Vaga }) {
  const { openRepor } = useGame();
  const nome = products[v.id].name;
  return (
    <li className={`bl-card vazio tom-${v.aCaminho ? 'ceu' : 'brasa'}`}>
      <div className="bl-card-abrir estatico">
        <span className="bl-palco">
          <span className="bl-sprite">
            <ProdutoArte product={v.id} escala={2} />
          </span>
        </span>
        <span className="bl-cabeca">
          <span className="bl-estado">{v.aCaminho ? 'A caminho' : 'Vaga vazia'}</span>
          <strong className="bl-nome">{nome}</strong>
          <small className="bl-conta">
            compra a {cr(v.custo)} e vende a {cr(v.preco)}
          </small>
        </span>
      </div>

      <dl className="bl-numeros">
        <div className={`bl-lucro ${v.aCaminho ? 'nada' : 'neg'}`}>
          <dt>{v.aCaminho ? 'Já pedido' : 'Deixa de ganhar'}</dt>
          <dd>{v.aCaminho ? 'na estrada' : `−${cr(v.lucroDia, 0)}/dia`}</dd>
        </div>
        <div>
          <dt>A cidade procura</dt>
          <dd>
            ~{num(v.procuraDia)} {unidade(v.id, v.procuraDia)}/dia
          </dd>
        </div>
      </dl>

      <footer className="bl-card-pe">
        <button
          className={v.aCaminho ? 'secondary' : 'primary'}
          onClick={() => openRepor({ destinationId: loja.id, product: v.id })}
        >
          {v.aCaminho ? 'Pedir mais' : 'Mandar buscar'}
        </button>
      </footer>
    </li>
  );
}

/** O painel do balcão: preço com a curva de lucro e a regra de repor sozinho, do produto aberto. */
function Painel({ loja, x }: { loja: Establishment; x: Item }) {
  return (
    <section className="bl-painel" aria-labelledby="bl-painel-titulo">
      <header>
        <span className="bl-painel-sprite lv-adesivo">
          <ProdutoArte product={x.id} escala={1} />
        </span>
        <div>
          <span className="lv-rotulo">Painel do balcão</span>
          <h3 id="bl-painel-titulo" className="lv-grande">
            {products[x.id].name}
          </h3>
        </div>
      </header>
      <div className="bl-painel-corpo">
        <div className="bl-painel-preco">
          <LinhaPreco key={x.id} loja={loja} product={x.id} m={x.m} compacto />
        </div>
        <RegraAutomatica key={x.id} loja={loja} product={x.id} />
      </div>
    </section>
  );
}

function Lista({
  loja,
  itens,
  vagas,
  aberto,
  onAbrir,
}: {
  loja: Establishment;
  itens: Item[];
  vagas: Vaga[];
  aberto: ProductId | null;
  onAbrir: (id: ProductId) => void;
}) {
  const { openRepor } = useGame();
  const total = itens.reduce((n, x) => n + x.lucro, 0);
  return (
    <div className="bl-lista">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Estoque</th>
            <th>Preço</th>
            <th>Vende / dia</th>
            <th>Lucro / dia</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vagas.map((v) => (
            <tr key={v.id} className="falta">
              <td>
                <span className="bl-lista-prod">
                  <ProdutoArte product={v.id} escala={1} />
                  {products[v.id].name}
                </span>
              </td>
              <td>
                <Carimbo tom={v.aCaminho ? 'ceu' : 'brasa'} giro={-2}>
                  {v.aCaminho ? 'a caminho' : 'vaga vazia'}
                </Carimbo>
              </td>
              <td>—</td>
              <td className="num">~{num(v.procuraDia)}</td>
              <td className="num neg">{v.aCaminho ? '—' : `−${cr(v.lucroDia, 0)}`}</td>
              <td>
                <button
                  className="primary"
                  onClick={() => openRepor({ destinationId: loja.id, product: v.id })}
                >
                  {v.aCaminho ? 'Pedir mais' : 'Mandar buscar'}
                </button>
              </td>
            </tr>
          ))}
          {itens.map((x) => (
            <tr key={x.id} className={aberto === x.id ? 'aberto' : ''}>
              <td>
                <span className="bl-lista-prod">
                  <ProdutoArte product={x.id} escala={1} />
                  {products[x.id].name}
                </span>
              </td>
              <td>
                <BarraEstoque dias={x.dias} />
                <small>
                  {num(x.estoque)} · {duraTexto(x.dias)}
                </small>
              </td>
              <td className="num">{cr(x.preco)}</td>
              <td className="num">~{num(x.vende)}</td>
              <td className={`num ${x.lucro >= 0 ? 'pos' : 'neg'}`}>
                {x.lucro >= 0 ? '+' : '−'}
                {cr(Math.abs(x.lucro), 0)}
              </td>
              <td className="bl-lista-acoes">
                <button className="secondary" onClick={() => onAbrir(x.id)}>
                  Preço e regra
                </button>
                <button
                  className={x.dias < 1 ? 'primary' : 'secondary'}
                  onClick={() => openRepor({ destinationId: loja.id, product: x.id })}
                >
                  Repor
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Total da prateleira</td>
            <td className={`num ${total >= 0 ? 'pos' : 'neg'}`}>
              {total >= 0 ? '+' : '−'}
              {cr(Math.abs(total), 0)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * A prateleira de balcão: todos os produtos que a cidade procura. Os que a loja tem aparecem de pé,
 * com a etiqueta de preço e as caixas que restam; os que faltam, como vagas vazias com a perda por
 * dia. Clicar num produto abre o painel do balcão (preço, curva de lucro e regra de repor sozinho).
 */
export function Balcao({ loja }: { loja: Establishment }) {
  const { world, run, pending, openRepor, notice } = useGame();
  const aviso = (texto: string) => notice(texto, true);
  const [vista, setVista] = useState<Vista>(lerVista);
  const conta = useMemo(
    () => contaDaPrateleira(world, loja),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id],
  );
  const fretes = useMemo(
    () => freteRecente(world, loja.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id],
  );
  const vagas = useMemo(
    () => vagasDaLoja(world, loja),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id],
  );
  // O primeiro produto aberto é o que mais pede atenção: o que acaba primeiro.
  const [aberto, setAberto] = useState<ProductId | null>(null);
  const [progresso, setProgresso] = useState({ n: 0 });
  // O primeiro produto aberto é escolhido uma vez (o que acaba primeiro) e depois fica fixo: se a
  // seleção seguisse a ordem, que muda a cada atualização do mundo, o painel seria recriado e o
  // jogador perderia o que estava digitando.
  useEffect(() => {
    if (aberto === null && conta.itens[0]) setAberto(conta.itens[0].id);
    else if (aberto !== null && !conta.itens.some((x) => x.id === aberto))
      setAberto(conta.itens[0]?.id ?? null);
  }, [aberto, conta.itens]);
  const atual = conta.itens.find((x) => x.id === aberto) ?? null;
  const painel = useRef<HTMLDivElement>(null);
  const clicou = useRef(false);
  useEffect(() => {
    const aoLado = window.matchMedia?.('(min-width: 1180px)').matches;
    if (clicou.current && !aoLado)
      painel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    clicou.current = false;
  }, [atual?.id]);
  const abrir = (id: ProductId) => {
    clicou.current = true;
    setAberto(id);
  };
  const escolher = (v: Vista) => {
    setVista(v);
    try {
      localStorage.setItem('aftermarket.loja.vista', v);
    } catch {
      /* sem armazenamento: a escolha vale só nesta visita */
    }
  };

  if (!conta.itens.length && !vagas.length)
    return (
      <Empty
        title="Nada para vender por aqui ainda"
        description="Ninguém está vendendo mercadoria que esta cidade procura. Volte quando houver oferta no mercado."
      />
    );

  const ganho = conta.melhor - conta.agora;
  const linhas: (Item | Vaga)[] = [...conta.itens, ...vagas];

  return (
    <div className="bl">
      {conta.ajustar.length > 0 && ganho > 100 && (
        <div className="bl-dica">
          <p className="lv-mao">
            Ajustando {conta.ajustar.length} {conta.ajustar.length === 1 ? 'preço' : 'preços'}, a
            prateleira ganha +{cr(ganho, 0)} por dia
          </p>
          <BotaoEspera
            className="primary"
            disabled={pending}
            esperando={`Ajustando ${progresso.n === 0 ? 1 : progresso.n} de ${conta.ajustar.length}…`}
            onClick={async () => {
              for (const [i, x] of conta.ajustar.entries()) {
                setProgresso({ n: i + 1 });
                const ok = await run(
                  { type: 'setPrice', establishmentId: loja.id, product: x.id, price: x.m.melhor },
                  `Preços ajustados (${i + 1} de ${conta.ajustar.length}).`,
                );
                if (!ok) {
                  aviso(
                    `${conta.ajustar.length - i} de ${conta.ajustar.length} preços ficaram sem ajuste. Tente de novo.`,
                  );
                  break;
                }
              }
              setProgresso({ n: 0 });
            }}
          >
            Usar os melhores preços
          </BotaoEspera>
        </div>
      )}

      <div className="bl-barra">
        <h2 className="lv-grande">
          {conta.itens.length} {conta.itens.length === 1 ? 'produto' : 'produtos'} na prateleira
          {vagas.length > 0 && (
            <small>
              · {vagas.length} {vagas.length === 1 ? 'vaga vazia' : 'vagas vazias'}
            </small>
          )}
        </h2>
        <div className="bl-vista" role="radiogroup" aria-label="Como mostrar a prateleira">
          <button
            role="radio"
            aria-checked={vista === 'prateleira'}
            className={vista === 'prateleira' ? 'on' : ''}
            onClick={() => escolher('prateleira')}
          >
            <LayoutGrid size={16} aria-hidden="true" /> Cartões
          </button>
          <button
            role="radio"
            aria-checked={vista === 'lista'}
            className={vista === 'lista' ? 'on' : ''}
            onClick={() => escolher('lista')}
          >
            <List size={16} aria-hidden="true" /> Lista
          </button>
        </div>
      </div>

      <div className="bl-area">
        <div className="bl-prat">
          {vista === 'prateleira' ? (
            <ul className="bl-grade">
              {linhas.map((x) =>
                'estoque' in x ? (
                  <SlotProduto
                    key={x.id}
                    loja={loja}
                    x={x}
                    frete={fretes.get(x.id)}
                    aberto={atual?.id === x.id}
                    onAbrir={() => abrir(x.id)}
                  />
                ) : (
                  <SlotVazio key={x.id} loja={loja} v={x} />
                ),
              )}
            </ul>
          ) : (
            <Lista
              loja={loja}
              itens={conta.itens}
              vagas={vagas}
              aberto={atual?.id ?? null}
              onAbrir={abrir}
            />
          )}
        </div>
        <aside className="bl-lado" ref={painel} aria-label="Painel do balcão">
          {atual && <Painel loja={loja} x={atual} />}
        </aside>
      </div>

      {!conta.itens.length && vagas.length > 0 && (
        <p className="bl-vazio-dica">
          A prateleira está vazia. Escolha uma vaga e mande buscar o primeiro produto.{' '}
          <button
            className="text-button"
            onClick={() => openRepor({ destinationId: loja.id, product: vagas[0].id })}
          >
            Começar por {products[vagas[0].id].name}
          </button>
        </p>
      )}
      <Fita loja={loja} />
      <p className="bl-nota-rodape">
        Estimativa com a procura da cidade, a qualidade do estoque e os preços das lojas
        concorrentes, pela mesma regra que decide as vendas. Equipe, área e estoque podem limitar a
        venda real.
      </p>
    </div>
  );
}
