import type { Page } from '@playwright/test';
import { h, openHarness } from '../browser/helpers';
import { HEIGHT, WIDTH, type Candidate } from './candidates';

/** Shared by the visual spec, `calibrate.ts` and `generate.ts`: one way to render a candidate. */

const options = (c: Candidate) => ({
  width: WIDTH,
  height: HEIGHT,
  theme: c.theme,
  namespace: 'r',
});

/** Mounts the candidate in a fresh harness page and returns the PNG of its SVG. */
export async function renderBrowser(page: Page, c: Candidate): Promise<Buffer> {
  await openHarness(page);
  await h(page).mount([c.fixture], options(c));
  return page.locator('svg[data-dravenviz-chart]').screenshot({ animations: 'disabled' });
}

/** The standalone SVG (fonts embedded, so it renders as an `<img>`) and a PNG of it. */
export async function renderSvg(page: Page, c: Candidate): Promise<{ svg: string; png: Buffer }> {
  await openHarness(page);
  const svg = await h(page).renderToSvg(c.fixture, {
    ...options(c),
    namespace: 's',
    fontMode: 'embedded',
  });
  await page.evaluate(
    async ([markup, w, ht]) => {
      const img = document.createElement('img');
      img.setAttribute('data-visual-svg', '');
      img.width = w as number;
      img.height = ht as number;
      img.style.display = 'block';
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup as string)}`;
      document.body.replaceChildren(img);
      await img.decode();
      await document.fonts.ready;
    },
    [svg, WIDTH, HEIGHT] as const,
  );
  const png = await page.locator('img[data-visual-svg]').screenshot({ animations: 'disabled' });
  return { svg, png };
}

/** The default (external-font) standalone SVG, the form consumers ship; small enough to commit. */
export async function exportSvgExternal(page: Page, c: Candidate): Promise<string> {
  await openHarness(page);
  return h(page).renderToSvg(c.fixture, { ...options(c), namespace: 's' });
}

/**
 * For the Node scripts (`calibrate.ts`, `generate.ts`): the URL of the harness dev server, started
 * here unless one already answers on its port, and a Chromium launched like Playwright's config does.
 */
export async function startHarness(): Promise<{ url: string; stop: () => Promise<void> }> {
  const { HARNESS_PORT } = await import('../harness/vite.config');
  const url = `http://127.0.0.1:${HARNESS_PORT}`;
  const up = await fetch(url).then(
    (r) => r.ok,
    () => false,
  );
  if (up) return { url, stop: async () => undefined };
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: new URL('../harness/vite.config.ts', import.meta.url).pathname,
    logLevel: 'error',
  });
  await server.listen();
  return { url, stop: () => server.close() };
}

export const chromiumPath = (): string =>
  process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
