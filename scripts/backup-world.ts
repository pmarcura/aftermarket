import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const source = resolve('.runtime/world.sqlite');
if (!existsSync(source)) throw new Error('Inicie o jogo antes de fazer o primeiro backup.');
mkdirSync('.runtime/backups', { recursive: true });
const output = resolve(
  '.runtime/backups',
  `world-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
);
const db = new DatabaseSync(source);
try {
  db.exec(`VACUUM INTO '${output.replaceAll("'", "''")}'`);
  console.log(`Backup consistente criado: ${output}`);
} finally {
  db.close();
}
