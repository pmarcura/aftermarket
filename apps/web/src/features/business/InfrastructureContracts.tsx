import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Empty, Modal, Rows, Select, Progress } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import {
  products,
  type InfrastructureContract,
} from '../../../../../packages/simulation/src/model';
import {
  treasuryReserved,
  treasuryAvailable,
  inventoryQuality,
} from '../../../../../packages/simulation/src/operations';
import { quote } from '../../../../../packages/simulation/src/engine';
import { useClock } from '../../lib/clock';
export function InfrastructureContracts() {
  const { world, actor, run, pending, navigate, focusMap } = useGame(),
    now = useClock();
  const [state, setState] = useState(''),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState<InfrastructureContract>(),
    [originId, setOrigin] = useState(''),
    [carrier, setCarrier] = useState(''),
    [price, setPrice] = useState(0);
  const government = world.companies.filter(
    (c) =>
      (c.id.startsWith('treasury:') && (!state || c.homeState === state)) ||
      (!state && c.id === 'treasury' && c.balance > 0),
  );
  const contracts = world.infrastructure
    .filter((c) => (!state || c.state === state) && (!status || c.status === status))
    .slice()
    .reverse();
  const current = world.infrastructure.find((c) => c.id === selected?.id),
    origin = world.establishments.find((e) => e.id === originId && e.companyId === actor);
  const q =
    current && origin && carrier
      ? quote(world, origin.id, current.destinationId, current.product, current.quantity, carrier)
      : undefined;
  const eligible = current
    ? world.establishments.filter(
        (e) => e.companyId === actor && (e.inventory[current.product] ?? 0) > 0,
      )
    : [];
  return (
    <div className="business-section">
      <div className="panel-content">
        <div className="section-title">
          <div>
            <h3>Tesouros estaduais e contratos municipais</h3>
            <p className="small muted">
              Arrecadação paga projetos da própria UF. O caixa determina quantos contratos cabem; o
              preço de cada item tem teto de referência interna + 25%.
            </p>
          </div>
          <Select
            label="Estado dos contratos públicos"
            value={state}
            onChange={(ev) => setState(ev.target.value)}
          >
            <option value="">Estado (opcional)</option>
            {government.length &&
              world.companies
                .filter((c) => c.id.startsWith('treasury:'))
                .map((c) => (
                  <option key={c.id} value={c.homeState}>
                    {c.homeState}
                  </option>
                ))}
          </Select>
        </div>
        <div className="supply-kpis">
          <div>
            <span>Caixa público no recorte</span>
            <strong>{cr(government.reduce((n, c) => n + c.balance, 0))}</strong>
          </div>
          <div>
            <span>Compromissos reservados</span>
            <strong>{cr(treasuryReserved(world, state || undefined))}</strong>
          </div>
          <div>
            <span>Disponível para novos projetos</span>
            <strong>{cr(treasuryAvailable(world, state || undefined))}</strong>
          </div>
        </div>
        <p className="formula-note">
          Julgamento: qualidade até 45 pontos; preço até 25; prazo até 20; custo do frete até 10.
          Caixa e estoque são revalidados no fechamento.
        </p>
        <div className="treasury-states">
          {government
            .filter((c) => c.balance > 0 || state)
            .map((c) => (
              <div key={c.id}>
                <strong>{c.homeState ?? 'Custódia anterior'}</strong>
                <span>{cr(c.balance)}</span>
                <small>
                  {
                    world.infrastructure.filter((x) => x.treasuryId === c.id && x.status === 'open')
                      .length
                  }{' '}
                  disputas abertas
                </small>
              </div>
            ))}
        </div>
        <Select
          label="Situação dos contratos públicos"
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
        >
          <option value="">Situação (opcional)</option>
          <option value="open">Em disputa</option>
          <option value="delivering">Em entrega</option>
          <option value="completed">Concluído</option>
          <option value="expired">Encerrado sem fornecedor</option>
        </Select>
      </div>
      {contracts.length ? (
        <div className="infrastructure-cards">
          {contracts.slice(0, 40).map((c) => {
            const destination = world.establishments.find((e) => e.id === c.destinationId)!,
              p = world.properties.find((p) => p.id === destination.propertyId)!,
              open = c.status === 'open' && (!c.biddingEndsAt || now < c.biddingEndsAt),
              cap = c.referencePrice ? Math.round(c.referencePrice * 1.25) : c.unitPrice;
            return (
              <article className="commercial-order" key={c.id}>
                <div className="section-title">
                  <div>
                    <Badge tone="gold">{c.state ?? p.state}</Badge>
                    <strong> {c.title}</strong>
                    <small className="block">
                      Prefeitura de {c.municipality ?? p.city} · #{c.id.slice(0, 6)}
                    </small>
                  </div>
                  <Badge
                    tone={
                      c.status === 'completed' ? 'green' : c.status === 'open' ? 'gold' : 'blue'
                    }
                  >
                    {
                      {
                        open: 'Em disputa',
                        delivering: 'Em entrega',
                        completed: 'Concluído',
                        expired: 'Sem adjudicação',
                      }[c.status]
                    }
                  </Badge>
                </div>
                <div className="order-numbers">
                  <span>
                    Solicitado{' '}
                    <b>
                      {num(c.quantity)} {products[c.product].unit} · {products[c.product].name}
                    </b>
                  </span>
                  <span>
                    Teto por unidade <b>{cr(cap)}</b>
                  </span>
                  <span>
                    Qualidade mínima <b>{c.minQuality}/100</b>
                  </span>
                  <span>
                    Propostas <b>{c.bids?.length ?? 0}</b>
                  </span>
                </div>
                {c.referencePrice && (
                  <p className="formula-note">
                    Referência interna {cr(c.referencePrice)} × 1,25 = teto {cr(cap)}. Os
                    fornecedores podem propor descontos. A referência é congelada neste edital.
                  </p>
                )}
                <Progress value={(c.deliveredQuantity / c.quantity) * 100} />
                <p className="small muted">
                  {num(c.deliveredQuantity)} / {num(c.quantity)} {products[c.product].unit}{' '}
                  recebidos.{' '}
                  {open && c.biddingEndsAt
                    ? `Propostas encerram em ${Math.max(0, Math.ceil((c.biddingEndsAt - now) / 1000))} s reais.`
                    : c.paid
                      ? `Total contratado: ${cr(c.paid)}.`
                      : ''}
                </p>
                <div className="inline-actions">
                  {open && (
                    <button
                      className="primary"
                      onClick={() => {
                        setSelected(c);
                        setOrigin('');
                        setCarrier('');
                        setPrice(c.unitPrice);
                      }}
                    >
                      Participar da disputa
                    </button>
                  )}
                  <button className="secondary" onClick={() => focusMap(p.coordinates, p.id)}>
                    Ver prefeitura no mapa
                  </button>
                  {c.supplierId === actor && (
                    <button className="secondary" onClick={() => navigate('logistics')}>
                      Acompanhar pedido e caminhões
                    </button>
                  )}
                </div>
                {!!c.bids?.length && (
                  <details>
                    <summary>Comparar propostas e resultado</summary>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Fornecedor</th>
                            <th>Preço / un.</th>
                            <th>Qualidade</th>
                            <th>Frete</th>
                            <th>Pontuação</th>
                            <th>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...c.bids]
                            .sort((a, b) => b.score - a.score)
                            .map((b) => (
                              <tr key={b.id}>
                                <td>{world.companies.find((x) => x.id === b.supplierId)?.name}</td>
                                <td>{cr(b.unitPrice)}</td>
                                <td>{b.quality}/100</td>
                                <td>{cr(b.freight)}</td>
                                <td>{b.score}</td>
                                <td>
                                  {
                                    {
                                      valid: 'Em disputa',
                                      won: 'Vencedora',
                                      lost: 'Não selecionada',
                                      invalid: 'Inviável na revalidação',
                                    }[b.status]
                                  }
                                  {b.reason && <small className="block">{b.reason}</small>}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <EconomicChart
                      label="Pontuação real das propostas do contrato"
                      height={220}
                      option={{
                        color: ['#77bdc5'],
                        tooltip: { trigger: 'axis' },
                        grid: { left: 140, right: 30, top: 20, bottom: 30 },
                        xAxis: { type: 'value', max: 100 },
                        yAxis: {
                          type: 'category',
                          data: c.bids.map(
                            (b) => world.companies.find((x) => x.id === b.supplierId)?.name,
                          ),
                        },
                        series: [{ type: 'bar', data: c.bids.map((b) => b.score) }],
                      }}
                    />
                  </details>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Nenhum contrato neste recorte"
          description="Os estados abrem projetos conforme arrecadação, orçamento livre e prazos. Amplie os filtros ou aguarde a próxima rodada."
        />
      )}
      {current && (
        <Modal title="Enviar proposta ao contrato público" onClose={() => setSelected(undefined)}>
          <p>
            {current.title} · {num(current.quantity)} {products[current.product].unit}. Propor não
            despacha nem recebe dinheiro.
          </p>
          <Select
            label="Origem da proposta pública"
            value={originId}
            onChange={(ev) => setOrigin(ev.target.value)}
          >
            <option value="">Escolher meu estoque</option>
            {eligible.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {num(e.inventory[current.product] ?? 0)} em estoque
              </option>
            ))}
          </Select>
          <Select
            label="Frota da proposta pública"
            value={carrier}
            onChange={(ev) => setCarrier(ev.target.value)}
          >
            <option value="">Escolher transportadora</option>
            {world.companies
              .filter(
                (c) =>
                  (c.bot || c.id === actor) && world.vehicles.some((v) => v.companyId === c.id),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === actor ? 'Minha frota' : c.name}
                </option>
              ))}
          </Select>
          <label className="field">
            Preço proposto por unidade (R$)
            <input
              aria-label="Preço da proposta pública"
              type="number"
              min=".01"
              step=".01"
              value={price / 100}
              onChange={(ev) => setPrice(Math.round(Number(ev.target.value) * 100))}
            />
          </label>
          {origin && (
            <Rows
              rows={[
                {
                  label: 'Qualidade do estoque',
                  value: `${num(inventoryQuality(origin, current.product))}/100`,
                },
                { label: 'Receita proposta de material', value: cr(price * current.quantity) },
                { label: 'Frete estimado', value: q ? cr(q.price) : 'Escolher transporte' },
                {
                  label: 'Número de caminhões',
                  value: q?.compatible ? q.parts.length : 'Verificar frota',
                },
                {
                  label: 'Custo contábil do material',
                  value: cr((origin.unitCosts[current.product] ?? 0) * current.quantity),
                },
              ]}
            />
          )}
          <p className="small muted">
            A melhor proposta viável será contratada ao fechar a janela. Não há pagamento garantido
            apenas por participar; o estoque precisa continuar disponível na adjudicação.
          </p>
          <button
            className="primary full"
            disabled={
              pending ||
              !origin ||
              !q?.compatible ||
              price <= 0 ||
              price > current.unitPrice ||
              (origin.inventory[current.product] ?? 0) < current.quantity ||
              inventoryQuality(origin, current.product) < current.minQuality ||
              q.price > current.maxFreight ||
              Boolean(current.biddingEndsAt && now >= current.biddingEndsAt)
            }
            onClick={async () => {
              if (
                await run(
                  current.biddingEndsAt
                    ? {
                        type: 'bidInfrastructure',
                        contractId: current.id,
                        establishmentId: origin!.id,
                        carrierId: carrier,
                        unitPrice: price,
                      }
                    : {
                        type: 'fulfillInfrastructure',
                        contractId: current.id,
                        establishmentId: origin!.id,
                        carrierId: carrier,
                        expectedFreight: q!.price,
                      },
                  current.biddingEndsAt
                    ? 'Proposta registrada para a disputa.'
                    : 'Contrato legado despachado.',
                )
              )
                setSelected(undefined);
            }}
          >
            Registrar proposta
          </button>
        </Modal>
      )}
    </div>
  );
}
