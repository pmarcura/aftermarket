import { FleetPicker } from '../../components/FleetPicker';
import { SupplyConnection } from './SupplyConnection';
import { useMemo, useState } from 'react';
import { Save, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Rows, Select, Tabs } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { defaultSupplyPolicy } from '../../../../../packages/simulation/src/competition';
import { supplyForecast, supplyProjection } from '../../../../../packages/simulation/src/supply';

export function SupplyPlanner({ establishment: e }: { establishment: Establishment }) {
  const { world, run, pending } = useGame();
  const [policy, setPolicy] = useState(() =>
      structuredClone(e.supplyPolicy ?? defaultSupplyPolicy(world, e)),
    ),
    [mode, setMode] = useState('Simplificada'),
    [add, setAdd] = useState(''),
    [chart, setChart] = useState(''),
    [connecting, setConnecting] = useState(false);
  const forecast = useMemo(() => supplyForecast(world, e, policy), [world.revision, e, policy]);
  const selected = forecast.rows.find((r) => r.product === chart),
    fleetContext = selected ?? forecast.rows[0],
    fleetOrigin = fleetContext
      ? (policy.rules.find((r) => r.product === fleetContext.product)?.originId ??
        fleetContext.best?.origin.id)
      : undefined,
    cash = world.companies.find((c) => c.id === e.companyId)!.balance;
  const set = <K extends keyof typeof policy>(key: K, value: (typeof policy)[K]) =>
    setPolicy((p) => ({ ...p, [key]: value }));
  const edit = (index: number, key: 'minimum' | 'target' | 'maxBuy' | 'maxPrice', value: number) =>
    set(
      'rules',
      policy.rules.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  const valid =
    policy.dailyBudget > 0 &&
    policy.cashReserve >= 0 &&
    policy.rules.every(
      (r) =>
        Number.isInteger(r.minimum) &&
        r.minimum >= 0 &&
        r.minimum < r.target &&
        r.target <= 1e6 &&
        r.maxBuy > 0,
    );
  return (
    <div className="panel-content supply-planner">
      <div className="section-title">
        <div>
          <h3>Abastecimento automático</h3>
          <p className="small muted">
            {e.supplyStatus ?? 'Configure origens, estoque de segurança e limites antes de ativar.'}
          </p>
        </div>
        <Tabs values={['Simplificada', 'Avançada']} value={mode} onChange={setMode} />
      </div>
      <div className="connection-launch">
        <div>
          <strong>Minha cadeia de abastecimento</strong>
          <p className="small muted">
            Conecte uma mineradora, fazenda ou estoque a este destino sem refazer compras.
          </p>
        </div>
        <button className="secondary" onClick={() => setConnecting(!connecting)}>
          {connecting ? 'Fechar conexão' : 'Conectar minha estrutura'}
        </button>
      </div>
      {connecting && (
        <SupplyConnection
          initialDestination={e.id}
          onSaved={(next) => {
            setConnecting(false);
            setPolicy(structuredClone(next));
          }}
        />
      )}
      <div className="supply-kpis">
        <div>
          <span>Reposição sinalizada agora</span>
          <strong>{cr(forecast.cashNeeded)}</strong>
          <small>antes dos limites de caixa/orçamento</small>
        </div>
        <div>
          <span>Já gasto hoje</span>
          <strong>{cr(forecast.spent.executed)}</strong>
          <small>pedidos pendentes: {cr(forecast.spent.promised)}</small>
        </div>
        <div>
          <span>Resultado potencial / dia</span>
          <strong className={forecast.estimatedResult >= 0 ? 'positive' : 'negative'}>
            {cr(forecast.estimatedResult)}
          </strong>
          <small>cenário de produção/venda estimada</small>
        </div>
      </div>
      <div className="supply-controls">
        <label className="checkbox-line">
          <input
            aria-label="Ativar abastecimento automático"
            type="checkbox"
            checked={policy.enabled}
            onChange={(ev) => set('enabled', ev.target.checked)}
          />{' '}
          Ativar abastecimento
        </label>
        <label className="field">
          Orçamento de reposição / dia (R$)
          <input
            aria-label="Orçamento de abastecimento"
            type="number"
            min=".01"
            step=".01"
            value={policy.dailyBudget / 100}
            onChange={(ev) => set('dailyBudget', Math.round(Number(ev.target.value) * 100))}
          />
        </label>
        <Select
          label="Origem do abastecimento"
          value={policy.source}
          onChange={(ev) => set('source', ev.target.value as typeof policy.source)}
        >
          <option value="internal-first">Priorizar minhas unidades</option>
          <option value="internal-only">Somente minhas unidades</option>
          <option value="market">Fornecedores do mercado</option>
        </Select>
      </div>
      <div className="section-title">
        <h3>Réguas por mercadoria</h3>
        <div className="inline-actions">
          <Select
            label="Adicionar item de abastecimento"
            value={add}
            onChange={(ev) => setAdd(ev.target.value)}
          >
            <option value="">Escolher mercadoria</option>
            {Object.entries(products)
              .filter(([id]) => !policy.rules.some((r) => r.product === id))
              .map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
          </Select>
          <button
            className="secondary"
            disabled={!add}
            onClick={() => {
              set('rules', [
                ...policy.rules,
                {
                  product: add as ProductId,
                  minimum: 10,
                  target: 100,
                  maxBuy: 100,
                  maxPrice: Math.round(world.season.config.basePrices[add as ProductId] * 1.5),
                },
              ]);
              setAdd('');
            }}
          >
            <Plus size={15} />
            Adicionar
          </button>
        </div>
      </div>
      {!policy.rules.length && (
        <p className="muted">Adicione os insumos ou produtos que esta unidade precisa receber.</p>
      )}
      {policy.rules.map((r, i) => {
        const f = forecast.rows[i],
          unit = products[r.product].unit;
        return (
          <section className="supply-rule" key={r.product}>
            <div className="section-title">
              <button className="text-button" onClick={() => setChart(r.product)}>
                <strong>{products[r.product].name}</strong> · simular cobertura
              </button>
              <div className="inline-actions">
                <Badge tone={f.coverage !== null && f.coverage < 1 ? 'gold' : 'blue'}>
                  {f.coverage === null ? 'Sem consumo previsto' : `${num(f.coverage, 1)} dias`}
                </Badge>
                <button
                  className="icon-button"
                  aria-label={`Remover regra de ${products[r.product].name}`}
                  onClick={() =>
                    set(
                      'rules',
                      policy.rules.filter((_, n) => n !== i),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="connection-path">
              <strong>
                {r.originId
                  ? (world.establishments.find((x) => x.id === r.originId)?.name ??
                    'Origem indisponível')
                  : policy.source === 'market'
                    ? 'Mercado'
                    : 'Minhas unidades / política de origem'}
              </strong>
              <span>→ {e.name}</span>
            </div>
            <Select
              label={`Origem fixa de ${products[r.product].name}`}
              value={r.originId ?? ''}
              onChange={(ev) =>
                set(
                  'rules',
                  policy.rules.map((rule, n) =>
                    n === i ? { ...rule, originId: ev.target.value || undefined } : rule,
                  ),
                )
              }
            >
              <option value="">Usar política de origem geral</option>
              {world.establishments
                .filter((x) => x.companyId === e.companyId && x.id !== e.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {num(x.inventory[r.product] ?? 0)} {unit} em estoque
                  </option>
                ))}
            </Select>
            <div className="supply-rule-grid">
              <label className="field">
                Repor ao atingir ({unit})
                <input
                  aria-label={`Mínimo de ${products[r.product].name}`}
                  type="number"
                  min="0"
                  value={r.minimum}
                  onChange={(ev) => edit(i, 'minimum', Number(ev.target.value))}
                />
                <input
                  aria-label={`Régua do mínimo de ${products[r.product].name}`}
                  type="range"
                  min="0"
                  max={Math.max(100, r.target - 1)}
                  step="1"
                  value={r.minimum}
                  onChange={(ev) => edit(i, 'minimum', Number(ev.target.value))}
                />
              </label>
              <label className="field">
                Estoque alvo ({unit})
                <input
                  aria-label={`Alvo de ${products[r.product].name}`}
                  type="number"
                  min="1"
                  value={r.target}
                  onChange={(ev) => edit(i, 'target', Number(ev.target.value))}
                />
                <input
                  aria-label={`Régua do alvo de ${products[r.product].name}`}
                  type="range"
                  min="1"
                  max={Math.max(1000, r.target * 2)}
                  value={r.target}
                  onChange={(ev) => edit(i, 'target', Number(ev.target.value))}
                />
              </label>
              {mode === 'Avançada' && (
                <>
                  <label className="field">
                    Máximo por compra ({unit})
                    <input
                      aria-label={`Lote máximo de ${products[r.product].name}`}
                      type="number"
                      min="1"
                      value={r.maxBuy}
                      onChange={(ev) => edit(i, 'maxBuy', Number(ev.target.value))}
                    />
                  </label>
                  <label className="field">
                    Preço máximo / {unit} (R$)
                    <input
                      aria-label={`Teto de preço de ${products[r.product].name}`}
                      type="number"
                      min="0"
                      step=".01"
                      value={r.maxPrice / 100}
                      onChange={(ev) =>
                        edit(i, 'maxPrice', Math.round(Number(ev.target.value) * 100))
                      }
                    />
                    <small>Zero = sem teto. Transferência própria não paga mercadoria.</small>
                  </label>
                </>
              )}
            </div>
            <div className="supply-rule-summary">
              <span>
                Físico{' '}
                <b>
                  {num(f.current)} {unit}
                </b>
              </span>
              <span>
                Em transporte{' '}
                <b>
                  {num(f.incoming)} {unit}
                </b>
              </span>
              <span>
                Em pedido{' '}
                <b>
                  {num(f.promised)} {unit}
                </b>
              </span>
              <span>
                Consumo previsto{' '}
                <b>
                  {num(f.need, 1)} {unit}/dia
                </b>
              </span>
            </div>
            {f.want > 0 && (
              <p className="small muted">
                {f.best
                  ? `${f.best.internal ? 'Transferir de' : 'Comprar de'} ${f.best.origin.name}: ${num(f.best.quantity)} ${unit} · desembolso ${cr(f.best.total)} · ${f.best.q.parts.length} veículos.`
                  : 'Nenhuma origem atende às regras atuais.'}
              </p>
            )}
          </section>
        );
      })}
      {mode === 'Avançada' && (
        <div className="supply-advanced">
          <h3>
            <SlidersHorizontal size={16} /> Limites e forma de compra
          </h3>
          <div className="supply-rule-grid">
            <label className="field">
              Preservar caixa (R$)
              <input
                aria-label="Reserva de caixa"
                type="number"
                min="0"
                value={policy.cashReserve / 100}
                onChange={(ev) => set('cashReserve', Math.round(Number(ev.target.value) * 100))}
              />
            </label>
            <label className="field">
              Distância máxima (km)
              <input
                aria-label="Distância máxima do fornecedor"
                type="number"
                min="1"
                max="6000"
                value={policy.maxDistanceKm}
                onChange={(ev) => set('maxDistanceKm', Number(ev.target.value))}
              />
            </label>
            <label className="field">
              Qualidade mínima ({policy.minQuality}/100)
              <input
                aria-label="Qualidade mínima de abastecimento"
                type="range"
                min="0"
                max="100"
                value={policy.minQuality}
                onChange={(ev) => set('minQuality', Number(ev.target.value))}
              />
            </label>
            <label className="field">
              Frete máximo / unidade (R$)
              <input
                aria-label="Teto unitário de frete"
                type="number"
                min="0"
                value={policy.maxFreightPerUnit / 100}
                onChange={(ev) =>
                  set('maxFreightPerUnit', Math.round(Number(ev.target.value) * 100))
                }
              />
              <small>Zero = sem teto; a unidade segue a mercadoria.</small>
            </label>
            <div className="field">
              <span>Transporte de todas as regras</span>
              <div className="inline-actions">
                <button
                  className={policy.carrierId === 'auto' ? 'primary' : 'secondary'}
                  onClick={() => set('carrierId', 'auto')}
                >
                  Melhor frete disponível
                </button>
                <button
                  className={policy.carrierId === 'own' ? 'primary' : 'secondary'}
                  onClick={() => set('carrierId', 'own')}
                >
                  Somente minha frota
                </button>
              </div>
              <small>
                {['auto', 'own'].includes(policy.carrierId)
                  ? 'A frota será revalidada a cada reposição.'
                  : `Frota fixa: ${world.companies.find((c) => c.id === policy.carrierId)?.name ?? policy.carrierId}`}
              </small>
            </div>
            <Select
              label="Forma de abastecimento"
              value={policy.purchaseMode}
              onChange={(ev) => set('purchaseMode', ev.target.value as typeof policy.purchaseMode)}
            >
              <option value="immediate">Comprar ofertas e transferir</option>
              <option value="request">Enviar pedidos para aceitação</option>
            </Select>
          </div>
          {fleetContext && (
            <details>
              <summary>Comparar frotas para {products[fleetContext.product].name}</summary>
              <FleetPicker
                originId={fleetOrigin}
                destinationId={e.id}
                product={fleetContext.product}
                quantity={
                  fleetContext.best?.quantity ??
                  policy.rules.find((r) => r.product === fleetContext.product)?.maxBuy ??
                  0
                }
                value={policy.carrierId === 'own' ? e.companyId : policy.carrierId}
                onChange={(id) => set('carrierId', id)}
                label="Frota de abastecimento"
              />
            </details>
          )}
          <p className="small muted">
            Fornecedores humanos recebem pedidos para aceitar. Caixa e quantidade pendentes entram
            no planejamento; nada é creditado antes da entrega.
          </p>
          <label className="checkbox-line">
            <input
              type="checkbox"
              aria-label="Vincular caixa de pedidos automáticos"
              checked={policy.reserveOrders ?? false}
              onChange={(e) => set('reserveOrders', e.target.checked)}
            />{' '}
            Vincular caixa de pedidos automáticos até aceite ou expiração
          </label>
        </div>
      )}
      <div className="supply-simulation">
        <h3>Simulação de cobertura</h3>
        <Select
          label="Mercadoria da projeção"
          value={chart}
          onChange={(ev) => setChart(ev.target.value)}
        >
          <option value="">Escolher item para o gráfico</option>
          {policy.rules.map((r) => (
            <option key={r.product} value={r.product}>
              {products[r.product].name}
            </option>
          ))}
        </Select>
        {selected ? (
          <EconomicChart
            label="Estoque estimado com e sem reposição"
            height={290}
            option={{
              color: ['#d99b74', '#65c8b4'],
              tooltip: { trigger: 'axis' },
              legend: { top: 0, type: 'scroll', textStyle: { color: '#b4cbd5' } },
              grid: { left: 55, right: 20, top: 65, bottom: 35 },
              xAxis: {
                type: 'category',
                data: Array.from({ length: 8 }, (_, d) => `Dia ${d}`),
                axisLabel: { color: '#a9bfcb' },
              },
              yAxis: {
                type: 'value',
                name: products[selected.product].unit,
                axisLabel: { color: '#a9bfcb' },
                splitLine: { lineStyle: { color: '#2c4652' } },
              },
              series: [
                {
                  name: 'Reposição / demanda baixa',
                  type: 'line',
                  lineStyle: { type: 'dashed' },
                  data: supplyProjection(
                    world,
                    e,
                    selected.product,
                    selected.need * 0.8,
                    selected.best
                      ? {
                          quantity: selected.best.quantity,
                          arrivalAt: world.updatedAt + selected.best.q.durationMs,
                        }
                      : undefined,
                  ),
                },
                {
                  name: 'Reposição / demanda alta',
                  type: 'line',
                  lineStyle: { type: 'dashed' },
                  data: supplyProjection(
                    world,
                    e,
                    selected.product,
                    selected.need * forecast.highFactor,
                    selected.best
                      ? {
                          quantity: selected.best.quantity,
                          arrivalAt: world.updatedAt + selected.best.q.durationMs,
                        }
                      : undefined,
                  ),
                },
                {
                  name: 'Sem nova reposição',
                  type: 'line',
                  data: supplyProjection(world, e, selected.product, selected.need),
                },
                {
                  name: 'Com reposição sinalizada',
                  type: 'line',
                  data: supplyProjection(
                    world,
                    e,
                    selected.product,
                    selected.need,
                    selected.best
                      ? {
                          quantity: selected.best.quantity,
                          arrivalAt: world.updatedAt + selected.best.q.durationMs,
                        }
                      : undefined,
                  ),
                },
              ],
            }}
          />
        ) : (
          <p className="muted small">
            Escolha um item para comparar o estoque previsto nos próximos sete dias.
          </p>
        )}
        <p className="small muted">
          Projeção: demanda/capacidade do modelo, preços atuais e uma reposição sinalizada. Não
          garante vendas ou lucro e não antecipa a entrega. O cenário não inclui futuras variações
          de preço. Baixa/alta testam demanda 20% menor/maior, respeitando a capacidade e o plano
          produtivo. Mais demanda não aumenta automaticamente a produção industrial. São cenários de
          sensibilidade, não probabilidades.
        </p>
      </div>
      <Rows
        rows={[
          { label: 'Custo para salvar a configuração', value: cr(0) },
          { label: 'Desembolso sinalizado de mercadoria/frete', value: cr(forecast.cashNeeded) },
          { label: 'Caixa atual / protegido', value: `${cr(cash)} / ${cr(policy.cashReserve)}` },
          {
            label: 'Contribuição potencial / dia antes de fixos',
            value: cr(forecast.contribution),
          },
          { label: 'Custos fixos estimados / dia', value: cr(forecast.fixed) },
          { label: 'Resultado potencial / demanda baixa (−20%)', value: cr(forecast.lowResult) },
          { label: 'Resultado potencial / base', value: cr(forecast.estimatedResult) },
          {
            label: 'Resultado potencial / demanda alta (limitada)',
            value: cr(forecast.highResult),
          },
        ]}
      />
      {!valid && (
        <p className="warning-text">
          Mínimo deve ser menor que o alvo. Revise orçamento e quantidades antes de salvar.
        </p>
      )}
      <button
        className="primary"
        disabled={pending || !valid}
        onClick={() =>
          void run(
            { type: 'configureSupply', establishmentId: e.id, policy },
            'Regras de abastecimento salvas. Aplicação na próxima rodada.',
          )
        }
      >
        <Save size={16} />
        Salvar regras de abastecimento
      </button>
    </div>
  );
}
