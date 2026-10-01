# DravenViz in a DravenPDF report

One DravenViz renderer drives a real A4 PDF. A backend sends ordinary chart JSON and a document
HTML page to [DravenPDF](https://github.com/Kryon-Consulting/dravenpdf) (verified against commit
`7a249e0`); Chromium runs the packed DravenViz bundle, and the PDF comes back. Python never draws a
chart and never calls Node.

## Run the check

```sh
pnpm test:pdf
```

This checks the prerequisites (uv, Python 3.12, Chromium), runs `pnpm pack:local`, syncs this
directory with `uv sync`, then runs `run_pdf_check.py`. It prints the result of every check and
writes the evidence to `evidence/pdf/`:

- `report-slice1.pdf`, `report-slice1.json` (spec hashes, options, DravenPDF commit, Chromium
  version, font hashes, per-instance frame rectangles and crop hashes, every check result)
- `pages/page-N.png`: each page at 150 dpi
- `crops/<namespace>.png`: each chart frame at 150 dpi, frame corner at pixel (0, 0)
- `probe/`: the frame-discovery probe, see below

Exit codes:

| Code | Meaning                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 0    | `PASS`                                                                                                                 |
| 1    | a check failed                                                                                                         |
| 3    | a prerequisite is missing: prints `UNVERIFIED: <reason>` (uv, Python 3.12 or Chromium)                                 |
| 4    | everything that could run passed, but part of the evidence could not be proven (prints `UNVERIFIED:`; no frame method) |

Exit 4 is the "method none" branch (controller ruling R2): when the probe results name
`Chosen method: none`, the driver cannot locate frames, so the crop comparison, the label
manifest, font-size and geometry checks are reported as `unverified` (not skipped silently) and the
run ends with 4. A `fail` always wins over `unverified` (exit 1), and neither is ever a `PASS`.

`UNVERIFIED` is never a pass. Set `PW_CHROMIUM_PATH` to use another Chromium (default
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). The comparison needs Chromium 141 (the
revision pinned Playwright installs, 1194).

## Use it in your own backend

1. Copy the files listed in the packed tarball's `dist/asset-manifest.json` to their manifest
   `path` inside a bundle directory. `run_pdf_check.py` shows this (`support.stage_assets`); the
   original frontend repository is not needed.
2. Add `index.html`, `bootstrap.js` and `report.css` from `bundle/`, and a `charts.json` of
   `[{ "spec": {...}, "namespace": "..." }]`.
3. Post the bundle:

```sh
DRAVENPDF_API_KEY=... uv run python client.py --url http://127.0.0.1:8000 \
    --charts charts.json --out report.pdf --bundle-dir ./bundle
```

`client.render_bundle(url, api_key, bundle_dir, options)` is a multipart `POST /v1/render/bundle`:
each file's bundle path is its filename, `options` is a JSON field, and the key goes in
`X-API-Key`. It raises unless `X-DravenPdf-Resource-Errors` and `X-DravenPdf-Page-Errors` are both
`0`. If the HTTP service cannot run, `library_fallback.py` renders the same bundle through the
DravenPDF Python library (`Renderer.from_html(html, options, assets=...)`).

## How the bundle works

- `bootstrap.js` fetches `charts.json`, calls `DravenViz.mountCharts`, awaits `handle.ready`,
  renders each equivalent data table with `DravenViz.renderDataTable`, then sets
  `window.__DRAVENPDF_READY__ = true`. A rejection is left uncaught (a page error) and the flag is
  never set. The flag belongs to this integration, not to the renderer.
- DravenViz draws 680 x 320 logical units. `bootstrap.js` passes `fit: 'width'`, which scales each
  chart to its container's width (here the 178 mm frame) with the aspect ratio kept; the logical
  layout and the SVG `viewBox` do not change. The rules live in `dravenviz.css`
  (`.dravenviz-root[data-dv-fit="width"]`), so the report stylesheet needs no renderer class names.
- Instrumentation for the PDF checks lives only here (never in the library): every chart is wrapped
  in `<a class="dv-frame" href="#dvt-<ns>">`, whose box is exactly the SVG, each data-table caption
  ends with a 1 pt `DVT<ns>` token (the link target), and each frame holds two 1 pt corner tokens
  `DVF<ns>TL` and `DVF<ns>BR`. All three are white text; every text check ignores `^DV[FT]`.

## Finding a chart's frame in the PDF

`probe_frames.py` renders `probe/` (7 instances on 3 pages, captions in reverse order, a magenta
ground-truth outline per frame) and measures two methods. The results, the chosen method and the
numbers are in `docs/plans/slice-1-pdf-probe-results.md`; `frame_calibration.json` holds the
constants. `run_pdf_check.py` refuses to run unless that file names a proven method. Re-run it after
changing the report layout, the page margin or the DravenPDF commit:

```sh
pnpm pack:local && cd examples/dravenpdf && uv run python probe_frames.py
```

## Things worth knowing

- Chromium writes a named destination shifted by the page margin; the probe measures the shift and
  the driver applies it only to identify which instance a link belongs to. The frame rectangle is
  the link rectangle itself.
- Negative checks run through the same path as the report. Over HTTP a missing font is
  `504 render_timeout` and a missing stylesheet `422 render_incomplete`. If `dravenpdf serve` cannot
  start, the report and the same negative checks go through the Python API (`path: "library"`):
  `RenderTimeoutError` and `IncompleteRenderError`. A run never reports `PASS` without them.
- Retry rule for those renders: a render that returns a PDF where it must fail fails the check at
  once; otherwise at most one retry, and only after a different error code than expected. The
  attempt count of every DravenPDF check is in `report-slice1.json`.
- DravenPDF checks page errors only after the ready-flag wait and does not log them when that wait
  times out, so the server log cannot show the missing-font page error. The driver proves it in a
  browser instead (the bootstrap throws, the flag is never set).
- The driver's retry and fallback logic has unit tests (`test_driver.py`, no Chromium), run first by
  `pnpm test:pdf`, or alone: `uv run --project examples/dravenpdf python -m unittest discover -s examples/dravenpdf -p 'test_*.py'`.
- Link identity (ruling R35): a link is tied to its instance through the measured constant page-margin
  offset between destination and token. `report-slice1.json` records, per instance, the residual
  (`identity.residualPt`) and the next-nearest token (`identity.runnerUpPt`).
- The strict options (`fail_on_resource_errors`, `fail_on_page_errors`) fail a render whose page
  threw only when the page still sets the ready flag. A page that never sets it (the font-404 case)
  ends in `504 render_timeout`, which is what `test:pdf` asserts for a missing font.
- Cold Chromium launches have stalled for a whole render budget in sandboxed environments, so the
  driver warms the server up and retries a timed-out render once; the attempts are in the evidence.
