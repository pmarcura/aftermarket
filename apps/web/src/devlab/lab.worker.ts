import {
  runLab,
  validateLabOptions,
  type LabOptions,
  type LabProgress,
  type LabReport,
} from '../../../../packages/simulation/src/lab';

export interface LabBatchRequest {
  a: Partial<LabOptions>;
  b: Partial<LabOptions>;
  seeds: number[];
}
export type LabWorkerMessage =
  | {
      type: 'progress';
      side: 'A' | 'B';
      seed: number;
      run: number;
      total: number;
      progress: LabProgress;
    }
  | { type: 'result'; side: 'A' | 'B'; seed: number; report: LabReport }
  | { type: 'done' }
  | { type: 'error'; message: string };

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<LabBatchRequest>) => void) | null;
  postMessage: (message: LabWorkerMessage) => void;
};
worker.onmessage = async ({ data }) => {
  try {
    if (!Array.isArray(data.seeds) || data.seeds.length < 1 || data.seeds.length > 5)
      throw new Error('Escolha entre uma e cinco sementes para o lote.');
    if (new Set(data.seeds).size !== data.seeds.length)
      throw new Error('As sementes do lote precisam ser distintas.');
    const runs = data.seeds.flatMap((seed) =>
      (['A', 'B'] as const).map((side) => ({
        side,
        seed,
        options: validateLabOptions({ ...(side === 'A' ? data.a : data.b), seed }),
      })),
    );
    for (const [index, run] of runs.entries()) {
      const report = runLab(run.options, {
        onProgress: (progress) =>
          worker.postMessage({
            type: 'progress',
            side: run.side,
            seed: run.seed,
            run: index + 1,
            total: runs.length,
            progress,
          }),
      });
      worker.postMessage({ type: 'result', side: run.side, seed: run.seed, report });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    worker.postMessage({ type: 'done' });
  } catch (error) {
    worker.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'A simulação não pôde ser concluída.',
    });
  }
};
