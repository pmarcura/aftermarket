import { Map as LibreMap } from 'maplibre-gl';
import { createMapStyle, syncBuildingPerspective } from './map-style';
import { registerMapTextures } from './map-textures';
import { createPixelBuildings } from './pixel-buildings';
import { attachMapPerformance } from './map-performance';

/** The geographic drawing has a 2 CSS-pixel grid. Gameplay keeps the display's
 * full resolution, so labels, picking and shipment positions remain precise. */
export const BASEMAP_PIXEL_RATIO = 0.5;

export function attachPixelBasemap(
  gameplay: LibreMap,
  container: HTMLDivElement,
  onLoad: () => void,
  onError: () => void,
) {
  const camera = () => ({
    center: gameplay.getCenter(),
    zoom: gameplay.getZoom(),
    bearing: gameplay.getBearing(),
    pitch: gameplay.getPitch(),
    roll: gameplay.getRoll(),
    padding: gameplay.getPadding(),
  });
  const base = new LibreMap({
    container,
    style: createMapStyle(),
    ...camera(),
    minZoom: gameplay.getMinZoom(),
    maxZoom: gameplay.getMaxZoom(),
    pixelRatio: BASEMAP_PIXEL_RATIO,
    canvasContextAttributes: { antialias: false },
    interactive: false,
    attributionControl: false,
    renderWorldCopies: false,
    // Only the interactive map observes container size. Its resize callback
    // resizes both maps together before synchronizing the camera.
    trackResize: false,
  });
  base.getCanvas().tabIndex = -1;
  const stopPerformance = attachMapPerformance(gameplay, base);
  let styleReady = false;
  let loadFailed = false;
  const buildings = createPixelBuildings(() => syncBuildingPerspective(base, buildings.active()));
  let enabled = true;
  const sync = () => {
    if (!enabled) return;
    base.jumpTo(camera());
    if (styleReady) syncBuildingPerspective(base, buildings.active());
  };
  gameplay.on('move', sync);
  gameplay.on('movestart', buildings.cameraMoving);
  gameplay.on('moveend', buildings.cameraSettled);
  base.on('style.load', () => {
    registerMapTextures(base);
    styleReady = true;
    base.addLayer(buildings.layer);
    syncBuildingPerspective(base, buildings.active());
  });
  // MapLibre can emit load after a source error (it treats failed tiles as
  // settled). Keep that failure visible until the player retries the map.
  base.on('load', () => {
    if (!loadFailed) onLoad();
  });
  base.on('error', () => {
    loadFailed = true;
    onError();
  });

  return {
    map: base,
    setActive(value: boolean) {
      enabled = value;
      buildings.setActive(value);
      if (value) sync();
      else base.stop();
    },
    resize() {
      base.resize();
      sync();
    },
    destroy() {
      stopPerformance();
      gameplay.off('move', sync);
      gameplay.off('movestart', buildings.cameraMoving);
      gameplay.off('moveend', buildings.cameraSettled);
      base.remove();
    },
  };
}
