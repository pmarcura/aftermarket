import type { BuildingBounds } from './pixel-building-cache';
import type { BuildingFeature, BuildingMesh } from './pixel-buildings-geometry';

export interface BuildingJob {
  generation: number;
  sourceRevision: number;
  features: BuildingFeature[];
  bounds: BuildingBounds;
}
export type BuildingWorkerRequest = BuildingJob & { id: number };
export type BuildingWorkerResponse =
  | {
      type: 'mesh';
      id: number;
      generation: number;
      sourceRevision: number;
      mesh: BuildingMesh;
      contentKey: string;
      cacheHit: boolean;
      buildMs: number;
      lookupMs: number;
      filterMs: number;
    }
  | { type: 'error'; id: number; message: string };

export type BuildingWorkerResult = Extract<BuildingWorkerResponse, { type: 'mesh' }>;
