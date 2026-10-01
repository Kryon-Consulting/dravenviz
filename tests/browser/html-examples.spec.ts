import { expect, test, type Page } from '@playwright/test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';

// Serves a temp directory that holds only what a real consumer would copy: the files named in
// dist/asset-manifest.json (at their `path`), examples/html/*, and the local React 18 UMD build.
const ROOT = process.cwd();
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'";
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

let dir = '';
let server: Server;
let origin = '';

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dv-html-'));
  const manifest = JSON.parse(readFileSync(join(ROOT, 'dist/asset-manifest.json'), 'utf8')) as {
    files: { path: string; source: string }[];
  };
  const put = (from: string, to: string): void => {
    mkdirSync(dirname(join(dir, to)), { recursive: true });
    copyFileSync(from, join(dir, to));
  };
  for (const f of manifest.files) put(join(ROOT, f.source), f.path);
  const ex = join(ROOT, 'examples/html');
  for (const name of readdirSync(ex)) {
    if (/\.(html|json|js)$/.test(name)) put(join(ex, name), name);
  }
  put(join(ROOT, 'node_modules/react18/umd/react.production.min.js'), 'react18.production.min.js');
  put(
    join(ROOT, 'node_modules/react-dom18/umd/react-dom.production.min.js'),
    'react-dom18.production.min.js',
  );
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    if (rel.includes('..')) {
      res.statusCode = 400;
      res.end();
      return;
    }
    try {
      const body = readFileSync(join(dir, rel));
      res.setHeader('Content-Type', TYPES[extname(rel)] ?? 'application/octet-stream');
      res.setHeader('Content-Security-Policy', CSP);
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

interface Watch {
  foreign: string[];
  violations: string[];
  pageErrors: string[];
}

async function watch(page: Page): Promise<Watch> {
  const w: Watch = { foreign: [], violations: [], pageErrors: [] };
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      w.foreign.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  page.on('pageerror', (e) => w.pageErrors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  return w;
}

async function open(page: Page, name: string, w: Watch): Promise<void> {
  await page.goto(`${origin}/${name}`);
  await page.waitForFunction(
    () => (window as unknown as { __ready?: boolean }).__ready === true,
    undefined,
    { timeout: 15_000 },
  );
  w.violations.push(
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
  );
}

const pathData = (svg: string): string[] =>
  [...svg.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map((m) => m[1] as string);

test('basic.html becomes ready and its SVG matches renderToSvg geometry', async ({ page }) => {
  const w = await watch(page);
  await open(page, 'basic.html', w);
  const result = await page.evaluate(async () => {
    const dv = (
      window as unknown as {
        DravenViz: { renderToSvg(spec: unknown, o: object): Promise<string> };
      }
    ).DravenViz;
    const specs = (await (await fetch('charts.json')).json()) as unknown[];
    const live = document.querySelector('#chart-a svg') as SVGSVGElement;
    const box = live.getBoundingClientRect();
    const exported = await dv.renderToSvg(specs[0], {
      width: Number(live.getAttribute('viewBox')?.split(' ')[2]),
      height: Number(live.getAttribute('viewBox')?.split(' ')[3]),
      namespace: 'x',
    });
    const liveD = [...live.querySelectorAll('path')].map((e) => e.getAttribute('d') ?? '');
    return { live: liveD, exported, w: box.width };
  });
  expect(result.w).toBeGreaterThan(100);
  const live = result.live.filter(Boolean);
  const exported = pathData(result.exported);
  expect(exported.length).toBeGreaterThan(0);
  expect(live.length).toBe(exported.length);
  expect(live.length).toBeGreaterThan(0);
  // The export rounds coordinates to 2 decimals; the live SVG keeps 3. Same geometry within 0.01.
  const nums = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const d of exported) {
    const match = live.find((l) => {
      const a = nums(l);
      const b = nums(d);
      return a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] as number)) <= 0.01);
    });
    expect(match, `no live path matches ${d}`).toBeDefined();
  }
  expect(w.pageErrors).toEqual([]);
  expect(w.foreign).toEqual([]);
  expect(w.violations).toEqual([]);
});

test('host-isolation.html: hostile CSS and a host React 18 do not affect the charts', async ({
  page,
}) => {
  const w = await watch(page);
  await open(page, 'host-isolation.html', w);
  expect(
    await page.evaluate(() => (window as unknown as { React: { version: string } }).React.version),
  ).toMatch(/^18\./);
  // The print theme's `color.text` is #1a1a1a (src/core/theme/print-theme.ts).
  const rgb = 'rgb(26, 26, 26)';
  const info = await page.evaluate(() => {
    const out: { family: string; fill: string; size: string; ns: string | null; ids: string[] }[] =
      [];
    for (const svg of document.querySelectorAll('svg[data-dravenviz-chart]')) {
      const texts = [...svg.querySelectorAll('text')];
      const title = svg.querySelector('[data-dv-text-role="title"]') as Element;
      for (const t of texts) {
        out.push({
          family: getComputedStyle(t).fontFamily,
          fill: t === title || title.contains(t) ? getComputedStyle(t).fill : '',
          ns: svg.getAttribute('data-dravenviz-ns'),
          size: t === title || title.contains(t) ? getComputedStyle(t).fontSize : '',
          ids: [],
        });
      }
    }
    const ids: Record<string, string[]> = {};
    for (const svg of document.querySelectorAll('svg[data-dravenviz-chart]')) {
      ids[svg.getAttribute('data-dravenviz-ns') as string] = [...svg.querySelectorAll('[id]')].map(
        (e) => e.id,
      );
    }
    return { rows: out, ids };
  });
  const namespaces = new Set(info.rows.map((r) => r.ns));
  expect(namespaces).toEqual(new Set(['a', 'b']));
  expect(info.rows.length).toBeGreaterThan(4);
  for (const r of info.rows) expect(r.family).toMatch(/^"?DravenViz Noto Sans"?/);
  const titleFills = info.rows.map((r) => r.fill).filter(Boolean);
  expect(titleFills.length).toBeGreaterThanOrEqual(2);
  for (const f of titleFills) expect(f).toBe(rgb);
  const titleSizes = info.rows.map((r) => r.size).filter(Boolean);
  expect(titleSizes.length).toBeGreaterThanOrEqual(2);
  for (const z of titleSizes) expect(z).not.toBe('20px');
  // The hostile `text { font-size: 20px }` and `path { stroke-width: 5 }` rules must not win.
  const hostile = await page.evaluate(() => ({
    strokeWidths: [...document.querySelectorAll('svg[data-dravenviz-chart] path')].map(
      (p) => getComputedStyle(p).strokeWidth,
    ),
  }));
  expect(hostile.strokeWidths).not.toContain('5px');
  const [a, b] = [info.ids['a'] ?? [], info.ids['b'] ?? []];
  expect(a.length).toBeGreaterThan(0);
  expect(a.filter((id) => b.includes(id))).toEqual([]);
  expect(w.pageErrors).toEqual([]);
  expect(w.foreign).toEqual([]);
  expect(w.violations).toEqual([]);
});

test('a failing mount throws an uncaught error and never sets __ready', async ({ page }) => {
  const w = await watch(page);
  await page.route('**/charts.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[{"schemaVersion":1}]' }),
  );
  await page.goto(`${origin}/basic.html`);
  await expect.poll(() => w.pageErrors.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { __ready?: boolean }).__ready)).not.toBe(
    true,
  );
});
