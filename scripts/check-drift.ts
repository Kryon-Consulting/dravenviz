import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GENERATED_FILES, ROOT, isMain } from './gen-lib';
import { PERF_FILE, generatePerfLine500x4 } from './gen-fixtures';

export interface DriftResult {
  ok: boolean;
  diffs: string[];
}

const GENERATORS = ['scripts/gen-types.ts', 'scripts/gen-validator.ts'];

function readOrNull(file: string): Buffer | null {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

/** Regenerates into a scratch directory under os.tmpdir() and byte-compares with the repo. */
export function runDriftCheck(): DriftResult {
  const scratch = mkdtempSync(path.join(tmpdir(), 'dravenviz-drift-'));
  try {
    const tsx = path.join(ROOT, 'node_modules/.bin/tsx');
    for (const script of GENERATORS) {
      const run = spawnSync(tsx, [path.join(ROOT, script), '--out', scratch], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      if (run.status !== 0) {
        throw new Error(`${script} failed (${run.status}): ${run.stderr || run.error}`);
      }
    }
    const diffs: string[] = [];
    for (const rel of GENERATED_FILES) {
      const fresh = readOrNull(path.join(scratch, rel));
      const committed = readOrNull(path.join(ROOT, rel));
      if (fresh === null) diffs.push(`${rel}: not generated`);
      else if (committed === null) diffs.push(`${rel}: missing in the repository`);
      else if (!fresh.equals(committed)) diffs.push(`${rel}: differs from regenerated output`);
    }
    const perf = readOrNull(path.join(ROOT, PERF_FILE));
    if (perf === null) diffs.push(`${PERF_FILE}: missing in the repository`);
    else if (!perf.equals(Buffer.from(generatePerfLine500x4())))
      diffs.push(`${PERF_FILE}: differs from regenerated output (run scripts/gen-fixtures.ts)`);
    return { ok: diffs.length === 0, diffs };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) {
  const { ok, diffs } = runDriftCheck();
  if (!ok) {
    console.error(`Generated files are stale. Run \`pnpm gen\` and commit.\n${diffs.join('\n')}`);
    process.exit(1);
  }
  console.log('Generated files are up to date.');
}
