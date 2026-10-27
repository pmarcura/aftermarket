import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { createWorld } from '../packages/simulation/src/seed';
import { auditResources, renderResourceCatalog } from '../packages/simulation/src/resource-audit';
import type { World } from '../packages/simulation/src/model';
import { products } from '../packages/simulation/src/model';
import { householdProducts, infrastructurePrograms } from '../packages/simulation/src/channels';
import { materialBoundaries } from '../packages/simulation/src/resource-policy';
import { readSavedWorld } from './lib/read-world';

const args = process.argv.slice(2);
if (
  args.some((a) => !['--check', '--strict', '--write-doc'].includes(a) && !a.startsWith('--world='))
)
  throw new Error('Use --check, --strict, --write-doc ou --world=caminho.sqlite.');
const worldArg = args.find((a) => a.startsWith('--world='));
if (args.includes('--check') && args.includes('--write-doc'))
  throw new Error('--check apenas verifica; use --write-doc separadamente para regenerar.');
if (worldArg && args.includes('--write-doc'))
  throw new Error(
    'Catálogo versionado usa somente a abertura. Salve a auditoria do mundo em .runtime.',
  );
let w: World;
if (worldArg) {
  const path = worldArg.slice('--world='.length);
  w = readSavedWorld(path);
} else w = createWorld(Date.UTC(2026, 9, 27, 12));
const source = worldArg
  ? 'snapshot salvo, leitura sem avanço de tempo'
  : 'abertura do código em 27/10/2026';
const report = {
  source,
  seasonId: w.season.id,
  configVersion: w.season.config.version,
  worldRevision: w.revision,
  observedAt: new Date(w.updatedAt).toISOString(),
  configHash: createHash('sha256').update(JSON.stringify(w.season.config)).digest('hex'),
  catalogHash: createHash('sha256')
    .update(
      JSON.stringify({ products, householdProducts, infrastructurePrograms, materialBoundaries }),
    )
    .digest('hex'),
  ...auditResources(w),
};
let output: string | null = null;
const markdown =
  !args.includes('--check') || !worldArg
    ? await format(renderResourceCatalog(report, source), {
        ...(await resolveConfig(resolve('docs/product/RESOURCE-CATALOG.md'))),
        parser: 'markdown',
      })
    : null;
if (!args.includes('--check')) {
  const dir = resolve('.runtime/resources');
  mkdirSync(dir, { recursive: true });
  const name = worldArg ? 'saved-world' : 'opening';
  output = resolve(dir, `${name}.json`);
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(resolve(dir, `${name}.md`), markdown!);
}
if (args.includes('--write-doc') && !report.structurallyValid)
  throw new Error(
    'Catálogo inválido não substitui a documentação. Revise o relatório em .runtime/resources.',
  );
if (args.includes('--write-doc'))
  writeFileSync(resolve('docs/product/RESOURCE-CATALOG.md'), markdown!);
const errors = report.issues.filter((i) => i.severity === 'error');
const catalogPath = resolve('docs/product/RESOURCE-CATALOG.md');
const catalogCurrent =
  args.includes('--check') && !worldArg
    ? existsSync(catalogPath) &&
      readFileSync(catalogPath, 'utf8').replaceAll('\r\n', '\n') === markdown
    : null;
if (catalogCurrent === false)
  errors.push({
    severity: 'error',
    code: 'STALE_CATALOG',
    subject: 'RESOURCE-CATALOG.md',
    detail: 'Catálogo diverge do código. Execute npm run resources:catalog e revise as mudanças.',
  });
console.log(
  JSON.stringify(
    {
      output,
      source,
      items: report.items.length,
      recipes: report.recipes.length,
      structurallyValid: report.structurallyValid,
      balanced: report.balanced,
      catalogCurrent,
      errors,
      warningCount: report.issues.filter((i) => i.severity === 'warning').length,
      negativeStandardResult: report.recipes
        .filter((r) => r.resultPerDay < 0)
        .map((r) => ({ id: r.id, centsPerDay: r.resultPerDay })),
    },
    null,
    2,
  ),
);
if (errors.length || (args.includes('--strict') && report.issues.length)) process.exitCode = 1;
