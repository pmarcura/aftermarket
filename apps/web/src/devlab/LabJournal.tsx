import { useState, type FormEvent } from 'react';
import { Download, Save, Trash2 } from 'lucide-react';
import type { LabReport } from '../../../../packages/simulation/src/lab';

type ReportReference = { side: string; seed: number; report: LabReport };
type Decision = 'pending' | 'accepted' | 'rejected' | 'inconclusive';
interface ExperimentRecord {
  id: string;
  createdAt: string;
  observation: string;
  hypothesis: string;
  criterion: string;
  result: string;
  decision: Decision;
  evidence: string;
  report?: {
    side: string;
    options: LabReport['options'];
    metadata: LabReport['metadata'];
    summary: LabReport['summary'];
  };
}
const storageKey = 'aftermarket.lab.experiments';
const decisionLabels: Record<Decision, string> = {
  pending: 'A investigar',
  accepted: 'Hipótese aceita',
  rejected: 'Hipótese rejeitada',
  inconclusive: 'Inconclusivo',
};
function readJournal(): { records: ExperimentRecord[]; error: string } {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (
      !Array.isArray(saved) ||
      saved.some(
        (item) =>
          !item ||
          typeof item.id !== 'string' ||
          typeof item.observation !== 'string' ||
          typeof item.hypothesis !== 'string' ||
          !Object.hasOwn(decisionLabels, item.decision),
      )
    )
      return {
        records: [],
        error:
          'O registro local tem formato incompatível. Exporte qualquer evidência disponível antes de substituir o registro.',
      };
    return { records: saved, error: '' };
  } catch {
    return {
      records: [],
      error:
        'Não foi possível ler o registro local. As novas anotações ficarão disponíveis nesta sessão e podem ser exportadas.',
    };
  }
}
export function LabJournal({ reports }: { reports: ReportReference[] }) {
  const [journal, setJournal] = useState(readJournal);
  const [observation, setObservation] = useState(''),
    [hypothesis, setHypothesis] = useState(''),
    [criterion, setCriterion] = useState('');
  const [result, setResult] = useState(''),
    [decision, setDecision] = useState<Decision>('pending'),
    [evidence, setEvidence] = useState('');
  const [reportKey, setReportKey] = useState(''),
    [message, setMessage] = useState('');
  function persist(records: ExperimentRecord[]) {
    let error = '';
    try {
      localStorage.setItem(storageKey, JSON.stringify(records));
    } catch {
      error = 'Não foi possível gravar no dispositivo. Exporte o JSON antes de fechar esta sessão.';
    }
    setJournal({ records, error });
    return !error;
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = reports.find((entry) => `${entry.side}-${entry.seed}` === reportKey);
    const record: ExperimentRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      observation: observation.trim(),
      hypothesis: hypothesis.trim(),
      criterion: criterion.trim(),
      result: result.trim(),
      decision,
      evidence: evidence.trim(),
      ...(selected
        ? {
            report: {
              side: selected.side,
              options: selected.report.options,
              metadata: selected.report.metadata,
              summary: selected.report.summary,
            },
          }
        : {}),
    };
    if (
      !record.observation ||
      !record.hypothesis ||
      !record.criterion ||
      (decision !== 'pending' && (!record.result || !record.evidence))
    ) {
      setMessage(
        'Preencha observação, hipótese e critério. Uma decisão concluída também precisa de resultado e evidência.',
      );
      return;
    }
    const saved = persist([record, ...journal.records]);
    setMessage(
      saved
        ? 'Experimento registrado neste dispositivo.'
        : 'Experimento mantido nesta sessão. Exporte o JSON para preservá-lo.',
    );
    setObservation('');
    setHypothesis('');
    setCriterion('');
    setResult('');
    setDecision('pending');
    setEvidence('');
    setReportKey('');
  }
  function exportJournal() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { schemaVersion: 1, exportedAt: new Date().toISOString(), records: journal.records },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'aftermarket-experimentos.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <section className="lab-panel lab-journal" aria-label="Registro de experimentos">
      <div className="lab-section-head">
        <div>
          <h2>Registro de experimentos</h2>
          <p className="lab-muted">
            Anotações feitas por você. Guardadas neste navegador; exporte para compartilhar ou
            versionar.
          </p>
        </div>
        <button className="secondary" disabled={!journal.records.length} onClick={exportJournal}>
          <Download size={14} /> Exportar registros JSON
        </button>
      </div>
      {journal.error && (
        <p className="lab-error" role="alert">
          {journal.error}
        </p>
      )}
      <form onSubmit={save} className="lab-journal-form">
        <label>
          Observação medida
          <textarea
            required
            maxLength={5000}
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="O que aconteceu, em qual dia e com quem?"
          />
        </label>
        <label>
          Hipótese a investigar
          <textarea
            required
            maxLength={5000}
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            placeholder="Qual mecanismo pode explicar a observação?"
          />
        </label>
        <label>
          Critério de aceitação
          <textarea
            required
            maxLength={5000}
            value={criterion}
            onChange={(event) => setCriterion(event.target.value)}
            placeholder="Qual resultado apoiaria a hipótese e qual limite é aceitável?"
          />
        </label>
        <label>
          Resultado observado
          <textarea
            required={decision !== 'pending'}
            maxLength={5000}
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="Preencha depois de executar o experimento."
          />
        </label>
        <label>
          Decisão
          <select
            value={decision}
            onChange={(event) => setDecision(event.target.value as Decision)}
          >
            {Object.entries(decisionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Anexar execução concluída
          <select value={reportKey} onChange={(event) => setReportKey(event.target.value)}>
            <option value="">Sem anexo automático</option>
            {reports.map((entry) => (
              <option key={`${entry.side}-${entry.seed}`} value={`${entry.side}-${entry.seed}`}>
                {entry.side} / semente {entry.seed} / {entry.report.options.days} dias
              </option>
            ))}
          </select>
          <small>
            Anexa opções, proveniência e resumo; exporte a execução na aba Simulações para preservar
            as séries completas.
          </small>
        </label>
        <label className="lab-journal-evidence">
          Referências de evidência
          <textarea
            required={decision !== 'pending'}
            maxLength={5000}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Arquivo do relatório, tela/estado, consulta, métricas e links usados na decisão."
          />
        </label>
        <div className="lab-journal-evidence">
          <button className="primary" type="submit">
            <Save size={14} /> Salvar experimento
          </button>
          <p role="status" aria-live="polite">
            {message}
          </p>
        </div>
      </form>
      <div className="lab-journal-records">
        {journal.records.length ? (
          journal.records.map((record) => (
            <details className="lab-source" key={record.id}>
              <summary>
                {record.observation}
                <span className="lab-tag">{decisionLabels[record.decision]}</span>
              </summary>
              <small>
                {new Date(record.createdAt).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </small>
              <dl>
                <dt>Hipótese</dt>
                <dd>{record.hypothesis}</dd>
                <dt>Critério</dt>
                <dd>{record.criterion}</dd>
                <dt>Resultado</dt>
                <dd>{record.result || 'Aguardando experimento.'}</dd>
                <dt>Evidência</dt>
                <dd>{record.evidence || 'Ainda não anexada.'}</dd>
              </dl>
              {record.report && (
                <details>
                  <summary>Configuração anexada</summary>
                  <pre>{JSON.stringify(record.report, null, 2)}</pre>
                </details>
              )}
              <button
                className="secondary"
                onClick={() => {
                  const saved = persist(journal.records.filter((entry) => entry.id !== record.id));
                  setMessage(
                    saved
                      ? 'Registro removido deste dispositivo.'
                      : 'Registro removido desta sessão. Não foi possível gravar a remoção no dispositivo.',
                  );
                }}
              >
                <Trash2 size={13} /> Remover registro
              </button>
            </details>
          ))
        ) : (
          <p className="lab-muted">
            Ainda não há experimentos registrados. Comece com uma observação verificável.
          </p>
        )}
      </div>
    </section>
  );
}
