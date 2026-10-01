import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { chromium } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { isMain } from '../../scripts/gen-lib';
import { loadTolerances, THRESHOLD } from '../visual/tolerances';

/**
 * Browser side of `pnpm test:pdf` (design sections 13 and 16.2). Loads the SAME bundle that
 * DravenPDF printed, in Chromium with print media at 150 dpi (deviceScaleFactor 150/96), and
 *
 * 1. reads, per chart instance, the ReadyInfo the bootstrap kept (`effectivePt`) and the label
 *    manifest: every SVG `<text>` DravenViz draws carries `data-dv-label-id` and
 *    `data-dv-text-role`; the manifest lists `{ labelId, role, text, rotate }` in DOM order;
 * 2. screenshots each frame (the chart's `<a data-chart-slot>`) at the size of the matching PDF
 *    crop and compares the two with pixelmatch (cross-path comparison, design section 16.2).
 *
 * Both sides are rendered at SUPERSAMPLE times 150 dpi and box-filtered down to 150 dpi, so
 * rasterizer anti-aliasing (Skia in Chromium, PDFium for the PDF) averages out and what is
 * compared is geometry and glyph shapes. Chart content is never masked.
 *
 * usage: tsx tests/pdf/compare.ts --bundle <dir> --crops <dir> --out <dir>
 *        tsx tests/pdf/compare.ts --mode failure --bundle <dir> --out <dir>
 *   <crops>/<namespace>.png are the PDF crops (150 dpi, frame origin at pixel 0,0); <out>
 *   receives browser.json, comparison.json, browser/<ns>.png and diff/<ns>.png.
 */

/**
 * pixelmatch settings and the allowed cross-path ratio come from `tests/visual/tolerances.json`
 * (design section 16.2), the single place `pnpm visual:calibrate` writes. `--calibrate` skips
 * reading the allowance (the calibration run measures ratios, it does not judge them).
 */
export { THRESHOLD };
const DPI = 150;
const CSS_DPI = 96;
/** Render factor on both sides before the box filter down to 150 dpi (must match the PDF crops). */
export const SUPERSAMPLE = 2;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

interface Label {
  labelId: string;
  role: string;
  text: string;
  rotate: number;
}

interface Instance {
  namespace: string;
  chartId: string;
  effectivePt: { title: number; label: number; caption: number } | null;
  labels: Label[];
}

interface Comparison {
  namespace: string;
  width: number;
  height: number;
  mismatched: number;
  ratio: number;
  threshold: number;
  includeAA: boolean;
  browserCrop: string;
  diff: string;
}

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value === undefined) throw new Error(`missing --${name}`);
  return path.resolve(value);
}

export interface Image {
  width: number;
  height: number;
  data: Buffer;
}

export function cropTopLeft(img: Image, width: number, height: number): Image {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    img.data.copy(data, y * width * 4, y * img.width * 4, y * img.width * 4 + width * 4);
  }
  return { width, height, data };
}

/** Box filter: the mean of each factor x factor block. */
export function downsample(img: Image, factor: number): Image {
  const width = Math.floor(img.width / factor);
  const height = Math.floor(img.height / factor);
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum += img.data[((y * factor + dy) * img.width + (x * factor + dx)) * 4 + c] ?? 0;
          }
        }
        data[(y * width + x) * 4 + c] = Math.round(sum / (factor * factor));
      }
    }
  }
  return { width, height, data };
}

function serve(root: string): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    const file = path.join(root, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` });
    });
  });
}

/**
 * `--mode failure`: loads a deliberately broken bundle and reports what the page did, so the
 * driver can show that a missing file makes the bootstrap throw and never set the ready flag.
 */
async function failureMode(): Promise<void> {
  const bundle = arg('bundle');
  const out = arg('out');
  mkdirSync(out, { recursive: true });
  const executablePath =
    process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const { server, url } = await serve(bundle);
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.status()} ${new URL(r.url()).pathname}`);
    });
    await page.emulateMedia({ media: 'print' });
    await page.goto(url);
    const ready = await page
      .waitForFunction('window.__DRAVENPDF_READY__ === true', undefined, { timeout: 4000 })
      .then(() => true, () => false); // prettier-ignore
    writeFileSync(
      path.join(out, 'failure.json'),
      `${JSON.stringify({ ready, pageErrors, failedRequests }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--mode') && process.argv.includes('failure')) {
    await failureMode();
    return;
  }
  const maxRatio = process.argv.includes('--calibrate') ? null : loadTolerances().crossPdfBrowser;
  const bundle = arg('bundle');
  const crops = arg('crops');
  const out = arg('out');
  mkdirSync(path.join(out, 'browser'), { recursive: true });
  mkdirSync(path.join(out, 'diff'), { recursive: true });

  const executablePath =
    process.env['PW_CHROMIUM_PATH'] ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const { server, url } = await serve(bundle);
  const browser = await chromium.launch({ executablePath });
  try {
    const scale = (DPI / CSS_DPI) * SUPERSAMPLE; // device pixels per CSS pixel
    const context = await browser.newContext({
      viewport: { width: 700, height: 1000 },
      deviceScaleFactor: scale,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulateMedia({ media: 'print' });
    await page.goto(url);
    await page.waitForFunction('window.__DRAVENPDF_READY__ === true', undefined, {
      timeout: 30_000,
    });
    if (errors.length > 0) throw new Error(`page errors: ${errors.join('; ')}`);

    const instances = await page.evaluate((): Instance[] => {
      type W = Window & {
        __DV_READY_INFO__?: {
          chartId: string;
          effectivePt?: { title: number; label: number; caption: number };
        }[];
      };
      const infos = (window as W).__DV_READY_INFO__ ?? [];
      const slots = Array.from(document.querySelectorAll('[data-chart-slot]'));
      return slots.map((slot, index) => {
        const svg = slot.querySelector('svg[data-dv-render-id]');
        if (svg === null) throw new Error('chart without an SVG');
        const byId = new Map<string, Label>();
        for (const el of Array.from(svg.querySelectorAll('text[data-dv-label-id]'))) {
          const labelId = el.getAttribute('data-dv-label-id') ?? '';
          const text = el.textContent ?? '';
          const rotation = /rotate\(\s*(-?[\d.]+)/.exec(el.getAttribute('transform') ?? '');
          const seen = byId.get(labelId);
          if (seen !== undefined) {
            seen.text += text; // wrapped lines of one logical label share its id
          } else {
            byId.set(labelId, {
              labelId,
              role: el.getAttribute('data-dv-text-role') ?? '',
              text,
              rotate: rotation?.[1] === undefined ? 0 : Number(rotation[1]),
            });
          }
        }
        const info = infos[index];
        return {
          namespace: slot.getAttribute('data-chart-slot') ?? '',
          chartId: svg.getAttribute('data-dravenviz-chart') ?? info?.chartId ?? '',
          effectivePt: info?.effectivePt ?? null,
          labels: Array.from(byId.values()),
        };
      });
    });

    const comparisons: Comparison[] = [];
    for (const inst of instances) {
      const cropFile = path.join(crops, `${inst.namespace}.png`);
      if (!existsSync(cropFile)) throw new Error(`no PDF crop for ${inst.namespace}`);
      const pdfCrop = PNG.sync.read(readFileSync(cropFile));
      const box = await page.locator(`[data-chart-slot="${inst.namespace}"]`).evaluate((el) => {
        const r = el.getBoundingClientRect();
        // Chromium paints a replaced element such as the chart's SVG at a whole CSS pixel, so
        // the frame starts at the rounded layout position (as in the PDF).
        return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY) };
      });
      // Same physical size as the PDF crop, at SUPERSAMPLE x its resolution. Chromium rounds a
      // fractional clip, so ask for two device pixels more and cut the exact size from the
      // frame's top-left corner.
      const wantW = pdfCrop.width * SUPERSAMPLE;
      const wantH = pdfCrop.height * SUPERSAMPLE;
      const shot = await page.screenshot({
        fullPage: true,
        clip: {
          x: box.x,
          y: box.y,
          width: wantW / scale + 2 / scale,
          height: wantH / scale + 2 / scale,
        },
      });
      const wide = PNG.sync.read(shot);
      if (wide.width < wantW || wide.height < wantH) {
        throw new Error(
          `${inst.namespace}: browser ${wide.width}x${wide.height} vs wanted ${wantW}x${wantH}`,
        );
      }
      const live = downsample(cropTopLeft(wide, wantW, wantH), SUPERSAMPLE);
      const browserFile = path.join(out, 'browser', `${inst.namespace}.png`);
      writeFileSync(browserFile, PNG.sync.write(live));
      const diff = { width: live.width, height: live.height, data: Buffer.alloc(live.data.length) };
      const mismatched = pixelmatch(live.data, pdfCrop.data, diff.data, live.width, live.height, {
        threshold: THRESHOLD,
        includeAA: false,
      });
      const diffFile = path.join(out, 'diff', `${inst.namespace}.png`);
      writeFileSync(diffFile, PNG.sync.write(diff));
      comparisons.push({
        namespace: inst.namespace,
        width: live.width,
        height: live.height,
        mismatched,
        ratio: mismatched / (live.width * live.height),
        threshold: THRESHOLD,
        includeAA: false,
        browserCrop: browserFile,
        diff: diffFile,
      });
    }

    writeFileSync(
      path.join(out, 'browser.json'),
      `${JSON.stringify({ chromium: browser.version(), instances }, null, 2)}\n`,
    );
    writeFileSync(
      path.join(out, 'comparison.json'),
      `${JSON.stringify({ threshold: THRESHOLD, includeAA: false, maxRatio, comparisons }, null, 2)}\n`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

if (isMain(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
