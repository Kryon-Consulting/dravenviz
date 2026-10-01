import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { FIXTURES } from '../../fixtures/index';
import {
  STATUSES,
  checkMatrix,
  parseMatrix,
  pdfResultIn,
  visualPendingIn,
} from '../../scripts/check-matrix';

/**
 * Verifies evidence/verification-matrix.md (design section 17). Runs in its own vitest project
 * (`matrix`, `pnpm test:matrix`), not in `pnpm test`: it reads committed evidence files, and
 * `pnpm test` stays Node-unit only (ruling R34).
 */
const ROOT = path.resolve(import.meta.dirname, '../..');
const MATRIX = readFileSync(path.join(ROOT, 'evidence/verification-matrix.md'), 'utf8');
const ids = new Set(FIXTURES.map((f) => f.id));

const HEAD =
  '| Row | Requirement | Fixtures | Command | Artifacts | Status |\n|---|---|---|---|---|---|\n';
const row = (cells: string) => `${HEAD}| X | req | ${cells} |\n`;
const opts = { root: ROOT, fixtureIds: ids, pdfResult: 'pass', visualPending: true };

describe('the committed matrix', () => {
  const rows = parseMatrix(MATRIX);

  test('has no problems: fixtures exist, artifacts exist, statuses are valid', () => {
    const report = JSON.parse(
      readFileSync(path.join(ROOT, 'evidence/pdf/report-slice1.json'), 'utf8'),
    ) as { result?: string; status?: string };
    const reviewText = readFileSync(path.join(ROOT, 'tests/visual/REVIEW.md'), 'utf8');
    const pdfResult = pdfResultIn(report);
    const visualPending = visualPendingIn(reviewText);
    expect(checkMatrix(MATRIX, { root: ROOT, fixtureIds: ids, pdfResult, visualPending })).toEqual(
      [],
    );
  });

  test('covers brief items 1 and 7, the open-item trends row and every Global Constraint', () => {
    const have = new Set(rows.map((r) => r.id));
    const need = ['SPEC-1', 'SPEC-7', 'ROW-OPEN-ITEM-TRENDS'];
    for (let n = 1; n <= 14; n++) need.push(`GC-${String(n).padStart(2, '0')}`);
    expect(need.filter((n) => !have.has(n))).toEqual([]);
  });

  test('every status is one of the four allowed values', () => {
    for (const r of rows) expect(STATUSES).toContain(r.status);
  });
});

describe('checkMatrix rules', () => {
  test('rejects a fixture id that is not in FIXTURES', () => {
    const p = checkMatrix(row('`no-such-fixture` | `pnpm test` | `package.json` | pass'), opts);
    expect(p.join('\n')).toMatch(/no-such-fixture/);
  });

  test('rejects an artifact path that does not exist', () => {
    const p = checkMatrix(row('`min-line` | `pnpm test` | `evidence/none.json` | pass'), opts);
    expect(p.join('\n')).toMatch(/evidence\/none\.json/);
  });

  test('rejects an unknown status', () => {
    const p = checkMatrix(row('- | `pnpm test` | `package.json` | green'), opts);
    expect(p.join('\n')).toMatch(/status/);
  });

  test('rejects pass on a PDF row when the PDF report is not a pass', () => {
    const cells = '- | `pnpm test:pdf` | `evidence/pdf/report-slice1.json` | pass';
    expect(checkMatrix(row(cells), { ...opts, pdfResult: 'unverified' }).join('\n')).toMatch(/PDF/);
    expect(checkMatrix(row(cells), opts)).toEqual([]);
  });

  test('rejects pass on a visual row while baselines are pending review', () => {
    const cells = '- | `pnpm test:browser` | `tests/visual/REVIEW.md` | pass';
    expect(checkMatrix(row(cells), opts).join('\n')).toMatch(/pending/);
    expect(checkMatrix(row(cells), { ...opts, visualPending: false })).toEqual([]);
  });
});
