import { useState } from 'react';
import { Users, Save, GraduationCap } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Rows, Progress } from '../../components/ui';
import { EconomicChart } from '../../components/EconomicChart';
import { type Establishment } from '../../../../../packages/simulation/src/model';
import { laborMarket, operatingCosts } from '../../../../../packages/simulation/src/metrics';
import {
  productionCapacity,
  retailCapacity,
} from '../../../../../packages/simulation/src/operations';
import { trainingQuote } from '../../../../../packages/simulation/src/competition';
import { useClock } from '../../lib/clock';
export function Workforce({ establishment: e }: { establishment: Establishment }) {
  const { world, run, pending } = useGame(),
    now = useClock();
  const [employees, setEmployees] = useState(String(e.employees)),
    [confirm, setConfirm] = useState(false);
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    labor = laborMarket(world, p),
    costs = operatingCosts(world, e),
    count = Number(employees),
    valid = Number.isInteger(count) && count >= 0 && count <= 1000;
  const projected = operatingCosts(world, { ...e, employees: valid ? count : e.employees }),
    training = trainingQuote(world, e),
    active = world.training?.find((t) => t.establishmentId === e.id && !t.completed),
    history = world.stateWages?.[p.state]?.history ?? [];
  return (
    <div className="panel-content business-section">
      <div className="section-title">
        <div>
          <h3>
            <Users size={17} /> Equipe, remuneração e educação
          </h3>
          <p className="small muted">
            Há trabalhadores disponíveis em todas as praças. A folha depende da atividade, estado e
            evolução salarial interna.
          </p>
        </div>
        <Badge tone="blue">{e.employees} contratados</Badge>
      </div>
      <div className="business-two-col">
        <section>
          <h3>Planejar contratações</h3>
          <label className="field">
            Funcionários desejados
            <input
              aria-label="Funcionários desejados"
              type="number"
              min="0"
              max="1000"
              value={employees}
              onChange={(ev) => setEmployees(ev.target.value)}
            />
            <input
              aria-label="Régua de funcionários"
              type="range"
              min="0"
              max="300"
              value={Math.min(300, count || 0)}
              onChange={(ev) => setEmployees(ev.target.value)}
            />
          </label>
          <Rows
            rows={[
              { label: 'Salário mensal por funcionário', value: cr(labor.monthlySalary) },
              { label: 'Folha atual / dia', value: cr(costs.payroll) },
              { label: 'Folha após ajuste / dia', value: cr(projected.payroll) },
              { label: 'Variação diária', value: cr(projected.payroll - costs.payroll) },
            ]}
          />
          <button
            className="primary"
            disabled={pending || !valid || count === e.employees || Boolean(active)}
            onClick={() =>
              void run(
                { type: 'setWorkforce', establishmentId: e.id, employees: count },
                'Equipe e folha atualizadas.',
              )
            }
          >
            <Save size={16} />
            Aplicar equipe
          </button>
        </section>
        <section>
          <h3>Remuneração em {p.state}</h3>
          <Rows
            rows={[
              { label: 'Contratação regional', value: 'Disponível' },
              { label: 'Multiplicador estadual', value: `${num(labor.factor, 2)}×` },
              { label: 'Índice interno da temporada', value: `${num(labor.index, 3)}×` },
              {
                label: 'Encargos do cenário',
                value: `${num((world.season.config.parameters.payrollBurden - 1) * 100)}%`,
              },
            ]}
          />
          <p className="formula-note">{labor.formula}</p>
          <p className="small muted">
            Índice revisto a cada sete dias do jogo com a massa salarial interna. Nenhum dado
            externo é atualizado durante a temporada.
          </p>
        </section>
      </div>
      {world.season.config.recipes
        .filter((r) => r.category === e.category)
        .map((r) => {
          const c = productionCapacity(world, e, r);
          return (
            <section className="capacity-rule" key={r.id}>
              <div className="section-title">
                <strong>{r.name}</strong>
                <Badge tone={c.lines ? 'green' : 'gold'}>{c.lines} linhas</Badge>
              </div>
              <Progress value={c.areaLines ? (c.lines / c.areaLines) * 100 : 0} />
              <Rows
                rows={[
                  { label: 'Por linha', value: `${c.workers} pessoas + ${num(c.areaM2)} m²` },
                  {
                    label: 'Limite por equipe / área',
                    value: `${c.laborLines} / ${c.areaLines} linhas`,
                  },
                  { label: 'Gargalo', value: c.bottleneck },
                ]}
              />
            </section>
          );
        })}
      {e.category === 'retail' && (
        <Rows
          rows={[
            {
              label: 'Atendimento compartilhado entre produtos',
              value: `${num(retailCapacity(world, e))} unidades / rodada de 2h`,
            },
          ]}
        />
      )}
      {['industry', 'farm', 'mine'].includes(e.category) && (
        <section className="education-panel">
          <div className="section-title">
            <div>
              <h3>
                <GraduationCap size={18} /> Educação da equipe
              </h3>
              <p className="small muted">
                Melhora a qualidade dos novos lotes. Estoque e produção já contratada mantêm a
                qualidade original. Novas contratações entram sem formação e reduzem a média da
                equipe.
              </p>
            </div>
            <Badge tone="blue">Formação média {num(e.education ?? 0, 2)} / 5</Badge>
          </div>
          <Progress value={((e.education ?? 0) / 5) * 100} />
          {active ? (
            <p className="positive">
              Treinamento pago em andamento · nível {active.targetLevel} ·{' '}
              {Math.max(0, Math.ceil((active.finishesAt - now) / 1000))} s reais restantes.
            </p>
          ) : (
            <>
              <Rows
                rows={[
                  {
                    label: 'Próximo nível',
                    value: training.targetLevel <= 5 ? training.targetLevel : 'Máximo atingido',
                  },
                  { label: 'Custo total de educação', value: cr(training.cost) },
                  {
                    label: 'Base de cobrança',
                    value: `${e.employees} funcionários × ${cr(world.season.config.competition.educationPerWorker)} × nível ${training.targetLevel}`,
                  },
                  {
                    label: 'Duração no jogo',
                    value: `${world.season.config.competition.educationHours} horas`,
                  },
                  {
                    label: 'Melhoria dos novos produtos',
                    value: `+${num(training.qualityGain, 2)} pontos de qualidade, limitada a 100`,
                  },
                ]}
              />
              <button
                className="secondary"
                disabled={pending || e.employees === 0 || training.targetLevel > 5}
                onClick={() => setConfirm(!confirm)}
              >
                Planejar investimento em educação
              </button>
              {confirm && (
                <div className="business-advice">
                  <p>
                    Pagamento imediato de <strong>{cr(training.cost)}</strong>. A melhoria entra ao
                    concluir; a produção pode continuar. Alterar a equipe fica bloqueado durante o
                    treinamento.
                  </p>
                  <button
                    className="primary"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await run(
                          { type: 'trainWorkforce', establishmentId: e.id },
                          'Educação paga. Treinamento iniciado.',
                        )
                      )
                        setConfirm(false);
                    }}
                  >
                    Pagar educação e iniciar
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <h3>Histórico do índice salarial de {p.state}</h3>
      <EconomicChart
        label="Evolução interna dos salários estaduais"
        height={220}
        option={{
          color: ['#70bfc4'],
          tooltip: { trigger: 'axis' },
          grid: { left: 55, right: 20, top: 30, bottom: 40 },
          xAxis: {
            type: 'category',
            data: history.map((h) => new Date(h.at).toLocaleDateString('pt-BR')),
          },
          yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#2a4550' } } },
          series: [{ type: 'line', data: history.map((h) => h.index), showSymbol: true }],
        }}
      />
    </div>
  );
}
