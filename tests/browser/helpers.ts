import type { Page } from '@playwright/test';

export interface ReadyInfo {
  chartId: string;
  renderId: number;
  width: number;
  height: number;
  effectivePt?: { title: number; label: number; caption: number };
}

export interface MountErrorInfo {
  code: string | undefined;
  message: string;
  chartId?: string;
  path?: string;
  rule?: string;
}

export interface Opts {
  width?: number;
  height?: number;
  theme?: string;
  namespace?: string;
  namespaces?: string[];
  timeoutMs?: number;
  staticLabels?: boolean;
  host?: 'visible' | 'hidden';
  [k: string]: unknown;
}

export interface SvgExportResult {
  svg: string;
  fonts: {
    family: string;
    weight: 400 | 600;
    fileName: string;
    href: string;
    sourceUrl: string;
    sha256: string;
    bytes: number;
  }[];
}

export const DEFAULT_OPTS: Opts = { width: 680, height: 320, theme: 'print', namespace: 'r' };

/** Typed wrapper around `window.__h` for the Playwright tests. */
export const h = (page: Page) => ({
  /** Resolves with the ReadyInfo list, or rejects with an Error whose `message` is the error code. */
  async mount(items: (string | object)[], opts: Opts = DEFAULT_OPTS): Promise<ReadyInfo[]> {
    const out = await page.evaluate(([i, o]) => window.__h.mount(i, o as never), [
      items,
      opts,
    ] as const);
    if (!out.ok) throw new Error(`${out.error.code}: ${out.error.message}`);
    return out.info as ReadyInfo[];
  },
  async mountError(items: (string | object)[], opts: Opts = DEFAULT_OPTS): Promise<MountErrorInfo> {
    const out = await page.evaluate(([i, o]) => window.__h.mount(i, o as never), [
      items,
      opts,
    ] as const);
    if (out.ok) throw new Error('expected the mount to fail');
    return out.error as MountErrorInfo;
  },
  /** Exports a fixture with the real exporter; rejects with `CODE: message` on failure. */
  async renderToSvgWithAssets(
    item: string | object,
    opts: Opts = {},
    inject?: string,
  ): Promise<SvgExportResult> {
    const out = await page.evaluate(([i, o, j]) => window.__h.exportSvg(i, o as never, j), [
      item,
      opts,
      inject,
    ] as const);
    if (!out.ok) throw new Error(`${out.error.code}: ${out.error.message}`);
    return { svg: out.svg, fonts: out.fonts as SvgExportResult['fonts'] };
  },
  async renderToSvg(item: string | object, opts: Opts = {}, inject?: string): Promise<string> {
    return (await this.renderToSvgWithAssets(item, opts, inject)).svg;
  },
  async exportError(
    item: string | object,
    opts: Opts = {},
    inject?: string,
  ): Promise<MountErrorInfo> {
    const out = await page.evaluate(([i, o, j]) => window.__h.exportSvg(i, o as never, j), [
      item,
      opts,
      inject,
    ] as const);
    if (out.ok) throw new Error('expected the export to fail');
    return out.error as MountErrorInfo;
  },
  counts: () => page.evaluate(() => window.__h.counts()),
  fixture: <T = unknown>(id: string) => page.evaluate((i) => window.__h.fixture(i) as T, id),
});

export async function openHarness(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__h !== 'undefined');
}
