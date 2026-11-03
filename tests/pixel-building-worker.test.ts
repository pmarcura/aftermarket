import { describe, expect, it, vi } from 'vitest';
import {
  BuildingWorkerClient,
  type BuildingWorkerPort,
} from '../apps/web/src/lib/pixel-building-worker-client';
import type {
  BuildingWorkerRequest,
  BuildingWorkerResult,
} from '../apps/web/src/lib/pixel-building-worker-messages';

function fixture() {
  const jobs: BuildingWorkerRequest[] = [];
  const port: BuildingWorkerPort = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (job) => jobs.push(job),
    terminate: vi.fn(),
  };
  const onResult = vi.fn(),
    onError = vi.fn();
  const client = new BuildingWorkerClient({ onResult, onError }, () => port);
  const job = {
    generation: 1,
    sourceRevision: 1,
    features: [],
    bounds: { west: 0, east: 1, south: 0, north: 1 },
  };
  const reply = (index: number) =>
    port.onmessage?.({
      data: {
        ...jobs[index],
        type: 'mesh',
        mesh: { vertices: new Float32Array(), origin: [0, 0], buildingCount: 0, key: '' },
        contentKey: '',
        cacheHit: false,
        buildMs: 1,
        lookupMs: 0,
        filterMs: 0,
      },
    } as unknown as MessageEvent<BuildingWorkerResult>);
  return { client, port, jobs, job, reply, onResult, onError };
}

describe('construções em segundo plano', () => {
  it('limita a fila ao pedido em voo e ao mais recente, descartando resposta antiga', () => {
    const f = fixture();
    f.client.request(f.job);
    f.client.request({ ...f.job, sourceRevision: 2 });
    f.client.request({ ...f.job, sourceRevision: 3 });
    expect(f.jobs).toHaveLength(1);
    f.reply(0);
    expect(f.onResult).not.toHaveBeenCalled();
    expect(f.jobs).toHaveLength(2);
    expect(f.jobs[1].sourceRevision).toBe(3);
    f.reply(1);
    expect(f.onResult).toHaveBeenCalledTimes(1);
  });
  it('não aplica trabalho durante movimento e aceita pedido novo ao retomar', () => {
    const f = fixture();
    f.client.request(f.job);
    f.client.pause();
    f.reply(0);
    expect(f.onResult).not.toHaveBeenCalled();
    f.client.request(f.job);
    expect(f.jobs).toHaveLength(1);
    f.client.resume();
    f.client.request(f.job);
    f.reply(1);
    expect(f.onResult).toHaveBeenCalledTimes(1);
  });
  it('termina o worker e ignora respostas após desmontagem', () => {
    const f = fixture();
    f.client.request(f.job);
    const receive = f.port.onmessage;
    f.client.destroy();
    receive?.({ data: { ...f.jobs[0], type: 'error', message: 'atrasada' } } as never);
    expect(f.port.terminate).toHaveBeenCalledOnce();
    expect(f.onResult).not.toHaveBeenCalled();
    expect(f.onError).not.toHaveBeenCalled();
  });
  it('recupera falha do worker no próximo pedido, sem repetir automaticamente', () => {
    const f = fixture();
    f.client.request(f.job);
    f.port.onmessage?.({ data: { type: 'error', id: f.jobs[0].id, message: 'falhou' } } as never);
    expect(f.onError).toHaveBeenCalledWith('falhou');
    expect(f.jobs).toHaveLength(1);
    f.client.request(f.job);
    f.reply(1);
    expect(f.onResult).toHaveBeenCalledOnce();
  });
});
