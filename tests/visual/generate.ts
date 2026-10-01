import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { resolveTheme, toDataTable, validateSpec, type DataTable } from '../../src/core/index';
import { loadFixture, specHash } from '../../fixtures/index';
import {
  CANDIDATES,
  CANDIDATE_DIR,
  EVIDENCE_DIR,
  HEIGHT,
  ROOT,
  SCALE,
  WIDTH,
  decisionOf,
  type Candidate,
} from './candidates';
import { diffPng } from './pixels';
import { chromiumPath, exportSvgExternal, renderBrowser, renderSvg, startHarness } from './render';
import { replaceBlock } from './review-md';
import { loadTolerances } from './tolerances';

/**
 * `pnpm visual:candidates` (Task 19, design D4). Renders every candidate reference, writes
 *
 * - `baselines/candidates/<id>.png`  the browser render (candidate, NOT an approved baseline);
 * - `evidence/visual/svg/<id>.svg`   the standalone SVG (fonts embedded);
 * - `evidence/visual/index.html`     the self-contained owner review page (images are data: URIs);
 * - the candidate block of `REVIEW.md` (every decision is kept as recorded; new ones are `pending`).
 *
 * This script never approves anything and never writes to `baselines/approved/`.
 */
interface PdfInstance {
  fixture: string;
  namespace: string;
  mismatchRatio: number | null;
  cropSha256: string | null;
}
interface PdfReport {
  dravenpdf: { commit: string };
  chromium: string;
  pypdfium2: string;
  rasterDpi: number;
  instances: PdfInstance[];
  fonts: { path: string; sha256: string }[];
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUri = (mime: string, b: Buffer): string => `data:${mime};base64,${b.toString('base64')}`;
const pkgVersion = (name: string): string =>
  (JSON.parse(readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version; // prettier-ignore

interface Spec {
  series?: { points?: { quality?: string }[] }[];
}
interface Model {
  yAxes: { id: string; domain: [number, number] }[];
  series: { axisId: string; points: { value: number | null }[] }[];
}

/** True when a measured value of a series sits exactly on an edge of its axis domain. */
function valueOnDomainEdge(model: Model): boolean {
  return model.yAxes.some((axis) => {
    const [lo, hi] = axis.domain;
    return model.series.some(
      (s) => s.axisId === axis.id && s.points.some((p) => p.value === lo || p.value === hi),
    );
  });
}

/** Items the owner is asked to look at (rulings R28, R29 and the grayscale dash check). */
function flags(c: Candidate, spec: Spec, edge: boolean): { code: string; text: string }[] {
  const out: { code: string; text: string }[] = [];
  if (edge) {
    out.push({
      code: 'R29',
      text: 'A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.',
    });
  }
  if (c.fixture === 'line-estimated-monotone' && c.theme === 'print') {
    out.push({
      code: 'DASH',
      text: 'Actual vs estimated dash patterns: in grayscale, are the solid and the estimated (dashed) segments still easy to tell apart? Compare with the PDF crop.',
    });
  }
  if ((spec.series ?? []).some((s) => (s.points ?? []).some((p) => p.quality !== undefined))) {
    out.push({
      code: 'R28',
      text: 'Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?',
    });
  }
  return out;
}

function tableHtml(t: DataTable): string {
  const head = t.columns.map((col) => `<th scope="col">${esc(col.label)}</th>`).join('');
  const rows = t.rows
    .map(
      (r) =>
        `<tr><th scope="row">${esc(r.header)}</th>${r.cells
          .map(
            (cell) =>
              `<td class="${cell.state === 'measured' ? '' : 'miss'}">${esc(cell.text)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  const notes =
    t.notes.length > 0
      ? `<ul class="notes">${t.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
      : '';
  return `<div class="tablewrap"><table><caption>${esc(t.caption)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${notes}`;
}

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#14181f;--mute:#586272;--line:#d5dae2;--accent:#1f5fbf;--warn-bg:#fff4d6;--warn-ink:#5c4300;--pend-bg:#eef0f4;--pend-ink:#2d3440;--img-bg:#fff}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#101319;--card:#181c24;--ink:#e8ebf0;--mute:#9aa3b2;--line:#2c3340;--accent:#7fb0ff;--warn-bg:#3a2f0e;--warn-ink:#f4d98c;--pend-bg:#262c38;--pend-ink:#d4d9e2}}
:root[data-theme=dark]{--bg:#101319;--card:#181c24;--ink:#e8ebf0;--mute:#9aa3b2;--line:#2c3340;--accent:#7fb0ff;--warn-bg:#3a2f0e;--warn-ink:#f4d98c;--pend-bg:#262c38;--pend-ink:#d4d9e2}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:16px}
h1{font-size:1.6rem;margin:.4em 0}h2{font-size:1.2rem;margin:1.6em 0 .4em}h3{font-size:1.05rem;margin:0}
p,li{max-width:70ch}
a{color:var(--accent)}
code{font:0.9em ui-monospace,Menlo,Consolas,monospace;overflow-wrap:anywhere}
.mute{color:var(--mute)}
.banner{background:var(--pend-bg);color:var(--pend-ink);border:1px solid var(--line);border-radius:8px;padding:12px 16px}
.attn{background:var(--warn-bg);color:var(--warn-ink);border-radius:8px;padding:12px 16px;margin:12px 0}
.attn li{margin:.3em 0}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;font-size:.9rem;margin:.4em 0}
th,td{border:1px solid var(--line);padding:3px 8px;text-align:left}td{text-align:right;font-variant-numeric:tabular-nums}td.miss{color:var(--mute);font-style:italic}
caption{caption-side:top;text-align:left;font-weight:600;padding:2px 0}
nav ul{columns:2 280px;padding-left:1.2em}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:16px 0}
.card header{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;margin-bottom:6px}
.pill{display:inline-block;border-radius:999px;padding:1px 10px;font-size:.8rem;font-weight:600;background:var(--pend-bg);color:var(--pend-ink);border:1px solid var(--line)}
.pill.flag{background:var(--warn-bg);color:var(--warn-ink);border-color:transparent}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin:10px 0}
figure{margin:0}figcaption{font-size:.85rem;color:var(--mute);margin-bottom:3px}
figure img{display:block;width:100%;height:auto;background:var(--img-bg);border:1px solid var(--line);border-radius:4px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;font-size:.88rem;margin:8px 0}dt{color:var(--mute)}dd{margin:0;overflow-wrap:anywhere}
details summary{cursor:pointer;font-weight:600;margin:6px 0}
.flags{margin:8px 0;padding-left:1.2em}
@media (max-width:520px){dl{grid-template-columns:1fr}dt{margin-top:4px}}
`;

async function main(): Promise<void> {
  const report = JSON.parse(
    readFileSync(path.join(ROOT, 'evidence/pdf/report-slice1.json'), 'utf8'),
  ) as PdfReport;
  const tol = loadTolerances();
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  mkdirSync(path.join(EVIDENCE_DIR, 'svg'), { recursive: true });
  const harness = await startHarness();
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const chromiumVersion = `Chromium ${browser.version()}`;
  const fonts = report.fonts
    .filter((f) => f.path.endsWith('.woff2'))
    .map((f) => `${path.basename(f.path)} ${f.sha256}`);

  interface Row {
    c: Candidate;
    hash: string;
    themeVersion: string;
    pngBytes: number;
    svgBytes: number;
    svgRatio: number;
    pdf: { ns: string; ratio: number | null; uri: string }[];
    flags: { code: string; text: string }[];
    card: string;
  }
  const rows: Row[] = [];
  try {
    const context = await browser.newContext({
      baseURL: harness.url,
      deviceScaleFactor: SCALE,
      viewport: { width: 800, height: 600 },
    });
    const page = await context.newPage();
    for (const c of CANDIDATES) {
      const spec = loadFixture(c.fixture);
      const png = await renderBrowser(page, c);
      const svg = await renderSvg(page, c);
      writeFileSync(path.join(CANDIDATE_DIR, `${c.id}.png`), png);
      writeFileSync(
        path.join(EVIDENCE_DIR, 'svg', `${c.id}.svg`),
        await exportSvgExternal(page, c),
      );
      const svgRatio = diffPng(png, svg.png).ratio;
      const pdf = c.theme !== 'print'
        ? []
        : report.instances
            .filter((i) => i.fixture === c.fixture)
            .map((i) => {
              const file = path.join(ROOT, 'evidence/pdf/crops', `${i.namespace}.png`);
              if (!existsSync(file)) throw new Error(`missing PDF crop ${file}; run pnpm test:pdf`);
              return { ns: i.namespace, ratio: i.mismatchRatio, uri: dataUri('image/png', readFileSync(file)) };
            }); // prettier-ignore
      const table = toDataTable(validateSpec(spec));
      const model = (
        (await page.evaluate((f) => window.__h.layoutOf(f, 680, 320), c.fixture)) as {
          model: Model;
        }
      ).model;
      const fl = flags(c, spec as Spec, valueOnDomainEdge(model));
      const hash = specHash(spec);
      const themeVersion = resolveTheme(c.theme).version;
      const id = esc(c.id);
      const figs = [
        `<figure><figcaption>Browser render (live chart, ${c.theme} theme)</figcaption><img alt="Browser render of ${id}" src="${dataUri('image/png', png)}"></figure>`,
        `<figure><figcaption>Standalone SVG (loaded as an image and captured at ${SCALE}x; differs from browser by ${(svgRatio * 100).toFixed(3)} %, allowed ${(tol.crossSvgBrowser * 100).toFixed(3)} %)</figcaption><img alt="Standalone SVG of ${id}" src="${dataUri('image/png', svg.png)}"></figure>`,
        ...pdf.map(
          (p) =>
            `<figure><figcaption>PDF crop (DravenPDF, 150 dpi, instance ${esc(p.ns)}; differs from browser by ${p.ratio === null ? 'n/a' : `${(p.ratio * 100).toFixed(3)} %`}, allowed ${(tol.crossPdfBrowser * 100).toFixed(3)} %)</figcaption><img alt="PDF crop of ${id}, instance ${esc(p.ns)}" src="${p.uri}"></figure>`,
        ),
        ...(pdf.length === 0
          ? [
              `<figure><figcaption>PDF crop</figcaption><p class="mute">Not in report-slice1 (${c.theme === 'print' ? 'fixture not placed in the PDF report' : 'the PDF report is print theme only'}).</p></figure>`,
            ]
          : []),
      ].join('');
      const card = `<section class="card" id="${id}"><header><h3>${id}</h3><span class="pill">decision: pending</span>${fl.map((f) => `<span class="pill flag">${f.code}</span>`).join('')}</header>
<dl><dt>Fixture</dt><dd><code>${esc(c.fixture)}</code></dd><dt>Theme</dt><dd>${c.theme} (theme version ${esc(themeVersion)})</dd><dt>Size</dt><dd>${WIDTH} &times; ${HEIGHT} logical units, PNG at ${SCALE}&times; (${WIDTH * SCALE} &times; ${HEIGHT * SCALE})</dd><dt>Spec hash</dt><dd><code>${hash}</code></dd><dt>Decision</dt><dd><strong>pending</strong> (reply &ldquo;approve ${id}&rdquo; or &ldquo;changes requested on ${id}: &hellip;&rdquo;)</dd></dl>
${fl.length > 0 ? `<ul class="flags attn">${fl.map((f) => `<li><strong>${f.code}.</strong> ${esc(f.text)}</li>`).join('')}</ul>` : ''}
<div class="figs">${figs}</div>
<details><summary>Data table</summary>${tableHtml(table)}</details></section>`;
      rows.push({
        c,
        hash,
        themeVersion,
        pngBytes: png.length,
        svgBytes: svg.svg.length,
        svgRatio,
        pdf,
        flags: fl,
        card,
      });
      console.log(
        `  ${c.id}: png ${png.length} B, svg ${svg.svg.length} B, svg diff ${(svgRatio * 100).toFixed(3)} %`,
      );
    }
  } finally {
    await browser.close();
    await harness.stop();
  }

  const versions = {
    recharts: pkgVersion('recharts'),
    react: pkgVersion('react'),
    chromium: chromiumVersion,
    dravenpdf: report.dravenpdf.commit,
    pypdfium2: report.pypdfium2,
    dpi: report.rasterDpi,
  };

  // ---- the review page --------------------------------------------------------------------
  const flagged = (code: string): string =>
    rows
      .filter((r) => r.flags.some((f) => f.code === code))
      .map((r) => `<a href="#${esc(r.c.id)}">${esc(r.c.id)}</a>`)
      .join(', ') || 'none';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DravenViz Slice 1 Visual Review</title><style>${CSS}</style></head><body><main>
<h1>DravenViz slice 1: visual reference review</h1>
<p class="banner"><strong>Decision: pending for all ${rows.length} candidates.</strong> Nothing here is approved. Under design D4 only the owner approves a baseline; until then the visual tests fail with &ldquo;pending owner review&rdquo; by design. Reply per candidate id: &ldquo;approve &lt;id&gt;&rdquo; or &ldquo;changes requested on &lt;id&gt;: &hellip;&rdquo;.</p>
<h2>Please look at these first</h2>
<div class="attn"><ul>
<li><strong>R29, half-clipped stroke at a fit-domain plot edge.</strong> A line or marker at the lowest or highest value of a fit domain can be cut in half by the plot boundary. Candidates where a value sits on the domain edge: ${flagged('R29')}. line-weekly-flow was checked too: its domain is include-zero and none of its values lies on an edge, so it is not flagged, but its first points are on the page for you to confirm.</li>
<li><strong>Actual vs estimated dashes in grayscale (print theme).</strong> Do the solid and dashed patterns stay distinguishable when printed without colour? ${flagged('DASH')}.</li>
<li><strong>R28, legend quality text length.</strong> The legend draws each quality&rsquo;s meaning after its label; is it too long or crowded? ${flagged('R28')}.</li>
</ul></div>
<h2>Candidates</h2>
<nav><ul>${rows.map((r) => `<li><a href="#${esc(r.c.id)}">${esc(r.c.id)}</a>${r.flags.length > 0 ? ` <span class="mute">(${r.flags.map((f) => f.code).join(', ')})</span>` : ''}</li>`).join('')}</ul></nav>
<p class="mute">Each card shows the browser render, the standalone SVG and (print theme, fixtures in report-slice1) the crop from the real DravenPDF PDF, so clipping indicators, estimated dashes and monotone curves can be compared in all three outputs. The data table is the accessible table of the same spec.</p>
${rows.map((r) => r.card).join('\n')}
<h2>Provenance</h2>
<dl><dt>Recharts</dt><dd>${versions.recharts}</dd><dt>React</dt><dd>${versions.react}</dd><dt>Chromium</dt><dd>${esc(versions.chromium)}</dd><dt>DravenPDF commit</dt><dd><code>${esc(versions.dravenpdf)}</code></dd><dt>Rasterizer</dt><dd>pypdfium2 ${esc(versions.pypdfium2)} at ${versions.dpi} dpi</dd><dt>Fonts</dt><dd>${fonts.map((f) => `<code>${esc(f)}</code>`).join('<br>')}</dd>
<dt>Tolerances</dt><dd>pixelmatch threshold ${tol.threshold}, includeAA false; same-path browser ${(tol.sameBrowser * 100).toFixed(3)} %, SVG vs browser ${(tol.crossSvgBrowser * 100).toFixed(3)} %, PDF vs browser ${(tol.crossPdfBrowser * 100).toFixed(3)} % (see tests/visual/REVIEW.md)</dd></dl>
</main></body></html>
`;
  writeFileSync(path.join(EVIDENCE_DIR, 'index.html'), html);

  // ---- REVIEW.md ---------------------------------------------------------------------------
  const sections = rows.map((r) => {
    const pdf =
      r.pdf.length === 0
        ? 'none (not in report-slice1 or not print theme)'
        : r.pdf.map((p) => `\`evidence/pdf/crops/${p.ns}.png\``).join(', ');
    const modeDiff =
      r.c.theme === 'print'
        ? 'Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.'
        : 'Browser and SVG only (the PDF report is print theme only). No intentional content differences.';
    return [
      `### ${r.c.id}`,
      '',
      `- **Decision:** \`${decisionOf(r.c.id)}\``,
      `- **Fixture ID:** \`${r.c.fixture}\``,
      `- **Spec hash (canonical SHA-256):** \`${r.hash}\``,
      `- **Theme:** ${r.c.theme}, theme version ${r.themeVersion}`,
      `- **Dimensions:** ${WIDTH} x ${HEIGHT} logical units; PNG ${WIDTH * SCALE} x ${HEIGHT * SCALE} (${SCALE}x)`,
      `- **Candidate PNG:** \`tests/visual/baselines/candidates/${r.c.id}.png\` (${r.pngBytes} bytes); standalone SVG \`evidence/visual/svg/${r.c.id}.svg\``,
      `- **PDF crop:** ${pdf}`,
      `- **Intentional mode differences:** ${modeDiff}`,
      ...(r.flags.length > 0
        ? [`- **Owner attention:** ${r.flags.map((f) => `${f.code} (${f.text})`).join(' ')}`]
        : []),
      '',
    ].join('\n');
  });
  const body = [
    '## Environment and provenance (all candidates)',
    '',
    `- Recharts ${versions.recharts}, React ${versions.react}, ${versions.chromium}`,
    `- DravenPDF commit \`${versions.dravenpdf}\`; rasterizer pypdfium2 ${versions.pypdfium2} at ${versions.dpi} dpi (2x supersampled, box-filtered)`,
    '- Font hashes (SHA-256):',
    ...fonts.map((f) => `  - \`${f}\``),
    '',
    '## Notes for the owner',
    '',
    'Nothing below is approved. Look at these on `evidence/visual/index.html` (one page, candidate ids as anchors):',
    '',
    `- **R29, half-clipped stroke at a fit-domain plot edge.** A stroke or marker whose value is the extreme of the plot domain can be half cut by the plot boundary. line-weekly-flow was checked as well: include-zero domain, no value on an edge, so not flagged. Candidates: ${
      rows
        .filter((r) => r.flags.some((f) => f.code === 'R29'))
        .map((r) => `\`${r.c.id}\``)
        .join(', ') || 'none'
    }.`,
    `- **Actual vs estimated dash patterns in grayscale.** Print theme only: ${rows
      .filter((r) => r.flags.some((f) => f.code === 'DASH'))
      .map((r) => `\`${r.c.id}\``)
      .join(', ')}. Check the solid and estimated patterns stay distinguishable without colour.`,
    `- **R28, legend quality-meaning text length.** The legend draws each quality's meaning after its label. Candidates: ${rows
      .filter((r) => r.flags.some((f) => f.code === 'R28'))
      .map((r) => `\`${r.c.id}\``)
      .join(', ')}.`,
    '',
    '## Candidates (decision: `pending | approved by <owner> on <date> | changes requested`)',
    '',
    ...sections,
  ].join('\n');
  replaceBlock('candidates', body);
  const size = statSync(path.join(EVIDENCE_DIR, 'index.html')).size;
  console.log(
    `wrote evidence/visual/index.html (${(size / 1024 / 1024).toFixed(2)} MiB), ${rows.length} candidates`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
});
