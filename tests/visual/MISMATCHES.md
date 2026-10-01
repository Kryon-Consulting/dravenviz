# Cross-path mismatches

Design section 16.2: a cross-path difference above 1 % is investigated and recorded here, never
absorbed by a tolerance. Each entry names the cause, what resolved it, and the value after.

## M1. PDF crop vs browser render at plain 150 dpi (Task 16)

- **Pair:** each chart frame of `evidence/pdf/report-slice1.pdf` (PDFium raster) against the browser
  print-theme render of the same fixture at the same physical size (178 mm wide).
- **Observed:** 2.3 % of pixels differ (pixelmatch threshold 0.1) when both are rasterized
  directly at 150 dpi, above the 1 % cap.
- **Cause:** sub-pixel phase. Skia (Chromium) and PDFium place glyph and stroke edges at different
  sub-pixel offsets and anti-alias them differently; the content is identical, the pixels that
  carry anti-aliasing differ.
- **Resolution:** both sides are rendered at 2x supersampling (300 dpi equivalent) at the same
  physical scale, with the frame's top-left at pixel (0, 0), and box-filtered down to 150 dpi
  (`SUPERSAMPLE` in `tests/pdf/compare.ts` and `run_pdf_check.py`). The tolerance was not widened.
- **After:** worst instance 0.263 % (`evidence/pdf/report-slice1.json`, `mismatchRatio`), below the
  1 % cap.
