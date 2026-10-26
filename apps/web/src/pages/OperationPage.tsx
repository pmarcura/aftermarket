import { useEffect, useState } from 'react';
import { Plus, Search, ArrowRight, Pause, Play, Box, Settings2, Tag } from 'lucide-react';
import { useGame, CategoryIcon, cr, num } from '../lib/game';
import {
  Badge,
  PageHeading,
  Panel,
  Tabs,
  Rows,
  Progress,
  Modal,
  Select,
  Empty,
} from '../components/ui';
import { products, TIME_SCALE, type ProductId } from '../../../../packages/simulation/src/model';
import { loadOf } from '../../../../packages/simulation/src/engine';
import { useClock } from '../lib/clock';
import {
  operatingCosts,
  productionCharges,
  seasonPrice,
} from '../../../../packages/simulation/src/metrics';
import { InfrastructureDetails } from '../components/InfrastructureDetails';

export function OperationPage() {
  const now = useClock();
  const { world, actor, businessId, openBusiness, run, pending, navigate, openMarket } = useGame();
  const e =
    world.establishments.find((x) => x.id === businessId && x.companyId === actor) ??
    world.establishments.find((x) => x.companyId === actor && x.category === 'industry');
  const [tab, setTab] = useState('Produção'),
    [recipeId, setRecipe] = useState('steel-bars'),
    [queue, setQueue] = useState(false),
    [cycles, setCycles] = useState(1),
    [offerProduct, setOfferProduct] = useState<ProductId>(),
    [price, setPrice] = useState(0);
  const [showCosts, setShowCosts] = useState(false);
  const options = world.season.config.recipes.filter((r) => r.category === e?.category),
    recipe = options.find((r) => r.id === recipeId) ?? options[0];
  useEffect(() => {
    setTab(e?.category === 'warehouse' ? 'Estoque' : 'Produção');
  }, [e?.id]);
  if (!e)
    return (
      <Empty
        title="Nenhuma operação produtiva"
        description="Adquira uma propriedade industrial, rural ou extrativa para iniciar."
        action={
          <button className="primary" onClick={() => navigate('map')}>
            Explorar o mapa
          </button>
        }
      />
    );
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    jobs = world.jobs.filter((j) => j.establishmentId === e.id && !j.completed),
    load = loadOf(e.inventory);
  const producers = world.establishments.filter(
    (x) => x.companyId === actor && x.category !== 'retail' && x.category !== 'logistics',
  );
  const entries = world.ledger
    .filter((x) => x.establishmentId === e.id)
    .slice(-20)
    .reverse();
  const stock = Object.entries(e.inventory) as [ProductId, number][];
  const charges = recipe ? productionCharges(world, e, recipe.id, cycles) : null;
  const daily = operatingCosts(world, e);
  const sell = (product: ProductId) => {
    setOfferProduct(product);
    setPrice(seasonPrice(world, product));
  };
  return (
    <>
      <PageHeading
        eyebrow={`Meus Negócios / ${e.name}`}
        title={
          e.category === 'industry'
            ? 'Operação industrial'
            : e.category === 'mine'
              ? 'Operação extrativa'
              : e.category === 'farm'
                ? 'Operação agrícola'
                : 'Armazenagem e distribuição'
        }
        description="Gerencie insumos, estoques e capacidade de seus estabelecimentos."
      />
      <div className="page-body operation-grid">
        <Panel
          title="Estabelecimentos"
          action={<Badge tone="muted">{producers.length} unidades</Badge>}
          className="producer-list"
        >
          {producers.map((item) => {
            const location = world.properties.find((x) => x.id === item.propertyId)!;
            return (
              <button
                className={`producer-item ${item.id === e.id ? 'selected' : ''}`}
                key={item.id}
                onClick={() => openBusiness(item.id)}
              >
                <div className="table-name">
                  <i className="table-icon">
                    <CategoryIcon category={item.category} />
                  </i>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {location.city} — {location.state}
                    </small>
                  </div>
                </div>
                <p>
                  {item.enabled ? 'Operação ativa' : 'Operação pausada'} ·{' '}
                  {num(loadOf(item.inventory).mass, 1)} t em estoque
                </p>
              </button>
            );
          })}
          <div className="panel-content">
            <button className="secondary full" onClick={() => navigate('businesses')}>
              Ver todos os negócios
            </button>
          </div>
        </Panel>
        <Panel
          title={e.name}
          subtitle={`${p.city} — ${p.state} · ${e.category === 'industry' ? 'Produção e transformação' : 'Operação empresarial'}`}
          action={
            <Badge tone={e.enabled ? 'green' : 'gold'}>
              {e.enabled ? (jobs.length ? 'Produzindo' : 'Operacional') : 'Pausado'}
            </Badge>
          }
          className="operation-main"
        >
          <Tabs
            values={
              e.category === 'warehouse'
                ? ['Estoque', 'Vendas', 'Funcionários']
                : ['Produção', 'Insumos', 'Estoque', 'Vendas', 'Funcionários']
            }
            value={tab}
            onChange={setTab}
          />
          {tab === 'Produção' && recipe && (
            <div className="panel-content production-content">
              <div className="section-title">
                <h3>Receita ativa</h3>
                <Select
                  label="Receita de produção"
                  value={recipe.id}
                  onChange={(event) => setRecipe(event.target.value)}
                >
                  {options.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="recipe-diagram">
                <div>
                  <i className="large-table-icon">
                    <CategoryIcon category={e.category} size={28} />
                  </i>
                  <h3>
                    {Object.keys(recipe.input).length
                      ? Object.entries(recipe.input)
                          .map(
                            ([id, q]) =>
                              `${q} ${products[id as ProductId].unit} ${products[id as ProductId].name}`,
                          )
                          .join(' + ')
                      : 'Depósito mineral virtual'}
                  </h3>
                  <p>
                    {e.category === 'mine'
                      ? `Reserva remanescente: ${num(e.reserve ?? 0)} t`
                      : 'Materiais consumidos por ciclo'}
                  </p>
                  <small>
                    Consumo: {num(recipe.energyKwh)} kWh + {num(recipe.waterM3, 1)} m³ por ciclo
                  </small>
                </div>
                <div className="recipe-arrow">
                  <ArrowRight size={32} />
                  <small>{num((recipe.duration * TIME_SCALE) / 3600000, 1)} h / ciclo</small>
                </div>
                <div>
                  <i className="large-table-icon gold">
                    <Box size={28} />
                  </i>
                  <h3>{recipe.name}</h3>
                  <p>Saída estimada</p>
                  <strong>
                    {Object.entries(recipe.output)
                      .map(([id, q]) => `${q} ${products[id as ProductId].unit}`)
                      .join(' + ')}
                  </strong>
                  <small>por ciclo concluído</small>
                </div>
              </div>
              <div className="section-title">
                <h3>Fila de produção</h3>
                <button className="primary" disabled={!e.enabled} onClick={() => setQueue(true)}>
                  <Plus size={17} /> Adicionar produção
                </button>
              </div>
              {jobs.length ? (
                jobs.map((j) => {
                  const r = world.season.config.recipes.find((r) => r.id === j.recipeId)!,
                    progress = ((now - j.startedAt) / (j.finishesAt - j.startedAt)) * 100;
                  return (
                    <div className="job-row" key={j.id}>
                      <i className="table-icon">
                        <Box size={16} />
                      </i>
                      <div>
                        <div className="job-label">
                          <strong>
                            {r.name} ·{' '}
                            {Object.entries(r.output)
                              .map(
                                ([id, q]) =>
                                  `${num(q! * j.cycles)} ${products[id as ProductId].unit}`,
                              )
                              .join(', ')}
                          </strong>
                          <small>
                            {now < j.startedAt
                              ? 'Na fila'
                              : `${Math.max(0, Math.ceil((j.finishesAt - now) / 1000))} s reais restantes`}
                          </small>
                        </div>
                        <Progress value={progress} color="blue" />
                      </div>
                      <Badge tone={now < j.startedAt ? 'gold' : 'green'}>
                        {now < j.startedAt ? 'Pendente' : 'Ativo'}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <Empty
                  title="Sua linha está pronta"
                  description="Adicione uma produção. Os materiais e custos serão reservados antes do início do ciclo."
                />
              )}
              <div className="operation-bottom">
                <button className="secondary" onClick={() => setQueue(true)} disabled={!e.enabled}>
                  <Settings2 size={16} /> Configurar produção
                </button>
                <button
                  className="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      { type: 'toggleOperation', establishmentId: e.id },
                      e.enabled
                        ? 'Novos ciclos pausados. Os ciclos em andamento serão concluídos.'
                        : 'Operação retomada.',
                    )
                  }
                >
                  {e.enabled ? <Pause size={16} /> : <Play size={16} />}
                  {e.enabled ? 'Pausar novos ciclos' : 'Retomar operação'}
                </button>
              </div>
            </div>
          )}
          {(tab === 'Estoque' || tab === 'Insumos' || tab === 'Vendas') && (
            <div>
              <div className="panel-content section-title">
                <h3>
                  {tab === 'Vendas'
                    ? 'Ofertas e produtos disponíveis'
                    : tab === 'Insumos'
                      ? 'Materiais no estabelecimento'
                      : 'Estoque físico'}
                </h3>
                <button
                  className="primary"
                  onClick={() =>
                    openMarket({
                      product:
                        e.category === 'farm' ? 'soy' : e.category === 'industry' ? 'iron' : 'coal',
                      destinationId: e.id,
                      quantity: 24,
                    })
                  }
                >
                  <Search size={15} /> Comprar insumos
                </button>
              </div>
              {stock.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th className="numeric">Quantidade</th>
                        <th className="numeric">Massa</th>
                        <th>Oferta de venda</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map(([id, q]) => {
                        const offer = world.offers.find(
                          (o) => o.establishmentId === e.id && o.product === id,
                        );
                        return (
                          <tr key={id}>
                            <td>
                              <div className="table-name">
                                <i className="table-icon">
                                  <Box size={16} />
                                </i>
                                <strong>{products[id].name}</strong>
                              </div>
                            </td>
                            <td className="numeric">
                              {num(q)} {products[id].unit}
                            </td>
                            <td className="numeric">{num(q * products[id].massT, 2)} t</td>
                            <td>{offer ? cr(offer.price, 2) : 'Não anunciada'}</td>
                            <td>
                              <button
                                className="secondary"
                                disabled={q <= 0}
                                onClick={() => sell(id)}
                              >
                                <Tag size={14} /> {offer ? 'Alterar oferta' : 'Anunciar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Estoque vazio"
                  description="Compre produtos no mercado ou inicie um ciclo produtivo com insumos disponíveis."
                />
              )}
              {tab === 'Vendas' && (
                <div className="panel-content">
                  <h3>Movimentações recentes</h3>
                  {entries.length ? (
                    entries.map((entry) => (
                      <div className="simple-entry" key={entry.id}>
                        <span>{entry.description}</span>
                        <strong className={entry.to === actor ? 'positive' : 'negative'}>
                          {entry.to === actor ? '+' : '−'}
                          {cr(entry.amount)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Nenhuma transação registrada nesta unidade.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {tab === 'Funcionários' && (
            <div className="panel-content">
              <h3>Equipe operacional</h3>
              <Rows
                rows={[
                  { label: 'Funcionários contratados', value: e.employees },
                  { label: 'Custo operacional / dia do jogo', value: cr(e.dailyCost) },
                  { label: 'Estado da unidade', value: e.enabled ? 'Em operação' : 'Pausada' },
                ]}
              />
              <p className="muted small">
                Salários, serviços e manutenção estão agregados no custo diário deste cenário. A
                cobrança é registrada a cada duas horas de jogo.
              </p>
              <button
                className="secondary"
                onClick={() =>
                  void run(
                    { type: 'toggleOperation', establishmentId: e.id },
                    'Estado da operação atualizado.',
                  )
                }
                disabled={pending}
              >
                {e.enabled ? 'Pausar operação' : 'Retomar operação'}
              </button>
            </div>
          )}
        </Panel>
        <div className="right-stack">
          <Panel title="Indicadores operacionais">
            <div className="panel-content">
              <Rows
                rows={[
                  { label: 'Armazenamento', value: `${num(load.mass, 1)} / ${num(e.capacityT)} t` },
                  {
                    label: 'Volume ocupado',
                    value: `${num(load.volume, 1)} / ${num(e.capacityM3)} m³`,
                  },
                  { label: 'Ciclos na fila', value: jobs.reduce((n, j) => n + j.cycles, 0) },
                  { label: 'Funcionários', value: e.employees },
                  { label: 'Custos / dia do jogo', value: cr(daily.total) },
                  {
                    label: 'Resultado registrado',
                    value: cr(e.revenue - e.expenses),
                    className: e.revenue >= e.expenses ? 'positive' : 'negative',
                  },
                ]}
              />
              {e.reserve !== undefined && (
                <Rows rows={[{ label: 'Reserva mineral virtual', value: `${num(e.reserve)} t` }]} />
              )}
              <button className="text-button" onClick={() => setShowCosts(true)}>
                Ver custos e tarifas
              </button>
            </div>
          </Panel>
          <Panel title="Insumos e abastecimento">
            <div className="panel-content">
              {recipe &&
                Object.entries(recipe.input).map(([id, qty]) => (
                  <div className="simple-entry" key={id}>
                    <span>{products[id as ProductId].name}</span>
                    <strong
                      className={(e.inventory[id as ProductId] ?? 0) < qty! * 2 ? 'gold-text' : ''}
                    >
                      {num(e.inventory[id as ProductId] ?? 0)} {products[id as ProductId].unit}
                    </strong>
                  </div>
                ))}
              <p className="muted small">
                A produção depende de insumos, saldo e capacidade. Materiais em trânsito ficam
                disponíveis somente após a entrega.
              </p>
              <button
                className="primary"
                onClick={() =>
                  openMarket({
                    product: recipe
                      ? ((Object.keys(recipe.input)[0] as ProductId) ?? 'iron')
                      : 'oil',
                    destinationId: e.id,
                    quantity: 24,
                  })
                }
              >
                <Search size={16} /> Buscar fornecedores
              </button>
            </div>
          </Panel>
        </div>
      </div>
      {queue && recipe && (
        <Modal title="Adicionar produção" onClose={() => setQueue(false)}>
          <label className="field">
            Receita
            <Select
              label="Selecionar receita"
              value={recipe.id}
              onChange={(event) => setRecipe(event.target.value)}
            >
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            Quantidade de ciclos
            <input
              type="number"
              min="1"
              max="100"
              value={cycles}
              onChange={(event) =>
                setCycles(Math.max(1, Math.min(100, Math.floor(Number(event.target.value)))))
              }
            />
          </label>
          <Rows
            rows={[
              ...Object.entries(recipe.input).map(([id, q]) => ({
                label: products[id as ProductId].name,
                value: `${num(q! * cycles)} ${products[id as ProductId].unit} necessários · ${num(e.inventory[id as ProductId] ?? 0)} em estoque`,
              })),
              { label: 'Processamento e consumíveis', value: cr(charges!.processing) },
              { label: `Energia · ${num(charges!.energyKwh)} kWh`, value: cr(charges!.energy) },
              {
                label: `Água e esgoto · ${num(charges!.waterM3, 2)} m³`,
                value: cr(charges!.water),
              },
              { label: 'Pagamento total do lote', value: cr(charges!.total) },
              {
                label: 'Processamento do lote (tempo real)',
                value: `${num((recipe.duration * cycles) / 1000)} s`,
              },
            ]}
          />
          <p className="muted small">
            Os insumos saem do estoque agora e as saídas são recebidas quando cada lote for
            concluído. A fila continua com a página fechada.
          </p>
          <button
            className="primary full"
            disabled={pending || !e.enabled}
            onClick={async () => {
              if (
                await run(
                  { type: 'produce', establishmentId: e.id, recipeId: recipe.id, cycles },
                  'Produção adicionada. Insumos e custo reservados.',
                )
              )
                setQueue(false);
            }}
          >
            {pending ? 'Reservando…' : 'Confirmar produção'}
          </button>
        </Modal>
      )}
      {offerProduct && (
        <Modal title="Anunciar no mercado" onClose={() => setOfferProduct(undefined)}>
          <p>
            {products[offerProduct].name} · {num(e.inventory[offerProduct] ?? 0)}{' '}
            {products[offerProduct].unit} em estoque
          </p>
          <label className="field">
            Preço por {products[offerProduct].unit} (R$)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={price / 100}
              onChange={(event) => setPrice(Math.round(Number(event.target.value) * 100))}
            />
          </label>
          <p className="muted small">
            A oferta permite vender apenas o estoque existente. A quantidade disponível diminui a
            cada compra.
          </p>
          <button
            className="primary full"
            disabled={pending || price <= 0}
            onClick={async () => {
              if (
                await run(
                  { type: 'publishOffer', establishmentId: e.id, product: offerProduct, price },
                  'Oferta publicada no mercado compartilhado.',
                )
              )
                setOfferProduct(undefined);
            }}
          >
            Publicar oferta
          </button>
        </Modal>
      )}
      {showCosts && <InfrastructureDetails property={p} onClose={() => setShowCosts(false)} />}
    </>
  );
}
