import { useMemo, useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Select } from '../../components/ui';
import { IconePixel } from '../../components/IconePixel';
import { BotaoProduto } from '../../components/BotaoProduto';
import { matizDoProduto } from '../../design/arte';
import { ProdutoArte } from '../economy/Vitrine';
import { unidade } from '../economy/Carga';
import { avaliar, quantidadeParaDestino, type Avaliacao } from '../economy/compra';
import {
  products,
  seasonProducts,
  type Establishment,
  type Offer,
} from '../../../../../packages/simulation/src/model';
import '../../design/comprar.css';

type Ordem = 'preco' | 'perto' | 'estoque';
const PASSO = 12;

/**
 * Todas as ofertas do mercado, para quem quer escolher a empresa e o frete na mão. Cada oferta é um
 * cartão pequeno; a compra segue para a tela de Entregas, onde se escolhe a transportadora e o prazo.
 * Só calcula frete quando a lista está aberta.
 */
export function ListaOfertas({
  destino,
  ofertas,
  relevantes,
}: {
  destino: Establishment;
  ofertas: Offer[];
  relevantes?: Set<string>;
}) {
  const { world, actor, navigate, openMarket } = useGame();
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [produto, setProduto] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('preco');
  const [soRelevantes, setSoRelevantes] = useState(true);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [distancia, setDistancia] = useState('');
  const [preco, setPreco] = useState('');
  const [mostrar, setMostrar] = useState(PASSO);

  const base = useMemo(
    () =>
      ofertas
        .map((o) => {
          const e = world.establishments.find((x) => x.id === o.establishmentId)!;
          const p = world.properties.find((x) => x.id === e.propertyId)!;
          const bot = world.companies.find((c) => c.id === e.companyId)?.bot ?? false;
          return { o, e, p, bot, estoque: e.inventory[o.product] ?? 0 };
        })
        .filter((x) => x.estoque > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, ofertas],
  );

  const avaliacoes = useMemo(() => {
    const m = new Map<string, Avaliacao>();
    if (!aberta) return m;
    for (const { o, estoque } of base) {
      const q = quantidadeParaDestino(world, destino, o.product, estoque);
      const a = q > 0 ? avaliar(world, actor, o, destino, q) : undefined;
      if (a) m.set(o.id, a);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, base, destino.id]);

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const linhas = base
    .filter(
      ({ o, e, p, bot }) =>
        (!produto || o.product === produto) &&
        (!soRelevantes || !relevantes || produto || relevantes.has(o.product)) &&
        (!estado || p.state === estado) &&
        (!tipo || (tipo === 'bot') === bot) &&
        (!termo ||
          `${e.name} ${products[o.product].name} ${p.city}`
            .toLocaleLowerCase('pt-BR')
            .includes(termo)) &&
        (!preco || o.price <= Number(preco) * 100) &&
        (!distancia ||
          (avaliacoes.get(o.id)?.frete &&
            avaliacoes.get(o.id)!.frete!.distanceKm <= Number(distancia))),
    )
    .sort((a, b) => {
      const x = avaliacoes.get(a.o.id),
        y = avaliacoes.get(b.o.id);
      if (ordem === 'estoque') return b.estoque - a.estoque;
      if (!x || !y) return Number(Boolean(y)) - Number(Boolean(x));
      return ordem === 'perto'
        ? (x.frete?.distanceKm ?? 0) - (y.frete?.distanceKm ?? 0)
        : x.naPorta - y.naPorta;
    });
  const estados = [...new Set(world.properties.map((p) => p.state))];

  return (
    <details className="of-bloco" onToggle={(ev) => setAberta(ev.currentTarget.open)}>
      <summary>
        <IconePixel nome="pedido" tamanho={28} />
        <span>
          <b>Ver todas as ofertas</b>
          <small>Escolher a empresa e a transportadora na mão</small>
        </span>
      </summary>
      {aberta && (
        <div className="of-conteudo">
          <div className="of-filtros">
            <label className="of-busca">
              <span>Buscar</span>
              <input
                value={busca}
                placeholder="Empresa, produto ou cidade"
                onChange={(ev) => {
                  setBusca(ev.target.value);
                  setMostrar(PASSO);
                }}
              />
            </label>
            <Select
              label="Produto"
              value={produto}
              onChange={(ev) => {
                setProduto(ev.target.value);
                setMostrar(PASSO);
              }}
            >
              <option value="">Todos os produtos</option>
              {seasonProducts(world).map((id) => (
                <option key={id} value={id}>
                  {products[id].name}
                </option>
              ))}
            </Select>
            <div className="of-ordem" role="radiogroup" aria-label="Ordenar">
              {(
                [
                  ['preco', 'Mais barato'],
                  ['perto', 'Mais perto'],
                  ['estoque', 'Mais estoque'],
                ] as const
              ).map(([id, rotulo]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={ordem === id}
                  className={ordem === id ? 'on' : ''}
                  onClick={() => setOrdem(id)}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <details className="of-mais">
            <summary>Mais filtros</summary>
            <div className="of-mais-grade">
              {relevantes && (
                <label className="of-marca">
                  <input
                    type="checkbox"
                    checked={soRelevantes}
                    onChange={(ev) => setSoRelevantes(ev.target.checked)}
                  />
                  Só o que este destino usa
                </label>
              )}
              <Select
                label="Estado de origem"
                value={estado}
                onChange={(ev) => setEstado(ev.target.value)}
              >
                <option value="">Qualquer estado</option>
                {estados.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Select
                label="Tipo de empresa"
                value={tipo}
                onChange={(ev) => setTipo(ev.target.value)}
              >
                <option value="">Qualquer empresa</option>
                <option value="bot">Empresas automáticas</option>
                <option value="player">Empresas de jogadores</option>
              </Select>
              <label className="of-campo">
                <span>Distância máxima (km)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Sem limite"
                  value={distancia}
                  onChange={(ev) => setDistancia(ev.target.value)}
                />
              </label>
              <label className="of-campo">
                <span>Preço máximo por unidade (R$)</span>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  placeholder="Sem limite"
                  value={preco}
                  onChange={(ev) => setPreco(ev.target.value)}
                />
              </label>
            </div>
          </details>
          {linhas.length === 0 ? (
            <p className="of-vazio">Nenhuma oferta atende à busca. Tire um filtro para ver mais.</p>
          ) : (
            <ul className="of-lista">
              {linhas.slice(0, mostrar).map(({ o, e, p, estoque }) => {
                const a = avaliacoes.get(o.id);
                return (
                  <li
                    key={o.id}
                    className="of-linha"
                    style={{ ['--h' as string]: matizDoProduto(o.product) }}
                  >
                    <div className="of-arte">
                      <BotaoProduto product={o.product}>
                        <ProdutoArte product={o.product} escala={1} />
                      </BotaoProduto>
                    </div>
                    <div className="of-quem">
                      <strong>{e.name}</strong>
                      <small>
                        {products[o.product].name} · {p.city}, {p.state}
                        {a?.frete && ` · ${num(a.frete.distanceKm)} km`}
                      </small>
                    </div>
                    <div className="of-preco">
                      <b>{a?.frete ? cr(a.naPorta) : cr(o.price)}</b>
                      <small>{a?.frete ? 'na sua porta' : 'preço na origem · frete a consultar'}</small>
                    </div>
                    <div className="of-estoque">
                      <IconePixel nome="caixa" tamanho={22} />
                      {num(estoque)} {unidade(o.product, estoque)}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        openMarket({
                          product: o.product,
                          offerId: o.id,
                          quantity: a?.quantidade,
                          destinationId: destino.id,
                        });
                        navigate('logistics', true);
                      }}
                    >
                      Escolher esta empresa
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {linhas.length > mostrar && (
            <button className="secondary of-mais-botao" onClick={() => setMostrar(mostrar + PASSO)}>
              Mostrar mais ({linhas.length - mostrar})
            </button>
          )}
          <p className="of-nota">
            O preço &ldquo;na sua porta&rdquo; já inclui o frete mais barato. Para um pedido com
            prazo ou outra transportadora, escolha a empresa e siga para Entregas.
          </p>
        </div>
      )}
    </details>
  );
}
