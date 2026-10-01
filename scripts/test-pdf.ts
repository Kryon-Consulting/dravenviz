import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain } from './gen-lib';

/**
 * `pnpm test:pdf` (design section 13): checks the prerequisites, packs the library, syncs the
 * Python environment and runs `examples/dravenpdf/run_pdf_check.py` through `uv run`.
 *
 * A missing uv, Python 3.12 or Chromium prints `UNVERIFIED: <reason>` and exits with code 3,
 * before any build starts. The driver's own codes pass through: 0 pass, 1 failure, 3 missing
 * prerequisite, 4 part of the evidence could not be proven (also printed as UNVERIFIED).
 */
const EXAMPLE = 'examples/dravenpdf';
const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function unverified(reason: string): never {
  console.log(`UNVERIFIED: ${reason}`);
  process.exit(3);
}

function checkPrerequisites(): void {
  const uv = spawnSync('uv', ['--version'], { encoding: 'utf8' });
  if (uv.error || uv.status !== 0) unverified('uv is not installed');
  const python = spawnSync('uv', ['python', 'find', '3.12'], { encoding: 'utf8' });
  if (python.status !== 0) {
    unverified('Python 3.12 is not available (run `uv python install 3.12`)');
  }
  const chromium = process.env['PW_CHROMIUM_PATH'] ?? DEFAULT_CHROMIUM;
  if (!existsSync(chromium)) unverified(`Chromium not found at ${chromium} (set PW_CHROMIUM_PATH)`);
}

if (isMain(import.meta.url)) {
  checkPrerequisites();
  const run = (cmd: string, args: string[]): number =>
    spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
  const project = path.join(ROOT, EXAMPLE);
  const steps: [string, string[]][] = [
    ['pnpm', ['pack:local']],
    ['uv', ['sync', '--project', project, '--python', '3.12', '--frozen']],
  ];
  for (const [cmd, args] of steps) {
    const status = run(cmd, args);
    if (status !== 0) {
      console.error(`FAIL: \`${cmd} ${args.join(' ')}\` exited with ${status}`);
      process.exit(1);
    }
  }
  process.exit(
    run('uv', [
      'run', '--project', project, '--python', '3.12', '--frozen',
      'python', path.join(project, 'run_pdf_check.py'),
    ]),
  ); // prettier-ignore
}
