import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Panel, Rows, Select, Modal, Badge } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import {
  arrears,
  outstandingLoans,
  freeCash,
  reservedCash,
  recoveryQuote,
  economyHealth,
  collateral,
} from '../../../../../packages/simulation/src/design';
import { operatingCosts } from '../../../../../packages/simulation/src/metrics';
import {
  products,
  type ProductId,
  type Command,
  seasonProducts,
} from '../../../../../packages/simulation/src/model';

export function Recovery() {
  const { world, actor, run, pending } = useGame();
  const [state, setState] = useState(''),
    [hhiProduct, setHhiProduct] = useState(''),
    [amount, setAmount] = useState(''),
    [payment, setPayment] = useState(''),
    [vehicle, setVehicle] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; text: string; command: Command }>();
  const units = world.establishments.filter((e) => e.companyId === actor),
    due = arrears(world, actor),
    principal = outstandingLoans(world, actor),
    cash = freeCash(world, actor);
  const requested = Math.round(Number(amount) * 100),
    q = recoveryQuote(world, actor, state, requested),
    health = economyHealth(
      world,
      world.updatedAt,
      (hhiProduct || undefined) as ProductId | undefined,
    );
  const fleet = world.vehicles.filter((v) => v.companyId === actor && v.status === 'available'),
    v = fleet.find((v) => v.id === vehicle);
  const debts = (world.obligations ?? [])
    .filter((o) => o.companyId === actor && o.amount > o.paid)
    .sort((a, b) => a.dueAt - b.dueAt);
  return (
    <>
      <Panel
        title="Caixa, compromissos e recuperação"
        subtitle="Custos continuam registrados quando não há dinheiro para pagar. Regularize ou reduza a estrutura antes de retomar."
      >
        <div className="panel-content">
          <div className="supply-kpis">
            <div>
              <span>Caixa livre</span>
              <strong>{cr(cash)}</strong>
              <small>vinculado a pedidos: {cr(reservedCash(world, actor))}</small>
            </div>
            <div>
              <span>Obrigações em atraso</span>
              <strong className={due ? 'negative' : ''}>{cr(due)}</strong>
              <small>prioridade de pagamento: salários</small>
            </div>
            <div>
              <span>Principal de crédito restante</span>
              <strong>{cr(principal)}</strong>
              <small>garantia elegível: {cr(collateral(world, actor))}</small>
            </div>
          </div>
          {!!due && (
            <p className="debt-alert">
              A empresa tem pagamentos em atraso. Pausar produção mantém contratos e custos da
              estrutura; suspensão temporária zera a equipe e mantém apenas 10% da manutenção.
            </p>
          )}
          <details open={due > 0 || principal > 0} className="data-details">
            <summary>Planejar recuperação e ver compromissos</summary>
            <div className="recovery-grid">
              <section>
                <h3>Regularizar e reduzir despesas</h3>
                <label className="field">
                  Pagamento de atrasados (R$)
                  <input
                    aria-label="Pagamento de atrasados"
                    type="number"
                    min="0"
                    step=".01"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  disabled={
                    pending ||
                    !Number.isFinite(Number(payment)) ||
                    Number(payment) <= 0 ||
                    Math.round(Number(payment) * 100) > Math.min(cash, due)
                  }
                  onClick={() =>
                    setConfirm({
                      title: 'Pagar obrigações em atraso',
                      text: `Pagar ${cr(Math.round(Number(payment) * 100))}, começando pelos salários. Esse valor já foi reconhecido como despesa; o pagamento não conta duas vezes.`,
                      command: {
                        type: 'payObligations',
                        amount: Math.round(Number(payment) * 100),
                      },
                    })
                  }
                >
                  Revisar pagamento
                </button>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Unidade</th>
                        <th>Fixos / dia</th>
                        <th>Estrutura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.name}
                            <small className="block">{e.employees} funcionários</small>
                          </td>
                          <td>{cr(operatingCosts(world, e).total)}</td>
                          <td>
                            <button
                              className="secondary"
                              disabled={pending}
                              onClick={() =>
                                setConfirm({
                                  title: e.mothballed
                                    ? 'Reativar estrutura'
                                    : 'Suspender estrutura',
                                  text: e.mothballed
                                    ? 'A manutenção integral volta. Contrate equipe e retome a operação quando houver insumos e caixa.'
                                    : `Encerra a equipe desta unidade, perde a formação média e desliga automações. Estoques e propriedade permanecem. Manutenção estimada cai para ${cr(operatingCosts(world, { ...e, employees: 0, mothballed: true }).total)} por dia. Obrigações anteriores permanecem. Lotes e treinamentos ativos precisam terminar.`,
                                  command: {
                                    type: 'mothball',
                                    establishmentId: e.id,
                                    enabled: !e.mothballed,
                                  },
                                })
                              }
                            >
                              {e.mothballed ? 'Reativar estrutura' : 'Suspender estrutura'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!!debts.length && (
                  <details>
                    <summary>Ver {debts.length} compromissos em aberto</summary>
                    <Rows
                      rows={debts
                        .slice(0, 30)
                        .map((d) => ({ label: d.description, value: cr(d.amount - d.paid) }))}
                    />
                  </details>
                )}
                <h3>Vender veículo disponível</h3>
                <Select
                  label="Veículo para vender"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                >
                  <option value="">Selecionar veículo (opcional)</option>
                  {fleet.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
                {v && (
                  <>
                    <p className="analysis-caption">
                      Liquidação por {cr(Math.floor((v.purchasePrice ?? 28000000) * 0.65))}, paga
                      pelo fundo estadual, se houver verba livre. Desconto de 35%; o veículo sai da
                      sua frota. Garantias de crédito são revalidadas.
                    </p>
                    <button
                      className="secondary"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({
                          title: 'Vender veículo usado',
                          text: `Receber ${cr(Math.floor((v.purchasePrice ?? 28000000) * 0.65))} e transferir ${v.name} para o fundo estadual. Esta venda é definitiva.`,
                          command: { type: 'sellVehicle', vehicleId: v.id },
                        })
                      }
                    >
                      Revisar venda do veículo
                    </button>
                  </>
                )}
              </section>
              <section>
                <h3>Crédito de recuperação com garantia</h3>
                <p className="analysis-caption">
                  Dinheiro vem do tesouro estadual, com limite de garantia e verba. Custo único de
                  2% pago agora; principal amortizado em 30 dias do jogo. Não há perdão automático
                  nem juros ocultos. Crédito não corrige uma operação deficitária.
                </p>
                <Select
                  label="Estado do crédito"
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setAmount('');
                  }}
                >
                  <option value="">Selecionar estado</option>
                  {[
                    ...new Set(
                      world.properties.filter((p) => p.ownerId === actor).map((p) => p.state),
                    ),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <label className="field">
                  Principal solicitado (R$)
                  <input
                    aria-label="Principal solicitado"
                    type="number"
                    min="1000"
                    step="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <input
                    aria-label="Régua do crédito"
                    type="range"
                    min="0"
                    max={Math.floor(q.maximum / 100)}
                    step="100"
                    value={Math.max(0, Math.min(Number(amount) || 0, q.maximum / 100))}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <Rows
                  rows={[
                    { label: 'Máximo disponível agora', value: cr(q.maximum) },
                    { label: 'Custo pago na contratação', value: cr(q.fee) },
                    { label: 'Entrada líquida de caixa', value: cr(q.proceeds) },
                    { label: 'Principal médio / dia', value: cr(q.installment) },
                    {
                      label: 'Saldo após crédito e quitação dos atrasados',
                      value: cr(cash + q.proceeds - due),
                    },
                  ]}
                />
                <button
                  className="primary"
                  disabled={
                    pending ||
                    !state ||
                    !Number.isSafeInteger(requested) ||
                    requested < 100000 ||
                    requested > q.maximum
                  }
                  onClick={() =>
                    setConfirm({
                      title: 'Contratar crédito de recuperação',
                      text: `Principal de ${cr(requested)}; custo imediato ${cr(q.fee)}; entrada líquida ${cr(q.proceeds)}. Amortização diária em 30 dias do jogo. Bens continuam garantindo o saldo devedor.`,
                      command: { type: 'takeRecoveryLoan', state, amount: requested },
                    })
                  }
                >
                  Revisar crédito e parcelas
                </button>
                {(world.loans ?? [])
                  .filter((l) => l.companyId === actor && l.repaid < l.principal)
                  .map((l) => (
                    <div className="business-advice" key={l.id}>
                      <strong>
                        {l.treasuryId.replace('treasury:', 'Tesouro ')}:{' '}
                        {cr(l.principal - l.repaid)}
                      </strong>
                      <p>Principal restante; parcela de referência {cr(l.installment)} por dia.</p>
                      <button
                        className="secondary"
                        disabled={pending || cash < l.principal - l.repaid}
                        onClick={() =>
                          setConfirm({
                            title: 'Quitar principal restante',
                            text: `Pagar ${cr(l.principal - l.repaid)} sem taxa adicional.`,
                            command: {
                              type: 'repayLoan',
                              loanId: l.id,
                              amount: l.principal - l.repaid,
                            },
                          })
                        }
                      >
                        Revisar quitação
                      </button>
                    </div>
                  ))}
              </section>
            </div>
          </details>
        </div>
      </Panel>
      <Panel
        title="Saúde da economia compartilhada"
        subtitle="Caixa e negócios internos observados; janela de sete dias do jogo, limitada ao histórico disponível."
      >
        <div className="panel-content">
          <Select
            label="Item para concentração"
            value={hhiProduct}
            onChange={(e) => setHhiProduct(e.target.value)}
          >
            <option value="">Item (opcional) · faturamento agregado</option>
            {seasonProducts(world)
              .map((id) => [id, products[id]] as const)
              .map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
          </Select>
          <p className="analysis-caption">
            A concentração usa o item escolhido no piloto inteiro. Sem item, o índice compara
            faturamento agregado de atividades diferentes; o gráfico de caixa abrange toda a
            economia.
          </p>
          <div className="supply-kpis">
            <div>
              <span>Giro comercial / moeda total</span>
              <strong>{num(health.velocity * 100, 1)}%</strong>
              <small>não é crescimento econômico</small>
            </div>
            <div>
              <span>Demanda varejista atendida</span>
              <strong>
                {health.retailFulfillment === null
                  ? 'Sem observações'
                  : `${num(health.retailFulfillment * 100, 1)}%`}
              </strong>
            </div>
            <div>
              <span>
                Concentração{' '}
                {hhiProduct ? products[hhiProduct as ProductId].name : 'do faturamento agregado'}{' '}
                (HHI)
              </span>
              <strong>{health.hhi === null ? 'Sem negócios' : num(health.hhi)}</strong>
              <small>0–10.000; maior = mais concentração</small>
            </div>
          </div>
          <EconomicChart
            label="Distribuição do dinheiro entre famílias, empresas e tesouros"
            height={260}
            option={{
              tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => cr(Number(v) * 100) },
              xAxis: { type: 'value', name: 'R$' },
              yAxis: { type: 'category', data: ['Famílias', 'Empresas', 'Tesouros'] },
              series: [
                {
                  name: 'Caixa observado (R$)',
                  type: 'bar',
                  data: [health.families, health.privateCash, health.governments].map(
                    (v) => v / 100,
                  ),
                },
              ],
            }}
          />
          <Rows
            rows={[
              { label: 'Obrigações vencidas no mundo', value: cr(health.obligations) },
              { label: 'Unidades privadas operando', value: health.active },
              { label: 'Estruturas suspensas', value: health.mothballed },
            ]}
          />
          <Badge tone="blue">Sem dados econômicos externos</Badge>
        </div>
      </Panel>
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(undefined)}>
          <p>{confirm.text}</p>
          <button
            className="primary full"
            disabled={pending}
            onClick={async () => {
              if (await run(confirm.command, 'Operação financeira registrada.'))
                setConfirm(undefined);
            }}
          >
            Confirmar operação
          </button>
        </Modal>
      )}
    </>
  );
}
