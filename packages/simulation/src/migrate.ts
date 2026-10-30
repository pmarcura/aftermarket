import type { World } from './model';
import { v2SeasonConfig } from './economy-v2';
import { initializeOperations } from './operations';
import { initializeCompetition } from './competition';
import { initializeDesign } from './design';

// Campos da temporada que todo mundo salvo precisa ter (D-042: só existe a economia 2).
const seasonFields = [
  'design',
  'operations',
  'recipes',
  'population',
  'qualification',
  'wholesalePrices',
  'recycling',
  'government',
  'history',
  'regions',
  'worldScale',
] as const;

export function needsMigration(input: unknown) {
  const w = input as World;
  return (
    w.version !== 2 ||
    w.operationsVersion !== 3 ||
    w.designVersion !== 2 ||
    w.competitionVersion !== 1 ||
    !w.orders ||
    !w.infrastructure ||
    !w.season?.config ||
    seasonFields.some((field) => w.season.config[field] === undefined)
  );
}

export function migrateWorld(input: unknown, now = Date.now()): { world: World; changed: boolean } {
  const version = (input as { version?: unknown }).version;
  if (version === 1)
    throw new Error(
      'Mundo da economia 1 não é mais suportado. Crie um mundo novo; o arquivo salvo não foi alterado.',
    );
  if (version !== 2) throw new Error('Versão de mundo não suportada. O banco foi preservado.');
  const raw = input as World;
  if (!needsMigration(raw)) return { world: raw, changed: false };
  // Completa somente campos ausentes de snapshots intermediários de desenvolvimento.
  // Parâmetros que já pertencem à temporada permanecem exatamente como foram salvos.
  const w = structuredClone(raw),
    cfg = w.season.config as Partial<typeof w.season.config>;
  const defaults = v2SeasonConfig(cfg.worldScale ?? 1);
  for (const field of seasonFields)
    if (cfg[field] === undefined) (cfg as Record<string, unknown>)[field] = defaults[field];
  initializeOperations(w);
  initializeCompetition(w, now);
  initializeDesign(w, now);
  // Atualização de regras não deve cobrar retroativamente manutenção/automação nova.
  // Entregas, lotes e treinamentos mantêm seus horários e são liquidados normalmente.
  w.nextEconomicAt = Math.max(w.nextEconomicAt, now);
  w.revision++;
  w.updatedAt = now;
  return { world: w, changed: true };
}
