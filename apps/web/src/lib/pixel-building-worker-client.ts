import type {
  BuildingJob,
  BuildingWorkerRequest,
  BuildingWorkerResponse,
  BuildingWorkerResult,
} from './pixel-building-worker-messages';

export interface BuildingWorkerPort {
  onmessage: ((event: MessageEvent<BuildingWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: BuildingWorkerRequest): void;
  terminate(): void;
}

function createWorker(): BuildingWorkerPort {
  return new Worker(new URL('./pixel-building.worker.ts', import.meta.url), { type: 'module' });
}

/** At most one running job and one replaceable latest request. An obsolete
 * result can populate the worker cache, but never replace the visible mesh. */
export class BuildingWorkerClient {
  private worker: BuildingWorkerPort | null = null;
  private running: number | null = null;
  private pending: BuildingWorkerRequest | null = null;
  private latest = 0;
  private paused = false;
  private disposed = false;

  constructor(
    private readonly callbacks: {
      onResult(result: BuildingWorkerResult): void;
      onError(message: string): void;
      onWork?(result: BuildingWorkerResult): void;
    },
    private readonly factory: () => BuildingWorkerPort = createWorker,
  ) {}

  request(job: BuildingJob) {
    if (this.disposed || this.paused) return;
    this.pending = { ...job, id: ++this.latest };
    this.pump();
  }

  pause() {
    this.paused = true;
    this.invalidate();
  }

  resume() {
    this.paused = false;
  }

  invalidate() {
    this.latest++;
    this.pending = null;
  }

  private pump() {
    if (this.disposed || this.paused || this.running !== null || !this.pending) return;
    try {
      if (!this.worker) {
        this.worker = this.factory();
        this.worker.onmessage = ({ data }) => {
          if (this.disposed || data.id !== this.running) return;
          this.running = null;
          if (data.type === 'error') {
            this.fail(data.message);
            return;
          }
          this.callbacks.onWork?.(data);
          if (!this.paused && data.id === this.latest) this.callbacks.onResult(data);
          this.pump();
        };
        this.worker.onerror = (event) => {
          event.preventDefault();
          this.fail(event.message || 'Não foi possível preparar as construções.');
        };
        this.worker.onmessageerror = () => this.fail('Não foi possível receber as construções.');
      }
      const job = this.pending;
      this.pending = null;
      this.running = job.id;
      this.worker.postMessage(job);
    } catch (error) {
      this.fail(
        error instanceof Error ? error.message : 'Não foi possível iniciar as construções.',
      );
    }
  }

  private fail(message: string) {
    this.closeWorker();
    this.running = null;
    this.invalidate();
    if (!this.disposed) this.callbacks.onError(message);
  }

  private closeWorker() {
    if (!this.worker) return;
    this.worker.onmessage = this.worker.onerror = this.worker.onmessageerror = null;
    this.worker.terminate();
    this.worker = null;
  }

  destroy() {
    this.disposed = true;
    this.invalidate();
    this.closeWorker();
    this.running = null;
  }
}
