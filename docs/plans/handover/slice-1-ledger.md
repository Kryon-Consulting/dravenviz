# SDD ledger — plan: docs/plans/2026-09-30-slice-1-line-vertical-slice.md

Spec: docs/spec.md (binding). Design: docs/design.md rev 4. Start commit: c2ac690.
Owner instructions (2026-09-30): execute ALL FOUR slices; NO stops at plan gates — rule on everything and record rulings.

## Pre-flight scan

| Tasks | Shared file / interface | Finding |
|---|---|---|
| 1→13 | `spikes/recharts-3.10/attribute-inventory.json` → `recharts-metadata.ts` | consistent |
| 1→design §4 | spike failure → fallback | owner gate; see Ruling R2 |
| 2→all | package.json scripts/exports; placeholders fail loudly | consistent |
| 2→11,15 | Vite / react18 aliases not in Task 2 dev-dep list | added by owning tasks; consistent |
| 3→10 | `NOTO_METRICS` → `notoMeasurer` | consistent |
| 3→11,13 | PROVENANCE hashes → font registry / embedded test | consistent |
| 4→5 | `schemaValidate` → `validateSpec` | consistent |
| 5→12 | Task 12 test uses fixture `invalid-unknown-field` (path `/colour`); Task 5 names invalid fixtures `<rule>.json` | gap → Ruling R3 |
| 5→6 | `parseTimeValue` throws InvalidSpecError (Task 6) but Task 5 needs `invalid-time`/`time-without-offset` rules | ordering → Ruling R4 |
| 6→9 | format fns → model | consistent |
| 7→9,10 | Theme / effectivePt | consistent (17/13/11 → 12.6/9.6/8.2 pt at 680 units) |
| 8→9,10,12,16 | fixture ids + `report-slice1` | consistent |
| 9 self | weekly-flow: o1 isolated, o3 marker-only, o4 isolated; c4 lagging ringed | consistent with §5.2 |
| 9 self | estimated f4,f5 → range [f3,f6] | consistent |
| 10 self | fontScale @1200 ≈ 1.73 (caption-driven) | arithmetic checked: ok |
| 11→12,13,14 | fontRegistry / harness `window.__h` | consistent |
| 12→13,14 | ChartView, verifyCommitted, lifecycle registry, counts() | consistent |
| 14 self | keyboard test "ArrowRight ×2 → o3" ambiguous start state | Ruling R5 |
| 15→16,17,18 | pack tarball, asset-manifest, stage-consumer | consistent |
| 16 | Part A probe gate "stop and ask owner" | Ruling R2 |
| 17 | milestone "stop and report to owner" | Ruling R2 |
| 19 | baselines need owner approval; visual.spec fails while pending | Ruling R6 |
| 20 | P1 miss → owner exception | Ruling R7 |
| plan header | cites "design.md (revision 2)"; design is revision 4 | Ruling R1 |

## Rulings

- Ruling R1: Plan header's "revision 2" is stale; design revision 4 is authoritative wherever plan text is silent — the plan was revised alongside rev 3/4 — cost if wrong: none material.
- Ruling R2: Owner gates (spike failure, PDF probe failure, Task-17 milestone) do not stop execution: owner instructed "no stops". Spike failure → apply §4 fallback and record it in design §4; probe failure → record and continue with the best measured method, marking PDF crop checks unverified; milestone → write the report into the ledger and continue — cost if wrong: rework of a fallback the owner would have rejected.
- Ruling R3: Task 5 also creates the design §15 item-9 invalid fixtures (`invalid-infinite-value`, `invalid-string-number`, `invalid-unknown-field` with top-level `"colour"` → path `/colour`, `invalid-bar-domain`, `invalid-percent-negative`) — Task 12 depends on them — cost if wrong: none.
- Ruling R4: Task 5 implements a minimal strict ISO parse for the `invalid-time`/`time-without-offset` semantic rules inside core; Task 6 then moves it to `core/format/time.ts` as `parseTimeValue` and validation reuses it — avoids a forward dependency — cost if wrong: small refactor.
- Ruling R5: Keyboard nav: focusing the chart root selects no datum; the first arrow press focuses the first navigable datum; navigation visits only datums with a value (null/gap points are skipped). So focus → Right → o1, Right → o3 — matches the plan's test — cost if wrong: small behavior change.
- Ruling R6: Visual baselines stay `pending owner review` (D4 forbids self-approval even with "no stops"); visual tests fail in CI until the owner approves. Slices 2–4 proceed anyway — cost if wrong: none (owner approval is purely additive).
- Ruling R7: If P1 p95 misses 250 ms, investigate and record in evidence/perf; no self-granted exception; continue — cost if wrong: perf work deferred.

## Progress
- Owner instruction (mid-run): implementers use Sonnet 5.5 (`sonnet`), reviewers use Opus 5.5 (`opus`). Applies to every task, fix round and re-review; supersedes SDD model-selection defaults. Fix rounds 4–5 escalation ruling: stay on Sonnet (owner pinned implementer model) — cost if wrong: slower convergence on hard tasks.
- Task 1: first dispatch (Opus) stopped per owner model instruction; partial untracked spikes/ left for the Sonnet re-dispatch to review or discard.
- Task 1: implementer DONE_WITH_CONCERNS (c6546f1, pushed). All 6 spike points pass, deltas 0 → no §4 fallback. Carry-forward facts: hooks useXAxisScale/useYAxisScale/usePlotArea/useXAxisDomain/useYAxisDomain; band centres need scale option {position:'middle'}; Recharts ids contain "recharts" (id rewrite mandatory, Task 13); bars emit name="undefined"; normalizer metadata adds k, radius, angle; negative bars have negative rect heights; tick labels in sibling layer. Untested: partial-null stacked areas, multiple data sizes (→ slice 2 plan).
- Task 1: review dispatched (opus) on c2ac690..c6546f1.
- Task 1: review → Needs fixes. Important: export normalizer catch-all strips unknown attrs (allowlist vacuous; inventory classify defaults to metadata). 6 minors (raw SVG child, area x positions, point-4 assertions, dup test-6 flag, global-setup rewrites tracked files, overlay attrs in inventory) — cheap, included in fix round 1 rather than deferred.
- Task 1: fix round 1/5 (6 addressed, 1 open — negative control injects after normalize, so it doesn't prove the strip step leaves unknown attrs; commits c6546f1..9c15bb0)
- Task 1: minor (deferred): classify() labels aria-*/data-dv-* as 'geometry' → Task 13 must give them their own class (passthrough). svg@role classified geometry.
- Task 1: fix round 2/5 (3 addressed, 0 open; commits 9c15bb0..2a5e143)
- Task 1: minor (deferred): results doc count line omits passthrough (0); passthrough prefix check duplicated in classify/attributeAllowed (spike only).
- Task 1: complete (commits c2ac690..2a5e143, review clean)
- Task 2: implementer DONE_WITH_CONCERNS (04ed400). Carry: wire `tsc -p tsconfig.core.json` (and build) into typecheck once src/core exists → Task 4 dispatch. Trailer stays "Claude Opus 5.5" per session attribution reminder (Ruling R8: subagent's own reminder differs; session-level attribution instruction governs — cost if wrong: cosmetic trailer).
- Task 2: Ruling R9: plan-mandated vacuous boundary tests (empty src) — Task 4 (first to create src/core) adds non-empty guards (listFiles('src/core').length>0, same for src) and wires `tsc -p tsconfig.core.json` + build tsconfig into typecheck — cost if wrong: none.
- Task 2: minor (deferred): grep regex in boundaries.test narrow (ESLint covers); no-restricted-imports misses dynamic import (fs-scan covers); CI install job is a gate only; core relative-path regex could false-flag future core/render subfolder.
- Task 2: complete (commits 2a5e143..04ed400, review clean; 1 plan-mandated item ruled R9)
- Task 3: review → Needs fixes. Important: Serif "tag commit" 1eee5de is the annotated tag object (commit is c4a321e) — plan-text error.
- Task 3: Ruling R10: plan's NotoSerif "tag commit 1eee5de…" is wrong (verified by ls-remote: tag object 1eee5de → commit c4a321e). Record both "tag object" and "commit" for each family; provenance must be true — cost if wrong: none.
- Task 3: minor (deferred): system unzip undeclared; zip written before hash check (removed in finally); mid-family failure leaves partial outputs; FontMetrics type duplicated (Task 10 TextMeasurer should import from src).
- Task 3: fix round 1/1 (1 addressed + optional minor, 0 open; commits a2c8a1f..075c541)
- Task 3: minor (deferred): test title 'provenance pins the tag, commit and source zip' slightly stale; plan text Task 3 still says Serif tag commit 1eee5de (controller to correct plan doc in end-of-slice doc batch).
- Task 3: complete (commits 04ed400..075c541, review clean)
- Task 4: implementer DONE (afe7c77). Carry to Task 15: tsconfig.build emit (rootDir, TS5011), copy ajv.gen.* to dist. Carry to Task 5: cross-field rules list in task-4-report.md incl. 10k points / 2500 cells.
- Task 4: review → Needs fixes. Important: (1) no discriminator → first error for non-cartesian specs / non-category axes / domains points at wrong branch (breaks §6 first-issue); (2) SpecBase hand-copied into 4 kinds, no drift guard. Minors 1–2 (SpecBase additionalProperties:false; lone surrogates) included in fix; Minor 3 (whitespace-only text) deferred to Task 5 consideration; Minor 4 resolved by (1).
- Task 4: fix round 1/5 (4 addressed, 0 open; commits afe7c77..0d6846c). Deviation accepted: discriminator needs only type:object in Ajv 8.20 (verified by probes).
- Task 4: minor (deferred→Task 5): unknown-kind test weak (assert keyword discriminator + tagValue; add missing-kind and kind:42 cases); map Ajv `discriminator` keyword to a clear message.
- Task 4: complete (commits 075c541..0d6846c, review clean)
- Ruling R11: whitespace-only text stays valid (§5 sets only length/control-char rules; §6 rule list has no such rule) — cost if wrong: an additive v1 rule later.
- Task 5: implementer DONE_WITH_CONCERNS (71bce94). Extra rule ids beyond §6 added; allowed-fields not listed in unknown-field messages.
- Task 5: review → Needs fixes: 5 Important (fixed/time x domain unchecked; default-limit overruns give INVALID_SPEC; percent/compact-stack w/o stackId skips rules; stack totals keyed by raw x string; mixed-x-types path order-dependent).
- Ruling R12: Schema maxItems on limit-backed arrays (series, categories on bar axes, slices, referenceLines, annotations, items) map to the limit rule ids with code LIMIT_EXCEEDED — §6 says protection limits use LIMIT_EXCEEDED — cost if wrong: error-code churn.
- Ruling R13: `compact-stack` requires every bar series to share one stackId (`preset-incompatible`). `stacking` declared while no series has a stackId → new rule `stacking-without-stack`. A stackId without `stacking` = absolute stacking (documented default) — cost if wrong: one rule relaxed later.
- Ruling R14: Mixing date-only and date-time values on one time axis stays an error (`mixed-x-types`): ticks need one formatting semantics (D15 formats dates in UTC, instants in the render timezone). Form is decided from series points first (first point), so the outlier is reported — cost if wrong: an additive relaxation.
- Task 5: minor (deferred → slice 3 plan): bubble size outside bubble.domain; annotation x2 < x. minor (deferred): toJSON vs structuredClone size mismatch; parseTimeValue empty path outside validation.
- Task 5: fix round 1/5 (8 addressed, 0 open; commits 71bce94..5bf877b)
- Task 5: minor (deferred): INVALID_SPEC headline can carry a limit rule (list non-limit issues first); /xAxis/categories maps to bar-categories even on non-bar charts; remapped limit message quotes schema cap not lowered limit; heatmap rows/columns maxItems stay schema errors.
- Task 5: complete (commits 0d6846c..5bf877b, review clean)
- Task 6: review → Needs fixes: percent /100 rounding drift (D16 fidelity); compact default 0 digits (1500→2K).
- Ruling R15: render timezone accepts any Intl-valid zone name except raw UTC-offset strings (e.g. "+05:00"), which are rejected as INVALID_OPTIONS ("IANA" in §9); years <1000 format unpadded — cost if wrong: minor option relaxation.
- Task 6: fix round 1/5 (6 addressed, 0 open; commits daebcfb..5bbf948)
- Task 6: minor (deferred): CJK quarter labels gain year suffix ("Q3 2026年") — take only the year part from formatToParts; signDisplay 'always' gives "+0%".
- Task 6: complete (commits 5bf877b..5bbf948, review clean)
- Ruling R16: accept src/core/theme/print-theme.ts (plan said print.ts) — ESLint core rule false-flags relative '/print' (Task 2 deferred minor 5); file name is not public contract — cost if wrong: a rename.
- Task 7: review → Needs fixes: sparse arrays bypass item validation. Minors 1–3 included in fix (pale slot colors <3:1 on white; roles DeepPartial typing; isPlain accepts Date/Map).
- Task 7: minor (deferred → slice 2 plan): slots 4–7 default patterns vs "solid fills by default"; decide when bars/areas land.
- Task 7: fix round 1/5 (4 addressed, 0 open; commits 26af240..76d1f95)
- Task 7: minor (deferred): unneeded as-any in theme.test.ts:150; light slots 0–3 only 0.029 apart in luminance (no requirement).
- Task 7: complete (commits 5bbf948..76d1f95, review clean)
- Task 8: minor (deferred): check-drift message says `pnpm gen` for perf file (add gen-fixtures to `gen`); line-thinned-annotation point ids a/b vs series open/closed; coverage-vocabulary test weak.
- Task 8: complete (commits 76d1f95..932b61e, review clean)
- Task 9: implementer DONE_WITH_CONCERNS (5f0c4f8).
- Ruling R17: marker.show "none" still draws marker-only points (else a measured value silently vanishes — spec "never silently drop") — cost if wrong: one marker.
- Ruling R18: clip notes print the axis-formatted value naturally ("100%", not "100 %"); brief test regex /above 100 .*clipped/ is relaxed to accept the formatted value (plan-text vs readable output; spec authority) — cost if wrong: test wording.
- Task 9: review → Needs fixes: nice ticks not Heckbert (fixed [0,100] → step 25; Task 12 asserts step 20); estimated points get filled quality markers.
- Ruling R19: nice ticks = classic Heckbert (1/2/5) first; 2.5 only as fallback when 4–6 / distinct labels can't be met; for fixed domains prefer candidates that label both ends. Task 12's "labels exactly 0,20,…,100" is read as tick VALUES 0..100 step 20; labels are the axis-formatted text ("0%"…"100%") — carry into Task 12 dispatch — cost if wrong: test wording.
- Ruling R20: `estimated` is not a marker quality (§5.2: dashed segments only). Estimated points get markers only via show:"all", isolated or marker-only — cost if wrong: re-add a marker variant.
- Ruling R21: ticks.values outside a fixed domain are a validation error (new rule `tick-outside-domain`, in core semantic rules) rather than silently filtered; `values: []` is rejected by the same rule family (`empty-tick-values`) — cost if wrong: a relaxed rule.
- Task 9: minor (deferred): legend quality strings hard-coded English (theme.strings has no slot; §7 contract — revisit with docs i18n); date point labels lack year for >1-year spans; Math.min spread on huge arrays.
- Task 9: design.md §6 rule list edited by implementer (tick-outside-domain, empty-tick-values) — kept; end-of-slice doc batch must also add stacking-without-stack, unknown-cell-ref, too-many-items, invalid-currency, invalid-format, reference-value-type, not-json, limit rule ids.
- Task 9: fix round 1/5 (7 addressed, 0 open; commits 5f0c4f8..7a4d4d5)
- Task 9: minor (deferred): scale.ts header comment describes old algorithm; segments.ts:71 long comment; test comment [10,35] vs [10,32]; half-hour DST zones give irregular hourly spacing.
- Task 9: complete (commits 932b61e..7a4d4d5, review clean)
- Task 10: implementer DONE_WITH_CONCERNS (f65455e). RED recorded after-the-fact.
- Ruling R22: a title needing >3 lines throws LAYOUT_ERROR naming "title" and the width needed — no ellipsis (spec: never silently hide critical text; §8 caps title at 3 lines) — cost if wrong: callers must widen or shorten titles.
- Ruling R23: layout boxes key axes by their real ids (x axis under xAxis.id, plus a typed accessor `boxes.xAxis`); design text "axes.x" means "the x axis". Validation duplicate-id must cover x vs y axis ids together — cost if wrong: small API rename before Task 12.
- Task 10: review → Needs fixes: R22 not met (ellipsis), R23 not met (literal axes['x']), y-axis title overflow, wide legend items unwrapped.
- Ruling R24: text larger than the §7 print range on narrow viewBoxes (e.g. title 21.4 pt at 400 units/178 mm) is accepted — the plan says layout never scales text down; the 12–14 pt title range is checked at the 680-unit reference width — cost if wrong: add an upper clamp later.
- Task 10: minor (deferred): two overlapping essential time ticks (unreachable below MIN_PLOT) — guard optional; rotated edge labels overhang x box horizontally (documented for Task 12).
- Task 10: fix round 1/5 (6 addressed, 1 open — y-title columns can exceed plot height (count-only stability check); commits f65455e..f942f34)
- Task 10: out-of-scope (pre-existing): label-rotate/thin fixtures at 1200×320 print 178 mm → LAYOUT_ERROR (plot too short after font scaling) — acceptable documented behaviour; note for docs troubleshooting. "Items (items)" wraps to 2 columns needlessly at 1200 interactive.
- Task 10: fix round 2/5 (5 addressed, 0 open; commits f942f34..a8805f1)
- Task 10: minor (deferred): extreme y titles report plot-minimum error instead of "too many columns"; reported plot height can come from the wide-column pass.
- Task 10: complete (commits 7a4d4d5..a8805f1, review clean)
- Task 11: review → Needs fixes: 4 Important (document.fonts.check vacuous in Chromium; aborted-entry race rejects fresh caller DISPOSED; one URL for both weights; cross-origin redirect followed).
- Ruling R25: font verification = the FontFace itself (status 'loaded', present in document.fonts with matching family+weight). design §9 step 2's `document.fonts.check()` is retained only as an extra guard — it is vacuous in Chromium (returns true for absent families/weights; measured) — cost if wrong: none; design §9 wording to be updated in the end-of-slice doc batch.
- Ruling R26: font fetches use `redirect: 'error'` (no redirects at all) — simplest way to honour §12 "no requests beyond those URLs" — cost if wrong: hosts that redirect fonts must serve them directly.
- Task 11: fix round 1/5 (10 addressed, 1 new Important — abort after acquiring a RESOLVED entry evicts the cached font → duplicate faces; commits 28b8c97..166c2f6)
- Task 11: fix round 2/5 (1 addressed, 0 open; commits 166c2f6..0137036)
- Task 11: minor (deferred): waiters can go negative after unsettled abort (harmless); theoretical window between loadOne resolve and settled=true.
- Task 11: complete (commits a8805f1..0137036, review clean)
- Task 12: implementer DONE_WITH_CONCERNS (b4cf7fa, 74627b3). Deviations: connectNulls=true with per-segment keys; browser RED via stub; legend quality meanings not drawn; annotation label overlap unresolved; fit domain half-clips first point stroke.
- Task 12: review → Needs fixes: host opacity restyles chart; legend meanings + table quality words missing (§5.2); concurrent-batch duplicate embedding; omitted category point bridged while table says missing. connectNulls=true deviation ACCEPTED (verified on real renders, all axis types).
- Ruling R27: a category with no point in a series is MISSING for that series (segment breaks there; table "Not measured") — global rule "missing points break lines"; model fix in buildSegments — cost if wrong: none (truthful default).
- Ruling R28: legend draws each quality's meaning text after its label (layout reserves width); table cells for non-measured qualities read "<value> (<Quality word>)" e.g. "18 (Partial)" — §5.2 — cost if wrong: wording.
- Ruling R29: fit-domain stroke half-clipped at plot edge is accepted for slice 1 and left to the owner's visual review (§5.2 fit = nice extent; Heckbert nice ends may coincide with data) — cost if wrong: add domain padding later.
- Task 12: minor (deferred): annotation label overlap (slice-3 seam); Recharts' own ids not namespaced (Task 13 export must rename); ChartView requires `theme` prop (tell Task 14).
- Task 12: fix round 1/5 (8 addressed, 0 open; commits 74627b3..5ce6391)
- Task 12: minor (deferred): host `circle{r:12px}` still enlarges markers (CSS r beats attribute) — consider inline r style; opacity test walk stops at svg; invisible host stroke changes on backdrop/text.
- Task 12: carry → Task 13: export must drop <g data-dv-style-guard>, expect inline opacity on every g/svg, rename Recharts' own ids (recharts1-clip etc.). carry → Task 13/14: counts().observers must also count MutationObservers.
- Task 12: complete (commits 0137036..5ce6391, review clean)
- Task 13: implementer DONE (a0e3a94). jsdom pinned 27.0.0 (30.x needs newer Node). design §10 got two notes.
- Ruling R30: export test asserts no `style` ATTRIBUTE via /(^|\s)style="/ (brief's /style="/ also matches required font-style="normal") — cost if wrong: none.
- Task 13: review → Needs fixes: host CSS leaks into export bytes (visibly via dominant-baseline); unknown data-* stripped silently; pre-existing <style> survives.
- Ruling R31: export isolation = (1) the offscreen export mount renders inside a shadow root whose host has `all: initial` (host stylesheets can't match inside; inherited props reset), (2) the export root always carries fixed chart-defined values for every inherited materialized property (from the resolved theme/font, never from computed host values), (3) DravenViz text sets `dominant-baseline` inline (live + export). Exported bytes must be identical under hostile host CSS vs a clean page. If shadow DOM breaks font application or Recharts, fall back to (2)+(3) and report — cost if wrong: shadow-root fallback work.
- Task 13: minor (deferred): unused clipPath and ~20 empty Recharts <g/> layers in export (dead output); pixel-equivalence covers one fixture.
- Task 13: fix round 1/5 (3 addressed, 0 open; commits a0e3a94..ecc7a20). Shadow-root export isolation worked.
- Task 13: complete (commits 5ce6391..ecc7a20, review clean)
- Task 13: minor (deferred): rootStyle inserted under CartesianChart's JSDoc; data-dv-* passthrough by design; counts().svgs can't see shadow-root svgs.
- Follow-up F1 (load-bearing, found in Task 13 re-review): a host page @font-face "Noto Sans" makes loadFonts fail FONT_LOAD_FAILED ("not registered"). Many host apps load Noto Sans → must fix before examples (Task 15). Plus live-chart text-property leaks (alignment-baseline, baseline-shift, writing-mode, font-variant, font-feature-settings, text-transform, word-spacing, font-kerning) move live text away from measured layout → add inline resets. Dispatched to Task 11 implementer as follow-up, reviewed like a task.
- F1: complete (commits ecc7a20..2467009, review clean, approved first pass)
- F1: minor (deferred): verification error names declared family not internal (misleading when a host face takes "DravenViz Noto Sans"); partial decode failure leaves orphan sibling face; abort listeners not removed per loadFonts call; __resetRegisteredFaces unused by harness reset; host-collision spec covers only unloaded state (+ unit test BUNDLED_SHA256 == PROVENANCE).
- Task 14: implementer DONE (c250b60 refactor shared pipeline, 53ae252 Chart). Concern: two React roots may share default useId namespace.
- Task 14: review → Needs fixes: readiness counts frames from setState not commit (second root → permanent RENDER_FAILED); default namespace collides across hydrated/mixed roots (lowercasing merges _R_/_r_; islands share tree ids) → estimated dashes silently drawn solid; ZERO_SIZE never produced, hidden host reports ready. Print refactor verified unchanged.
- Ruling R33: default React namespace = "dv-" + short stable hash of the case-preserved useId (deterministic across SSR/hydration, always matches the pattern, keeps identifierPrefix distinctions). Before committing, <Chart> checks the document for an existing [data-dravenviz-ns][data-dravenviz-chart] pair owned by another instance; a collision is reported loudly (error panel + onError INVALID_OPTIONS duplicate-chart-embedding, message advising the `namespace` prop or React `identifierPrefix`) — never silent. Docs (Task 17) document identifierPrefix for multi-root pages — cost if wrong: some multi-island pages must pass `namespace`.
- Task 14: fix round 1/5 (3 Important + minors addressed, 0 open; commits 53ae252..f144182)
- Task 14: minor (deferred): duplicate-state chart doesn't auto-recover when other instance unmounts (document on `namespace` prop/error message — Task 17 docs); render-time throw keeps its claim until next render; possible second onError after render-time throw.
- Task 14: complete (commits 2467009..f144182, review clean)
- Task 15: implementer DONE (9d3f44a, ebb744d, 095adac). Bundle 822,000 B raw / 219,426 B gzip. Concern: pnpm test now needs dist/.pack + registry.
- Task 15: review → Needs fixes: dist/stage tests inside default `pnpm test` (breaks §16 contract, needs build+network); `pnpm stage html` creates an empty stage yet succeeds.
- Ruling R34: `pnpm test` = Node unit only (no build/network). Tests needing dist/.pack/registry go in a vitest project `dist`, run by `pnpm test:dist` (= pack:local && vitest run --project dist); CI package job runs it — cost if wrong: script rename.
- Task 15: minor (deferred): README must not claim React example proves runtime (Task 18 does); self-reference core import accepted.
- Task 15: fix round 1/5 (8 addressed, 0 open; commits 095adac..5d6b5f2)
- Task 15: minor (deferred): bare `pnpm vitest run` still includes dist project; staged host-isolation.html lacks react18 UMD files (only works in Playwright temp dir); stageStatic emptiness check is count-based.
- Task 15: complete (commits f144182..5d6b5f2, review clean)
- Task 16: implementer DONE (36fe473, da49e36, 3525acc). test:pdf PASS (27 checks), PDF 84,748 B / 6 pages, link-dest frames (≤0.18pt). Judgment calls: identity via measured margin offset; missing font → 504 timeout (not 422); retry on 504; 2x supersampled crops; exit 4 = probe-unverified.
- Task 16: review → Needs fixes: missing-font retry can turn a returned PDF into pass; library-fallback path skips negative checks yet can PASS.
- Ruling R35: link-dest identity resolved via the measured constant page-margin offset (residual ≤0.72 pt vs runner-up ≥342 pt) is accepted in place of the brief's literal "nearest token ≤2 pt"; evidence must record residual + runner-up per instance — cost if wrong: identity audit gap.
- Ruling R36: missing font asserts DravenPDF 504 render_timeout (its renderer checks page errors only after the ready wait; bootstrap does raise a pageerror) — design §13/brief text "422 render_incomplete" updated in end-of-slice doc batch — cost if wrong: none.
- Ruling R37: the example's `.recharts-wrapper{width:100%!important}` override depends on a Recharts DOM class (spec forbids consumers relying on renderer class names) → library gains MountOptions `fit?: "fixed" | "width"` (default "fixed"); "width" scales the chart to its container width preserving aspect ratio via `.dravenviz-root[data-dv-fit="width"]` rules in dravenviz.css and DravenViz-owned elements only; logical layout unchanged. Example uses fit:"width". design §9 MountOptions updated — cost if wrong: an additive option.
- Task 16 notes (not bugs, verified vs design): weekly-flow Opened has no segment o3–o4 (marker-only breaks membership — correct); Forecast May→Jun dashed (estimated range extends to the point after — §5.2). Actual vs estimated dashes close in grayscale → owner visual review (Task 19).
- HANDOVER (2026-10-01): owner requested handover to a fresh agent. Task 16 fix-round implementer stopped; partial R37 work saved as docs/plans/handover/task-16-r1-partial-fit-option.patch (unreviewed); tree reset to 3525acc. See docs/plans/HANDOVER.md.
