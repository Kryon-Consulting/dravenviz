import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadFixture } from '../fixtures/index';
import { ROOT, isMain } from './gen-lib';
import {
  EVIDENCE,
  SAMPLES,
  TARBALL,
  WARMUP,
  extractTarball,
  launchChromium,
  machine,
  percentile,
  round,
  serveSite,
} from './perf-lib';
import { checkPrerequisites } from './test-pdf';

/**
 * `pnpm measure`, part 2 (design section 18): latency, from the EXTRACTED TARBALL's browser bundle.
 * Writes evidence/perf/latency.json. 5 warm-up runs, then 30 samples, nearest-rank p50/p95.
 *
 * - P1: warmed `mountCharts` readiness of perf-line-500x4 at 680x320 in one page (the warm-up runs
 *   load the fonts), the chart disposed between samples. Timed inside the page with
 *   performance.now() from the `mountCharts` call to `handle.ready`.
 * - P2: a fresh page (new browser context, so nothing is cached) from navigation start to readiness,
 *   including the fetch of the bundle, fonts and spec. Same fixture. Timed inside the page
 *   (performance.now() at readiness, which counts from navigation start).
 * - P4: report-slice1 through DravenPDF over HTTP, concurrency 1, server warm (examples/dravenpdf/measure_pdf.py).
 */
interface Summary {
  samples: number[];
  p50: number;
  p95: number;
  warmup: number;
  min: number;
  max: number;
  [k: string]: unknown;
}

function summarize(samples: number[], extra: Record<string, unknown> = {}): Summary {
  const rounded = samples.map((s) => round(s, 2));
  return {
    unit: 'ms',
    warmup: WARMUP,
    samples: rounded,
    p50: percentile(rounded, 50),
    p95: percentile(rounded, 95),
    min: Math.min(...rounded),
    max: Math.max(...rounded),
    ...extra,
  } as Summary;
}

export async function measureLatency(): Promise<void> {
  if (!existsSync(TARBALL)) throw new Error(`${TARBALL} is missing: run pnpm pack:local`);
  checkPrerequisites();
  const spec = loadFixture('perf-line-500x4');
  const { pkg, cleanup } = extractTarball();
  const site = await serveSite(pkg, spec);
  const browser = await launchChromium();
  let p1: Summary;
  let p2: Summary;
  const chromiumVersion = browser.version();
  try {
    // P1
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    page.on('pageerror', (e) => {
      throw e;
    });
    await page.goto(`${site.origin}/perf.html`);
    const samples = await page.evaluate(
      async ([s, warmup, count]) => {
        const perf = (window as unknown as { __perf: { mountOnce(s: unknown): Promise<number> } }).__perf; // prettier-ignore
        for (let i = 0; i < (warmup as number); i++) await perf.mountOnce(s);
        const out: number[] = [];
        for (let i = 0; i < (count as number); i++) out.push(await perf.mountOnce(s));
        return out;
      },
      [spec, WARMUP, SAMPLES] as const,
    );
    await page.close();
    p1 = summarize(samples, {
      scenario: 'warmed mountCharts readiness, perf-line-500x4, 680x320, fonts loaded, one page, disposed between samples',
      target: 250,
    }); // prettier-ignore

    // P2
    const fresh: number[] = [];
    for (let i = 0; i < WARMUP + SAMPLES; i++) {
      const context = await browser.newContext({ viewport: { width: 1000, height: 600 } });
      const p = await context.newPage();
      await p.goto(`${site.origin}/perf.html?fresh`);
      await p.waitForFunction(
        () => (window as unknown as Record<string, unknown>)['__freshMs'] !== undefined || (window as unknown as Record<string, unknown>)['__freshError'] !== undefined, // prettier-ignore
        undefined,
        { timeout: 30_000 },
      );
      const r = await p.evaluate(() => ({
        ms: (window as unknown as Record<string, number | undefined>)['__freshMs'],
        error: (window as unknown as Record<string, string | undefined>)['__freshError'],
      }));
      await context.close();
      if (r.error !== undefined || r.ms === undefined)
        throw new Error(`P2 fresh load failed: ${r.error}`);
      if (i >= WARMUP) fresh.push(r.ms);
    }
    p2 = summarize(fresh, {
      scenario: 'fresh page (new context, no cache) from navigation start to readiness, fonts, bundle and spec fetched',
    }); // prettier-ignore
  } finally {
    await browser.close();
    await site.close();
    cleanup();
  }

  // P4
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'dv-lat-pdf-'));
  let p4: Summary;
  try {
    const out = path.join(tmp, 'p4.json');
    const run = spawnSync(
      'uv',
      ['run', '--project', 'examples/dravenpdf', '--python', '3.12', '--frozen', 'python',
       'examples/dravenpdf/measure_pdf.py', '--mode', 'latency', '--out', out], // prettier-ignore
      { cwd: ROOT, stdio: 'inherit' },
    );
    if (run.status !== 0) throw new Error(`measure_pdf.py (latency) exited with ${run.status}`);
    const raw = JSON.parse(readFileSync(out, 'utf8')) as {
      samples: number[];
      warmupStalls: number;
      stalls: unknown;
      otherTransientFailures: unknown;
    };
    p4 = summarize(raw.samples, {
      scenario: 'report-slice1 through DravenPDF HTTP (POST /v1/render/bundle), concurrency 1, server warm',
      stallRule: 'a 504 is counted in stalls and the sample is retried; samples are successful renders; stall rate = stalls / (stalls + renders)',
      warmupStalls: raw.warmupStalls,
      stalls: raw.stalls,
      otherTransientFailures: raw.otherTransientFailures,
    }); // prettier-ignore
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const result = {
    scenarios: { P1: p1, P2: p2, P4: p4 },
    method: `${WARMUP} warm-up runs, then ${SAMPLES} measured samples; percentiles by the nearest-rank method`,
    machine: machine(chromiumVersion),
  };
  writeFileSync(path.join(EVIDENCE, 'latency.json'), `${JSON.stringify(result, null, 2)}\n`);
  for (const [id, s] of Object.entries(result.scenarios)) {
    console.log(`${id}: p50 ${s.p50} ms, p95 ${s.p95} ms (min ${s.min}, max ${s.max})`);
  }
}

if (isMain(import.meta.url)) {
  await measureLatency();
}
