import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { uiFlows } from '../apps/web/src/devlab/ui-flows';
import { screens } from '../apps/web/src/devlab/screens';
import {
  compareScreenshotPng,
  decodeScreenshotPng,
  encodeScreenshotPng,
} from '../scripts/lib/visual-diff';

describe('contratos de fluxo do laboratório', () => {
  it('cobre cada tela real, aponta fontes existentes e separa contratos de execução observada', () => {
    expect(new Set(uiFlows.map((flow) => flow.id)).size).toBe(uiFlows.length);
    expect(new Set(uiFlows.map((flow) => flow.screen))).toEqual(
      new Set(screens.map((screen) => screen.id)),
    );
    for (const flow of uiFlows) {
      expect(existsSync(resolve('apps/web/src', flow.source)), flow.id).toBe(true);
      expect(flow.preconditions.length, flow.id).toBeGreaterThan(0);
      expect(flow.expectedEffects.length, flow.id).toBeGreaterThan(0);
      expect(flow.states.length, flow.id).toBeGreaterThan(0);
    }
    // Executores disponíveis não são prova de execução: apenas UiFlowRun registra cobertura real.
    expect(uiFlows.find((flow) => flow.id === 'market-negotiation')!.exercisedBy).toBe(
      'scripts/capture-lab.ts --flows',
    );
    expect(uiFlows.find((flow) => flow.id === 'industry-production-error')!.commands).toContain(
      'produce',
    );
  });
});

describe('comparação visual de capturas PNG', () => {
  const pixels = (data: number[], width = 2, height = 1) =>
    encodeScreenshotPng({ width, height, data: Buffer.from(data) });
  const before = pixels([20, 40, 60, 255, 70, 80, 90, 255]);
  it('decodifica pixels reais e não confunde bytes comprimidos com diferença visual', () => {
    expect([...decodeScreenshotPng(before).data]).toEqual([20, 40, 60, 255, 70, 80, 90, 255]);
    expect(compareScreenshotPng(before, before)).toMatchObject({
      status: 'unchanged',
      changedPixels: 0,
      changedRatio: 0,
    });
  });
  it('conta pixels acima do limiar, gera diff legível e preserva fração exata', () => {
    const after = pixels([21, 41, 61, 255, 150, 80, 90, 255]);
    const result = compareScreenshotPng(before, after);
    expect(result).toMatchObject({ status: 'changed', changedPixels: 1, changedRatio: 0.5 });
    expect('diff' in result && result.diff).toBeTruthy();
    if ('diff' in result && result.diff) expect(decodeScreenshotPng(result.diff).width).toBe(2);
  });
  it('declara dimensões incompatíveis e rejeita arquivo inválido sem inventar ratio', () => {
    expect(compareScreenshotPng(before, pixels([20, 40, 60, 255], 1))).toEqual({
      status: 'size-mismatch',
    });
    expect(() => compareScreenshotPng(Buffer.from('not-a-png'), before)).toThrow('PNG');
  });
});
