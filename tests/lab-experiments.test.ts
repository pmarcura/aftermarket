import { describe, expect, it } from 'vitest';
import { runLab, validateLabOptions } from '../packages/simulation/src/lab';
import { applyLabOpening, applyLabShock } from '../packages/simulation/src/lab-experiments';
import { createScenario } from '../packages/simulation/src/scenarios';
import { GAME_DAY } from '../packages/simulation/src/operations';

const at = Date.UTC(2026, 9, 26, 12);
describe('experimentos do laboratório', () => {
  it('rejeita parâmetros e choques ambíguos antes de iniciar', () => {
    for (const value of [null, '1', 0, Infinity, 3.1])
      for (const key of ['costMultiplier', 'capacityMultiplier', 'freightMultiplier'])
        expect(() => validateLabOptions({ [key]: value })).toThrow();
    for (const shock of [
      null,
      [],
      { day: 0, type: 'cost', multiplier: 1 },
      { day: 31, type: 'cost', multiplier: 1 },
      { day: 1, type: 'capacity', multiplier: 1 },
      { day: 1, type: 'cost', multiplier: '1' },
      { day: 1, type: 'cost', multiplier: 0 },
      { day: 1, type: 'cost', multiplier: 1, hidden: true },
    ])
      expect(() => validateLabOptions({ shock })).toThrow();
    expect(() => validateLabOptions({ seedMode: 'random' })).toThrow();
    expect(() => validateLabOptions({ botPolicy: 'smart' })).toThrow();
    expect(() => runLab({ days: 1, capacityRecipe: 'not-a-recipe' })).toThrow('não existe');
  });
  it('altera somente cópias inaugurais e mantém as fronteiras físicas das receitas', () => {
    const world = createScenario(at),
      baseline = structuredClone(world.season.config);
    const beforeMoney = world.companies.reduce((n, c) => n + c.balance, 0);
    const options = validateLabOptions({
      costMultiplier: 0.75,
      capacityMultiplier: 2,
      capacityRecipe: 'soy-oil',
      freightMultiplier: 1.2,
    });
    const log = applyLabOpening(world, options);
    expect(world.season.config.salaries.industry).toBe(
      Math.round(baseline.salaries.industry * 0.75),
    );
    expect(world.season.config.parameters.dieselPerLiter).toBe(
      Math.round(baseline.parameters.dieselPerLiter * 1.2),
    );
    expect(world.season.config.recipes.find((r) => r.id === 'soy-oil')!.duration).toBe(
      Math.round(baseline.recipes.find((r) => r.id === 'soy-oil')!.duration / 2),
    );
    expect(world.season.config.recipes.find((r) => r.id === 'steel-bars')!.duration).toBe(
      baseline.recipes.find((r) => r.id === 'steel-bars')!.duration,
    );
    for (const recipe of world.season.config.recipes) {
      const original = baseline.recipes.find((r) => r.id === recipe.id)!;
      expect(recipe.input).toEqual(original.input);
      expect(recipe.output).toEqual(original.output);
    }
    expect(world.companies.reduce((n, c) => n + c.balance, 0)).toBe(beforeMoney);
    expect(createScenario(at).season.config).toEqual(baseline);
    expect(log.changes).toHaveLength(3);
    applyLabShock(world, { day: 2, type: 'demand', multiplier: 0.5 }, at + GAME_DAY, log);
    expect(log.events).toEqual([{ day: 2, type: 'demand', multiplier: 0.5, at: at + GAME_DAY }]);
    expect(world.season.config.parameters.playableConsumerShare).toBe(
      baseline.parameters.playableConsumerShare * 0.5,
    );
  });
  it('varia condições iniciais por semente conservando dinheiro e reproduz trajetórias', () => {
    const base = runLab({ days: 1 });
    const first = runLab({ days: 2, seed: 7, seedMode: 'conditions' });
    const second = runLab({ days: 2, seed: 7, seedMode: 'conditions' });
    const other = runLab({ days: 1, seed: 8, seedMode: 'conditions' });
    expect(first.observations[0].money).toBe(base.observations[0].money);
    expect(other.observations[0].money).toBe(base.observations[0].money);
    expect(first.observations[0].bots.map((b) => b.balance)).not.toEqual(
      other.observations[0].bots.map((b) => b.balance),
    );
    expect(first.observations).toEqual(second.observations);
    expect(first.trace).toEqual(second.trace);
    expect(first.metadata.replay.options).toEqual(first.options);
    expect(first.trace.length).toBeGreaterThan(0);
    const end = first.observations.at(-1)!;
    expect(end.bots.every((bot) => bot.attempts === bot.executed + bot.rejected)).toBe(true);
    expect(end.bots.reduce((n, b) => n + b.blocked, 0)).toBeGreaterThan(0);
  });
  it('aplica choque no início do dia declarado e relata o que observou', () => {
    const base = runLab({ days: 2 });
    const changed = runLab({ days: 2, shock: { day: 2, type: 'demand', multiplier: 0.5 } });
    expect(changed.observations[1]).toEqual(base.observations[1]);
    expect(changed.metadata.config).toEqual(base.metadata.config);
    expect(changed.metadata.experiment.events).toEqual([
      { day: 2, type: 'demand', multiplier: 0.5, at: at + GAME_DAY },
    ]);
    expect(changed.summary.moneyConserved).toBe(true);
    for (const group of changed.trace) expect(group.count).toBeGreaterThan(0);
  });
});
