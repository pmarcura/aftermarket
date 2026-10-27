import { useEffect, useState } from 'react';

interface Study {
  generatedAt: string;
  economics: {
    hypothesis: string;
    decision: string;
    evaluations: {
      criterion: string;
      a: number | boolean;
      b: number | boolean;
      passed: boolean;
      unit?: string;
    }[];
  };
  interface: { observation: string; criterion: string; decision: string };
}
export function LabStudyEvidence() {
  const [study, setStudy] = useState<Study>();
  const [message, setMessage] = useState('Carregando investigação registrada…');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/__lab/studies/oil-meal-milk-and-carrier.json', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            'Execute npm run lab:study para gerar a investigação econômica e de interface.',
          );
        const data = (await response.json()) as Study;
        if (!Array.isArray(data.economics?.evaluations))
          throw Error('Relatório incompatível. Gere novamente com npm run lab:study.');
        setStudy(data);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : 'Não foi possível carregar a investigação.',
          );
      });
    return () => controller.abort();
  }, []);
  if (!study)
    return (
      <section className="lab-panel">
        <h3>Investigação realizada</h3>
        <p>{message}</p>
      </section>
    );
  const format = (value: number | boolean, unit?: string) =>
    typeof value === 'boolean'
      ? value
        ? 'Sim'
        : 'Não'
      : unit === 'BRL-cents'
        ? (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : `${value.toLocaleString('pt-BR')}${unit ? ` ${unit}` : ''}`;
  return (
    <section className="lab-panel" aria-label="Investigação registrada">
      <h3>Óleo, farelo e leite: resultado do experimento</h3>
      <p>{study.economics.hypothesis}</p>
      <div className="lab-table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Critério</th>
              <th>A</th>
              <th>B</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {study.economics.evaluations.map((evaluation) => (
              <tr key={evaluation.criterion}>
                <th>{evaluation.criterion}</th>
                <td>{format(evaluation.a, evaluation.unit)}</td>
                <td>{format(evaluation.b, evaluation.unit)}</td>
                <td>{evaluation.passed ? 'Atendeu' : 'Não atendeu'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>{study.economics.decision}</strong>
      </p>
      <h3>Compra de caminhão: refinamento observado</h3>
      <p>{study.interface.observation}</p>
      <p>{study.interface.criterion}</p>
      <p>{study.interface.decision}</p>
      <a href="/__lab/studies/oil-meal-milk-and-carrier.json" target="_blank" rel="noreferrer">
        Abrir evidências e reprodução em JSON
      </a>
      <p className="lab-footnote">
        Gerado em{' '}
        {new Date(study.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.
        Resultados do cenário isolado, sem aplicar mudanças à season salva.
      </p>
    </section>
  );
}
