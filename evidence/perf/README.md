# Slice-1 size and latency evidence

Written by `pnpm measure` (`scripts/measure-size.ts`, `scripts/measure-latency.ts`,
`examples/dravenpdf/measure_pdf.py`, page `tests/harness/perf.html`). The numbers are in
`size.json` and `latency.json`; `pnpm test:perf` validates them and enforces the P1 target.
Budgets are in `docs/design.md` section 18.1.

## Machine

| Item | Value |
| ---- | ----- |
| CPU | Intel(R) Xeon(R) Processor @ 2.80GHz |
| Cores | 4 |
| RAM | 16,876,515,328 B (15.7 GiB) |
| OS | Ubuntu 24.04.4 LTS (kernel 6.18.44-fc-v50), a sandbox VM |
| Node | v22.22.0 |
| Chromium | 141.0.7390.37 (Playwright revision 1194) |
| Recharts | 3.10.1 |
| React / ReactDOM | 19.3.0 / 19.3.0 (embedded in the browser bundle) |
| DravenPDF | commit 7a249e0 |

Font hashes (sha256, from the tarball's `asset-manifest.json`):

| File | Bytes | sha256 |
| ---- | ----- | ------ |
| `fonts/NotoSans-Regular.woff2` | 150,912 | `23a8c28d5ffb5e4f4545de7655fb34bdab36872938a712ec9d874c5ad9a2d02e` |
| `fonts/NotoSans-SemiBold.woff2` | 158,320 | `6e31729e067bc35e3ec767012a52e6b389866317f1d0a1d8311bedfd8e57eb27` |
| `fonts/noto-sans.css` | 395 | `818c7f95ed8f553eb142ddf38638b85691d39696c1b5bc062cf5f0a8ebde7a67` |

## Method

Everything is measured from the packed tarball `.pack/draven-viz-0.1.0.tgz`, extracted to a temp
directory. `pnpm measure` repacks first (`pnpm pack:local`). Latency: 5 warm-up runs, then 30
measured samples; p50 and p95 by the nearest-rank method (value at rank ceil(p/100 x 30) of the
sorted samples: p50 is the 15th, p95 the 29th). All times in ms.

- **P1** warmed `mountCharts` readiness of `perf-line-500x4` at 680x320. One page that loaded
  `dravenviz.browser.js` from a local server; the warm-up mounts load the fonts; each sample is a new
  `mountCharts` call timed with `performance.now()` until `handle.ready` resolves, then disposed. A
  guard checks (outside the timed region) that a chart SVG was produced.
- **P2** fresh page load until readiness. A new browser context per run (nothing cached, server sends
  `Cache-Control: no-store`), `perf.html?fresh` fetches the spec and mounts; the value is
  `performance.now()` at readiness, which counts from navigation start, so it includes fetching and
  evaluating the 822 KB bundle, the CSS, the two fonts and the spec. The 5 warm-up runs are fresh
  loads too.
- **P4** `report-slice1` (8 charts, 6 pages) through DravenPDF over HTTP (`POST /v1/render/bundle`),
  concurrency 1. The server is started by the existing `support.dravenpdf_server` (which also does its
  own warm-up render), then 5 warm-up renders, then 30 timed renders. The timer wraps
  `client.render_bundle`, so it includes reading and uploading the bundle files and receiving the PDF.
  The bundle comes from the same tarball (`run_pdf_check.build_bundle`).

### Stall rule for P4 (chosen)

Chromium in this sandbox stalls on roughly 1 render in 10 (HTTP 504 after the 30 s `timeout_ms`), and
rarely loses its DevTools session (HTTP 422 `render_failed`, "Chromium redirect control failed",
seen once in about 100 renders). A failed attempt is never dropped and never hidden inside a sample:

1. The attempt's duration is recorded: 504 under `stalls.durationsMs`, the 422 under
   `otherTransientFailures`.
2. The same sample is retried (at most 5 attempts in a row, otherwise the run fails).
3. The 30 `samples` are therefore successful renders and p50/p95 are computed over them. Beside them
   the stall count and the stall rate `stalls / (stalls + renders)` are reported (`stalls.count`,
   `stalls.rate`). Warm-up stalls are counted in `warmupStalls`.

A stall costs about 30 s, so it would dominate p95 if it were a sample; reporting the rate next to a
p95 over successful renders keeps both facts visible. The retry is the same one `pnpm test:pdf` uses
for 504.

## Results (run recorded in the committed JSON)

| ID | Scenario | p50 | p95 | min | max | Target |
| -- | -------- | --- | --- | --- | --- | ------ |
| P1 | warmed `mountCharts` readiness, `perf-line-500x4` | 31.6 | 47.3 | 29.2 | 47.6 | p95 <= 250 ms: **met** |
| P2 | fresh page load to readiness | 322.3 | 355.1 | 287.3 | 362.9 | budget 430 ms |
| P4 | DravenPDF HTTP, `report-slice1` | 2,069.4 | 2,237.9 | 1,864.0 | 2,255.8 | budget 2,690 ms |

P4 stalls in the recorded run: 0 stalls and 0 other transient failures in 30 renders (0 %), 0 in
warm-up. Earlier runs on the same machine during development: 2 stalls in 32 renders (6 %), 0 in 30;
one run hit the 422 once in warm-up. So the stall rate varies from run to run; read `stalls` in
`latency.json` of the run you compare against.

### P1 investigation

P1 meets its target with a wide margin (p95 47.3 ms against 250 ms), so no investigation of a miss was
needed and no exception exists. The spread is small (29.2 to 47.6 ms), and the budget for later
regression checks is 60 ms (measured + 20 %). P2 minus P1 is about 290 ms: that is the cost of loading
and evaluating the bundle, fetching the fonts and the first (cold) mount.

## Sizes

From the extracted tarball (`size.json`):

| Item | Bytes |
| ---- | ----- |
| Tarball | 640,165 |
| `dravenviz.browser.js` raw / gzip (level 9) | 822,332 / 219,540 |
| ESM entry `.` / `./react` / `./print` | 234 / 17,310 / 35,350 |
| Shared ESM chunks (`chunk-*.js`, imported by the entries) | 372,519 + 98,565 |
| Fonts (2 woff2 + css) | 309,627 |
| SVG, external fonts, 16 slice-1 static fixtures | 3,726 to 13,225 (largest `perf-line-500x4`) |
| SVG, embedded fonts | 416,201 to 425,700 |
| PDF `report-slice1` | 84,748, 6 pages |

The ESM entry `.` is a 234-byte re-export stub; the code is in the shared chunks, so entry sizes
alone understate the ESM cost and the budgets also cover the total. The SVG list is every fixture of
slice 1 that has the `static` mode in `fixtures/index.ts`, exported at 680x320, print theme,
`staticLabels` as `renderToSvg` sets it.

## Reproduce

```
pnpm measure && pnpm test:perf
```

Needs `uv`, Python 3.12 and Chromium (the same prerequisites as `pnpm test:pdf`; a missing one prints
`UNVERIFIED:` and exits 3). Latency depends on the machine: compare runs only on comparable hardware.
