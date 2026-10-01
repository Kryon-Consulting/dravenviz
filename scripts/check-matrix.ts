import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain } from './gen-lib';

/**
 * Checks evidence/verification-matrix.md (design section 17): every referenced fixture id exists in
 * FIXTURES, every referenced artifact path exists, every status is valid, no PDF row claims `pass`
 * unless evidence/pdf/report-slice1.json passed, and no visual-review row claims `pass` while any
 * baseline in tests/visual/REVIEW.md is still pending (D4).
 */
export const STATUSES = ['pass', 'fail', 'unverified', 'pending-review'] as const;

export interface MatrixRow {
  id: string;
  requirement: string;
  fixtures: string[];
  command: string;
  artifacts: string[];
  status: string;
}

export interface CheckOptions {
  root: string;
  fixtureIds: ReadonlySet<string>;
  /** `result` (or `status`) of evidence/pdf/report-slice1.json. */
  pdfResult: string;
  /** True while any visual baseline in REVIEW.md is undecided. */
  visualPending: boolean;
}

const ticks = (cell: string): string[] =>
  [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string);

export function parseMatrix(text: string): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .split(/(?<!\\)\|/)
      .map((c) => c.trim());
    if (cells.length !== 6) continue;
    const [id, requirement, fixtures, command, artifacts, status] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (id === 'Row' || /^-+$/.test(id)) continue;
    rows.push({
      id,
      requirement,
      fixtures: ticks(fixtures),
      command,
      artifacts: ticks(artifacts),
      status: status.replace(/`/g, '').trim(),
    });
  }
  return rows;
}

export function visualPendingIn(reviewText: string): boolean {
  return /\*\*Decision:\*\*\s*`pending/i.test(reviewText);
}

export function pdfResultIn(report: { result?: string; status?: string }): string {
  return report.result ?? report.status ?? 'missing';
}

export function checkMatrix(text: string, o: CheckOptions): string[] {
  const problems: string[] = [];
  const rows = parseMatrix(text);
  if (rows.length === 0) problems.push('the matrix has no rows');
  for (const r of rows) {
    const at = `row ${r.id}`;
    if (!(STATUSES as readonly string[]).includes(r.status)) {
      problems.push(`${at}: invalid status "${r.status}" (allowed: ${STATUSES.join(', ')})`);
    }
    for (const f of r.fixtures) {
      if (!o.fixtureIds.has(f)) problems.push(`${at}: fixture "${f}" is not in FIXTURES`);
    }
    for (const a of r.artifacts) {
      if (!existsSync(path.join(o.root, a))) problems.push(`${at}: artifact "${a}" does not exist`);
    }
    const isPdf =
      /test:pdf/.test(r.command) || r.artifacts.some((a) => a.startsWith('evidence/pdf/'));
    if (isPdf && r.status === 'pass' && o.pdfResult !== 'pass') {
      problems.push(`${at}: PDF row claims pass but report-slice1.json result is "${o.pdfResult}"`);
    }
    const isVisual = r.artifacts.some((a) => a === 'tests/visual/REVIEW.md');
    if (isVisual && r.status === 'pass' && o.visualPending) {
      problems.push(`${at}: visual row claims pass while baselines are pending review`);
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const { FIXTURES } = await import('../fixtures/index');
  const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
  const problems = checkMatrix(read('evidence/verification-matrix.md'), {
    root: ROOT,
    fixtureIds: new Set(FIXTURES.map((f) => f.id)),
    pdfResult: pdfResultIn(JSON.parse(read('evidence/pdf/report-slice1.json'))),
    visualPending: visualPendingIn(read('tests/visual/REVIEW.md')),
  });
  if (problems.length > 0) {
    for (const p of problems) console.error(`[FAIL] ${p}`);
    process.exit(1);
  }
  console.log('verification matrix: OK');
}

if (isMain(import.meta.url)) {
  void main();
}
