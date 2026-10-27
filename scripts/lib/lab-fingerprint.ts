import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function labSourceFingerprint(extraPaths: string[] = []) {
  const sources = ['packages/simulation/src', 'packages/world/src'].flatMap((dir) =>
    readdirSync(resolve(dir), { recursive: true })
      .filter((p) => String(p).endsWith('.ts'))
      .sort()
      .map((p) => `${dir}/${p}\n${readFileSync(resolve(dir, String(p)), 'utf8')}`),
  );
  return createHash('sha256')
    .update(
      [...sources, ...extraPaths.map((p) => `${p}\n${readFileSync(resolve(p), 'utf8')}`)].join(
        '\n',
      ),
    )
    .digest('hex');
}

export const labFixtureSources = [
  'scripts/capture-lab.ts',
  'apps/web/src/devlab/ui-flows.ts',
  'apps/web/src/devlab/ui-evidence.ts',
  'scripts/lib/visual-diff.ts',
];
export const labFixtureFingerprint = () => labSourceFingerprint(labFixtureSources);
