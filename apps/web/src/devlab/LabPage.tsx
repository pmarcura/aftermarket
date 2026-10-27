import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react';
import { Activity, ArrowLeft, Download, FlaskConical, Play, RefreshCw, Square } from 'lucide-react';
import catalog from '../../../../docs/design/UI-CATALOG.json';
import type { LabOptions, LabReport } from '../../../../packages/simulation/src/lab';
import { EconomicChart } from '../components/EconomicChart';
import type { LabBatchRequest, LabWorkerMessage } from './lab.worker';
import type { UiCapture, UiEvidence } from './ui-evidence';
import { LabJournal } from './LabJournal';
import { LabInspection } from './LabInspection';
import { LabParameters, initialParameters, type LabParametersValue } from './LabParameters';
import { LabInterfaceFlows, LabBaselineComparison } from './LabInterfaceFlows';
import './lab.css';
import { LabStudyEvidence } from './LabStudyEvidence';

type Result = { side: 'A' | 'B'; seed: number; report: LabReport };
type Scenario = LabOptions['scenario'];
const names: Record<Scenario, string> = {
  baseline: 'Abertura atual',
  starter: 'Iniciante',
  'low-demand': 'Demanda reduzida',
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
  const [tab, setTab] = useState<'simulation' | 'interfaces' | 'method'>('simulation');
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
        <a className="secondary lab-back" href="/">
          <ArrowLeft size={15} /> Abrir jogo
        </a>
      </header>
      <div className="lab-intro">
        <h1>Entender antes de ajustar.</h1>
        <p>
          Observe a economia, acompanhe os bots e inspecione as telas com evidência reproduzível.
        </p>
      </div>
      <nav className="lab-tabs" aria-label="Áreas do laboratório">
        {(
          [
            ['simulation', 'Simulações'],
            ['interfaces', 'Interfaces'],
            ['method', 'Método'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main id="lab-content" className="lab-content">
        <div hidden={tab !== 'simulation'}>
          <SimulationPanel results={results} setResults={setResults} />
        </div>
        {tab === 'interfaces' && <InterfacesPanel />}
        {tab === 'method' && (
          <>
            <LabJournal reports={results} />
            <MethodPanel />
          </>
        )}
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
    [scenarioB, setScenarioB] = useState<Scenario>('low-demand');
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

function Capture({ capture }: { capture: UiCapture }) {
  const screenshot = `/__lab/ui/${capture.screenshot.split('/').map(encodeURIComponent).join('/')}`;
  return (
    <details className="lab-capture">
      <summary>
        {capture.state} · {capture.viewport}
        <span className="lab-tag">{capture.controls.length} controles</span>
        {capture.overflow && <span className="lab-tag lab-tag-warning">Overflow</span>}
      </summary>
      <p className="lab-muted">
        Teclado: {capture.keyboard || 'Sem registro'} · {capture.unnamed} controles sem nome
      </p>
      <a href={screenshot} target="_blank" rel="noreferrer">
        <img
          loading="lazy"
          src={screenshot}
          alt={`Captura de ${capture.screen}, estado ${capture.state}, ${capture.viewport}`}
        />
      </a>
      <details>
        <summary>Leitura da interface e controles</summary>
        <p>Títulos: {capture.headings.join(' / ') || 'Nenhum'}</p>
        <div className="lab-table-wrap" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Controle</th>
                <th>Nome acessível</th>
                <th>Valor</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {capture.controls.map((control, index) => (
                <tr key={index}>
                  <td>{control.role || control.tag}</td>
                  <td>{control.name || 'Sem nome'}</td>
                  <td>{control.value || '—'}</td>
                  <td>{control.disabled ? 'Desativado' : 'Ativo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre>{capture.text}</pre>
      </details>
    </details>
  );
}

function InterfacesPanel() {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(catalog.screens[0].id);
  const [evidence, setEvidence] = useState<UiEvidence>(),
    [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading'),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setEvidence(undefined);
    void fetch('/__lab/ui/index.json', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setEvidence(undefined);
          setState('missing');
          return;
        }
        if (!response.ok) throw new Error('Não foi possível carregar a evidência.');
        const data: UiEvidence = await response.json();
        if (
          data.schemaVersion !== 1 ||
          !Array.isArray(data.screens) ||
          !Array.isArray(data.globalStates) ||
          !data.summary
        )
          throw new Error('Formato de evidência incompatível.');
        setEvidence(data);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [reload]);
  const screens = catalog.screens.filter((screen) =>
    `${screen.title} ${screen.purpose} ${screen.task}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );
  const screen = catalog.screens.find((s) => s.id === selected)!;
  const files = catalog.files.filter((file) => screen.files.includes(file.path));
  const runtime = evidence?.screens.find((s) => s.id === screen.id);
  const stale =
    runtime &&
    (runtime.fingerprint !== screen.fingerprint ||
      evidence?.engineFingerprint !== catalog.fixtureFingerprint);
  const commands = [
    ...new Set(files.flatMap((file) => file.commands.map((command) => command.type))),
  ];
  return (
    <div className="lab-interface-view">
      <div className="lab-section-head">
        <div>
          <h2>Mapa das interfaces</h2>
          <p className="lab-muted">
            Fonte estática e observação de navegador, ligadas pela versão dos arquivos.
          </p>
        </div>
        <div className="lab-button-row">
          <button
            className="secondary"
            onClick={() => download('aftermarket-ui-catalogo.json', catalog)}
          >
            <Download size={14} /> Catálogo JSON
          </button>
          <button
            className="secondary"
            onClick={() => setReload((n) => n + 1)}
            disabled={state === 'loading'}
          >
            <RefreshCw size={14} /> Recarregar evidência
          </button>
        </div>
      </div>
      <div className="lab-panel lab-evidence-status" role="status">
        {state === 'loading' ? (
          'Carregando capturas…'
        ) : state === 'missing' ? (
          <>
            Ainda não há capturas locais. Execute <code>npm run lab:capture</code> e recarregue a
            evidência.
          </>
        ) : state === 'error' ? (
          <>
            A evidência não pôde ser lida. Execute <code>npm run lab:capture</code> para gerá-la
            novamente.
          </>
        ) : (
          evidence && (
            <>
              <strong>{evidence.summary.states} estados capturados</strong>
              <span>
                {evidence.summary.errors} erros · {evidence.summary.overflow} com overflow ·{' '}
                {evidence.summary.unnamed} controles sem nome
              </span>
              <small>
                Gerado em{' '}
                {new Date(evidence.generatedAt).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}{' '}
                · fixture: {evidence.fixture}
              </small>
            </>
          )
        )}
      </div>
      <div className="lab-screen-grid">
        <aside className="lab-panel lab-screen-list">
          <label>
            Buscar tela
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome ou tarefa…"
            />
          </label>
          <nav aria-label="Telas do jogo">
            {screens.map((s) => (
              <button key={s.id} aria-pressed={s.id === selected} onClick={() => setSelected(s.id)}>
                <strong>{s.title}</strong>
                <small>{s.purpose}</small>
              </button>
            ))}
          </nav>
          {!screens.length && <p>Nenhuma tela neste filtro. Reduza a busca.</p>}
        </aside>
        <section className="lab-screen-detail">
          <div className="lab-panel">
            <div className="lab-section-head">
              <h2>{screen.title}</h2>
              <span className={`lab-tag ${stale || !runtime ? 'lab-tag-warning' : ''}`}>
                {!runtime
                  ? 'Sem captura'
                  : stale
                    ? 'Captura desatualizada'
                    : 'Captura corresponde à fonte'}
              </span>
            </div>
            <p>{screen.purpose}</p>
            <p>
              <strong>Tarefa observável:</strong> {screen.task}
            </p>
            <p className="lab-muted">
              {screen.files.length} arquivos alcançáveis · {commands.length} comandos candidatos ·
              origem: <code>{screen.source}</code>
            </p>
            {stale && (
              <p className="lab-error">
                Os arquivos mudaram depois da captura. Gere nova evidência antes de concluir sobre o
                estado atual.
              </p>
            )}
          </div>
          <LabInterfaceFlows evidence={evidence} screenId={screen.id} />
          <LabBaselineComparison evidence={evidence} screenId={screen.id} />
          <section className="lab-panel">
            <h3>Estados observados no navegador</h3>
            <p className="lab-muted">
              A captura demonstra o estado visível da fixture. Controles encontrados não comprovam a
              execução de todos os fluxos.
            </p>
            {runtime?.captures.length ? (
              runtime.captures.map((capture, i) => (
                <Capture key={`${capture.state}-${capture.viewport}-${i}`} capture={capture} />
              ))
            ) : (
              <p className="lab-muted">
                Nenhum estado capturado para esta tela. O inventário estático continua disponível
                abaixo.
              </p>
            )}
            {runtime?.errors.map((error, i) => (
              <p className="lab-error" key={i}>
                {error}
              </p>
            ))}
          </section>
          <section className="lab-panel">
            <h3>Comandos candidatos encontrados no código</h3>
            <div className="lab-tags">
              {commands.map((command) => (
                <code className="lab-tag" key={command}>
                  {command}
                </code>
              ))}
            </div>
            {!commands.length && (
              <p className="lab-muted">
                Nenhum comando literal encontrado nos arquivos alcançáveis.
              </p>
            )}
            <p className="lab-footnote">
              A lista inclui componentes compartilhados e ramos condicionais. Confirmar a ação
              requer observar o comando e seu efeito no mundo.
            </p>
          </section>
          <section className="lab-panel">
            <h3>Fontes, componentes e textos</h3>
            <p className="lab-muted">{catalog.note}</p>
            {files.map((file) => (
              <details className="lab-source" key={file.path}>
                <summary>{file.path}</summary>
                <small>Hash: {file.hash}</small>
                <p>Componentes: {file.components.join(', ') || 'Nenhum exportado'}</p>
                {file.commands.length > 0 && (
                  <ul>
                    {file.commands.map((command, i) => (
                      <li key={i}>
                        <code>{command.type}</code> · linha {command.line}
                      </li>
                    ))}
                  </ul>
                )}
                <ul>
                  {file.literals.map((literal, i) => (
                    <li key={i}>
                      <span>{literal.text}</span>
                      <small>
                        {literal.kind} · linha {literal.line}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        </section>
      </div>
      <details className="lab-panel">
        <summary>Estados globais e testes relacionados</summary>
        <h3>Estados globais capturados</h3>
        {!evidence && (
          <p className="lab-muted">
            Nenhuma evidência carregada. Gere as capturas para observar estes estados.
          </p>
        )}
        {evidence?.globalStates.map((capture, i) => (
          <Capture key={i} capture={capture} />
        ))}
        <h3>Testes declarados no projeto</h3>
        <p className="lab-muted">
          Inventário de casos; o resultado de uma execução de testes é evidência separada.
        </p>
        {catalog.tests.map((test) => (
          <details className="lab-source" key={test.path}>
            <summary>{test.path}</summary>
            <ul>
              {test.cases.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          </details>
        ))}
      </details>
    </div>
  );
}

function MethodPanel() {
  return (
    <article className="lab-method lab-panel">
      <h2>Da observação à decisão</h2>
      <p>
        Use o laboratório para reduzir a distância entre uma suspeita e um experimento reproduzível.
        Uma season sem erro monetário pode continuar ruim para jogar.
      </p>
      <ol>
        <li>
          <h3>Observar</h3>
          <p>
            Encontre o primeiro dia em que falta oferta, cresce uma dívida ou uma empresa para. Abra
            mercadoria, empresa e estado da interface correspondentes. Registre números e a
            configuração.
          </p>
        </li>
        <li>
          <h3>Formular uma hipótese</h3>
          <p>
            Separe o sintoma do motivo. Estoque de farelo crescente pode indicar absorção
            insuficiente, escala de lote ou custo de transporte. O registro de ações não captura
            todos os motivos de inação.
          </p>
        </li>
        <li>
          <h3>Comparar um experimento</h3>
          <p>
            Mantenha horizonte e sementes, altere um fator e compare A/B. Examine distribuição entre
            empresas e dias, além da média final. Exporte o JSON para a análise detalhada.
          </p>
        </li>
        <li>
          <h3>Decidir com evidência</h3>
          <p>
            Aceite, rejeite ou refine a hipótese. Registre efeitos colaterais, execute invariantes e
            confirme a compreensão em playtest humano antes de fechar o balanceamento.
          </p>
        </li>
      </ol>
      <h3>O que este ambiente mede</h3>
      <p>
        O mesmo motor e os mesmos comandos do jogo, em cenários novos e isolados. Bots usam regras
        heurísticas; as sementes variam estratégias. Geografia offline é estimada. Tempos reais
        dependem do dispositivo e do horizonte.
      </p>
      <h3>Como ler os limites</h3>
      <p>
        HHI usa receita observada e não é calculado sem transações. Ausência de oferta anunciada
        difere de ausência física. Históricos retidos podem omitir ações anteriores; valores de
        estoque, caixa e dívida são estados atuais. A configuração completa acompanha cada
        relatório.
      </p>
      <h3>Referências e continuidade</h3>
      <LabStudyEvidence />
      <p>
        A pesquisa dos estúdios e as adaptações ficam em{' '}
        <code>docs/research/SIMULATION-LAB.md</code>. As telas são catalogadas a partir dos
        arquivos; as capturas usam fixture controlada. Publicação, economia de season pública e
        comportamento humano exigem validações adicionais.
      </p>
    </article>
  );
}
