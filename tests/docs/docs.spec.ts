import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type Download, type Page } from '@playwright/test';

const provenance = readFileSync('assets/fonts/PROVENANCE.md', 'utf8');
const provenanceHash = (file: string): string => {
  const m = new RegExp(`\\|\\s*${file.replace('.', '\\.')}\\s*\\|\\s*([0-9a-f]{64})\\s*\\|`).exec(
    provenance,
  );
  if (!m) throw new Error(`no hash for ${file}`);
  return m[1] as string;
};
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

/** The chart the playground draws: the live SVG, never the data table or a hidden export host. */
const liveSvg = (page: Page) => page.locator('[data-testid="preview"] svg[data-dv-render-id]').first();
const editor = (page: Page) => page.locator('.cm-content');
const SAMPLE_HASH = 'a285f9e5cdab9a5976134963db8035418eed3db20a5164e9caeab7d7f162c5ee';

async function openPlayground(page: Page, fixture = 'line-weekly-flow'): Promise<void> {
  await page.goto('#/playground');
  await page.getByLabel('Fixture').selectOption(fixture);
  await expect(liveSvg(page)).toBeVisible();
}

/** Types ` EDITED` at the end of the title text, with real keystrokes in the editor. */
async function editTitle(page: Page, suffix = ' EDITED'): Promise<void> {
  await editor(page).locator('.cm-line', { hasText: '"title"' }).first().click();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type(suffix);
}

async function download(page: Page, name: string | RegExp): Promise<Download> {
  const [d] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name }).click(),
  ]);
  return d;
}

const readDownload = async (d: Download): Promise<Buffer> => readFileSync(await d.path());

/** Minimal ZIP reader (central directory; stored or deflate), so the test needs no zip library. */
function readZip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + size);
    out.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function serveDir(files: Map<string, Buffer>): Promise<{ server: Server; origin: string; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '/').slice(1).split('?')[0] ?? '');
    hits.push(name);
    const body = files.get(name);
    if (!body) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader(
      'Content-Type',
      name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.woff2') ? 'font/woff2' : 'text/plain',
    );
    res.end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, origin: `http://127.0.0.1:${port}`, hits });
    });
  });
}

/** What `document.fonts` says about the faces a standalone SVG registered (R25: not `fonts.check`). */
const loadedFaces = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map((f) => ({
      family: f.family.replaceAll('"', ''),
      weight: f.weight,
      status: f.status,
    }));
  });

test('start page shows install and all three quickstarts', async ({ page }) => {
  await page.goto('#/');
  for (const name of [
    'Environment',
    'Install',
    'First React chart',
    'Plain HTML chart',
    'Python to DravenPDF',
    'What needs a DOM',
    'Troubleshooting',
  ]) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const text = async (id: string): Promise<string> =>
    ((await page.locator(`pre[data-snippet="${id}"]`).textContent()) ?? '').trim();
  expect(await text('react')).toBe(readFileSync('examples/react/src/main.tsx', 'utf8').trim());
  expect(await text('html-page')).toBe(readFileSync('examples/html/basic.html', 'utf8').trim());
  expect(await text('html-script')).toBe(readFileSync('examples/html/basic.js', 'utf8').trim());
  const readme = readFileSync('examples/dravenpdf/README.md', 'utf8');
  const from = readme.indexOf('## Use it in your own backend');
  const to = readme.indexOf('## How the bundle works');
  expect(from).toBeGreaterThan(-1);
  expect(await text('dravenpdf')).toBe(readme.slice(from, to).trim());
  // The install commands of design section 16.1 and the support matrix of section 19.
  const install = await text('install');
  expect(install).toContain('pnpm install --frozen-lockfile');
  expect(install).toContain('pnpm pack:local');
  expect(install).toContain('pnpm stage docs');
  await expect(page.getByRole('table', { name: 'Environment matrix' })).toContainText('7a249e0');
  await expect(page.getByRole('table', { name: 'Environment matrix' })).toContainText(
    'Noto Sans v2.015',
  );
  // Notes carried forward from the rulings.
  const body = (await page.locator('main').textContent()) ?? '';
  for (const needle of [
    'identifierPrefix',
    'namespace',
    'ZERO_SIZE',
    'LAYOUT_ERROR',
    'DravenViz Noto Sans',
    'fit: "width"',
    'next prop change',
  ]) {
    expect(body, needle).toContain(needle);
  }
  await page.screenshot({ path: 'evidence/screenshots/docs-start.png', fullPage: true });
});

test('valid edit renders; invalid edit shows path and keeps input', async ({ page }) => {
  await openPlayground(page);
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed');
  await editTitle(page);
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  await expect(page.getByText('Showing last valid render')).toHaveCount(0);

  await editor(page).locator('.cm-line', { hasText: '"schemaVersion"' }).first().click();
  await page.keyboard.press('Home');
  await page.keyboard.type('"colour": "red", ');
  await page.getByRole('button', { name: 'Validate' }).click();
  const errors = page.getByRole('list', { name: 'Validation errors' });
  await expect(errors).toContainText('/colour');
  await expect(editor(page)).toContainText('"colour"');
  await expect(page.getByText('Showing last valid render — not your current input')).toBeVisible();
  // The preview still shows the last valid render.
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(errors).toContainText('/colour');
  await expect(editor(page)).toContainText('"colour"');
  await page.screenshot({ path: 'evidence/screenshots/docs-playground-error.png', fullPage: true });
});

test('unimplemented kinds show not-implemented-in-slice', async ({ page }) => {
  await page.goto('#/playground');
  await expect(page.getByLabel('Fixture').locator('option')).not.toHaveCount(0);
  const options = await page.getByLabel('Fixture').locator('option').allTextContents();
  expect(options).toContain('line-weekly-flow');
  expect(options).toContain('min-bar');
  expect(options).not.toContain('min-line');
  expect(options).not.toContain('perf-line-500x4');
  await page.getByLabel('Fixture').selectOption('min-bar');
  await expect(page.getByRole('list', { name: 'Validation errors' })).toContainText(
    'not-implemented-in-slice',
  );
});

test('reset restores fixture', async ({ page }) => {
  await openPlayground(page);
  await editTitle(page);
  await expect(editor(page)).toContainText('EDITED');
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(editor(page)).not.toContainText('EDITED');
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed');
});

test('theme and size changes re-render', async ({ page }) => {
  await openPlayground(page);
  await page.getByLabel('Theme').selectOption('dark');
  // #14171c is the dark theme's background; the light theme draws #ffffff.
  const background = (): Promise<string> =>
    liveSvg(page).evaluate((svg) => {
      const rect = svg.querySelector('rect[data-dv-background]');
      return rect === null ? '' : getComputedStyle(rect).fill;
    });
  await expect.poll(background).toBe('rgb(20, 23, 28)');
  await page.getByLabel('Width').fill('480');
  await expect(liveSvg(page)).toHaveAttribute('viewBox', '0 0 480 320');
  await page.getByLabel('Height').fill('300');
  await expect(liveSvg(page)).toHaveAttribute('viewBox', '0 0 480 300');
  await page.getByText('HTML print preview (not a PDF)').click();
  const print = page.getByTestId('print-preview');
  await expect(print.locator('svg[data-dv-render-id]')).toBeVisible();
  // 178 mm is 672.76 CSS px; the chart scales to it and its viewBox stays the logical size.
  const frame = await print.boundingBox();
  expect(frame?.width).toBeCloseTo((178 / 25.4) * 96, 0);
  await expect(print.locator('svg[data-dv-render-id]')).toHaveAttribute('viewBox', '0 0 480 300');
  await expect(page.getByRole('table').first()).toBeVisible();
  await page.screenshot({ path: 'evidence/screenshots/docs-playground.png', fullPage: true });
});

test('svg download matches current validated spec and options', async ({ page }) => {
  await openPlayground(page);
  await editTitle(page);
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  await page.getByLabel('Width').fill('520');
  await expect(liveSvg(page)).toHaveAttribute('viewBox', '0 0 520 320');
  const d = await download(page, 'Download SVG');
  expect(d.suggestedFilename()).toBe('chart.svg');
  const svg = (await readDownload(d)).toString('utf8');
  expect(svg.startsWith('<svg xmlns')).toBe(true);
  expect(svg).toContain('Items opened and closed EDITED');
  expect(svg).toContain('viewBox="0 0 520 320"');
  expect(svg).not.toMatch(/class=|(^|\s)style="|recharts|foreignObject|<script/);
  expect(svg).toContain('data:font/woff2;base64');

  // Opened alone, in a fresh page: the embedded faces must really be loaded (R25: `fonts.check`
  // is true for absent families in Chromium, so it proves nothing).
  const dir = mkdtempSync(path.join(tmpdir(), 'dv-docs-svg-'));
  const file = path.join(dir, 'chart.svg');
  writeFileSync(file, svg);
  const alone = await page.context().newPage();
  const requests: string[] = [];
  alone.on('request', (r) => requests.push(r.url()));
  await alone.goto(`file://${file}`);
  const faces = await loadedFaces(alone);
  expect(faces.filter((f) => f.family === 'DravenViz Noto Sans' && f.status === 'loaded')).toHaveLength(2);
  expect(requests.filter((u) => !u.startsWith('file:') && !u.startsWith('data:'))).toEqual([]);
  const widths = await alone.evaluate(() => {
    const t = document.querySelector('text');
    return t instanceof SVGTextContentElement ? t.getComputedTextLength() : 0;
  });
  expect(widths).toBeGreaterThan(0);
  await alone.close();
});

test('external-font zip is self-consistent', async ({ page }) => {
  await openPlayground(page);
  await editTitle(page);
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  await page.getByLabel('Font mode').selectOption('external');
  const d = await download(page, /Download .*zip/i);
  expect(d.suggestedFilename()).toBe('chart.zip');
  const zip = readZip(await readDownload(d));
  expect([...zip.keys()].sort()).toEqual([
    'OFL.txt',
    'README.txt',
    'chart.svg',
    'fonts/NotoSans-Regular.woff2',
    'fonts/NotoSans-SemiBold.woff2',
  ]);
  for (const f of ['NotoSans-Regular.woff2', 'NotoSans-SemiBold.woff2']) {
    expect(sha(zip.get(`fonts/${f}`) as Buffer)).toBe(provenanceHash(f));
  }
  expect(zip.get('README.txt')?.toString('utf8')).toMatch(/fonts\/.*next to/is);
  const svg = (zip.get('chart.svg') as Buffer).toString('utf8');
  expect(svg).toContain('Items opened and closed EDITED');
  expect(svg).toMatch(/@font-face[^}]*url\("fonts\/NotoSans-Regular.woff2"\)/);
  expect(svg).not.toContain('data:font');

  const { server, origin, hits } = await serveDir(zip);
  try {
    const alone = await page.context().newPage();
    await alone.goto(`${origin}/chart.svg`);
    const faces = await loadedFaces(alone);
    expect(faces.filter((f) => f.family === 'DravenViz Noto Sans' && f.status === 'loaded')).toHaveLength(2);
    expect(hits).toEqual(
      expect.arrayContaining(['chart.svg', 'fonts/NotoSans-Regular.woff2', 'fonts/NotoSans-SemiBold.woff2']),
    );
    await alone.close();
  } finally {
    server.close();
  }
});

test('JSON download is the current validated spec', async ({ page }) => {
  await openPlayground(page);
  await editTitle(page);
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(liveSvg(page).locator('title')).toHaveText('Items opened and closed EDITED');
  const d = await download(page, 'Download JSON');
  const spec = JSON.parse((await readDownload(d)).toString('utf8')) as { title: string; id: string };
  expect(spec.title).toBe('Items opened and closed EDITED');
  expect(spec.id).toBe('weekly-flow');
  await expect(page.getByRole('button', { name: 'Copy options' })).toBeVisible();
});

test('repeated render/export leaves no leaked mounts or object URLs', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __urls: { made: number; revoked: number } };
    w.__urls = { made: 0, revoked: 0 };
    const make = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (o: Blob | MediaSource): string => {
      w.__urls.made += 1;
      return make(o);
    };
    URL.revokeObjectURL = (u: string): void => {
      w.__urls.revoked += 1;
      revoke(u);
    };
  });
  await openPlayground(page);
  for (let i = 0; i < 20; i += 1) {
    await page.getByRole('button', { name: 'Render' }).click();
    if (i % 5 === 4) await page.getByRole('button', { name: 'Reset' }).click();
    await download(page, 'Download SVG');
  }
  await expect(liveSvg(page)).toBeVisible();
  const counts = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __dvCounts: { roots: number; exportHosts: number };
        __urls: { made: number; revoked: number };
      };
      return { ...w.__dvCounts, delta: w.__urls.made - w.__urls.revoked, made: w.__urls.made };
    });
  await expect.poll(async () => (await counts()).delta, { timeout: 10_000 }).toBe(0);
  const c = await counts();
  expect(c.made).toBeGreaterThanOrEqual(20);
  expect(c.roots).toBeLessThanOrEqual(1);
  expect(c.exportHosts).toBe(0);
});

test('keyboard: controls reachable and chart focusable', async ({ page }) => {
  await openPlayground(page);
  await page.getByLabel('Fixture').focus();
  const seen: string[] = [];
  let chartFocused = false;
  for (let i = 0; i < 40 && !chartFocused; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        name: (el?.textContent ?? '').trim().slice(0, 30) || el?.getAttribute('aria-label') || el?.tagName || '',
        chart: el?.hasAttribute('data-dravenviz-chart') ?? false,
      };
    });
    seen.push(info.name);
    chartFocused = info.chart;
  }
  expect(seen).toContain('Validate');
  expect(seen).toContain('Render');
  expect(seen).toContain('Reset');
  expect(chartFocused).toBe(true);
  expect(seen.indexOf('Render')).toBeLessThan(seen.length - 1);
});

test('no external requests', async ({ page }) => {
  const origin = new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL ?? '') : page.url()).origin;
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  await page.goto('#/');
  await openPlayground(page);
  await download(page, 'Download SVG');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(liveSvg(page)).toBeVisible();
  expect(foreign).toEqual([]);
});

test('sample PDF link present with hash and labelled when edited', async ({ page, request }) => {
  await openPlayground(page);
  const link = page.locator('a[href$="evidence/pdf/report-slice1.pdf"]');
  await expect(link).toBeVisible();
  await expect(page.getByTestId('pdf-sample')).toContainText(SAMPLE_HASH);
  await expect(page.getByText('Original fixture sample')).toHaveCount(0);
  const res = await request.get((await link.getAttribute('href')) as string, {
    headers: { Referer: page.url() },
  });
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 4).toString('latin1')).toBe('%PDF');
  await editTitle(page);
  await page.getByRole('button', { name: 'Render' }).click();
  await expect(page.getByText('Original fixture sample')).toBeVisible();
  await expect(page.getByTestId('pdf-sample')).toContainText(SAMPLE_HASH);
  mkdirSync('evidence/screenshots', { recursive: true });
});
