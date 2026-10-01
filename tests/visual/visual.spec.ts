import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_OPTS, h, openHarness } from '../browser/helpers';
import {
  APPROVED_DIR,
  CANDIDATES,
  EVIDENCE_DIR,
  HEIGHT,
  SCALE,
  WIDTH,
  decisionOf,
  type Candidate,
} from './candidates';
import { diffPng } from './pixels';
import { renderBrowser } from './render';
import { loadTolerances } from './tolerances';

/**
 * Visual references (design 16.2, D4, Task 19). Two kinds of test per candidate:
 *
 * - `structure`: semantic assertions that run alongside every image comparison (mark counts from
 *   the manifest, domain labels, annotation position within 0.5 logical units).
 * - `baseline`: compares the render with `baselines/approved/<id>.png` ONLY. A candidate the owner
 *   has not approved has no approved baseline, so it reports `pending owner review` and fails;
 *   CI stays red until approval. Nothing here ever approves or copies a candidate.
 */
test.use({ deviceScaleFactor: SCALE, viewport: { width: 800, height: 600 } });

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Laid {
  boxes: { plot: Box };
  model: {
    x: { type: string; keys?: string[]; domain?: [number, number] };
    yAxes: { id: string; ticks: { label: string }[] }[];
    annotations: {
      id: string;
      xValue: number;
      x2Value?: number;
      y?: number;
    }[];
    manifest: { groups: { key: string; count: number }[] };
  };
}

const POSITION_TOLERANCE = 0.5;
const options = (c: Candidate) => ({ ...DEFAULT_OPTS, theme: c.theme, namespace: 'r' });

const layoutOf = (page: Page, fixture: string): Promise<Laid> =>
  page.evaluate((f) => window.__h.layoutOf(f, 680, 320), fixture) as Promise<Laid>;

for (const c of CANDIDATES) {
  test.describe(c.id, () => {
    test('structure', async ({ page }) => {
      await openHarness(page);
      await h(page).mount([c.fixture], options(c));
      const laid = await layoutOf(page, c.fixture);
      const { model } = laid;

      // Mark counts: every manifest group is drawn with exactly that many items, and no other
      // mark group exists.
      const drawn = await page.evaluate(() => {
        const out: Record<string, number> = {};
        for (const g of document.querySelectorAll('svg[data-dravenviz-chart] [data-dv-mark]')) {
          out[g.getAttribute('data-dv-mark') ?? ''] = g.querySelectorAll('[data-dv-item]').length;
        }
        return out;
      });
      const expected = Object.fromEntries(model.manifest.groups.map((g) => [g.key, g.count]));
      expect(drawn).toEqual(expected);

      // Domain labels: the drawn y tick labels are the model's tick labels.
      const yLabels = await page
        .locator('svg[data-dravenviz-chart] text[data-dv-label-id^="y-tick-"]')
        .allTextContents();
      const wantY = model.yAxes.flatMap((a) => a.ticks.map((t) => t.label));
      expect([...yLabels].sort()).toEqual([...wantY].sort());
      // Category axes draw only labels of keys the model knows.
      if (model.x.type === 'category') {
        // Wrapped lines of one label share its id, so count distinct ids.
        const xCount = await page.evaluate(
          () =>
            new Set(
              Array.from(
                document.querySelectorAll(
                  'svg[data-dravenviz-chart] text[data-dv-label-id^="x-tick-"]',
                ),
              ).map((t) => t.getAttribute('data-dv-label-id')),
            ).size,
        );
        expect(xCount).toBeGreaterThan(0);
        expect(xCount).toBeLessThanOrEqual(model.x.keys!.length);
      }

      // Annotation position within 0.5 logical units (vertical-line annotations).
      const plot = laid.boxes.plot;
      for (const a of model.annotations) {
        if (a.x2Value !== undefined || a.y !== undefined) continue;
        const want =
          model.x.type === 'category'
            ? plot.x + ((a.xValue + 0.5) * plot.width) / model.x.keys!.length
            : plot.x +
              ((a.xValue - model.x.domain![0]) / (model.x.domain![1] - model.x.domain![0])) *
                plot.width;
        const x1 = await page
          .locator(`[data-dv-annotation="${a.id}"] line`)
          .first()
          .getAttribute('x1');
        expect(Math.abs(Number(x1) - want), `annotation ${a.id}`).toBeLessThanOrEqual(
          POSITION_TOLERANCE,
        );
      }

      // The candidate size is the documented one.
      const svg = await page.locator('svg[data-dravenviz-chart]').boundingBox();
      expect(svg?.width).toBe(WIDTH);
      expect(svg?.height).toBe(HEIGHT);
    });

    test('baseline', async ({ page }) => {
      const approved = path.join(APPROVED_DIR, `${c.id}.png`);
      const decision = decisionOf(c.id);
      if (!existsSync(approved) || !decision.startsWith('approved by ')) {
        throw new Error(
          `pending owner review: ${c.id} has no approved baseline ` +
            `(tests/visual/baselines/approved/${c.id}.png; decision in REVIEW.md: ${decision})`,
        );
      }
      const png = await renderBrowser(page, c);
      const diff = diffPng(png, readFileSync(approved));
      const allowed = loadTolerances().sameBrowser;
      if (diff.ratio > allowed) {
        mkdirSync(path.join(EVIDENCE_DIR, 'diff'), { recursive: true });
        writeFileSync(path.join(EVIDENCE_DIR, 'diff', `${c.id}.png`), diff.diff);
      }
      expect(
        diff.ratio,
        `${c.id}: ${(diff.ratio * 100).toFixed(3)} % differs, allowed ${(allowed * 100).toFixed(3)} %`,
      ).toBeLessThanOrEqual(allowed);
    });
  });
}
