import { expect, test } from '@playwright/test';
import { DEFAULT_OPTS as opts, h, openHarness } from './helpers';

test.beforeEach(async ({ page }) => {
  await openHarness(page);
});

test('mounts weekly-flow and resolves after final geometry', async ({ page }) => {
  const info = await h(page).mount(['line-weekly-flow'], {
    width: 680,
    height: 320,
    theme: 'print',
    namespace: 'r',
  });
  expect(info).toEqual([
    expect.objectContaining({ chartId: 'weekly-flow', width: 680, height: 320 }),
  ]);
  expect(
    await page
      .locator(
        'svg[data-dravenviz-chart="weekly-flow"] [data-dv-mark="series:closed:segment"] path',
      )
      .count(),
  ).toBe(1);
});

test('the root svg carries the render id, namespace, chart id and viewBox', async ({ page }) => {
  const [info] = await h(page).mount(['line-weekly-flow'], { ...opts, namespace: 'ab' });
  const svg = page.locator('svg[data-dravenviz-chart="weekly-flow"]');
  await expect(svg).toHaveAttribute('data-dv-render-id', String(info!.renderId));
  await expect(svg).toHaveAttribute('data-dravenviz-ns', 'ab');
  await expect(svg).toHaveAttribute('viewBox', '0 0 680 320');
  await expect(
    page.locator('div.dravenviz-root[data-dravenviz-chart="weekly-flow"]'),
  ).toHaveAttribute('data-dravenviz-ns', 'ab');
  // 178 mm print theme: the effective sizes are reported and meet the print minimums.
  expect(info!.effectivePt!.label).toBeGreaterThanOrEqual(9 - 1e-6);
});

test('flat, singleton, zero and all-missing charts become ready', async ({ page }) => {
  for (const id of ['line-all-equal', 'line-singleton', 'line-measured-zero', 'line-all-missing']) {
    await expect(
      h(page).mount([id], { ...opts, namespace: id.slice(5, 12).replace(/[^a-z]/g, 'x') }),
    ).resolves.toHaveLength(1);
  }
});

test('all-missing draws the empty state and no line', async ({ page }) => {
  await h(page).mount(['line-all-missing'], opts);
  await expect(page.locator('[data-dv-mark="empty-state"] text')).toHaveText('No measured data');
  expect(await page.locator('[data-dv-mark$=":segment"]').count()).toBe(0);
});

test('every slice-1 line fixture becomes ready', async ({ page }) => {
  const ids = [
    'line-weekly-flow',
    'line-thinned-annotation',
    'line-irregular-numeric',
    'line-irregular-time',
    'line-fixed-domain-clipped',
    'line-estimated-monotone',
    'line-category-labels-wrap',
    'line-category-labels-rotate',
    'line-category-labels-thin',
    'min-line',
    'text-markup-title',
    'perf-line-500x4',
  ];
  for (const [i, id] of ids.entries()) {
    const [info] = await h(page).mount([id], { ...opts, namespace: `n${i}` });
    expect(info!.width).toBe(680);
  }
  expect((await h(page).counts()).svgs).toBe(ids.length);
});

test('batch validation failure mounts nothing', async ({ page }) => {
  const err = await h(page).mountError(['line-weekly-flow', 'invalid-unknown-field'], opts);
  expect(err).toMatchObject({ code: 'INVALID_SPEC', chartId: expect.any(String), path: '/colour' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('a limit failure reports LIMIT_EXCEEDED with the chart id and mounts nothing', async ({
  page,
}) => {
  const err = await h(page).mountError(['line-weekly-flow'], { ...opts, limits: { series: 1 } });
  expect(err).toMatchObject({ code: 'LIMIT_EXCEEDED', chartId: 'weekly-flow' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('invalid options reject before the DOM is touched', async ({ page }) => {
  for (const bad of [{ width: 0 }, { height: -1 }, { namespace: 'Bad Ns' }, { timeoutMs: 0 }]) {
    const err = await h(page).mountError(['line-weekly-flow'], { ...opts, ...bad });
    expect(err.code).toBe('INVALID_OPTIONS');
  }
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('render failure in chart 2 disposes chart 1', async ({ page }) => {
  await page.evaluate(() => window.__h.forceRenderError('line-singleton'));
  const err = await h(page).mountError(['line-weekly-flow', 'line-singleton'], {
    ...opts,
    namespaces: ['a', 'b'],
  });
  expect(err).toMatchObject({ code: 'RENDER_FAILED', chartId: 'line-singleton' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
  expect(await page.locator('.dravenviz-root').count()).toBe(0);
});

test('rejects ZERO_SIZE for hidden ancestor', async ({ page }) => {
  const err = await h(page).mountError(['line-weekly-flow'], { ...opts, host: 'hidden' });
  expect(err).toMatchObject({ code: 'ZERO_SIZE', chartId: 'weekly-flow' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('second batch with same embedding identity is rejected', async ({ page }) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const err = await h(page).mountError(['line-weekly-flow'], opts);
  expect(err).toMatchObject({
    code: 'INVALID_OPTIONS',
    rule: 'duplicate-chart-embedding',
    chartId: 'weekly-flow',
  });
  expect((await h(page).counts()).svgs).toBe(1);
  await expect(page.locator('svg[data-dravenviz-chart="weekly-flow"]')).toHaveCount(1);
});

test('a repeated pair inside one batch is rejected; distinct namespaces are accepted', async ({
  page,
}) => {
  const dup = await h(page).mountError(['line-weekly-flow', 'line-weekly-flow'], opts);
  expect(dup).toMatchObject({ code: 'INVALID_OPTIONS', rule: 'duplicate-chart-embedding' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
  const ok = await h(page).mount(['line-weekly-flow', 'line-weekly-flow'], {
    ...opts,
    namespaces: ['a', 'b'],
  });
  expect(ok).toHaveLength(2);
  expect(ok[0]!.renderId).not.toBe(ok[1]!.renderId);
});

test('two instances with distinct namespaces share no ids', async ({ page }) => {
  await h(page).mount(['line-estimated-monotone'], { ...opts, namespace: 'wf-a' });
  await h(page).mount(['line-estimated-monotone'], { ...opts, namespace: 'wf-b' });
  const ids = await page.evaluate(() => {
    const collect = (ns: string): string[] =>
      Array.from(document.querySelectorAll(`svg[data-dravenviz-ns="${ns}"] [id]`)).map((e) => e.id);
    return { a: collect('wf-a'), b: collect('wf-b') };
  });
  expect(ids.a.length).toBeGreaterThan(0);
  expect(ids.b.length).toBeGreaterThan(0);
  expect(ids.a.filter((id) => ids.b.includes(id))).toEqual([]);
  // DravenViz's own ids follow <namespace>-<chartId>-<n>.
  const own = ids.a.filter((id) => id.startsWith('wf-a-line-estimated-monotone-'));
  expect(own.length).toBeGreaterThan(0);
});

test('dispose before ready rejects DISPOSED and cleans up', async ({ page }) => {
  await page.route('**/fonts/*.woff2', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  const out = await page.evaluate(async (o) => {
    const id = window.__h.start(['line-weekly-flow'], o as never);
    window.__h.dispose(id);
    return window.__h.outcome(id);
  }, opts);
  expect(out).toMatchObject({ ok: false, error: { code: 'DISPOSED' } });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('dispose after ready removes everything and is idempotent', async ({ page }) => {
  const res = await page.evaluate(async (o) => {
    const id = window.__h.start(['line-weekly-flow'], o as never);
    const first = await window.__h.outcome(id);
    const live = window.__h.counts();
    window.__h.dispose(id);
    window.__h.dispose(id);
    return { first: first.ok, live, after: window.__h.counts() };
  }, opts);
  expect(res.first).toBe(true);
  expect(res.live.svgs).toBe(1);
  expect(res.live.roots).toBe(1);
  expect(res.after).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('timeout rejects TIMEOUT, cancels the font load and cleans up', async ({ page }) => {
  await page.route('**/fonts/*.woff2', () => {
    // never respond
  });
  const out = await h(page).mountError(['line-weekly-flow'], { ...opts, timeoutMs: 300 });
  expect(out.code).toBe('TIMEOUT');
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
  // The shared font registry must not keep a poisoned entry: a retry loads.
  await page.unroute('**/fonts/*.woff2');
  await expect(h(page).mount(['line-weekly-flow'], opts)).resolves.toHaveLength(1);
});

test('unsupported kind rejects not-implemented-in-slice', async ({ page }) => {
  const err = await h(page).mountError(['min-donut'], opts);
  expect(err).toMatchObject({
    code: 'RENDER_FAILED',
    rule: 'not-implemented-in-slice',
    chartId: expect.any(String),
  });
  expect(err.message).toMatch(/slice 2/);
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});

test('title markup renders as text', async ({ page }) => {
  const scriptsBefore = await page.locator('script').count();
  await h(page).mount(['text-markup-title'], opts);
  expect(await page.locator('script').count()).toBe(scriptsBefore);
  expect(await page.locator('svg script').count()).toBe(0);
  const title = '</text><script>alert(1)</script>';
  const texts = await page.locator('svg [data-dv-text-role="title"]').allTextContents();
  expect(texts.join(' ')).toBe(title);
});

test('mountCharts creates no ResizeObserver', async ({ page }) => {
  await h(page).mount(['line-weekly-flow'], opts);
  expect(await page.evaluate(() => window.__h.resizeObservers())).toBe(0);
});

test('host CSS cannot restyle the chart (host-style isolation)', async ({ page }) => {
  await page.addStyleTag({ content: 'text{fill:red} path{stroke-width:5} *{font-family:serif}' });
  await h(page).mount(['line-weekly-flow'], opts);
  const res = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-dravenviz-chart]')!;
    const texts = Array.from(svg.querySelectorAll('text')).map((t) => {
      const cs = getComputedStyle(t);
      return { fill: cs.fill, family: cs.fontFamily, label: t.getAttribute('data-dv-label-id') };
    });
    const line = svg.querySelector('[data-dv-mark="series:closed:segment"] path')!;
    return { texts, strokeWidth: getComputedStyle(line).strokeWidth };
  });
  expect(res.texts.length).toBeGreaterThan(10);
  for (const t of res.texts) {
    expect(t.fill).not.toBe('rgb(255, 0, 0)');
    expect(t.family).toContain('Noto Sans');
  }
  expect(res.strokeWidth).toBe('2px');
});

test('every text carries a label id and a role, and every visual property is inline', async ({
  page,
}) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const res = await page.evaluate(() => {
    const roles = new Set<string>();
    const bad: string[] = [];
    for (const t of document.querySelectorAll('svg[data-dravenviz-chart] text')) {
      const role = t.getAttribute('data-dv-text-role');
      if (!t.getAttribute('data-dv-label-id') || !role) bad.push('missing id/role');
      roles.add(role ?? '');
      const style = (t as SVGElement).style;
      for (const p of ['fill', 'font-family', 'font-size', 'font-weight']) {
        if (!style.getPropertyValue(p)) bad.push(`${role}: no inline ${p}`);
      }
    }
    const marks: string[] = [];
    for (const m of document.querySelectorAll(
      '[data-dv-mark] path, [data-dv-mark] circle, [data-dv-mark] rect, [data-dv-mark] line',
    )) {
      if (m.closest('clipPath')) continue; // clip geometry paints nothing
      const style = (m as SVGElement).style;
      for (const p of ['fill', 'stroke', 'stroke-width']) {
        if (!style.getPropertyValue(p)) marks.push(`${m.localName}: no inline ${p}`);
      }
    }
    return { roles: [...roles].sort(), bad, marks };
  });
  expect(res.bad).toEqual([]);
  expect(res.marks).toEqual([]);
  expect(res.roles).toEqual([
    'annotation',
    'axis-title',
    'legend',
    'note',
    'reference',
    'tick',
    'title',
  ]);
});

test('renderDataTable renders a table from text nodes and removes itself', async ({ page }) => {
  const spec = await h(page).fixture('line-weekly-flow');
  const out = await page.evaluate((s) => {
    const { dispose } = window.__h.renderTable(s, true);
    const table = document.querySelector('table.dravenviz-table')!;
    const cells = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.children).map((c) => c.textContent),
    );
    const info = {
      caption: table.querySelector('caption')!.textContent,
      head: Array.from(table.querySelectorAll('thead th')).map((c) => c.textContent),
      cells,
      hidden: document.querySelector('.dravenviz-root.dravenviz-visually-hidden') !== null,
      notes: Array.from(document.querySelectorAll('.dravenviz-table-notes li')).map(
        (l) => l.textContent,
      ),
      noElementChildren: Array.from(table.querySelectorAll('th,td,caption')).every((c) =>
        Array.from(c.childNodes).every((n) => n.nodeType === Node.TEXT_NODE),
      ),
    };
    window.__h.dispose(dispose);
    window.__h.dispose(dispose);
    return { info, left: document.querySelectorAll('table.dravenviz-table').length };
  }, spec);
  expect(out.info.caption).toBe('Items opened and closed (count)');
  expect(out.info.head).toEqual(['Week', 'Opened (count)', 'Closed (count)']);
  expect(out.info.cells[1]).toEqual(['13 Jul', 'Not measured', '10']);
  expect(out.info.hidden).toBe(true);
  expect(out.info.noElementChildren).toBe(true);
  expect(out.info.notes[0]).toContain('Collection paused');
  expect(out.left).toBe(0);
});

test('host opacity, letter-spacing and font-style rules cannot restyle the chart', async ({
  page,
}) => {
  await page.addStyleTag({
    content:
      '*{opacity:.5} g{opacity:.5} svg{opacity:.5} text{letter-spacing:3px;font-style:italic}',
  });
  await h(page).mount(['line-weekly-flow'], opts);
  const res = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-dravenviz-chart]')!;
    const bad: string[] = [];
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      if (el.closest('defs,clipPath,title,desc') || el.hasAttribute('data-dv-probe')) continue;
      let product = 1;
      // Walk up to the svg root: the chart's own ancestors are the host's business.
      for (let n: Element | null = el; n; n = n === svg ? null : n.parentElement) {
        product *= Number(getComputedStyle(n).opacity);
      }
      if (Math.abs(product - 1) > 1e-9)
        bad.push(`${el.localName}.${el.getAttribute('class') ?? ''} ${product}`);
    }
    const texts = Array.from(svg.querySelectorAll('text')).map((t) => {
      const cs = getComputedStyle(t);
      return `${cs.letterSpacing}/${cs.fontStyle}`;
    });
    return { bad: bad.slice(0, 8), n: bad.length, texts: [...new Set(texts)] };
  });
  expect(res.bad).toEqual([]);
  expect(res.texts).toEqual(['normal/normal']);
});

test('quality legend entries draw their meaning and stay inside the chart', async ({ page }) => {
  await h(page).mount(['line-weekly-flow'], opts);
  const res = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[data-dv-legend-item^="quality:"]'));
    const svg = document.querySelector('svg[data-dravenviz-chart]') as SVGSVGElement;
    return items.map((i) => ({
      text: Array.from(i.querySelectorAll('text'))
        .map((t) => t.textContent)
        .join(' '),
      right: Math.max(
        ...Array.from(i.querySelectorAll('text')).map(
          (t) => (t as SVGGraphicsElement).getBBox().x + (t as SVGGraphicsElement).getBBox().width,
        ),
      ),
      width: svg.viewBox.baseVal.width,
    }));
  });
  expect(res).toHaveLength(2);
  expect(res[0]!.text).toContain('Partial — Hollow marker');
  expect(res[1]!.text).toContain('Lagging — Ringed marker');
  for (const r of res) expect(r.right).toBeLessThanOrEqual(r.width - 16 + 0.5);
});

test('legend swatches draw a marker only when the series draws markers', async ({ page }) => {
  const spec = await h(page).fixture<{ id: string; series: { marker?: unknown }[] }>(
    'line-weekly-flow',
  );
  spec.id = 'swatch';
  spec.series[1]!.marker = { show: 'all' };
  await h(page).mount([spec], opts);
  const count = (id: string) =>
    page
      .locator(
        `[data-dv-legend-item="${id}"] circle, [data-dv-legend-item="${id}"] rect, [data-dv-legend-item="${id}"] path`,
      )
      .count();
  expect(await count('opened')).toBe(0);
  expect(await count('closed')).toBeGreaterThan(0);
});

test('concurrent batches with the same embedding identity: the second is rejected', async ({
  page,
}) => {
  const res = await page.evaluate(async (o) => {
    const a = window.__h.start(['line-weekly-flow'], o as never);
    const b = window.__h.start(['line-weekly-flow'], o as never);
    const rb = await window.__h.outcome(b);
    const ra = await window.__h.outcome(a);
    const svgs = document.querySelectorAll('svg[data-dravenviz-ns="r"]').length;
    window.__h.dispose(a);
    const again = await window.__h.mount(['line-weekly-flow'], o as never);
    return { ra: ra.ok, rb: rb.ok ? null : rb.error, svgs, again: again.ok };
  }, opts);
  expect(res.ra).toBe(true);
  expect(res.rb).toMatchObject({ code: 'INVALID_OPTIONS', rule: 'duplicate-chart-embedding' });
  expect(res.svgs).toBe(1);
  expect(res.again).toBe(true);
});

test('a failed batch releases its pending identities', async ({ page }) => {
  const bad = await h(page).mountError(['line-weekly-flow', 'invalid-unknown-field'], opts);
  expect(bad.code).toBe('INVALID_SPEC');
  await expect(h(page).mount(['line-weekly-flow'], opts)).resolves.toHaveLength(1);
});

test('a category with no point draws two separate paths (cat-absent)', async ({ page }) => {
  const spec = {
    schemaVersion: 1,
    id: 'cat-absent',
    kind: 'cartesian',
    title: 'cat-absent',
    xAxis: { id: 'x', scale: 'category', categories: ['a', 'b', 'c', 'd', 'e', 'f'] },
    yAxes: [{ id: 'v', label: 'V', unit: 'count' }],
    series: [
      {
        id: 'A',
        label: 'A',
        mark: 'line',
        yAxisId: 'v',
        points: [
          { id: 'a1', x: 'a', value: 1 },
          { id: 'a2', x: 'b', value: 2 },
          { id: 'a4', x: 'd', value: 4 },
          { id: 'a5', x: 'e', value: 5 },
        ],
      },
    ],
  };
  await h(page).mount([spec], opts);
  expect(await page.locator('[data-dv-mark="series:A:segment"] path').count()).toBe(2);
});
