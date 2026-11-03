import type { Map as LibreMap } from 'maplibre-gl';

type WorkKind = 'query' | 'build' | 'upload' | 'reuse';
const work = new WeakMap<LibreMap, Record<string, number>>();

/** Development measurements are DOM-readable by the lab, without exposing world
 * state or adding visible controls to the player's map. */
export function recordBuildingWork(map: LibreMap, kind: WorkKind, durationMs = 0) {
  if (!import.meta.env.DEV) return;
  const counts = work.get(map) ?? {};
  counts[`${kind}Count`] = (counts[`${kind}Count`] ?? 0) + 1;
  counts[`${kind}Ms`] = (counts[`${kind}Ms`] ?? 0) + durationMs;
  work.set(map, counts);
  map.getCanvas().dataset.buildingProfile = JSON.stringify(counts);
}

export function attachMapPerformance(main: LibreMap, base: LibreMap) {
  if (!import.meta.env.DEV) return () => {};
  let frame = 0;
  let started = 0;
  let previous = 0;
  let lastMove = 0;
  let intervals: number[] = [];
  const sample = (now: number) => {
    if (previous) intervals.push(now - previous);
    previous = now;
    if (now - lastMove < 650) frame = requestAnimationFrame(sample);
    else {
      frame = 0;
      const sorted = [...intervals].sort((a, b) => a - b);
      const percentile = (p: number) =>
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
      main.getCanvas().dataset.mapProfile = JSON.stringify({
        durationMs: now - started,
        frames: intervals.length,
        medianFrameMs: percentile(0.5),
        p95FrameMs: percentile(0.95),
        maxFrameMs: sorted.at(-1) ?? 0,
        framesAbove33Ms: intervals.filter((value) => value > 33.4).length,
        basePixels: base.getCanvas().width * base.getCanvas().height,
      });
    }
  };
  const move = () => {
    lastMove = performance.now();
    if (frame) return;
    started = lastMove;
    previous = 0;
    intervals = [];
    frame = requestAnimationFrame(sample);
  };
  main.on('move', move);
  return () => {
    cancelAnimationFrame(frame);
    main.off('move', move);
  };
}
