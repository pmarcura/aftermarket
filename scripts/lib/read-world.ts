import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { readWorldSnapshot } from '../../apps/server/src/world-storage';
import type { World } from '../../packages/simulation/src/model';

// Não importar o store: sua abertura pode criar/migrar/atualizar o banco.
export function readSavedWorld(path: string): World {
  if (!path) throw new Error('Informe o caminho do mundo existente.');
  const db = new DatabaseSync(resolve(path), { readOnly: true });
  try {
    return readWorldSnapshot(db);
  } finally {
    db.close();
  }
}
