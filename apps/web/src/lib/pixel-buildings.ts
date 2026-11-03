import type { CustomLayerInterface, Map as LibreMap, MapSourceDataEvent } from 'maplibre-gl';
import { BUILDING_VERTEX_STRIDE, type BuildingFeature } from './pixel-buildings-geometry';
import { BuildingViewportCache } from './pixel-building-cache';
import { BUILDING_FRAGMENT_SHADER, BUILDING_VERTEX_SHADER } from './pixel-building-shaders';
import { recordBuildingWork } from './map-performance';
import { BuildingWorkerClient } from './pixel-building-worker-client';

export const PIXEL_BUILDINGS_LAYER_ID = 'pixel-buildings-detail';
export const DETAILED_BUILDING_ZOOM = 15;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const compiled = gl.createShader(type)!;
  gl.shaderSource(compiled, source);
  gl.compileShader(compiled);
  if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(compiled);
    gl.deleteShader(compiled);
    throw new Error(`Não foi possível desenhar as construções: ${message}`);
  }
  return compiled;
}

/** Footprints are geographic data; facade and roof details are original artwork.
 * This layer owns its buffers and uses only MapLibre's public custom-layer API. */
export function createPixelBuildings(onRepresentationChange: () => void) {
  let map: LibreMap;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let matrixLocation: WebGLUniformLocation | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let vertexCount = 0;
  let pendingVertices: Float32Array | null = null;
  let meshOrigin: [number, number] = [0, 0];
  let meshKey = '';
  let sourceRevision = 0;
  let dirty = true;
  let disposed = false;
  let worker: BuildingWorkerClient;
  let moving = false;
  let enabled = true;
  let generation = 0;
  const viewport = new BuildingViewportCache();
  const matrix = new Float32Array(16);
  const active = () => Boolean(program && vertexCount && map.getZoom() >= DETAILED_BUILDING_ZOOM);

  const update = () => {
    timer = undefined;
    if (
      disposed ||
      !enabled ||
      moving ||
      !program ||
      map.getZoom() < DETAILED_BUILDING_ZOOM ||
      !dirty
    )
      return;
    dirty = false;
    const queryStarted = performance.now();
    const bounds = map.getBounds();
    const geographicBounds = {
      west: bounds.getWest(),
      east: bounds.getEast(),
      south: bounds.getSouth(),
      north: bounds.getNorth(),
    };
    // Camera-only movement changes the projection matrix, not the footprints.
    // The tile-range guard avoids assuming overscan contains unloaded data.
    if (viewport.canReuse(geographicBounds, sourceRevision)) {
      recordBuildingWork(map, 'reuse', performance.now() - queryStarted);
      return;
    }
    const coverage = new BuildingViewportCache().cover(geographicBounds, sourceRevision);
    const features = map
      .querySourceFeatures('openmaptiles', { sourceLayer: 'building' })
      .map((feature): BuildingFeature => ({
        id: feature.id,
        geometry: feature.geometry,
        properties: {
          osm_id: feature.properties.osm_id,
          render_height: feature.properties.render_height,
          render_min_height: feature.properties.render_min_height,
          hide_3d: feature.properties.hide_3d,
        },
      }));
    worker.request({ generation, sourceRevision, features, bounds: coverage });
    recordBuildingWork(map, 'query', performance.now() - queryStarted);
  };

  const schedule = () => {
    if (disposed || !enabled || moving || map.getZoom() < DETAILED_BUILDING_ZOOM) return;
    clearTimeout(timer);
    timer = setTimeout(update, 140);
  };
  const sourceChanged = (event: MapSourceDataEvent) => {
    // Individual tile arrivals may omit sourceDataType. Restricting this to
    // "content" misses buildings after a long pan into a new city.
    if (
      event.sourceId !== 'openmaptiles' ||
      event.sourceDataType === 'idle' ||
      event.sourceDataType === 'visibility'
    )
      return;
    sourceRevision++;
    worker.invalidate();
    dirty = true;
    schedule();
  };
  // Called by the interactive map's actual moveend, not the synchronized
  // basemap's synthetic moveend on every animation frame.
  const cameraSettled = () => {
    moving = false;
    if (disposed || !program || !enabled) return;
    worker.resume();
    dirty = true;
    schedule();
  };
  const cameraMoving = () => {
    moving = true;
    generation++;
    clearTimeout(timer);
    timer = undefined;
    worker?.pause();
  };
  const setActive = (value: boolean) => {
    enabled = value;
    if (value) cameraSettled();
    else cameraMoving();
  };

  const layer: CustomLayerInterface = {
    id: PIXEL_BUILDINGS_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(instance, gl) {
      map = instance;
      disposed = false;
      timer = undefined;
      meshKey = '';
      sourceRevision = 0;
      worker?.destroy();
      generation++;
      worker = new BuildingWorkerClient({
        onWork(result) {
          if (result.cacheHit) recordBuildingWork(map, 'reuse');
          else recordBuildingWork(map, 'build', result.buildMs);
        },
        onResult(result) {
          if (
            disposed ||
            !enabled ||
            moving ||
            result.generation !== generation ||
            result.sourceRevision !== sourceRevision
          )
            return;
          const bounds = map.getBounds();
          viewport.cover(
            {
              west: bounds.getWest(),
              east: bounds.getEast(),
              south: bounds.getSouth(),
              north: bounds.getNorth(),
            },
            sourceRevision,
          );
          if (result.contentKey === meshKey) return;
          meshKey = result.contentKey;
          meshOrigin = result.mesh.origin;
          vertexCount = result.mesh.vertices.length / BUILDING_VERTEX_STRIDE;
          pendingVertices = result.mesh.vertices;
          map.getCanvas().dataset.detailedBuildings = String(result.mesh.buildingCount);
          map.getCanvas().dataset.buildingVertices = String(vertexCount);
          onRepresentationChange();
          map.triggerRepaint();
        },
        onError() {
          vertexCount = 0;
          pendingVertices = null;
          meshKey = '';
          viewport.clear();
          dirty = true;
          onRepresentationChange();
          map.triggerRepaint();
        },
      });
      viewport.clear();
      vertexCount = 0;
      meshOrigin = [0, 0];
      pendingVertices = null;
      dirty = true;
      const vertex = shader(gl, gl.VERTEX_SHADER, BUILDING_VERTEX_SHADER);
      const fragment = shader(gl, gl.FRAGMENT_SHADER, BUILDING_FRAGMENT_SHADER);
      program = gl.createProgram()!;
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        program = null;
        throw new Error(`Não foi possível preparar as construções: ${message}`);
      }
      matrixLocation = gl.getUniformLocation(program, 'u_matrix');
      buffer = gl.createBuffer();
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const attributes = [
        ['a_position', 3, 0],
        ['a_uv', 2, 3],
        ['a_style', 3, 5],
        ['a_size', 2, 8],
      ] as const;
      for (const [name, size, offset] of attributes) {
        const location = gl.getAttribLocation(program, name);
        if (location < 0) continue;
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          BUILDING_VERTEX_STRIDE * 4,
          offset * 4,
        );
      }
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      map.on('sourcedata', sourceChanged);
      schedule();
    },
    render(gl, options) {
      if (!active()) return;
      if (pendingVertices) {
        const uploadStarted = performance.now();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, pendingVertices, gl.STATIC_DRAW);
        pendingVertices = null;
        recordBuildingWork(map, 'upload', performance.now() - uploadStarted);
      }
      const source = options.defaultProjectionData.mainMatrix;
      // Compose the local origin on the CPU with double precision. Adding a
      // city-size offset to global Mercator coordinates in a float shader jitters.
      matrix.set(source);
      for (let row = 0; row < 4; row++)
        matrix[12 + row] =
          source[row] * meshOrigin[0] + source[4 + row] * meshOrigin[1] + source[12 + row];
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(matrixLocation, false, matrix);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      gl.bindVertexArray(null);
    },
    onRemove(instance, gl) {
      disposed = true;
      clearTimeout(timer);
      timer = undefined;
      instance.off('sourcedata', sourceChanged);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      buffer = null;
      vao = null;
      program = null;
      pendingVertices = null;
      worker.destroy();
      viewport.clear();
      delete instance.getCanvas().dataset.detailedBuildings;
      delete instance.getCanvas().dataset.buildingVertices;
    },
  };

  return { layer, active, cameraMoving, cameraSettled, setActive };
}
