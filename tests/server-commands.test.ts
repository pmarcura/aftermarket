import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { commandSchema } from '../apps/server/src/commands';

// A API recusa o que não estiver no esquema: um comando novo do motor sem esquema some da interface.
describe('esquema de comandos da API', () => {
  it('cobre todos os tipos de comando do motor', () => {
    const source = readFileSync('packages/simulation/src/model.ts', 'utf8');
    const union = source.slice(source.indexOf('export type Command ='));
    const engine = [
      ...new Set(
        [...union.slice(0, union.indexOf('\nexport ')).matchAll(/type: '(\w+)'/g)].map((m) => m[1]),
      ),
    ];
    const api = commandSchema.options.map((o) => o.shape.type.value as string);
    expect(engine.length).toBeGreaterThan(20);
    expect(engine.filter((t) => !api.includes(t))).toEqual([]);
  });

  it('aceita a compra de caminhão por modelo e montadora e a desmontagem', () => {
    expect(
      commandSchema.parse({
        type: 'buyVehicle',
        model: 'truckLight',
        sellerEstablishmentId: 'e-industry',
      }),
    ).toMatchObject({ model: 'truckLight' });
    expect(() => commandSchema.parse({ type: 'buyVehicle', model: 'bicicleta' })).toThrow();
    expect(commandSchema.parse({ type: 'scrapVehicle', vehicleId: 'v1' }).type).toBe(
      'scrapVehicle',
    );
  });
});
