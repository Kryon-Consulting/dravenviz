/**
 * Typed fixture catalog. Node-only test infrastructure: it reads files and hashes with
 * `node:crypto`, and it is not part of the shipped package.
 *
 * Vocabulary
 * - family:   the chart family the fixture exercises (design §15).
 * - modes:    render modes it is meant for: "interactive", "static" (SVG export) and "print" (PDF).
 * - coverage: strings naming what the fixture covers, from a closed vocabulary:
 *     "brief-<n>"  design §15 brief item n (1-11, "Extra" items are tagged "extra");
 *     "row:<name>" a coverage row from design §15 ("row:open-item-trends" is
 *                  "Open-item/inventory trends, sparkline");
 *     "schema:min" the minimal valid spec of a kind, used by schema and validation tests;
 *     "edge:<name>" a data or layout edge case (singleton, all-equal, measured-zero, all-missing,
 *                  fixed-clipped, estimated, irregular-x, label-policy-wrap|rotate|thin,
 *                  thinned-ticks, perf, markup-escape);
 *     "extra"      a design §15 "Extra" fixture.
 * - slice:    the implementation slice in which the fixture is first rendered (1, 2 or 3).
 * - gallery:  true when the docs gallery shows it (min-* and perf fixtures are not shown).
 *
 * Invalid fixtures are NOT catalogued here. They live in fixtures/invalid/<rule>.json with a
 * sibling <rule>.expected.json and are discovered by directory scan in tests/unit/validate.test.ts,
 * so the rule-per-file convention already is their catalog.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type FixtureFamily =
  'line' | 'bar' | 'area' | 'composed' | 'scatter' | 'donut' | 'heatmap' | 'progress';

export interface FixtureEntry {
  id: string;
  /** Repo-relative path of the fixture file. */
  file: string;
  family: FixtureFamily;
  modes: string[];
  coverage: string[];
  slice: 1 | 2 | 3;
  gallery: boolean;
}

const ALL_MODES = ['interactive', 'static', 'print'];
const TEST_MODES = ['interactive', 'static'];

const entry = (
  id: string,
  family: FixtureFamily,
  coverage: string[],
  opts: { slice?: 1 | 2 | 3; gallery?: boolean; modes?: string[] } = {},
): FixtureEntry => ({
  id,
  file: `fixtures/valid/${id}.json`,
  family,
  modes: opts.modes ?? ALL_MODES,
  coverage,
  slice: opts.slice ?? 1,
  gallery: opts.gallery ?? true,
});

const min = (family: FixtureFamily, slice: 1 | 2 | 3, id: string): FixtureEntry =>
  entry(id, family, ['schema:min'], { slice, gallery: false, modes: TEST_MODES });

export const FIXTURES: readonly FixtureEntry[] = [
  min('area', 2, 'min-area'),
  min('bar', 2, 'min-bar'),
  min('composed', 2, 'min-composed'),
  min('donut', 2, 'min-donut'),
  min('heatmap', 3, 'min-heatmap'),
  min('line', 1, 'min-line'),
  min('progress', 3, 'min-progress'),
  min('scatter', 3, 'min-scatter'),
  entry('text-markup-title', 'line', ['brief-9', 'edge:markup-escape'], {
    gallery: false,
    modes: TEST_MODES,
  }),
  entry('line-weekly-flow', 'line', ['brief-1', 'brief-8', 'row:open-item-trends']),
  entry('line-thinned-annotation', 'line', [
    'brief-7',
    'row:open-item-trends',
    'edge:thinned-ticks',
  ]),
  entry('line-singleton', 'line', ['brief-7', 'edge:singleton']),
  entry('line-all-equal', 'line', ['brief-7', 'edge:all-equal']),
  entry('line-measured-zero', 'line', ['brief-7', 'edge:measured-zero']),
  entry('line-all-missing', 'line', ['brief-7', 'edge:all-missing']),
  entry('line-irregular-numeric', 'line', ['extra', 'edge:irregular-x']),
  entry('line-irregular-time', 'line', ['extra', 'edge:irregular-x']),
  entry('line-fixed-domain-clipped', 'line', ['extra', 'edge:fixed-clipped']),
  entry('line-estimated-monotone', 'line', ['extra', 'edge:estimated']),
  entry('line-category-labels-wrap', 'line', ['extra', 'edge:label-policy-wrap']),
  entry('line-category-labels-rotate', 'line', ['extra', 'edge:label-policy-rotate']),
  entry('line-category-labels-thin', 'line', ['extra', 'edge:label-policy-thin']),
  entry('perf-line-500x4', 'line', ['extra', 'edge:perf'], {
    gallery: false,
    modes: ['interactive', 'static'],
  }),
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parses the fixture with this catalog id. Throws for an id that is not catalogued. */
export function loadFixture(id: string): unknown {
  const found = FIXTURES.find((f) => f.id === id);
  if (!found) throw new Error(`unknown fixture: ${id}`);
  return JSON.parse(readFileSync(path.join(ROOT, found.file), 'utf8'));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 (hex) of the canonical JSON of `spec`: keys sorted at every depth, no whitespace. */
export function specHash(spec: unknown): string {
  return createHash('sha256').update(canonical(spec)).digest('hex');
}
