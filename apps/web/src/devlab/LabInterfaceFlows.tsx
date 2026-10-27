import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { uiFlows } from './ui-flows';
import type { UiComparison, UiEvidence } from './ui-evidence';

const states: Record<string, string> = {
  vazio: 'Vazio',
  bloqueado: 'Bloqueado',
  erro: 'Erro',
  sucesso: 'Sucesso',
  confirmacao: 'Confirmação',
  preenchimento: 'Preenchimento',
};
const statuses: Record<string, string> = {
  passed: 'Executado com asserções aprovadas',
  failed: 'Falhou na execução',
  'not-exercised': 'Não exercitado',
};
const visualLabels: Record<string, string> = {
  unchanged: 'Sem diferença de pixels',
  changed: 'Pixels alterados',
  'size-mismatch': 'Dimensões diferentes',
  unavailable: 'Comparação visual indisponível',
  missing: 'Captura de referência ausente',
};
const mediaPath = (path: string) =>
  `/__lab/ui/${path.split('/').map(encodeURIComponent).join('/')}`;
export function LabInterfaceFlows({
  evidence,
  screenId,
}: {
  evidence?: UiEvidence;
  screenId: string;
}) {
  const flows = (evidence?.flowCatalog ?? uiFlows).filter((flow) => flow.screen === screenId);
  return (
    <section className="lab-panel">
      <h3>Ação, comando e consequência</h3>
      <p className="lab-muted">
        O contrato define o fluxo esperado. A execução registra o que foi exercitado na fixture e
        quais asserções passaram.
      </p>
      {flows.length ? (
        flows.map((flow) => {
          const runs = evidence?.flowRuns?.filter((run) => run.flowId === flow.id) ?? [];
          return (
            <details className="lab-source lab-flow" key={flow.id}>
              <summary>
                {flow.title}
                <span
                  className={`lab-tag ${runs.some((run) => run.status === 'failed') || !runs.some((run) => run.status === 'passed') ? 'lab-tag-warning' : ''}`}
                >
                  {runs.some((run) => run.status === 'failed')
                    ? 'Há falha'
                    : runs.some((run) => run.status === 'passed')
                      ? 'Há execução observada'
                      : 'Sem execução observada'}
                </span>
              </summary>
              <p>
                <strong>Origem:</strong> <code>{flow.source}</code>
              </p>
              <div className="lab-flow-contract">
                <div>
                  <h4>Antes da ação</h4>
                  <ul>
                    {flow.preconditions.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Campos e decisões</h4>
                  <ul>
                    {flow.fields.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Comandos</h4>
                  <div className="lab-tags">
                    {flow.commands.map((command) => (
                      <code className="lab-tag" key={command}>
                        {command}
                      </code>
                    ))}
                  </div>
                  <h4>Consequências esperadas</h4>
                  <ul>
                    {flow.expectedEffects.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <p>
                <strong>Estados previstos:</strong>{' '}
                {flow.states.map((state) => states[state] ?? state).join(', ')}
              </p>
              {!runs.length && (
                <p className="lab-muted">
                  Este fluxo está catalogado, mas nenhuma execução foi anexada. Gere as capturas com
                  fluxos para coletar evidência.
                </p>
              )}
              {runs.map((run, index) => (
                <div className="lab-flow-run" key={`${run.viewport}-${index}`}>
                  <h4>
                    {run.viewport}: {statuses[run.status]}
                  </h4>
                  <p>
                    Estados exercitados:{' '}
                    {run.states.map((state) => states[state] ?? state).join(', ') || 'Nenhum'}
                  </p>
                  {run.reason && <p className="lab-muted">{run.reason}</p>}
                  {run.error && <p className="lab-error">{run.error}</p>}
                  <ul>
                    {run.assertions.map((assertion, i) => (
                      <li key={i}>
                        <span className={`lab-tag ${assertion.passed ? '' : 'lab-tag-warning'}`}>
                          {assertion.passed ? 'Passou' : 'Falhou'}
                        </span>{' '}
                        {assertion.label}
                        {(assertion.expected !== undefined || assertion.actual !== undefined) && (
                          <details>
                            <summary>Valor esperado e observado</summary>
                            <pre>
                              {JSON.stringify(
                                { expected: assertion.expected, actual: assertion.actual },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                  <details>
                    <summary>Requisições observadas ({run.requests.length})</summary>
                    <pre>{JSON.stringify(run.requests, null, 2)}</pre>
                  </details>
                </div>
              ))}
            </details>
          );
        })
      ) : (
        <p className="lab-muted">
          Nenhum contrato de fluxo declarado para esta tela. O inventário de comandos candidatos
          continua disponível.
        </p>
      )}
    </section>
  );
}

export function LabBaselineComparison({
  evidence,
  screenId,
}: {
  evidence?: UiEvidence;
  screenId: string;
}) {
  const [comparison, setComparison] = useState<UiComparison>(),
    [state, setState] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading'),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (evidence?.comparison && reload === 0) {
      setComparison(evidence.comparison);
      setState('ready');
      return () => controller.abort();
    }
    setComparison(undefined);
    setState('loading');
    void fetch('/__lab/ui/comparison.json', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setState('missing');
          return;
        }
        if (!response.ok) throw new Error('Falha ao ler comparação.');
        const data: UiComparison = await response.json();
        if (!Array.isArray(data.entries) || !data.summary) throw new Error('Comparação inválida.');
        setComparison(data);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [evidence, reload]);
  const entries = comparison?.entries.filter((entry) => entry.screen === screenId) ?? [];
  const flowIds = new Set(
    (evidence?.flowCatalog ?? uiFlows)
      .filter((flow) => flow.screen === screenId)
      .map((flow) => flow.id),
  );
  const functionalChanges =
    comparison?.flowChanges?.filter((change) => flowIds.has(change.flowId)) ?? [];
  return (
    <section className="lab-panel" aria-label="Comparação com baseline">
      <div className="lab-section-head">
        <h3>Comparação com referência aprovada</h3>
        <button
          className="secondary"
          onClick={() => setReload((n) => n + 1)}
          disabled={state === 'loading'}
        >
          <RefreshCw size={13} /> Recarregar comparação
        </button>
      </div>
      {state === 'loading' ? (
        <p className="lab-muted">Carregando comparação estrutural e visual…</p>
      ) : state === 'error' ? (
        <p className="lab-error">
          Não foi possível ler o relatório de comparação. Gere uma nova captura e recarregue.
        </p>
      ) : state === 'missing' || comparison?.baseline === 'missing' ? (
        <div className="lab-muted">
          <p>
            Nenhuma referência aprovada disponível. Após revisar as capturas, registre a versão
            aprovada:
          </p>
          <pre>npm run lab:capture -- --flows --compare --accept-baseline</pre>
          <p>
            Abrir este painel não aprova a versão atual. Para comparar sem substituir a referência,
            use <code>npm run lab:capture -- --flows --compare</code>.
          </p>
        </div>
      ) : (
        <>
          <p className="lab-muted">
            {comparison?.summary.compared} capturas comparadas; {comparison?.summary.changed}{' '}
            alteradas; {comparison?.summary.functionalChanged ?? 0} mudanças funcionais. Estado da
            referência: {comparison?.baseline}.
          </p>
          {functionalChanges.map((change, index) => (
            <div className="lab-error" key={`${change.flowId}-${index}`}>
              <strong>
                {change.flowId} / {change.viewport}
              </strong>
              <p>
                {change.before} → {change.after}
              </p>
              <ul>
                {change.details.map((detail, i) => (
                  <li key={i}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
          {!entries.length && (
            <p className="lab-muted">Nenhuma comparação desta tela no relatório atual.</p>
          )}
          {entries.map((entry, index) => (
            <details className="lab-source" key={`${entry.state}-${entry.viewport}-${index}`}>
              <summary>
                {entry.state} / {entry.viewport}
                <span
                  className={`lab-tag ${entry.structuralChanged || entry.visual !== 'unchanged' ? 'lab-tag-warning' : ''}`}
                >
                  {entry.structuralChanged ? 'Estrutura alterada' : 'Estrutura preservada'}
                </span>
                <span className="lab-tag">{visualLabels[entry.visual] ?? entry.visual}</span>
              </summary>
              <ul>
                {entry.structureChanges.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
              {entry.changedRatio !== undefined && (
                <p>
                  {(entry.changedRatio * 100).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  % dos pixels diferentes ({entry.changedPixels?.toLocaleString('pt-BR') ?? '—'}{' '}
                  pixels).
                </p>
              )}
              <div className="lab-baseline-images">
                {[
                  ['Referência', entry.baseline],
                  ['Atual', entry.current],
                  ['Diferenças', entry.diff],
                ].map(
                  ([label, path]) =>
                    path && (
                      <figure key={label}>
                        <figcaption>{label}</figcaption>
                        <a href={mediaPath(path)} target="_blank" rel="noreferrer">
                          <img
                            loading="lazy"
                            src={mediaPath(path)}
                            alt={`${label} de ${entry.screen}, ${entry.state}, ${entry.viewport}`}
                          />
                        </a>
                      </figure>
                    ),
                )}
              </div>
            </details>
          ))}
        </>
      )}
      {!!comparison?.limits.length && (
        <details>
          <summary>Limites da comparação</summary>
          <ul>
            {comparison.limits.map((limit, index) => (
              <li key={index}>{limit}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
