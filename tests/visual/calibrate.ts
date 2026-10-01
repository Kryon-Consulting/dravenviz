import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { checkPrerequisites } from '../../scripts/test-pdf';
import { CANDIDATES, ROOT, SCALE } from './candidates';
import { diffPng } from './pixels';
import { renderBrowser, renderSvg, startHarness, chromiumPath } from './render';
import { replaceBlock } from './review-md';
import {
  CROSS_PATH_CAP,
  INCLUDE_AA,
  THRESHOLD,
  TOLERANCES_FILE,
  type Tolerances,
} from './tolerances';

/**
 * `pnpm visual:calibrate` (design section 16.2). Renders every comparison type 10 times, records
 * the maximum observed mismatch ratio and derives the allowed ratios:
 *
 * - same-path (browser vs browser, PDF vs PDF): max observed + 0.05 percentage points;
 * - cross-path (standalone SVG vs browser, rasterized PDF vs browser): max observed + 0.1 pp,
 *   capped at 1 %. Above the cap nothing is written: the difference is investigated and recorded
 *   in MISMATCHES.md, never absorbed by a tolerance.
 *
 * Writes `tests/visual/tolerances.json` (the one place the numbers live) and the calibration
 * block of `tests/visual/REVIEW.md`. Needs `pnpm pack:local` (PDF part) and uv with Python 3.12.
 */
const RUNS = 10;
const PP = 0.01; // one percentage point as a ratio

interface Observed {
  max: number;
  pairs: number;
  worst: string;
}
const track = (): Observed => ({ max: 0, pairs: 0, worst: '' });
const note = (o: Observed, ratio: number, label: string): void => {
  o.pairs += 1;
  if (ratio >= o.max) {
    o.max = ratio;
    o.worst = label;
  }
};
const derive = (o: Observed, pp: number): number => Math.ceil((o.max + pp * PP) * 1e6) / 1e6;
const pct = (r: number): string => `${(r * 100).toFixed(3)} %`;

async function browserSide(): Promise<{
  sameBrowser: Observed;
  crossSvg: Observed;
  chromiumVersion: string;
}> {
  const harness = await startHarness();
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const sameBrowser = track();
  const crossSvg = track();
  try {
    const context = await browser.newContext({
      baseURL: harness.url,
      deviceScaleFactor: SCALE,
      viewport: { width: 800, height: 600 },
    });
    const page = await context.newPage();
    for (const c of CANDIDATES) {
      const shots: Buffer[] = [];
      for (let i = 0; i < RUNS; i++) {
        const live = await renderBrowser(page, c);
        shots.push(live);
        const svg = await renderSvg(page, c);
        const d = diffPng(live, svg.png);
        note(crossSvg, d.ratio, `${c.id} run ${i}`);
      }
      // Repeat renders: run i against run i+1 (cyclic), 10 pairs per candidate.
      for (let i = 0; i < RUNS; i++) {
        const d = diffPng(shots[i]!, shots[(i + 1) % RUNS]!);
        note(sameBrowser, d.ratio, `${c.id} runs ${i}/${(i + 1) % RUNS}`);
      }
      console.log(`  ${c.id}: done`);
    }
    return { sameBrowser, crossSvg, chromiumVersion: browser.version() };
  } finally {
    await browser.close();
    await harness.stop();
  }
}

function pdfSide(work: string): { samePdf: Observed; crossPdf: Observed } {
  const project = path.join(ROOT, 'examples/dravenpdf');
  const out = path.join(work, 'pdf');
  const uv = (args: string[]) => spawnSync('uv', ['run', '--project', project, '--python', '3.12', '--frozen', ...args], { cwd: ROOT, stdio: 'inherit' }); // prettier-ignore
  const sync = spawnSync('uv', ['sync', '--project', project, '--python', '3.12', '--frozen'], { cwd: ROOT, stdio: 'inherit' }); // prettier-ignore
  if (sync.status !== 0) throw new Error('uv sync failed');
  const run = uv([
    'python',
    path.join(project, 'calibrate_pdf.py'),
    '--out',
    out,
    '--runs',
    String(RUNS),
  ]);
  if (run.status === 3) process.exit(3); // UNVERIFIED: already printed
  if (run.status !== 0) throw new Error(`calibrate_pdf.py exited with ${run.status}`);

  const samePdf = track();
  const crossPdf = track();
  const namespaces = readdirSync(path.join(out, 'run-0')).filter((f) => f.endsWith('.png'));
  for (let i = 0; i < RUNS; i++) {
    for (const f of namespaces) {
      const a = readFileSync(path.join(out, `run-${i}`, f));
      const b = readFileSync(path.join(out, `run-${(i + 1) % RUNS}`, f));
      note(samePdf, diffPng(a, b).ratio, `${f} runs ${i}/${(i + 1) % RUNS}`);
    }
    const cmp = path.join(work, `compare-${i}`);
    const proc = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'tests/pdf/compare.ts', '--calibrate', '--bundle', path.join(out, 'bundle'), '--crops', path.join(out, `run-${i}`), '--out', cmp],
      { cwd: ROOT, encoding: 'utf8' },
    ); // prettier-ignore
    if (proc.status !== 0)
      throw new Error(`compare.ts failed: ${(proc.stderr || proc.stdout).slice(-600)}`);
    const result = JSON.parse(readFileSync(path.join(cmp, 'comparison.json'), 'utf8')) as {
      comparisons: { namespace: string; ratio: number }[];
    };
    for (const c of result.comparisons) note(crossPdf, c.ratio, `${c.namespace} run ${i}`);
    console.log(`  pdf run ${i}: done`);
  }
  return { samePdf, crossPdf };
}

async function main(): Promise<void> {
  checkPrerequisites();
  if (!existsSync(path.join(ROOT, '.pack', 'draven-viz-0.1.0.tgz'))) {
    console.error('FAIL: .pack/draven-viz-0.1.0.tgz is missing; run pnpm pack:local');
    process.exit(1);
  }
  const work = mkdtempSync(path.join(tmpdir(), 'dv-visual-cal-'));
  try {
    console.log('calibrate: browser and SVG renders');
    const { sameBrowser, crossSvg, chromiumVersion } = await browserSide();
    console.log('calibrate: PDF renders');
    const { samePdf, crossPdf } = pdfSide(work);

    const tolerances: Tolerances = {
      threshold: THRESHOLD,
      includeAA: INCLUDE_AA,
      sameBrowser: derive(sameBrowser, 0.05),
      samePdf: derive(samePdf, 0.05),
      crossSvgBrowser: derive(crossSvg, 0.1),
      crossPdfBrowser: derive(crossPdf, 0.1),
    };
    const over = (
      [
        ['SVG vs browser', crossSvg, tolerances.crossSvgBrowser],
        ['PDF vs browser', crossPdf, tolerances.crossPdfBrowser],
      ] as const
    ).filter(([, , allowed]) => allowed > CROSS_PATH_CAP);

    const rows: [string, string, Observed, number, string][] = [
      ['Same-path: browser vs browser', 'max + 0.05 pp', sameBrowser, tolerances.sameBrowser, ''],
      ['Same-path: PDF crop vs PDF crop', 'max + 0.05 pp', samePdf, tolerances.samePdf, ''],
      ['Cross-path: standalone SVG vs browser', 'max + 0.1 pp, cap 1 %', crossSvg, tolerances.crossSvgBrowser, ''],
      ['Cross-path: rasterized PDF vs browser', 'max + 0.1 pp, cap 1 %', crossPdf, tolerances.crossPdfBrowser, ''],
    ]; // prettier-ignore
    const table = [
      '| comparison type | rule | pairs | max observed | worst pair | allowed ratio |',
      '| --- | --- | ---: | ---: | --- | ---: |',
      ...rows.map(
        ([n, r, o, a]) => `| ${n} | ${r} | ${o.pairs} | ${pct(o.max)} | ${o.worst} | ${pct(a)} |`,
      ),
    ].join('\n');
    const body = [
      '## Calibration (design 16.2)',
      '',
      `Produced by \`pnpm visual:calibrate\` (${RUNS} renders per comparison type; the numbers live in \`tests/visual/tolerances.json\`).`,
      `pixelmatch \`threshold\` ${THRESHOLD}, \`includeAA: ${INCLUDE_AA}\`. Browser PNGs at ${SCALE}x device scale; PDF crops at 150 dpi with 2x supersampling box-filtered down (\`tests/pdf/compare.ts\`). Chromium ${chromiumVersion}.`,
      '',
      table,
      '',
      over.length > 0
        ? `**Above the 1 % cap, nothing was absorbed:** ${over.map(([n]) => n).join(', ')}. See MISMATCHES.md.`
        : 'Every cross-path allowance is within the 1 % cap.',
    ].join('\n');

    if (over.length > 0) {
      replaceBlock('calibration', body);
      console.error(
        `FAIL: cross-path allowance above the 1 % cap for ${over.map(([n]) => n).join(', ')}; investigate and record in MISMATCHES.md`,
      );
      process.exit(1);
    }
    writeFileSync(
      TOLERANCES_FILE,
      `${JSON.stringify(
        {
          tolerances,
          calibration: {
            runs: RUNS,
            chromium: chromiumVersion,
            observed: {
              sameBrowser: { max: sameBrowser.max, pairs: sameBrowser.pairs, worst: sameBrowser.worst },
              samePdf: { max: samePdf.max, pairs: samePdf.pairs, worst: samePdf.worst },
              crossSvgBrowser: { max: crossSvg.max, pairs: crossSvg.pairs, worst: crossSvg.worst },
              crossPdfBrowser: { max: crossPdf.max, pairs: crossPdf.pairs, worst: crossPdf.worst },
            },
          },
        },
        null,
        2,
      )}\n`,
    ); // prettier-ignore
    replaceBlock('calibration', body);
    console.log(table);
    console.log(
      'wrote tests/visual/tolerances.json and the calibration block of tests/visual/REVIEW.md',
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
});
