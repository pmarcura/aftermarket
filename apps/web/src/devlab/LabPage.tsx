import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react';
import { Activity, ArrowLeft, Download, FlaskConical, Play, Square } from 'lucide-react';
import type { LabOptions, LabReport } from '../../../../packages/simulation/src/lab';
import { EconomicChart } from '../components/EconomicChart';
import type { LabBatchRequest, LabWorkerMessage } from './lab.worker';
import { LabInspection } from './LabInspection';
import { LabParameters, initialParameters, type LabParametersValue } from './LabParameters';
import './lab.css';

type Result = { side: 'A' | 'B'; seed: number; report: LabReport };
type Scenario = LabOptions['scenario'];
const names: Record<Scenario, string> = {
  baseline: 'Mundo de referência',
  playtest: 'Mundo jogável (começo enxuto)',
};
const money = (n: number) =>
  (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (n: number, digits = 0) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const end = (r: Result) => r.report.observations.at(-1)!;
const keyOf = (r: Result) => `${r.side}-${r.seed}`;
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function LabPage() {
  const [results, setResults] = useState<Result[]>([]);
  return (
    <div className="lab-shell">
      <a className="skip-link" href="#lab-content">
        Ir para o laboratório
      </a>
      <header className="lab-header">
        <div className="lab-brand">
          <FlaskConical size={29} />
          <div>
            <strong>AFTERMARKET</strong>
            <span>Laboratório de desenvolvimento</span>
          </div>
        </div>
        <a className="secondary lab-back" href="/jogar">
          <ArrowLeft size={15} /> Abrir jogo
        </a>
      </header>
      <div className="lab-intro">
        <h1>Entender antes de ajustar.</h1>
        <p>Observe a economia e acompanhe os bots em simulações reproduzíveis.</p>
      </div>
      <main id="lab-content" className="lab-content">
        <SimulationPanel results={results} setResults={setResults} />
      </main>
    </div>
  );
}

function SimulationPanel({
  results,
  setResults,
}: {
  results: Result[];
  setResults: Dispatch<SetStateAction<Result[]>>;
}) {
  const workerRef = useRef<Worker | null>(null);
  const [scenarioA, setScenarioA] = useState<Scenario>('baseline'),
    [scenarioB, setScenarioB] = useState<Scenario>('playtest');
  const [demandA, setDemandA] = useState(1),
    [demandB, setDemandB] = useState(1);
  const [parametersA, setParametersA] = useState<LabParametersValue>({ ...initialParameters }),
    [parametersB, setParametersB] = useState<LabParametersValue>({ ...initialParameters });
  const [seedMode, setSeedMode] = useState<LabOptions['seedMode']>('rotation');
  const [days, setDays] = useState(90),
    [seedStart, setSeedStart] = useState(0),
    [count, setCount] = useState(1);
  const [running, setRunning] = useState(false),
    [status, setStatus] = useState('Pronto para simular.'),
    [error, setError] = useState('');
  const [progress, setProgress] = useState(0),
    [selection, setSelection] = useState('A-0');
  const [metric, setMetric] = useState('obligations');
  useEffect(() => () => workerRef.current?.terminate(), []);
  const selected = results.find((r) => keyOf(r) === selection) ?? results[0];
  const final = selected ? end(selected) : undefined;
  function changeDays(value: number) {
    setDays(value);
    for (const update of [setParametersA, setParametersB])
      update((previous) => ({
        ...previous,
        shock: previous.shock
          ? { ...previous.shock, day: Math.max(1, Math.min(previous.shock.day, value)) }
          : undefined,
      }));
  }
  function stop() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
    setStatus('Lote cancelado. Execuções já concluídas permanecem disponíveis.');
  }
  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResults([]);
    setProgress(0);
    setRunning(true);
    setStatus('Preparando mundos isolados…');
    setSelection(`A-${seedStart}`);
    let worker: Worker;
    try {
      worker = new Worker(new URL('./lab.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setRunning(false);
      setError(
        'O navegador não conseguiu iniciar a simulação. Recarregue o laboratório e tente novamente.',
      );
      return;
    }
    workerRef.current = worker;
    const finish = () => {
      worker.terminate();
      workerRef.current = null;
      setRunning(false);
    };
    worker.onmessage = ({ data }: MessageEvent<LabWorkerMessage>) => {
      if (data.type === 'progress') {
        setProgress(((data.run - 1 + data.progress.percent / 100) / data.total) * 100);
        setStatus(
          `${data.side} · semente ${data.seed} · dia ${data.progress.day}/${data.progress.days} · execução ${data.run}/${data.total}`,
        );
      } else if (data.type === 'result') {
        setResults((previous) => [
          ...previous,
          { side: data.side, seed: data.seed, report: data.report },
        ]);
      } else if (data.type === 'done') {
        setProgress(100);
        setStatus('Lote concluído. Compare resultados e examine os alertas.');
        finish();
      } else {
        setError(data.message);
        setStatus('Execução interrompida por erro. Revise os parâmetros e tente novamente.');
        finish();
      }
    };
    worker.onerror = (event) => {
      setError(event.message || 'O worker falhou. Recarregue o laboratório e tente novamente.');
      finish();
    };
    const request: LabBatchRequest = {
      a: { scenario: scenarioA, days, demandMultiplier: demandA, seedMode, ...parametersA },
      b: { scenario: scenarioB, days, demandMultiplier: demandB, seedMode, ...parametersB },
      seeds: Array.from({ length: count }, (_, index) => seedStart + index),
    };
    worker.postMessage(request);
  }
  const chart = useMemo(() => {
    const itemId = metric.startsWith('item:') ? metric.slice(5) : undefined;
    const label = itemId
      ? `Oferta de ${final?.items.find((item) => item.id === itemId)?.name ?? itemId}`
      : metric === 'obligations'
        ? 'Obrigações em aberto (R$)'
        : 'Caixa privado (R$)';
    return {
      label,
      option: {
        animation: false,
        legend: {},
        xAxis: {
          type: 'category',
          name: 'Dia simulado',
          data: results[0]?.report.observations.map((row) => row.day) ?? [],
        },
        yAxis: { type: 'value', name: itemId ? 'Unidades do item' : 'R$' },
        series: results.map((r) => ({
          type: 'line',
          name: `${r.side} / s${r.seed}`,
          showSymbol: false,
          data: r.report.observations.map((row) =>
            itemId
              ? (row.items.find((item) => item.id === itemId)?.offered ?? null)
              : (metric === 'obligations' ? row.health.obligations : row.health.privateCash) / 100,
          ),
        })),
      },
    };
  }, [results, metric, final]);
  return (
    <div className="lab-workbench">
      <aside className="lab-panel lab-experiment">
        <h2>Experimento comparável</h2>
        <p className="lab-muted">
          A e B usam as mesmas sementes e o mesmo horizonte. Mude um fator por vez.
        </p>
        <form onSubmit={start}>
          <fieldset disabled={running}>
            <legend>Horizonte e repetição</legend>
            <div className="lab-presets" role="group" aria-label="Horizontes de simulação">
              {[30, 90, 365].map((preset) => (
                <button
                  type="button"
                  className="secondary"
                  key={preset}
                  aria-pressed={days === preset}
                  onClick={() => changeDays(preset)}
                >
                  {preset} dias
                </button>
              ))}
            </div>
            <label>
              Dias simulados
              <input
                type="number"
                min={1}
                max={365}
                required
                value={days}
                onChange={(e) => changeDays(Number(e.target.value))}
              />
            </label>
            <div className="lab-field-pair">
              <label>
                Semente inicial
                <input
                  type="number"
                  min={0}
                  max={10000 - count + 1}
                  required
                  value={seedStart}
                  onChange={(e) => setSeedStart(Number(e.target.value))}
                />
              </label>
              <label>
                Sementes no lote
                <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Variação das sementes
              <select
                value={seedMode}
                onChange={(event) => setSeedMode(event.target.value as LabOptions['seedMode'])}
              >
                <option value="rotation">Rotação das estratégias</option>
                <option value="conditions">Condições iniciais e orçamento</option>
              </select>
              <small>
                Condições variam capital e orçamentos determinísticos; preservam o dinheiro total.
              </small>
            </label>
          </fieldset>
          {(['A', 'B'] as const).map((side) => (
            <fieldset disabled={running} key={side}>
              <legend>Cenário {side}</legend>
              <label>
                Configuração
                <select
                  value={side === 'A' ? scenarioA : scenarioB}
                  onChange={(e) =>
                    (side === 'A' ? setScenarioA : setScenarioB)(e.target.value as Scenario)
                  }
                >
                  {Object.entries(names).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Multiplicador da demanda familiar
                <input
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.1}
                  required
                  value={side === 'A' ? demandA : demandB}
                  onChange={(e) => (side === 'A' ? setDemandA : setDemandB)(Number(e.target.value))}
                />
                <small>Aplicado sobre a demanda do cenário escolhido.</small>
              </label>
              <LabParameters
                value={side === 'A' ? parametersA : parametersB}
                onChange={side === 'A' ? setParametersA : setParametersB}
                days={days}
              />
            </fieldset>
          ))}
          <div className="lab-run-actions">
            <button className="primary" type="submit" disabled={running}>
              <Play size={15} /> Iniciar lote
            </button>
            <button className="secondary" type="button" disabled={!running} onClick={stop}>
              <Square size={14} /> Cancelar
            </button>
          </div>
        </form>
        <div className="lab-progress">
          <progress max={100} value={progress} aria-label="Progresso do lote" />
          <p role="status" aria-live="polite">
            {status}
          </p>
        </div>
        {error && (
          <p className="lab-error" role="alert">
            {error}
          </p>
        )}
        <p className="lab-footnote">
          Mundos novos em memória. Tempo acelerado, sem ações humanas, banco salvo ou serviços de
          rota. Rotas estimadas.
        </p>
      </aside>
      <section className="lab-results" aria-label="Resultados das simulações">
        {!results.length ? (
          <div className="lab-empty">
            <Activity size={35} />
            <h2>{running ? 'Os bots estão jogando.' : 'Uma season inteira, observável.'}</h2>
            <p>
              {running
                ? 'O progresso aparece à esquerda. Cada execução concluída libera suas séries e diagnósticos.'
                : 'Inicie um lote para acompanhar caixa, estoque, concentração e sobrevivência das empresas ao longo dos dias.'}
            </p>
            <p className="lab-muted">
              O tempo real será medido nesta máquina. Os números serão exibidos em reais; o motor
              usa centavos inteiros.
            </p>
          </div>
        ) : (
          <>
            <div className="lab-section-head">
              <div>
                <h2>Comparação A/B</h2>
                <p className="lab-muted">
                  Médias dos pares completos; a direção desejável depende da hipótese.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  download('aftermarket-laboratorio.json', { schemaVersion: 1, results })
                }
              >
                <Download size={15} /> Exportar lote JSON
              </button>
            </div>
            <Comparison results={results} />
            <section className="lab-panel">
              <div className="lab-section-head">
                <h2>Evolução diária</h2>
                <label className="lab-inline-field">
                  Métrica
                  <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                    <option value="obligations">Obrigações em aberto</option>
                    <option value="privateCash">Caixa privado</option>
                    {final?.items.map((item) => (
                      <option key={item.id} value={`item:${item.id}`}>
                        Oferta: {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <EconomicChart label={chart.label} option={chart.option} height={315} />
            </section>
            <div className="lab-section-head">
              <div>
                <h2>Inspecionar execução</h2>
                <p className="lab-muted">Detalhes do último dia observado.</p>
              </div>
              <label className="lab-inline-field">
                Execução
                <select
                  value={selected ? keyOf(selected) : ''}
                  onChange={(e) => setSelection(e.target.value)}
                >
                  {results.map((r) => (
                    <option key={keyOf(r)} value={keyOf(r)}>
                      {r.side} / semente {r.seed} / {names[r.report.options.scenario]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selected && final && (
              <>
                <LabInspection report={selected.report} />
                <div className="lab-facts">
                  <div>
                    <span>Tempo medido</span>
                    <strong>{number(selected.report.performance.elapsedMs / 1000, 2)} s</strong>
                    <small>
                      {number(selected.report.performance.simulatedDaysPerSecond, 1)} dias/s
                    </small>
                  </div>
                  <div>
                    <span>Dinheiro conservado</span>
                    <strong>{selected.report.summary.moneyConserved ? 'Sim' : 'Falhou'}</strong>
                    <small>{money(final.money)}</small>
                  </div>
                  <div>
                    <span>Empresas com unidade ativa</span>
                    <strong>
                      {final.bots.filter((bot) => bot.active > 0).length}/{final.bots.length}
                    </strong>
                    <small>Inclui operadores anteriores.</small>
                  </div>
                  <div>
                    <span>Obrigações em aberto</span>
                    <strong>{money(final.health.obligations)}</strong>
                    <small>Dia {final.day}</small>
                  </div>
                </div>
                <section className="lab-panel">
                  <div className="lab-section-head">
                    <h2>Alertas observados</h2>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(`aftermarket-${keyOf(selected)}.json`, selected.report)
                      }
                    >
                      <Download size={14} /> JSON da execução
                    </button>
                  </div>
                  {selected.report.summary.alerts.length ? (
                    <ul className="lab-alerts">
                      {selected.report.summary.alerts.map((alert, index) => (
                        <li key={`${alert.code}-${index}`}>
                          <span
                            className={`lab-tag ${alert.severity === 'warning' ? 'lab-tag-warning' : ''}`}
                          >
                            {alert.code}
                          </span>
                          <span>{alert.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="lab-muted">
                      Nenhum alerta pelas heurísticas atuais. Isso não comprova equilíbrio.
                    </p>
                  )}
                </section>
                <section className="lab-panel">
                  <h2>Mercadorias no dia {final.day}</h2>
                  <p className="lab-muted">
                    HHI de receita por empresa nos últimos sete dias; sem negócio = sem concentração
                    calculável.
                  </p>
                  <div
                    className="lab-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Tabela de mercadorias"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Preço de oferta</th>
                          <th>Oferta</th>
                          <th>Estoque físico</th>
                          <th>Fornecedores</th>
                          <th>HHI</th>
                          <th>Dias sem oferta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {final.items.map((item) => (
                          <tr key={item.id}>
                            <th>
                              {item.name}
                              <small>{item.unit}</small>
                            </th>
                            <td>{item.price === null ? 'Sem oferta' : money(item.price)}</td>
                            <td>{number(item.offered)}</td>
                            <td>{number(item.physical)}</td>
                            <td>{item.suppliers}</td>
                            <td>{item.hhi === null ? 'Sem negócio' : number(item.hhi)}</td>
                            <td>
                              {selected.report.summary.productTrends.find(
                                (trend) => trend.id === item.id,
                              )?.daysWithoutOffers ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="lab-footnote">
                    Dias sem oferta contam observações diárias após a abertura. Oferta é
                    disponibilidade anunciada; estoque físico inclui inventário nas unidades.
                  </p>
                </section>
                <section className="lab-panel">
                  <h2>Como as empresas terminaram</h2>
                  <p className="lab-muted">
                    Decisões acumulam comandos bem-sucedidos do diretor por tick. Não cobrem toda
                    automação, tentativa ou inação; as últimas três ações ajudam a contextualizar.
                  </p>
                  <div
                    className="lab-table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Tabela de bots"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Empresa / estratégia</th>
                          <th>Caixa</th>
                          <th>Unidades ativas / pausadas</th>
                          <th>Obrigações</th>
                          <th>Principal de crédito</th>
                          <th>Decisões registradas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {final.bots.map((bot) => (
                          <tr key={bot.id}>
                            <th>
                              <details>
                                <summary>{bot.name}</summary>
                                <p>
                                  {bot.cohort} / {bot.strategy}
                                </p>
                                <ul>
                                  {bot.lastActions.map((action, index) => (
                                    <li key={index}>
                                      Dia {number(action.day, 1)}: {action.text}{' '}
                                      <small>{action.kind}</small>
                                    </li>
                                  ))}
                                </ul>
                                {!bot.lastActions.length && <p>Sem ação no registro disponível.</p>}
                              </details>
                            </th>
                            <td>{money(bot.balance)}</td>
                            <td>
                              {bot.active} / {bot.paused}
                            </td>
                            <td>{money(bot.obligations)}</td>
                            <td>{money(bot.outstandingPrincipal)}</td>
                            <td>{bot.decisions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <details className="lab-panel">
                  <summary>Proveniência, configuração e limites da execução</summary>
                  <p>{selected.report.metadata.seedMeaning}</p>
                  <pre>{JSON.stringify(selected.report.metadata, null, 2)}</pre>
                </details>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Comparison({ results }: { results: Result[] }) {
  const pairs = results
    .filter((r) => r.side === 'A')
    .flatMap((a) => {
      const b = results.find((r) => r.side === 'B' && r.seed === a.seed);
      return b ? [{ a, b }] : [];
    });
  if (!pairs.length)
    return <p className="lab-muted">Aguardando A e B da mesma semente para comparar.</p>;
  const rows = [
    {
      label: 'Empresas com unidade ativa',
      get: (r: Result) => end(r).bots.filter((bot) => bot.active > 0).length,
      format: (v: number) => number(v, 1),
    },
    { label: 'Obrigações em aberto', get: (r: Result) => end(r).health.obligations, format: money },
    { label: 'Caixa privado', get: (r: Result) => end(r).health.privateCash, format: money },
    {
      label: 'Itens sem oferta no final',
      get: (r: Result) => end(r).items.filter((item) => item.withoutOffers).length,
      format: (v: number) => number(v, 1),
    },
    {
      label: 'Remessas entregues',
      get: (r: Result) => end(r).delivered,
      format: (v: number) => number(v, 1),
    },
  ];
  return (
    <div className="lab-panel">
      <p className="lab-muted">
        {pairs.length} {pairs.length === 1 ? 'par completo' : 'pares completos'} · B menos A
      </p>
      <div className="lab-table-wrap" tabIndex={0} role="region" aria-label="Comparação pareada">
        <table>
          <thead>
            <tr>
              <th>Métrica final</th>
              <th>Média A</th>
              <th>Média B</th>
              <th>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const a = pairs.reduce((sum, p) => sum + row.get(p.a), 0) / pairs.length,
                b = pairs.reduce((sum, p) => sum + row.get(p.b), 0) / pairs.length;
              return (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td>{row.format(a)}</td>
                  <td>{row.format(b)}</td>
                  <td>
                    {b > a ? '+' : ''}
                    {row.format(b - a)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="lab-footnote">
        Sementes rotacionam estratégias dos bots; não representam uma amostra aleatória de jogadores
        humanos. Examine cada execução no JSON.
      </p>
    </div>
  );
}
