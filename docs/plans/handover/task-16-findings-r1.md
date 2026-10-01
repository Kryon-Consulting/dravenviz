# Task 16 — fix round 1 (rulings R35–R37)

## Important 1 — the missing-font retry can turn a real failure into a pass (run_pdf_check.py:544-557)
Fix:
- If render_bundle returns bytes on ANY attempt, fail immediately with no retry.
- Retry at most once, and only when the first attempt failed with a different error code than expected.
- Assert directly that no bytes were returned. Remove the vacuous `written.exists()` condition.
- Record the attempt count as a structured field.

## Important 2 — the library-fallback path skips the negative checks but can still report PASS (run_pdf_check.py:636-653)
Fix: on the library path, run the missing-font and missing-stylesheet cases through DravenPDF's Python API:
- missing font → RenderTimeoutError
- missing stylesheet → IncompleteRenderError

Confirm the exception names in the source. If that isn't feasible, add those checks with status None so the run exits 4. Never PASS without them.
Test (simulation): force ServerStartError and show that the run either executes the negative checks or exits 4.

## Important 3 — the example depends on a Recharts DOM class (bundle/report.css `.recharts-wrapper{…!important}`) — Ruling R37
Library change:
- MountOptions gains `fit?: "fixed" | "width"` (default "fixed").
- "width" scales each chart to its container's width while preserving the aspect ratio. Implement it with rules in src/styles/dravenviz.css scoped on DravenViz attributes, e.g. `.dravenviz-root[data-dv-fit="width"]`. Use only DravenViz-owned elements and attributes; never Recharts class names. If Recharts' wrapper div needs sizing, set it through DravenViz-owned markup and props, not by CSS class.
- Logical layout and viewBox stay unchanged, and verifyCommitted still passes.
- Validate the option: an invalid value gives INVALID_OPTIONS.
- Add a browser test: a fit:"width" chart in a 178mm-wide container renders at that width with its aspect preserved, the plot geometry scales proportionally, and readiness is OK.
- Update the example bootstrap to pass fit:"width" and remove the .recharts-wrapper override from report.css. Re-run test:pdf and regenerate the evidence.
- Update docs/design.md §9 MountOptions with the new field (one line plus a comment).

## Minors (include)
- Record per-check `attempts` for the control and stylesheet renders too.
- Write each instance's identity residual and runner-up distance to report-slice1.json (R35).
- If DravenPDF logs page errors server-side, assert that the missing-font render's log shows the page error. This distinguishes it from a Chromium stall. If DravenPDF doesn't log them, say so.
- Create tests/visual/MISMATCHES.md now with an entry for the plain 150 dpi crop mismatch (2.3 %, above the 1 % cap): sub-pixel phase between Skia and PDFium, resolved by 2× supersampled box-filtered crops at the same physical scale.
- examples/dravenpdf/README.md: document the R2 "method none" branch and exit codes 0, 1, 3 and 4.

Run: pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser && pnpm test:pdf
