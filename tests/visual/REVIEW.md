# Visual review (slice 1)

Design D4: a visual baseline is accepted only by the owner, in PR review. Every candidate below is
`pending`; nothing is self-approved. `baselines/approved/` holds approved PNGs and is empty until the
owner approves. `visual.spec.ts` compares against `baselines/approved/` only, so each unapproved
candidate fails with `pending owner review` (CI stays red until approval).

- Review page (one self-contained file): `evidence/visual/index.html`, rebuilt by `pnpm visual:candidates`.
- Tolerances: calibrated by `pnpm visual:calibrate` into `tests/visual/tolerances.json` (the one source
  read by `visual.spec.ts` and `tests/pdf/compare.ts`).
- To approve a candidate: set its **Decision** to `approved by <owner> on <date>` and move
  `baselines/candidates/<id>.png` to `baselines/approved/<id>.png` in a commit that cites the review.

<!-- calibration:begin -->

## Calibration (design 16.2)

Produced by `pnpm visual:calibrate` (10 renders per comparison type; the numbers live in `tests/visual/tolerances.json`).
pixelmatch `threshold` 0.1, `includeAA: false`. Browser PNGs at 2x device scale; PDF crops at 150 dpi with 2x supersampling box-filtered down (`tests/pdf/compare.ts`). Chromium 141.0.7390.37.

| comparison type                       | rule                  | pairs | max observed | worst pair                               | allowed ratio |
| ------------------------------------- | --------------------- | ----: | -----------: | ---------------------------------------- | ------------: |
| Same-path: browser vs browser         | max + 0.05 pp         |   140 |      0.000 % | line-category-labels-thin@print runs 9/0 |       0.050 % |
| Same-path: PDF crop vs PDF crop       | max + 0.05 pp         |    80 |      0.000 % | wf-b.png runs 9/0                        |       0.050 % |
| Cross-path: standalone SVG vs browser | max + 0.1 pp, cap 1 % |   140 |      0.043 % | line-category-labels-rotate@print run 9  |       0.143 % |
| Cross-path: rasterized PDF vs browser | max + 0.1 pp, cap 1 % |    80 |      0.263 % | wf-b run 9                               |       0.363 % |

Every cross-path allowance is within the 1 % cap.
<!-- calibration:end -->

<!-- candidates:begin -->

## Environment and provenance (all candidates)

- Recharts 3.10.1, React 19.3.0, Chromium 141.0.7390.37
- DravenPDF commit `7a249e0`; rasterizer pypdfium2 5.13.0 at 150 dpi (2x supersampled, box-filtered)
- Font hashes (SHA-256):
  - `NotoSans-Regular.woff2 23a8c28d5ffb5e4f4545de7655fb34bdab36872938a712ec9d874c5ad9a2d02e`
  - `NotoSans-SemiBold.woff2 6e31729e067bc35e3ec767012a52e6b389866317f1d0a1d8311bedfd8e57eb27`

## Notes for the owner

Nothing below is approved. Look at these on `evidence/visual/index.html` (one page, candidate ids as anchors):

- **R29, half-clipped stroke at a fit-domain plot edge.** A stroke or marker whose value is the extreme of the plot domain can be half cut by the plot boundary. line-weekly-flow was checked as well: include-zero domain, no value on an edge, so not flagged. Candidates: `line-measured-zero@print`, `line-estimated-monotone@light`, `line-estimated-monotone@print`, `line-category-labels-wrap@print`, `line-category-labels-rotate@print`, `line-category-labels-thin@print`.
- **Actual vs estimated dash patterns in grayscale.** Print theme only: `line-estimated-monotone@print`. Check the solid and estimated patterns stay distinguishable without colour.
- **R28, legend quality-meaning text length.** The legend draws each quality's meaning after its label. Candidates: `line-weekly-flow@light`, `line-weekly-flow@dark`, `line-weekly-flow@print`, `line-estimated-monotone@light`, `line-estimated-monotone@print`.

## Candidates (decision: `pending | approved by <owner> on <date> | changes requested`)

### line-weekly-flow@light

- **Decision:** `pending`
- **Fixture ID:** `line-weekly-flow`
- **Spec hash (canonical SHA-256):** `47b9564729ebaa2cc3850d99092d4f13102fa9ce9aa110b9822af81ce3e3c8a5`
- **Theme:** light, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-weekly-flow@light.png` (62175 bytes); standalone SVG `evidence/visual/svg/line-weekly-flow@light.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser and SVG only (the PDF report is print theme only). No intentional content differences.
- **Owner attention:** R28 (Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?)

### line-weekly-flow@dark

- **Decision:** `pending`
- **Fixture ID:** `line-weekly-flow`
- **Spec hash (canonical SHA-256):** `47b9564729ebaa2cc3850d99092d4f13102fa9ce9aa110b9822af81ce3e3c8a5`
- **Theme:** dark, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-weekly-flow@dark.png` (66230 bytes); standalone SVG `evidence/visual/svg/line-weekly-flow@dark.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser and SVG only (the PDF report is print theme only). No intentional content differences.
- **Owner attention:** R28 (Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?)

### line-weekly-flow@print

- **Decision:** `pending`
- **Fixture ID:** `line-weekly-flow`
- **Spec hash (canonical SHA-256):** `47b9564729ebaa2cc3850d99092d4f13102fa9ce9aa110b9822af81ce3e3c8a5`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-weekly-flow@print.png` (65529 bytes); standalone SVG `evidence/visual/svg/line-weekly-flow@print.svg`
- **PDF crop:** `evidence/pdf/crops/wf-a.png`, `evidence/pdf/crops/wf-b.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R28 (Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?)

### line-thinned-annotation@print

- **Decision:** `pending`
- **Fixture ID:** `line-thinned-annotation`
- **Spec hash (canonical SHA-256):** `1e69f27acd11e3dfbcf04dd9a4ea2d2dd29fbd6edf5f3f073f57d28c4317b8c7`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-thinned-annotation@print.png` (69501 bytes); standalone SVG `evidence/visual/svg/line-thinned-annotation@print.svg`
- **PDF crop:** `evidence/pdf/crops/ta.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.

### line-singleton@print

- **Decision:** `pending`
- **Fixture ID:** `line-singleton`
- **Spec hash (canonical SHA-256):** `662f42c6791b6417b4def89d22e0059058794f25f6342922f4cabdbbaaa17f59`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-singleton@print.png` (20269 bytes); standalone SVG `evidence/visual/svg/line-singleton@print.svg`
- **PDF crop:** `evidence/pdf/crops/sg.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.

### line-all-equal@print

- **Decision:** `pending`
- **Fixture ID:** `line-all-equal`
- **Spec hash (canonical SHA-256):** `e929d1a0c1947a896121541b192bdb90e9b6878865f6186328771acba70dbf1c`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-all-equal@print.png` (19187 bytes); standalone SVG `evidence/visual/svg/line-all-equal@print.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.

### line-measured-zero@print

- **Decision:** `pending`
- **Fixture ID:** `line-measured-zero`
- **Spec hash (canonical SHA-256):** `6fc365fcdbd368009f1809ffc0eaa2822ba4683cc358e0ffff5ec3c4f5fd6237`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-measured-zero@print.png` (21058 bytes); standalone SVG `evidence/visual/svg/line-measured-zero@print.svg`
- **PDF crop:** `evidence/pdf/crops/mz.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.)

### line-all-missing@print

- **Decision:** `pending`
- **Fixture ID:** `line-all-missing`
- **Spec hash (canonical SHA-256):** `adbd25edabea69eb8e30cf2d76c6ec43e9c045f74b43d67347d9a549632cd853`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-all-missing@print.png` (25348 bytes); standalone SVG `evidence/visual/svg/line-all-missing@print.svg`
- **PDF crop:** `evidence/pdf/crops/am.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.

### line-fixed-domain-clipped@print

- **Decision:** `pending`
- **Fixture ID:** `line-fixed-domain-clipped`
- **Spec hash (canonical SHA-256):** `9a55c2fa566125d9a105ad0bb08694af0840267bbcf26acdd882777e2aa30106`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-fixed-domain-clipped@print.png` (65925 bytes); standalone SVG `evidence/visual/svg/line-fixed-domain-clipped@print.svg`
- **PDF crop:** `evidence/pdf/crops/fc.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.

### line-estimated-monotone@light

- **Decision:** `pending`
- **Fixture ID:** `line-estimated-monotone`
- **Spec hash (canonical SHA-256):** `b341de8561b534ac48803edd923806eaa24ad80b83f282ffe195a8c23e84be09`
- **Theme:** light, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-estimated-monotone@light.png` (42106 bytes); standalone SVG `evidence/visual/svg/line-estimated-monotone@light.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser and SVG only (the PDF report is print theme only). No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.) R28 (Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?)

### line-estimated-monotone@print

- **Decision:** `pending`
- **Fixture ID:** `line-estimated-monotone`
- **Spec hash (canonical SHA-256):** `b341de8561b534ac48803edd923806eaa24ad80b83f282ffe195a8c23e84be09`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-estimated-monotone@print.png` (44797 bytes); standalone SVG `evidence/visual/svg/line-estimated-monotone@print.svg`
- **PDF crop:** `evidence/pdf/crops/em.png`
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.) DASH (Actual vs estimated dash patterns: in grayscale, are the solid and the estimated (dashed) segments still easy to tell apart? Compare with the PDF crop.) R28 (Legend quality text: the legend draws each quality meaning after its label. Is the text length acceptable, and does it wrap or crowd the legend?)

### line-category-labels-wrap@print

- **Decision:** `pending`
- **Fixture ID:** `line-category-labels-wrap`
- **Spec hash (canonical SHA-256):** `f2a5089266257aee2b4f9dbe11ad95afbba0237795336ebbbc046e73b9373a7b`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-category-labels-wrap@print.png` (54019 bytes); standalone SVG `evidence/visual/svg/line-category-labels-wrap@print.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.)

### line-category-labels-rotate@print

- **Decision:** `pending`
- **Fixture ID:** `line-category-labels-rotate`
- **Spec hash (canonical SHA-256):** `75d092fe06936d86e3c0e9069af6d6645ad4f6b865b3871bc217496a523c6efb`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-category-labels-rotate@print.png` (130015 bytes); standalone SVG `evidence/visual/svg/line-category-labels-rotate@print.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.)

### line-category-labels-thin@print

- **Decision:** `pending`
- **Fixture ID:** `line-category-labels-thin`
- **Spec hash (canonical SHA-256):** `f6379605a2d8e8c1c53b96b032420871723a4cb6b0dcba5ddc79553bc89689a6`
- **Theme:** print, theme version 1.0.0
- **Dimensions:** 680 x 320 logical units; PNG 1360 x 640 (2x)
- **Candidate PNG:** `tests/visual/baselines/candidates/line-category-labels-thin@print.png` (153058 bytes); standalone SVG `evidence/visual/svg/line-category-labels-thin@print.svg`
- **PDF crop:** none (not in report-slice1 or not print theme)
- **Intentional mode differences:** Browser: live chart. SVG: fonts embedded so it renders as an image. PDF: Chromium print through DravenPDF, rasterized by PDFium; differences are rasterizer anti-aliasing only. No intentional content differences.
- **Owner attention:** R29 (A measured value sits exactly on the edge of the plot domain (fit or clip), so its stroke or marker can be half-clipped by the plot boundary. Look at the lowest and highest points.)

<!-- candidates:end -->
