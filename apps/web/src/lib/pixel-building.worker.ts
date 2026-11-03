import { BuildingMeshCache, intersectsBuildingBounds } from './pixel-building-cache';
import type {
  BuildingWorkerRequest,
  BuildingWorkerResponse,
} from './pixel-building-worker-messages';

const meshes = new BuildingMeshCache();
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<BuildingWorkerRequest>) => void) | null;
  postMessage(message: BuildingWorkerResponse, transfer?: Transferable[]): void;
};

worker.onmessage = ({ data }) => {
  try {
    const started = performance.now();
    const visible = data.features.filter((feature) =>
      intersectsBuildingBounds(feature, data.bounds),
    );
    const filterMs = performance.now() - started;
    const result = meshes.get(visible);
    // Sending the cached buffer itself would detach it and corrupt future hits.
    // The copy is made off the UI thread; only its ownership crosses threads.
    const vertices = result.mesh.vertices.slice();
    worker.postMessage(
      {
        type: 'mesh',
        id: data.id,
        generation: data.generation,
        sourceRevision: data.sourceRevision,
        mesh: { ...result.mesh, vertices },
        contentKey: result.contentKey,
        cacheHit: result.cacheHit,
        buildMs: result.buildMs,
        lookupMs: result.lookupMs,
        filterMs,
      },
      [vertices.buffer],
    );
  } catch (error) {
    worker.postMessage({
      type: 'error',
      id: data.id,
      message: error instanceof Error ? error.message : 'Não foi possível preparar as construções.',
    });
  }
};
