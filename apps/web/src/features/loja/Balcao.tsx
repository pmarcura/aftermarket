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
import { Caixa } from '../business/Prateleira';
import { Ficha } from '../inicio/pecas';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { RegraAutomatica, useRegra } from './RegraAutomatica';
import { vagasDaLoja, type Vaga } from './vagas';
import '../../design/inicio-ajustes.css';
import '../../design/loja-balcao.css';

type Item = ReturnType<typeof contaDaPrateleira>['itens'][number];
type Vista = 'prateleira' | 'lista';

const CAIXAS = 12;
/** Caixas cheias: a prateleira cheia equivale a uma semana de vendas. */
const cheiasDe = (dias: number) =>
  dias === Infinity ? CAIXAS : Math.min(CAIXAS, Math.round((dias / 7) * CAIXAS));
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

function Caixas({ dias }: { dias: number }) {
  const cheias = cheiasDe(dias);
  return (
    <span className={`bl-caixas tom-${tomDe(dias)}`} aria-hidden="true">
      {Array.from({ length: CAIXAS }, (_, i) => (
        <i key={i} className={i < cheias ? '' : 'vazia'} style={{ ['--i' as string]: i }} />
      ))}
    </span>
  );
}

function SlotProduto({
  loja,
  x,
  aberto,
  onAbrir,
}: {
  loja: Establishment;
  x: Item;
  aberto: boolean;
  onAbrir: () => void;
}) {
  const { openRepor } = useGame();
  const { regra, ligada } = useRegra(loja, x.id);
  const nome = products[x.id].name;
  return (
    <li className={`bl-slot tom-${tomDe(x.dias)} ${aberto ? 'aberto' : ''}`}>
      <button
        className="bl-slot-corpo"
        onClick={onAbrir}
        aria-pressed={aberto}
        aria-label={`${nome}: ajustar preço e regra`}
      >
        <span className="bl-topo">
          <span className="bl-sprite lv-adesivo">
            <ProdutoArte product={x.id} escala={2} />
          </span>
          <span className="lv-preco bl-preco">{cr(x.preco)}</span>
        </span>
        <strong className="bl-nome">{nome}</strong>
        <Caixas dias={x.dias} />
        <span className="bl-dura">
          <span>
            {num(x.estoque)} {unidade(x.id, x.estoque)}
          </span>
          <b>{duraTexto(x.dias)}</b>
        </span>
      </button>
      <div className="bl-chips">
        <Ficha rotulo="Vende" tom="ceu" valor={`~${num(x.vende)} / dia`} />
        <Ficha rotulo="Lucro" tom="lavoura" valor={`${cr(x.lucro, 0)} / dia`} />
      </div>
      <div className="bl-acoes">
        <button
          className={x.dias < 1 ? 'primary' : 'secondary'}
          onClick={() => openRepor({ destinationId: loja.id, product: x.id })}
        >
          Repor
        </button>
        <button className="bl-auto" onClick={onAbrir} aria-label={`Regra de repor ${nome} sozinho`}>
          <Carimbo tom={ligada ? 'lavoura' : regra ? 'ouro' : 'ceu'} giro={ligada ? -3 : 2}>
            {ligada ? 'auto: ligado' : regra ? 'auto: pausado' : 'auto: desligado'}
          </Carimbo>
        </button>
      </div>
    </li>
  );
}

function SlotVazio({ loja, v }: { loja: Establishment; v: Vaga }) {
  const { openRepor } = useGame();
  const nome = products[v.id].name;
  return (
    <li className="bl-slot vazio">
      <div className="bl-slot-corpo estatico">
        <span className="bl-topo">
          <span className="bl-sprite">
            <ProdutoArte product={v.id} escala={2} />
          </span>
          <Carimbo tom={v.aCaminho ? 'ceu' : 'brasa'} giro={-4}>
            {v.aCaminho ? 'a caminho' : 'vaga vazia'}
          </Carimbo>
        </span>
        <strong className="bl-nome">{nome}</strong>
        <p className="bl-procura">
          A cidade procura ~{num(v.procuraDia)} {unidade(v.id, v.procuraDia)} por dia e a loja não
          vende {v.aCaminho ? 'ainda' : 'nenhum'}.
        </p>
        <p className={`bl-perda ${v.aCaminho ? 'ok' : ''}`}>
          {v.aCaminho ? 'Já pedido' : `−${cr(v.lucroDia, 0)}`}
          <small>{v.aCaminho ? 'a carga está na estrada' : 'por dia, estimativa'}</small>
        </p>
      </div>
      <div className="bl-acoes">
        <button
          className={v.aCaminho ? 'secondary' : 'primary'}
          onClick={() => openRepor({ destinationId: loja.id, product: v.id })}
        >
          {v.aCaminho ? 'Pedir mais' : 'Mandar buscar'}
        </button>
        <small className="bl-conta">
          compra a {cr(v.custo)} e vende a {cr(v.preco)}
        </small>
      </div>
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
                <Caixas dias={x.dias} />
                <small>
                  {num(x.estoque)} · {duraTexto(x.dias)}
                </small>
              </td>
              <td className="num">{cr(x.preco)}</td>
              <td className="num">~{num(x.vende)}</td>
              <td className="num pos">+{cr(x.lucro, 0)}</td>
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
            <td className="num pos">
              +
              {cr(
                itens.reduce((n, x) => n + x.lucro, 0),
                0,
              )}
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
  const { world, run, pending, openRepor } = useGame();
  const [vista, setVista] = useState<Vista>(lerVista);
  const conta = useMemo(
    () => contaDaPrateleira(world, loja),
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
    if (clicou.current) painel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  const fileiras: (Item | Vaga)[][] = [];
  for (let i = 0; i < linhas.length; i += 3) fileiras.push(linhas.slice(i, i + 3));

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
                await run(
                  { type: 'setPrice', establishmentId: loja.id, product: x.id, price: x.m.melhor },
                  `Preços ajustados (${i + 1} de ${conta.ajustar.length}).`,
                );
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
            <LayoutGrid size={16} aria-hidden="true" /> Prateleira
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

      {vista === 'prateleira' ? (
        fileiras.map((fila, k) => (
          <ul className="bl-tabua" key={k}>
            {fila.map((x) =>
              'estoque' in x ? (
                <SlotProduto
                  key={x.id}
                  loja={loja}
                  x={x}
                  aberto={atual?.id === x.id}
                  onAbrir={() => abrir(x.id)}
                />
              ) : (
                <SlotVazio key={x.id} loja={loja} v={x} />
              ),
            )}
          </ul>
        ))
      ) : (
        <Lista
          loja={loja}
          itens={conta.itens}
          vagas={vagas}
          aberto={atual?.id ?? null}
          onAbrir={abrir}
        />
      )}

      <div ref={painel}>{atual && <Painel loja={loja} x={atual} />}</div>

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
      <Caixa loja={loja} />
      <p className="bl-nota-rodape">
        Estimativa com a procura da cidade, a qualidade do estoque e os preços das lojas
        concorrentes, pela mesma regra que decide as vendas. Equipe, área e estoque podem limitar a
        venda real.
      </p>
    </div>
  );
}
