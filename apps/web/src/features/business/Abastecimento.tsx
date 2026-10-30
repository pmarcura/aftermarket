import { useId, useMemo, useState } from 'react';
import { BotaoProduto } from '../../components/BotaoProduto';
import { Minus, Plus, ShoppingCart, Truck, Repeat } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { EstadoEstoque } from '../../components/EstadoEstoque';
import { IconePixel } from '../../components/IconePixel';
import { matizDoProduto } from '../../design/arte';
import { BarraEstoque, ChaveEstoque } from '../../components/BarraEstoque';
import { CargaCaminho } from '../../components/CargaCaminho';
import { FleetPicker } from '../../components/FleetPicker';
import { ProdutoArte } from '../economy/Vitrine';
import { TransferStock } from './TransferStock';
import { contaDaPrateleira } from './precificacao';
import {
  products,
  seasonProducts,
  type Establishment,
  type ProductId,
  type SupplyPolicy,
  type SupplyRule,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import { dailyNeed, supplyForecast } from '../../../../../packages/simulation/src/supply';
import { loadOf } from '../../../../../packages/simulation/src/engine';
import '../../design/abastecimento.css';

type Linha = ReturnType<typeof supplyForecast>['rows'][number];

/** Campo numérico com − e +, para ajustar sem digitar. Aceita centavos com casas={2}. */
function Passo({
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 1_000_000,
  passo = 1,
  casas = 0,
  unidade,
  dica,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  casas?: number;
  unidade?: string;
  /** Texto que repete o valor já formatado, por exemplo "R$ 100.000". */
  dica?: string;
}) {
  const id = useId();
  const fator = 10 ** casas;
  const ajustar = (v: number) =>
    onChange(Math.min(max, Math.max(min, Math.round(v * fator) / fator)));
  return (
    <div className="abs-passo">
      <label htmlFor={id}>{rotulo}</label>
      <div>
        <button
          type="button"
          className="secondary"
          aria-label={`Diminuir: ${rotulo}`}
          onClick={() => ajustar(valor - passo)}
        >
          <Minus size={16} />
        </button>
        <input
          id={id}
          type="number"
          inputMode={casas ? 'decimal' : 'numeric'}
          min={min}
          max={max}
          step={casas ? 1 / fator : 1}
          value={valor}
          onChange={(ev) => ajustar(Number(ev.target.value))}
        />
        <button
          type="button"
          className="secondary"
          aria-label={`Aumentar: ${rotulo}`}
          onClick={() => ajustar(valor + passo)}
        >
          <Plus size={16} />
        </button>
        {unidade && <em>{unidade}</em>}
      </div>
      {dica && <small className="abs-dica-valor">{dica}</small>}
    </div>
  );
}

/** Interruptor de pixel: o estado aparece em texto, não só na cor. */
function Interruptor({
  ligado,
  onChange,
  rotulo,
  desabilitado,
}: {
  ligado: boolean;
  onChange: () => void;
  rotulo: string;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      className={`abs-chave ${ligado ? 'ligado' : ''}`}
      onClick={onChange}
    >
      <i aria-hidden="true" />
      <span>{ligado ? 'Ligado' : 'Desligado'}</span>
    </button>
  );
}

function CartaoAutomatico({
  e,
  rule,
  linha,
  dias,
  pendente,
  ativo,
  onRepor,
  onSalvar,
  onRemover,
}: {
  e: Establishment;
  rule: SupplyRule;
  linha: Linha;
  dias: number;
  pendente: boolean;
  ativo: boolean;
  onRepor: () => void;
  onSalvar: (r: SupplyRule, msg: string) => void;
  onRemover: () => void;
}) {
  const { world } = useGame();
  const [r, setR] = useState(rule);
  const unidade = products[rule.product].unit;
  const mudou =
    r.minimum !== rule.minimum ||
    r.target !== rule.target ||
    r.maxBuy !== rule.maxBuy ||
    r.maxPrice !== rule.maxPrice;
  const valido =
    Number.isInteger(r.minimum) && r.minimum >= 0 && r.minimum < r.target && r.maxBuy > 0;
  const passo = Math.max(1, Math.round(r.target / 20));
  const proprias = world.establishments.filter((x) => x.companyId === e.companyId && x.id !== e.id);
  return (
    <article
      className={`item abs-item ${ativo ? '' : 'pausado'}`}
      style={{ ['--h' as string]: matizDoProduto(rule.product) }}
    >
      <header className="item-hero">
        <div className="item-arte">
          <BotaoProduto product={rule.product}>
            <ProdutoArte product={rule.product} escala={3} />
          </BotaoProduto>
        </div>
        <div className="item-ident">
          <h3>
            <BotaoProduto product={rule.product}>{products[rule.product].name}</BotaoProduto>
          </h3>
          <EstadoEstoque estoque={linha.current} dias={dias} />
          <dl className="item-fatos">
            <div>
              <IconePixel nome="caixa" tamanho={22} />
              <dt>No armazém</dt>
              <dd>
                {num(linha.current)} {unidade}
              </dd>
            </div>
            <div>
              <dt>Consumo</dt>
              <dd>
                {num(linha.need, 1)} {unidade} por dia
              </dd>
            </div>
          </dl>
        </div>
        <button type="button" className="item-repor secondary" onClick={onRepor}>
          <ShoppingCart size={18} /> Mandar buscar
        </button>
      </header>
      <div className="item-corpo abs-corpo">
        {!ativo && (
          <p className="abs-pausa">
            <b>Pausado.</b> O abastecimento automático está desligado: nada será comprado até você
            ligar.
          </p>
        )}
        <BarraEstoque
          fisico={linha.current}
          aCaminho={linha.incoming}
          pedido={linha.promised}
          minimo={r.minimum}
          alvo={r.target}
          unidade={unidade}
        />
        <div className="abs-regra">
          <Passo
            rotulo="Repor quando cair a"
            valor={r.minimum}
            passo={passo}
            max={Math.max(0, r.target - 1)}
            unidade={unidade}
            onChange={(v) => setR({ ...r, minimum: v })}
          />
          <Passo
            rotulo="Encher até"
            valor={r.target}
            passo={passo}
            min={1}
            unidade={unidade}
            onChange={(v) => setR({ ...r, target: v, maxBuy: Math.max(r.maxBuy, v - r.minimum) })}
          />
          <label className="abs-origem">
            <span>De onde vem</span>
            <select
              value={r.originId ?? ''}
              onChange={(ev) =>
                onSalvar(
                  { ...rule, originId: ev.target.value || undefined },
                  `Origem de ${products[rule.product].name} atualizada.`,
                )
              }
            >
              <option value="">Melhor oferta (segue as regras gerais)</option>
              {proprias.map((x) => (
                <option key={x.id} value={x.id}>
                  Minha unidade: {x.name} ({num(x.inventory[rule.product] ?? 0)} {unidade})
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={`abs-plano ${linha.want > 0 && !linha.best ? 'sem' : ''}`}>
          {linha.want > 0
            ? linha.best
              ? `${ativo ? 'Próxima reposição' : 'Quando ligar'}: ${linha.best.internal ? 'transferir de' : 'comprar de'} ${linha.best.origin.name}, ${num(linha.best.quantity)} ${unidade} por ${cr(linha.best.total, 0)}, ${linha.best.q.parts.length} ${linha.best.q.parts.length === 1 ? 'caminhão' : 'caminhões'}.`
              : 'Ninguém atende às regras agora. Aumente a distância, o preço máximo ou escolha outra origem.'
            : pendente
              ? 'Já há pedido ou carga a caminho. Nada a repor agora.'
              : 'Estoque dentro da regra. Nada a repor agora.'}
        </p>
        <details className="abs-limites">
          <summary>Limites deste produto</summary>
          <div className="abs-regra">
            <Passo
              rotulo="Máximo por compra"
              valor={r.maxBuy}
              min={1}
              passo={passo}
              unidade={unidade}
              onChange={(v) => setR({ ...r, maxBuy: v })}
            />
            <Passo
              rotulo="Preço máximo por unidade (R$, 0 = sem limite)"
              valor={r.maxPrice / 100}
              passo={0.5}
              casas={2}
              onChange={(v) => setR({ ...r, maxPrice: Math.round(v * 100) })}
            />
          </div>
        </details>
        <footer>
          {!valido && (
            <span className="abs-erro">O valor de repor precisa ser menor que o de encher.</span>
          )}
          <button type="button" className="text-button" onClick={onRemover}>
            Parar de automatizar
          </button>
          <button
            type="button"
            className="primary"
            disabled={!mudou || !valido}
            onClick={() => onSalvar(r, `Regra de ${products[rule.product].name} salva.`)}
          >
            {mudou ? 'Salvar mudanças' : 'Salvo'}
          </button>
        </footer>
      </div>
    </article>
  );
}

/**
 * Abastecimento de uma unidade, num só lugar. Cada produto está em um de dois modos:
 * manual (você repõe quando quiser) ou automático (a regra repõe sozinha entre um mínimo e um alvo).
 * Quem fornece, quanto gasta e como transporta são regras gerais, recolhidas.
 */
export function Abastecimento({ establishment: e }: { establishment: Establishment }) {
  const { world, run, pending, openRepor, navigate } = useGame();
  const salva = e.supplyPolicy;
  const politica = useMemo<SupplyPolicy>(
    () => salva ?? { ...defaultSupplyPolicy(world, e), rules: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [salva, e.id],
  );
  const previsao = useMemo(
    () => supplyForecast(world, e, politica),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id, politica],
  );
  const conta = useMemo(
    () => (e.category === 'retail' ? contaDaPrateleira(world, e) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id],
  );
  const [mover, setMover] = useState<ProductId>();
  const [geral, setGeral] = useState(politica);
  const [frota, setFrota] = useState(false);

  const dias = (id: ProductId) => {
    const estoque = e.inventory[id] ?? 0;
    if (conta) return conta.itens.find((x) => x.id === id)?.dias ?? (estoque > 0 ? Infinity : 0);
    const need = dailyNeed(world, e, id);
    return need > 0 ? estoque / need : estoque > 0 ? Infinity : 0;
  };
  const salvar = (proxima: SupplyPolicy, mensagem: string) =>
    run({ type: 'configureSupply', establishmentId: e.id, policy: proxima }, mensagem);
  const modelo = (id: ProductId): SupplyRule =>
    defaultSupplyPolicy(world, e).rules.find((r) => r.product === id) ?? {
      product: id,
      minimum: 10,
      target: 100,
      maxBuy: 100,
      maxPrice: Math.round(world.season.config.basePrices[id] * 1.5),
    };
  const automatizar = (id: ProductId) =>
    salvar(
      {
        ...politica,
        enabled: politica.rules.length === 0 ? true : politica.enabled,
        rules: [...politica.rules, modelo(id)],
      },
      `${products[id].name} agora é abastecido sozinho.`,
    );
  const emRegra = new Set(politica.rules.map((r) => r.product));
  const receita = world.season.config.recipes.find((r) => r.id === e.specialization);
  const manuais = [
    ...new Set([
      ...(e.category === 'retail' ? (Object.keys(e.inventory) as ProductId[]) : []),
      ...((Object.keys(receita?.input ?? {}) as ProductId[]) ?? []),
    ]),
  ].filter((id) => !emRegra.has(id));
  const outros = seasonProducts(world).filter((id) => !emRegra.has(id) && !manuais.includes(id));

  const cargas = world.shipments
    .filter((s) => s.destinationId === e.id && !s.delivered)
    .sort((a, b) => a.arrivesAt - b.arrivesAt);
  const pedidos = world.orders.filter((o) => o.destinationId === e.id && o.status === 'pending');
  const { mass, volume } = loadOf(e.inventory);
  const ocupacao = Math.min(
    1,
    Math.max(e.capacityT ? mass / e.capacityT : 0, e.capacityM3 ? volume / e.capacityM3 : 0),
  );
  const gasto = previsao.spent.executed;
  const orcamento = politica.dailyBudget;
  const blocosGasto = Math.min(20, Math.round((gasto / Math.max(1, orcamento)) * 20));
  const geralMudou =
    JSON.stringify({ ...geral, rules: 0 }) !== JSON.stringify({ ...politica, rules: 0 });
  const set = <K extends keyof SupplyPolicy>(k: K, v: SupplyPolicy[K]) =>
    setGeral((g) => ({ ...g, [k]: v }));
  const origemTexto = {
    'internal-first': 'Minhas unidades primeiro, depois o mercado',
    'internal-only': 'Só minhas unidades',
    market: 'Só fornecedores do mercado',
  } as const;

  return (
    <div className="abs">
      <section className="abs-topo" aria-labelledby="abs-titulo">
        <div className="abs-topo-chave">
          <div>
            <h2 id="abs-titulo">Abastecimento automático</h2>
            <p>
              {politica.enabled
                ? (e.supplyStatus ??
                  'Ligado. As regras abaixo repõem o estoque sozinhas a cada rodada.')
                : 'Desligado. Nada é comprado sozinho; repor é com você.'}
            </p>
          </div>
          <Interruptor
            ligado={politica.enabled}
            rotulo="Abastecimento automático"
            desabilitado={pending || (!politica.enabled && politica.rules.length === 0)}
            onChange={() =>
              salvar(
                { ...politica, enabled: !politica.enabled },
                politica.enabled
                  ? 'Abastecimento automático desligado.'
                  : 'Abastecimento automático ligado.',
              )
            }
          />
        </div>
        {!politica.enabled && politica.rules.length === 0 && (
          <p className="abs-dica">
            Escolha um produto em &ldquo;Repor você mesmo&rdquo; e toque em Automatizar para
            começar.
          </p>
        )}
        <dl className="abs-numeros">
          <div>
            <dt>Gasto hoje</dt>
            <dd>
              {cr(gasto, 0)} <small>de {cr(orcamento, 0)}</small>
            </dd>
            <span
              className="abs-medidor"
              role="img"
              aria-label={`${Math.round((gasto / Math.max(1, orcamento)) * 100)}% do orçamento do dia`}
            >
              {Array.from({ length: 20 }, (_, i) => (
                <i key={i} className={i < blocosGasto ? (blocosGasto > 17 ? 'alto' : 'ok') : ''} />
              ))}
            </span>
          </div>
          <div>
            <dt>Reposição indicada agora</dt>
            <dd>{cr(previsao.cashNeeded, 0)}</dd>
          </div>
          <div>
            <dt>Armazém ocupado</dt>
            <dd>{Math.round(ocupacao * 100)}%</dd>
            <span
              className="abs-medidor"
              role="img"
              aria-label={`Armazém ${Math.round(ocupacao * 100)}% cheio`}
            >
              {Array.from({ length: 20 }, (_, i) => (
                <i
                  key={i}
                  className={i < Math.round(ocupacao * 20) ? (ocupacao > 0.9 ? 'alto' : 'ok') : ''}
                />
              ))}
            </span>
          </div>
        </dl>
      </section>

      <section className="abs-bloco" aria-labelledby="abs-auto">
        <h2 id="abs-auto">
          Repostos sozinhos <span className="abs-conta">{politica.rules.length}</span>
        </h2>
        {politica.rules.length > 0 && <ChaveEstoque />}
        {politica.rules.length === 0 ? (
          <p className="abs-vazio">Nenhum produto automático ainda.</p>
        ) : (
          <div className="abs-cartoes">
            {politica.rules.map((rule, i) => (
              <CartaoAutomatico
                key={`${rule.product}-${rule.minimum}-${rule.target}-${rule.maxBuy}-${rule.maxPrice}-${rule.originId ?? ''}`}
                ativo={politica.enabled}
                onRepor={() => openRepor({ destinationId: e.id, product: rule.product })}
                e={e}
                rule={rule}
                linha={previsao.rows[i]}
                dias={dias(rule.product)}
                pendente={previsao.rows[i].incoming + previsao.rows[i].promised > 0}
                onSalvar={(nova, msg) =>
                  salvar(
                    { ...politica, rules: politica.rules.map((x, n) => (n === i ? nova : x)) },
                    msg,
                  )
                }
                onRemover={() =>
                  salvar(
                    {
                      ...politica,
                      enabled: politica.enabled && politica.rules.length > 1,
                      rules: politica.rules.filter((_, n) => n !== i),
                    },
                    `${products[rule.product].name} voltou para o modo manual.`,
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="abs-bloco" aria-labelledby="abs-manual">
        <h2 id="abs-manual">
          Repor você mesmo <span className="abs-conta">{manuais.length}</span>
        </h2>
        {manuais.length > 0 && (
          <ul className="abs-manuais">
            {manuais.map((id) => {
              const d = dias(id);
              const origensProprias = world.establishments.some(
                (x) => x.companyId === e.companyId && x.id !== e.id && (x.inventory[id] ?? 0) > 0,
              );
              return (
                <li key={id}>
                  <article
                    className="item item-compacto"
                    style={{ ['--h' as string]: matizDoProduto(id) }}
                  >
                    <header className="item-hero">
                      <div className="item-arte">
                        <BotaoProduto product={id}>
                          <ProdutoArte product={id} escala={2} />
                        </BotaoProduto>
                      </div>
                      <div className="item-ident">
                        <h3>
                          <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                        </h3>
                        <EstadoEstoque estoque={e.inventory[id] ?? 0} dias={d} />
                        <dl className="item-fatos">
                          <div>
                            <IconePixel nome="caixa" tamanho={22} />
                            <dt>No armazém</dt>
                            <dd>
                              {num(e.inventory[id] ?? 0)} {products[id].unit}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="abs-manual-acoes">
                        <button
                          type="button"
                          className={d < 3 ? 'primary' : 'secondary'}
                          onClick={() => openRepor({ destinationId: e.id, product: id })}
                        >
                          <ShoppingCart size={16} /> Mandar buscar
                        </button>
                        {origensProprias && (
                          <button type="button" className="secondary" onClick={() => setMover(id)}>
                            <Repeat size={16} /> Trazer de outra unidade
                          </button>
                        )}
                        <button
                          type="button"
                          className="secondary"
                          disabled={pending}
                          onClick={() => automatizar(id)}
                        >
                          Automatizar
                        </button>
                      </div>
                    </header>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        {outros.length > 0 && (
          <div className="abs-outros">
            <h3>Quer repor mais algum produto?</h3>
            <ul>
              {outros.map((id) => (
                <li key={id}>
                  <button type="button" disabled={pending} onClick={() => automatizar(id)}>
                    <ProdutoArte product={id} escala={1} />
                    <strong>{products[id].name}</strong>
                    <span>
                      <Plus size={14} /> Automatizar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="abs-bloco" aria-labelledby="abs-caminho">
        <h2 id="abs-caminho">
          A caminho <span className="abs-conta">{cargas.length}</span>
        </h2>
        {cargas.length ? (
          <ul className="cam-lista">
            {cargas.slice(0, 6).map((s) => (
              <CargaCaminho key={s.id} s={s} world={world} />
            ))}
          </ul>
        ) : (
          <p className="abs-vazio">
            <Truck size={14} aria-hidden="true" /> Nenhuma carga na estrada para esta unidade.
          </p>
        )}
        {pedidos.length > 0 && (
          <div className="abs-pedidos">
            <p>
              <b>{pedidos.length}</b> {pedidos.length === 1 ? 'pedido espera' : 'pedidos esperam'}{' '}
              resposta de fornecedores.
            </p>
            <button type="button" className="secondary" onClick={() => navigate('orders')}>
              Ver pedidos
            </button>
          </div>
        )}
      </section>

      <details className="abs-geral">
        <summary>
          <span>Regras gerais de compra</span>
          <small>quanto gastar, de onde comprar e como transportar</small>
        </summary>
        <div className="abs-geral-grade">
          <fieldset>
            <legend>Quanto gastar</legend>
            <Passo
              dica={cr(geral.dailyBudget, 0)}
              rotulo="Orçamento por dia (R$)"
              valor={geral.dailyBudget / 100}
              passo={100}
              min={1}
              onChange={(v) => set('dailyBudget', v * 100)}
            />
            <Passo
              dica={cr(geral.cashReserve, 0)}
              rotulo="Caixa que não pode ser tocado (R$)"
              valor={geral.cashReserve / 100}
              passo={100}
              onChange={(v) => set('cashReserve', v * 100)}
            />
          </fieldset>
          <fieldset>
            <legend>De onde comprar</legend>
            <div className="abs-opcoes" role="radiogroup" aria-label="Origem do abastecimento">
              {(Object.keys(origemTexto) as (keyof typeof origemTexto)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={geral.source === k}
                  className={geral.source === k ? 'on' : ''}
                  onClick={() => set('source', k)}
                >
                  {origemTexto[k]}
                </button>
              ))}
            </div>
            <Passo
              rotulo="Distância máxima (km)"
              valor={geral.maxDistanceKm}
              passo={50}
              min={1}
              max={6000}
              onChange={(v) => set('maxDistanceKm', v)}
            />
            <Passo
              rotulo="Qualidade mínima (0 a 100)"
              valor={geral.minQuality}
              passo={5}
              max={100}
              onChange={(v) => set('minQuality', v)}
            />
          </fieldset>
          <fieldset>
            <legend>Como transportar</legend>
            <div className="abs-opcoes" role="radiogroup" aria-label="Transporte">
              <button
                type="button"
                role="radio"
                aria-checked={geral.carrierId === 'auto'}
                className={geral.carrierId === 'auto' ? 'on' : ''}
                onClick={() => set('carrierId', 'auto')}
              >
                Melhor frete disponível
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={geral.carrierId === 'own'}
                className={geral.carrierId === 'own' ? 'on' : ''}
                onClick={() => set('carrierId', 'own')}
              >
                Só a minha frota
              </button>
            </div>
            <Passo
              dica={geral.maxFreightPerUnit ? cr(geral.maxFreightPerUnit) : 'sem limite'}
              rotulo="Frete máximo por unidade (R$, 0 = sem limite)"
              valor={geral.maxFreightPerUnit / 100}
              passo={1}
              onChange={(v) => set('maxFreightPerUnit', v * 100)}
            />
            {politica.rules[0] && (
              <>
                <button type="button" className="text-button" onClick={() => setFrota(!frota)}>
                  {frota ? 'Esconder' : 'Comparar'} frotas para{' '}
                  {products[politica.rules[0].product].name}
                </button>
                {frota && (
                  <FleetPicker
                    originId={politica.rules[0].originId ?? previsao.rows[0]?.best?.origin.id}
                    destinationId={e.id}
                    product={politica.rules[0].product}
                    quantity={previsao.rows[0]?.best?.quantity ?? politica.rules[0].maxBuy}
                    value={geral.carrierId === 'own' ? e.companyId : geral.carrierId}
                    onChange={(id) => set('carrierId', id)}
                    label="Frota de abastecimento"
                  />
                )}
              </>
            )}
          </fieldset>
          <fieldset>
            <legend>Forma de compra</legend>
            <div className="abs-opcoes" role="radiogroup" aria-label="Forma de compra">
              <button
                type="button"
                role="radio"
                aria-checked={geral.purchaseMode === 'immediate'}
                className={geral.purchaseMode === 'immediate' ? 'on' : ''}
                onClick={() => set('purchaseMode', 'immediate')}
              >
                Comprar a oferta na hora
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={geral.purchaseMode === 'request'}
                className={geral.purchaseMode === 'request' ? 'on' : ''}
                onClick={() => set('purchaseMode', 'request')}
              >
                Enviar pedido para o fornecedor aceitar
              </button>
            </div>
            <label className="abs-marca">
              <input
                type="checkbox"
                checked={geral.reserveOrders ?? false}
                onChange={(ev) => set('reserveOrders', ev.target.checked)}
              />
              Separar o dinheiro dos pedidos até o aceite ou o vencimento
            </label>
          </fieldset>
        </div>
        <div className="abs-geral-salvar">
          <button
            type="button"
            className="text-button"
            disabled={!geralMudou}
            onClick={() => setGeral(politica)}
          >
            Descartar
          </button>
          <button
            type="button"
            className="primary"
            disabled={!geralMudou || pending || geral.dailyBudget <= 0}
            onClick={() =>
              salvar(
                { ...politica, ...geral, rules: politica.rules, enabled: politica.enabled },
                'Regras gerais salvas.',
              )
            }
          >
            Salvar regras gerais
          </button>
        </div>
      </details>

      {mover && (
        <TransferStock destinationId={e.id} product={mover} onClose={() => setMover(undefined)} />
      )}
    </div>
  );
}
