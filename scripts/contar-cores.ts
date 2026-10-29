/**
 * Placar da padronização visual: quantas cores ainda estão escritas à mão em cada folha de
 * estilo, em vez de usar as variáveis da identidade (`apps/web/src/design/identidade.css`).
 * Cada tela redesenhada deve baixar o número do seu arquivo.
 *
 *   npm run ui:cores
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'apps/web/src';
const IGNORAR = new Set(['design/identidade.css', 'pages/landing.css', 'devlab/lab.css']);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(css|tsx?)$/.test(nome) ? [caminho] : [];
  });
}

const linhas = arquivos(RAIZ)
  .map((caminho) => {
    const relativo = caminho.slice(RAIZ.length + 1).replaceAll('\\', '/');
    const texto = readFileSync(caminho, 'utf8');
    const cores = (texto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []).length;
    const variaveis = (texto.match(/var\(--/g) ?? []).length;
    return { relativo, cores, variaveis };
  })
  .filter((l) => l.cores > 0 && !IGNORAR.has(l.relativo) && !l.relativo.startsWith('devlab/'))
  .sort((a, b) => b.cores - a.cores);

const total = linhas.reduce((n, l) => n + l.cores, 0);
console.log('Cores escritas à mão (meta: zero fora de design/):\n');
for (const l of linhas)
  console.log(`${String(l.cores).padStart(5)}  ${l.relativo}  (usa ${l.variaveis} variáveis)`);
console.log(`\nTotal: ${total}`);
