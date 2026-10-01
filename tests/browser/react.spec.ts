import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/react.html');
  await page.waitForFunction(() => typeof window.__r !== 'undefined');
});

const ROOT = '.dravenviz-root[data-dravenviz-chart]';
const ready = (page: Page, n = 1) =>
  page.waitForFunction((count) => window.__r.readyCalls.length >= count, n);
const rendered = (page: Page) => page.evaluate(() => window.__r.readyCalls.length);

test('onReady fires once per render with final geometry', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 }),
  );
  await ready(page);
  await page.waitForTimeout(400);
  const calls = await page.evaluate(() => window.__r.readyCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({
    chartId: 'weekly-flow',
    renderId: expect.any(Number),
    width: 600,
    height: 320,
  });
  const svg = page.locator('svg[data-dravenviz-chart="weekly-flow"]');
  await expect(svg).toHaveAttribute('data-dv-render-id', String(calls[0]!.renderId));
  await expect(svg).toHaveAttribute('viewBox', '0 0 600 320');
});

test('the default namespace is a sanitized useId, distinct per instance and valid', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 }),
  );
  await ready(page);
  const ns = await page.locator(ROOT).getAttribute('data-dravenviz-ns');
  expect(ns).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
  expect(ns!.startsWith('dv')).toBe(true);
});

test('stale font completion does not fire onReady', async ({ page }) => {
  await page.route(/\/fonts\/NotoSans-/, async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.evaluate(() => {
    const a = window.__r.fixture('line-weekly-flow') as Record<string, unknown>;
    a['id'] = 'A';
    a['title'] = 'Title A';
    window.__r.render({ spec: a, theme: 'light', width: 600, height: 320 });
    setTimeout(() => {
      const b = window.__r.fixture('line-weekly-flow') as Record<string, unknown>;
      b['id'] = 'B';
      b['title'] = 'Title B';
      window.__r.render({ spec: b, theme: 'light', width: 600, height: 320 });
    }, 50);
  });
  await ready(page);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__r.readyCalls)).toEqual([
    { chartId: 'B', renderId: 2, width: 600, height: 320 },
  ]);
  await expect(page.locator('svg[data-dravenviz-chart] title')).toHaveText('Title B');
});

test('a style option change starts a new render and a same-spec rerender does not', async ({
  page,
}) => {
  const base = { fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 } as const;
  await page.evaluate((p) => window.__r.render(p), base);
  await ready(page);
  await page.evaluate((p) => window.__r.render(p), base); // identical props: no new render
  await page.waitForTimeout(300);
  expect(await rendered(page)).toBe(1);
  await page.evaluate((p) => window.__r.render({ ...p, height: 300 }), base);
  await ready(page, 2);
  const calls = await page.evaluate(() => window.__r.readyCalls);
  expect(calls[1]!.height).toBe(300);
  expect(calls[1]!.renderId).toBeGreaterThan(calls[0]!.renderId);
});

test('resize re-renders with the latest size', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: '100%', height: 320 }),
  );
  await ready(page);
  expect((await page.evaluate(() => window.__r.readyCalls))[0]!.width).toBe(600);
  expect(await page.evaluate(() => window.__r.resizeObservers())).toBe(1);
  await page.evaluate(() => window.__r.setHostWidth(400));
  await page.waitForFunction(() => window.__r.readyCalls.at(-1)?.width === 400);
  await expect(page.locator('svg[data-dravenviz-chart]')).toHaveAttribute('viewBox', '0 0 400 320');
});

test('a fixed width creates no ResizeObserver', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 }),
  );
  await ready(page);
  expect(await page.evaluate(() => window.__r.resizeObservers())).toBe(0);
});

async function openChart(page: Page): Promise<void> {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 }),
  );
  await ready(page);
}

test('keyboard navigates and activates with stable ids', async ({ page }) => {
  await openChart(page);
  const root = page.locator(ROOT);
  await root.focus();
  // Focusing the root selects no datum.
  await expect(page.locator('[data-dv-focus-ring]')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-dv-focus-ring]')).toHaveCount(1);
  await page.keyboard.press('ArrowRight'); // o2 is null and skipped
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.__r.activateCalls)).toEqual([
    {
      chartId: 'weekly-flow',
      seriesId: 'opened',
      datumId: 'o3',
      datumLabel: '20 Jul',
      value: 18,
      source: 'keyboard',
    },
  ]);
  const live = page.locator('[aria-live="polite"]');
  await expect(live).toContainText('Opened');
  await expect(live).toContainText('18');
  await expect(live).toContainText('partial');
  // The live region and the ring: region is HTML outside the svg, the ring is a flagged overlay.
  expect(await page.locator('svg [aria-live]').count()).toBe(0);
  await expect(page.locator('svg [data-dv-focus-ring]')).toHaveAttribute('data-dv-interactive', '');
});

test('arrow keys move across series in series then point order, skipping gaps', async ({
  page,
}) => {
  await openChart(page);
  await page.locator(ROOT).focus();
  const live = page.locator('[aria-live="polite"]');
  await page.keyboard.press('ArrowDown'); // first arrow: first datum, o1
  await expect(live).toContainText('Opened');
  await page.keyboard.press('ArrowDown'); // next series: c1 (same x)
  await expect(live).toContainText('Closed');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // c4, lagging
  await expect(live).toContainText('lagging');
  await page.keyboard.press('ArrowRight'); // end of series: stays
  await expect(live).toContainText('lagging');
  await page.keyboard.press(' ');
  const calls = await page.evaluate(() => window.__r.activateCalls);
  expect(calls.map((c) => c.datumId)).toEqual(['c4']);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-dv-focus-ring]')).toHaveCount(0);
});

test('pointer activation', async ({ page }) => {
  await openChart(page);
  await page.locator('[data-dv-point="o1"]').click();
  expect(await page.evaluate(() => window.__r.activateCalls)).toEqual([
    {
      chartId: 'weekly-flow',
      seriesId: 'opened',
      datumId: 'o1',
      datumLabel: '6 Jul',
      value: 12,
      source: 'pointer',
    },
  ]);
});

test('tooltip DOM never inside svg', async ({ page }) => {
  await openChart(page);
  await page.locator('[data-dv-point="o1"]').hover();
  const tip = page.locator('[role="tooltip"]');
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText('Opened');
  await expect(tip).toContainText('12');
  expect(await page.locator('svg [role="tooltip"]').count()).toBe(0);
  expect(await page.locator('svg').evaluate((s) => s.querySelector('[role="tooltip"]'))).toBeNull();
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
});

test('invalid spec shows alert and calls onError', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({
      spec: { schemaVersion: 1, id: 'x' },
      theme: 'light',
      width: 600,
      height: 320,
    }),
  );
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  const alert = page.locator('[role="alert"].dravenviz-error');
  await expect(alert).toContainText('INVALID_SPEC');
  expect(await page.evaluate(() => window.__r.errorCalls.map((e) => e.code))).toEqual([
    'INVALID_SPEC',
  ]);
  expect(await page.evaluate(() => window.__r.lastErrorIsInvalidSpec())).toBe(true);
  expect(await page.evaluate(() => window.__r.readyCalls.length)).toBe(0);
  // Recovery: a valid spec replaces the alert.
  await openChart(page);
  await expect(alert).toHaveCount(0);
});

test('an unsupported model shows the error panel with RENDER_FAILED', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'min-donut', theme: 'light', width: 600, height: 320 }),
  );
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  await expect(page.locator('[role="alert"].dravenviz-error')).toContainText('RENDER_FAILED');
});

test('bad options show INVALID_OPTIONS', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: -1 }),
  );
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  expect(await page.evaluate(() => window.__r.errorCalls[0]!.code)).toBe('INVALID_OPTIONS');
});

test('100 prop updates and unmount leave no roots or observers', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: '100%', height: 320 }),
  );
  await ready(page);
  for (let i = 0; i < 100; i++) {
    await page.evaluate(
      (h) =>
        window.__r.render({
          fixture: 'line-weekly-flow',
          theme: 'light',
          width: '100%',
          height: h,
        }),
      300 + (i % 7),
    );
  }
  await page.waitForTimeout(500);
  const during = await page.evaluate(() => window.__r.counts());
  expect(during.svgs).toBe(1);
  expect(during.roots).toBe(1);
  // Exactly one ResizeObserver for the fluid chart; the other is the style guard's MutationObserver.
  expect(await page.evaluate(() => window.__r.resizeObservers())).toBe(1);
  expect(during.observers).toBe(2);
  await page.evaluate(() => window.__r.unmount());
  expect(await page.evaluate(() => window.__r.counts())).toEqual({
    roots: 0,
    observers: 0,
    svgs: 0,
  });
});

const estimated = { fixture: 'line-estimated-monotone', theme: 'light', height: 300 } as const;

/** Every clip-path url(#id) inside `host` resolves to an element inside the same host. */
const clipRefsStayInside = (page: Page, index: number) =>
  page.evaluate((i) => {
    const el = document.querySelectorAll('.dravenviz-root')[i];
    const refs = Array.from(el?.querySelectorAll('[clip-path]') ?? []).map(
      (n) => /#([^)"]+)/.exec(n.getAttribute('clip-path') ?? '')?.[1],
    );
    return refs.every((id) => id !== undefined && el!.contains(document.getElementById(id)));
  }, index);

test('two roots with cold fonts both become ready, no error', async ({ page }) => {
  await page.route(/\/fonts\/NotoSans-/, async (route) => {
    await new Promise((r) => setTimeout(r, 300));
    await route.continue();
  });
  await page.evaluate((e) => {
    window.__r.mountExtra({ ...e, width: 600, identifierPrefix: 'a' });
    window.__r.mountExtra({ ...e, width: 500, identifierPrefix: 'b' });
  }, estimated);
  await page.waitForFunction(() => {
    const a = window.__r.extra(0);
    const b = window.__r.extra(1);
    return a.ready.length + a.errors.length > 0 && b.ready.length + b.errors.length > 0;
  });
  await page.waitForTimeout(500);
  for (const i of [0, 1]) {
    const x = await page.evaluate((n) => window.__r.extra(n), i);
    expect(x.errors).toEqual([]);
    expect(x.ready).toHaveLength(1);
  }
});

test('roots with different identifierPrefix get distinct namespaces and keep their own clips', async ({
  page,
}) => {
  await page.evaluate((e) => {
    window.__r.mountExtra({ ...e, width: 600, identifierPrefix: 'a' });
    window.__r.mountExtra({ ...e, width: 300, identifierPrefix: 'b' });
  }, estimated);
  await page.waitForFunction(
    () => window.__r.extra(0).ready.length > 0 && window.__r.extra(1).ready.length > 0,
  );
  const a = await page.evaluate(() => window.__r.extra(0));
  const b = await page.evaluate(() => window.__r.extra(1));
  expect(a.ns).toMatch(/^dv-[a-z0-9]+$/);
  expect(a.ns).not.toBe(b.ns);
  expect(await clipRefsStayInside(page, 0)).toBe(true);
  expect(await clipRefsStayInside(page, 1)).toBe(true);
});

test('two roots given the same namespace fail loudly, never silently', async ({ page }) => {
  await page.evaluate((e) => {
    // Client-created roots get distinct useIds, so the clash needs an explicit shared namespace.
    window.__r.mountExtra({ ...e, width: 600, namespace: 'dup' });
    window.__r.mountExtra({ ...e, width: 300, namespace: 'dup' });
  }, estimated);
  await page.waitForFunction(
    () => window.__r.extra(0).ready.length + window.__r.extra(1).ready.length > 0,
  );
  await page.waitForFunction(
    () => window.__r.extra(0).errors.length + window.__r.extra(1).errors.length > 0,
  );
  const x = await page.evaluate(() => [window.__r.extra(0), window.__r.extra(1)]);
  const errored = x.filter((e) => e.errors.length > 0);
  expect(errored).toHaveLength(1);
  expect(errored[0]!.errors[0]!.code).toBe('INVALID_OPTIONS');
  expect(errored[0]!.errors[0]!.message).toMatch(/namespace|identifierPrefix/);
  await expect(page.locator('[role="alert"].dravenviz-error')).toHaveCount(1);
});

test('hydrated islands plus a client root never render silently with shared ids', async ({
  page,
}) => {
  await page.evaluate((e) => {
    window.__r.mountExtra({ ...e, width: 600, hydrate: true });
    window.__r.mountExtra({ ...e, width: 500, hydrate: true });
    window.__r.mountExtra({ ...e, width: 400 });
  }, estimated);
  await page.waitForFunction(() =>
    [0, 1, 2].every((i) => {
      const x = window.__r.extra(i);
      return x.ready.length + x.errors.length > 0;
    }),
  );
  await page.waitForTimeout(500);
  const x = await page.evaluate(() => [0, 1, 2].map((i) => window.__r.extra(i)));
  const readyNs = x.filter((e) => e.ready.length > 0).map((e) => e.ns);
  expect(new Set(readyNs).size).toBe(readyNs.length); // ready charts never share a namespace
  for (const e of x) if (e.ready.length === 0) expect(e.errors[0]!.code).toBe('INVALID_OPTIONS');
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg [id]')).map((e) => e.id),
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (let i = 0; i < 3; i++) {
    if (x[i]!.ready.length > 0) expect(await clipRefsStayInside(page, i)).toBe(true);
  }
});

test('"100%" in a zero-width container gives ZERO_SIZE and recovers when resized', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__r.setHostWidth(0);
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: '100%', height: 320 });
  });
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  expect(await page.evaluate(() => window.__r.errorCalls.map((e) => e.code))).toEqual([
    'ZERO_SIZE',
  ]);
  await expect(page.locator('[role="alert"].dravenviz-error')).toContainText('ZERO_SIZE');
  expect(await page.evaluate(() => window.__r.readyCalls.length)).toBe(0);
  await page.evaluate(() => window.__r.setHostWidth(450));
  await page.waitForFunction(() => window.__r.readyCalls.at(-1)?.width === 450);
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});

test('a numeric width in a display:none host gives ZERO_SIZE and no onReady; re-render recovers', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__r.setHostDisplay('none');
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 320 });
  });
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__r.errorCalls.map((e) => e.code))).toEqual([
    'ZERO_SIZE',
  ]);
  expect(await page.evaluate(() => window.__r.readyCalls.length)).toBe(0);
  // A fixed width observes nothing: the caller re-renders once the host is shown.
  await page.evaluate(() => {
    window.__r.setHostDisplay('');
    window.__r.render({ fixture: 'line-weekly-flow', theme: 'light', width: 600, height: 321 });
  });
  await ready(page);
  expect((await page.evaluate(() => window.__r.readyCalls))[0]!.height).toBe(321);
});

test('a hung font request reports TIMEOUT once and never calls onReady', async ({ page }) => {
  await page.route(/\/fonts\/NotoSans-/, () => {
    // Never answered: the font request hangs.
  });
  await page.evaluate(() =>
    window.__r.render({
      fixture: 'line-weekly-flow',
      theme: 'light',
      width: 600,
      height: 320,
      timeoutMs: 400,
    }),
  );
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  await page.waitForTimeout(800);
  const out = await page.evaluate(() => ({
    errors: window.__r.errorCalls.map((e) => e.code),
    ready: window.__r.readyCalls.length,
  }));
  expect(out).toEqual({ errors: ['TIMEOUT'], ready: 0 });
  await expect(page.locator('[role="alert"].dravenviz-error')).toContainText('TIMEOUT');
});

test('a render that finishes inside timeoutMs is ready and never times out', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({
      fixture: 'line-weekly-flow',
      theme: 'light',
      width: 600,
      height: 320,
      timeoutMs: 5000,
    }),
  );
  await ready(page);
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => ({
    errors: window.__r.errorCalls.length,
    ready: window.__r.readyCalls.length,
  }));
  expect(out).toEqual({ errors: 0, ready: 1 });
});

test('an invalid timeoutMs is INVALID_OPTIONS with its path', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({
      fixture: 'line-weekly-flow',
      theme: 'light',
      width: 600,
      height: 320,
      timeoutMs: -5,
    }),
  );
  await page.waitForFunction(() => window.__r.errorCalls.length > 0);
  expect(await page.evaluate(() => window.__r.errorCalls.map((e) => e.code))).toEqual([
    'INVALID_OPTIONS',
  ]);
});

test('interactive mode draws annotation and reference-line labels', async ({ page }) => {
  await page.evaluate(() =>
    window.__r.render({
      fixture: 'line-weekly-flow',
      theme: 'light',
      width: 680,
      height: 320,
      staticLabels: false,
    }),
  );
  await ready(page);
  const texts = await page
    .locator('svg[data-dravenviz-chart="weekly-flow"] text')
    .allTextContents();
  expect(texts.some((t) => t.includes('Partial week'))).toBe(true);
  expect(texts).toContain('Target');
});
