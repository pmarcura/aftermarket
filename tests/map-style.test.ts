import { describe, expect, it } from 'vitest';
import {
  createPropertyExpression,
  featureFilter,
  latest,
  validateStyleMin,
  type Feature,
  type LineLayerSpecification,
  type StylePropertySpecification,
} from '@maplibre/maplibre-gl-style-spec';
import { createMapStyle, syncBuildingPerspective } from '../apps/web/src/lib/map-style';
import { createMapTextures, registerMapTextures } from '../apps/web/src/lib/map-textures';

const style = createMapStyle();
const roadLayers = style.layers.filter(
  (layer): layer is LineLayerSpecification =>
    layer.type === 'line' && layer.id.startsWith('roads-') && !layer.id.endsWith('-casing'),
);
const classes = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'minor',
  'service',
  'track',
];

describe('continuidade da malha viária', () => {
  it('preserva trechos sem nome/ref, alças, pontes, túneis e vaus na mesma fonte geométrica', () => {
    expect(validateStyleMin(style)).toEqual([]);
    for (const roadClass of classes) {
      for (const brunnel of [undefined, 'bridge', 'tunnel', 'ford']) {
        const feature: Feature = {
          type: 2,
          properties: { class: roadClass, ramp: 1, ...(brunnel ? { brunnel } : {}) },
        };
        const matching = roadLayers.filter((layer) =>
          featureFilter(layer.filter, layer.id).filter({ zoom: 14 }, feature),
        );
        expect(matching, `${roadClass}/${brunnel ?? 'surface'}`).toHaveLength(1);
        expect(matching[0]['source-layer']).toBe('transportation');
        expect(matching[0].maxzoom).toBeUndefined();
      }
    }
    for (const excluded of ['rail', 'path', 'runway', 'taxiway', 'motorway_construction']) {
      expect(
        roadLayers.some((layer) =>
          featureFilter(layer.filter, layer.id).filter(
            { zoom: 14 },
            { type: 2, properties: { class: excluded } },
          ),
        ),
      ).toBe(false);
    }
  });

  it('interpola espessura sem saltos ou sumiço entre zooms e entre superfície/ponte/túnel', () => {
    const expressions = roadLayers.map((layer) => {
      const parsed = createPropertyExpression(
        layer.paint!['line-width'],
        layer.id,
        latest.paint_line['line-width'] as StylePropertySpecification,
      );
      if (parsed.result === 'error') throw new Error(JSON.stringify(parsed.value));
      return parsed.value;
    });
    for (const roadClass of classes) {
      const feature: Feature = { type: 2, properties: { class: roadClass } };
      let previous = 0;
      for (let step = 0; step <= 130; step++) {
        const zoom = 4 + step / 10;
        const widths = expressions.map((expression) => expression.evaluate({ zoom }, feature));
        expect(new Set(widths).size).toBe(1);
        expect(widths[0]).toBeGreaterThanOrEqual(previous);
        if (zoom >= 12) expect(widths[0]).toBeGreaterThan(0);
        previous = widths[0];
      }
      for (const zoom of [7, 10, 12, 14, 17]) {
        const before = expressions[0].evaluate({ zoom: zoom - 0.001 }, feature);
        const after = expressions[0].evaluate({ zoom: zoom + 0.001 }, feature);
        expect(Math.abs(after - before)).toBeLessThan(0.02);
      }
    }
  });
});

describe('atlas pixel geográfico', () => {
  it('usa somente usos urbanos mapeados e mantém natureza e estradas acima do contexto', () => {
    const urban = style.layers.find((layer) => layer.id === 'urban-landuse');
    if (urban?.type !== 'fill') throw new Error('Camada urbana ausente');
    expect(urban['source-layer']).toBe('landuse');
    const filter = featureFilter(urban.filter, urban.id);
    for (const landClass of [
      'residential',
      'commercial',
      'retail',
      'industrial',
      'school',
      'university',
      'kindergarten',
      'college',
      'library',
      'hospital',
      'garages',
      'bus_station',
    ])
      expect(filter.filter({ zoom: 15 }, { type: 3, properties: { class: landClass } })).toBe(true);
    for (const landClass of [
      'wood',
      'sand',
      'grass',
      'pitch',
      'stadium',
      'runway',
      'suburb',
      'quarter',
      'neighbourhood',
      'unknown',
    ])
      expect(filter.filter({ zoom: 15 }, { type: 3, properties: { class: landClass } })).toBe(
        false,
      );
    for (const id of ['natural-landcover', 'water', 'building-roofs', 'roads-surface'])
      expect(style.layers.indexOf(urban)).toBeLessThan(
        style.layers.findIndex((layer) => layer.id === id),
      );
  });

  it('mantém madeira, areia e gelo separados sem inventar ocupação no território', () => {
    const naturalLayers = style.layers.filter(
      (layer) => 'source-layer' in layer && layer['source-layer'] === 'landcover',
    );
    for (const landClass of ['wood', 'sand', 'ice', 'grass', 'farmland']) {
      const matching = naturalLayers.filter((layer) =>
        featureFilter('filter' in layer ? layer.filter : undefined, layer.id).filter(
          { zoom: 14 },
          { type: 3, properties: { class: landClass } },
        ),
      );
      expect(matching).toHaveLength(['wood', 'sand', 'ice'].includes(landClass) ? 1 : 0);
    }
    expect(new Set(naturalLayers.map((layer) => layer.id)).size).toBe(3);
  });

  it('desenha construções de footprints reais apenas de perto e sob a malha viária', () => {
    const buildingLayers = style.layers.filter(
      (layer) => 'source-layer' in layer && layer['source-layer'] === 'building',
    );
    expect(buildingLayers.length).toBeGreaterThan(0);
    for (const layer of buildingLayers) {
      expect('source' in layer && layer.source).toBe('openmaptiles');
      expect(layer.minzoom).toBeGreaterThanOrEqual(13);
      expect(['fill', 'line', 'fill-extrusion']).toContain(layer.type);
      const filter = featureFilter('filter' in layer ? layer.filter : undefined, layer.id);
      expect(filter.filter({ zoom: 14 }, { type: 3, properties: {} })).toBe(true);
      expect(filter.filter({ zoom: 14 }, { type: 3, properties: { hide_3d: true } })).toBe(false);
      expect(style.layers.indexOf(layer)).toBeLessThan(
        style.layers.findIndex((entry) => entry.id === 'roads-surface'),
      );
    }
  });

  it('usa alturas aproximadas da fonte nos volumes e mantém base dentro da altura', () => {
    const layer = style.layers.find((entry) => entry.id === 'building-volumes');
    if (layer?.type !== 'fill-extrusion') throw new Error('Camada de volumes ausente');
    const evaluate = (property: 'fill-extrusion-height' | 'fill-extrusion-base') => {
      const parsed = createPropertyExpression(
        layer.paint![property],
        layer.id,
        latest['paint_fill-extrusion'][property] as StylePropertySpecification,
      );
      if (parsed.result === 'error') throw new Error(JSON.stringify(parsed.value));
      return (properties: Record<string, number>) =>
        parsed.value.evaluate({ zoom: 15 }, { type: 3, properties });
    };
    const height = evaluate('fill-extrusion-height');
    const base = evaluate('fill-extrusion-base');
    expect(height({ render_height: 42 })).toBe(42);
    expect(base({ render_height: 42, render_min_height: 12 })).toBe(12);
    expect(height({})).toBe(6);
    expect(base({})).toBe(0);
    expect(height({ render_height: -10 })).toBe(0);
    expect(base({ render_height: 6, render_min_height: 20 })).toBe(6);
    expect(base({ render_height: 6, render_min_height: -20 })).toBe(0);
  });

  it('troca representação ao inclinar e aproximar sem ocultar prédios distantes', () => {
    let pitch = 0;
    let zoom = 13;
    const visibility = new Map<string, 'visible' | 'none'>();
    let writes = 0;
    const map = {
      getPitch: () => pitch,
      getZoom: () => zoom,
      getLayer: (id: string) => style.layers.find((layer) => layer.id === id),
      setLayoutProperty: (id: string, _property: 'visibility', value: 'visible' | 'none') => {
        writes++;
        visibility.set(id, value);
      },
    };
    syncBuildingPerspective(map);
    expect(visibility.get('building-roofs')).toBe('visible');
    pitch = 45;
    syncBuildingPerspective(map);
    expect(visibility.get('building-roofs')).toBe('visible');
    zoom = 15;
    syncBuildingPerspective(map);
    expect(visibility.get('building-roofs')).toBe('none');
    expect(visibility.get('building-volumes')).toBe('visible');
    const previousWrites = writes;
    syncBuildingPerspective(map);
    expect(writes).toBe(previousWrites);
    pitch = 0;
    syncBuildingPerspective(map);
    expect(visibility.get('building-roofs')).toBe('visible');
    expect(visibility.get('building-volumes')).toBe('none');
  });

  it('registra padrões opacos repetíveis antes de aplicá-los e mantém o estilo válido', () => {
    const textured = createMapStyle();
    const images = new Set<string>();
    const layerPatterns = new Map<string, unknown>();
    registerMapTextures({
      hasImage: (id) => images.has(id),
      addImage: (id) => {
        images.add(id);
      },
      getLayer: (id) => textured.layers.find((layer) => layer.id === id),
      setPaintProperty: (id, property, value) => {
        const patterns =
          typeof value === 'string'
            ? [value]
            : (value as unknown[])
                .flat(Infinity)
                .filter(
                  (item): item is string => typeof item === 'string' && item.endsWith('-pixel'),
                );
        for (const pattern of patterns) expect(images.has(pattern)).toBe(true);
        const layer = textured.layers.find((entry) => entry.id === id)!;
        Object.assign(layer.paint!, { [property]: value });
        layerPatterns.set(id, value);
      },
    });
    expect(layerPatterns.has('urban-landuse')).toBe(true);
    expect(layerPatterns.get('natural-sand')).not.toBe(layerPatterns.get('natural-landcover'));
    expect(layerPatterns.get('natural-ice')).not.toBe(layerPatterns.get('natural-landcover'));
    expect(validateStyleMin(textured)).toEqual([]);
    for (const image of Object.values(createMapTextures())) {
      expect(image.data).toHaveLength(image.width * image.height * 4);
      for (let index = 3; index < image.data.length; index += 4)
        expect(image.data[index]).toBe(255);
    }
  });

  it('mantém a fábrica pública de texturas independente entre chamadas', () => {
    const first = createMapTextures();
    const next = createMapTextures();
    const original = next['ground-pixel'].data[0];
    first['ground-pixel'].data[0] = original ^ 255;
    expect(next['ground-pixel'].data[0]).toBe(original);
  });
});
