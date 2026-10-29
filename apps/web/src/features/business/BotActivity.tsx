import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Select, Progress } from '../../components/ui';
import { BarrasPixel } from '../../components/BarrasPixel';
import { institutional } from '../../../../../packages/simulation/src/competition';
import { Pagination, usePagination } from '../../components/Pagination';
import { gameCalendar } from '../../../../../packages/simulation/src/operations';
export function BotActivity() {
  const { world } = useGame();
  const [state, setState] = useState('');
  const bots = world.companies.filter(
    (c) =>
      c.bot &&
      !institutional(c.id) &&
      (!state ||
        world.establishments.some(
          (e) =>
            e.companyId === c.id &&
            world.properties.find((p) => p.id === e.propertyId)?.state === state,
        )),
  );
  const actions = (world.botActivity ?? [])
    .filter((a) => bots.some((b) => b.id === a.companyId))
    .reverse();
  const page = usePagination(actions, (a) =>
    [a.text, world.companies.find((c) => c.id === a.companyId)?.name].join(' '),
  );
  const kinds = [
    'createPurchaseRequest',
    'proposeOrder',
    'acceptOrder',
    'acceptProposal',
    'bidInfrastructure',
    'trainWorkforce',
  ];
  return (
    <div className="panel-content">
      <div className="section-title">
        <div>
          <h3>Concorrentes em atividade</h3>
          <p className="small muted">
            {world.companies.filter((c) => c.id.startsWith('rival-')).length} novas empresas +
            operadores existentes. Ações e recursos pertencem ao mundo compartilhado.
          </p>
        </div>
        <Select
          label="Estado dos concorrentes"
          value={state}
          onChange={(ev) => setState(ev.target.value)}
        >
          <option value="">Estado (opcional)</option>
          {[...new Set(world.properties.map((p) => p.state))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <div className="supply-kpis">
        <div>
          <span>Empresas automatizadas no recorte</span>
          <strong>{bots.length}</strong>
        </div>
        <div>
          <span>Pedidos em negociação</span>
          <strong>
            {
              world.orders.filter(
                (o) =>
                  o.status === 'pending' &&
                  bots.some((b) => b.id === o.buyerId || b.id === o.sellerId),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Viagens ativas</span>
          <strong>
            {
              world.shipments.filter(
                (s) => !s.delivered && bots.some((b) => b.id === s.buyerId || b.id === s.sellerId),
              ).length
            }
          </strong>
        </div>
      </div>
      <div className="business-two-col">
        <div>
          <h3>Últimas decisões observadas</h3>
          <Pagination value={page} label="ações dos bots" />
          {actions.length ? (
            page.rows.map((a, i) => (
              <div className="bot-event" key={`${a.companyId}-${a.at}-${i}`}>
                <Badge tone="blue">BOT</Badge>
                <div>
                  <strong>{world.companies.find((c) => c.id === a.companyId)?.name}</strong>
                  <p>{a.text}</p>
                  <small>
                    {gameCalendar(world, a.at).date.toLocaleString('pt-BR', { timeZone: 'UTC' })}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">
              As próximas rodadas registrarão decisões, propostas e investimentos. Não são eventos
              decorativos.
            </p>
          )}
        </div>
        <div>
          <h3>Decisões registradas por tipo</h3>
          <BarrasPixel
            titulo="Atividade efetiva de negociação dos bots"
            formato={(v) => num(v)}
            itens={kinds.map((k, i) => ({
              rotulo: ['Pedidos', 'Propostas', 'Aceites', 'Negociações', 'Licitações', 'Educação'][
                i
              ],
              valor: (world.botActivity ?? []).filter(
                (a) => a.kind === k && bots.some((b) => b.id === a.companyId),
              ).length,
              tom: 'ceu' as const,
            }))}
          />
          <p className="small muted">
            Concorrentes negociam, produzem, contratam transporte, disputam projetos, investem na
            equipe e avaliam expansão ou recuperação. As decisões mostradas foram executadas com
            dinheiro e estoques próprios.
          </p>
        </div>
      </div>
      <details>
        <summary>Ver empresas, caixa e operação</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Perfil</th>
                <th>Caixa real</th>
                <th>Operação</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((b) => {
                const units = world.establishments.filter((e) => e.companyId === b.id),
                  jobs = world.jobs.filter(
                    (j) => !j.completed && units.some((e) => e.id === j.establishmentId),
                  ).length;
                return (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.strategy ?? 'regional'}</td>
                    <td>{cr(b.balance)}</td>
                    <td>
                      {jobs
                        ? `${jobs} lotes em produção`
                        : `${units.filter((e) => e.enabled).length} unidades ativas`}
                      <Progress
                        value={
                          units.length
                            ? (units.filter((e) => e.enabled).length / units.length) * 100
                            : 0
                        }
                      />
                      <small>
                        {num(
                          world.shipments.filter(
                            (s) =>
                              !s.delivered && [s.buyerId, s.sellerId, s.carrierId].includes(b.id),
                          ).length,
                        )}{' '}
                        viagens ativas
                      </small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
