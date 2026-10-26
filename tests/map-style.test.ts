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
import { createMapStyle } from '../apps/web/src/lib/map-style';

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
