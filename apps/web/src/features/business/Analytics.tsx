import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Rows, Select, Empty } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import {
  products,
  ECONOMIC_INTERVAL,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import {
  gameCalendar,
  GAME_DAY,
  weekdayNames,
  inventoryQuality,
} from '../../../../../packages/simulation/src/operations';
import { householdDemand, regionFor } from '../../../../../packages/simulation/src/metrics';

const axis = { axisLine: { lineStyle: { color: '#405760' } }, axisLabel: { color: '#a9bfcb' } };
export function BusinessFinance({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame(),
    [period, setPeriod] = useState('');
  const end = Math.max(world.updatedAt, world.nextEconomicAt - ECONOMIC_INTERVAL),
    start = period
      ? Math.max(world.economyStartedAt, end - Number(period) * GAME_DAY)
      : world.economyStartedAt;
  const entries = world.ledger.filter((l) => l.establishmentId === e.id && l.at >= start);
  const outgoing = entries.filter((l) => l.from === e.companyId && l.to !== e.companyId);
  const sales = world.shipments.filter(
    (s) => s.originId === e.id && s.buyerId !== e.companyId && s.departedAt >= start,
  );
  const retail = entries.filter((l) => l.kind === 'retail' && l.to === e.companyId);
  const count = 14,
    width = Math.max(ECONOMIC_INTERVAL, (end - start) / count);
  const bucket = (at: number) => Math.min(count - 1, Math.floor((at - start) / width));
  const income = Array.from(
    { length: count },
    (_, i) =>
      sales.filter((s) => bucket(s.departedAt) === i).reduce((n, s) => n + s.cost, 0) +
      retail.filter((l) => bucket(l.at) === i).reduce((n, l) => n + l.amount, 0),
  );
  const spending = Array.from({ length: count }, (_, i) =>
    outgoing.filter((l) => bucket(l.at) === i).reduce((n, l) => n + l.amount, 0),
  );
  const kinds = [
    ['trade', 'Mercadorias'],
    ['freight', 'Frete'],
    ['payroll', 'Equipe'],
    ['energy', 'Energia'],
    ['water', 'Água'],
    ['maintenance', 'Manutenção'],
    ['operation', 'Processamento'],
  ] as const;
  return (
    <div className="panel-content business-section">
      <div className="section-title">
        <div>
          <h3>Entradas e pagamentos</h3>
          <p className="muted small">
            Fluxo de caixa observado da unidade. Compra de estoque é um investimento até a venda.
          </p>
        </div>
        <Select
          label="Período financeiro"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="">Período (opcional)</option>
          <option value="1">1 dia do jogo</option>
          <option value="7">7 dias do jogo</option>
          <option value="30">30 dias do jogo</option>
        </Select>
      </div>
      <EconomicChart
        label="Gráfico de receitas e pagamentos da unidade em reais"
        height={280}
        option={{
          tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => cr(Number(v) * 100) },
          legend: { textStyle: { color: '#a9bfcb' }, data: ['Receitas', 'Pagamentos'] },
          grid: { left: 65, right: 12, top: 40, bottom: 35 },
          xAxis: {
            type: 'category',
            data: Array.from({ length: count }, (_, i) =>
              gameCalendar(world, start + i * width).date.toLocaleTimeString('pt-BR', {
                timeZone: 'UTC',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            ),
            ...axis,
          },
          yAxis: { type: 'value', ...axis, splitLine: { lineStyle: { color: '#304650' } } },
          series: [
            {
              name: 'Receitas',
              type: 'bar',
              data: income.map((v) => v / 100),
              itemStyle: { color: '#62c89e' },
            },
            {
              name: 'Pagamentos',
              type: 'bar',
              data: spending.map((v) => v / 100),
              itemStyle: { color: '#d9b16b' },
            },
          ],
        }}
      />
      <div className="business-two-col">
        <div>
          <h3>Onde o dinheiro foi gasto</h3>
          {kinds.map(([kind, label]) => {
            const amount = outgoing
              .filter((l) => l.kind === kind)
              .reduce((n, l) => n + l.amount, 0);
            const total = outgoing.reduce((n, l) => n + l.amount, 0);
            return (
              <div className="cost-breakdown" key={kind}>
                <div>
                  <span>{label}</span>
                  <strong>{cr(amount)}</strong>
                </div>
                <span className="cost-track">
                  <i style={{ width: `${total ? (amount / total) * 100 : 0}%` }} />
                </span>
              </div>
            );
          })}
        </div>
        <div>
          <h3>Resultado e capital</h3>
          <Rows
            rows={[
              { label: 'Receitas acumuladas', value: cr(e.revenue) },
              { label: 'Custos reconhecidos acumulados', value: cr(e.expenses) },
              { label: 'Resultado acumulado', value: cr(e.revenue - e.expenses) },
              {
                label: 'Capital no estoque atual',
                value: cr(
                  Object.entries(e.inventory).reduce(
                    (n, [id, q]) => n + q! * (e.unitCosts[id as ProductId] ?? 0),
                    0,
                  ),
                ),
              },
            ]}
          />
          <p className="muted small">
            Os custos reconhecidos incluem a baixa do custo das mercadorias vendidas e despesas
            operacionais. O gráfico acompanha pagamentos, que podem ocorrer em outro período.
          </p>
        </div>
      </div>
      <details className="data-details">
        <summary>Ver valores do gráfico</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Período</th>
                <th>Receitas</th>
                <th>Pagamentos</th>
              </tr>
            </thead>
            <tbody>
              {income.map((v, i) => (
                <tr key={i}>
                  <td>
                    {gameCalendar(world, start + i * width).date.toLocaleString('pt-BR', {
                      timeZone: 'UTC',
                    })}
                  </td>
                  <td>{cr(v)}</td>
                  <td>{cr(spending[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function Consumption({ establishment: e }: { establishment: Establishment }) {
  const { world } = useGame(),
    [product, setProduct] = useState<ProductId>(
      (Object.keys(e.inventory)[0] as ProductId) ?? 'oil',
    );
  const at = world.nextEconomicAt - ECONOMIC_INTERVAL,
    calendar = gameCalendar(world, at);
  const rows = world.consumptionHistory.filter(
    (s) => s.establishmentId === e.id && s.product === product,
  );
  const recent = rows.slice(-84),
    sold = recent.reduce((n, s) => n + s.sold, 0),
    desired = recent.reduce((n, s) => n + s.desired, 0);
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    region = regionFor(world, p.coordinates, p.city);
  const competitors = Math.max(
    1,
    world.establishments.filter(
      (x) =>
        x.enabled &&
        x.category === 'retail' &&
        world.properties.find((p) => p.id === x.propertyId)!.city === p.city,
    ).length,
  );
  const forecast = (householdDemand(world, region.id, product) * calendar.factor) / competitors;
  const observedDaily = recent.length ? (sold / recent.length) * 12 : null;
  return (
    <div className="panel-content business-section">
      <div className="section-title">
        <div>
          <h3>Consumo e oportunidades de melhoria</h3>
          <p className="muted small">
            {calendar.label} no jogo · perfil de consumo {num(calendar.factor * 100)}% da média
          </p>
        </div>
        <Select
          label="Produto para consumo"
          value={product}
          onChange={(event) => setProduct(event.target.value as ProductId)}
        >
          {Object.keys(e.inventory).map((id) => (
            <option key={id} value={id}>
              {products[id as ProductId].name}
            </option>
          ))}
        </Select>
      </div>
      <div className="business-two-col">
        <div>
          <Rows
            rows={[
              {
                label: 'Média observada / dia equivalente',
                value: observedDaily === null ? 'Aguardando vendas' : `${num(observedDaily, 1)} un`,
              },
              {
                label: 'Demanda regional dividida entre lojas (estimativa)',
                value: `${num(forecast, 1)} un / dia`,
              },
              {
                label: 'Demanda atribuída não atendida',
                value: `${num(Math.max(0, desired - sold))} un`,
              },
              { label: 'Qualidade do estoque', value: `${num(inventoryQuality(e, product))}/100` },
            ]}
          />
          <p className="small muted">
            Qualidade e preço alteram preferência. Equipe, área, estoque e orçamento limitam
            compras. A média usa até 84 rodadas observadas; não é promessa de venda.
          </p>
        </div>
        <div>
          <h3>Perfil semanal modelado</h3>
          {world.season.config.operations.weekday.map((factor, i) => (
            <div className={`weekday-row ${i === calendar.weekday ? 'today' : ''}`} key={i}>
              <span>{weekdayNames[i]}</span>
              <i style={{ width: `${(factor / 1.3) * 55}%` }} />
              <strong>{num(factor * 100)}%</strong>
            </div>
          ))}
        </div>
      </div>
      {recent.length ? (
        <EconomicChart
          label="Demanda atribuída e unidades vendidas por rodada"
          height={230}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Demanda atribuída', 'Vendido'], textStyle: { color: '#a9bfcb' } },
            grid: { left: 45, right: 10, top: 35, bottom: 35 },
            xAxis: {
              type: 'category',
              data: recent.map((s) =>
                gameCalendar(world, s.at).date.toLocaleTimeString('pt-BR', {
                  timeZone: 'UTC',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              ),
              ...axis,
            },
            yAxis: { type: 'value', ...axis, splitLine: { lineStyle: { color: '#304650' } } },
            series: [
              {
                name: 'Demanda atribuída',
                type: 'line',
                data: recent.map((s) => s.desired),
                itemStyle: { color: '#d9b16b' },
              },
              {
                name: 'Vendido',
                type: 'line',
                data: recent.map((s) => s.sold),
                itemStyle: { color: '#72b2d1' },
              },
            ],
          }}
        />
      ) : (
        <Empty
          title="O histórico começa com a próxima rodada"
          description="A simulação registra demanda atribuída e vendas a cada minuto real. Não há valores anteriores inventados."
        />
      )}
      <div className="business-advice">
        <strong>Próxima decisão</strong>
        <p>
          {(e.inventory[product] ?? 0) === 0
            ? 'Reabasteça este produto: a demanda atribuída não consegue virar venda sem estoque.'
            : desired > sold
              ? 'Há demanda não atendida. Confira cobertura de estoque e capacidade da equipe antes de ampliar compras.'
              : inventoryQuality(e, product) < 65
                ? 'Compare a qualidade dos fornecedores. Materiais melhores aumentam a preferência pelo produto.'
                : 'Compare o preço de venda com o custo posto e acompanhe a margem antes de expandir.'}
        </p>
      </div>
    </div>
  );
}
