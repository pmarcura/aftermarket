import { useState } from 'react';
import { FileText, ChartNoAxesCombined, Box, Truck, Factory, Download } from 'lucide-react';
import { useGame, cr, num } from '../lib/game';
import { PageHeading, Stat, Panel, Rows, Badge, LineChart, Select, Modal } from '../components/ui';
import { operatingCosts } from '../../../../packages/simulation/src/metrics';
import type { ProductId } from '../../../../packages/simulation/src/model';
export function CompanyPage() {
  const { world, actor, notice } = useGame();
  const [period, setPeriod] = useState(''),
    [details, setDetails] = useState(false);
  const company = world.companies.find((c) => c.id === actor)!,
    units = world.establishments.filter((e) => e.companyId === actor),
    fleet = world.vehicles.filter((v) => v.companyId === actor);
  const ledger = world.ledger.filter((e) => e.from === actor || e.to === actor),
    filtered = !period ? ledger : ledger.filter((e) => e.at >= Date.now() - Number(period) * 60000);
  const revenue = units.reduce((n, e) => n + e.revenue, 0),
    expenses = units.reduce((n, e) => n + e.expenses, 0),
    profit = revenue - expenses;
  const propertyAssets = world.properties
      .filter((p) => p.ownerId === actor)
      .reduce((n, p) => n + p.price, 0),
    inventory = units.reduce(
      (n, e) =>
        n +
        Object.entries(e.inventory).reduce(
          (sum, [id, q]) => sum + (e.unitCosts[id as ProductId] ?? 0) * q!,
          0,
        ),
      0,
    );
  const wip = world.jobs
      .filter((j) => !j.completed && units.some((e) => e.id === j.establishmentId))
      .reduce((n, j) => n + j.cost, 0),
    inTransit = world.shipments
      .filter((s) => s.buyerId === actor && !s.delivered)
      .reduce((n, s) => n + s.cost + s.freight, 0),
    vehicles = fleet.reduce((n, v) => n + (v.purchasePrice ?? 28000000), 0);
  const netWorth = company.balance + propertyAssets + inventory + wip + inTransit + vehicles;
  const first = filtered[0]?.at ?? world.createdAt,
    last = Math.max(Date.now(), first + 1);
  let total = 0;
  const points = Array.from({ length: 30 }, (_, i) => {
    const from = first + ((last - first) * i) / 30,
      to = first + ((last - first) * (i + 1)) / 30;
    total += filtered
      .filter((e) => e.at >= from && e.at <= to && (i === 0 || e.at > from))
      .reduce((n, e) => n + (e.to === actor ? e.amount : -e.amount), 0);
    return total;
  });
  const composition = [
    { label: 'Imóveis e instalações', amount: propertyAssets, color: '#78a9c5' },
    { label: 'Frota de veículos', amount: vehicles, color: '#c5a16b' },
    { label: 'Estoques e produção', amount: inventory + wip + inTransit, color: '#75b593' },
    { label: 'Caixa disponível', amount: company.balance, color: '#7e929d' },
  ];
  const cashCosts = [
    ['Folha de pagamento', 'payroll'],
    ['Energia', 'energy'],
    ['Água e esgoto', 'water'],
    ['Manutenção', 'maintenance'],
    ['Processamento e serviços', 'operation'],
    ['Fretes contratados', 'freight'],
  ].map(([label, kind]) => ({
    label,
    value: cr(
      filtered
        .filter((e) => e.from === actor && e.to !== actor && e.kind === kind)
        .reduce((n, e) => n + e.amount, 0),
    ),
  }));
  const forecast = units.reduce((n, e) => n + operatingCosts(world, e).total, 0);
  const exportLedger = () => {
    const csv =
      '\uFEFFData;Descrição;Tipo;Entrada (R$);Saída (R$)\r\n' +
      filtered
        .map((e) =>
          [
            new Date(e.at).toISOString(),
            `"${e.description.replaceAll('"', '""')}"`,
            e.kind,
            e.to === actor ? (e.amount / 100).toFixed(2) : '',
            e.from === actor ? (e.amount / 100).toFixed(2) : '',
          ].join(';'),
        )
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aftermarket-transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
    notice('Relatório financeiro exportado.');
  };
  return (
    <>
      <PageHeading
        eyebrow="Empresa / Visão geral"
        title="Empresa e Finanças"
        description="Avalie patrimônio, rentabilidade, ativos e desempenho da operação."
      />
      <div className="page-body">
        <div className="stats-grid">
          <Stat
            label="Patrimônio líquido"
            value={cr(netWorth)}
            note="caixa e ativos, sem dívidas neste cenário"
          />
          <Stat
            label="Receita registrada"
            value={cr(revenue)}
            note="vendas desde a abertura do mundo"
          />
          <Stat
            label="Custos reconhecidos"
            value={cr(expenses)}
            note="mercadorias vendidas e operação"
          />
          <Stat
            label="Resultado operacional"
            value={`${profit >= 0 ? '+' : '−'}${cr(Math.abs(profit))}`}
            note="receita menos custos reconhecidos"
            positive={profit >= 0}
          />
        </div>
        <div className="company-grid">
          <div className="left-stack">
            <Panel
              title="Evolução do fluxo de caixa"
              action={
                <div className="inline-actions">
                  <Badge tone="green">Acumulado</Badge>
                  <Select
                    label="Período do gráfico"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="">Período (opcional)</option>
                    <option value="5">Últimos 5 min reais</option>
                    <option value="30">Últimos 30 min reais</option>
                  </Select>
                </div>
              }
            >
              <div className="panel-content">
                <LineChart
                  values={points}
                  labels={['Início', '20%', '40%', '60%', '80%', 'Agora']}
                  money
                />
                <p className="muted small">
                  Movimentação efetiva de caixa em reais. Aquisições e produção capitalizada alteram
                  o caixa antes do resultado operacional.
                </p>
              </div>
            </Panel>
            <Panel
              title="Transações recentes"
              action={
                <button className="secondary" onClick={exportLedger}>
                  <FileText size={16} /> Exportar relatório
                </button>
              }
            >
              {filtered.length ? (
                filtered
                  .slice(-8)
                  .reverse()
                  .map((e) => {
                    const Icon =
                      e.kind === 'freight'
                        ? Truck
                        : e.kind === 'retail'
                          ? ChartNoAxesCombined
                          : e.kind === 'operation'
                            ? Factory
                            : Box;
                    return (
                      <div className="transaction-row" key={e.id}>
                        <i className="table-icon">
                          <Icon size={16} />
                        </i>
                        <div>
                          <span>{e.description}</span>
                          <small>{new Date(e.at).toLocaleTimeString('pt-BR')}</small>
                        </div>
                        <strong className={e.to === actor ? 'positive' : 'negative'}>
                          {e.to === actor ? '+' : '−'}
                          {cr(e.amount)}
                        </strong>
                      </div>
                    );
                  })
              ) : (
                <div className="panel-content">
                  <p className="muted">Suas transações aparecerão aqui após a primeira operação.</p>
                </div>
              )}
            </Panel>
          </div>
          <div className="right-stack">
            <Panel title="Composição do patrimônio">
              <div className="panel-content">
                <div className="composition-bar">
                  {composition.map((c) => (
                    <i
                      key={c.label}
                      style={{
                        width: `${(c.amount / Math.max(netWorth, 1)) * 100}%`,
                        background: c.color,
                      }}
                    />
                  ))}
                </div>
                {composition.map((c) => (
                  <div className="composition-row" key={c.label}>
                    <i style={{ background: c.color }} />
                    <span>{c.label}</span>
                    <strong>{num((c.amount / Math.max(netWorth, 1)) * 100)}%</strong>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Pagamentos operacionais em caixa">
              <div className="panel-content">
                <Rows rows={cashCosts} />
                <p className="muted small">
                  Pagamentos efetivos do período selecionado. Energia e água incluem consumo de
                  produção e manutenção da operação; produção em andamento fica no ativo até a
                  venda.
                </p>
                <Rows
                  rows={[{ label: 'Custos fixos estimados / dia do jogo', value: cr(forecast) }]}
                />
              </div>
            </Panel>
            <Panel title="Situação da empresa">
              <div className="panel-content">
                <Rows
                  rows={[
                    { label: 'Estabelecimentos', value: units.length },
                    { label: 'Funcionários', value: units.reduce((n, e) => n + e.employees, 0) },
                    {
                      label: 'Estados atendidos',
                      value: new Set(
                        units.map(
                          (e) => world.properties.find((p) => p.id === e.propertyId)!.state,
                        ),
                      ).size,
                    },
                    { label: 'Saldo disponível', value: cr(company.balance) },
                    {
                      label: 'Remessas em trânsito',
                      value: world.shipments.filter((s) => s.buyerId === actor && !s.delivered)
                        .length,
                    },
                  ]}
                />
                <p className="muted small">
                  Estoques e materiais em produção usam custo médio. Imóveis e veículos usam o valor
                  de aquisição do cenário.
                </p>
                <button className="primary" onClick={() => setDetails(true)}>
                  <ChartNoAxesCombined size={16} /> Abrir finanças detalhadas
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
      {details && (
        <Modal title="Balanço patrimonial" onClose={() => setDetails(false)}>
          <Rows
            rows={[
              { label: 'Caixa', value: cr(company.balance) },
              { label: 'Imóveis e instalações', value: cr(propertyAssets) },
              { label: 'Frota de veículos', value: cr(vehicles) },
              { label: 'Estoque disponível', value: cr(inventory) },
              { label: 'Materiais em produção', value: cr(wip) },
              { label: 'Mercadoria em trânsito', value: cr(inTransit) },
              { label: 'Passivos', value: cr(0) },
              { label: 'Patrimônio líquido', value: cr(netWorth) },
            ]}
          />
          <button className="secondary full" onClick={exportLedger}>
            <Download size={16} /> Exportar transações em CSV
          </button>
        </Modal>
      )}
    </>
  );
}
