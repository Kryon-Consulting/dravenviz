import { expect, test, type Page } from '@playwright/test';
import { openHarness } from './helpers';

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

interface Case {
  name: string;
  /** Names a mutation applied to the well-formed SVG before verification (see EDITS in the page). */
  edit?: string;
  rule: string | null;
}

const MANIFEST = {
  groups: [
    { key: 'series:s:segment', count: 1 },
    { key: 'series:s:marker', count: 2 },
  ],
};

/** Builds a minimal well-formed committed chart in the page, applies the edit, and verifies it. */
async function run(page: Page, c: Case): Promise<string | null> {
  return page.evaluate(
    ([edit, manifest]) => {
      const NS = 'http://www.w3.org/2000/svg';
      const host = document.createElement('div');
      document.body.appendChild(host);
      const el = (tag: string, attrs: Record<string, string>, parent: Element): SVGElement => {
        const e = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        parent.appendChild(e);
        return e;
      };
      const svg = el(
        'svg',
        {
          viewBox: '0 0 100 50',
          width: '100',
          height: '50',
          'data-dv-render-id': '7',
          'data-dravenviz-chart': 'c1',
        },
        host,
      ) as unknown as SVGSVGElement;
      const seg = el('g', { 'data-dv-mark': 'series:s:segment' }, svg);
      const segItem = el('g', { 'data-dv-item': '' }, seg);
      const defs = el('defs', {}, segItem);
      const clip = el('clipPath', { id: 'k' }, defs);
      el('rect', { x: '0', y: '0', width: '5', height: '5' }, clip);
      el('path', { d: 'M10,20L30,20L60,20' }, segItem);
      const markers = el('g', { 'data-dv-mark': 'series:s:marker' }, svg);
      el('circle', { cx: '10', cy: '20', r: '3' }, el('g', { 'data-dv-item': '' }, markers));
      el('circle', { cx: '30', cy: '20', r: '0' }, el('g', { 'data-dv-item': '' }, markers));
      const probe = el('g', { 'data-dv-probe': '', 'data-dv-plot': '10 5 80 30' }, svg);
      el('g', { 'data-dv-probe-x': '', 'data-dv-domain': '["a","b"]' }, probe);
      el('g', { 'data-dv-probe-y': 'v', 'data-dv-domain': '[0,10]' }, probe);

      const q = (s: string): Element => svg.querySelector(s) as Element;
      const EDITS: Record<string, () => void> = {
        none: () => undefined,
        stale: () => svg.setAttribute('data-dv-render-id', '6'),
        viewBox: () => svg.setAttribute('viewBox', '0 0 100 51'),
        noGroup: () => q('[data-dv-mark="series:s:marker"]').remove(),
        noItem: () => q('[data-dv-mark="series:s:marker"] [data-dv-item]').remove(),
        emptyPath: () => q('path').setAttribute('d', ''),
        nanPath: () => q('path').setAttribute('d', 'M10,20LNaN,20'),
        infCircle: () => q('circle').setAttribute('cx', 'Infinity'),
        plotOff: () => q('[data-dv-probe]').setAttribute('data-dv-plot', '10 5.6 80 30'),
        plotNear: () => q('[data-dv-probe]').setAttribute('data-dv-plot', '10.4 5 80 29.6'),
        yDomain: () => q('[data-dv-probe-y]').setAttribute('data-dv-domain', '[0,12]'),
        xDomain: () => q('[data-dv-probe-x]').setAttribute('data-dv-domain', '["a","c"]'),
        noProbe: () => q('[data-dv-probe]').remove(),
        extraGroup: () => el('g', { 'data-dv-mark': 'series:zz:marker' }, svg),
      };
      (EDITS[edit as string] as () => void)();
      const expected = {
        plot: { x: 10, y: 5, width: 80, height: 30 },
        xDomain: { kind: 'category' as const, keys: ['a', 'b'] },
        yDomains: { v: [0, 10] as [number, number] },
      };
      try {
        window.__h.verifyCommitted(svg, manifest, 7, 100, 50, expected);
        return null;
      } catch (e) {
        const err = e as { code: string; issues?: { rule: string }[] };
        return `${err.code}:${err.issues?.[0]?.rule}`;
      } finally {
        host.remove();
      }
    },
    [c.edit ?? 'none', MANIFEST] as const,
  );
}

const cases: Case[] = [
  { name: 'a well-formed commit passes, zero-radius marks included', rule: null },
  { name: 'a stale render id fails', edit: 'stale', rule: 'stale-render' },
  { name: 'a wrong viewBox fails', edit: 'viewBox', rule: 'viewbox-mismatch' },
  { name: 'a missing manifest group fails', edit: 'noGroup', rule: 'missing-mark' },
  { name: 'a missing element in a group fails', edit: 'noItem', rule: 'mark-count-mismatch' },
  { name: 'an item that drew nothing fails', edit: 'emptyPath', rule: 'mark-count-mismatch' },
  { name: 'a NaN coordinate in a path fails', edit: 'nanPath', rule: 'non-finite-geometry' },
  { name: 'a non-finite circle attribute fails', edit: 'infCircle', rule: 'non-finite-geometry' },
  { name: 'a plot area off by more than 0.5 fails', edit: 'plotOff', rule: 'plot-mismatch' },
  { name: 'a plot area within 0.5 passes', edit: 'plotNear', rule: null },
  { name: 'a y domain mismatch fails', edit: 'yDomain', rule: 'domain-mismatch' },
  { name: 'an x domain mismatch fails', edit: 'xDomain', rule: 'domain-mismatch' },
  {
    name: 'a mark group the manifest does not list fails',
    edit: 'extraGroup',
    rule: 'unexpected-mark',
  },
  { name: 'a missing probe fails', edit: 'noProbe', rule: 'probe-missing' },
];

for (const c of cases) {
  test(c.name, async ({ page }) => {
    const got = await run(page, c);
    expect(got).toBe(c.rule === null ? null : `RENDER_FAILED:${c.rule}`);
  });
}
