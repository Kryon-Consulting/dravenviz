import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { FIXTURES, loadFixture } from '../fixtures/index';
import { ROOT, isMain } from './gen-lib';
import {
  EVIDENCE,
  TARBALL,
  extractTarball,
  launchChromium,
  machine,
  readManifest,
  serveSite,
} from './perf-lib';
import { checkPrerequisites } from './test-pdf';

/**
 * `pnpm measure`, part 1 (design section 18): sizes from the EXTRACTED TARBALL.
 * Writes evidence/perf/size.json: raw and gzip (level 9) bytes of dravenviz.browser.js, raw bytes of
 * every ESM entry, font bytes, the SVG bytes of each slice-1 static fixture in both font modes and
 * the PDF bytes and page count of report-slice1 (one render through DravenPDF over HTTP).
 */
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

export async function measureSize(): Promise<void> {
  if (!existsSync(TARBALL)) throw new Error(`${TARBALL} is missing: run pnpm pack:local`);
  const { pkg, cleanup } = extractTarball();
  try {
    const bundle = readFileSync(path.join(pkg, 'dist/dravenviz.browser.js'));
    const pj = JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8')) as {
      exports: Record<string, { import?: string } | string>;
    };
    // Each public ESM entry file of the package; the shared chunks they import are listed apart.
    const esm: Record<string, number> = {};
    for (const [key, value] of Object.entries(pj.exports)) {
      if (typeof value === 'object' && value.import) {
        esm[key] = statSync(path.join(pkg, value.import)).size;
      }
    }
    const chunks: Record<string, number> = {};
    for (const f of readdirSync(path.join(pkg, 'dist')).filter((n) => /^chunk-.*\.js$/.test(n))) {
      chunks[`dist/${f}`] = statSync(path.join(pkg, 'dist', f)).size;
    }
    const fonts = readManifest(pkg)
      .files.filter((f) => f.role === 'font')
      .map((f) => {
        const body = readFileSync(path.join(pkg, f.source));
        return { file: f.path, bytes: body.length, sha256: sha256(body) };
      });

    // SVG exports run in Chromium against the packed bundle.
    const fixtures = FIXTURES.filter((f) => f.slice === 1 && f.modes.includes('static'));
    const site = await serveSite(pkg, loadFixture('perf-line-500x4'));
    const browser = await launchChromium();
    const svg: { fixture: string; external: number; embedded: number }[] = [];
    const chromiumVersion = browser.version();
    try {
      const page = await browser.newPage();
      await page.goto(`${site.origin}/perf.html`);
      for (const f of fixtures) {
        const sizes = await page.evaluate(
          async ([spec]) => {
            const perf = (window as unknown as { __perf: { exportSvg(s: unknown, m: string): Promise<string> } }).__perf; // prettier-ignore
            const enc = new TextEncoder();
            const external = await perf.exportSvg(spec, 'external');
            const embedded = await perf.exportSvg(spec, 'embedded');
            return { external: enc.encode(external).length, embedded: enc.encode(embedded).length };
          },
          [loadFixture(f.id)],
        );
        svg.push({ fixture: f.id, ...sizes });
      }
    } finally {
      await browser.close();
      await site.close();
    }

    const tmp = mkdtempSync(path.join(os.tmpdir(), 'dv-size-pdf-'));
    let pdf: { fixture: string; bytes: number; pages: number };
    try {
      checkPrerequisites();
      const out = path.join(tmp, 'pdf.json');
      const run = spawnSync(
        'uv',
        ['run', '--project', 'examples/dravenpdf', '--python', '3.12', '--frozen', 'python',
         'examples/dravenpdf/measure_pdf.py', '--mode', 'size', '--out', out], // prettier-ignore
        { cwd: ROOT, stdio: 'inherit' },
      );
      if (run.status !== 0) throw new Error(`measure_pdf.py (size) exited with ${run.status}`);
      pdf = JSON.parse(readFileSync(out, 'utf8')) as typeof pdf;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }

    const result = {
      measuredFrom: '.pack/draven-viz-0.1.0.tgz (extracted)',
      tarballBytes: statSync(TARBALL).size,
      bundle: {
        file: 'dist/dravenviz.browser.js',
        rawBytes: bundle.length,
        gzipBytes: gzipSync(bundle, { level: 9 }).length,
      },
      esm,
      esmSharedChunks: chunks,
      fonts,
      svg,
      pdf,
      machine: machine(chromiumVersion),
    };
    writeFileSync(path.join(EVIDENCE, 'size.json'), `${JSON.stringify(result, null, 2)}\n`);
    console.log(
      `size.json: bundle ${result.bundle.rawBytes} raw / ${result.bundle.gzipBytes} gzip, ` +
        `${svg.length} fixtures, pdf ${pdf.bytes} bytes / ${pdf.pages} pages`,
    );
  } finally {
    cleanup();
  }
}

if (isMain(import.meta.url)) {
  await measureSize();
}
