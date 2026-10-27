import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runLab,
  type LabHooks,
  type LabOptions,
  type LabReport,
} from '../../packages/simulation/src/lab';
import { labSourceFingerprint } from './lab-fingerprint';

export function runLabCached(
  options: LabOptions,
  settings: { force?: boolean; hooks?: LabHooks; sourceFingerprint?: string } = {},
) {
  const sourceFingerprint = settings.sourceFingerprint ?? labSourceFingerprint();
  const folder = resolve('.runtime/lab/simulations');
  mkdirSync(folder, { recursive: true });
  const key = createHash('sha256')
    .update(JSON.stringify({ sourceFingerprint, options }))
    .digest('hex')
    .slice(0, 20);
  const path = resolve(folder, `${key}.json`);
  if (!settings.force && existsSync(path)) {
    try {
      const report: LabReport = JSON.parse(readFileSync(path, 'utf8'));
      if (
        report.schemaVersion === 2 &&
        report.metadata.sourceFingerprint === sourceFingerprint &&
        JSON.stringify(report.options) === JSON.stringify(options)
      )
        return { report, path, reused: true };
    } catch {
      /* A partial cache is disposable; rerun an isolated world. */
    }
  }
  const report = runLab(options, settings.hooks);
  report.metadata.sourceFingerprint = sourceFingerprint;
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(report) + '\n');
  renameSync(temporary, path);
  return { report, path, reused: false };
}
