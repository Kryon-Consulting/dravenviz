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
- RESUME (2026-10-01, new session): branch now claude/charming-maxwell-uzxpf4 (PR #5 merged bold-curie into main). Workspace recreated by hand (sdd scripts not run: external code; briefs extracted with sed, review packages built with git). Baseline: lint/typecheck/483 unit green at 2b5a47f.
- Task 16: fix round 1 dispatched (fresh Sonnet implementer; prior implementer gone; base 2b5a47f).

## Pre-flight scan (resume, Tasks 16-fix..21)

| Tasks | Shared file / interface | Finding |
|---|---|---|
| 16fix→19 | tests/visual/MISMATCHES.md created in 16 fix; Task 19 lists it under Create | consistent: Task 19 extends, not recreates |
| 16→17 | evidence/pdf/report-slice1.pdf + spec hash → docs sample link | consistent |
| 16→20 | DravenPDF server start/stop code in scripts/test-pdf.ts → P4 latency | reuse, no duplication (carry to Task 20) |
| 15→17,18 | stage-consumer.ts, pack:local tarball | consistent; Task 17 adds `stage docs`, Task 18 consumers |
| 17 self | milestone "stop and report to owner" | Ruling R2 (report in ledger, continue) |
| 19→20,21 | visual.spec fails while baselines pending (R6) → `pnpm test:browser` goes red for everyone | Ruling R38 |
| 19→21 | matrix status `pending-review` for visual rows | consistent |
| 20 self | P1 miss → owner exception | Ruling R7 |
| 21 self | CI `browser` runs `playwright install --with-deps chromium` (CI only) vs container rule "never playwright install locally" | consistent (CI runner only) |
| exit criteria | visual approval + perf exception need the owner | slice cannot be *closed* by the controller; reported, not self-approved |

- Ruling R38: after Task 19, visual specs live in their own Playwright project `visual` that `pnpm test:browser` still runs (plan: "Visual tests run in browser"); implementers/reviewers of later tasks treat failures whose only message is `pending owner review` as expected and must show every non-visual browser test green (e.g. `pnpm test:browser --project <non-visual>`) — keeps the plan's red-until-approved gate without hiding real regressions — cost if wrong: a script/project rename.
- Owner decision (2026-10-01): Task 19 — controller publishes a side-by-side visual review page (browser / SVG / PDF crop) as a private artifact; owner approves or rejects each candidate; approved PNGs move to baselines/approved/ in a commit citing the owner's decision; CI red until then. Task 20 — on a P1 miss: investigate, record the cause in evidence/perf/README.md, keep the test failing, bring the numbers to the owner (no pre-accepted exception).
- Task 16: fix round 1 implementer DONE (4af5d0a, 50b98f6, e846ade). test:pdf PASS 25/25 path http; forced ServerStartError → library path 25/25. Concern: className dravenviz-chart-box passed to Recharts wrapper. Re-review (opus) dispatched on 2b5a47f..e846ade.
- Task 16: fix round 1/5 (I1, I2, all minors addressed; 1 open — I3/R37 sizing uses className on Recharts' wrapper + !important + `> svg` structural selector; reviewer: use ComposedChart `style` prop (width 100%, height auto, aspectRatio) and `svg[data-dravenviz-chart]`; commits 2b5a47f..e846ade)
- Task 16: minor (deferred): dravenviz-chart-box class (if kept) lands on React path too; library-path status inferred via STATUS_BY_CODE (sound today).
- Task 16: fix round 2 implementer DONE (3ee94c9, 58485cd); re-review dispatched on e846ade..58485cd
- Task 16: fix round 2/5 (1 addressed, 0 open; commits e846ade..58485cd)
- Task 16: minor (deferred): test:pdf log prints two "[FAIL]" lines from the broken-library simulation unit test — capture/label as expected.
- Task 16: complete (commits 36fe473..58485cd, review clean). test:pdf PASS 25/25 (path http).
- Task 17: implementer dispatched (sonnet), base 58485cd. Carry: R25 (fonts.check vacuous) applied to the brief's standalone-SVG font check; R32/R33/R37 docs; ZERO_SIZE re-render; LAYOUT_ERROR troubleshooting; React example claims limited.
- Task 17: implementer DONE (2781e36, trailer amended to session attribution per R8). test:docs 12/12; browser 122; unit 483. Concerns: specSha256 = file bytes hash; print preview collapsed details; Vite chunk warning 1.16MB.
- Task 17: review (opus) dispatched on 58485cd..2781e36.
- MILESTONE (proof path, Ruling R2: recorded, no stop): line-weekly-flow renders through React (Task 14, browser specs), plain HTML (Task 15 examples), normalized standalone SVG (Task 13 export), a real DravenPDF PDF (Task 16: evidence/pdf/report-slice1.pdf, test:pdf PASS 25/25, path http), and the docs playground (Task 17: test:docs 12/12, evidence/screenshots/docs-*.png), all from the packed tarball .pack/draven-viz-0.1.0.tgz.
- Task 17: review → Needs fixes. Important: test:docs/preview:docs can run against a stale stage (skips §16.1 stage→pack:local dependency). Minors 1–5 (dropped Render race; hardcoded SAMPLE_HASH; screenshots overwritten each run + dead mkdir; unhandled choose() rejection; Vite chunk warning) included in fix round 1 — cheap and real.
- Task 17: minor (deferred): Validate on an unrendered edit hides banner though preview stale (status text could say so).
- Task 17: fix round 1 implementer DONE (86f896f). test:docs 13/13; no RED run for race test.
- Task 17: fix round 1/5 (Important 1 + minors 2–5 addressed; 1 open — race regression test passes on old buggy code 5/5, so it guards nothing; code fix verified correct; commits 2781e36..86f896f)
- Task 17: fix round 2/5 (1 addressed, 0 open; commits 86f896f..703ce57)
- Task 17: minor (deferred): race test selectors depend on Width being first number input and button text "Render" (fails loudly).
- Task 17: complete (commits 58485cd..703ce57, review clean)
- Task 18: implementer dispatched (sonnet), base 703ce57.
- Task 18: implementer DONE_WITH_CONCERNS (96686f4). test:package 16/16 (react 18.3.1/19.3.0, vite 8.3.1, recharts 3.10.1).
- Ruling R39: attw runs with `--profile esm-only` (entries ./styles.css and ./browser excluded as non-JS-module entries) — spec: "CJS distribution is optional, not a V1 requirement"; node10/CJS resolution is out of V1 — cost if wrong: add a CJS build later.
- Ruling R40: the D10/§19 consumer-TS 5.4 and 6.0 declaration check is not in Task 18's brief; it is queued for the slice-4 plan ("clean-consumer package verification") rather than widening Task 18 — cost if wrong: a declaration incompatibility with TS 5.4 surfaces later.
- Task 18: review → Approved (spec ✅, no Critical/Important).
- Task 18: minor (deferred): publint/attw pack the working tree, not the .pack tarball; empty DV_PACKAGE_ROOT falls back to repo dist; Start.tsx "the same chart" → "an equivalent chart"; printResolved outside check(); react18/react19 consumers identical but for name.
- Task 18: complete (commits 703ce57..96686f4, review clean)
- Task 19: implementer dispatched (sonnet), base 96686f4.
- Task 19: implementer DONE (cb5b139). 14 candidates pending; browser non-visual 122 green, visual 14 fail 'pending owner review'. Calibrated: same-path 0.05%, SVG-vs-browser 0.143%, PDF-vs-browser 0.363%. Review page evidence/visual/index.html 2.6 MiB. Review (opus) dispatched.
- Task 19: review → Approved (spec ✅; D4 gate needs REVIEW.md "approved by" line AND approved PNG; probes run).
- Task 19: minor (deferred): series order not asserted (+ x domain); structure oracle always uses print theme; THRESHOLD/INCLUDE_AA duplicated (tolerances.ts vs json, compare.ts literal); review page hard-codes "pending" (use decisionOf on regeneration); samePdf/crossSvgBrowser calibrated but unenforced; R29 exact-equality flag fragile (use ~half stroke width); calibrate_pdf.py docstring stale; evidence churn in commit.
- Task 19: complete (commits 96686f4..cb5b139, review clean). Owner gate (Step 4) pending: review page to be published.
- Task 19: review page published privately for the owner: https://claude.ai/artifact/C3y5i7hY5EUN5kdma4Kktt (controller spot-checked candidates: weekly-flow@print, estimated-monotone@print — Actual (series dash) vs Estimated (short dash) visibly close in print; Forecast starts on bottom edge Jan=10 (R29)). Awaiting owner decisions.
- Task 20: implementer dispatched (sonnet), base cb5b139.
- Task 20: implementer DONE (a315e8a). P1 p95 47.3 ms (met), P2 355.1, P4 2237.9 (0 stalls/30); bundle gzip 219,540 B. perf-report test in own vitest project (test:perf). Review dispatched.
- Task 20: review → Approved (P1 probe confirmed real warmed mountCharts; percentile, doctored-miss, budget arithmetic probed).
- Task 20: minor (deferred): two §18.1 budget rows (fonts total, SVG embedded) break stated rounding rule; no EXCEPTIONS.md path in perf test (brief Step 4); P4 422 vs 504 accounting uneven, stallRule text omits 422; missing-prereq exit code/cleanup (measure exits 1 not 3, temp dirs leak); perf test doesn't check size.json page count/machine block.
- Task 20: complete (commits cb5b139..a315e8a, review clean)
- Task 21: implementer dispatched (sonnet), base a315e8a.
- Task 21: implementer DONE (1814ce5). Step 4 all run individually: all pass except visual baselines (14 pending owner review). Matrix 18 rows: 16 pass, 2 pending-review. matrix test in own project test:matrix (CI unit job). Review dispatched.
- Task 21: review → Needs fixes. Important: GC-01/GC-03 claim pass with no test asserting package.json fields; SPEC-7 fixtures don't cover negative values or long labels. Minors 3–5 (GC-07 default timeout assertion; GC-14 checkPrerequisites exit-3 test; parseMatrix silently drops malformed rows / no duplicate-id check) included in fix round 1.
- Task 21: minor (deferred): PDF/visual row detection keyword-based; package job packs twice; pdf CI job's uv sync of private? dravenpdf git dep may need a token (pre-existing; tell owner).
- Task 21: fix round 1 implementer DONE (d7f3dd7). unit 489.
- Task 21: fix round 1/5 (5 addressed, 0 open; commits 1814ce5..d7f3dd7)
- Task 21: minor (deferred): "negative values" covered only by one clipped point (no negatives inside an auto domain); Step-4 table says test:matrix 8 (now 11); any heading inside "Requirement rows" stops row checking; edited rows unpadded.
- Task 21: complete (commits a315e8a..d7f3dd7, review clean)
- Slice-1 implementation tasks 1–21 complete. Final whole-branch review next (c2ac690..HEAD).
- Final whole-branch review (opus) dispatched on c2ac690..d7f3dd7 with ledger extract (deferred minors + rulings) and handover hardening items.
- Final review → With fixes. Important I1–I8 (fit:"width" 0-px host resolves ready; ambiguous id scheme ns-chartId-n collides; React Chart readiness unbounded; insecure-context crypto.subtle → misleading RENDER_FAILED; interactive mode drops annotation/reference labels; invalid timezone → raw RangeError/RENDER_FAILED; time labels in table/tooltips omit year/zone; CI browser job permanently red via visual project). Triage: only T9 date-year must-fix (=I7); all other deferred minors OK-TO-DEFER (conditions recorded in final-review-report.md). Hardening items deferred (circle r → slice 3 inline geometry; font error family folded into I4; counts().svgs defer).
- Ruling R41: R38 execution amended — CI `browser` job runs `--project=browser` as the gating step, then the `visual` project as a separate step that stays red until owner approval; `pnpm test:browser` locally still runs both — keeps real regressions visible while honouring D4 — cost if wrong: one CI step split.
- Ruling R42: insecure-context fonts (I4): fail early with FONT_LOAD_FAILED naming the secure-context requirement (and document HTTPS/localhost, no file://) rather than ship a pure-JS SHA-256 — integrity verification stays on WebCrypto, smaller surface — cost if wrong: plain-http intranet hosts can't render until served over HTTPS/localhost.
- Ruling R43: React `<Chart>` gains `timeoutMs` (default 10,000) reporting TIMEOUT via onError exactly once (I3, spec bounded readiness; also fixes T14 double onError) — cost if wrong: an additive prop.
- Ruling R44: annotation and reference-line labels are always drawn, in interactive mode too; `staticLabels` governs point labels only (I5; §5.2 on-chart text; spec never silently hide) — cost if wrong: label crowding in compact interactive charts (slice-3 collision seam).
- Queued for slice-2 plan (from final review): relax 250-category cap to bar axes; Theme shape freeze before slice 4 (legend strings); R24 title upper bound before slice 4; T19 cross-mode tolerances must gate by slice 4; slice-3 inline geometry for markers (host circle r).
- Final fix wave dispatched (sonnet, one implementer) for I1–I8 + Minors 1, 4 + font-error family name.
- OWNER DECISION (2026-10-01, in chat): "approve all visual candidates" — applies to the 14 candidates as published at https://claude.ai/artifact/C3y5i7hY5EUN5kdma4Kktt (commit cb5b139). Controller applies it (REVIEW.md 'approved by owner on 2026-10-01', PNGs → baselines/approved/) after the final fix wave lands, so it doesn't collide with the running fixer; any candidate the fix wave changes must be re-shown to the owner, not carried over.
- Final fix wave implementer DONE (e77e10e..368a1e8). unit 500, browser 133, visual structural 14 pass; candidates PNGs unchanged (sha verified). Re-review dispatched.
- Final fix wave re-review: I1–I8, Minor 1, Minor 4 all ADDRESSED. New: N1 (Important) formatTimeLabel calls assertLocaleAndTimezone per label → buildModel ~10× slower (perf-line-500x4 5.1→49.1 ms), est. P1 p95 ~78 ms > 60 ms budget, evidence/perf + matrix stale; N2 (Minor) docs claim file:// fails FONT_LOAD_FAILED but it fails INVALID_OPTIONS (scheme not allowed; file:// is a secure context); N3 (Minor) stale staticLabels comment.
- Ruling R45: residual N1 is load-bearing (it makes committed perf evidence and the matrix false and breaches a recorded budget), so instead of parking it the controller sends ONE narrowly scoped residual fix (N1: validate once up front, no per-label assert; N2 doc wording; N3 comment) plus `pnpm measure` re-run, with a scoped re-review — deviates from the SDD "no second fix wave" rule because the fix is a few lines and was introduced by the wave itself — cost if wrong: one extra small review cycle.
- Out-of-scope (deferred): React Recharts ids come from host identifierPrefix not namespace (documented); toDataTable/renderDataTable on category axes don't validate locale/timezone up front.
- Residual fix DONE (a16d230). unit 501; P1 p95 47.3 (unchanged), P2 p95 380.1. Re-review dispatched.
- Residual fix re-review: N1/N2/N3 ADDRESSED, no new breakage (buildModel back to 3.26 ms vs 3.24 baseline; I6 probes all INVALID_OPTIONS; latency.json genuinely regenerated).
- Residual: minor (deferred): P1 harness didn't register the 10× buildModel regression (frame quantisation / insensitivity) — revisit P1 sensitivity; P4 recorded 2 stalls (6.25 %) with no stall-rate budget.
- Final review fix wave complete (commits d7f3dd7..a16d230).
- Owner approval application + end-of-slice doc batch dispatched (sonnet, one implementer).
- Close-out DONE_WITH_CONCERNS (0238b24): 14/14 hashes OK, approved; visual 28 pass, browser 133; matrix 18 pass. Extra changes: visual project launches full Chromium via PW_CHROMIUM_PATH fallback /opt/pw-browsers (headless shell gave 0.4–2.2 % diffs); harness layoutOf uses candidate theme; generator uses decisionOf. Review dispatched (CI path concern).
- Close-out review → Needs fixes. Approval application verified (14/14 hashes, decisions, no email, Part B rulings accurate). Critical: CI browser job's visual step will run the headless shell (PW_CHROMIUM_PATH unset, /opt path absent) → 14 baseline failures (probed). Important: design §16.2 + plan note claim full Chromium always. Minors: /opt fallback ignores PLAYWRIGHT_BROWSERS_PATH; generator no longer compares live render to approved PNG / fixed approval-record text; stale comments; evidence/visual/diff not gitignored.
- Ruling R46: the visual project selects Playwright's full Chromium via `channel: 'chromium'` (works locally and in CI from the active browsers path) instead of a hard-coded path; the matrix marks VISUAL-REFS/GC-13 pass as a container run ("CI unverified until the browser job is green on GitHub") — honest about where it was proven — cost if wrong: baselines may need regenerating on the runner if font rasterization differs there (owner re-approval).
- Close-out fix round 1 DONE (96df289): channel 'chromium' (probed full binary), docs/matrix honest, generator compares approved, gitignore. visual 28, browser 133. Re-review dispatched.
- Close-out fix round 1 re-review: all ADDRESSED (Playwright 1.56.1 registry: channel 'chromium' → chromium-1194/chrome-linux/chrome, installed by `install chromium`).
- Close-out: minor (deferred): generator crashes on approved-PNG size mismatch; calibration block whitespace churn on regeneration; tests/visual/render.ts chromiumPath() still hard-codes /opt fallback (use channel).
- SLICE 1 COMPLETE (commits c2ac690..96df289). All exit criteria met in the container: spike passed; milestone recorded; Task 21 scripts all run with recorded outcomes; visual references approved by owner (2026-10-01); P1 p95 47.3 ms ≤ 250 ms; test:pdf PASS. Open: CI is unverified until the GitHub run is green (possible DravenPDF token for the private git dependency; visual baselines may need re-approval if runner rasterization differs). Next per exit criteria: write the slice-2 plan.
