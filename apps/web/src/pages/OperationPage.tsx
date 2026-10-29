import { useEffect, useState } from 'react';
import { BotaoProduto } from '../components/BotaoProduto';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { Tabs, Modal, Empty } from '../components/ui';
import { IconePixel } from '../components/IconePixel';
import { ProdutoArte } from '../features/economy/Vitrine';
import { matizDoProduto } from '../design/arte';
import { products, type ProductId } from '../../../../packages/simulation/src/model';
import { useClock } from '../lib/clock';
import { horasDeJogo } from '../features/inicio/tempo';
import { operatingCosts, productionCharges } from '../../../../packages/simulation/src/metrics';
import { freeCash } from '../../../../packages/simulation/src/design';
import { InfrastructureDetails } from '../components/InfrastructureDetails';
import { Abastecimento } from '../features/business/Abastecimento';
import { Stock } from '../features/business/Stock';
import { Workforce } from '../features/business/Workforce';
import { Installation } from '../features/business/Installation';
import { BusinessFinance } from '../features/business/Analytics';
import { Cabeca, Unidades } from '../features/business/producao/Cabeca';
import { Fluxo } from '../features/business/producao/Fluxo';
import { Fila } from '../features/business/producao/Fila';
import { Vendas } from '../features/business/producao/Vendas';
import { estadoDaUnidade, matizDaCategoria } from '../features/business/producao/pecas';
import {
  productionCapacity,
  productionQuality,
} from '../../../../packages/simulation/src/operations';
import '../design/producao.css';

export function OperationPage() {
  const now = useClock();
  const { world, actor, businessId, run, pending, navigate, openRepor } = useGame();
  const e =
    world.establishments.find((x) => x.id === businessId && x.companyId === actor) ??
    world.establishments.find((x) => x.companyId === actor && ['industry', 'farm', 'mine', 'warehouse'].includes(x.category));
  const [tab, setTab] = useState('Produção'),
    [recipeId, setRecipe] = useState('steel-bars'),
    [queue, setQueue] = useState(false),
    [cycles, setCycles] = useState(1);
  const [showCosts, setShowCosts] = useState(false);
  const [auto, setAuto] = useState(false),
    [autoCycles, setAutoCycles] = useState('1'),
    [budget, setBudget] = useState('10000');
  const options = world.season.config.recipes.filter((r) => r.category === e?.category),
    recipe = options.find((r) => r.id === recipeId) ?? options[0];
  useEffect(() => {
    setTab(e?.category === 'warehouse' ? 'Estoque' : 'Produção');
    setRecipe(e?.specialization ?? '');
    setQueue(false);
    setAuto(false);
    setShowCosts(false);
    setCycles(1);
    setAutoCycles(String(e?.automationCycles ?? 1));
    setBudget(String((e?.automationDailyBudget ?? 1000000) / 100));
  }, [e?.id]);
  if (!e)
    return (
      <Empty
        title="Nenhuma unidade de produção"
        description="Compre um imóvel industrial, rural ou de mineração no mapa para começar."
        action={
          <button className="primary" onClick={() => navigate('map')}>
            Explorar o mapa
          </button>
        }
      />
    );
  const p = world.properties.find((x) => x.id === e.propertyId)!;
  if (e.installed === false)
    return (
      <div className="prod">
        <Unidades atual={e.id} />
        <section
          className="prod-instalar"
          style={{ ['--h' as string]: matizDaCategoria[e.category] ?? 120 }}
        >
          <h1>{e.name}</h1>
          <p>
            O imóvel em {p.city} já é seu. Falta instalar os equipamentos, contratar a equipe e
            abastecer.
          </p>
        </section>
        <div className="prod-painel">
          <Installation establishment={e} onInstalled={() => setTab('Equipe')} />
        </div>
      </div>
    );

  const jobs = world.jobs.filter((j) => j.establishmentId === e.id && !j.completed);
  const charges = recipe ? productionCharges(world, e, recipe.id, cycles) : null;
  const line = recipe ? productionCapacity(world, e, recipe, cycles) : null;
  const line1 = recipe ? productionCapacity(world, e, recipe, 1) : null;
  const daily = operatingCosts(world, e);
  const estado = estadoDaUnidade(e, recipe, jobs, now, (id) => products[id as ProductId].name);
  const armazem = e.category === 'warehouse';
  const abas = armazem
    ? ['Estoque', 'Vendas', 'Equipe', 'Finanças', 'Abastecimento']
    : ['Produção', 'Vendas', 'Equipe', 'Finanças', 'Abastecimento'];
  const faltando = recipe
    ? (Object.entries(recipe.input) as [ProductId, number][]).filter(
        ([id, q]) => (e.inventory[id] ?? 0) < q * cycles,
      )
    : [];
  const ligarAuto = (ligar: boolean) =>
    run(
      {
        type: 'configureProduction',
        establishmentId: e.id,
        recipeId: e.specialization ?? recipe!.id,
        cycles: e.automationCycles ?? 1,
        dailyBudget: e.automationDailyBudget ?? 10000000,
        enabled: ligar,
      },
      ligar
        ? 'Produção automática ligada.'
        : 'Produção automática desligada. Lotes em andamento serão concluídos.',
    );
  const ciclosAuto = Number(autoCycles);
  const orcamentoAuto = Math.round(Number(budget) * 100);
  const espera = Math.max(0, ...jobs.map((j) => j.finishesAt - now));
  return (
    <div className="prod">
      <Unidades atual={e.id} />
      <Cabeca
        e={e}
        estado={estado}
        custoDia={daily.total}
        resultado={e.revenue - e.expenses}
        podeProduzir={!!recipe && (line1?.lines ?? 0) > 0}
        semLinha={!!recipe && (line1?.lines ?? 0) === 0}
        temReceita={!!recipe}
        onProduzir={() => setQueue(true)}
        onCustos={() => setShowCosts(true)}
      />
      <Tabs values={abas} value={tab} onChange={setTab} />
      <div className="prod-conteudo">
        {tab === 'Produção' && recipe && (
          <>
            <Fluxo
              e={e}
              receita={recipe}
              receitas={options}
              onReceita={setRecipe}
              linha={line1}
              onEquipe={() => setTab('Equipe')}
            />
            <Fila
              e={e}
              jobs={jobs}
              agora={now}
              podeProduzir={(line1?.lines ?? 0) > 0}
              onProduzir={() => setQueue(true)}
              onConfigurarAuto={() => setAuto(true)}
              onLigarAuto={(ligar) => void ligarAuto(ligar)}
            />
            <section className="prod-bloco" aria-labelledby="armazem-titulo">
              <h2 id="armazem-titulo">No armazém</h2>
              <Stock key={e.id} establishment={e} saidasOnly />
            </section>
          </>
        )}
        {tab === 'Estoque' && (
          <section className="prod-bloco" aria-labelledby="estoque-titulo">
            <h2 id="estoque-titulo">No armazém</h2>
            <Stock key={e.id} establishment={e} />
          </section>
        )}
        {tab === 'Vendas' && <Vendas key={e.id} establishment={e} />}
        {tab === 'Equipe' && (
          <div className="prod-painel">
            <Workforce key={e.id} establishment={e} />
          </div>
        )}
        {tab === 'Finanças' && (
          <div className="prod-painel">
            <BusinessFinance establishment={e} />
          </div>
        )}
        {tab === 'Abastecimento' && (
          <div className="prod-painel">
            <Abastecimento key={e.id} establishment={e} />
          </div>
        )}
      </div>

      {queue && recipe && line && charges && (
        <Modal title="Começar a produzir" onClose={() => setQueue(false)}>
          <div
            className="recibo"
            style={{ ['--h' as string]: matizDoProduto(Object.keys(recipe.output)[0]) }}
          >
            <header className="recibo-cab">
              <BotaoProduto product={Object.keys(recipe.output)[0] as ProductId}>
                <ProdutoArte product={Object.keys(recipe.output)[0] as ProductId} escala={2} />
              </BotaoProduto>
              <div>
                <h3>{recipe.name}</h3>
                <p>
                  {line.lines} {line.lines === 1 ? 'linha disponível' : 'linhas disponíveis'} de capacidade
                </p>
              </div>
            </header>

            <div className="recibo-ciclos" role="group" aria-label="Quantidade de ciclos">
              <span>Quantos ciclos?</span>
              <div>
                <button
                  type="button"
                  className="secondary"
                  aria-label="Menos um ciclo"
                  onClick={() => setCycles(Math.max(1, cycles - 1))}
                >
                  <Minus size={18} />
                </button>
                <input
                  aria-label="Ciclos"
                  type="number"
                  min="1"
                  max="100"
                  value={cycles}
                  onChange={(ev) =>
                    setCycles(Math.max(1, Math.min(100, Math.floor(Number(ev.target.value)) || 1)))
                  }
                />
                <button
                  type="button"
                  className="secondary"
                  aria-label="Mais um ciclo"
                  onClick={() => setCycles(Math.min(100, cycles + 1))}
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="recibo-atalhos">
                {[1, 5, 10, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={cycles === n ? 'on' : ''}
                    onClick={() => setCycles(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="recibo-grade">
              <section>
                <h4>
                  <IconePixel nome="caixa" tamanho={22} /> Gasta
                </h4>
                {Object.keys(recipe.input).length ? (
                  <ul>
                    {(Object.entries(recipe.input) as [ProductId, number][]).map(([id, q]) => {
                      const tem = e.inventory[id] ?? 0;
                      const falta = tem < q * cycles;
                      return (
                        <li key={id} className={falta ? 'falta' : ''}>
                          <span>{products[id].name}</span>
                          <b>
                            {num(q * cycles, 1)} {products[id].unit}
                          </b>
                          <small>
                            {falta ? `faltam ${num(q * cycles - tem, 1)}` : `tem ${num(tem, 1)}`}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="recibo-nota">Nada: a mina tira da própria reserva.</p>
                )}
              </section>
              <section>
                <h4>
                  <IconePixel nome="moeda" tamanho={22} /> Custa
                </h4>
                <b className="recibo-grande dinheiro">{cr(charges.total, 0)}</b>
                <small>
                  processamento {cr(charges.processing, 0)} · energia {cr(charges.energy, 0)} · água{' '}
                  {cr(charges.water, 0)}
                </small>
              </section>
              <section>
                <h4>
                  <IconePixel nome="prazo" tamanho={22} /> Leva
                </h4>
                <b className="recibo-grande">
                  {Number.isFinite(line.durationMs)
                    ? `~${num(Math.max(1, horasDeJogo(line.durationMs)))} h`
                    : '—'}
                </b>
                <small>{Number.isFinite(line.durationMs) ? 'de jogo' : line.bottleneck}</small>
                {espera > 0 && <small>Mais ~{num(Math.max(1, horasDeJogo(espera)))} h de jogo aguardando os lotes anteriores.</small>}
              </section>
              <section>
                <h4>
                  <IconePixel nome="estrela" tamanho={22} /> Rende
                </h4>
                {(Object.entries(recipe.output) as [ProductId, number][]).map(([id, q]) => (
                  <b key={id} className="recibo-grande bom">
                    {num(q * cycles, 1)} {products[id].unit}
                    <small> de {products[id].name}</small>
                  </b>
                ))}
                <small>qualidade {productionQuality(world, e, recipe)}</small>
              </section>
            </div>

            {faltando.length > 0 && (
              <p className="recibo-aviso">
                Faltam{' '}
                {faltando.map(([id]) => products[id].name.toLocaleLowerCase('pt-BR')).join(', ')}{' '}
                para este lote.
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setQueue(false);
                    openRepor({ destinationId: e.id, product: faltando[0][0] });
                  }}
                >
                  <ShoppingCart size={16} /> Mandar buscar
                </button>
              </p>
            )}
            <button
              className="primary full recibo-confirmar"
              disabled={pending || !e.enabled || !line.lines || faltando.length > 0 || freeCash(world, actor) < charges.total || (e.category === 'mine' && (e.reserve ?? 0) < cycles)}
              onClick={async () => {
                if (
                  await run(
                    { type: 'produce', establishmentId: e.id, recipeId: recipe.id, cycles },
                    'Produção começou. Insumos e custo já foram separados.',
                  )
                )
                  setQueue(false);
              }}
            >
              {pending ? 'Separando…' : 'Começar a produzir'}
            </button>
            <p className="recibo-nota">
              {freeCash(world, actor) < charges.total && 'Caixa livre insuficiente para este lote. '}
              {e.category === 'mine' && (e.reserve ?? 0) < cycles && 'Reserva mineral insuficiente para este lote. '}
              Os insumos saem do armazém agora e a produção chega quando o lote termina. A equipe
              fica ocupada até lá.
            </p>
          </div>
        </Modal>
      )}

      {auto && recipe && (
        <Modal
          title={e.category === 'mine' ? 'Extração passiva' : 'Produção automática'}
          onClose={() => setAuto(false)}
        >
          <div
            className="recibo"
            style={{ ['--h' as string]: matizDoProduto(Object.keys(recipe.output)[0]) }}
          >
            <header className="recibo-cab">
              <BotaoProduto product={Object.keys(recipe.output)[0] as ProductId}>
                <ProdutoArte product={Object.keys(recipe.output)[0] as ProductId} escala={2} />
              </BotaoProduto>
              <div>
                <h3>{recipe.name}</h3>
                <p>A unidade repete este lote sozinha a cada rodada.</p>
              </div>
            </header>
            <label className="recibo-campo">
              <span>Ciclos por lote</span>
              <input
                aria-label="Ciclos automáticos"
                type="number"
                min="1"
                max="100"
                value={autoCycles}
                onChange={(ev) => setAutoCycles(ev.target.value)}
              />
            </label>
            <label className="recibo-campo">
              <span>Quanto pode gastar por dia de jogo (R$)</span>
              <input
                aria-label="Orçamento diário de produção"
                type="number"
                min="0.01"
                step="0.01"
                value={budget}
                onChange={(ev) => setBudget(ev.target.value)}
              />
            </label>
            <p className="recibo-nota">
              Esse limite cobre processamento, energia e água. Os insumos vêm do Abastecimento, que
              tem orçamento próprio. Se faltar insumo, caixa ou equipe, a unidade espera.
            </p>
            <button
              className="primary full recibo-confirmar"
              disabled={
                pending ||
                !Number.isInteger(ciclosAuto) ||
                ciclosAuto < 1 ||
                ciclosAuto > 100 ||
                !Number.isSafeInteger(orcamentoAuto) ||
                orcamentoAuto < 1 ||
                orcamentoAuto > 1000000000 ||
                !!e.mothballed
              }
              onClick={async () => {
                if (
                  await run(
                    {
                      type: 'configureProduction',
                      establishmentId: e.id,
                      recipeId: recipe.id,
                      cycles: ciclosAuto,
                      dailyBudget: orcamentoAuto,
                      enabled: true,
                    },
                    'Automação ligada com o limite diário.',
                  )
                )
                  setAuto(false);
              }}
            >
              Salvar e ligar
            </button>
            {e.automation && (
              <button
                className="secondary full"
                disabled={pending}
                onClick={async () => {
                  if (await ligarAuto(false)) setAuto(false);
                }}
              >
                Desligar automação
              </button>
            )}
          </div>
        </Modal>
      )}
      {showCosts && <InfrastructureDetails property={p} onClose={() => setShowCosts(false)} />}
    </div>
  );
}
