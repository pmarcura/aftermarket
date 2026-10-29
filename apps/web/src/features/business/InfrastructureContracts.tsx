import { FleetPicker } from '../../components/FleetPicker';
import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Empty, Modal, Rows, Select, Progress } from '../../components/ui';
import { BarrasPixel } from '../../components/BarrasPixel';
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
import { useRoute } from '../../lib/routing';
import { Pagination, usePagination } from '../../components/Pagination';
import { ProdutoArte } from '../economy/Vitrine';
import { ShieldCheck, Timer, Trophy, Users } from 'lucide-react';
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
    .reverse()
    .sort(
      (a, b) =>
        ['open', 'delivering', 'completed', 'expired'].indexOf(a.status) -
        ['open', 'delivering', 'completed', 'expired'].indexOf(b.status),
    );
  const page = usePagination(contracts, (c) =>
    [c.id, c.title, c.municipality, c.state, products[c.product].name].join(' '),
  );
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
  const routeLoading = useRoute(
    origin?.propertyId,
    world.establishments.find((e) => e.id === current?.destinationId)?.propertyId,
  );
  return (
    <div className="business-section">
      <div className="ed-topo">
        <div className="ed-caixa">
          <div>
            <b>
              {cr(
                government.reduce((n, c) => n + c.balance, 0),
                0,
              )}
            </b>
            <span>no caixa das prefeituras e estados{state ? ` de ${state}` : ''}</span>
          </div>
          <div>
            <b>{cr(treasuryReserved(world, state || undefined), 0)}</b>
            <span>já prometidos a contratos</span>
          </div>
          <div className="livre">
            <b>{cr(treasuryAvailable(world, state || undefined), 0)}</b>
            <span>livres para novos editais</span>
          </div>
        </div>
        <figure className="ed-regra">
          <figcaption>Como a vencedora é escolhida</figcaption>
          <div className="ed-regra-barra" aria-hidden="true">
            <i style={{ flex: 45 }}>Qualidade 45</i>
            <i style={{ flex: 25 }}>Preço 25</i>
            <i style={{ flex: 20 }}>Prazo 20</i>
            <i style={{ flex: 10 }}>Frete 10</i>
          </div>
          <small>
            Pontos de 100. O teto por unidade é a referência interna + 25%; caixa e estoque são
            conferidos no fechamento.
          </small>
        </figure>
        <div className="ed-filtros">
          <div role="group" aria-label="Estado dos contratos públicos">
            {[
              '',
              ...world.infrastructure
                .map((c) => c.state ?? '')
                .filter(Boolean)
                .sort(),
            ]
              .filter((uf, i, all) => all.indexOf(uf) === i)
              .map((uf) => (
                <button
                  key={uf || 'todos'}
                  aria-pressed={state === uf}
                  className={state === uf ? 'on' : ''}
                  onClick={() => setState(uf)}
                >
                  {uf || 'Todos os estados'}
                </button>
              ))}
          </div>
          <div role="group" aria-label="Situação dos contratos públicos">
            {[
              ['', 'Todos'],
              ['open', 'Em disputa'],
              ['delivering', 'Em entrega'],
              ['completed', 'Concluídos'],
              ['expired', 'Sem vencedor'],
            ].map(([v, rot]) => (
              <button
                key={v || 'todos'}
                aria-pressed={status === v}
                className={status === v ? 'on' : ''}
                onClick={() => setStatus(v)}
              >
                {rot}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Pagination value={page} label="contratos públicos" />
      {page.rows.length ? (
        <div className="infrastructure-cards">
          {page.rows.map((c) => {
            const destination = world.establishments.find((e) => e.id === c.destinationId)!,
              p = world.properties.find((p) => p.id === destination.propertyId)!,
              open = c.status === 'open' && (!c.biddingEndsAt || now < c.biddingEndsAt),
              cap = c.referencePrice ? Math.round(c.referencePrice * 1.25) : c.unitPrice;
            return (
              <article className={`edital ${c.status}`} key={c.id}>
                <div className="ed-arte">
                  <ProdutoArte product={c.product} />
                  <span className="ed-uf">{c.state ?? p.state}</span>
                </div>
                <div className="ed-corpo">
                  <div className="ed-linha">
                    <span className={`ed-status ${c.status}`}>
                      {
                        {
                          open: 'Em disputa',
                          delivering: 'Em entrega',
                          completed: 'Concluído',
                          expired: 'Sem vencedor',
                        }[c.status]
                      }
                    </span>
                    {open && c.biddingEndsAt && (
                      <span className="ed-relogio">
                        <Timer size={13} aria-hidden="true" /> encerra em{' '}
                        {(() => {
                          const t = Math.max(0, Math.ceil((c.biddingEndsAt - now) / 1000));
                          return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
                        })()}
                      </span>
                    )}
                  </div>
                  <h3>
                    Prefeitura de {c.municipality ?? p.city} compra {num(c.quantity)}{' '}
                    {products[c.product].unit} de {products[c.product].name}
                  </h3>
                  <small className="ed-sub">
                    {c.title} · #{c.id.slice(0, 6)}
                  </small>
                  <div className="ed-valor">
                    <b>{cr(cap * c.quantity, 0)}</b>
                    <span>
                      pagos no máximo · até {cr(cap)} por {products[c.product].unit}
                    </span>
                  </div>
                  <div className="ed-selos">
                    <span>
                      <ShieldCheck size={13} aria-hidden="true" /> qualidade mínima {c.minQuality}
                    </span>
                    <span>
                      <Users size={13} aria-hidden="true" /> {c.bids?.length ?? 0}{' '}
                      {(c.bids?.length ?? 0) === 1 ? 'proposta' : 'propostas'}
                    </span>
                    {c.supplierId && (
                      <span>
                        <Trophy size={13} aria-hidden="true" />{' '}
                        {c.supplierId === actor
                          ? 'você venceu'
                          : world.companies.find((x) => x.id === c.supplierId)?.name}
                      </span>
                    )}
                  </div>
                  {c.status !== 'open' && c.status !== 'expired' && (
                    <div className="ed-entrega">
                      <Progress value={(c.deliveredQuantity / c.quantity) * 100} />
                      <small>
                        {num(c.deliveredQuantity)} de {num(c.quantity)} {products[c.product].unit}{' '}
                        entregues{c.paid ? ` · ${cr(c.paid)} pagos` : ''}
                      </small>
                    </div>
                  )}
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
                                  <td>
                                    {world.companies.find((x) => x.id === b.supplierId)?.name}
                                  </td>
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
                      <BarrasPixel
                        titulo="Pontuação real das propostas do contrato, de 0 a 100"
                        maximo={100}
                        formato={(v) => num(v, 1)}
                        itens={c.bids.map((b) => ({
                          rotulo:
                            world.companies.find((x) => x.id === b.supplierId)?.name ?? 'Empresa',
                          valor: b.score,
                          tom:
                            b.status === 'won'
                              ? 'lavoura'
                              : b.status === 'valid'
                                ? 'ceu'
                                : 'apagado',
                          nota: b.status === 'won' ? 'vencedora' : undefined,
                        }))}
                      />
                    </details>
                  )}
                </div>
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
        <Modal
          title="Enviar proposta ao contrato público"
          onClose={() => setSelected(undefined)}
          wide
          formLayout
        >
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
          <FleetPicker
            originId={originId}
            destinationId={current.destinationId}
            product={current.product}
            quantity={current.quantity}
            value={carrier}
            onChange={setCarrier}
            label="Frota da proposta pública"
          />
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
              routeLoading ||
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
