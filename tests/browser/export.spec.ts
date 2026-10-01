import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { h, openHarness } from './helpers';

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

const o = { width: 680, height: 320, namespace: 'x' };
const none = { roots: 0, observers: 0, svgs: 0 };
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const provenance = readFileSync('assets/fonts/PROVENANCE.md', 'utf8');
const provenanceHash = (file: string): string => {
  const m = new RegExp(`\\|\\s*${file.replace('.', '\\.')}\\s*\\|\\s*([0-9a-f]{64})\\s*\\|`).exec(
    provenance,
  );
  if (!m) throw new Error(`no hash for ${file}`);
  return m[1] as string;
};
const provenanceHashes = (): string[] => [
  provenanceHash('NotoSans-Regular.woff2'),
  provenanceHash('NotoSans-SemiBold.woff2'),
];
const serifHashes = (): string[] =>
  ['NotoSerif-Regular.woff2', 'NotoSerif-SemiBold.woff2'].map((f) =>
    sha(readFileSync(`tests/assets/fonts/${f}`)),
  );
const sha256OfDataUrls = (svg: string): string[] =>
  [...svg.matchAll(/data:font\/[a-z0-9]+;base64,([A-Za-z0-9+/=]+)/g)].map((m) =>
    sha(Buffer.from(m[1] as string, 'base64')),
  );

const fontsOpt = [
  { family: 'Test Serif', weight: 400, url: '/test-fonts/NotoSerif-Regular.woff2' },
  { family: 'Test Serif', weight: 600, url: '/test-fonts/NotoSerif-SemiBold.woff2' },
];

test('real chart exports without renderer metadata', async ({ page }) => {
  const svg = await h(page).renderToSvg('line-weekly-flow', o);
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  expect(svg).toMatch(/viewBox="0 0 680 320"/);
  expect(svg).toMatch(/<title id="x-weekly-flow-1">Items opened and closed<\/title>/);
  // `(^|\s)style="` rather than `style="`: font-style="normal" is a materialized presentation attribute.
  expect(svg).not.toMatch(/class=|(^|\s)style="|recharts|foreignObject|<script|on[a-z]+=/i);
  expect(svg).toMatch(/@font-face[^}]*url\("fonts\/NotoSans-Regular.woff2"\)/);
});

test('the empty style-guard group is dropped and live-only attributes never leak', async ({
  page,
}) => {
  const svg = await h(page).renderToSvg('line-weekly-flow', o);
  expect(svg).not.toContain('data-dv-style-guard');
  expect(svg).not.toContain('data-dv-render-id');
  expect(svg).not.toContain('data-dravenviz');
  expect(svg).not.toContain('tabindex');
  expect(svg).not.toContain('__export');
  expect(svg).not.toMatch(/display:/);
});

test('every id is namespaced in document order and every reference follows', async ({ page }) => {
  const svg = await h(page).renderToSvg('line-estimated-monotone', { ...o, namespace: 'ab' });
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  expect(ids.length).toBeGreaterThan(3);
  expect(ids).toEqual(ids.map((_, i) => `ab-line-estimated-monotone-${i + 1}`));
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const r of refs) expect(ids).toContain(r);
  const labelled = /aria-labelledby="([^"]+)"/.exec(svg)![1]!.split(' ');
  for (const r of labelled) expect(ids).toContain(r);
  const other = await h(page).renderToSvg('line-estimated-monotone', { ...o, namespace: 'cd' });
  const otherIds = [...other.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  expect(otherIds.filter((i) => ids.includes(i))).toEqual([]);
});

test('byte-identical repeat export', async ({ page }) => {
  const a = await h(page).renderToSvgWithAssets('line-weekly-flow', o);
  const b = await h(page).renderToSvgWithAssets('line-weekly-flow', o);
  expect(b.svg).toBe(a.svg);
  expect(b.fonts).toEqual(a.fonts);
  const c = await h(page).renderToSvg('line-weekly-flow', { ...o, fontMode: 'embedded' });
  const d = await h(page).renderToSvg('line-weekly-flow', { ...o, fontMode: 'embedded' });
  expect(d).toBe(c);
});

test('attributes are sorted, numbers have at most 2 decimals, no negative zero', async ({
  page,
}) => {
  const svg = await h(page).renderToSvg('line-estimated-monotone', o);
  for (const tag of svg.matchAll(/<([a-zA-Z]+)((?: [^=\s]+="[^"]*")*)\/?>/g)) {
    const names = [...(tag[2] as string).matchAll(/ ([^=\s]+)="/g)].map((m) => m[1] as string);
    // xmlns comes first on the root; everything else is alphabetical.
    expect(
      names.filter((n) => n !== 'xmlns'),
      tag[0],
    ).toEqual(names.filter((n) => n !== 'xmlns').sort());
  }
  const numericAttrs = [
    ...svg.matchAll(
      / (?:d|x|y|x1|x2|y1|y2|width|height|cx|cy|r|transform|stroke-width)="([^"]*)"/g,
    ),
  ];
  for (const m of numericAttrs) {
    expect(m[1], m[0]).not.toMatch(/\d\.\d{3,}/);
    expect(m[1], m[0]).not.toMatch(/(^|[^\d.])-0(?![\d.])/);
  }
});

test('export cleans up on success, failure and timeout', async ({ page }) => {
  const clean = async (): Promise<void> => {
    expect(await h(page).counts()).toEqual(none);
    expect(
      await page.evaluate(
        () =>
          document.querySelectorAll('[data-dv-export-host],.dravenviz-root,style[data-dv]').length,
      ),
    ).toBe(0);
  };
  await h(page).renderToSvg('line-weekly-flow', o);
  await clean();
  // Failure: an invalid option, an invalid spec and a forced render error.
  expect((await h(page).exportError('line-weekly-flow', { ...o, fontMode: 'zip' })).code).toBe(
    'INVALID_OPTIONS',
  );
  await clean();
  await page.evaluate(() => window.__h.forceRenderError('weekly-flow'));
  expect((await h(page).exportError('line-weekly-flow', o)).code).toBe('RENDER_FAILED');
  await clean();
  // Timeout.
  const fresh = await page.context().newPage();
  await openHarness(fresh);
  const err = await h(fresh).exportError('line-weekly-flow', { ...o, timeoutMs: 1 });
  expect(err.code).toBe('TIMEOUT');
  expect(await h(fresh).counts()).toEqual(none);
  expect(
    await fresh.evaluate(() => document.querySelectorAll('[data-dv-export-host]').length),
  ).toBe(0);
  await fresh.close();
});

test('exporting a chart that is already mounted with the same namespace is not rejected', async ({
  page,
}) => {
  await h(page).mount(['line-weekly-flow'], { width: 680, height: 320, namespace: 'x' });
  const svg = await h(page).renderToSvg('line-weekly-flow', o);
  expect(svg).toMatch(/id="x-weekly-flow-1"/);
  expect((await h(page).counts()).svgs).toBe(1);
});

test('an invalid fontHrefPrefix is rejected before anything mounts', async ({ page }) => {
  for (const bad of ['//evil.example/f/', 'https://evil.example/f/', 'a"b', 'javascript:x']) {
    expect(
      (await h(page).exportError('line-weekly-flow', { ...o, fontHrefPrefix: bad })).code,
    ).toBe('INVALID_OPTIONS');
  }
  expect(await h(page).counts()).toEqual(none);
});

test('inherited fill: child initial value survives under colored parent', async ({ page }) => {
  const svg = await h(page).renderToSvg(
    'line-weekly-flow',
    o,
    '<g data-dv-t="g" fill="red"><rect data-dv-t="a" x="1" y="1" width="5" height="5" style="fill:black"/>' +
      '<rect data-dv-t="b" x="8" y="1" width="5" height="5" fill="red"/></g>',
  );
  const facts = await page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const at = (t: string, a: string): string | null =>
      doc.querySelector(`[data-dv-t="${t}"]`)?.getAttribute(a) ?? null;
    const root = doc.documentElement;
    return {
      g: at('g', 'fill'),
      a: at('a', 'fill'),
      b: at('b', 'fill'),
      root: ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'text-anchor'].map((p) =>
        root.getAttribute(p),
      ),
    };
  }, svg);
  expect(facts.a).toBe('#000000');
  expect(facts.g).toBe('#ff0000');
  expect([null, '#ff0000']).toContain(facts.b);
  for (const v of facts.root) expect(v).not.toBeNull();
});

test('export uses effective style over attribute', async ({ page }) => {
  const markup =
    '<rect data-dv-t="s" x="1" y="1" width="5" height="5" fill="blue" style="fill:red"/>' +
    '<defs><pattern id="p" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#00ff00"/></pattern></defs>' +
    '<rect data-dv-t="pat" x="8" y="1" width="5" height="5" fill="url(#p)"/>';
  const svg = await h(page).renderToSvg('line-weekly-flow', o, markup);
  const facts = await page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const pat = doc.querySelector('pattern');
    return {
      s: doc.querySelector('[data-dv-t="s"]')?.getAttribute('fill'),
      pat: doc.querySelector('[data-dv-t="pat"]')?.getAttribute('fill'),
      patId: pat?.getAttribute('id'),
    };
  }, svg);
  expect(facts.s).toBe('#ff0000');
  expect(facts.pat).toBe(`url(#${facts.patId})`);
  expect(facts.patId).toMatch(/^x-weekly-flow-\d+$/);
  const err = await h(page).exportError(
    'line-weekly-flow',
    o,
    '<rect x="1" y="1" width="5" height="5" fill="url(#missing)"/>',
  );
  expect(err.code).toBe('EXPORT_FAILED');
  expect(err.rule).toBe('svg-dangling-reference');
  expect(await h(page).counts()).toEqual(none);
});

test('markup the allowlist does not know fails the export instead of being stripped', async ({
  page,
}) => {
  for (const [markup, rule] of [
    ['<path d="M0 0" foo="1"/>', 'svg-disallowed-attribute'],
    ['<foreignObject width="1" height="1"/>', 'svg-foreign-object'],
    ['<path d="M0 0" onclick="x()"/>', 'svg-event-attribute'],
    ['<image width="1" height="1"/>', 'svg-disallowed-element'],
  ] as const) {
    const err = await h(page).exportError('line-weekly-flow', o, markup);
    expect(err.code).toBe('EXPORT_FAILED');
    expect(err.rule).toBe(rule);
    expect(err.chartId).toBe('weekly-flow');
  }
});

test('interactive and hidden markup is dropped', async ({ page }) => {
  const svg = await h(page).renderToSvg(
    'line-weekly-flow',
    o,
    '<g data-dv-interactive=""><rect data-dv-t="focus" width="3" height="3"/></g>' +
      '<g style="display:none"><rect data-dv-t="hidden" width="3" height="3"/></g>' +
      '<rect data-dv-t="invisible" width="3" height="3" style="visibility:hidden"/>',
  );
  expect(svg).not.toMatch(/data-dv-t=|data-dv-interactive/);
});

const PROPS_LIST = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'font-style',
];
interface Row {
  tag: string;
  values: string[];
}

/** Computed styles of a tree, in document order, skipping what export drops or replaces. */
function collect(arg: { selector: string; live: boolean }): Row[] {
  const { live } = arg;
  const root = document.querySelector(arg.selector) as Element;
  const PROPS = [
    'fill',
    'fill-opacity',
    'stroke',
    'stroke-width',
    'stroke-opacity',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'opacity',
    'font-family',
    'font-size',
    'font-weight',
    'text-anchor',
    'dominant-baseline',
    'letter-spacing',
    'font-style',
  ];

  const NOT_RENDERED = [
    'defs',
    'clipPath',
    'linearGradient',
    'pattern',
    'stop',
    'title',
    'desc',
    'style',
  ];
  const rows: Row[] = [];
  const visit = (el: Element, inside: boolean): void => {
    const tag = el.localName;
    if (['title', 'desc', 'style'].includes(tag)) return;
    if (live) {
      if (el.hasAttribute('data-dv-interactive')) return;
      if (!inside && !NOT_RENDERED.includes(tag) && getComputedStyle(el).display === 'none') return;
    }
    const cs = getComputedStyle(el);
    rows.push({
      tag,
      values: PROPS.map((p) => cs.getPropertyValue(p).replace(/url\("?#[^")]*"?\)/g, 'url(#)')),
    });
    for (const child of Array.from(el.children)) {
      visit(child, inside || NOT_RENDERED.includes(tag));
    }
  };
  visit(root, false);
  return rows;
}

test('computed-style equivalence after standalone reload', async ({ page }) => {
  for (const id of ['line-weekly-flow', 'line-estimated-monotone', 'line-fixed-domain-clipped']) {
    await h(page).mount([id], { width: 680, height: 320, namespace: 'live' });
    const liveRows = await page.evaluate(collect, {
      selector: 'svg[data-dravenviz-ns="live"][data-dravenviz-chart]',
      live: true,
    });
    const { svg } = await h(page).renderToSvgWithAssets(id, { ...o, namespace: 'ex' });
    const other = await page.context().newPage();
    await other.goto(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    const fileRows = await other.evaluate(collect, { selector: 'svg', live: false });
    await other.close();
    const live = liveRows;
    const file = fileRows;
    expect(live.length, id).toBeGreaterThan(40);
    expect(
      file.map((r) => r.tag),
      id,
    ).toEqual(live.map((r) => r.tag));
    live.forEach((row, i) => {
      PROPS_LIST.forEach((p, k) => {
        expect(file[i]!.values[k], `${id} #${i} <${row.tag}> ${p}`).toBe(row.values[k]);
      });
    });
    await page.evaluate(() =>
      document.querySelectorAll('.dravenviz-root').forEach((e) => e.remove()),
    );
  }
});

test('embedded mode embeds exactly the measured bytes', async ({ page }) => {
  const { svg, fonts } = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fontMode: 'embedded',
  });
  expect(fonts.map((f) => f.sha256)).toEqual(provenanceHashes());
  expect(sha256OfDataUrls(svg)).toEqual(provenanceHashes());
  expect(svg).not.toMatch(/url\("fonts\//);
  expect(svg.match(/data-dv-font-sha256="([0-9a-f]{64})"/g)).toHaveLength(2);
});

test('external mode lists the font files that were measured', async ({ page }) => {
  const { fonts } = await h(page).renderToSvgWithAssets('line-weekly-flow', o);
  expect(fonts.map((f) => [f.family, f.weight, f.fileName, f.href])).toEqual([
    ['Noto Sans', 400, 'NotoSans-Regular.woff2', 'fonts/NotoSans-Regular.woff2'],
    ['Noto Sans', 600, 'NotoSans-SemiBold.woff2', 'fonts/NotoSans-SemiBold.woff2'],
  ]);
  expect(fonts.map((f) => f.sha256)).toEqual(provenanceHashes());
});

test('custom font drives family, hrefs and embedded bytes', async ({ page }) => {
  const ext = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fonts: fontsOpt,
    fontHrefPrefix: 'assets/f/',
  });
  expect(ext.svg).toMatch(/font-family="Test Serif, sans-serif"/);
  expect(ext.svg).toMatch(/url\("assets\/f\/NotoSerif-Regular.woff2"\)/);
  expect(ext.svg).not.toMatch(/NotoSans/);
  const emb = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fonts: fontsOpt,
    fontMode: 'embedded',
  });
  expect(sha256OfDataUrls(emb.svg)).toEqual(serifHashes());
});

test('relocated external SVG loads its custom font', async ({ page, browser }) => {
  const ext = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fonts: fontsOpt,
    fontHrefPrefix: 'assets/f/',
  });
  const dir = mkdtempSync(join(tmpdir(), 'dv-export-'));
  mkdirSync(join(dir, 'assets/f'), { recursive: true });
  writeFileSync(join(dir, 'chart.svg'), ext.svg);
  for (const f of ext.fonts) {
    copyFileSync(`tests/assets/fonts/${f.fileName}`, join(dir, 'assets/f', f.fileName));
  }
  await h(page).mount(['line-weekly-flow'], { ...o, namespace: 'live', fonts: fontsOpt } as never);
  const inPage = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg[data-dravenviz-chart] text')).map((t) =>
      (t as SVGTextContentElement).getComputedTextLength(),
    ),
  );
  const other = await browser.newPage();
  await other.goto(`file://${join(dir, 'chart.svg')}`);
  const file = await other.evaluate(async () => {
    const faces = Array.from(document.fonts);
    await Promise.all(faces.map((f) => f.load()));
    await document.fonts.ready;
    return {
      statuses: faces.map((f) => `${f.family}|${f.weight}|${f.status}`),
      check: document.fonts.check('13px "Test Serif"'),
      widths: Array.from(document.querySelectorAll('text')).map((t) =>
        (t as unknown as SVGTextContentElement).getComputedTextLength(),
      ),
    };
  });
  await other.close();
  expect(file.statuses.sort()).toEqual(['Test Serif|400|loaded', 'Test Serif|600|loaded'].sort());
  expect(file.check).toBe(true);
  expect(file.widths).toHaveLength(inPage.length);
  file.widths.forEach((w, i) => expect(Math.abs(w - inPage[i]!)).toBeLessThanOrEqual(0.5));
});

test('standalone file re-renders identically', async ({ page, browser }) => {
  await h(page).mount(['line-weekly-flow'], { width: 680, height: 320, namespace: 'live' });
  const live = PNG.sync.read(
    await page.locator('svg[data-dravenviz-chart="weekly-flow"]').screenshot(),
  );
  const { svg } = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fontMode: 'embedded',
  });
  const other = await browser.newPage({ viewport: { width: 680, height: 320 } });
  await other.goto(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  await other.evaluate(() => document.fonts.ready.then(() => undefined));
  const file = PNG.sync.read(
    await other.screenshot({ clip: { x: 0, y: 0, width: 680, height: 320 } }),
  );
  await other.close();
  expect([file.width, file.height]).toEqual([live.width, live.height]);
  const mismatched = pixelmatch(live.data, file.data, undefined, live.width, live.height, {
    threshold: 0.1,
  });
  expect(mismatched).toBe(0);
});

const HOSTILE = [
  'body{color:red;font:20px serif;letter-spacing:3px}',
  'svg{fill:blue;font-size:30px;dominant-baseline:hanging}',
  '*{opacity:.5}',
  'g{stroke:green}',
  'rect{fill:red}',
  'text{font-style:italic}',
  'path,line,circle{stroke:orange;stroke-width:9px}',
].join('\n');

test('hostile page CSS cannot change the export (byte-identical to a clean page)', async ({
  page,
}) => {
  const clean = await h(page).renderToSvg('line-weekly-flow', o);
  await openHarness(page);
  await page.addStyleTag({ content: HOSTILE });
  const hostile = await h(page).renderToSvg('line-weekly-flow', o);
  expect(hostile).toBe(clean);
  const emb = await h(page).renderToSvg('line-weekly-flow', { ...o, fontMode: 'embedded' });
  await openHarness(page);
  expect(await h(page).renderToSvg('line-weekly-flow', { ...o, fontMode: 'embedded' })).toBe(emb);
  expect(await h(page).counts()).toEqual(none);
});

test('the live chart keeps its text positions under a dominant-baseline host rule', async ({
  page,
}) => {
  const boxes = (): Promise<number[][]> =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('svg[data-dravenviz-chart] text')).map((t) => {
        const r = t.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100);
      }),
    );
  await h(page).mount(['line-weekly-flow'], { width: 680, height: 320, namespace: 'live' });
  const clean = await boxes();
  await openHarness(page);
  await page.addStyleTag({ content: 'svg,svg *{dominant-baseline:hanging}' });
  await h(page).mount(['line-weekly-flow'], { width: 680, height: 320, namespace: 'live' });
  const hostile = await boxes();
  expect(clean.length).toBeGreaterThan(10);
  expect(hostile).toEqual(clean);
});

test('an unknown data-* attribute fails the export instead of being stripped', async ({ page }) => {
  const err = await h(page).exportError('line-weekly-flow', o, '<path d="M0 0" data-foo="1"/>');
  expect(err.code).toBe('EXPORT_FAILED');
  expect(err.rule).toBe('svg-disallowed-attribute');
  expect(err.path).toMatch(/@data-foo$/);
});

test('a style element in the live chart fails the export', async ({ page }) => {
  const err = await h(page).exportError('line-weekly-flow', o, '<style>text{fill:red}</style>');
  expect(err.code).toBe('EXPORT_FAILED');
  expect(err.rule).toBe('svg-disallowed-element');
  expect(err.path).toMatch(/\/style\[1\]$/);
  expect(await h(page).counts()).toEqual(none);
});
