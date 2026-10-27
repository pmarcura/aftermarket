import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import type { World } from '../../packages/simulation/src/model';

// Não importar o store: sua abertura pode criar/migrar/atualizar o banco.
export function readSavedWorld(path: string): World {
  if (!path) throw new Error('Informe o caminho do mundo existente.');
  const db = new DatabaseSync(resolve(path), { readOnly: true });
  try {
    const row = db.prepare('SELECT state FROM worlds WHERE id=1').get() as
      { state: string } | undefined;
    if (!row) throw new Error('Mundo não encontrado. Nenhum banco foi criado/migrado.');
    return JSON.parse(row.state) as World;
  } finally {
    db.close();
  }
}
