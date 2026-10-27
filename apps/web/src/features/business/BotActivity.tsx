import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Select, Progress } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import { institutional } from '../../../../../packages/simulation/src/competition';
import { botCapabilities } from '../../../../../packages/simulation/src/director';
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
    .slice(-15)
    .reverse();
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
          {actions.length ? (
            actions.map((a, i) => (
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
          <EconomicChart
            label="Atividade efetiva de negociação dos bots"
            height={260}
            option={{
              color: ['#74b4c5'],
              grid: { left: 45, right: 15, top: 20, bottom: 65 },
              tooltip: { trigger: 'axis' },
              xAxis: {
                type: 'category',
                data: ['Pedidos', 'Propostas', 'Aceites', 'Negociações', 'Licitações', 'Educação'],
                axisLabel: { rotate: 30 },
              },
              yAxis: { type: 'value' },
              series: [
                {
                  type: 'bar',
                  data: kinds.map(
                    (k) =>
                      (world.botActivity ?? []).filter(
                        (a) => a.kind === k && bots.some((b) => b.id === a.companyId),
                      ).length,
                  ),
                },
              ],
            }}
          />
          <p className="small muted">
            Capacidades da política v1: {botCapabilities.join(', ')}. Novas receitas devem estar
            cobertas pelos perfis e testes de atualização dos bots.
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
