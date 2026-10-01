# Follow-up F1 — font family collision with host pages; live text-property isolation

Context: found during the Task 13 re-review. Reviewer probes: /tmp/claude-0/-home-user-dravenviz/75ef0d62-97d4-5a21-a130-622a93c18315/scratchpad/rv/t13e.rv.ts and t13f.rv.ts (run: pnpm exec playwright test -c <that dir>/rv.config.ts).

## Part 1 — a host @font-face "Noto Sans" breaks DravenViz font loading
A host page with its own `@font-face { font-family: "Noto Sans"; src: url(...) }` (common: Google Fonts, design systems) makes both mountCharts and export fail with FONT_LOAD_FAILED ("loaded but 'Noto Sans' 400 is not registered with the page").

1. Diagnose first. Find why verification fails when another FontFace of the same family exists, record it in the report, and add a RED test reproducing it.
2. Fix it so DravenViz charts work on such pages AND measure/render with DravenViz's own bytes (the hashes in PROVENANCE), not the host's face of the same name.
   - Ruling R32: DravenViz registers its faces under a collision-proof internal family name. Default fonts use "DravenViz Noto Sans". Caller fonts use "DravenViz <family> <short-hash>" or another unique, deterministic scheme.
   - Live charts and exports reference that internal name first, then the declared family, then sans-serif, e.g. font-family="DravenViz Noto Sans, Noto Sans, sans-serif".
   - The exported @font-face declares the internal name, so standalone files stay self-consistent.
   - ResolvedFontSet keeps `family` as the declared name for display/manifest, plus a new `cssFamily` (internal) used for rendering, measurement (canvas measurer) and export.
   - Update the existing tests that assert `font-family="Test Serif, sans-serif"` / `document.fonts.check('13px "Noto Sans"')` to the new scheme. If you find a cleaner fix that keeps the plain family name working, describe it and use it instead — the requirement is: works beside a host face of the same name, always uses DravenViz's bytes, deterministic export.
3. Test: page with host @font-face "Noto Sans" pointing at a different font file (e.g. tests/assets/fonts/NotoSerif-Regular.woff2 served under that family name). mountCharts resolves; measured text widths equal those on a clean page (±0.5); export byte-identical to a clean-page export.

## Part 2 — live-chart text-property isolation
The following host rules move live-chart text boxes, while export stays identical:
- text{alignment-baseline:hanging}
- baseline-shift:10px
- writing-mode:vertical-rl
- font-variant:small-caps
- font-feature-settings:"smcp"
- text-transform:uppercase
- word-spacing:20px
- font-kerning:none

Fix: DravenViz-drawn text (including Recharts tick text through DravenViz tick renderers) sets these inline to neutral values: alignment-baseline:auto, baseline-shift:0, writing-mode:horizontal-tb, font-variant:normal, font-feature-settings:normal, text-transform:none, word-spacing:normal, font-kerning:auto. Do this in src/render/primitives/style.ts (the shared text style).
Export: only add a property to the materialized list if it is needed for standalone equivalence. Explain which ones you added and why; keep export byte-identity tests green.
Test: each rule above leaves all live text boxes unchanged (±0.5).

## Done when
- RED recorded for both parts.
- pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser pass.
- One commit: "fix(render): collision-proof font family and full text-property isolation", with the trailer from context.md. Do not push.
- Report written to /home/user/dravenviz/.superpowers/sdd/2026-09-30-slice-1-line-vertical-slice/followup-f1-report.md.
