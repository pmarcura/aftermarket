import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Modal, Rows, Select } from '../../components/ui';
import { BarrasPixel } from '../../components/BarrasPixel';
import { IconePixel } from '../../components/IconePixel';
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
import { vehicleSalePrice } from '../../../../../packages/simulation/src/engine';
import {
  products,
  type ProductId,
  type Command,
  seasonProducts,
} from '../../../../../packages/simulation/src/model';
import '../../design/empresa.css';

/**
 * Pagamentos e crédito. Sem atraso nem dívida, aparece só uma linha calma; com atraso, vira um
 * alerta com três saídas: pagar, pedir crédito ou cortar custos. Os números da economia do mundo
 * (material de laboratório) ficam recolhidos no fim.
 */
export function Recovery() {
  const { world, actor, run, pending } = useGame();
  const [state, setState] = useState(''),
    [hhiProduct, setHhiProduct] = useState(''),
    [amount, setAmount] = useState(''),
    [payment, setPayment] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; text: string; command: Command }>();
  const units = world.establishments.filter((e) => e.companyId === actor),
    due = arrears(world, actor),
    principal = outstandingLoans(world, actor),
    cash = freeCash(world, actor);
  const [aberto, setAberto] = useState(due > 0 || principal > 0);
  const requested = Math.round(Number(amount) * 100),
    q = recoveryQuote(world, actor, state, requested),
    health = economyHealth(
      world,
      world.updatedAt,
      (hhiProduct || undefined) as ProductId | undefined,
    );
  const fleet = world.vehicles.filter((v) => v.companyId === actor && v.status === 'available');
  const debts = (world.obligations ?? [])
    .filter((o) => o.companyId === actor && o.amount > o.paid)
    .sort((a, b) => a.dueAt - b.dueAt);
  const emprestimos = (world.loans ?? []).filter(
    (l) => l.companyId === actor && l.repaid < l.principal,
  );
  const estados = [
    ...new Set(world.properties.filter((p) => p.ownerId === actor).map((p) => p.state)),
  ];
  const pagamento = Math.round(Number(payment) * 100);
  const maxPagar = Math.min(cash, due);

  return (
    <>
      <section
        className={`emp-pag ${due > 0 ? 'atraso' : ''}`}
        aria-labelledby="emp-pag-titulo"
      >
        <header>
          <IconePixel nome={due > 0 ? 'alerta' : 'cartao'} tamanho={44} />
          <div>
            <h2 id="emp-pag-titulo">
              {due > 0 ? 'Pagamentos atrasados' : 'Pagamentos em dia'}
            </h2>
            <p>
              {due > 0 ? (
                <>
                  Faltam <b>{cr(due)}</b>. Salários são pagos primeiro. Pausar a produção não
                  para os custos da estrutura; suspender um negócio zera a equipe e deixa só 10% da
                  manutenção.
                </>
              ) : principal > 0 ? (
                <>
                  Você tem <b>{cr(principal)}</b> de crédito para pagar.
                </>
              ) : (
                'Nenhuma conta atrasada e nenhum crédito aberto.'
              )}
            </p>
          </div>
          <button type="button" className="secondary" onClick={() => setAberto(!aberto)}>
            {aberto ? 'Esconder' : due > 0 ? 'Resolver' : 'Crédito e custos'}
          </button>
        </header>
        <dl className="emp-pag-numeros">
          <div>
            <dt>Caixa livre</dt>
            <dd>{cr(cash, 0)}</dd>
            <small>reservado para pedidos: {cr(reservedCash(world, actor), 0)}</small>
          </div>
          <div>
            <dt>Em atraso</dt>
            <dd className={due ? 'ruim' : ''}>{cr(due, 0)}</dd>
          </div>
          <div>
            <dt>Crédito a pagar</dt>
            <dd>{cr(principal, 0)}</dd>
            <small>garantia disponível: {cr(collateral(world, actor), 0)}</small>
          </div>
        </dl>

        {aberto && (
          <div className="emp-saidas">
            <article className="emp-saida">
              <h3>1. Pagar o que está atrasado</h3>
              <p>O pagamento começa pelos salários e não conta duas vezes como despesa.</p>
              <label className="emp-campo">
                <span>Quanto pagar (R$)</span>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  inputMode="decimal"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                />
              </label>
              <div className="emp-linha">
                <button
                  type="button"
                  className="secondary"
                  disabled={!maxPagar}
                  onClick={() => setPayment(String(maxPagar / 100))}
                >
                  Pagar o máximo ({cr(maxPagar, 0)})
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={
                    pending ||
                    !Number.isFinite(Number(payment)) ||
                    pagamento <= 0 ||
                    pagamento > maxPagar
                  }
                  onClick={() =>
                    setConfirm({
                      title: 'Pagar obrigações em atraso',
                      text: `Pagar ${cr(pagamento)}, começando pelos salários. Esse valor já foi reconhecido como despesa; o pagamento não conta duas vezes.`,
                      command: { type: 'payObligations', amount: pagamento },
                    })
                  }
                >
                  Revisar pagamento
                </button>
              </div>
              {!!debts.length && (
                <details className="emp-mini">
                  <summary>Ver as {debts.length} contas em aberto</summary>
                  <Rows
                    rows={debts
                      .slice(0, 30)
                      .map((d) => ({ label: d.description, value: cr(d.amount - d.paid) }))}
                  />
                </details>
              )}
            </article>

            <article className="emp-saida">
              <h3>2. Pedir crédito com garantia</h3>
              <p>
                O dinheiro vem do tesouro do estado. Custo único de 2% pago na hora; o principal é
                pago em 30 dias de jogo, sem juros escondidos. Crédito não conserta um negócio que
                perde dinheiro.
              </p>
              <div className="emp-estados" role="group" aria-label="Estado do crédito">
                {estados.length ? (
                  estados.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={state === s}
                      className={state === s ? 'on' : ''}
                      onClick={() => {
                        setState(s);
                        setAmount('');
                      }}
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  <small>Você ainda não tem imóvel em nenhum estado.</small>
                )}
              </div>
              <label className="emp-campo">
                <span>Quanto pedir (R$)</span>
                <input
                  type="number"
                  min="1000"
                  step="100"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <input
                  type="range"
                  aria-label="Régua do crédito"
                  min="0"
                  max={Math.floor(q.maximum / 100)}
                  step="100"
                  value={Math.max(0, Math.min(Number(amount) || 0, q.maximum / 100))}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <dl className="emp-cred">
                <div>
                  <dt>Máximo agora</dt>
                  <dd>{cr(q.maximum, 0)}</dd>
                </div>
                <div>
                  <dt>Custo</dt>
                  <dd>{cr(q.fee, 0)}</dd>
                </div>
                <div>
                  <dt>Entra no caixa</dt>
                  <dd>{cr(q.proceeds, 0)}</dd>
                </div>
                <div>
                  <dt>Parcela por dia</dt>
                  <dd>{cr(q.installment, 0)}</dd>
                </div>
              </dl>
              <button
                type="button"
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
                Revisar crédito
              </button>
              <small className="emp-apos">
                Caixa depois de pedir e pagar os atrasados: <b>{cr(cash + q.proceeds - due, 0)}</b>
              </small>
            </article>

            <article className="emp-saida">
              <h3>3. Cortar custos</h3>
              <p>
                Suspender um negócio encerra a equipe e desliga as automações; o estoque e o imóvel
                ficam. Vender um caminhão livre rende dinheiro na hora.
              </p>
              <ul className="emp-cortes">
                {units.map((e) => (
                  <li key={e.id}>
                    <span>
                      <b>{e.name}</b>
                      <small>
                        {cr(operatingCosts(world, e).total, 0)} por dia · {num(e.employees)} na equipe
                      </small>
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({
                          title: e.mothballed ? 'Reativar estrutura' : 'Suspender estrutura',
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
                      {e.mothballed ? 'Reativar' : 'Suspender'}
                    </button>
                  </li>
                ))}
                {fleet.map((v) => (
                  <li key={v.id}>
                    <span>
                      <b>{v.name}</b>
                      <small>Caminhão livre · vende por {cr(vehicleSalePrice(world, v), 0)}</small>
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      disabled={pending}
                      onClick={() =>
                        setConfirm({
                          title: 'Vender veículo usado',
                          text: `Receber ${cr(vehicleSalePrice(world, v))} e transferir ${v.name} para o fundo estadual. Esta venda é definitiva.`,
                          command: { type: 'sellVehicle', vehicleId: v.id },
                        })
                      }
                    >
                      Vender
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        )}

        {aberto && emprestimos.length > 0 && (
          <ul className="emp-emprestimos" aria-label="Créditos abertos">
            {emprestimos.map((l) => (
              <li key={l.id}>
                <span>
                  <b>
                    {l.treasuryId.replace('treasury:', 'Tesouro ')}: {cr(l.principal - l.repaid, 0)}
                  </b>
                  <small>Parcela de referência: {cr(l.installment, 0)} por dia.</small>
                </span>
                <button
                  type="button"
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
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="emp-lab">
        <summary>
          <span>Como vai a economia do mundo</span>
          <small>números de acompanhamento, sem ação</small>
        </summary>
        <div className="emp-lab-corpo">
          <Select
            label="Ver a concentração de um produto"
            value={hhiProduct}
            onChange={(e) => setHhiProduct(e.target.value)}
          >
            <option value="">Todas as vendas juntas</option>
            {seasonProducts(world).map((id) => (
              <option key={id} value={id}>
                {products[id].name}
              </option>
            ))}
          </Select>
          <dl className="emp-cred">
            <div>
              <dt>Quanto o dinheiro roda</dt>
              <dd>{num(health.velocity * 100, 1)}%</dd>
              <small>vendas por moeda total; não é crescimento</small>
            </div>
            <div>
              <dt>Demanda das famílias atendida</dt>
              <dd>
                {health.retailFulfillment === null
                  ? 'Sem dados'
                  : `${num(health.retailFulfillment * 100, 1)}%`}
              </dd>
            </div>
            <div>
              <dt>Poucas empresas dominam?</dt>
              <dd>{health.hhi === null ? 'Sem negócios' : num(health.hhi)}</dd>
              <small>de 0 a 10.000; quanto maior, mais concentrado</small>
            </div>
          </dl>
          <BarrasPixel
            titulo="Distribuição do dinheiro entre famílias, empresas e tesouros"
            formato={(v) => cr(v, 0)}
            itens={[
              { rotulo: 'Famílias', valor: health.families, tom: 'ceu' },
              { rotulo: 'Empresas', valor: health.privateCash, tom: 'lavoura' },
              { rotulo: 'Tesouros', valor: health.governments, tom: 'ouro' },
            ]}
          />
        </div>
      </details>

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
            Confirmar
          </button>
        </Modal>
      )}
    </>
  );
}
