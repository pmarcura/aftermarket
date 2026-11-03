import { expect, it, vi } from 'vitest';
import { createWorld } from '../packages/simulation/src/seed';
import { advance } from '../packages/simulation/src/engine';
import { ECONOMIC_INTERVAL } from '../packages/simulation/src/model';

it('processa o atraso em lotes sem pular eventos nem alterar dinheiro, estoques e prazos', () => {
  const start = Date.UTC(2026, 10, 1, 12);
  const whole = createWorld(start),
    batched = structuredClone(whole);
  const end = whole.nextEconomicAt + ECONOMIC_INTERVAL * 15;
  let sequence = 0;
  const uuid = vi
    .spyOn(globalThis.crypto, 'randomUUID')
    .mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
  try {
    advance(whole, end);
    sequence = 0;
    const original = batched.updatedAt;
    advance(batched, end, { maxEvents: 1, maxDurationMs: 0 });
    expect(batched.updatedAt).toBeGreaterThanOrEqual(original);
    expect(batched.updatedAt).toBeLessThan(end);
    for (let count = 0; count < 500 && batched.nextEconomicAt <= end; count++)
      advance(batched, end, { maxEvents: 2, maxDurationMs: 1000 });
    // Revision counts publications, not economic events.
    expect({ ...batched, revision: whole.revision }).toEqual(whole);
  } finally {
    uuid.mockRestore();
  }
});
