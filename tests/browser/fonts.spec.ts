import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const provenance = readFileSync('assets/fonts/PROVENANCE.md', 'utf8');
const hashOf = (file: string): string => {
  const m = new RegExp(`\\|\\s*${file.replace('.', '\\.')}\\s*\\|\\s*([0-9a-f]{64})\\s*\\|`).exec(
    provenance,
  );
  if (!m) throw new Error(`no hash for ${file}`);
  return m[1] as string;
};

interface Outcome {
  ok: boolean;
  code?: string | undefined;
  message?: string | undefined;
  path?: string | undefined;
  family?: string;
  faces?: {
    weight: number;
    url: string;
    fileName: string;
    format: string;
    sha256: string;
    bytes: number;
    byteLength: number;
  }[];
}

/** Runs `loadFonts` in the page and returns a serialisable outcome. */
async function load(
  page: Page,
  assets: unknown,
  opts: { abortBefore?: boolean; abortAfterMs?: number } = {},
): Promise<Outcome> {
  return page.evaluate(
    async ({ assets, opts }) => {
      const ac = new AbortController();
      if (opts.abortBefore) ac.abort();
      if (opts.abortAfterMs !== undefined) setTimeout(() => ac.abort(), opts.abortAfterMs);
      try {
        const set = await window.__h.loadFonts(assets as never, ac.signal);
        return {
          ok: true,
          family: set.family,
          faces: set.faces.map((f) => ({
            weight: f.weight,
            url: f.url,
            fileName: f.fileName,
            format: f.format,
            sha256: f.sha256,
            bytes: f.bytes,
            byteLength: f.buffer.byteLength,
          })),
        };
      } catch (e) {
        const err = e as { code?: string; message?: string; path?: string };
        return { ok: false, code: err.code, message: err.message, path: err.path };
      }
    },
    { assets, opts },
  );
}

const serif = [
  { family: 'Noto Serif', weight: 400, url: '/test-fonts/NotoSerif-Regular.woff2' },
  { family: 'Noto Serif', weight: 600, url: '/test-fonts/NotoSerif-SemiBold.woff2' },
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__h === 'object');
});

test('default fonts load, match PROVENANCE.md hashes and register with document.fonts', async ({
  page,
}) => {
  const defaults = await page.evaluate(() => window.__h.defaultFontAssets());
  expect(defaults.map((d) => [d.family, d.weight, d.url])).toEqual([
    ['Noto Sans', 400, 'fonts/NotoSans-Regular.woff2'],
    ['Noto Sans', 600, 'fonts/NotoSans-SemiBold.woff2'],
  ]);
  const out = await load(page, defaults);
  expect(out.ok).toBe(true);
  expect(out.family).toBe('Noto Sans');
  const [regular, semi] = out.faces!;
  expect(regular!.weight).toBe(400);
  expect(regular!.sha256).toBe(hashOf('NotoSans-Regular.woff2'));
  expect(semi!.weight).toBe(600);
  expect(semi!.sha256).toBe(hashOf('NotoSans-SemiBold.woff2'));
  expect(regular!.format).toBe('woff2');
  expect(regular!.fileName).toBe('NotoSans-Regular.woff2');
  expect(regular!.byteLength).toBe(regular!.bytes);
  const checks = await page.evaluate(() => [
    document.fonts.check('13px "Noto Sans"'),
    document.fonts.check('600 13px "Noto Sans"'),
    window.__h.fontRegistry.get('fonts/NotoSans-Regular.woff2')?.sha256,
  ]);
  expect(checks).toEqual([true, true, hashOf('NotoSans-Regular.woff2')]);
});

test('assetBaseUrl resolves the default fonts', async ({ page }) => {
  const urls = await page.evaluate(() => window.__h.defaultFontAssets('/').map((d) => d.url));
  expect(urls).toEqual(['/fonts/NotoSans-Regular.woff2', '/fonts/NotoSans-SemiBold.woff2']);
  const bad = await page.evaluate(() => {
    try {
      window.__h.defaultFontAssets('https://evil.example/');
      return 'no error';
    } catch (e) {
      return (e as { code?: string }).code;
    }
  });
  expect(bad).toBe('INVALID_OPTIONS');
});

test('caller fonts load from /test-fonts/ under their own family', async ({ page }) => {
  const out = await load(page, serif);
  expect(out.ok).toBe(true);
  expect(out.family).toBe('Noto Serif');
  expect(await page.evaluate(() => document.fonts.check('13px "Noto Serif"'))).toBe(true);
});

test('a 404 rejects with FONT_LOAD_FAILED naming the URL', async ({ page }) => {
  const url = '/fonts/missing-regular.woff2';
  const out = await load(page, [
    { family: 'Nope', weight: 400, url },
    { family: 'Nope', weight: 600, url: '/fonts/missing-semibold.woff2' },
  ]);
  expect(out.ok).toBe(false);
  expect(out.code).toBe('FONT_LOAD_FAILED');
  expect(`${out.path ?? ''} ${out.message ?? ''}`).toContain('/fonts/missing-');
});

test('corrupt font data rejects with FONT_LOAD_FAILED and a retry is possible', async ({
  page,
}) => {
  // PROVENANCE.md is served nowhere; use a route that returns garbage bytes.
  await page.route('**/fonts/garbage.woff2', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: 'not a font' }),
  );
  const assets = [
    { family: 'Junk', weight: 400, url: '/fonts/garbage.woff2' },
    { family: 'Junk', weight: 600, url: '/fonts/garbage.woff2?b' },
  ];
  const first = await load(page, assets);
  expect(first.code).toBe('FONT_LOAD_FAILED');
  expect(first.message).toContain('/fonts/garbage.woff2');
  // The failed entry was removed from the registry, so the next call fetches again.
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('garbage.woff2')) requests += 1;
  });
  await load(page, assets);
  expect(requests).toBeGreaterThan(0);
});

test('a failed load can be retried and then succeeds', async ({ page }) => {
  let fail = true;
  await page.route('**/fonts/flaky.woff2', async (route) => {
    if (fail) return route.fulfill({ status: 503, body: 'down' });
    const { readFileSync: rf } = await import('node:fs');
    return route.fulfill({
      status: 200,
      contentType: 'font/woff2',
      body: rf('assets/fonts/NotoSans-Regular.woff2'),
    });
  });
  const assets = [
    { family: 'Noto Sans', weight: 400, url: '/fonts/flaky.woff2' },
    { family: 'Noto Sans', weight: 600, url: '/fonts/NotoSans-SemiBold.woff2' },
  ];
  expect((await load(page, assets)).code).toBe('FONT_LOAD_FAILED');
  fail = false;
  expect((await load(page, assets)).ok).toBe(true);
});

test('unsafe URLs reject with INVALID_OPTIONS before any fetch', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const bad = [
    'javascript:alert(1)',
    'https://evil.example/f.woff2',
    '//evil.example/f.woff2',
    'data:font/woff2;base64,AAAA',
    'blob:http://127.0.0.1:4179/abc',
    'http://127.0.0.1:4180/f.woff2',
  ];
  for (const url of bad) {
    const out = await load(page, [
      { family: 'X', weight: 400, url },
      { family: 'X', weight: 600, url: '/fonts/NotoSans-SemiBold.woff2' },
    ]);
    expect(out.code, url).toBe('INVALID_OPTIONS');
  }
  expect(
    requests.filter((u) => /evil\.example|:4180|abc|alert/.test(u) || u.includes('woff2')),
  ).toEqual([]);
});

test('caller font sets must share one family and provide both weights', async ({ page }) => {
  const mixed = await load(page, [
    { family: 'A', weight: 400, url: '/test-fonts/NotoSerif-Regular.woff2' },
    { family: 'B', weight: 600, url: '/test-fonts/NotoSerif-SemiBold.woff2' },
  ]);
  expect(mixed.code).toBe('INVALID_OPTIONS');
  const missing = await load(page, [serif[0]]);
  expect(missing.code).toBe('INVALID_OPTIONS');
  const unknownExt = await load(page, [
    { family: 'A', weight: 400, url: '/test-fonts/a.bin' },
    { family: 'A', weight: 600, url: '/test-fonts/b.bin' },
  ]);
  expect(unknownExt.code).toBe('INVALID_OPTIONS');
});

test('an aborted signal rejects with DISPOSED, before or during the load', async ({ page }) => {
  const before = await load(page, serif, { abortBefore: true });
  expect(before.code).toBe('DISPOSED');
  await page.route('**/test-fonts/NotoSerif-Regular.woff2', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => undefined);
  });
  const during = await load(page, serif, { abortAfterMs: 100 });
  expect(during.code).toBe('DISPOSED');
});

test('the same URL loaded twice makes one network request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.woff2')) requests.push(r.url());
  });
  const first = await load(page, serif);
  const second = await load(page, serif);
  expect(first.ok && second.ok).toBe(true);
  expect(requests).toHaveLength(2); // one per weight, not four
});

test('concurrent loads of the same URL share one request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.woff2')) requests.push(r.url());
  });
  const [a, b] = await Promise.all([load(page, serif), load(page, serif)]);
  expect(a.ok && b.ok).toBe(true);
  expect(requests).toHaveLength(2);
});

test('mount, exportSvg and counts are stubs until Task 12/13', async ({ page }) => {
  const msgs = await page.evaluate(() =>
    (['mount', 'exportSvg', 'counts'] as const).map((k) => {
      try {
        (window.__h[k] as () => unknown)();
        return '';
      } catch (e) {
        return (e as Error).message;
      }
    }),
  );
  expect(msgs).toEqual(Array(3).fill('not implemented until Task 12/13'));
});
