# Slice 2: bars, areas, composed/dual axis, donut and presets — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the slice-1 renderer to every slice-2 family in design §21: bars (single, grouped, absolute and 100 % stacked, vertical and horizontal, with the percent unavailable and empty states), single and stacked areas, composed bar + line charts on two named axes, donut, and the sparkline and compact-stack presets. Each family gets fixtures, a DOM-free model, layout, rendering through the same `mountCharts` / `<Chart>` / `renderToSvg` lifecycle, data tables, pointer and keyboard interaction, export coverage, visual candidates for owner review and a real DravenPDF report (`report-slice2`).

**Architecture:** Unchanged from slice 1: `validateSpec` → `buildModel` → layout → one React SVG tree → mount or export (normalize → strict validate → finalize). Cartesian families render through Recharts `ComposedChart` (`layout="vertical"` for horizontal bars) and donut through Recharts `PieChart` (design §4). DravenViz owns data meaning (domains, ticks, stack contributions, cumulative extents and shares, gaps, states, labels, slot geometry, layout boxes); Recharts owns pixel placement of its marks (D8). Overlays (placeholders, value labels, quality and partial markers, clip breaks, annotations, reference labels, sparkline labels, donut track and centre) are DravenViz SVG children positioned through Recharts' public hooks, the D8 oracle or DravenViz layout.

**Tech Stack:** As slice 1 (TypeScript 6.0, pnpm 10.33.0, Node 22.22, React 19.3.0 with react-is 19.3.0, Recharts 3.10.1, Ajv 8 standalone, tsup, esbuild, Vitest 5, Playwright 1.56.1 with Chromium 141.0.7390.37 revision 1194, Vite 8, CodeMirror 6; Python 3.12, uv, DravenPDF `7a249e0`, Noto Sans v2.015). No new runtime dependency.

**Spec:** `docs/spec.md` (product brief, binding) and `docs/design.md` (revision 4, the contract). Section references (§n) point to `docs/design.md`. Rulings R1–R46 in `docs/plans/handover/slice-1-ledger.md` bind unless a task below revisits one with a recorded reason. Slice-1 spike results: `docs/plans/slice-1-spike-results.md`. Slice-1 plan (interfaces reused here): `docs/plans/2026-09-30-slice-1-line-vertical-slice.md`. External review feedback and the owner's decisions on it (2026-10-01) are folded in below.

**Rulings ledger:** every ruling made while executing this plan goes into `docs/plans/handover/slice-2-ledger.md` (created by the controller at execution time), numbered from **R47**, in the form `Ruling Rn: <decision> — <why> — <cost if wrong>`. A decision made inside a task gets its R-number when it is made, not at close-out. Rulings decided by this plan (the owning task records each one):

| Ruling | Decision                                                                                                                                                                                                                                                  | Owner task |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| R47    | Category caps: 250 on bar axes (`bar-categories`), a fixed schema bound of 10,000 elsewhere (`category-count`, not lowerable per call)                                                                                                                    | 2          |
| R48    | Fill policy: solid slots 0–3, patterned slots 4–7, role pattern wins, `sliceBorder` boundaries, named pattern constants                                                                                                                                   | 2          |
| R49    | Role colour fallback to a palette slot by role order; role legend items and table role column (datum roles only)                                                                                                                                          | 4          |
| R50    | Bar quality encodings: hollow/ringed marker at the value end; estimated = dashed outline; legend entries                                                                                                                                                  | 4          |
| R51    | Compact-stack legend: values with one category; labels only with several categories, plus a note                                                                                                                                                          | 9          |
| R52    | Bars on two y axes share one set of slots across both axes (spike point 11)                                                                                                                                                                               | 4          |
| R53    | `AREA_FILL_OPACITY` is a named render constant, not a theme token                                                                                                                                                                                         | 12         |
| R54    | Value and segment labels drawn in every mode; omitted segment labels named in a note; more than 8 throws `LAYOUT_ERROR`                                                                                                                                   | 8          |
| R55    | Cross-path tolerances recorded per family; the line value changes only if line pairs change                                                                                                                                                               | 17         |
| R56    | Cumulative-coordinate contract: every stacked datum's geometry is `[lower, upper]` from `stackExtent`, used for domains, clipping, markers, labels, focus and hit testing                                                                                 | 5          |
| R57    | Stacked areas: ranged `Area` per member segment (spike 12b); `gap`/`marker-only` break only that member; `null`/absent gaps the whole stack; monotone curves per segment                                                                                  | 5, 12      |
| R58    | Two-axis bars are preserved through a rendering fallback (DravenViz-placed rectangles in shared slots); the `bar-axes-split` rule is removed (owner Q1; design §20 forbids invalidating valid specs)                                                      | 4, 11a     |
| R59    | Pointer hit testing: rectangle containment for bars and stack segments, annulus-and-angle containment for donut sectors, point proximity for lines, areas and markers                                                                                     | 15         |
| R60    | Segment labels exist for every drawn nonzero member, both signs, at `ok` and `partial` positions; layout decides fit and names omissions                                                                                                                  | 5          |
| R61    | Bar slots are tagged `{ kind: "series" \| "stack"; id }`; one `resolveSlots` function serves layout fit, rendering, the oracle and interaction                                                                                                            | 4, 8       |
| R62    | Fallback O geometry store and readiness sequence; DravenViz may read `data-dv-*` attributes it authored and props passed to its own render props                                                                                                          | 1, 11a     |
| R63    | Donut state and option precedence: state centre overrides a caller centre value; incomplete forces the legend on; hidden legend or `legendValues: "none"` names non-inline slices in a note; compact-stack and role legends stay on under `show: "never"` | 6, 10      |
| R64    | Donut keyboard traverses every slice entry in legend order, including null and zero slices; focus cue on the arc, else the legend row, else a ring tick (owner Q2; overrides R5 for donuts only)                                                          | 15         |
| R65    | Partial absolute stacks: missing member has zero extent, plus an always-on partial cue (hollow marker at the stack end, legend entry, named note, "Partial" in tooltip and table) (owner Q3)                                                              | 5, 11a     |
| R66    | An area on a value axis whose domain excludes zero fills from the axis edge nearest zero and prints a note; the domain is never changed and the spec never rejected                                                                                       | 5, 12      |
| R67    | Finite inputs whose stack or donut sum is not finite are rejected (`sum-not-finite`, `INVALID_SPEC`)                                                                                                                                                      | 5          |
| R68    | Stack positions key by resolved x (epoch ms for time, number for linear), so equal instants written with different offsets share a position                                                                                                               | 5          |
| R69    | PDF sample matching compares spec hash and rendering options; the theme override is part of the playground render settings                                                                                                                                | 16, 18     |
| R70    | `report-slice2` gets new §18.2 baseline rows; bundle growth is attributed per family against slice-1 budgets; the owner rules on new budgets                                                                                                              | 19         |
| R71    | Standalone visual and PDF-compare scripts select Chromium like R46 (`PW_CHROMIUM_PATH`, else Playwright's resolved path)                                                                                                                                  | 17         |
| R72    | Notes that depend on fit (segment omissions) are allocated in a bounded layout loop until the omitted set is stable                                                                                                                                       | 8          |
| R73    | Bar overflow and bar quality are proven end to end by report fixtures (`bar-fixed-domain-clipped`, `bar-quality-states`): the committed value domain stays the fixed domain in both orientations, and dashed, ringed and hollow encodings reach SVG and PDF; pattern children keep inheritance-safe materialized styles | 3, 11a, 11b, 14, 16 |

**Test helpers:** spec builders and wrappers used in the unit tests below (`catchErr`, `lineSpecWithCategories`, `barSpecWithCategories`, `composedSpecWithCategories`, `model`, `modelOf`, `series`, `seriesWithTheme`, `barSpec`, `groupedBarSpec`, `stackSpec`, `donut`, `donutOf`, `donutSpec`, `laid`, `laidOf`, `laidAt`, `laidDonut`, `laidDonutOf`, `horizontalSpec`, `compactSpec`, `sparklineSpec`, `labelInsideSector`, `expectNoBoxOverlap`, `withoutSlice2Fields`, and the constant `rankingLabels`) live in `tests/unit/helpers/slice2.ts`. `laidOf(spec, width?, height?)` takes optional dimensions (default 680 × 320), like `laidAt(id, width, height)`. Task 2 creates the file; each later task adds the helpers its tests use before writing the tests. Browser helpers (`h(page)`, `items(page, key)`, `sizeOf(id)`, `overrideOf(id)`, `hoverAt(page, x, y)`, `clickAt(page, x, y)`) extend `tests/browser/helpers.ts`. `h(page).mountError` returns the harness shape `{ code, message, chartId, path, rule }` (`rule` is the first issue's rule).

## Global Constraints

Carried from slice 1, verbatim:

- The package is `@draven/viz`, `"private": true`, `"license": "UNLICENSED"`, and must never be published (§1 D13).
- `src/core` has no DOM, no React and no Recharts. `recharts` is imported only under `src/render/recharts`. Public `.d.ts` files mention no Recharts type (§2).
- Recharts `3.10.1` exact; React, ReactDOM and react-is `19.3.0` in development; peers are `^18.3.0 || ^19.0.0` for react, react-dom and react-is, all optional (§3).
- JSON Schema `schema/viz-spec-v1.schema.json` (draft 2020-12) is the source of truth, with `additionalProperties: false` everywhere (§5, D5).
- Null means missing, never zero. Nothing is silently aggregated, sorted, clamped or dropped (spec "Truthful rendering rules").
- Dates: date-only strings are calendar days (UTC). Date-times must carry `Z` or an offset. The machine timezone is never read (D15). Percent format means percentage points (D16).
- Default readiness timeout is 10,000 ms. Font loading, dimension checks and layout are all inside that bound (§9).
- Print text sizes at 178 mm printed width: title 12–14 pt, labels at least 9 pt, captions at least 8 pt; `effective_pt = size × 504.57 / viewBoxWidth` (§7).
- Exported SVG contains no `class`, `style` attribute, `foreignObject`, `script`, animation, event attribute or `recharts` string (§10).
- DravenViz-authored code (`src/`, and the compiled `dist/core|react|print`) contains no `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`. The bundled third-party code in `dravenviz.browser.js` is checked at runtime (blocked external requests, CSP without `unsafe-eval`), not by string scan (§12).
- Default limits: 16 series, 10,000 Cartesian points, 250 bar categories, 32 slices, 2,500 cells, 2 MiB of JSON (§6).
- Consumers get the library only from `.pack/draven-viz-0.1.0.tgz` through `pnpm stage` or `npm install` in the OS temp directory. No workspace members, no source aliases (§16.1).
- Visual baselines are candidates until the owner approves them in `tests/visual/REVIEW.md` (D4).
- Missing PDF prerequisites exit with code 3 and print `UNVERIFIED:`, never a pass (§13).

Added for slice 2:

- **Exact geometry, no minimum sizes.** Bars, stack segments and donut slices keep their true size; nothing is inflated for visibility. Small values are read through labels, named notes, the legend and the data table (spec "Preserve proportional geometry"). A minimal hit band around a zero-height bar is an interaction target only, never drawn geometry (R59).
- **One cumulative coordinate per stacked datum.** Domains, clipping, markers, labels, focus and hit testing for stacked members all use `[lower, upper]` from `stackExtent` (R56).
- **Percent stacks** are fed DravenViz-computed shares with `stackOffset="none"`; `stackOffset="expand"` is never used. A category with a missing member (a `null` value or no point at all, R27) is **unavailable** (no segments, dashed outline, `strings.unavailable`); a zero-total category is **empty** (baseline tick and `${strings.noData} (0)`, i.e. "No data (0)"). Known members are never renormalised (§5.2).
- **Absolute stacks** use `stackOffset="sign"`: positive members stack up from zero, negative members down from zero, in series order. A missing member has zero extent and its category always carries the partial cue (R65).
- **Bars** appear only on category axes; every axis carrying bars includes zero; a measured zero is a drawn zero-height bar, a null is no bar (§5.2, §9). Valid specs are never newly rejected (§20): bars on two y axes render side by side (R58).
- **Donut** draws no slice arcs and claims no share when any slice is null ("Incomplete"), and draws a neutral full ring with centre "0" when all slices are zero (§5.3).
- **Solid fills by default.** Bars, areas and donut slices are solid for palette slots 0–3; slots 4–7 carry the theme `seriesStyles[i].pattern`; a caller role `pattern` always wins. Stack segments and donut slices are separated by a background-coloured boundary of `theme.stroke.sliceBorder`. Lines never take a pattern (R48).
- **Colour never stands alone.** Every role used by a drawn datum has a legend entry with its label (and pattern swatch when it has one), and the data table names the role (R49).
- **On-chart text in every mode.** Annotation and reference-line labels (R44), `labels.values` and `stacking.segmentLabels` are drawn in interactive and static mode alike; `staticLabels` governs `staticLabel` point labels only (R54). A label or value that cannot be drawn in place is named in a printed note; never hidden behind a bare pointer to the table (R54, R63).
- `not-implemented-in-slice` remains only for scatter series, heatmap and progress (slice 3).
- Recharts is used only through documented props, render props (`shape`, `tick`) and public hooks; no Recharts class name, DOM structure or private state is read. DravenViz may read attributes it authored itself (`data-dv-*`) and props passed to its own render props (spec; design §4; R62).

## Review Focus

These eleven situations are implied by the spec but not covered by any single task's main flow. Each has a named test in its owning task.

1. **A percent stack with a missing member next to an all-zero category in the same chart.** Expect the missing-member category unavailable (no segments, "Unavailable"), the all-zero category empty ("No data (0)"), the other categories' shares exact and summing to 100, and nothing renormalised. Owned by Task 5 (`missing member makes the category unavailable, never renormalised`) and Task 11a (`percent placeholders draw instead of segments`).
2. **An absolute stack whose members have mixed signs in one category.** Expect positives stacked up from zero and negatives down from zero in series order, and the total label showing the signed sum at the end of the side the sum falls on. Owned by Task 5 (`mixed-sign absolute stack grows both ways from zero`), Task 11a (`mixed-sign vertical stack places its total on the sum side`) and Task 11b (`horizontal absolute stack with negative members`).
3. **A composed chart whose line axis crosses zero while the bar axis includes zero**, so the two zero baselines sit at different heights. Expect each series, marker and reference line bound to its own named axis, with no merged units. Owned by Task 4 (`dual axes keep separate domains and units`) and Task 11a (`reference line and markers bind to their named axis`).
4. **A donut with one zero slice and one slice under 3 %.** Expect no arc for the zero slice but a legend row "0 (0%)", the tiny slice drawn at its true angle with no inline label, and its value and share in the legend and table. Owned by Task 6 (`zero and tiny slices keep true angles`) and Task 13 (`tiny-slice donut keeps true angles`).
5. **Horizontal bars whose category labels are longer than the left gutter allows.** Expect labels wrapped to at most 3 lines and never truncated; a label that cannot fit throws `LAYOUT_ERROR` naming the label and the width it needs. Owned by Task 8 (`horizontal category labels wrap, never truncate`).
6. **A stacked area whose middle member is null at one x position.** Expect every member of the stack to gap there (the layers above have no baseline) and the data table to mark the position "Unavailable (missing member)". Owned by Task 5 (`null member gaps every member of an area stack`) and Task 12 (`stacked areas break at a partial-null position`).
7. **A sparkline in print at 680 × 180.** Expect no axes, grid or legend, every remaining text at least 9 pt (captions 8 pt), and the omission stated in the live and exported `<desc>`, in the data-table notes and as a printed note. Owned by Task 9 (`sparkline omits axes and states it`) and Task 14 (`exported desc keeps preset and state summaries`).
8. **A stack member with no point at one category** (allowed: "one per category at most"). Expect it treated exactly like a null member. Owned by Task 5 (`absent point counts as a missing member`).
9. **A stack whose top member is null at a category.** Expect the stack total label still drawn and readiness to pass. Owned by Task 11a (`total label survives a null top member`).
10. **Two stacked members `40 + 40` on a fixed `0–50` clip-indicated axis.** Expect only the upper member clipped (neither raw value exceeds 50), its marker and focus at the cumulative end, and the note "1 value above 50 …". Owned by Task 5 (`cumulative overflow clips the upper member`), Task 11a (`stacked marker and clip at the cumulative end`) and Task 15 (`stacked focus ring at the member's cumulative end`).
11. **An absolute stack with a missing member and `labels.values` off.** Expect the known members drawn, a hollow partial marker at the stack end, its legend entry and the note `Partial stacks: Archive Store — Critical not measured`. Owned by Task 5 (`partial stack cue without total labels`) and Task 11a (`partial cue draws without total labels`).

---

## File structure (created or changed in this slice)

```text
spikes/recharts-3.10/  src/cases-slice2.tsx run-slice2.spec.ts (+ src/cases.tsx, playwright.config.ts, attribute-inventory.json)
docs/plans/slice-2-spike-results.md
schema/viz-spec-v1.schema.json            categories/labels cap 250 -> 10,000 (Task 2)
src/core/spec/types.gen.ts  src/core/validate/{ajv.gen.js,allowed.gen.ts,issues.ts,limits.ts,semantic/cartesian-domains.ts,semantic/sums.ts}
src/core/shares/index.ts                  stack positions and extents, donut shares, DOM-free, internal
src/core/table/index.ts                   bar, stack, area, role and donut tables
src/render/model/{types.ts,index.ts,cartesian.ts,bars.ts,stacks.ts,areas.ts,donut.ts,roles.ts,manifest.ts}
src/render/layout/{types.ts,index.ts,slots.ts,horizontal.ts,value-labels.ts,presets.ts,donut.ts}
src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts,bars.tsx,horizontal.tsx,areas.tsx,DonutChart.tsx,geometry-store.ts}
src/render/primitives/{Patterns.tsx,Placeholders.tsx,ValueLabels.tsx,PartialCues.tsx,SparklineLabels.tsx,DonutParts.tsx,Legend.tsx,style.ts}
src/render/{ChartView.tsx,pipeline.ts,verify.ts}
src/render/svg/recharts-metadata.ts  src/print/export.ts (desc summary)
src/react/{interaction.ts,hit-test.ts,Chart.tsx}
fixtures/valid/<24 slice-2 fixtures>.json  fixtures/invalid/sum-not-finite.json(+.expected.json)  fixtures/reports/report-slice2.json  fixtures/index.ts
examples/dravenpdf/{run_pdf_check.py,calibrate_pdf.py,test_driver.py,bundle/bootstrap.js,bundle/index.html}  scripts/test-pdf.ts
tests/unit/{model-bar,model-stack,model-donut,layout-slice2}.test.ts (+ table, react, perf-report, matrix, fixtures, validate, schema, theme tests)  tests/unit/helpers/slice2.ts
tests/unit/fixtures/layout-slice1-snapshot.json
tests/browser/{geometry-bars,geometry-horizontal,geometry-areas,geometry-donut}.spec.ts (+ export, mount, react specs)
tests/visual/{candidates.ts,render.ts,generate.ts,calibrate.ts,tolerances.ts,visual.spec.ts,REVIEW.md,MISMATCHES.md,tolerances.json}  tests/pdf/compare.ts
docs/site/src/{fixtures.ts,components/PdfSample.tsx,routes/Playground.tsx}  scripts/stage-consumer.ts  tests/docs/docs.spec.ts
evidence/{pdf/report-slice2.*,pdf/pages/report-slice2/,pdf/crops/<ns>.png,visual/,perf/,verification-matrix.md}
docs/design.md                            §4, §5.1, §5.2, §5.3, §6, §7, §8, §9, §13, §15, §16.2, §18 (list in Task 2)
```

After Tasks 4–6 the model builds bar, area and donut models, but `buildLaid` keeps rejecting a family with `RENDER_FAILED` (`not-implemented-in-slice`) until its renderer lands: the guard checks mark (`RENDERED_MARKS`), kind (`RENDERED_KINDS`), preset (`RENDERED_PRESETS`) and orientation (`RENDERED_ORIENTATIONS`). Vertical bars land in Task 11a; horizontal bars in Task 11b; areas and both presets in Task 12; donut in Task 13. From Task 13 on, the rule fires only for scatter, heatmap and progress.

---

### Task 1: Recharts 3.10.1 slice-2 spike (proof gate)

**Files:**

- Create: `spikes/recharts-3.10/src/cases-slice2.tsx` (exports `CASES_SLICE2` and `PROBES_SLICE2`), `spikes/recharts-3.10/run-slice2.spec.ts`
- Modify: `spikes/recharts-3.10/playwright.config.ts` (`testMatch: ['run.spec.ts', 'run-slice2.spec.ts']`), `spikes/recharts-3.10/src/cases.tsx` (merge `CASES_SLICE2` into `CASES` and `PROBES_SLICE2` into `window.probe`, without overwriting slice-1 entries), `spikes/recharts-3.10/src/export-probe.ts` (reused for the new cases), `spikes/recharts-3.10/attribute-inventory.json` (merged additions, same format)
- Create: `docs/plans/slice-2-spike-results.md`

**Interfaces:**

- Consumes: the slice-1 spike harness (same Vite page, the same plot box 600 × 300 with margin {top 20, right 30, bottom 10, left 10}, `YAxis width=50`, `XAxis height=30`, so plot x=60, y=20, w=510, h=240).
- Produces: pass/fail for spike points 7–16 and 12b below, measured deltas, the merged attribute inventory, the fallback taken for any failed point, the point-11 answer (Task 4) and the stacked-area strategy (Task 12). The slot oracle used by point 9 is the formula Task 8 implements as `resolveSlots` (copied into the spike so the spike stays self-contained).

The slice-1 spike proved grouped/stacked bars and stacked areas on 4 categories, null gaps, first-commit geometry, export and host-style isolation (points 1–6). Slice 2 needs these unproven behaviours:

- [ ] **Step 1: Write the spike checks** in `run-slice2.spec.ts`, one test per point, against cases in `cases-slice2.tsx`:

```ts
test('7 horizontal bars: category band rows, overlays, plot area', async ({ page }) => {
  await page.goto('/?case=horizontal'); // ComposedChart layout="vertical", YAxis type=category scale=band, XAxis number
  const r = await page.evaluate(() => (window as any).probe.horizontal());
  expect(r.categoryDomain).toEqual(['A', 'B', 'C', 'D']);
  expect(r.bandCentreDelta).toBeLessThanOrEqual(0.5); // useYAxisScale(catId)(k, {position:'middle'}) vs plot.y+(k+0.5)·h/n
  expect(r.barStartAtZeroDelta).toBeLessThanOrEqual(0.5); // bar left edge vs useXAxisScale()(0), also for negatives (right edge)
  expect(r.plotAreaMatchesLayoutBox).toBe(true);
});
test('8 measured-zero bar reaches the custom shape', async ({ page }) => {
  await page.goto('/?case=zerobar'); // Bar shape={fn} with values [4, 0, null, -2]
  const r = await page.evaluate(() => (window as any).probe.zeroBar());
  expect(r.shapeCalls.map((c: any) => c.value)).toEqual([4, 0, -2]); // null never reaches shape
  expect(r.zeroShapeHeight).toBe(0);
});
test('9 bars and areas wrapped in a DravenViz <g data-dv-mark> keep grouping and stacking', async ({
  page,
}) => {
  await page.goto('/?case=wrapped'); // barCategoryGap="10%" (per side, i.e. barGap 0.2 × 50), barGap in px from the slot formula
  const r = await page.evaluate(() => (window as any).probe.wrapped());
  expect(r.groupedDistinctX && r.stackedSameX && r.areaTopEqualsSum).toBe(true);
  expect(r.itemsInsideWrapper).toBe(true);
  expect(r.slotOracleDelta).toBeLessThanOrEqual(0.5); // bar x/width vs the Recharts slot formula: side = band × pct, size = round((band − 2·side − (n−1)·gap)/n) when > 1, offset = side + (size + gap)·i
});
test('10 percent stack: shares with stackOffset none; all-null category draws nothing', async ({
  page,
}) => {
  await page.goto('/?case=percent'); // members fed shares [25,75,0],[16,48,36],[null,null,null]
  const r = await page.evaluate(() => (window as any).probe.percent());
  expect(r.segmentEdgesDelta).toBeLessThanOrEqual(0.5);
  expect(r.rectsInNullCategory).toBe(0);
  expect(r.zeroShareSegmentHeight).toBe(0);
});
test('11 dual axes: bars left, line right, distinct domains; bars bound to two axes', async ({
  page,
}) => {
  await page.goto('/?case=dualaxis');
  const r = await page.evaluate(() => (window as any).probe.dualAxis());
  expect(r.leftDomain).toEqual([0, 160000]);
  expect(r.rightDomain).toEqual([-15, 5]);
  expect(r.lineOnRightScaleDelta).toBeLessThanOrEqual(0.5);
  expect(typeof r.barsOnTwoAxesSideBySide).toBe('boolean'); // recorded; Task 4 / 11a read it (R52, R58)
});
test('12 stacked areas with stackId: sign offset, partial-null geometry, sizes, linear and time x', async ({
  page,
}) => {
  await page.goto('/?case=areas');
  const r = await page.evaluate(() => (window as any).probe.areas());
  expect(r.signNegativeBelowZero).toBe(true);
  expect(r.nullPositionCoveredByAnyFill).toBe(false); // middle member null at x2: no member's fill covers x2's band centre
  expect(r.topEdgeSumDelta).toBeLessThanOrEqual(0.5); // each member's top equals the cumulative sum on both sides of the gap
  for (const n of [2, 13, 60]) expect(r.bandCentreDelta[n]).toBeLessThanOrEqual(0.5);
  expect(r.linearXDelta).toBeLessThanOrEqual(0.5);
  expect(r.timeXDelta).toBeLessThanOrEqual(0.5);
});
test('12b ranged areas per member segment (no stackId)', async ({ page }) => {
  await page.goto('/?case=rangedareas'); // one Area per member segment, dataKey returns [lower, upper]
  const r = await page.evaluate(() => (window as any).probe.rangedAreas());
  expect(r.topEdgeSumDelta).toBeLessThanOrEqual(0.5);
  expect(r.sharedEdgeDelta.linear).toBeLessThanOrEqual(0.5); // member k's lower edge = member k−1's upper edge
  expect(r.sharedEdgeDelta.monotone).toBeLessThanOrEqual(0.5); // within one continuous run with identical x sets
  expect(r.partialNullBreaksEveryMember).toBe(true);
  expect(r.memberOnlyBreakKeepsOthers).toBe(true); // gap on one member: that member's band breaks, the others stay continuous
  expect(r.itemsPerSegment).toBe(true); // one path (one data-dv-item) per member segment
});
test("13 pie: 12 o'clock start, clockwise, exact boundaries; zero slice; all-zero", async ({
  page,
}) => {
  await page.goto('/?case=pie'); // Pie startAngle=90 endAngle=-270 paddingAngle=0 minAngle=0
  const r = await page.evaluate(() => (window as any).probe.pie());
  expect(r.firstStartDeg).toBeCloseTo(0, 2);
  expect(r.maxBoundaryErrorDeg).toBeLessThanOrEqual(0.01);
  expect(r.zeroSliceArcLength).toBe(0);
  expect(typeof r.allZeroSectors).toBe('number'); // recorded: DravenViz draws the neutral ring itself
});
test('14 hidden value axis keeps scale hooks and takes no space', async ({ page }) => {
  await page.goto('/?case=hiddenaxis');
  const r = await page.evaluate(() => (window as any).probe.hiddenAxis());
  expect(r.plotAreaMatchesLayoutBox && r.scaleHookWorks).toBe(true);
});
test('15 slice-2 charts survive normalize + strict allowlist', async ({ page }) => {
  await page.goto('/?case=export2'); // horizontal + percent bars, stacked and ranged areas, pie, a <pattern> fill
  const r = await page.evaluate(() => (window as any).probe.exportProbe());
  expect(r.disallowedAfterNormalize).toEqual([]);
  expect(r.unclassified).toEqual([]);
  expect(r.svg).not.toMatch(/class=|style=|recharts/);
});
test('16 Bar shape, Area and Pie sector inline styles resist host CSS', async ({ page }) => {
  await page.goto('/?case=hostcss2'); // host: path{fill:red;stroke-width:5} rect{fill:red}
  const r = await page.evaluate(() => (window as any).probe.hostCss2());
  expect(r.componentsForwardingStyle).toEqual(
    expect.arrayContaining(['Bar.shape', 'Area', 'Pie.sector']),
  );
  expect(r.fillsUnchanged && r.strokeWidthsUnchanged).toBe(true);
});
```

- [ ] **Step 2: Run** `pnpm --dir spikes/recharts-3.10 exec playwright test` (with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Expected: 11 new tests discovered (points 7–16 and 12b), each failing with `probe.<name> is not a function` or a missing route; the slice-1 `run.spec.ts` tests stay green.
- [ ] **Step 3: Implement the probes** in `cases-slice2.tsx` (geometry read from the DOM for the checks only) and the merge into `cases.tsx`. Extend `export-probe.ts` so the merged inventory classifies every new element@attribute pair (Pie sector paths and any `cx`/`cy`/`name` they carry, Bar `shape` output, Area fills, ranged areas, `pattern` children). Write the additions into `attribute-inventory.json` under new component keys; the existing keys stay byte-identical.
- [ ] **Step 4: Run the spike again and record** `docs/plans/slice-2-spike-results.md` in the slice-1 format: every test now reports a real pass or fail, the result table, measured deltas, the inventory summary (new pairs and their classes, 0 unclassified), the point-11 answer and the chosen stacked-area strategy. Apply the matching fallback for any failed point, record it in design §4 and as a ruling in the slice-2 ledger, and continue (R2, no stop):
  - **H** (point 7 or 14 fails): horizontal bars are drawn by `render/primitives` rectangles from `slotGeometry` and DravenViz scales inside the same `ComposedChart` (overlays still read `usePlotArea`).
  - **Z** (point 8 fails, shape not called for zero): measured-zero bars are drawn as an overlay (a zero-height path at the scaled zero, slot from `slotGeometry`).
  - **W** (point 9 wrapper check fails): `verifyCommitted` counts items by a `data-dv-of="<manifest key>"` attribute on each `data-dv-item` instead of group nesting.
  - **O** (point 9 slot-oracle check fails): bar geometry comes from the committed `shape` props through the geometry store (R62):
    1. the DravenViz `shape` render prop writes `{ slot, xKey, x, y, width, height }` from its documented props into a per-render geometry store keyed by render id; the store is a ref owned by `ChartView` (`src/render/recharts/geometry-store.ts`), not the DOM; `data-dv-slot` stays a test probe only;
    2. after the first commit, `ChartView` re-renders the overlays (value labels, partial cues, markers, focus ring) once from the store; at most one extra pass;
    3. readiness (`verifyCommitted`) runs after that pass, and the manifest counts include the overlay groups;
    4. zero or absent bars and slots with no shape call fall back to `slotGeometry` (fallback Z) or are excluded (absent);
    5. a store write whose render id is not current is ignored; a resize starts a new render id and a new store;
    6. interaction (`hitTest`, focus) and export read the same store; the export mount commits before export (`src/print/export.ts`);
    7. Task 8 label-fit checks then use the conservative bound `resolveSlots(...).width × 0.9`.
  - **S** (point 10 fails): percent stacks are fed `[lower, upper]` share ranges through ranged bars or DravenViz rectangles (the H mechanism).
  - **A** (point 12 fails, or 12b passes and point 12 cannot yield one item per segment): stacked areas use ranged `Area`s per member segment (point 12b). If 12b passes, this is the primary strategy, not a fallback (R57). If both 12 and 12b fail, stacked areas are drawn by `render/primitives` paths from model extents.
  - **P** (point 13 fails): donut arcs are drawn by `render/primitives/DonutParts.tsx` from model angles (no `PieChart`).
  - **Point 15 fails:** a defect, not a fallback. Each unclassified pair is classified per tag in `recharts-metadata.ts` (or normalized) by Task 14; never a catch-all.
  - **Point 16 fails for a component:** DravenViz-authored `shape` output carries fill and stroke as inline style plus the slice-1 style guard, recorded per component; Recharts-drawn parts that do not forward style are replaced by `shape` output.
  - Point 11 `barsOnTwoAxesSideBySide` and point 13 `allZeroSectors` are observations, not gates (R52, R58 decide the consequence).
- [ ] **Step 5: Commit.** `spike: verify Recharts 3.10.1 horizontal bars, zero bars, percent stacks, ranged areas and pie`

---

### Task 2: Contract adjustments, fill policy and design text

**Files:**

- Modify: `schema/viz-spec-v1.schema.json` (`CategoryAxis.categories` and `CategoryAxis.labels`: `maxItems` 250 → 10,000), regenerate `src/core/spec/types.gen.ts`, `src/core/validate/ajv.gen.js` and `src/core/validate/allowed.gen.ts` with `pnpm gen`
- Modify: `src/core/validate/issues.ts` (`LIMIT_PATHS`: `/xAxis/categories` and `/xAxis/labels` map to the new limit rule `category-count`), `src/core/validate/limits.ts` (rule id list)
- Modify: `src/core/theme/tokens.ts` (doc comment of `SERIES_STYLES` states the fill policy; values unchanged)
- Create: `tests/unit/helpers/slice2.ts`
- Modify: `docs/design.md` (the edit list below) and `CHANGELOG.md` (Unreleased: category cap 250 applies to bar axes only; other category axes are capped at 10,000; backward compatible)
- Test: `tests/unit/schema.test.ts`, `tests/unit/validate.test.ts`, `tests/unit/theme.test.ts`

**Interfaces:**

- Consumes: `schemaValidate`, `validateSpec`, `checkLimits` (`src/core/validate/limits.ts`; it already applies `bar-categories` only when a category axis carries a bar series).
- Produces: a schema admitting up to 10,000 categories on axes without bars, the limit rule `category-count`, the fill policy every later task applies, and the design text for every slice-2 contract change.
- **R47 (queued item "relax the 250-category cap"; controller decision):** the schema keeps a protection bound of `maxItems: 10000` on `categories` and `labels` (matching the 10,000-point limit), reported as `LIMIT_EXCEEDED` rule `category-count` at `/xAxis/categories` (or `/xAxis/labels`). It is a fixed bound: it has no `Limits` key and cannot be lowered per call; per-call lowering stays available for bar axes through `barCategories`. The semantic limit `bar-categories` (250, bar axes only) is unchanged. Accepting more input is backward compatible (design §20). Mismatched label counts stay `labels-length`.
- **R48 (queued item "series slots 4–7 carry default fill patterns"):** spec "Use solid fills by default. Reserve hatching/patterns for distinctions that need them" and design §7 (`seriesStyles` carry `pattern`). Bars, areas and donut slices have no dash or marker shape to fall back on, and the print palette's grayscale separation (≥ 0.08 relative luminance) is guaranteed only across slots 0–3 (slice-1 Task 7 test). So:
  - slots 0–3 are solid (`pattern: "none"`, as today);
  - slots 4–7 draw their theme pattern (`diagonal`, `dots`, `crosshatch`, `diagonal`) as a low-density overlay on the slot colour, with geometry from named render constants in `src/render/primitives/style.ts`: `PATTERN_TILE = 6`, `PATTERN_STROKE = 1`, `PATTERN_OPACITY = 0.45` (stroke in the theme background colour);
  - precedence: datum role pattern > series role pattern > slot pattern; a role `pattern: "none"` switches a slot pattern off;
  - line series never use a pattern;
  - stack segment boundaries and donut slice borders both use `theme.stroke.sliceBorder` in the background colour.
- **Design-edit list** (every design-text change the slice needs; each item cites its ruling; items whose ruling is decided in a later task are written by that task):
  1. §4: `buildLaid` returns `LaidOut = LaidOutChart | LaidOutDonut`; value labels, totals and partial cues are overlays positioned from the D8 oracle (`resolveSlots`/`slotGeometry`) or the fallback-O geometry store (R61, R62); the render guard covers presets and orientation; bars on two y axes render in shared slots, by DravenViz rectangles when Recharts would overlap them (R52, R58).
  2. §5.1: a role without a colour falls back to a palette slot by the role's position in `spec.roles` (then wraps every 8); every role used by a drawn **datum** gets a legend entry (`kind: "role"`) and a table role column; a series-level role only colours the series (R49).
  3. §5.2 `CategoryAxis.categories` comment: `1–10,000 unique keys; axes carrying bars are limited to 250 (bar-categories)`.
  4. §5.2 `labels` comment: `on-chart value labels, drawn in every mode; default "none"` (replaces "static value labels").
  5. §5.2 bar quality encodings: `partial` → hollow marker and `lagging` → ringed marker at the bar's value end; `estimated` → dashed bar outline; each is listed in the legend (R50).
  6. §5.2 percent states: unavailable when a member is null **or has no point** at the category (R27); empty text is `${strings.noData} (0)`.
  7. §5.2 compact-stack: legend with values when the stack has one category; with several categories the legend shows labels only and the segment labels plus a note carry values, because a legend value would have to sum across categories (R51).
  8. §5.2 sparkline label line: `<series label>: <last display> <unit>` plus first/last value labels.
  9. §5.2 **cumulative-coordinate contract** (R56): a stacked member's geometric extent is `[lower, upper]` from `stackPositions`; auto domains, `clip-indicated` detection, quality and partial markers, value and segment labels, focus and hit testing all use it; stack positions key by resolved x (R68).
  10. §5.2 **stacked-area hint semantics** (R57): `null` or an absent point gaps every member of the stack at that position; `renderHint: "gap"` and `"marker-only"` on one member break only that member's band (its value is known, so the layers above keep their baseline); a marker-only or isolated stacked point is drawn at its cumulative `upper`; estimated ranges are dashed per member segment; monotone curves interpolate per segment.
  11. §5.2 **partial-stack cue** (R65): in an absolute stack a missing member has zero extent; every partial category always gets a hollow partial marker at the stack's outer end, a legend entry `Partial stack — Hollow marker: a stack member is not measured.`, a printed note `Partial stacks: <category> — <member> not measured; …`, and "Partial" in tooltips and tables, whatever `labels.values` says.
  12. §5.2 **area baseline** (R66): an area fills from 0 when the axis domain includes 0, else from the domain edge nearest 0, with the note `Area filled from the axis minimum <formatted min>, not from zero.` (or `… axis maximum <formatted max> …` for an all-negative domain); the caller's domain is never changed.
  13. §5.2 segment labels (R60): created for every drawn nonzero member of both signs at `ok` and `partial` positions; a zero member has no geometry and no label (the table carries it).
  14. §5.3 **donut state and option precedence** (R63): slice `color` > slice role colour > palette slot; all-zero legend text `<label> — 0 (–)`; in `all-zero` and `incomplete` states the state centre (`0`, `Incomplete`) overrides a caller `center.value`, while a caller `center.label` is kept; an `incomplete` donut always shows its legend (§5.3 makes its rows normative), whatever `legend.show` says; when the legend is hidden or `legendValues` is `"none"`, every slice without a visible inline label is named in a note with value and share.
  15. §5.2/§7 legends under `legend.show: "never"`: compact-stack and role legends stay shown (a preset requirement and the colour-meaning rule), not rejected (§20) (R63).
  16. §6: limit rule `category-count` (R47), a fixed schema bound of 10,000 that cannot be lowered per call; the new semantic rule `sum-not-finite` (R67): a stack position or donut whose finite inputs sum to a non-finite value is `INVALID_SPEC`; no rule rejects bars bound to two y axes (the earlier `bar-axes-split` idea is withdrawn, R58).
  17. §7: fill policy and pattern constants (R48), stack boundaries use `stroke.sliceBorder`, donut slot wrap after 8 slices, `AREA_FILL_OPACITY` (Task 12, R53).
  18. §8: value and segment labels drawn in every mode; a segment label that does not fit is listed by name in a printed note; more than 8 omitted segment labels throw `LAYOUT_ERROR`; fit-dependent notes are allocated in a bounded loop (R54, R72).
  19. §9 **hit-testing contract** (R59): React pointer targeting uses rectangle containment for bars and stack segments (a ±4-unit hit band around zero-height bars, never drawn), annulus-and-angle containment for donut sectors (the hole and the outside hit nothing), and point proximity (hover 20, click 16 units) for lines, areas and markers; in composed charts a line datum within radius wins over bar containment. §9 keyboard: donuts traverse every slice entry, including null and zero slices (R64).
  20. §13 and §15: `report-slice2`, the fixtures `bar-horizontal-grouped`, `bar-horizontal-stacked` and `donut-tiny-slices`, per-entry sizes and theme overrides, per-instance rendering options in the report JSON (R69).
  21. §16.2: cross-path tolerances are recorded per family; the line value changes only if line pairs change (Task 17, R55).
  22. §18.2 **`report-slice2` baseline** (R70): new rows for `report-slice2` PDF bytes and pages and slice-2 SVG sizes (measured + 20 %, the §18 rule); bundle and entry growth judged against slice-1 budgets with a per-family attribution; the owner rules on any new budget.

- [ ] **Step 1: Write the tests.** Define the helpers `catchErr`, `lineSpecWithCategories`, `barSpecWithCategories` and `composedSpecWithCategories` in `tests/unit/helpers/slice2.ts` first.

```ts
test('line axis admits 300 categories', () => {
  // schema.test.ts
  expect(schemaValidate(lineSpecWithCategories(300))).toBe(true);
});
test('10,001 categories -> LIMIT_EXCEEDED category-count', () => {
  // validate.test.ts
  expect(catchErr(() => validateSpec(lineSpecWithCategories(10_001)))).toMatchObject({
    code: 'LIMIT_EXCEEDED',
    rule: 'category-count',
    path: '/xAxis/categories',
  });
});
test('251 bar categories -> LIMIT_EXCEEDED bar-categories', () => {
  expect(catchErr(() => validateSpec(barSpecWithCategories(251)))).toMatchObject({
    code: 'LIMIT_EXCEEDED',
    rule: 'bar-categories',
    path: '/xAxis/categories',
  });
});
test('composed bar + line with 251 categories is limited, line-only is not', () => {
  expect(catchErr(() => validateSpec(composedSpecWithCategories(251)))).toMatchObject({
    rule: 'bar-categories',
  });
  expect(validateSpec(lineSpecWithCategories(251)).kind).toBe('cartesian');
});
test('lowering barCategories still applies to bar axes only', () => {
  expect(
    catchErr(() => validateSpec(barSpecWithCategories(5), { limits: { barCategories: 4 } })),
  ).toMatchObject({ rule: 'bar-categories' });
  expect(validateSpec(lineSpecWithCategories(5), { limits: { barCategories: 4 } })).toBeDefined();
});
test('slots 0-3 solid, 4-7 patterned', () => {
  // theme.test.ts: a guard that already passes
  expect(themes.print.seriesStyles.slice(0, 4).every((s) => s.pattern === 'none')).toBe(true);
  expect(themes.print.seriesStyles.slice(4).map((s) => s.pattern)).toEqual([
    'diagonal',
    'dots',
    'crosshatch',
    'diagonal',
  ]);
});
test('generated files are up to date', () => {
  expect(runDriftCheck()).toEqual({ ok: true, diffs: [] });
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/schema.test.ts tests/unit/validate.test.ts tests/unit/theme.test.ts`. Expected: FAIL for the category tests (the 300-category spec hits `schema-maxItems`). The theme test is a guard over unchanged values and passes now; do not change the values to make it fail.
- [ ] **Step 3: Implement** the schema edit, `pnpm gen`, the `LIMIT_PATHS` and rule-id edits, the design-edit list items decided here (1–16, 18–22; item 17's opacity part and items decided by later tasks are written by those tasks) and the CHANGELOG. Record R47 and R48 in the slice-2 ledger.
- [ ] **Step 4: Run** the tests and `pnpm check:drift`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): category caps (250 for bars, 10,000 otherwise); fill policy and slice-2 design text`

---

### Task 3: Slice-2 fixtures and `report-slice2`

**Files:**

- Create: `fixtures/valid/{bar-severity-counts,bar-ranking-horizontal,bar-horizontal-grouped,bar-horizontal-stacked,bar-stacked-categories,bar-age-bands-percent,bar-compact-percent,bar-grouped,bar-negative-values,bar-long-labels,bar-all-zero,bar-fixed-domain-clipped,bar-quality-states,cartesian-empty-series,area-inventory-stacked,area-single-gaps,composed-revenue-margin,composed-remediation-days-counts,composed-flow-cumulative,donut-severity-share,donut-tiny-slices,donut-all-zero,donut-missing-slice,line-sparkline}.json` (24 fixtures), `fixtures/reports/report-slice2.json`
- Modify: `fixtures/index.ts` (entries; `FixtureEntry` gains `size?: { width: number; height: number }`, default 680 × 320, and `themeOverride?: "security"`, resolved from `examples/themes/security.json`)
- Test: `tests/unit/fixtures.test.ts`

**Interfaces:**

- Consumes: `validateSpec`, the slice-1 catalog helpers (`entry`, `loadFixture`, `specHash`).
- Produces: the fixture ids, values and catalog fields every later task asserts on, and `loadThemeOverride(entry): ThemeOverrides | undefined`.

All fixtures use `schemaVersion: 1`, print-safe text, and `slice: 2`, `gallery: true`, `modes: ["interactive","static","print"]` unless stated. Point ids are the first letter of their series id plus the 1-based position (`o1…o4` for `opened`) unless a fixture names them; slice ids are as listed. Every series has a `label` (given as `id "Label"`), and every reference line names its `axisId`. Values (category axis unless noted):

- `bar-severity-counts` (brief 2, `row:counts`), `themeOverride: "security"`: title `Findings by severity`; x `severity` categories `critical, high, medium, low`, labels `Critical, High, Medium, Low`; y `count` label `Findings`, unit `count`, include-zero; `roles` `critical|high|medium|low` with `label` only (`Critical`, `High`, `Medium`, `Low`; no colours); bar series `findings "Findings"` with points `c 12 (role critical)`, `h 31 (high)`, `m 84 (medium)`, `l 122 (low)`; `labels: { values: "all" }`.
- `donut-severity-share` (brief 2, `row:distributions`), `themeOverride: "security"`: title `Share of findings by severity`; slices (id, label, value) `critical Critical 12`, `high High 31`, `medium Medium 84`, `low Low 122`, each with the role of the same id; the same `roles`; `unit: "findings"`; `center: { value: "total", label: "Findings" }`; `legendValues: "value-share"`. Total 249.
- `donut-tiny-slices` (brief 7, `row:distributions`, `edge:donut-tiny`): title `Open items by age`; slices `d1 "Under 1 day" 120`, `d2 "1–7 days" 64`, `d3 "8–30 days" 30`, `d4 "31–90 days" 0`, `d5 "91–365 days" 4`, `d6 "Over 1 year" 2`; `unit: "items"`; default centre and legend. Total 220; shares 54.5, 29.1, 13.6, 0, 1.8, 0.9 %; slices 5 and 6 sit in palette slots 4 and 5, so their default `diagonal` and `dots` patterns render (R48 evidence).
- `composed-revenue-margin` (brief 3, `row:composed`): title `Revenue and margin by quarter`; x `quarter` with axis `label: "Quarter"`, categories `q1..q4`, labels `Q1 2026..Q4 2026`; y `usd` label `Revenue`, unit `USD`, format currency USD max 0 digits, include-zero; y `pct` label `Margin`, unit `%`, format percent max 1 digit, fixed 0–40; bar `rev "Revenue"` on `usd` `120000, 135000, 128000, 151000`; line `mar "Margin"` on `pct` `18.5, 21, 19.2, 23.4`; reference `goal` on `pct` at `20`, label `Margin goal`.
- `bar-age-bands-percent` (brief 4, `row:composition`): title `Open items by age band`; x `service` with axis `label: "Service"`, categories `svc-a, svc-b, svc-c, svc-d`, labels `Payments, Identity, Reporting, Archive`; y `share` label `Share of items` (no domain, format or unit); `stacking: { mode: "percent", valueUnit: "items", segmentLabels: "share" }`; stack `age` with bar series `a0 "0–30 days"` `10, 4, 0, 6`; `a1 "31–90 days"` `30, 12, 0, null`; `a2 "91+ days"` `0, 9, 0, 3` (point ids `a0-1…`, `a1-1…`, `a2-1…`). So svc-a shares 25/75/0, svc-b 16/48/36, svc-c empty (total 0), svc-d unavailable (missing member).
- `bar-negative-values` (brief 7, `edge:negative`): title `Net change in open items`; x `month` categories `jan..jun`, labels `Jan..Jun`; y `change` label `Change`, unit `items`, include-zero; bar `net "Net change"` `12, -8, 0, -15, 22, 5`; `labels: { values: "all" }`.
- `bar-long-labels` (brief 7, `edge:long-labels`): title `Open items by service`; x `service`, 8 categories `s1..s8` with labels `Customer Identity Verification`, `Payments Settlement Gateway`, `Regional Logistics Planner`, `Internal Reporting Warehouse`, `Partner Onboarding Portal`, `Mobile Banking Backend`, `Document Archive Service`, `Notification Delivery Hub`; y `count` unit `items`; bar `open "Open items"` `42, 17, 33, 8, 25, 51, 12, 29`. At 680 × 320 print the labels must reach the `rotate` stage (Task 8 asserts it; if measurement shows `wrap`, lengthen the labels, never change the assertion).
- `bar-all-zero` (brief 7, readiness §9): title `Items reopened`; x `week` categories `w1..w4`, labels `6 Jul, 13 Jul, 20 Jul, 27 Jul`; y `count` unit `items`; bar `reopened "Reopened"` `0, 0, 0, 0`.
- `bar-fixed-domain-clipped` (extra, `edge:fixed-domain-clip`, R73): title `Patch coverage by week`; x `week` categories `w1..w5`, labels `Week 1..Week 5`; y `pct` label `Coverage`, unit `%`, `domain: { policy: "fixed", min: 0, max: 100, overflow: "clip-indicated" }`; bar `cov "Coverage"` `40, 130, 85, 112, 60`. Two bars exceed the fixed maximum, so the committed value domain must stay `[0, 100]` (never widened to 130), `c2` and `c4` are clipped `above` with clip breaks at the plot top, and the note reads `2 values above 100 are clipped at the top edge (max 130)`. Values stay non-negative so the case isolates the top-edge clip.
- `bar-quality-states` (extra, `edge:bar-quality`, R50, R73): title `Items closed by region`; x `region` categories `north, south, east, west`, labels `North, South, East, West`; y `count` unit `items`, include-zero; bar `closed "Closed"` `14, 22, 9, 17` with `c2` `quality: "estimated"`, `c3` `quality: "lagging"` and `c4` `quality: "partial"`. It proves the dashed outline (estimated), ringed marker (lagging) and hollow marker (partial) in the browser, the exported SVG and the PDF, with the three legend entries.
- `cartesian-empty-series` (brief 7, readiness §9): title `No data yet`; x `cat` categories `a, b, c`; y `count` unit `items`; bar `b "Opened"` with `points: []`, line `l "Backlog"` with `points: []`. `gallery: false`, `modes: ["interactive","static"]`.
- `composed-remediation-days-counts` (brief 10, `row:composed`): title `Remediation time and resolved items`; x `month` categories `jan..jun`, labels `Jan..Jun`; y `count` label `Resolved`, unit `count`, include-zero, position left; y `days` label `Median time to remediate`, unit `days`, format max 0 digits, position right (default fit); bar `resolved "Resolved items"` on `count` `34, 41, 38, 52, 47, 29`; line `days "Median days"` on `days` `41, 38, 36, 31, 28, 25` with `d5` `quality: "lagging"` and `d6` `quality: "partial"`, `renderHint: "marker-only"`; reference `target` on `days` at `30`, label `30-day target`; annotation `a1` at `may`, label `Process change`, detail `Triage moved to the service teams on 4 May.`
- `composed-flow-cumulative` (brief 10, `row:composed`): title `Inflow, outflow and cumulative balance`; x `week` categories `w1..w6`, labels `Week 1..Week 6`; y `count` label `Items`, unit `items`, include-zero; y `balance` label `Balance`, unit `items`, position right (fit); bars `inflow "Inflow"` `20, 18, 25, 15, 12, 22` and `outflow "Outflow"` `15, 24, 28, 21, 14, 16` (grouped, no stackId, both on `count`); line `balance "Cumulative balance"` on `balance` `5, -1, -4, -10, -12, -6` (supplied by the caller, never computed) with `b6` `quality: "lagging"`; reference `even` on `balance` at `0`, label `Break-even`; annotation `a1` at `w4`, label `Backlog drive`, detail `Extra triage capacity from week 4.`
- `bar-ranking-horizontal` (brief 11, `row:counts`, `edge:horizontal`): title `Oldest open items by service`; `orientation: "horizontal"`; x `service` with axis `label: "Service"`, 10 categories `r1..r10` with labels `Customer Identity Verification`, `Payments Settlement Gateway`, `Regional Logistics Planner`, `Internal Reporting Warehouse`, `Partner Onboarding Portal`, `Mobile Banking Backend`, `Document Archive Service`, `Notification Delivery Hub`, `Fleet Telemetry Collector`, `Billing Reconciliation Engine`; y `days` label `Open age`, unit `days`, include-zero; `roles` `overdue` (`label: "Overdue"`, `color: "#a61b1b"`, `pattern: "diagonal"`) and `ontrack` (`label: "On track"`); bar `age "Open age"` `68, 61, 55, 47, 40, 33, 28, 21, 14, 6` (caller rank order), points 1–4 `role: "overdue"`, the rest `ontrack`; reference `limit` on `days` at `30`, label `30-day threshold`; `labels: { values: "all" }`.
- `bar-horizontal-grouped` (extra, `row:counts`, `edge:horizontal`): title `Items by region, horizontal`; `orientation: "horizontal"`; x `region` categories `north, south, east, west`, labels `North, South, East, West`; y `count` label `Items`, unit `items`, include-zero; bars `opened "Opened"` `14, 22, 9, 17`, `closed "Closed"` `11, 25, 9, 12`, `reopened "Reopened"` `2, 0, null, 3` (grouped, no stackId; the same data as `bar-grouped`, so both orientations carry identical meaning).
- `bar-horizontal-stacked` (extra, `row:counts`, `edge:horizontal`, `edge:stack-mixed-sign`): title `Net item flow by team`; `orientation: "horizontal"`; x `team` categories `t1..t4`, labels `Platform, Payments, Identity, Reporting`; y `items` label `Items`, unit `items`, include-zero; `stacking: { mode: "absolute" }`; stack `flow` with `added "Added"` `12, 8, 15, 5`, `removed "Removed"` `-7, -10, -4, -9`, `moved "Moved"` `3, -2, 0, 4`; `labels: { values: "totals" }`. Totals 8, −4, 11, 0.
- `bar-stacked-categories` (brief 11, `row:counts`, `edge:stack-partial`): title `Open items by service and severity`; x `service` categories `svc-a..svc-e`, labels `Payments API, Identity Service, Reporting Jobs, Archive Store, Edge Gateway`; y `count` unit `items`, include-zero; `stacking: { mode: "absolute" }`; stack `sev` with `crit "Critical"` `4, 2, 6, null, 1`, `high "High"` `12, 9, 15, 11, 3`, `med "Medium"` `20, 31, 18, 25, 2`; reference `cap` on `count` at `40`, label `Capacity`; `labels: { values: "totals" }`. Totals 36, 42, 39, 36 (partial), 6; svc-e's `crit` 1 is a tiny segment drawn at its true height.
- `bar-compact-percent` (brief 11, `row:composition`, `edge:compact-stack`), `size: 680 × 220`: title `Service compliance`; `preset: "compact-stack"`, `orientation: "horizontal"`; x `scope` with one category `all`, label `All services`; y `share` (no domain, format or unit); `stacking: { mode: "percent", valueUnit: "services", segmentLabels: "share" }`; stack `c` with `ok "Compliant"` 312, `minor "Minor gaps"` 71, `major "Major gaps"` 16, `crit "Critical gaps"` 1. Shares 78, 17.75, 4, 0.25.
- `bar-grouped` (extra, `row:counts`): title `Items by region`; x `region` categories `north, south, east, west`, labels `North, South, East, West`; y `count` unit `items`; bars `opened "Opened"` `14, 22, 9, 17` (point `o4` `quality: "partial"`), `closed "Closed"` `11, 25, 9, 12`, `reopened "Reopened"` `2, 0, null, 3`.
- `area-inventory-stacked` (extra, `row:open-item-trends`): title `Managed assets by type`; x `month` categories `jan..aug`, labels `Jan..Aug`; y `assets` unit `assets`, include-zero; `stacking: { mode: "absolute" }`; stack `inv` with area series `servers "Servers"` `120, 124, 130, 133, 135, 140, 138, 142`, `laptops "Laptops"` `210, 215, 220, 226, null, 231, 236, 240`, `mobile "Mobile devices"` `80, 84, 90, 95, 97, 101, 104, 110`.
- `area-single-gaps` (extra, `row:open-item-trends`): title `Open items, weekly`; x `week` categories `w1..w10`; y `count` unit `items`, include-zero; area `open "Open items"` with point ids equal to the category keys (`w1…w10`) and values `12, 14, null, 18, 17, 21, 19, 22, 24, 26`, with `w6` `quality: "partial"`, `renderHint: "marker-only"`, and `w9`, `w10` `quality: "estimated"`. Segments `[w1,w2]`, `[w4,w5]`, `[w7..w10]` with estimated range `[w8,w10]`.
- `donut-all-zero` (brief 7, `row:distributions`, `edge:donut-zero`): title `Overdue items by age`; slices `a "0–30 days" 0`, `b "31–90 days" 0`, `c "91+ days" 0`; unit `items`.
- `donut-missing-slice` (brief 7, `row:distributions`, `edge:donut-missing`): title `Encryption coverage`; slices `full "Full" 12`, `part "Partial" null`, `none "None" 7`, `unk "Unknown" 3`; unit `systems`.
- `line-sparkline` (extra, `row:open-item-trends`, `edge:sparkline`), `size: 680 × 180`: title `API latency, July`; `preset: "sparkline"`; time axis `day`; y `ms` label `p95 latency`, unit `ms`; line `lat "p95 latency"` with point ids `p1…p30` over `2026-07-01`…`2026-07-30` and values `212, 208, 215, 220, 218, 225, 231, 228, 224, 219, 226, null, 233, 240, 236, 229, 222, 218, 214, 221, 227, 235, 242, 238, 231, 226, 219, 215, 210, 207`. The sparkline label line uses the **series** label.
- `report-slice2`: `[{sc-a: bar-severity-counts}, {sc-b: bar-severity-counts}, {rh: bar-ranking-horizontal}, {hg: bar-horizontal-grouped}, {hs: bar-horizontal-stacked}, {gr: bar-grouped}, {st: bar-stacked-categories}, {ab: bar-age-bands-percent}, {cp: bar-compact-percent}, {nv: bar-negative-values}, {ll: bar-long-labels}, {bz: bar-all-zero}, {ai: area-inventory-stacked}, {ag: area-single-gaps}, {rm: composed-revenue-margin}, {rd: composed-remediation-days-counts}, {cf: composed-flow-cumulative}, {ds: donut-severity-share}, {dt: donut-tiny-slices}, {dz: donut-all-zero}, {dm: donut-missing-slice}, {sp: line-sparkline}, {bc: bar-fixed-domain-clipped}, {bq: bar-quality-states}]`, written as `{ "fixture": …, "namespace": … }` entries in that order (24 instances of 23 fixtures, two of `bar-severity-counts`; `cartesian-empty-series` is not a print fixture).

- [ ] **Step 1: Write the failing tests:** every new fixture passes `validateSpec`; the 24 new ids are catalogued with `slice: 2` (alongside the existing slice-2 `min-*` entries); every series has a non-empty `label` and every reference line an `axisId` that exists; `size` is `680×220` for `bar-compact-percent`, `680×180` for `line-sparkline` and absent elsewhere; `themeOverride` is `security` exactly for the two severity fixtures and `loadThemeOverride` returns the parsed `examples/themes/security.json`; `report-slice2` lists `bar-severity-counts` twice with distinct namespaces; **no namespace appears in both `report-slice1` and `report-slice2`** (their PDF crops share `evidence/pdf/crops/`); every report namespace matches `^[a-z][a-z0-9-]{0,31}$`; no slice-2 fixture has more than 250 categories.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/fixtures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Author** the fixtures and catalog entries (coverage tags `brief-<n>`, `row:<name>` with new rows `row:counts`, `row:composition`, `row:composed`, `row:distributions`, and the `edge:<name>` tags given above plus `edge:all-zero`, `edge:empty-series`, `edge:percent-states`, `edge:fixed-domain-clip`, `edge:bar-quality`).
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `test(fixtures): slice-2 bar, area, composed, donut and preset fixtures and report-slice2`

---

### Task 4: Bar series model, roles, composed charts and the render guard

**Files:**

- Create: `src/render/model/{bars.ts,roles.ts}`
- Modify: `src/render/model/{types.ts,cartesian.ts,manifest.ts}`, `src/render/pipeline.ts`
- Modify (narrowing only, no behaviour change): `src/render/recharts/{overlays.tsx,ids.ts}`, `src/render/primitives/Legend.tsx`, `src/react/interaction.ts` — every place that treats `model.series` as lines filters `s.mark === 'line'`
- Test: `tests/unit/model-bar.test.ts`; modify `tests/unit/model-line.test.ts` (the `min-bar` unsupported assertion becomes a bar-model assertion) and `tests/browser/mount.spec.ts` (keeps its `min-donut` `/slice 2/` assertion green: see the guard reason text)

**Interfaces:**

- Consumes: `buildCartesianModel`, `roleLookup`, `buildValueScale`, `buildMarkers`, `variantOf`, `buildManifest` (slice 1), `Theme.seriesStyles`, R48, the Task 1 point-11 result, Task 3 fixtures.
- Produces:
  - `type FillPattern = "none" | "diagonal" | "dots" | "crosshatch"`.
  - `LineSeriesModel` gains `mark: "line"`. `type SeriesModel = LineSeriesModel | BarSeriesModel | AreaSeriesModel` (`AreaSeriesModel` lands in Task 5; until then the union has two members). `CartesianModel.series: SeriesModel[]`.
  - `BarSeriesModel = { mark: "bar"; id; label; axisId; stackId?: string; style: { color: string; pattern: FillPattern }; points: PointModel[]; bars: BarModel[]; markers: MarkerModel[]; clipped: ClippedModel[] }`.
  - `BarModel = { pointId: string; xKey: string; value: number; state: "measured" | "zero"; quality: Quality; lower: number; upper: number }` (one per non-null point, in point order; nulls and absent points have no entry). For an unstacked bar `[lower, upper]` is `[min(0, value), max(0, value)]`; Task 5 fills it from `stackExtent` for stack members.
  - `PointModel` gains `pattern?: FillPattern` and `roleId?: string`.
  - `roles.ts`: `resolveRole(spec, theme, roleId): { color: string; pattern?: FillPattern; shape?: MarkerShape; label: string }` — colour `spec.roles[id].color` > `theme.roles[id].color` > palette slot by the role's position in `Object.keys(spec.roles)` (mod 8); pattern from the spec role, the theme role, else that slot's pattern; label `spec.roles[id].label ?? id`. Datum precedence stays §5.1: datum `color` > datum role > series `color` > series role > series slot.
  - `LegendItem.kind` gains `"role"` (`label`, `color`, `pattern`, `swatch: "fill"` for bar/area datums, `"marker"` for line datums). Each role used by a drawn datum appears once, in `spec.roles` order, after the series items; a series whose every drawn datum has a role gets no series item (its role items replace it). **A series-level `role` produces no role item:** it only colours the series (§5.1), and the series keeps its own legend item labelled with the series label; role items come from datum-level roles only. This keeps the slice-1 test in `tests/unit/model-line.test.ts` (series role `hot`, legend `Opened, Closed, Partial, Lagging`) green.
  - `CartesianModel` gains `orientation: "vertical" | "horizontal"`, `preset: "standard" | "sparkline" | "compact-stack"` and `barSlots: BarSlot[]` with `BarSlot = { kind: "series" | "stack"; id: string }` (R61): the order Recharts places bars in a band, each unstacked bar series as `{ kind: "series" }` or a stack as `{ kind: "stack" }` at its first member's position. Slot keys used elsewhere are `series:<id>` / `stack:<id>`, so a series and a stack sharing an id never collide.
  - Manifest keys `series:<id>:bar` (count = bars incl. zero), and the existing `series:<id>:marker` and `series:<id>:clip-indicator` for bar series.
  - In `pipeline.ts`: `RENDERED_MARKS: ReadonlySet<Series["mark"]>` (initially `line`), `RENDERED_KINDS` (initially `cartesian`), `RENDERED_PRESETS` (initially `standard`), and `RENDERED_ORIENTATIONS` (initially `vertical`); `buildLaid` throws `notImplemented(spec, reason)` for an unlisted value before layout. Reason texts keep the slice named, so slice-1 assertions on `/slice 2/` hold: `bar series are drawn later in slice 2`, `area series are drawn later in slice 2`, `donut charts are drawn later in slice 2`, `the sparkline preset is drawn later in slice 2`, `the compact-stack preset is drawn later in slice 2`, `horizontal bars are drawn later in slice 2`; scatter, heatmap and progress keep their `slice 3` reasons.
- Rules:
  - A y axis with no `domain` defaults to `include-zero` when any bar series binds to it, else `fit` (§5.2 ValueAxis comment; slice 1 always used `fit`, correct only because it had no bars). An include-zero axis whose data are all zero resolves to `[0, 1]` (slice-1 collapse rule). Auto-domain data for bars is `lower` and `upper` (for stacks, Task 5's extents).
  - Bar quality (R50): `partial` → hollow marker and `lagging` → ringed marker at the bar's value end (reason `quality`, variants from `variantOf`); `estimated` → no marker, dashed bar outline (Task 11a) and a legend entry `Estimated — Dashed outline: the value is estimated.` (`variant: "dashed-outline"`). Each quality that draws something is listed, as for lines.
  - `clip-indicated` bar axes: a bar whose `upper > max` is clipped `above`, `lower < min` `below`; it records `{ pointId, side }` in `clipped` and the slice-1 clip note.
  - **Bars on two y axes (R52, R58):** valid specs stay valid (design §20). `barSlots` spans all bar series whatever their axis. If Task 1 point 11 shows Recharts places bars on different axes side by side, they render through Recharts as usual; if it overlaps them, Task 11a draws those bars as DravenViz rectangles from `slotGeometry` and each bar's own axis scale (the fallback-H mechanism) inside the same `ComposedChart`. No validation rule is added.

- [ ] **Step 1: Write the failing tests** (`ctx = { theme: themes.print, locale: 'en-US', timezone: 'UTC' }`; add `model`, `modelOf`, `series`, `seriesWithTheme`, `barSpec`, `groupedBarSpec` to `tests/unit/helpers/slice2.ts` first):

```ts
test('min-bar: measured zero is a drawn bar; bar axis includes zero', () => {
  const m = model('min-bar');
  const s = m.series[0] as BarSeriesModel;
  expect(s.bars.map((b) => [b.pointId, b.value, b.state])).toEqual([
    ['n', 4, 'measured'],
    ['s', 0, 'zero'],
  ]);
  expect(m.yAxes[0].domain[0]).toBe(0);
  expect(m.manifest.groups).toContainEqual({ key: 'series:items:bar', count: 2 });
});
test('bar axis without a domain defaults to include-zero', () => {
  expect(modelOf(barSpec({ values: [40, 55], domain: undefined })).yAxes[0].domain[0]).toBe(0);
});
test('null bar is absent, never zero', () => {
  const r = series('bar-grouped', 'reopened') as BarSeriesModel;
  expect(r.bars.map((b) => b.pointId)).toEqual(['r1', 'r2', 'r4']);
  expect(r.bars[1]).toMatchObject({ value: 0, state: 'zero', lower: 0, upper: 0 });
});
test('negative bars grow from zero; domain covers both signs', () => {
  const y = model('bar-negative-values').yAxes[0];
  expect(y.domain[0]).toBeLessThanOrEqual(-15);
  expect(y.domain[1]).toBeGreaterThanOrEqual(22);
  expect(y.ticks.map((t) => t.value)).toContain(0);
});
test('grouped bars keep series order as tagged slots', () => {
  expect(model('bar-grouped').barSlots).toEqual([
    { kind: 'series', id: 'opened' },
    { kind: 'series', id: 'closed' },
    { kind: 'series', id: 'reopened' },
  ]);
});
test('series and stack sharing an id get distinct slots', () => {
  const m = modelOf(
    barSpec({
      series: [
        { id: 'flow', values: [1] },
        { id: 'a', stackId: 'flow', values: [2] },
        { id: 'b', stackId: 'flow', values: [3] },
      ],
      stacking: 'absolute',
    }),
  );
  expect(m.barSlots).toEqual([
    { kind: 'series', id: 'flow' },
    { kind: 'stack', id: 'flow' },
  ]);
});
test('bars on two y axes share slots across both axes', () => {
  const m = modelOf(
    barSpec({
      series: [
        { id: 'a', axis: 'left', values: [1] },
        { id: 'b', axis: 'right', values: [2] },
      ],
    }),
  );
  expect(m.barSlots).toEqual([
    { kind: 'series', id: 'a' },
    { kind: 'series', id: 'b' },
  ]);
});
test('partial bar gets a hollow marker; estimated bar a legend entry', () => {
  expect((series('bar-grouped', 'opened') as BarSeriesModel).markers).toEqual([
    { pointId: 'o4', reason: 'quality', variant: 'hollow' },
  ]);
  expect(model('bar-grouped').legend.some((l) => l.id === 'quality:partial')).toBe(true);
  const est = modelOf(barSpec({ values: [3, 4], qualities: [undefined, 'estimated'] }));
  expect(est.legend.find((l) => l.id === 'quality:estimated')).toMatchObject({
    variant: 'dashed-outline',
  });
});
test('clip-indicated bar records a break and a note', () => {
  const m = modelOf(
    barSpec({
      values: [20, 80],
      domain: { policy: 'fixed', min: 0, max: 50, overflow: 'clip-indicated' },
    }),
  );
  expect((m.series[0] as BarSeriesModel).clipped).toEqual([{ pointId: 'p2', side: 'above' }]);
  expect(m.notes).toEqual([expect.stringMatching(/1 value above 50 .*clipped/)]);
});
test('dual axes keep separate domains and units', () => {
  const m = model('composed-revenue-margin');
  expect(m.yAxes.map((a) => [a.id, a.unit, a.position])).toEqual([
    ['usd', 'USD', 'left'],
    ['pct', '%', 'right'],
  ]);
  expect(m.yAxes[0].domain[0]).toBe(0);
  expect(m.yAxes[0].domain[1]).toBeGreaterThanOrEqual(151000);
  expect(m.yAxes[1].domain).toEqual([0, 40]);
  expect(m.referenceLines[0].axisId).toBe('pct');
});
test('cumulative balance axis fits negative values; bar axis includes zero', () => {
  const [count, balance] = model('composed-flow-cumulative').yAxes;
  expect(count.domain[0]).toBe(0);
  expect(balance.domain[0]).toBeLessThanOrEqual(-12);
  expect(balance.domain[1]).toBeGreaterThanOrEqual(5);
});
test('line markers bind to the right axis in a composed chart', () => {
  const d = series('composed-remediation-days-counts', 'days') as LineSeriesModel;
  expect(d.axisId).toBe('days');
  expect(d.markers.map((k) => [k.pointId, k.reason])).toEqual([
    ['d5', 'quality'],
    ['d6', 'marker-only'],
  ]);
});
test('roles without colours fall back to palette slots; the override supplies colours and patterns', () => {
  const plain = series('bar-severity-counts', 'findings') as BarSeriesModel;
  expect(plain.points.map((p) => p.color)).toEqual(themes.print.palette.slice(0, 4));
  expect(plain.points.map((p) => p.pattern)).toEqual(['none', 'none', 'none', 'none']);
  const sec = seriesWithTheme(
    'bar-severity-counts',
    'findings',
    resolveTheme('print', readJson('examples/themes/security.json')),
  ) as BarSeriesModel;
  expect(sec.points.map((p) => p.pattern)).toEqual(['crosshatch', 'diagonal', 'dots', 'none']);
  expect(sec.points[0].color).toBe('#7f1d1d');
});
test('datum colour beats datum role', () => {
  const m = modelOf(
    barSpec({
      values: [1, 2],
      roles: { r: { label: 'R', color: '#111111' } },
      pointRoles: ['r', 'r'],
      pointColors: ['#222222', undefined],
    }),
  );
  expect((m.series[0] as BarSeriesModel).points.map((p) => p.color)).toEqual([
    '#222222',
    '#111111',
  ]);
});
test('every role used by a drawn datum has a legend entry; series roles do not', () => {
  const m = model('bar-ranking-horizontal');
  expect(m.legend.map((l) => [l.kind, l.label, l.color, l.pattern])).toEqual([
    ['role', 'Overdue', '#a61b1b', 'diagonal'],
    ['role', 'On track', themes.print.palette[1], 'none'],
  ]);
  expect(model('bar-severity-counts').legend.map((l) => l.label)).toEqual([
    'Critical',
    'High',
    'Medium',
    'Low',
  ]);
  expect(
    modelOf(barSpec({ values: [1], roles: { hot: {} }, seriesRole: 'hot' })).legend.map(
      (l) => l.kind,
    ),
  ).toEqual(['series']);
});
test('slots 0-3 solid, 4-7 patterned; lines never patterned', () => {
  const m = modelOf(groupedBarSpec(6));
  expect(m.series.map((s) => (s as BarSeriesModel).style.pattern)).toEqual([
    'none',
    'none',
    'none',
    'none',
    'diagonal',
    'dots',
  ]);
  expect('pattern' in (model('line-weekly-flow').series[0] as LineSeriesModel).style).toBe(false);
});
test('bar-all-zero: four zero bars, domain [0, 1]', () => {
  const m = model('bar-all-zero');
  expect((m.series[0] as BarSeriesModel).bars.every((b) => b.state === 'zero')).toBe(true);
  expect(m.yAxes[0].domain).toEqual([0, 1]);
  expect(m.state).toBe('ok');
});
test('cartesian-empty-series: empty state, no series groups', () => {
  const m = model('cartesian-empty-series');
  expect(m.state).toBe('empty');
  expect(m.manifest.groups).toEqual([{ key: 'empty-state', count: 1 }]);
});
test('horizontal orientation is carried', () => {
  expect(model('bar-ranking-horizontal')).toMatchObject({
    orientation: 'horizontal',
    preset: 'standard',
  });
});
test('buildLaid rejects families, presets and orientations until their renderer lands', () => {
  for (const [id, re] of [
    ['min-bar', /bar series .*slice 2/],
    ['line-sparkline', /sparkline preset .*slice 2/],
  ] as const)
    expect(catchErr(() => buildLaid(validateSpec(loadFixture(id)), layoutInput))).toMatchObject({
      code: 'RENDER_FAILED',
      message: expect.stringMatching(re),
      issues: [{ rule: 'not-implemented-in-slice' }],
    });
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-bar.test.ts tests/unit/model-line.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `bars.ts` builds `BarSeriesModel`; `roles.ts` resolves roles and their legend items; `cartesian.ts` dispatches per mark, computes the include-zero default and `barSlots`; area series still report `unsupported` until Task 5. Read Task 1 point 11 and note in the ledger which R58 rendering branch applies; record R49, R50, R52, R58 and R61 (tagged slots) in the slice-2 ledger. Keep every slice-1 line test green (the line model's JSON output is unchanged except for the added `mark: "line"` and the new top-level fields).
- [ ] **Step 4: Run** them, plus `pnpm test` and `pnpm test:browser --project browser tests/browser/mount.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): bar series model, tagged slots, role legend, composed axes and the render guard`

---

### Task 5: Stacks, cumulative extents and the area series model

**Files:**

- Create: `src/core/shares/index.ts` (internal: imported by path from `render/model`, `core/table` and `core/validate`, not re-exported from `src/core/index.ts`), `src/core/validate/semantic/sums.ts`, `fixtures/invalid/sum-not-finite.json` (+ `.expected.json`), `src/render/model/{stacks.ts,areas.ts}`
- Modify: `src/render/model/{types.ts,cartesian.ts,bars.ts,manifest.ts}`, `src/core/validate/semantic/cartesian-domains.ts` (its stack-sum loop reuses `stackPositions`), `src/core/validate/semantic/cartesian.ts` (calls the stack check from `sums.ts`)
- Test: `tests/unit/model-stack.test.ts`, `tests/unit/validate.test.ts`; modify `tests/unit/model-line.test.ts` (the `min-area` unsupported assertion)

**Interfaces:**

- Consumes: Task 4 model types, `buildSegments`, `buildMarkers`, `parseTimeValue`, `formatNumber`.
- Produces:
  - `stackPositions(spec: CartesianSpec): StackPositions[]` in `core/shares`, where `StackPositions = { stackId; mark: "bar" | "area"; mode: "absolute" | "percent"; axisId; members: string[]; positions: { xKey: string | number; xValue: number; state: "ok" | "partial" | "unavailable" | "empty"; total: number | null; members: { seriesId; value: number | null; share?: number; lower: number; upper: number }[] }[] }`. It is the single source of stack arithmetic for the model, the table, the validator, the export summary and tooltips.
    - **Positions key by resolved x (R68):** category index, number for linear, `parseTimeValue(x).epochMs` for time; `xKey` keeps the first raw value for display. Equal instants written with different offsets share one position.
    - Positions are every category (category axis) or the union of member x values in ascending order (linear/time area stacks).
    - **A member with no point at a position counts as a null member (R27).**
    - Absolute: per position, positives accumulate upward from 0 and negatives downward from 0 in series order; `total` = signed sum of measured members; a missing member makes the state `partial` (`lower = upper` = the running end of its sign side, zero extent; R65). An area stack with any missing member at a position is `unavailable` there.
    - Percent: any missing member → `unavailable`, every `share` undefined; total 0 → `empty`; otherwise `share = value / total × 100` and `[lower, upper]` accumulate the shares.
  - `stackExtent(stacks, stackId, xValue, seriesId): { lower: number; upper: number; end: number }` (`end` = `upper` for positive members, `lower` for negative), the one accessor every consumer uses (R56).
  - **Cumulative-coordinate contract (R56):** for every stacked member,
    - (a) auto-domain data is every member's `lower` and `upper`, never the raw values;
    - (b) clipping under `clip-indicated`: clipped `above` when `upper > max`, `below` when `lower < min`; `ClippedModel` records the member; the model and `core/table` read the clip state from `stackPositions`, never compare raw values; the clip note's `(max …)` / `(min …)` reports the cumulative extent (`upper` 80 for `40 + 40`, not the raw 40), and the table cell keeps the member's raw value;
    - (c) quality, partial and marker-only markers sit at the member's `end` (the cumulative endpoint);
    - (d) value labels, focus positions and hit rectangles (Tasks 11a, 11b, 15) use `[lower, upper]`.
      The validator's existing cumulative sum loop in `cartesian-domains.ts` reuses `stackPositions`, so validation and rendering agree by construction.
  - **`sum-not-finite` (R67):** `src/core/validate/semantic/sums.ts` rejects a stack position whose finite inputs sum to a non-finite value (for example `1e308 + 1e308`) with `INVALID_SPEC`, rule `sum-not-finite`, path of the position's first member point; Task 6 adds the donut case, called from `semantic/donut.ts`. Like `x.position` today, the check skips points whose x cannot be resolved (an invalid time reported by its own rule), so it never throws on unresolved input. Such specs cannot render today, so the rule invalidates nothing that worked.
  - `StackModel = StackPositions` on `CartesianModel.stacks`, plus `CartesianModel.stacking?: { mode; valueUnit?: string; segmentLabels: "none" | "share" | "value" | "value-and-share" }` (percent default `share`, absolute default `none`).
  - `AreaSeriesModel = { mark: "area"; id; label; axisId; stackId?: string; style: { color; dash; shape; width; pattern: FillPattern }; interpolation; baseline: number; points: PointModel[]; segments: SegmentModel[]; markers: MarkerModel[]; clipped: ClippedModel[] }`.
    - Unstacked areas segment exactly like lines (gaps, marker-only, isolated markers, estimated ranges).
    - **Stacked areas (R57):** a member's segments break at every position its stack marks `unavailable` (a `null` or absent member gaps the whole stack) **and** at its own `renderHint: "gap"` and `"marker-only"` points, which break only that member's band (its value is known, so the members above keep their `lower` baseline). Marker-only and isolated stacked points get their marker at `end`. Estimated ranges apply per member segment. `interpolation: "monotone"` interpolates each member segment separately; a member's lower edge follows the member below's upper edge only within a run where both members are continuous with identical x sets, and the renderer draws each segment's lower edge from the same `[lower, upper]` values, so shared edges coincide.
    - **Baseline (R66):** `baseline` is 0 when the axis domain includes 0, else the domain edge nearest 0; the first stack member (or an unstacked area) fills from `baseline`, and the model adds the note `Area filled from the axis minimum <formatted min>, not from zero.` (or `… axis maximum <formatted max> …`), once per axis.
  - `ValueLabelModel = { kind: "bar" | "total" | "segment"; seriesId?: string; stackId?: string; xKey: string; value: number; text: string; sign: 1 | -1 }` on `CartesianModel.valueLabels`. Texts: bar and total labels use `displayValue` or the axis format; a partial total reads `36 (partial)`; segment labels read `25%` (`share`), `10 items` (`value`) or `10 items (25%)` (`value-and-share`), the share formatted `{ style: "percent", maximumFractionDigits: 1 }`. **Segment labels (R60)** are created for every drawn nonzero member, of either sign, at positions in state `ok` or `partial` (share text only in percent mode, where `partial` cannot occur); a zero member (including a 0 % share) has no geometry and no label, and the table carries it. `sign` is the member's sign. Layout (Task 8) decides fit and names omissions. `labels.values: "totals"` labels stack totals and bars alone in their band (design §5.2 "ungrouped bars"); `"all"` additionally labels grouped bars; stack segments are labelled only through `stacking.segmentLabels`; line and area points are never labelled here (slice 3 owns point labels). A total's `sign` is the sign of the signed sum (0 counts as positive).
  - **Partial cue (R65):** `CartesianModel.partialCues: { stackId; xKey; missing: string[] }[]` for every `partial` absolute position, always (independent of `labels.values`); legend quality entry `Partial stack — Hollow marker: a stack member is not measured.` (`variant: "hollow"`); note `Partial stacks: <category label> — <member label> not measured; …` (one note listing every partial position, members joined by `, `). Manifest key `stack:<id>:partial` (count of partial positions).
  - The y axis bound to a percent stack: domain `[0, 100]`, format percent, `unit: "% of total"` (validation already forbids a caller domain, format or unit there).
  - Manifest keys `series:<id>:area` (count = area segments), `series:<id>:estimated` for areas, `stack:<id>:unavailable`, `stack:<id>:empty` and `stack:<id>:partial`.
- Recharts feed (consumed by Tasks 11a, 11b, 12): absolute bar stacks pass raw values with chart-level `stackOffset="sign"`; percent stacks pass `share` with `stackOffset="none"`; unavailable and empty positions pass `null` for every member. Stacked areas use the Task 1 strategy (ranged `[lower, upper]` per member segment when 12b passed). `stacking.mode` is chart-level, so one chart never needs both offsets.

- [ ] **Step 1: Write the failing tests** (add `stackSpec` to the helpers first):

```ts
test('percent shares are exact, no minimum size', () => {
  const st = model('bar-age-bands-percent').stacks[0];
  expect(st.positions[0].members.map((m) => m.share)).toEqual([25, 75, 0]);
  expect(st.positions[1].members.map((m) => m.share)).toEqual([16, 48, 36]);
  expect(model('bar-compact-percent').stacks[0].positions[0].members.map((m) => m.share)).toEqual([
    78, 17.75, 4, 0.25,
  ]);
});
test('missing member makes the category unavailable, never renormalised', () => {
  const p = model('bar-age-bands-percent').stacks[0].positions;
  expect(p[2]).toMatchObject({ state: 'empty', total: 0 });
  expect(p[3]).toMatchObject({ state: 'unavailable' });
  expect(p[3].members.every((m) => m.share === undefined)).toBe(true);
  expect(model('bar-age-bands-percent').manifest.groups).toEqual(
    expect.arrayContaining([
      { key: 'stack:age:empty', count: 1 },
      { key: 'stack:age:unavailable', count: 1 },
    ]),
  );
});
test('absent point counts as a missing member', () => {
  expect(
    modelOf(stackSpec({ mode: 'percent', a: [5, 5], b: [5, 'absent'] })).stacks[0].positions[1]
      .state,
  ).toBe('unavailable');
  expect(
    modelOf(stackSpec({ mode: 'absolute', a: [5, 5], b: [5, 'absent'] })).stacks[0].positions[1],
  ).toMatchObject({ state: 'partial', total: 5 });
  const area = modelOf(
    stackSpec({
      mark: 'area',
      xScale: 'linear',
      a: { x: [0, 1, 2], v: [1, 2, 3] },
      b: { x: [0, 2], v: [4, 5] },
    }),
  ).stacks[0].positions;
  expect(area.map((p) => p.state)).toEqual(['ok', 'unavailable', 'ok']);
});
test('equal instants with different offsets share a position', () => {
  const s = modelOf(
    stackSpec({
      mark: 'area',
      xScale: 'time',
      a: { x: ['2026-07-01T00:00:00Z'], v: [1] },
      b: { x: ['2026-07-01T02:00:00+02:00'], v: [2] },
    }),
  ).stacks[0];
  expect(s.positions).toHaveLength(1);
  expect(s.positions[0]).toMatchObject({ state: 'ok', total: 3 });
});
test('cumulative overflow clips the upper member', () => {
  const m = modelOf(
    stackSpec({
      a: [40],
      b: [40],
      domain: { policy: 'fixed', min: 0, max: 50, overflow: 'clip-indicated' },
    }),
  );
  expect(m.series.map((s) => (s as BarSeriesModel).clipped)).toEqual([
    [],
    [{ pointId: 'b1', side: 'above' }],
  ]);
  expect(m.notes).toEqual(['1 value above 50 is clipped at the top edge (max 80)']);
});
test('negative cumulative overflow', () => {
  const m = modelOf(
    stackSpec({
      a: [-30],
      b: [-30],
      domain: { policy: 'fixed', min: -50, max: 50, overflow: 'clip-indicated' },
    }),
  );
  expect((m.series[1] as BarSeriesModel).clipped).toEqual([{ pointId: 'b1', side: 'below' }]);
});
test('auto domain contains the stack sum', () => {
  expect(modelOf(stackSpec({ a: [40], b: [40] })).yAxes[0].domain[1]).toBeGreaterThanOrEqual(80);
});
test('stacked quality marker at the cumulative end', () => {
  const m = modelOf(stackSpec({ a: [40], b: [40], qualities: { b: ['partial'] } }));
  expect(stackExtent(m.stacks, 's', 0, 'b')).toEqual({ lower: 40, upper: 80, end: 80 });
  expect((m.series[1] as BarSeriesModel).markers).toEqual([
    { pointId: 'b1', reason: 'quality', variant: 'hollow' },
  ]);
});
test('validator and model agree on stack sums', () => {
  const spec = stackSpec({ a: [40], b: [40], domain: { policy: 'fixed', min: 0, max: 50 } });
  expect(catchErr(() => validateSpec(spec))).toMatchObject({ rule: 'bar-domain-excludes-data' }); // stackSpec builds bar stacks
});
test('sum-not-finite rejects an overflowing stack', () => {
  expect(catchErr(() => validateSpec(stackSpec({ a: [1e308], b: [1e308] })))).toMatchObject({
    code: 'INVALID_SPEC',
    rule: 'sum-not-finite',
  });
});
test('percent axis is dedicated: [0, 100], "% of total"', () => {
  expect(model('bar-age-bands-percent').yAxes[0]).toMatchObject({
    domain: [0, 100],
    unit: '% of total',
  });
});
test('percent stack plus a line on the second axis', () => {
  const m = modelOf(
    stackSpec({ mode: 'percent', a: [1, 3], b: [3, 1], line: { axis: 'count', values: [4, 9] } }),
  );
  expect(m.yAxes.map((a) => [a.id, a.unit])).toEqual([
    ['share', '% of total'],
    ['count', 'items'],
  ]);
  expect(m.yAxes[1].domain[1]).toBeGreaterThanOrEqual(9);
});
test('absolute stack totals; missing member makes the total partial', () => {
  const p = model('bar-stacked-categories').stacks[0].positions;
  expect(p.map((x) => x.total)).toEqual([36, 42, 39, 36, 6]);
  expect(p[3].state).toBe('partial');
  expect(
    model('bar-stacked-categories')
      .valueLabels.filter((l) => l.kind === 'total')
      .map((l) => l.text),
  ).toEqual(['36', '42', '39', '36 (partial)', '6']);
});
test('partial stack cue without total labels', () => {
  const spec = loadFixture('bar-stacked-categories');
  delete spec.labels;
  const m = model2(spec);
  expect(m.partialCues).toEqual([{ stackId: 'sev', xKey: 'svc-d', missing: ['crit'] }]);
  expect(m.notes).toContain('Partial stacks: Archive Store — Critical not measured');
  expect(m.legend.find((l) => l.id === 'quality:partial-stack')).toMatchObject({
    variant: 'hollow',
  });
  expect(m.manifest.groups).toContainEqual({ key: 'stack:sev:partial', count: 1 });
});
test('mixed-sign absolute stack grows both ways from zero', () => {
  const p = modelOf(stackSpec({ a: [5], b: [-3], c: [4] })).stacks[0].positions[0];
  expect(p.members.map((m) => [m.lower, m.upper])).toEqual([
    [0, 5],
    [-3, 0],
    [5, 9],
  ]);
  expect(p.total).toBe(6);
  const h = model('bar-horizontal-stacked');
  expect(h.stacks[0].positions.map((x) => x.total)).toEqual([8, -4, 11, 0]);
  expect(h.valueLabels.filter((l) => l.kind === 'total').map((l) => l.sign)).toEqual([1, -1, 1, 1]);
});
test('negative segments get labels', () => {
  const spec = loadFixture('bar-horizontal-stacked');
  spec.stacking.segmentLabels = 'value';
  expect(
    model2(spec)
      .valueLabels.filter((l) => l.kind === 'segment' && l.seriesId === 'removed')
      .map((l) => [l.text, l.sign]),
  ).toEqual([
    ['-7 items', -1],
    ['-10 items', -1],
    ['-4 items', -1],
    ['-9 items', -1],
  ]);
});
test('known members of a partial stack keep labels', () => {
  const spec = loadFixture('bar-stacked-categories');
  spec.stacking.segmentLabels = 'value';
  expect(
    model2(spec)
      .valueLabels.filter((l) => l.kind === 'segment' && l.xKey === 'svc-d')
      .map((l) => l.seriesId),
  ).toEqual(['high', 'med']);
});
test('null member gaps every member of an area stack', () => {
  const m = model('area-inventory-stacked');
  expect(m.stacks[0].positions[4].state).toBe('unavailable');
  const bounds = (id: string) =>
    (m.series.find((s) => s.id === id) as AreaSeriesModel).segments.map((g) => [
      g.pointIds[0],
      g.pointIds.at(-1),
    ]);
  expect(bounds('servers')).toEqual([
    ['s1', 's4'],
    ['s6', 's8'],
  ]);
  expect(bounds('laptops')).toEqual([
    ['l1', 'l4'],
    ['l6', 'l8'],
  ]);
  expect(bounds('mobile')).toEqual([
    ['m1', 'm4'],
    ['m6', 'm8'],
  ]);
});
test('gap hint on one stacked area member breaks only that member', () => {
  const m = modelOf(
    stackSpec({
      mark: 'area',
      a: [1, 2, 3],
      b: [4, 5, 6],
      hints: { b: [undefined, 'gap', undefined] },
    }),
  );
  expect(m.stacks[0].positions[1].state).toBe('ok');
  expect((m.series[0] as AreaSeriesModel).segments).toHaveLength(1);
  expect((m.series[1] as AreaSeriesModel).segments).toHaveLength(0); // b1 and b3 are isolated
  expect((m.series[1] as AreaSeriesModel).markers.map((k) => [k.pointId, k.reason])).toEqual([
    ['b1', 'isolated'],
    ['b3', 'isolated'],
  ]);
});
test('area on an axis that excludes zero fills from the nearest edge, with a note', () => {
  const m = modelOf(
    areaSpec({ values: [45, 60, 52], domain: { policy: 'fixed', min: 40, max: 70 } }),
  );
  expect((m.series[0] as AreaSeriesModel).baseline).toBe(40);
  expect(m.notes).toContain('Area filled from the axis minimum 40, not from zero.');
});
test('single area segments like a line', () => {
  const a = model('area-single-gaps').series[0] as AreaSeriesModel;
  expect(a.segments.map((g) => g.pointIds.length)).toEqual([2, 2, 4]);
  expect(a.segments[2].estimatedRanges).toEqual([['w8', 'w10']]);
  expect(a.markers.map((k) => [k.pointId, k.reason])).toEqual([['w6', 'marker-only']]);
  expect(a.baseline).toBe(0);
});
test('min-area stacks absolutely', () => {
  expect(model('min-area').stacks[0].positions.map((p) => p.total)).toEqual([15, 18]);
});
test('segment and value label texts; none at unavailable or empty positions', () => {
  const seg = model('bar-age-bands-percent').valueLabels.filter((l) => l.kind === 'segment');
  expect(seg.map((l) => [l.xKey, l.text])).toEqual([
    ['svc-a', '25%'],
    ['svc-a', '75%'],
    ['svc-b', '16%'],
    ['svc-b', '48%'],
    ['svc-b', '36%'],
  ]);
  expect(model('bar-severity-counts').valueLabels.map((l) => l.text)).toEqual([
    '12',
    '31',
    '84',
    '122',
  ]);
});
test('stackPositions is DOM-free and shared', () => {
  expect(
    stackPositions(validateSpec(loadFixture('bar-stacked-categories')) as CartesianSpec)[0]
      .positions[0].total,
  ).toBe(36);
});
```

(`areaSpec` and `model2` (a spec object in, model out) join the helpers list with this task.)

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-stack.test.ts tests/unit/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `core/shares` (stacks part), `sums.ts`, the validator reuse, `stacks.ts`, `areas.ts` and the cumulative updates to `bars.ts`; remove the area `unsupported` branch. The `boundaries` test must still pass (`core/shares` imports nothing from render). Record R56, R57 (model part), R60, R65, R66, R67 and R68 in the slice-2 ledger.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): stacks with cumulative extents, partial cues, area series and value-label texts`

---

### Task 6: Donut model

**Files:**

- Create: `src/render/model/donut.ts`
- Modify: `src/core/shares/index.ts` (add `donutShares`), `src/core/validate/semantic/sums.ts` (donut case of `sum-not-finite`, called from `semantic/donut.ts`), `src/render/model/{types.ts,index.ts,manifest.ts,cartesian.ts}` (drop the donut branch from `unsupported`)
- Test: `tests/unit/model-donut.test.ts`; modify `tests/unit/model-line.test.ts` (`non-line kinds report unsupported` now uses `min-heatmap`)

**Interfaces:**

- Consumes: `DonutSpec`, `Theme`, `formatNumber`, `resolveRole` (Task 4), R48.
- Produces:
  - `donutShares(spec: DonutSpec): { state: "ok" | "all-zero" | "incomplete"; total: number | null; slices: { id; value: number | null; share?: number }[] }` in `core/shares`; a non-finite total is rejected by `sum-not-finite` before the model runs.
  - `DonutModel = { kind: "donut"; chartId; title; description?; caption?; state: "ok" | "all-zero" | "incomplete"; unit?: string; total: number | null; slices: SliceModel[]; center: { value?: string; label?: string }; legend: LegendItem[]; legendOptions: { show: "auto" | "always" | "never"; position }; legendShown: boolean; legendValues: "none" | "value" | "value-share"; notes: string[]; manifest: MarkManifest }`.
  - `SliceModel = { id; label; value: number | null; display: string; share?: number; shareText: string; startDeg: number; endDeg: number; color: string; pattern: FillPattern; inlineEligible: boolean }`. Angles are compass degrees, clockwise from 12 o'clock (`startDeg` of slice 0 is 0, `endDeg` of the last positive slice is 360); `inlineEligible` is `share >= 3`.
  - `ChartModel = CartesianModel | DonutModel | UnsupportedModel`; `buildModel` dispatches by kind; `unsupported` remains for heatmap and progress (and scatter marks).
  - Manifest keys `slice` (count of slices with value > 0, only in state `ok`), `donut:track` (1 in `all-zero` or `incomplete`), `donut:center` (1 unless the centre has neither value nor label).
- States (§5.3):
  - `ok`: shares exact, `shareText` `4.8%` style (`maximumFractionDigits: 1`), a zero slice has `startDeg === endDeg`.
  - `all-zero`: centre value `0`, note `No items (total 0)`, every `shareText` `–`, legend `0–30 days — 0 (–)` under `value-share`.
  - `incomplete`: no angles drawn (`startDeg = endDeg = 0`), centre value `Incomplete` (`strings.incomplete`), `shareText` `–`, null slices display `Not measured`, note `Incomplete: 1 slice not measured; shares are not shown.` (`Incomplete: 2 slices not measured; …` for more).
  - Legend items per slice (`kind: "series"`, `swatch: "fill"`; a donut has no separate role items because each slice already has its own entry), text per `legendValues`: `value-share` → `Critical — 12 (4.8%)`, `value` → `Critical — 12`, `none` → `Critical`; in `incomplete` the share is omitted and nulls read `Partial — Not measured`.
  - Colour (§5.1, R49): slice `color` > slice role colour (`resolveRole`) > palette slot `i % 8`; pattern from the role, else the slot (slots 4–7 patterned). Slice 8 and later repeat slots; they are distinguished by order, legend and border (§7 edit).
- **Option precedence (R63):**
  - (a) In `all-zero` and `incomplete` states the state centre (`0` / `Incomplete`) overrides a caller `center.value` string; a caller `center.label` is kept. In `ok`, `center.value: "total"` → formatted total (no unit suffix), `"none"` → no value, any other string → shown verbatim; `label` verbatim.
  - (b) `legendShown` = `legend.show` resolved (`auto`: more than one slice), except that an `incomplete` donut always shows its legend (§5.3 makes its rows normative).
  - (d) Cartesian legends under `legend.show: "never"`: compact-stack and role legends stay shown (a preset requirement and the colour-meaning rule); rejecting would invalidate valid specs (§20). Applied by Tasks 8 and 9.
  - (c) When the legend is not shown, or `legendValues` is `"none"`, layout (Task 10) names every slice without a visible inline label in a note of kind `segment`: `Slice values not shown on the chart: <label> <display> (<shareText>); …` (in `all-zero`, the share part is `(–)`).

- [ ] **Step 1: Write the failing tests** (add `donut`, `donutOf`, `donutSpec` to the helpers first):

```ts
test("severity donut angles are cumulative shares from 12 o'clock", () => {
  const d = donut('donut-severity-share');
  expect(d.total).toBe(249);
  expect(d.slices.map((s) => s.shareText)).toEqual(['4.8%', '12.4%', '33.7%', '49%']);
  expect(d.slices[0].startDeg).toBe(0);
  expect(d.slices[0].endDeg).toBeCloseTo((360 * 12) / 249, 6);
  expect(d.slices[3].endDeg).toBeCloseTo(360, 6);
  expect(d.center).toEqual({ value: '249', label: 'Findings' });
});
test('zero and tiny slices keep true angles', () => {
  const d = donutOf(donutSpec([50, 0, 1, 49]));
  expect(d.slices[1].startDeg).toBe(d.slices[1].endDeg);
  expect(d.slices[2].endDeg - d.slices[2].startDeg).toBeCloseTo(3.6, 6);
  expect(d.slices[2].inlineEligible).toBe(false);
  expect(d.legend[1].label).toBe('B — 0 (0%)');
  expect(d.manifest.groups).toContainEqual({ key: 'slice', count: 3 });
  const t = donut('donut-tiny-slices');
  expect(t.slices.map((s) => s.shareText)).toEqual([
    '54.5%',
    '29.1%',
    '13.6%',
    '0%',
    '1.8%',
    '0.9%',
  ]);
  expect(t.slices.map((s) => s.pattern)).toEqual([
    'none',
    'none',
    'none',
    'none',
    'diagonal',
    'dots',
  ]);
});
test('slice colour beats slice role colour', () => {
  const d = donutOf(
    donutSpec([1, 2], {
      roles: { r: { color: '#111111' } },
      sliceRoles: ['r', 'r'],
      sliceColors: ['#222222', undefined],
    }),
  );
  expect(d.slices.map((s) => s.color)).toEqual(['#222222', '#111111']);
});
test('all-zero donut: neutral ring, centre 0, note', () => {
  const d = donut('donut-all-zero');
  expect(d.state).toBe('all-zero');
  expect(d.center.value).toBe('0');
  expect(d.notes).toEqual(['No items (total 0)']);
  expect(d.legend.map((l) => l.label)).toEqual([
    '0–30 days — 0 (–)',
    '31–90 days — 0 (–)',
    '91+ days — 0 (–)',
  ]);
  expect(d.manifest.groups).toEqual([
    { key: 'donut:track', count: 1 },
    { key: 'donut:center', count: 1 },
  ]);
});
test('missing slice: incomplete, no shares, no arcs', () => {
  const d = donut('donut-missing-slice');
  expect(d.state).toBe('incomplete');
  expect(d.center.value).toBe('Incomplete');
  expect(d.slices.every((s) => s.share === undefined && s.shareText === '–')).toBe(true);
  expect(d.legend.map((l) => l.label)).toEqual([
    'Full — 12',
    'Partial — Not measured',
    'None — 7',
    'Unknown — 3',
  ]);
  expect(d.notes).toEqual(['Incomplete: 1 slice not measured; shares are not shown.']);
  expect(d.manifest.groups.some((g) => g.key === 'slice')).toBe(false);
});
test('incomplete donut overrides a caller centre value and keeps its label', () => {
  const d = donutOf(donutSpec([1, null], { center: { value: '99 total', label: 'Systems' } }));
  expect(d.center).toEqual({ value: 'Incomplete', label: 'Systems' });
});
test('incomplete donut with legend never still shows its legend', () => {
  expect(donutOf(donutSpec([1, null], { legend: { show: 'never' } })).legendShown).toBe(true);
  expect(donutOf(donutSpec([1, 2], { legend: { show: 'never' } })).legendShown).toBe(false);
});
test('sum-not-finite rejects an overflowing donut', () => {
  expect(catchErr(() => validateSpec(donutSpec([1e308, 1e308])))).toMatchObject({
    code: 'INVALID_SPEC',
    rule: 'sum-not-finite',
  });
});
test('min-donut builds; heatmap still unsupported', () => {
  expect(buildModel(validateSpec(loadFixture('min-donut')), ctx).kind).toBe('donut');
  expect(buildModel(validateSpec(loadFixture('min-heatmap')), ctx)).toMatchObject({
    kind: 'unsupported',
  });
});
test('donut model is deterministic and DOM-free', () => {
  expect(JSON.stringify(donut('donut-severity-share'))).toBe(
    JSON.stringify(donut('donut-severity-share')),
  );
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-donut.test.ts tests/unit/model-line.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `buildLaid` still rejects donut (`RENDERED_KINDS` has only `cartesian`) with `donut charts are drawn later in slice 2`, so `mount.spec`'s `/slice 2/` assertion stays green. Record R63 (model part) in the slice-2 ledger.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut model with state and option precedence`

---

### Task 7: Data tables for bars, stacks, areas, roles, presets and donut

**Files:**

- Modify: `src/core/table/index.ts`
- Test: `tests/unit/table.test.ts` (the `min-donut` not-implemented case moves to `min-heatmap`)

**Interfaces:**

- Consumes: `stackPositions`, `stackExtent`, `donutShares` (`core/shares`), `formatNumber`, `resolveTheme` strings.
- Produces: `toDataTable(spec, options)` (signature unchanged, §11) for every slice-2 spec. The row-header column keeps the slice-1 rule: the x axis `label`, else the capitalised axis id. Column and cell rules:
  - Unstacked bars and composed charts: one column per series, header `Label (unit)` of its own axis (`Revenue (USD)`, `Margin (%)`).
  - Roles (R49): when any point of a series carries a role, a column `<series label> role` follows that series' value column; its cells read the role label (`roles[id].label ?? id`, `state: "measured"`, `value` = role id), or `–` for a point without a role.
  - Clipping of stacked members comes from `stackExtent` (R56): a member clipped by its cumulative extent reads its true value with state `clipped`.
  - Percent stacks: per member a raw column `<label> (<valueUnit>)` then a share column `<label> share (%)`, then `Total (<valueUnit>)`. Unavailable rows: missing member `Not measured` (`missing`), shares `Unavailable` (`unavailable`), total `Unavailable` (`unavailable`). Empty rows: shares and total `No data (0)` (`empty`).
  - Absolute stacks: a `Total (<unit>)` column only when `labels.values` is `totals` or `all` (the caller asked for totals); a partial total reads `36 (partial: 1 member not measured)` (`partial`). Whatever `labels.values` says, the missing member's cell in a partial row reads `Not measured (Partial stack)` (`missing`), the R65 "Partial" qualifier.
  - Stacked areas: at an unavailable position the missing member reads `Not measured` (`missing`) and every measured member reads `<value> — Unavailable (missing member)` (`unavailable`).
  - Notes carry the model notes (partial stacks, area baseline, sparkline omission, donut states) in model order.
  - Donut: columns `Slice`, `Value (<unit>)`, `Share (%)`; `all-zero` shares `–` (`empty`) plus note `No items (total 0)`; `incomplete` null values `Not measured` (`missing`), every share `–` (`unavailable`) plus the incomplete note.
  - Horizontal orientation changes nothing in the table (rows stay in category order).

- [ ] **Step 1: Write the failing tests:**

```ts
test('percent stack table: raw, share and total columns', () => {
  const t = toDataTable(validateSpec(loadFixture('bar-age-bands-percent')));
  expect(t.columns.map((c) => c.label)).toEqual([
    'Service',
    '0–30 days (items)',
    '0–30 days share (%)',
    '31–90 days (items)',
    '31–90 days share (%)',
    '91+ days (items)',
    '91+ days share (%)',
    'Total (items)',
  ]);
  expect(t.rows[0].cells.map((c) => c.text)).toEqual(['10', '25%', '30', '75%', '0', '0%', '40']);
  expect([1, 3, 5, 6].map((i) => t.rows[2].cells[i].state)).toEqual([
    'empty',
    'empty',
    'empty',
    'empty',
  ]);
  expect(t.rows[3].cells[2]).toEqual({ text: 'Not measured', value: null, state: 'missing' });
  expect(t.rows[3].cells[6]).toMatchObject({ text: 'Unavailable', state: 'unavailable' });
});
test('absolute stack with totals: partial total and partial qualifier', () => {
  const t = toDataTable(validateSpec(loadFixture('bar-stacked-categories')));
  expect(t.columns.at(-1)!.label).toBe('Total (items)');
  expect(t.rows[3].cells.at(-1)).toMatchObject({
    text: '36 (partial: 1 member not measured)',
    state: 'partial',
  });
  expect(t.rows[3].cells[0]).toEqual({
    text: 'Not measured (Partial stack)',
    value: null,
    state: 'missing',
  });
  expect(t.notes).toContain('Partial stacks: Archive Store — Critical not measured');
});
test('cumulatively clipped member reads clipped', () => {
  const t = toDataTable(
    validateSpec(
      stackSpec({
        a: [40],
        b: [40],
        domain: { policy: 'fixed', min: 0, max: 50, overflow: 'clip-indicated' },
      }),
    ),
  );
  expect(t.rows[0].cells.map((c) => c.state)).toEqual(['measured', 'clipped']);
});
test('stacked area unavailable position', () => {
  const r = toDataTable(validateSpec(loadFixture('area-inventory-stacked'))).rows[4];
  expect(r.cells.map((c) => c.state)).toEqual(['unavailable', 'missing', 'unavailable']);
  expect(r.cells[0].text).toBe('135 — Unavailable (missing member)');
});
test('composed table keeps each axis unit', () => {
  expect(
    toDataTable(validateSpec(loadFixture('composed-revenue-margin'))).columns.map((c) => c.label),
  ).toEqual(['Quarter', 'Revenue (USD)', 'Margin (%)']);
});
test('role column names each datum role', () => {
  const t = toDataTable(validateSpec(loadFixture('bar-ranking-horizontal')));
  expect(t.columns.map((c) => c.label)).toEqual(['Service', 'Open age (days)', 'Open age role']);
  expect(t.rows.map((r) => r.cells[1].text).slice(3, 6)).toEqual([
    'Overdue',
    'On track',
    'On track',
  ]);
});
test('donut tables: ok, all-zero and incomplete', () => {
  expect(
    toDataTable(validateSpec(loadFixture('donut-severity-share'))).rows[0].cells.map((c) => c.text),
  ).toEqual(['12', '4.8%']);
  const z = toDataTable(validateSpec(loadFixture('donut-all-zero')));
  expect(z.rows.every((r) => r.cells[1].text === '–' && r.cells[1].state === 'empty')).toBe(true);
  expect(z.notes).toContain('No items (total 0)');
  const m = toDataTable(validateSpec(loadFixture('donut-missing-slice')));
  expect(m.rows[1].cells[0]).toEqual({ text: 'Not measured', value: null, state: 'missing' });
  expect(m.rows.every((r) => r.cells[1].state === 'unavailable')).toBe(true);
});
test('sparkline table states the omission', () => {
  expect(toDataTable(validateSpec(loadFixture('line-sparkline'))).notes).toContain(
    'Sparkline: axes and legend omitted',
  );
});
test('heatmap tables still report not-implemented-in-slice', () => {
  const spec = validateSpec(loadFixture('min-heatmap'));
  try {
    toDataTable(spec);
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(DravenVizError);
    expect((e as DravenVizError).code).toBe('RENDER_FAILED');
    expect((e as DravenVizError).issues?.[0]?.rule).toBe('not-implemented-in-slice');
  }
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/table.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): data tables for stacks, shares, roles, partial cues, areas and donuts`

---

### Task 8: Cartesian layout for bars, slots, horizontal orientation and value labels

**Files:**

- Create: `src/render/layout/{slots.ts,horizontal.ts,value-labels.ts}`, `tests/unit/fixtures/layout-slice1-snapshot.json`
- Modify: `src/render/layout/{types.ts,index.ts}`, `src/render/pipeline.ts` (`verifyAndReport` reads `laid.manifest`)
- Test: `tests/unit/layout-slice2.test.ts`

**Interfaces:**

- Consumes: `CartesianModel` (Tasks 4–5), `planXTicks`, `wrapWords`, `notoMeasurer`, `Theme`.
- Produces (additions to `LaidOutChart`, which keeps its name and stays the Cartesian layout):
  - `resolveSlots(bandWidth: number, n: number, theme: Theme): { offset: number; width: number }[]` and `slotGap(bandWidth, n, theme): number` in `slots.ts` (R61), reproducing Recharts 3.10.1 (`combineAllBarPositions`, no `maxBarSize`). The theme token `spacing.barGap` keeps its meaning as the **total** fraction of the band left empty, so each side gets `side = bandWidth × barGap / 2`; the group is `group = bandWidth × (1 − barGap)`; `gap = slotGap(...) = groupGap × group / n`; `size = (bandWidth − 2 × side − (n − 1) × gap) / n`, rounded with `Math.round` when `size > 1` (Recharts does this); slot `i` has `offset = side + (size + gap) × i` and `width = size` (offsets from the band start; after rounding the group is not re-centred, exactly as Recharts). The one formula used by layout fit, `slotGeometry` (Task 11a), the spike oracle and interaction. Recharts receives `barCategoryGap={`${barGap × 50}%`}` (a string: Recharts applies a percentage on **each** side of the band) and `barGap={slotGap(...)}` (a number, so pixels).
  - `orientation: "vertical" | "horizontal"` and `grid: "horizontal" | "vertical"`.
  - `manifest: MarkManifest`: the model manifest plus layout-decided groups `labels:value` (value and total labels drawn) and `labels:segment` (segment labels that fit). `verifyAndReport` verifies `laid.manifest` instead of `laid.model.manifest`.
  - `valueLabels: PlacedValueLabel[]`, `PlacedValueLabel = { kind; seriesId?; stackId?; xKey; text; sign; width; height; visible: boolean }`. Layout reserves space and decides fit; positions are computed at render by the `ValueLabels` overlay from `slotGeometry` and the cumulative extents (Task 11a), so a stack total never depends on a member being drawn.
  - `placeholders: { stackId; xKey; kind: "unavailable" | "empty"; text: string; width: number }[]` (texts `strings.unavailable` and `${strings.noData} (0)`).
  - `NoteLine.kind` gains `"segment"` (omitted segment labels and donut slice values), `"preset"` (sparkline and compact-stack notes) and `"state"` (partial stacks, area baseline, donut all-zero and incomplete notes).
  - `LegendItem` gains `swatch?: "line" | "fill" | "area" | "marker"` and `pattern?: FillPattern`.
- Rules:
  - **Horizontal orientation** (`horizontal.ts`): categories run top to bottom on the left; the category axis box (`boxes.xAxis`, still keyed by `model.x.id`) sits left of the plot; value axes map `position: "left"` → bottom and `"right"` → top (§5.2), with horizontal tick labels. Each value axis title is horizontal text centred on the plot width, below the bottom axis's tick labels or above the top axis's; in horizontal orientation `yAxisTitles[id]` holds those horizontal lines (wrapped to at most 2 lines at the plot width), not rotated columns. Category labels wrap at the gutter width to at most 3 lines and are never truncated; the gutter is the widest wrapped label, capped at 40 % of the inner width. A label needing more than 3 lines at the cap throws `LAYOUT_ERROR` naming the category label and the width it needs. If the band height is below the label's line count × line height, every n-th label is hidden (first and last kept), exactly like the slice-1 thin stage. `PlacedTick.rotate` is always 0 here.
  - **Value-label space** (`value-labels.ts`): when any value or total label exists, a gutter of one label line height (vertical) or of the widest label plus the tick gap (horizontal) is reserved beyond the plot edge on each side the labelled values reach (the max end for positive extents, the min end for negatives). A value label wider than its resolved slot width (`resolveSlots(...)[i].width`, or the fallback-O bound) in a vertical chart throws `LAYOUT_ERROR` naming "value labels" and the width needed.
  - **Segment labels (R54):** a segment label is `visible` only when it fits inside its segment (width and height, from `[lower, upper]` and the plot box). Each label that does not fit is **named** in one printed note of kind `segment`: `Segment labels not shown: <category label> — <member label> <text>; …` (for example `Segment labels not shown: All services — Critical gaps 0.3%`). More than **8** omitted segment labels in one chart throw `LAYOUT_ERROR` naming the count and advising a larger chart or `segmentLabels: "none"`.
  - **Note convergence (R72):** fit-dependent notes (segment omissions) are allocated in a bounded loop: compute fit, allocate the note, recompute the plot and fit, and repeat until the omitted set is stable. The set only grows, so the loop ends within labels + 1 passes (or throws at the 8-label cap).
  - Placeholder text must fit its band (vertical: band width; horizontal: band height for one line) or `LAYOUT_ERROR` names the placeholder.
  - Annotation and reference labels stay measured in every mode for every family and orientation (R44). **R54 (first part):** `labels.values` and `stacking.segmentLabels` are also on-chart text in every mode: they are explicit spec choices, and hiding them in interactive mode would silently drop text the caller asked for (same reasoning as R44); `staticLabels` governs `staticLabel` point labels only.
  - Compact-stack and role legends are shown even under `legend.show: "never"` (R63 (d), legends under `never`).

- [ ] **Step 1: Write the failing tests** (all at 680 × 320, print theme, `printWidthMm: 178`, `notoMeasurer`; add `laid`, `laidOf`, `horizontalSpec`, `expectNoBoxOverlap`, `withoutSlice2Fields`, `rankingLabels` to the helpers first). Before changing any layout code, generate `tests/unit/fixtures/layout-slice1-snapshot.json` from the unmodified code: the JSON of `laid('line-weekly-flow')`, `laid('line-category-labels-rotate')` and `laid('line-fixed-domain-clipped')`, and commit it with the tests.

```ts
test('resolveSlots reproduces Recharts slot geometry', () => {
  // band 100, barGap 0.2 (10 per side), groupGap 0.1 → group 80, gap 2.667, size round(24.889) = 25
  const s = resolveSlots(100, 3, themes.print);
  expect(s.map((x) => x.width)).toEqual([25, 25, 25]);
  expect(s.map((x) => x.offset)).toEqual([
    10,
    expect.closeTo(37.667, 3),
    expect.closeTo(65.333, 3),
  ]);
  expect(s[1].offset - (s[0].offset + s[0].width)).toBeCloseTo(slotGap(100, 3, themes.print), 6);
  expect(resolveSlots(4, 3, themes.print)[0].width).toBeCloseTo(0.996, 3); // size <= 1 is not rounded
});
test('a label that fits the gapless bound but not the resolved slot throws', () => {
  expect(() => laidOf(groupedBarSpec(8, { labels: 'all', value: 12345 }))).toThrow(/value labels/);
});
test('horizontal ranking: categories left, value axis below, no overlap', () => {
  const l = laid('bar-ranking-horizontal');
  expect(l.orientation).toBe('horizontal');
  expect(l.grid).toBe('vertical');
  expect(l.boxes.xAxis.x + l.boxes.xAxis.width).toBeLessThanOrEqual(l.boxes.plot.x + 1e-6);
  expect(l.boxes.axes.days.y).toBeGreaterThanOrEqual(l.boxes.plot.y + l.boxes.plot.height - 1e-6);
  expect(l.xTicks.every((t) => t.rotate === 0)).toBe(true);
  expect(l.xTicks.map((t) => t.lines.join(' '))).toEqual(rankingLabels);
  expect(l.yAxisTitles.days).toEqual(['Open age (days)']);
  expectNoBoxOverlap(l);
  expect(l.boxes.plot.width).toBeGreaterThanOrEqual(80);
});
test('horizontal category labels wrap, never truncate', () => {
  const l = laidOf(
    horizontalSpec({
      labels: ['A label of about eighty characters that must wrap onto more than one line here'],
    }),
  );
  expect(l.xTicks[0].lines.length).toBeLessThanOrEqual(3);
  expect(l.xTicks[0].lines.join(' ')).toBe(
    'A label of about eighty characters that must wrap onto more than one line here',
  );
  expect(l.boxes.xAxis.width).toBeLessThanOrEqual(0.4 * (680 - 32) + 1e-6);
  expect(() => laidOf(horizontalSpec({ labels: ['x'.repeat(10) + ' word'.repeat(60)] }))).toThrow(
    /category label.*width/,
  );
});
test('value labels get a gutter above positive and below negative bars', () => {
  const pos = laid('bar-severity-counts');
  expect(pos.manifest.groups).toContainEqual({ key: 'labels:value', count: 4 });
  expect(pos.boxes.plot.y - (pos.boxes.title.y + pos.boxes.title.height)).toBeGreaterThanOrEqual(
    16.25,
  );
  const neg = laid('bar-negative-values');
  expect(neg.boxes.xAxis.y - (neg.boxes.plot.y + neg.boxes.plot.height)).toBeGreaterThanOrEqual(0);
  expect(neg.valueLabels.every((v) => v.visible)).toBe(true);
});
test('too-wide value label is a layout error', () => {
  expect(() =>
    laidOf(barSpec({ categories: 40, values: Array(40).fill(123456789), labels: 'all' })),
  ).toThrow(/value labels/);
});
test('percent axis title, placeholders and segment-label fit', () => {
  const l = laid('bar-age-bands-percent');
  expect(l.yAxisTitles.share.join(' ')).toBe('Share of items (% of total)');
  expect(l.placeholders.map((p) => [p.xKey, p.text])).toEqual([
    ['svc-c', 'No data (0)'],
    ['svc-d', 'Unavailable'],
  ]);
  expect(l.valueLabels.filter((v) => v.kind === 'segment').map((v) => v.text)).toEqual([
    '25%',
    '75%',
    '16%',
    '48%',
    '36%',
  ]);
  expect(l.manifest.groups).toContainEqual({ key: 'labels:segment', count: 5 });
  expect(l.notes.some((n) => n.kind === 'segment')).toBe(false);
});
test('omitted segment labels are named; more than 8 is a layout error', () => {
  const l = laidOf(
    stackSpec({
      mode: 'percent',
      a: [400, 400],
      b: [1, 2],
      labels: ['Alpha', 'Beta'],
      memberLabels: ['Big', 'Tiny'],
    }),
  );
  expect(l.notes.find((n) => n.kind === 'segment')!.text).toBe(
    'Segment labels not shown: Alpha — Tiny 0.2%; Beta — Tiny 0.5%',
  );
  expect(() =>
    laidOf(stackSpec({ mode: 'percent', a: Array(9).fill(400), b: Array(9).fill(1) })),
  ).toThrow(/9 segment labels/);
});
test('omission notes converge when the note itself shrinks the plot', () => {
  const spec = stackSpec({
    mode: 'percent',
    a: [70, 400],
    b: [30, 1],
    labels: ['Alpha', 'Beta'],
    memberLabels: ['Big', 'Small'],
  });
  const h = boundaryHeight(spec); // helper: the height at which 'Alpha — Small 30%' fits only without a note line
  const l = laidOf(spec, 680, h);
  expect(l.notes.find((n) => n.kind === 'segment')!.text).toBe(
    'Segment labels not shown: Alpha — Small 30%; Beta — Small 0.2%',
  );
  expect(l.boxes.plot.y + l.boxes.plot.height).toBeLessThanOrEqual(l.boxes.notes.y);
});
test('legend swatches follow the mark', () => {
  const l = laid('composed-revenue-margin');
  expect(l.legendRows.flat().map((i) => [i.id, i.swatch])).toEqual([
    ['rev', 'fill'],
    ['mar', 'line'],
  ]);
});
test('role legend stays under legend.show never', () => {
  const spec = loadFixture('bar-ranking-horizontal');
  spec.legend = { show: 'never' };
  expect(
    laidOf(validateSpec(spec))
      .legendRows.flat()
      .map((i) => i.label),
  ).toEqual(['Overdue', 'On track']);
});
test('annotation and reference labels are reserved in interactive mode for composed charts', () => {
  const l = laid('composed-remediation-days-counts', { mode: 'interactive' });
  expect(l.staticLabels.map((s) => s.kind).sort()).toEqual(['annotation', 'reference']);
});
test('long vertical labels reach the rotate stage', () => {
  expect(laid('bar-long-labels').metrics.xLabelStage).toBe('rotate');
});
test('slice-1 line layouts are unchanged', () => {
  const snap = readJson('tests/unit/fixtures/layout-slice1-snapshot.json');
  for (const id of ['line-weekly-flow', 'line-category-labels-rotate', 'line-fixed-domain-clipped'])
    expect(withoutSlice2Fields(laid(id))).toEqual(snap[id]); // drops orientation, grid, manifest, valueLabels, placeholders, preset, sparklineLabels
});
```

(`boundaryHeight` joins the helpers list with this task.) The existing `tests/unit/layout.test.ts` must also pass unchanged.

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/layout-slice2.test.ts tests/unit/layout.test.ts`. Expected: FAIL (the snapshot test passes; the rest fail).
- [ ] **Step 3: Implement.** Keep the `pass()` allocation order of §8; horizontal orientation swaps which boxes hold the category and value axes. `chartMargin` is generalised in Task 11b, not here. Record R54 and R72 in the slice-2 ledger.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): slot geometry, horizontal bar layout, value-label gutters and named omissions`

---

### Task 9: Sparkline and compact-stack preset layout

**Files:**

- Create: `src/render/layout/presets.ts`
- Modify: `src/render/layout/{index.ts,types.ts}` (remove the `TODO(slice 2)` sparkline comment; `layoutChart` dispatches on `model.preset`)
- Test: `tests/unit/layout-slice2.test.ts` (preset cases)

**Interfaces:**

- Consumes: Task 8 `LaidOutChart` and helpers.
- Produces: preset layouts inside `layoutChart` (same `LaidOutChart` type) with `preset: "standard" | "sparkline" | "compact-stack"` added to it, and `sparklineLabels: { seriesId; kind: "series" | "first" | "last"; text: string; width: number; height: number }[]`.
- Rules:
  - **Sparkline** (§5.2, line or area series): no axes (every axis box has zero width and height), no grid, no legend. Under the title, one label line per series: `<series label>: <last display> <unit>` (unit from the y axis, omitted when absent), e.g. `p95 latency: 207 ms`. First and last value labels (`212`, `207`) sit beside the first and last measured points; layout reserves a left and right gutter of their widths plus the tick gap. A note of kind `preset`, `Sparkline: axes and legend omitted`, is always added (caption size); the live `<desc>` (Task 12) and the exported `<desc>` (Task 14) carry it too. Manifest group `labels:sparkline` counts the labels drawn (3 per series with any measured value).
  - **Compact-stack** (§5.2, R51): percent-stacked horizontal bars; no value axis, ticks or grid (the value axis box is zero-sized; Task 12 renders it hidden with domain `[0, 100]`); category labels at the left only when there is more than one category; the legend is always shown (R63 (d), legends under `never`). With one category, legend items read `<label> — <value> <valueUnit> (<share>)`, e.g. `Compliant — 312 services (78%)`. With more than one category, legend items show labels only and a `preset` note `Values for each category are shown on the segments and in the data table.` is added (the legend never sums across categories; omitted segment labels are still named per Task 8).
  - Arithmetic check at 680 wide, print, fontScale 1: sparkline needs 32 (padding) + 21.25 (title) + 10 + 16.25 (label line) + 5 + 60 (minimum plot) + 13.75 (note) + 10 = 168.25 ≤ 180; compact-stack needs 32 + 21.25 + 10 + 36.5 (2 legend rows) + 12 + 60 + 13.75 (one note line) + 10 = 195.5 ≤ 220.

- [ ] **Step 1: Write the failing tests** (add `laidAt`, `compactSpec`, `sparklineSpec` to the helpers first):

```ts
test('sparkline omits axes and states it', () => {
  const l = laidAt('line-sparkline', 680, 180);
  expect(Object.values(l.boxes.axes).every((b) => b.width === 0 && b.height === 0)).toBe(true);
  expect(l.legendRows).toEqual([]);
  expect(l.notes.filter((n) => n.kind === 'preset').map((n) => n.text)).toEqual([
    'Sparkline: axes and legend omitted',
  ]);
  expect(l.sparklineLabels.map((s) => s.text)).toEqual(['p95 latency: 207 ms', '212', '207']);
  expect(l.manifest.groups).toContainEqual({ key: 'labels:sparkline', count: 3 });
  expect(l.metrics.effectivePt!.label).toBeGreaterThanOrEqual(9);
  expect(l.metrics.effectivePt!.caption).toBeGreaterThanOrEqual(8);
});
test('area sparkline lays out the same way', () => {
  const l = laidOf(sparklineSpec({ mark: 'area', values: [3, 5, 4, 6] }), 680, 180);
  expect(l.sparklineLabels.map((s) => s.kind)).toEqual(['series', 'first', 'last']);
  expect(Object.values(l.boxes.axes).every((b) => b.width === 0)).toBe(true);
});
test('sparkline too short is a layout error', () => {
  expect(() => laidAt('line-sparkline', 680, 100)).toThrow(/minimum/);
});
test('compact-stack: no value axis, legend with values, tiny segment named', () => {
  const l = laidAt('bar-compact-percent', 680, 220);
  expect(l.preset).toBe('compact-stack');
  expect(l.boxes.axes.share).toMatchObject({ width: 0, height: 0 });
  expect(l.xTicks.every((t) => !t.visible)).toBe(true);
  expect(l.legendRows.flat().map((i) => l.legendLabels[i.id]!.join(' '))).toEqual([
    'Compliant — 312 services (78%)',
    'Minor gaps — 71 services (17.8%)',
    'Major gaps — 16 services (4%)',
    'Critical gaps — 1 services (0.3%)',
  ]);
  expect(l.valueLabels.find((v) => v.text === '0.3%')!.visible).toBe(false);
  expect(l.notes.find((n) => n.kind === 'segment')!.text).toBe(
    'Segment labels not shown: All services — Critical gaps 0.3%',
  );
});
test('compact-stack legend stays under legend.show never', () => {
  const l = laidOf(compactSpec({ categories: 1, legend: { show: 'never' } }), 680, 220);
  expect(l.legendRows.flat().length).toBeGreaterThan(0);
});
test('compact-stack with several categories keeps labels and names where values are', () => {
  const l = laidOf(compactSpec({ categories: 3 }));
  expect(l.xTicks.filter((t) => t.visible)).toHaveLength(3);
  expect(l.notes.map((n) => n.text)).toContain(
    'Values for each category are shown on the segments and in the data table.',
  );
});
```

The legend text `1 services` is the verbatim `valueUnit`; DravenViz does not inflect caller units (spec "Supplied labels are displayed verbatim").

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `presets.ts`. Record R51 in the slice-2 ledger.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): sparkline and compact-stack preset layouts`

---

### Task 10: Donut layout and the `LaidOut` union

**Files:**

- Create: `src/render/layout/donut.ts`
- Modify: `src/render/layout/{types.ts,index.ts}`, `src/render/pipeline.ts` (`buildLaid` returns `LaidOut`; dispatches `layoutChart` / `layoutDonut`; `verifyAndReport(root, laid: LaidOut, …)` widened), `src/render/verify.ts` (`expectationsOf(laid: LaidOut)` returns `undefined` for a donut until Task 13 adds its branch), and the `buildLaid` callers' types in `src/print/{mount.ts,export.ts}` and `src/react/Chart.tsx`
- Test: `tests/unit/layout-slice2.test.ts` (donut cases)

**Interfaces:**

- Consumes: `DonutModel` (Task 6), `wrapWords`, `computeFontScale`, `scaledEffectivePt`.
- Produces:
  - `layoutDonut(model: DonutModel, opts: LayoutOptions, measure: TextMeasurer): LaidOutDonut`.
  - `LaidOutDonut = { model: DonutModel; width; height; fontScale; boxes: { title: Box; legend: Box; plot: Box; notes: Box }; ring: { cx: number; cy: number; outerRadius: number; innerRadius: number }; titleLines: string[]; legendRows: LegendItem[][]; legendLabels: Record<string, string[]>; legendRowBoxes: Record<string, Box>; center: { valueLines: string[]; valueSize: number; labelLines: string[] }; sliceLabels: { sliceId: string; text: string; x: number; y: number; width: number; height: number; visible: boolean }[]; notes: NoteLine[]; manifest: MarkManifest; metrics: { effectivePt?: { title; label; caption } } }` (`legendRowBoxes` gives each slice's legend row box, the focus target for slices without an arc, R64).
  - `type LaidOut = LaidOutChart | LaidOutDonut` (discriminated by `laid.model.kind`). `LaidOutChart` keeps its slice-1 name and meaning (Cartesian) so slice-1 code does not churn.
- Rules: allocation order title → legend (when `model.legendShown`; default bottom, wrapped rows, items per `legendValues`) → notes (state notes of kind `state`, slice-value notes of kind `segment`) → plot. The ring is centred in the plot box, `outerRadius = min(plot.width, plot.height) / 2`, `innerRadius = 0.6 × outerRadius`. The centre value uses the title size and the centre label the label size; both must fit within `2 × innerRadius × 0.9` wide (wrap the label to at most 2 lines), else `LAYOUT_ERROR` naming the centre text. A slice label (its `shareText`) is `visible` only when the slice is `inlineEligible` and the label box fits inside the annulus sector at the mid-angle. **R63 (c):** when the legend is not shown or `legendValues` is `"none"`, every slice without a visible inline label is named in one `segment` note, `Slice values not shown on the chart: <label> <display> (<shareText>); …`; otherwise the legend carries their values and shares (§5.3). Notes converge as in Task 8 (R72). `manifest` = model manifest plus `labels:slice` (visible slice labels).

- [ ] **Step 1: Write the failing tests** (add `laidDonut`, `laidDonutOf`, `labelInsideSector` to the helpers first):

```ts
test('severity donut: centred ring, centre fits, legend with values', () => {
  const l = laidDonut('donut-severity-share');
  const p = l.boxes.plot;
  expect(l.ring.cx).toBeCloseTo(p.x + p.width / 2, 6);
  expect(l.ring.cy).toBeCloseTo(p.y + p.height / 2, 6);
  expect(l.ring.outerRadius).toBeCloseTo(Math.min(p.width, p.height) / 2, 6);
  expect(l.ring.innerRadius).toBeCloseTo(0.6 * l.ring.outerRadius, 6);
  expect(l.center).toMatchObject({ valueLines: ['249'], labelLines: ['Findings'] });
  expect(Object.values(l.legendLabels).map((x) => x.join(' '))).toEqual([
    'Critical — 12 (4.8%)',
    'High — 31 (12.4%)',
    'Medium — 84 (33.7%)',
    'Low — 122 (49%)',
  ]);
  for (const s of l.sliceLabels.filter((s) => s.visible))
    expect(labelInsideSector(l, s)).toBe(true);
  expect(l.metrics.effectivePt!.label).toBeGreaterThanOrEqual(9);
});
test('tiny slices get no inline label', () => {
  const l = laidDonut('donut-tiny-slices');
  expect(
    l.sliceLabels.filter((s) => ['d4', 'd5', 'd6'].includes(s.sliceId)).every((s) => !s.visible),
  ).toBe(true);
});
test('tiny slice with legend never is named in a note', () => {
  const spec = loadFixture('donut-tiny-slices');
  spec.legend = { show: 'never' };
  const l = laidDonutOf(validateSpec(spec));
  expect(l.legendRows).toEqual([]);
  expect(l.notes.find((n) => n.kind === 'segment')!.text).toBe(
    'Slice values not shown on the chart: 31–90 days 0 (0%); 91–365 days 4 (1.8%); Over 1 year 2 (0.9%)',
  );
});
test('legendValues none names non-inline slices', () => {
  const spec = loadFixture('donut-tiny-slices');
  spec.legendValues = 'none';
  expect(
    laidDonutOf(validateSpec(spec)).notes.some(
      (n) => n.kind === 'segment' && n.text.includes('Over 1 year 2 (0.9%)'),
    ),
  ).toBe(true);
});
test('all-zero and incomplete donut layouts', () => {
  expect(laidDonut('donut-all-zero').center.valueLines).toEqual(['0']);
  expect(laidDonut('donut-all-zero').notes.map((n) => [n.kind, n.text])).toContainEqual([
    'state',
    'No items (total 0)',
  ]);
  expect(laidDonut('donut-missing-slice').center.valueLines).toEqual(['Incomplete']);
  expect(laidDonut('donut-missing-slice').sliceLabels.every((s) => !s.visible)).toBe(true);
  expect(Object.keys(laidDonut('donut-missing-slice').legendRowBoxes)).toEqual([
    'full',
    'part',
    'none',
    'unk',
  ]);
});
test('centre text that cannot fit is a layout error', () => {
  expect(() =>
    laidDonutOf(
      donutSpec([1, 2], { center: { value: 'A very long centre value text' } }),
      200,
      160,
    ),
  ).toThrow(/centre/);
});
test('buildLaid returns a donut layout but rendering is still guarded', () => {
  expect(
    catchErr(() => buildLaid(validateSpec(loadFixture('min-donut')), layoutInput)),
  ).toMatchObject({ issues: [{ rule: 'not-implemented-in-slice' }] });
});
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Narrow with `laid.model.kind === 'cartesian'` where callers read Cartesian fields; `verifyAndReport` accepts either layout. Record R63 (layout part) in the slice-2 ledger.
- [ ] **Step 4: Run** them, `pnpm test` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut layout, slice-value notes and the LaidOut union`

---

### Task 11a: Vertical bars, stacks, placeholders, patterns, partial cues and labels

**Files:**

- Create: `src/render/recharts/bars.tsx` (`BarSeries`, stack segments, `slotGeometry`), `src/render/recharts/geometry-store.ts` (used only under fallback O), `src/render/primitives/{Patterns.tsx,Placeholders.tsx,ValueLabels.tsx,PartialCues.tsx}`, `tests/browser/geometry-bars.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/ChartView.tsx` (fallback O re-render pass), `src/render/primitives/{Legend.tsx,style.ts}`, `src/render/pipeline.ts` (`RENDERED_MARKS` adds `bar`; `RENDERED_ORIENTATIONS` stays `vertical`), `tests/browser/mount.spec.ts`, `tests/docs/docs.spec.ts` (the not-implemented case selects `min-scatter` instead of `min-bar`)

**Interfaces:**

- Consumes: Task 1 results (fallbacks Z, W, O, S, and the point-11 answer), `LaidOutChart` (Tasks 8–9), `resolveSlots`, `stackExtent`, `planIds`, `DvText`, `Marker`, `strokeStyle`, the overlay hooks (`useXAxisScale`, `useYAxisScale`, `usePlotArea`), R48–R50, R52, R56, R58, R60, R65.
- Produces:
  - `slotGeometry(laid: LaidOutChart, slot: BarSlot, xKey: string): { x: number; width: number }` (vertical; Task 11b adds the horizontal form): band from the category scale plus `resolveSlots` (R61). Signature `slotGeometry(laid, slot, xKey, store?: GeometryStore)`: under fallback O the browser callers (overlays, `hitTest`, focus) pass the store they read from a `GeometryStoreContext` provided by `ChartView` for the current render id; Node callers (layout, unit tests) have no store and always get the formula.
  - Bars: one Recharts `Bar` per bar series inside `<g data-dv-mark="series:<id>:bar">`, `isAnimationActive={false}`, a `name` prop (avoids `name="undefined"`, spike observation 5), `stackId` for stack members, and a `shape` render prop returning `<g data-dv-item><path d=…/></g>` with inline fill (or `url(#pattern-id)`) and, for stack segments, a boundary stroke of `theme.stroke.sliceBorder` in the background colour. Zero bars draw a zero-height path (fallback Z if the spike showed the shape is not called). Estimated bars get a dashed outline.
  - **Two-axis bars (R58):** if Task 1 point 11 recorded overlap, bars whose axis differs from the first bar axis are drawn by DravenViz rectangles from `slotGeometry` and their own axis scale, inside the same group structure and manifest keys.
  - Chart-level `stackOffset` = `"sign"` for absolute and `"none"` for percent; `barCategoryGap` and `barGap` as Task 8 states.
  - `Patterns`: `<defs>` with one `<pattern patternUnits="userSpaceOnUse">` per distinct (pattern, colour) pair, tile from `PATTERN_TILE`/`PATTERN_STROKE`/`PATTERN_OPACITY`; ids planned by `planIds` under keys `pattern:<kind>:<hex>`.
  - `Placeholders`: unavailable → dashed outline across the band at full plot extent plus the text; empty → a baseline tick of `theme.stroke.axis` across the band at the value axis zero plus `No data (0)`. Text role `direct` (≥ 9 pt). Groups `stack:<id>:unavailable` / `stack:<id>:empty`, one `data-dv-item` each.
  - `ValueLabels` overlay (`labels:value`, `labels:segment`, role `direct`): positions from `slotGeometry` and the cumulative extents on the bound axis scale (`useYAxisScale`), never from the `Bar` `label` prop, so a stack total is drawn even when its top member is null; a total sits beyond the end of the side its signed sum falls on.
  - `PartialCues` (`stack:<id>:partial`, R65): a hollow partial marker at the stack's outer end of every partial position (the end of the sign side of the total), drawn whatever `labels.values` says; the legend entry and the note come from the model.
  - Quality markers at the member's cumulative `end` (R56c); clip breaks (a zigzag across the bar at the plot edge, `series:<id>:clip-indicator`) for members clipped by their cumulative extent.
  - **Fallback O wiring (R62), only if Task 1 took it:** the store in `geometry-store.ts` (keyed by render id), the single extra overlay pass in `ChartView`, readiness after that pass, stale writes ignored; tests below run unchanged against either path.
  - Legend swatches: `fill` (rect with pattern when set), `area`, `line`, `marker`; role and partial-stack items per Tasks 4–5.
  - `RENDERED_MARKS` = `line`, `bar` (vertical only until Task 11b).

- [ ] **Step 1: Write the failing tests** in `geometry-bars.spec.ts` (harness, print theme, 680 × 320; the oracle maps values linearly from the model domain onto `laid.boxes.plot`; rect extents normalised with `min(y, y + h)`):

```ts
test('min-bar mounts with a drawn zero bar', async ({ page }) => {
  await h(page).mount(['min-bar'], opts);
  expect(await items(page, 'series:items:bar')).toBe(2);
});
test('negative bars span zero to value', async ({ page }) => {
  /* bar-negative-values: each bar [yScale(0), yScale(v)] ±0.5; v<0 below the zero line */
});
test('grouped bars: order, slot geometry, missing bar absent', async ({ page }) => {
  /* bar-grouped: per category the bars are opened, closed, reopened left to right; each bar x/width equals slotGeometry (resolveSlots) ±0.5;
     reopened has 3 items; o4 partial marker centre at the bar top centre ±0.5 */
});
test('series and stack sharing an id render in distinct slots', async ({ page }) => {
  /* inline spec: unstacked bar 'flow' + stack 'flow' (two members): two slots per band, slotGeometry({kind:'series',id:'flow'}) and
     slotGeometry({kind:'stack',id:'flow'}) differ and each matches its committed rects ±0.5 */
});
test('bars on two axes stay side by side', async ({ page }) => {
  /* inline spec: bar a on the left axis, bar b on the right axis: two slots per band in series order, each bar's height from its own axis scale ±0.5 */
});
test('absolute stack segments are contiguous; partial total labelled', async ({ page }) => {
  /* bar-stacked-categories: each segment's lower edge equals the previous upper edge ±0.5; svc-d has no crit segment;
     total labels read 36, 42, 39, 36 (partial), 6; svc-e crit segment height = |yScale(1) − yScale(0)| ±0.5 (not inflated);
     segment boundary stroke width = theme.stroke.sliceBorder; a hollow partial marker sits at yScale(36) above svc-d ±0.5 */
});
test('partial cue draws without total labels', async ({ page }) => {
  /* bar-stacked-categories with labels removed: stack:sev:partial has 1 item at svc-d's stack end; legend shows 'Partial stack — …';
     note text 'Partial stacks: Archive Store — Critical not measured' rendered */
});
test('total label survives a null top member', async ({ page }) => {
  /* inline absolute stack a:[3,4], b:[2,null] with labels totals: both totals drawn (5 at category 1, 4 at category 2), readiness resolves */
});
test('mixed-sign vertical stack places its total on the sum side', async ({ page }) => {
  /* inline stack a:[5], b:[-9], c:[1] (total -3): the total label sits below yScale(-9) ±0.5 + label gap; positives above zero, negatives below */
});
test('stacked marker and clip at the cumulative end', async ({ page }) => {
  /* inline stack a:[40], b:[40] (b partial) on fixed 0..100: b's hollow marker at yScale(80) ±0.5;
     on fixed 0..50 clip-indicated: b's clip break at the plot top, a has none; note '1 value above 50 …' rendered */
});
test('clip-indicated bar draws a break marker', async ({ page }) => {
  /* inline vertical spec, fixed 0..50 domain, overflow clip-indicated, value 80: zigzag break at the plot top ±0.5 across the bar; the clip note text is rendered */
});
test('fixed bar domain is not widened by overflowing values (R73)', async ({ page }) => {
  /* bar-fixed-domain-clipped: the overlay probe's committed y domain (useYAxisDomain('pct')) equals [0, 100] exactly, and the top tick is 100;
     yScale(100) equals the plot top ±0.5; series:cov:clip-indicator has 2 items (c2, c4) at the plot top; c1, c3, c5 heights equal
     yScale(0) − yScale(v) ±0.5; note '2 values above 100 are clipped at the top edge (max 130)' rendered */
});
test('bar quality encodings draw (R50)', async ({ page }) => {
  /* bar-quality-states: c2 bar has a dashed stroke (strokeDasharray = theme estimated dash) and no marker; c3 ringed marker and c4 hollow marker
     at yScale(value) ±0.5 on the bar's slot centre; legend shows the Estimated, Lagging and Partial entries */
});
test('percent placeholders draw instead of segments', async ({ page }) => {
  /* bar-age-bands-percent: svc-a segment heights 25 % and 75 % of plot height ±0.5; no segment items for svc-c, svc-d;
     placeholder texts 'No data (0)' at svc-c and 'Unavailable' at svc-d (role direct); dashed outline spans the plot height at svc-d */
});
test('reference line and markers bind to their named axis', async ({ page }) => {
  /* composed-remediation-days-counts: d5 ringed marker and d6 hollow marker at the days-axis scale ±0.5; reference at days 30;
     composed-flow-cumulative: balance line vertex for −12 below the balance-axis zero, 'Break-even' at the balance zero;
     composed-revenue-margin: line points at band centres on the pct axis, 'Margin goal' at pct 20 */
});
test('value labels draw in interactive mode', async ({ page }) => {
  /* mountCharts staticLabels:false on bar-severity-counts: labels:value has 4 items; React <Chart> (staticLabels default false) shows the same */
});
test('annotation and reference labels draw in interactive mode on bars (R44)', async ({ page }) => {
  /* mount composed-remediation-days-counts with staticLabels:false: 'Process change' and '30-day target' text present */
});
test('role legend renders with pattern swatches', async ({ page }) => {
  /* bar-severity-counts with the security override: legend items Critical, High, Medium, Low; Critical/High/Medium swatches fill url(#…)
     resolving to <pattern> in the same svg; bars use the same patterns; Low is solid */
});
```

`mount.spec.ts` additions: `bar-all-zero` and `cartesian-empty-series` resolve (§9 readiness fixtures); hiding one bar item through a harness hook rejects `RENDER_FAILED` with `rule: 'mark-count-mismatch'`; `min-area` still rejects with `rule: 'not-implemented-in-slice'` (until Task 12); `bar-ranking-horizontal` rejects with a message matching `horizontal bars are drawn later in slice 2` (until Task 11b).

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-bars.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Record which spike fallbacks and which R58 branch are live in a comment at the top of `bars.tsx`, and R62 in the ledger if fallback O applies.
- [ ] **Step 4: Run** them, the whole `--project browser` suite (slice-1 line tests stay green) and `pnpm build:docs && pnpm test:docs`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): vertical, grouped, stacked and percent bars with patterns, placeholders, partial cues and value labels`

---

### Task 11b: Horizontal orientation, overlays and clip breaks

**Files:**

- Create: `src/render/recharts/horizontal.tsx` (category `YAxis`, value `XAxis` set-up), `tests/browser/geometry-horizontal.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,bars.tsx}`, `src/render/primitives/{ValueLabels.tsx,PartialCues.tsx}`, `src/render/verify.ts` (`CommitExpectations` carries `orientation`; the probe reports the category domain from whichever axis holds it), `src/render/pipeline.ts` (`RENDERED_ORIENTATIONS` adds `horizontal`), `tests/browser/mount.spec.ts`

**Interfaces:**

- Consumes: Task 1 point 7 (fallback H), Task 8 horizontal layout, Task 11a bars and overlays.
- Produces:
  - `chartMargin(laid)` generalised to horizontal layouts (category axis on the left, value axes bottom/top) so `usePlotArea()` still equals `laid.boxes.plot` within 0.5.
  - Horizontal charts: `ComposedChart layout="vertical"`, category `YAxis type="category" scale="band"` with `width = boxes.xAxis.width` and the `PlacedTick` renderer, value `XAxis type="number" scale="linear" allowDataOverflow` per value axis (`orientation` bottom/top), horizontal value-axis titles from `yAxisTitles`.
  - `slotGeometry(laid, slot, xKey)` returns `{ y, height }` in horizontal orientation (slots run top to bottom in slot order).
  - Horizontal overlays: vertical gridlines; annotations as horizontal lines at the category band centre with their label; reference lines vertical on value axes; quality, partial and partial-stack markers and value labels at the member's cumulative end (right for positive, left for negative); clip breaks at the left/right plot edge.
  - `RENDERED_ORIENTATIONS` = `vertical`, `horizontal`. If fallback H applies, horizontal bars are DravenViz rectangles from `slotGeometry` inside the same chart.
  - The focus and hit-test geometry for horizontal bars is produced in Task 15 from the same `slotGeometry`.

- [ ] **Step 1: Write the failing tests** in `geometry-horizontal.spec.ts`:

```ts
test('horizontal ranking: bars from zero, plot area, threshold, role colours', async ({ page }) => {
  /* bar-ranking-horizontal: usePlotArea equals laid.boxes.plot ±0.5; category k centred at plot.y+(k+0.5)·h/10 ±0.5;
     bar widths ∝ values ±0.5 starting at xScale(0); reference line vertical at xScale(30) with label '30-day threshold';
     overdue bars fill url(#…) over #a61b1b (diagonal), on-track bars solid; role legend shows Overdue and On track */
});
test('horizontal grouped bars keep series order top to bottom', async ({ page }) => {
  /* bar-horizontal-grouped: inside each band the bars are ordered opened, closed, reopened from top, each matches slotGeometry ±0.5;
     widths ∝ values from xScale(0); reopened has 3 items (east is null) and south's zero bar is a zero-width path */
});
test('horizontal absolute stack with negative members', async ({ page }) => {
  /* bar-horizontal-stacked: positives extend right of xScale(0), negatives left, contiguous ±0.5 in series order;
     totals 8, -4, 11, 0 placed beyond the end of the side their sum falls on (−4 left of the negative end) */
});
test('horizontal stacked marker at the cumulative end', async ({ page }) => {
  /* inline horizontal stack a:[40], b:[40] (b partial): b's hollow marker at xScale(80) ±0.5 */
});
test('horizontal clip break and annotation', async ({ page }) => {
  /* inline horizontal spec fixed 0..50 clip with value 80: the committed value domain (useXAxisDomain) equals [0, 50] exactly (R73);
     zigzag at the plot's right edge ±0.5, clip note rendered;
     an annotation on category 2 draws a horizontal line at its band centre with its label (R44, staticLabels:false) */
});
test('horizontal value axis title and ticks', async ({ page }) => {
  /* bar-ranking-horizontal: 'Open age (days)' drawn horizontally below the tick labels, centred on the plot ±0.5; tick labels do not overlap */
});
```

`mount.spec.ts`: `bar-ranking-horizontal`, `bar-horizontal-grouped` and `bar-horizontal-stacked` resolve; `bar-compact-percent` still rejects with a message matching `the compact-stack preset is drawn later in slice 2` (until Task 12).

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-horizontal.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): horizontal bars with overlays, clip breaks and grouped/stacked modes`

---

### Task 12: Area and preset rendering

**Files:**

- Create: `src/render/recharts/areas.tsx`, `src/render/primitives/SparklineLabels.tsx`, `tests/browser/geometry-areas.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/primitives/style.ts` (`AREA_FILL_OPACITY`), `src/render/pipeline.ts` (`RENDERED_MARKS` adds `area`; `RENDERED_PRESETS` adds `sparkline` and `compact-stack`), `docs/design.md` §7 (`AREA_FILL_OPACITY`, R53) and §4 (the stacked-area strategy taken, R57), `tests/browser/mount.spec.ts`

**Interfaces:**

- Consumes: Task 1 points 12, 12b and 14 (strategy A), Task 5 area and stack models (extents, hint semantics, `baseline`), Task 9 preset layouts, the slice-1 `SeriesLines` estimated-range clip mechanism.
- Produces:
  - Unstacked areas: one Recharts `Area` per segment (own data key, like slice-1 lines) with `baseValue={series.baseline}` (R66), fill at the named render constant `AREA_FILL_OPACITY = 0.25`, top stroke in the series dash; estimated ranges dashed through the slice-1 complementary clip paths; group `series:<id>:area` with one `data-dv-item` per segment.
  - **Stacked areas (R57, primary when spike 12b passed):** per member, one ranged `Area` per model segment whose data key returns `[lower, upper]` from `stackExtent` (no `stackId`), so each segment is its own `data-dv-item` and the `series:<id>:area` count equals the model's segment count; opaque fill with the `theme.stroke.sliceBorder` background boundary along the upper edge; the first member's `lower` is `max(lower, baseline)` on an axis that excludes zero (the note comes from the model). Member-only breaks (`gap`, `marker-only`) end that member's segment while the members above keep their `[lower, upper]`; marker-only and isolated points draw their marker at `end`; estimated ranges dash only that member's segment (complementary clips per member segment); `monotone` interpolates each segment's upper and lower edges from the same values, so shared edges coincide. If spike 12 (not 12b) is the strategy, the record in design §4 says how per-segment items are produced; if neither passed, `render/primitives` draws the paths.
  - Sparkline: axes rendered with `hide`, no grid, no legend; `SparklineLabels` (`labels:sparkline`, role `direct`); the live `<desc>` ends with `Sparkline: axes and legend omitted`.
  - Compact-stack: value axis `hide` with domain `[0, 100]`; segment labels per Task 8; legend from Task 9.
  - `RENDERED_MARKS` = `line`, `bar`, `area`; `RENDERED_PRESETS` = `standard`, `sparkline`, `compact-stack` (scatter stays rejected).

- [ ] **Step 1: Write the failing tests** in `geometry-areas.spec.ts` (each stacked test also asserts that `series:<id>:area` item counts equal the model's segment counts):

```ts
test('min-area stack top equals the sum at band centres', async ({ page }) => {
  /* top edge y at each category = yScale(a+b) ±0.5 at plot.x+(k+0.5)·w/n */
});
test('stacked areas break at a partial-null position', async ({ page }) => {
  /* area-inventory-stacked: every member's area item count is 2 and no fill path covers the May band centre;
     the data table row for May reads '135 — Unavailable (missing member)' */
});
test('stacked area: gap on one member keeps the others', async ({ page }) => {
  /* inline 3-member stack, middle member renderHint gap at x2: the bottom and top members stay continuous across x2 (1 item each);
     the top member's lower edge at x2 equals the middle member's upper edge from its value ±0.5 */
});
test('stacked area: marker-only member marker at the cumulative value', async ({ page }) => {
  /* marker at yScale(upper) ±0.5 */
});
test('stacked area: isolated point marker', async ({ page }) => {
  /* a member point between two of its own gaps draws an isolated marker at yScale(upper) */
});
test('stacked area: estimated range dashed on that member only', async ({ page }) => {
  /* dashed copy only on that member's segment, clipped to its range ±0.5 */
});
test('stacked area: mixed signs', async ({ page }) => {
  /* inline stack with a negative member: it fills below zero, positives above, edges ±0.5 */
});
test('stacked area: monotone edges coincide', async ({ page }) => {
  /* monotone stack: member k's lower edge samples equal member k−1's upper edge samples ±0.5 */
});
test('area on an axis that excludes zero fills from the axis minimum', async ({ page }) => {
  /* inline area on fixed 40..70: the fill's lower edge is the plot bottom (yScale(40)) ±0.5; note 'Area filled from the axis minimum 40, not from zero.' rendered */
});
test('single area: segments, estimated dash, marker-only marker', async ({ page }) => {
  /* area-single-gaps: series:open:area has 3 items; dashed copy clipped to x(w8)…x(w10) ±0.5; w6 hollow marker at its value */
});
test('area on a time axis keeps true spacing', async ({ page }) => {
  /* inline time-axis area: gap ratio 31/7 ±0.5 as in the slice-1 line test */
});
test('sparkline draws no ticks and labels its omission', async ({ page }) => {
  /* line-sparkline at 680×180: no element with data-dv-text-role="tick"; labels 'p95 latency: 207 ms', '212', '207';
     svg <desc> contains 'Sparkline: axes and legend omitted'; the note text is rendered */
});
test('compact-stack: shares exact, tiny segment not inflated, legend values', async ({ page }) => {
  /* bar-compact-percent at 680×220: segment widths 78/17.75/4/0.25 % of plot width ±0.5 (the 0.25 % segment is 0.0025·w ±0.5);
     no tick text; legend text 'Compliant — 312 services (78%)'; note 'Segment labels not shown: All services — Critical gaps 0.3%' */
});
test('annotation on an area chart draws in interactive mode (R44)', async ({ page }) => {
  /* inline area spec with annotation, staticLabels:false */
});
```

`mount.spec.ts`: `min-area`, `area-single-gaps`, `line-sparkline` (680 × 180) and `bar-compact-percent` (680 × 220) resolve.

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-areas.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Record R53 and R57 (rendering part) in the slice-2 ledger and design §4/§7.
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): single and stacked areas with hint semantics, sparkline and compact-stack presets`

---

### Task 13: Donut rendering

**Files:**

- Create: `src/render/recharts/DonutChart.tsx`, `src/render/primitives/DonutParts.tsx` (track, centre, slice labels), `tests/browser/geometry-donut.spec.ts`
- Modify: `src/render/ChartView.tsx` (dispatch on `laid.model.kind`), `src/render/verify.ts` (donut branch of `expectationsOf`: no axis expectations; the probe check is skipped), `src/render/pipeline.ts` (`RENDERED_KINDS` adds `donut`; `notImplemented` message becomes `… Scatter, heatmap and progress charts are added in slice 3.`), `tests/browser/mount.spec.ts` and `tests/browser/react.spec.ts` (the not-implemented cases use `min-heatmap` and assert `/slice 3/` instead of `min-donut` and `/slice 2/`)

**Interfaces:**

- Consumes: `LaidOutDonut` (Task 10), Task 1 point 13 (fallback P), `Patterns`, `Legend`, `Title`, `Notes`, `planIds`.
- Produces:
  - `DonutChart(props: { laid: LaidOutDonut; theme; renderId; namespace; family; measure }): ReactElement`: a Recharts `PieChart` of `laid.width × laid.height` with one `Pie` (`cx`, `cy`, `innerRadius`, `outerRadius` from `laid.ring`, `startAngle={90}`, `endAngle={-270}`, `paddingAngle={0}`, `minAngle={0}`, `isAnimationActive={false}`, data = slices with value > 0 in order), a `shape` render prop drawing each sector as `<g data-dv-item><path/></g>` with fill (or pattern) and `stroke = background`, `strokeWidth = theme.stroke.sliceBorder`, inside `<g data-dv-mark="slice">`. The root carries the same `data-dv-render-id`, `data-dravenviz-ns`, `data-dravenviz-chart`, `role="img"`, title and desc as Cartesian charts.
  - `DonutParts`: `donut:track` (all-zero: a full ring in `theme.color.grid`; incomplete: a dashed ring outline in `theme.color.missing`), `donut:center` (value and label `DvText`, role `direct`), `labels:slice` (role `direct`). Legend rows carry `data-dv-legend-row="<slice id>"` so the focus ring (Task 15) can target them.
  - `RENDERED_KINDS` = `cartesian`, `donut`; `not-implemented-in-slice` now fires only for scatter series, heatmap and progress.

- [ ] **Step 1: Write the failing tests** in `geometry-donut.spec.ts`:

```ts
test("severity donut: arcs at model angles, clockwise from 12 o'clock", async ({ page }) => {
  /* donut-severity-share: for each slice the arc's start and end points on the outer radius equal
     (cx + R·sin θ, cy − R·cos θ) for the model's startDeg/endDeg within 0.5 units; slice order clockwise;
     every sector stroke is the background colour at sliceBorder width; centre texts '249' and 'Findings' */
});
test('tiny-slice donut keeps true angles', async ({ page }) => {
  /* donut-tiny-slices: 5 slice items (d4 is 0); d6 arc spans 360·2/220 ° within 0.5 units; d5 and d6 fill url(#…) patterns
     (slots 4 and 5); legend row '31–90 days — 0 (0%)' */
});
test('all-zero donut draws the neutral ring only', async ({ page }) => {
  /* donut-all-zero: donut:track 1 item, no slice group, centre '0', note rendered */
});
test('missing-slice donut draws the dashed track and no arcs', async ({ page }) => {
  /* donut-missing-slice: dashed stroke on the track, no slice group, centre 'Incomplete', legend 'Partial — Not measured' */
});
test('legend never on a tiny-slice donut names the slices in a note', async ({ page }) => {
  /* donut-tiny-slices with legend.show never: no legend rows; note 'Slice values not shown on the chart: …' rendered */
});
test('min-donut mounts; heatmap is the not-implemented example', async ({ page }) => {
  await expect(h(page).mount(['min-donut'], opts)).resolves.toHaveLength(1);
  expect(await h(page).mountError(['min-heatmap'], opts)).toMatchObject({
    code: 'RENDER_FAILED',
    message: expect.stringMatching(/slice 3/),
    rule: 'not-implemented-in-slice',
  });
});
```

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-donut.spec.ts tests/browser/mount.spec.ts tests/browser/react.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Fallback P (if taken) draws sectors as SVG arc paths from model angles inside a plain DravenViz `<svg>` with the same root attributes.
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut rendering with neutral and incomplete states`

---

### Task 14: Export coverage for the slice-2 families

**Files:**

- Modify: `src/render/svg/recharts-metadata.ts` (classify the Task 1 inventory additions), `src/render/svg/normalize.ts` (materializing styles on `pattern` children, and anything else the tests expose), `src/print/export.ts` (`summary()` for the exported `<desc>`), `tests/unit/recharts-metadata.test.ts`, `tests/unit/svg-validate.test.ts`, `tests/browser/export.spec.ts`

**Interfaces:**

- Consumes: the merged `attribute-inventory.json` (Task 1), `normalizeSvg`, `validateSvg`, `finalizeSvg`, `renderToSvg`, `renderToSvgWithAssets` (slice 1), Tasks 11a–13 renderers, `stackPositions`, `donutShares`.
- Produces: §10 guarantees for every slice-2 family; no API change. The exported `<desc>` summary (spec "Preserve distinct missing/zero/partial descriptions in summaries") adds, after the slice-1 missing/partial counts:
  - sparkline: `Sparkline: axes and legend omitted.`;
  - percent stacks: `N categories unavailable (missing member); M categories empty (total 0).` (only the non-zero parts);
  - absolute stacks: `N category totals partial.`;
  - donut: `All slices are zero.` or `Incomplete: N slices not measured; shares are not shown.`
  - Exact strings: singular `1 category unavailable (missing member)`, `1 category empty (total 0)`, `1 category total partial`, `1 slice not measured`; plural `2 categories unavailable (missing member)`, `2 categories empty (total 0)`, `2 category totals partial`, `2 slices not measured`.

- [ ] **Step 1: Write the failing tests.** `recharts-metadata.test.ts` already fails when the merged inventory has an unclassified pair; add `pie sector, bar shape and ranged area attributes are classified` naming the new pairs. `svg-validate.test.ts`: a `<pattern>` with a `path` child and `patternUnits="userSpaceOnUse"` passes; `fill="url(#p)"` with no `<pattern id="p">` fails `svg-dangling-reference`. `export.spec.ts`:

```ts
const SLICE2 = [
  'bar-age-bands-percent',
  'bar-ranking-horizontal',
  'bar-horizontal-stacked',
  'area-inventory-stacked',
  'donut-severity-share',
  'donut-tiny-slices',
  'line-sparkline',
  'bar-compact-percent',
  'bar-severity-counts' /* with the security override: role patterns */,
  'bar-fixed-domain-clipped',
  'bar-quality-states',
];
test('slice-2 charts export without renderer metadata', async ({ page }) => {
  for (const id of SLICE2) {
    const svg = await h(page).renderToSvg(id, { ...sizeOf(id), ...overrideOf(id), namespace: 'x' });
    expect(svg).not.toMatch(/class=|(^|\s)style="|recharts|foreignObject|<script|on[a-z]+=/i);
  }
});
test('pattern fills keep namespaced local references', async ({ page }) => {
  /* bar-severity-counts (override) and donut-tiny-slices: every fill="url(#…)" resolves to a <pattern> whose id matches ^x_<chartId>-\d+$ */
});
test('pattern ids are isolated between two instances in one document', async ({ page }) => {
  /* mountCharts bar-severity-counts twice with namespaces sc-a and sc-b (override): the two svgs share no id; every url(#…) in each svg
     resolves to a <pattern> inside that same svg; exporting each gives ids prefixed sc-a_ / sc-b_ only */
});
test('exported desc keeps preset and state summaries', async ({ page }) => {
  /* <desc> of line-sparkline contains 'Sparkline: axes and legend omitted.'; bar-age-bands-percent contains exactly
     '1 category unavailable (missing member); 1 category empty (total 0).'; donut-missing-slice contains exactly
     'Incomplete: 1 slice not measured; shares are not shown.'; bar-stacked-categories contains exactly '1 category total partial.' */
});
test('computed-style equivalence after standalone reload (slice 2)', async ({ page }) => {
  /* the slice-1 property list, for every id in SLICE2, including <pattern> children */
});
test('pattern children keep explicit initial values under a coloured parent (R73)', async ({ page }) => {
  /* normalize a fragment <g fill="red"><defs><pattern id="p" patternUnits="userSpaceOnUse" width="6" height="6">
     <path d="M0 0L6 6" style="fill:black;stroke:#000"/></pattern></defs><rect fill="url(#p)" …/></g>: after normalize + finalize
     the pattern's path still carries fill="black" (an initial value is never dropped when an ancestor sets a different inherited value),
     and its computed fill after standalone reload equals rgb(0, 0, 0); the slice-1 'inherited fill' regression stays green */
});
test('byte-identical repeat export (slice 2)', async ({ page }) => {
  /* each id in SLICE2 exported twice → identical */
});
test('embedded fonts for a donut', async ({ page }) => {
  /* donut-severity-share fontMode embedded → sha256 of data URLs equals PROVENANCE */
});
test('standalone files re-render identically (slice 2)', async ({ page }) => {
  /* 0 mismatched px at threshold 0.1 for each id in SLICE2 */
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/recharts-metadata.test.ts tests/unit/svg-validate.test.ts && pnpm test:browser --project browser tests/browser/export.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the classifications (each new pair as geometry or metadata per tag, never a catch-all; anything unknown still reaches strict validation and fails), the normalizer changes and the `summary()` additions.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(export): allowlist, pattern and desc-summary coverage for bars, areas and donuts`

---

### Task 15: React interaction: hit testing, keyboard and tables for the new families

**Files:**

- Create: `src/react/hit-test.ts`
- Modify: `src/react/{interaction.ts,Chart.tsx}`, `tests/browser/react.spec.ts`, `tests/unit/react.test.ts`

**Interfaces:**

- Consumes: `LaidOut`, `navigableDatums`, `moveFocus`, `announcement`, `nearestDatum`, `DatumEvent` (slice 1), `stackExtent`, `slotGeometry`, `resolveSlots`, `laid.ring`, `laid.legendRowBoxes`.
- Produces:
  - `Datum` keeps `pointId` and `seriesId` (slice 1); donut datums set `pointId` to the slice id and leave `seriesId` undefined. `Datum.value` becomes `number | null` and `Datum` gains `target: { kind: "point"; x; y } | { kind: "rect"; x; y; width; height } | { kind: "sector"; startDeg; endDeg } | { kind: "legend-row"; box: Box } | { kind: "ring-tick"; deg: number }`. Cartesian navigation keeps R5 (null datums are never produced); only donut datums can carry `null` (R64).
  - **`hitTest(laid: LaidOut, x: number, y: number): Datum | undefined` (R59)** in `hit-test.ts`, used by hover (tooltip) and click (`onDatumActivate`):
    - bars and stack segments: rectangle containment from `slotGeometry` and the member's `[lower, upper]` (no radius); a zero-height bar gets a hit band of ±4 units around its zero line (interaction target only, never drawn);
    - donut sectors: annulus (`innerRadius ≤ r ≤ outerRadius`) plus angle containment from the model angles; the hole and the outside hit nothing;
    - lines, area points and markers: `nearestDatum` with the existing radii (hover 20, click 16);
    - composed charts: a line datum within radius wins over bar containment; otherwise containment.
  - `navigableDatums(laid: LaidOut)`:
    - bars: one datum per drawn bar, zero bars included, nulls and placeholders skipped; in a composed chart Up/Down move across series in series order, bars and lines alike, landing on the nearest x;
    - area points as lines;
    - **donut (R64, owner decision; overrides R5 for donuts only):** one row visiting every slice entry in legend order, including null and zero slices, in every state (`ok`, `all-zero`, `incomplete`); Left/Right move, Up/Down do nothing. Focus cue: the arc when one is drawn; else the slice's legend row (`legendRowBoxes`); else (legend hidden, zero slice in an `ok` donut, or `all-zero` with the legend hidden) a radial tick on the ring at the slice's start angle.
  - Focus-ring positions: bar and stack member at its cumulative `end` from `slotGeometry` (vertical: top or bottom end; horizontal: right or left end), area point, donut slice mid-angle at the ring's mid-radius (or the fallbacks above).
  - Tooltip and announcement texts:
    - bar: `Findings, Critical: 12 count`;
    - percent stack member: `0–30 days, Payments: 10 items (25% of 40)` (§5.2 "tooltips always show both");
    - absolute stack member in a partial category: value plus `(total partial)`; the partial-stack marker announces `Archive Store: Partial stack — Critical not measured`;
    - a datum with a role: the role label after the value, e.g. `Open age, Customer Identity Verification: 68 days (Overdue)`; the role label is omitted when it equals the datum label (so `bar-severity-counts` reads `Findings, High: 31 count`, not `… (High)`);
    - donut `ok`: `Critical: 12 findings (4.8%)`; zero slice `31–90 days: 0 items (0%)`;
    - donut `all-zero`: `0–30 days: 0 items (–)` (no share exists, §5.3 "Shares show –");
    - donut `incomplete`: measured slices `Full: 12 systems` (no share), null slices `Partial: Not measured` (theme string);
    - `DatumEvent` for a donut slice has no `seriesId`, `datumId` = slice id, and `value` = the slice value or `null`.

- [ ] **Step 1: Write the failing tests** (`tests/unit/react.test.ts` covers `hitTest` on Node layouts; `react.spec.ts` covers the browser):

```ts
test('hitTest: inside a tall bar, near a segment boundary, in the donut hole', () => {
  // react.test.ts
  const bars = laidOf(validateSpec(loadFixture('bar-age-bands-percent')));
  const seg = rectOf(bars, 'a0', 'svc-a'); // helper from slotGeometry + extents
  expect(hitTest(bars, seg.x + seg.width / 2, seg.y + seg.height / 2)!.pointId).toBe('a0-1');
  expect(hitTest(bars, seg.x + 1, seg.y + 1)!.pointId).toBe('a0-1'); // just inside the boundary with a1
  const d = laidDonutOf(validateSpec(loadFixture('donut-severity-share')));
  expect(hitTest(d, d.ring.cx, d.ring.cy)).toBeUndefined();
  expect(hitTest(d, ...pointAt(d, 'low', 0.95))!.pointId).toBe('low'); // inside the sector near its outer edge
  const zero = laidOf(validateSpec(loadFixture('bar-all-zero')));
  expect(hitTest(zero, ...zeroLinePoint(zero, 'w2', +3))!.pointId).toBe('r2'); // within the ±4 hit band
});
test('hover and click well inside a bar select it', async ({ page }) => {
  /* bar-severity-counts: hover at the centre of the High bar (far from its top) → tooltip 'Findings, High: 31 count';
     click there → onDatumActivate({ datumId: 'h', source: 'pointer' }) */
});
test('pointer near a stack boundary selects the correct segment', async ({ page }) => {
  /* bar-stacked-categories: 1 unit inside the crit/high boundary on each side → crit, high */
});
test('donut hole and sector edge', async ({ page }) => {
  /* hover in the hole → no tooltip; hover just inside Low's outer edge → 'Low: 122 findings (49%)' */
});
test('line points keep proximity hit testing', async ({ page }) => {
  /* line-weekly-flow: the slice-1 pointer tests pass unchanged */
});
test('keyboard over grouped bars skips the missing bar', async ({ page }) => {
  /* bar-grouped: within series reopened, ArrowRight moves r1 → r2 (value 0, focusable) → r4; r3 (null) is never focused (R5) */
});
test('horizontal focus ring sits at the bar value end', async ({ page }) => {
  /* bar-ranking-horizontal: focus the first datum (`a1`, category `r1`); the focus ring centre is at (xScale(68), band centre of r1) ±0.5 and visible */
});
test("stacked focus ring at the member's cumulative end", async ({ page }) => {
  /* inline stack a:[40], b:[40], vertical: focus b → ring centre at yScale(80) ±0.5; the same spec horizontal → xScale(80) ±0.5 */
});
test('composed Up/Down moves between bars and the line', async ({ page }) => {
  /* composed-revenue-margin: focus rev r2; ArrowDown → mar m2; ArrowUp → rev r2; live region names 'Margin' then 'Revenue' */
});
test('percent tooltip shows value and share', async ({ page }) => {
  /* hover inside svc-a 0–30 segment → tooltip '0–30 days, Payments: 10 items (25% of 40)' */
});
test('donut keyboard, focus ring and activation', async ({ page }) => {
  /* donut-severity-share: focus; ArrowRight ×2; focus ring present, visible, and its centre lies inside the annulus;
     Enter → onDatumActivate({ datumId: 'high', source: 'keyboard' }) with no seriesId; live region 'High: 31 findings (12.4%)' */
});
test('incomplete donut traverses every slice including the missing one', async ({ page }) => {
  /* donut-missing-slice: ArrowRight visits full, part, none, unk; at part the live region reads 'Partial: Not measured' and the focus ring
     surrounds the legend row data-dv-legend-row="part"; Enter → onDatumActivate({ datumId: 'part', value: null }) */
});
test('all-zero donut traverses every slice', async ({ page }) => {
  /* donut-all-zero: three stops; live region '0–30 days: 0 items (–)'; focus ring on each legend row */
});
test('zero slice in an ok donut is focusable', async ({ page }) => {
  /* donut-tiny-slices: the d4 stop announces '31–90 days: 0 items (0%)' with the focus ring on its legend row */
});
test('DataTable renders share and role columns', async ({ page }) => {
  /* <DataTable spec=bar-age-bands-percent> has 8 header cells and 'Unavailable' in row 4; bar-ranking-horizontal has an 'Open age role' column */
});
test('unavailable categories are not focusable', async ({ page }) => {
  /* bar-age-bands-percent: svc-d members are never focused */
});
```

(`rectOf`, `pointAt`, `zeroLinePoint` join the helpers list with this task.)

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/react.spec.ts && pnpm vitest run tests/unit/react.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace the point-only pointer path in `Chart.tsx` with `hitTest`. Record R59 and R64 in the slice-2 ledger (R64 cites the owner's decision of 2026-10-01).
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(react): shape hit testing, keyboard traversal and tooltips for bars, areas and donuts`

---

### Task 16: DravenPDF `report-slice2` with real PDF evidence

**Files:**

- Modify: `examples/dravenpdf/run_pdf_check.py` (`--report <id>`, default `report-slice1`; `read_report(report)` parametrised), `examples/dravenpdf/bundle/{bootstrap.js,index.html}`, `examples/dravenpdf/test_driver.py`, `scripts/test-pdf.ts` (runs `report-slice1` then `report-slice2` against one warm server), `tests/pdf/compare.ts` (per-instance size and the tolerance lookup below), `tests/unit/pdf-prerequisites.test.ts`
- Create (evidence): `evidence/pdf/report-slice2.pdf`, `evidence/pdf/report-slice2.json`, `evidence/pdf/pages/report-slice2/page-*.png`, `evidence/pdf/crops/<namespace>.png` for the 24 slice-2 namespaces

**Interfaces:**

- Consumes: `report-slice2` and the catalog `size`/`themeOverride` fields (Task 3), the packed tarball, `asset-manifest.json`, the proven frame-discovery method recorded in `docs/plans/slice-1-pdf-probe-results.md` (`link-dest`, Ruling R35), `examples/dravenpdf/frame_calibration.json`, `tests/visual/tolerances.json`.
- Produces:
  - `charts.json` entries `{ spec, namespace, width, height, themeOverrides? }`. `bootstrap.js` groups entries by (width, height, themeOverrides), calls `mountCharts` once per group (each with `fit: "width"`, `theme: "print"`, its namespaces), awaits every handle, renders the tables, then sets `window.__DRAVENPDF_READY__ = true`; any rejection stays an uncaught page error.
  - Evidence layout: `report-slice1` paths are unchanged; `report-slice2` writes its PDF and JSON beside them, pages under `pages/report-slice2/`, and crops under `crops/<namespace>.png` (namespaces are disjoint, Task 3 test).
  - **Per-instance rendering options (R69):** `report-slice2.json` (and, from this task on, `report-slice1.json`) records per instance `{ fixture, namespace, specHash, options: { width, height, theme: "print", themeOverride?, locale, timezone, printWidthMm } }`, the input Task 18 matches against.
  - Checks for `report-slice2` (in addition to every slice-1 check, which runs per report):
    - A4, ≥ 1 page; every instance found exactly once by `link-dest`, with the identity residual (R35) ≤ 2 pt for **every** instance, including the 680 × 180 and 680 × 220 frames; each frame 178 mm wide (±0.5 mm) with the aspect ratio of its own size (680 : 320, 680 : 220 or 680 : 180, ±0.5 %).
    - Text layer: each title appears instances × 2 times (`Findings by severity` 4 times); extra text `Unavailable`, `No data (0)`, `Incomplete`, `No items (total 0)`, `Sparkline: axes and legend omitted`, `Segment labels not shown`, `Partial stacks: Archive Store — Critical not measured`, `Margin goal`, `30-day target`, `Break-even`, `30-day threshold`, `Capacity`, `Not measured`, `Process change`, `Overdue`, `2 values above 100 are clipped at the top edge (max 130)`, `Estimated`, `Lagging`; every match inside its frame or table.
    - **Overflow and quality marks (R73):** in the `bc` crop, the two clip breaks sit at the frame's plot top and no bar extends above it; in the `bq` crop, the estimated bar's outline is dashed. Both are also covered by the cross-path comparison.
    - Logical labels, effective font sizes by role (title 12–14 pt; tick, axis-title, legend, annotation, reference, direct ≥ 9 pt; note, caption ≥ 8 pt; −0.05 pt tolerance; ±0.15 pt against `ReadyInfo.effectivePt`) and oriented-quad clipping/overlap checks, exactly as slice 1.
    - Cross-path crop comparison against the browser print render at the same size and override. **Tolerance:** `tolerances.crossPdfBrowser` (the slice-1 line value) for every family until Task 17 writes the `families` keys; `compare.ts` reads `families[<family>].crossPdfBrowser` when present and falls back to `crossPdfBrowser` when the family key is absent.
  - **Ruling on the tolerance (pre-flight finding 16↔17):** the cross-path tolerance was calibrated on line charts only. If a slice-2 crop exceeds it, the run records the instance, its ratio and an investigation in `tests/visual/MISMATCHES.md`. A displaced mark, missing label or clipping is a defect fixed here. An antialiasing-only difference is input to Task 17's recalibration. Task 16 is complete when every other check passes and each over-tolerance crop is recorded as calibration-pending with that investigation; Task 17 re-runs `pnpm test:pdf`, which must then pass outright. Nothing is ever masked.

- [ ] **Step 1: Write the failing checks** in `run_pdf_check.py` (report-parametrised) and `test_driver.py` (`groups entries by size and override`, `aspect checked per instance`, `link-dest residual within 2 pt per instance`, `report-slice2 namespaces disjoint from report-slice1`, `report json records per-instance options`); keep `missing font fails the PDF render` (504 `render_timeout`, R36) running once.
- [ ] **Step 2: Run** `pnpm test:pdf`. Expected: FAIL (no `report-slice2` bundle).
- [ ] **Step 3: Implement** the driver, bootstrap and compare changes. Record R69 (PDF part) in the slice-2 ledger.
- [ ] **Step 4: Run** `pnpm test:pdf`. Expected: `PASS` for both reports (or the recorded calibration-pending state above), or `UNVERIFIED` with exit code 3 if a prerequisite is missing. Inspect every page render at 100 % and in grayscale for clipped text, overlaps, missing glyphs, unreadable patterns and unintended chart splits, and record the inspection in `evidence/pdf/report-slice2.json` (`review` field).
- [ ] **Step 5: Commit** the example changes and evidence. `feat(pdf): report-slice2 with bars, areas, composed charts, donuts and presets`

---

### Task 17: Visual candidates and recalibration (owner gate D4)

**Files:**

- Modify: `tests/visual/{candidates.ts,render.ts,generate.ts,visual.spec.ts,calibrate.ts,tolerances.ts,REVIEW.md,MISMATCHES.md,tolerances.json}`, `tests/pdf/compare.ts` (Chromium selection), `examples/dravenpdf/calibrate_pdf.py` (`--report <id>`, calling the Task 16 `read_report(report)`)
- Create: `tests/visual/baselines/candidates/<id>.png` for the slice-2 candidates

**Interfaces:**

- Consumes: the slice-1 generator and review-page flow (`pnpm visual:candidates` → `evidence/visual/index.html`), `pnpm visual:calibrate`, Task 16 crops and report JSON, the catalog `size`/`themeOverride`, `loadThemeOverride`.
- Produces:
  - `Candidate` gains `width` and `height` (from the fixture's catalog `size`, default 680 × 320) and `themeOverrides` (from `loadThemeOverride`). `render.ts` `options(c)` uses them for mount, export and the standalone `<img>`; `generate.ts` prints each candidate's own size.
  - 31 slice-2 candidates: `bar-severity-counts@{light,dark,print}`, `bar-ranking-horizontal@print`, `bar-horizontal-grouped@print`, `bar-horizontal-stacked@print`, `bar-stacked-categories@print`, `bar-age-bands-percent@{light,print}`, `bar-compact-percent@print`, `bar-grouped@print`, `bar-negative-values@print`, `bar-long-labels@print`, `bar-all-zero@print`, `cartesian-empty-series@print` (test-only fixture, not in `report-slice2`: the review page shows "no PDF crop"), `area-inventory-stacked@{light,print}`, `area-single-gaps@print`, `composed-revenue-margin@{light,dark,print}`, `composed-remediation-days-counts@print`, `composed-flow-cumulative@print`, `donut-severity-share@{light,dark,print}`, `donut-tiny-slices@print`, `donut-all-zero@print`, `donut-missing-slice@print`, `line-sparkline@{light,print}`.
  - The review page shows, per candidate, the browser render, the standalone SVG, the PDF crop (from `report-slice1` or `report-slice2`, whichever holds the fixture) and the data table, plus a grayscale rendering of each print candidate (spec "Review the A4 result … in grayscale"). Items to flag for the owner: slot-4/5 pattern density (`donut-tiny-slices`) and the security role patterns, the 0.25 % compact segment and its named-omission note, percent placeholders, the partial-stack cue at svc-d, donut centre sizing, sparkline proportions, role legends.
  - **Calibration plumbing:** `calibrate_pdf.py --report <id>` renders 10 measured PDF runs per report (`report-slice1` and `report-slice2`); `calibrate.ts` maps namespace → fixture → family from `fixtures/reports/report-slice{1,2}.json` and the catalog; the calibration record lists the sample count per family and comparison type; a family tolerance is written only with a nonzero sample count, else the run fails.
  - **Recalibration with a condition (R55):** `visual:calibrate` records observed maxima per family (`line`, `bar`, `area`, `composed`, `donut`) for each comparison type and writes `tolerances.json` as `{ tolerances: { …slice-1 keys… }, families: { <family>: { sameBrowser, samePdf, crossSvgBrowser, crossPdfBrowser } }, calibration }`. The `line` values stay the slice-1 values unless the line pairs themselves change in the new run; slice-2 families get their own values by the §16.2 rules (same-path max + 0.05 pp, cross-path max + 0.1 pp, capped at 1 %). `visual.spec.ts` and `tests/pdf/compare.ts` read the value for the fixture's family. The 14 approved slice-1 baselines are untouched.
  - **Chromium selection (R71):** `generate.ts`, `calibrate.ts` and `tests/pdf/compare.ts` select Chromium like R46: `PW_CHROMIUM_PATH` when set, else Playwright's resolved `chromium.executablePath()` of the `chromium` channel; no hard-coded `/opt` path.
- Visual baselines stay `pending owner review` until the owner approves them in the PR; the generator never writes `baselines/approved/` (D4, R6). CI's `visual` step (when the manually triggered workflow is run) stays red for pending candidates (R41).

- [ ] **Step 1: Write** the candidate list and structural assertions in `visual.spec.ts` for the new families (manifest mark counts, domain labels, segment and slice counts, annotation position ±0.5), the per-family tolerance lookup, and a unit check in `tests/unit/` that `calibrate.ts`'s family map covers every namespace of both reports.
- [ ] **Step 2: Run** `pnpm visual:calibrate && pnpm exec playwright test --project=visual`. Expected: FAIL with `pending owner review` for each slice-2 candidate; slice-1 baselines still pass at the unchanged line tolerance; the calibration record shows nonzero samples for `line`, `bar`, `area`, `composed` and `donut`.
- [ ] **Step 3: Generate** the candidates with `pnpm visual:candidates`, fill `REVIEW.md` (`pending`), publish the review page for the owner with the same flow as slice 1, and re-run `pnpm test:pdf` at the recalibrated tolerances (it must pass; resolve any Task 16 calibration-pending entries in `MISMATCHES.md`). Record R55 and R71 in the slice-2 ledger.
- [ ] **Step 4: Owner review gate.** Approved PNGs move to `baselines/approved/` in a commit citing the review, with SHA-256 checked against the reviewed images. Re-run: PASS.
- [ ] **Step 5: Commit** the candidates and records. `test(visual): slice-2 reference candidates and per-family tolerances`

---

### Task 18: Docs playground for slice-2 fixtures

**Files:**

- Modify: `docs/site/src/{fixtures.ts,components/PdfSample.tsx,routes/Playground.tsx}`, `scripts/stage-consumer.ts` (the staged `fixtures/index.json` gains `size` and `themeOverride` per fixture, with the override JSON copied to `fixtures/themes/security.json`; copies `report-slice{1,2}.pdf/.json` and checks their spec hashes like slice 1), `tests/docs/docs.spec.ts`

**Interfaces:**

- Consumes: the packed tarball, `FIXTURES`, `evidence/pdf/report-slice{1,2}.json` (with per-instance options, Task 16).
- Produces:
  - `FixtureInfo` gains `size?: { width; height }` and `themeOverride?: "security"`. The fixture selector lists `gallery: true` fixtures of slices 1 and 2, plus the `min-*` fixtures of slice-3 kinds (`min-scatter`, `min-heatmap`, `min-progress`), which still show `not-implemented-in-slice`. Selecting a fixture sets the width and height inputs to its catalog size and applies its override (shown as "Theme override: security").
  - **Render settings carry the override (R69):** `RenderSettings` gains `themeOverrides`; Copy options, Download SVG (both font modes) and the current render all use it.
  - **PDF sample matching (R69):** `PdfSample` receives the current spec hash **and** the applied settings, reads the report that holds the fixture, and claims "same as the PDF instance" only when the spec hash and every recorded option (width, height, theme, override, locale, timezone) match; otherwise it labels the link "Original fixture sample". (The Start page's Python recipe stays generic; no per-fixture options are added there.)

- [ ] **Step 1: Write the failing tests:**

```ts
test('slice-2 fixtures are selectable and render', async ({ page }) => {
  /* options include bar-age-bands-percent, donut-severity-share, line-sparkline; selecting each renders an svg with its <title>;
     line-sparkline sets Height to 180; bar-severity-counts shows 'Theme override: security' and patterned bars */
});
test('only slice-3 kinds show not-implemented-in-slice', async ({ page }) => {
  /* options contain min-scatter, min-heatmap, min-progress and not min-bar/min-donut; selecting min-scatter shows the rule */
});
test('slice-2 PDF sample link and hash', async ({ page }) => {
  /* donut-severity-share → a[href$="evidence/pdf/report-slice2.pdf"] with the hash from report-slice2.json */
});
test('unchanged JSON with changed options shows Original fixture sample', async ({ page }) => {
  /* line-weekly-flow: change Width to 600 without editing JSON → the PDF link is labelled 'Original fixture sample'; restore 680 → the match claim returns */
});
test('copied options and SVG export keep the security override', async ({ page }) => {
  /* bar-severity-counts: copied options JSON contains themeOverrides.roles.critical.color '#7f1d1d'; the downloaded SVG fills Critical with a pattern */
});
test('slice-2 SVG download is portable', async ({ page }) => {
  /* bar-ranking-horizontal default download: <svg xmlns, data:font/woff2, no class= */
});
```

- [ ] **Step 2: Run** `pnpm build:docs && pnpm test:docs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Record R69 (docs part) in the slice-2 ledger.
- [ ] **Step 4: Run** it. Expected: PASS. Refresh `evidence/screenshots/docs-playground.png` with a slice-2 fixture selected.
- [ ] **Step 5: Commit.** `feat(docs): playground renders slice-2 fixtures with sizes, overrides and option-aware PDF samples`

---

### Task 19: Measurements, verification matrix and slice close-out

**Files:**

- Modify: `scripts/measure-size.ts` (SVG bytes for every slice-2 `static` fixture; `report-slice2` PDF bytes and pages; gzip delta of the browser bundle attributed per slice-2 family by building with each family's renderer module stubbed), `evidence/perf/{size.json,latency.json,README.md}`, `docs/design.md` §18 (a new §18.2 "slice-2 baselines"; §18.1 budgets unchanged unless the owner rules), `evidence/verification-matrix.md`, `tests/unit/matrix.test.ts`, `tests/unit/perf-report.test.ts`, `CHANGELOG.md`, `docs/plans/handover/slice-2-ledger.md` (outcomes, deferred minors; the rulings are already there)
- CI: `.github/workflows/ci.yml` keeps its job shape (`install`, `lint-typecheck`, `unit`, `browser` with the separate `visual` step, `package`, `docs`, `pdf`); no job is added or removed. CI is triggered manually (`workflow_dispatch`, commit c42b6bf): the close-out records a manual run of the workflow (run URL and outcome) in the matrix, or states that none was run; nothing assumes push- or PR-triggered CI.

**Interfaces:**

- Consumes: every earlier task's evidence.
- Produces:
  - **Size (R70):**
    - `report-slice1` PDF bytes and pages are re-measured against their §18.1 budget (a regression check);
    - `report-slice2` PDF bytes and page count, and per-fixture SVG sizes for slice-2 fixtures (both font modes), are **new baselines**: §18.2 records measured + 20 % (the §18 rule) with the basis, not a regression comparison against the 8-instance slice-1 report;
    - browser bundle raw and gzip and ESM entries are compared with the §18.1 budgets; growth above a budget is attributed in `evidence/perf/README.md` (gzip delta per family) and investigated, and the owner rules on any new budget (recorded as a ruling); budgets are never raised by the implementer to absorb growth.
  - Latency: P1 (`perf-line-500x4`), P2 and P4 (`report-slice1`) re-measured with the slice-1 method, unchanged in definition. **Decision:** no bar/area perf scenario is added, because design §18 defines none for slice 2 (P3 `report-multi-family-a4` is slice 3). P1 p95 must stay ≤ 250 ms (R7 if not).
  - Matrix rows (`fixtures`, command, artifacts, status): `SPEC-2` (`bar-severity-counts`, `donut-severity-share`), `SPEC-3` (`composed-revenue-margin`), `SPEC-4` (`bar-age-bands-percent`), `SPEC-7-S2` (`bar-long-labels`, `bar-negative-values`, `bar-all-zero`, `donut-all-zero`, `donut-missing-slice`, `donut-tiny-slices`, `cartesian-empty-series`), `SPEC-10` (`composed-remediation-days-counts`, `composed-flow-cumulative`), `SPEC-11` (`bar-ranking-horizontal`, `bar-horizontal-grouped`, `bar-horizontal-stacked`, `bar-stacked-categories`, `bar-compact-percent`), `ROW-OPEN-ITEM-TRENDS` extended (`area-inventory-stacked`, `area-single-gaps`, `line-sparkline`), `ROW-COUNTS` (`bar-severity-counts`, `bar-ranking-horizontal`, `bar-horizontal-grouped`, `bar-horizontal-stacked`, `bar-stacked-categories`, `bar-grouped`, `bar-quality-states`), `BAR-OVERFLOW` (`bar-fixed-domain-clipped`: committed domain unchanged, clip breaks and note in browser, SVG and PDF; R73), `ROW-COMPOSITION`, `ROW-COMPOSED`, `ROW-DISTRIBUTIONS` (`donut-severity-share`, `donut-tiny-slices`, `donut-all-zero`, `donut-missing-slice`), `INTERACTION-S2` (hit testing and keyboard, Task 15 tests), `VISUAL-REFS-2` (`pending-review` until the owner approves), `PDF-SLICE2`, and one `GC-` row per slice-2 global constraint (`GC-15`…`GC-25`, eleven rows).

- [ ] **Step 1: Write** `matrix.test.ts` additions: every new row's fixtures exist in `FIXTURES` and artifacts exist; no row claims `pass` for PDF when `evidence/pdf/report-slice2.json` has `result != "pass"`; `VISUAL-REFS-2` is `pass` only when every slice-2 candidate's REVIEW decision is approved. `perf-report.test.ts`: `size.json` has a `report-slice2` entry with bytes and pages and a `baseline: true` flag, and the `report-slice1` entry is still compared with its budget.
- [ ] **Step 2: Run** `pnpm test:matrix && pnpm check:matrix && pnpm test:perf`. Expected: FAIL.
- [ ] **Step 3: Run** `pnpm measure`, write the matrix from actual outcomes, write §18.2 and the CHANGELOG (Unreleased: slice-2 families), and complete the slice-2 ledger (outcomes, deferred minors, R70 with the owner's budget ruling or "pending owner").
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm check:drift && pnpm test && pnpm test:perf && pnpm test:matrix && pnpm check:matrix && pnpm test:browser && pnpm test:dist && pnpm test:package && pnpm build:docs && pnpm test:docs && pnpm test:pdf`, and record each real outcome in the matrix's "Step 4 runs" table.
- [ ] **Step 5: Commit.** `ci: slice-2 measurements, baselines and verification matrix`

---

## Pre-flight scan

Pairs of tasks that share a file or interface, then each task's own consistency. Findings marked **ruling** are decided here and bind the briefs. Rows marked _(review)_ came from the independent plan review; rows marked _(owner feedback)_ from the external review, its validation and the owner's decisions of 2026-10-01.

| Tasks                          | Shared file / interface                                                                                                                                                                                          | Finding                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3, 11a, 11b, 16 (review 4)    | fixed value domains under `clip-indicated` | _(review 4)_ **ruling R73:** the third external review's slice-1 findings (`allowDataOverflow`, inheritance-safe materialization, oriented PDF label regions, the label-stage fixtures, the frame probe, portable SVG downloads, estimated/monotone fixtures) were already resolved in design revision 4 and the slice-1 plan and code. Applied to slice 2: `bar-fixed-domain-clipped` is added to `report-slice2` and the committed value domain is asserted to stay fixed in both orientations |
| 3, 11a, 14, 16 (review 4)     | bar quality encodings (R50) | _(review 4)_ fixed: `bar-quality-states` carries estimated, lagging and partial bars through browser, SVG and PDF; before this, the dashed outline was only unit-tested |
| 14 self (review 4)            | `normalize.ts` pattern children | _(review 4)_ fixed: a regression test keeps an explicit initial `fill` on a pattern child under a coloured ancestor |
| 1 self                         | spike wiring: `testMatch`, `cases.tsx` registry                                                                                                                                                                  | _(owner feedback)_ fixed: Task 1 edits `playwright.config.ts` and merges `CASES_SLICE2`/`PROBES_SLICE2`; Step 2 expects 11 discovered failing tests                                                                                                                                                                                     |
| 1 self                         | fallback matrix covers points 7–16 and 12b; point 12 asserts geometry, not "recorded"                                                                                                                            | _(owner feedback)_ fixed: S (10), defect rule (15), style rule (16); 12 checks no fill at the null band and cumulative tops                                                                                                                                                                                                             |
| 1→4, 11a                       | spike point 11 → two-axis bars                                                                                                                                                                                   | _(owner feedback)_ **ruling R52/R58:** shared slots across both axes; if Recharts overlaps them, DravenViz rectangles; `bar-axes-split` withdrawn (design §20)                                                                                                                                                                          |
| 1→12                           | spike 12/12b → stacked-area strategy                                                                                                                                                                             | _(owner feedback)_ **ruling R57:** ranged `Area` per member segment is primary when 12b passes (per-segment items, member-only breaks)                                                                                                                                                                                                  |
| 1→11a, 15                      | fallback O → geometry store, overlay pass, readiness, interaction                                                                                                                                                | _(owner feedback)_ **ruling R62:** store keyed by render id in `ChartView`, one extra overlay pass, readiness after it, stale writes ignored; interaction and export read the store                                                                                                                                                     |
| 1→14                           | merged `attribute-inventory.json` → `recharts-metadata.ts`                                                                                                                                                       | consistent: existing keys byte-identical; ranged-area pairs included                                                                                                                                                                                                                                                                    |
| 2→3                            | category caps (250 bars, 10,000 otherwise) → fixtures                                                                                                                                                            | consistent: no slice-2 fixture exceeds 250 categories (Task 3 test)                                                                                                                                                                                                                                                                     |
| 2→4, 5, 6, 11a, 13             | fill policy (slots 4–7, role pattern, `sliceBorder` boundaries, pattern constants)                                                                                                                               | consistent: stated once (R48) and reused                                                                                                                                                                                                                                                                                                |
| 2→all                          | design-edit list                                                                                                                                                                                                 | _(owner feedback)_ consistent: items 9–22 add the cumulative contract, stacked-area hints, partial cue, area baseline, segment labels, donut precedence, legends under `never`, `sum-not-finite` and the withdrawal of `bar-axes-split`, the hit-testing contract and donut keyboard, report options, per-family tolerances and §18.2   |
| 3→4…18                         | fixture ids and values                                                                                                                                                                                           | arithmetic checked: stacked totals 36/42/39/36/6; horizontal-stacked totals 8/−4/11/0; horizontal-grouped reuses `bar-grouped` values; percent shares 25/75/0 and 16/48/36; compact 78/17.75/4/0.25 of 400; donut total 249 with shares 4.8/12.4/33.7/49 %; tiny-slice donut 220 with 54.5/29.1/13.6/0/1.8/0.9 %; min-area totals 15/18 |
| 3→4, 9, 15, 16                 | series labels and reference `axisId`s                                                                                                                                                                            | _(review)_ consistent: every series and axis named; the sparkline label line uses the series label                                                                                                                                                                                                                                      |
| 3→7                            | row-header columns `Quarter`, `Service`                                                                                                                                                                          | consistent: Task 3 gives those fixtures x labels; Task 7 keeps the slice-1 header rule                                                                                                                                                                                                                                                  |
| 3→16, 17, 18                   | catalog `size` / `themeOverride` → bootstrap groups, candidate size, playground size                                                                                                                             | consistent: one source (the catalog), staged into the docs index by Task 18                                                                                                                                                                                                                                                             |
| 4→5                            | `SeriesModel` union, `BarModel.lower/upper`, `CartesianModel` new fields                                                                                                                                         | consistent: Task 4 sets unstacked extents; Task 5 fills stacked extents through `stackExtent`                                                                                                                                                                                                                                           |
| 4→6, 7, 11a, 15                | `resolveRole`, role legend items, role table column                                                                                                                                                              | consistent: §5.1 precedence and slot fallback in one function (R49); series roles produce no role item                                                                                                                                                                                                                                  |
| 4→8, 11a, 11b, 15              | tagged `BarSlot` keys                                                                                                                                                                                            | _(owner feedback)_ **ruling R61:** `{ kind, id }` everywhere (`slotGeometry(laid, slot, xKey)`); collision test in Task 4 and render test in Task 11a                                                                                                                                                                                   |
| 4→8, 11a, 15                   | slice-1 code assuming every series is a line                                                                                                                                                                     | **ruling:** Task 4 narrows overlays, ids, Legend and interaction with `s.mark === 'line'` (no behaviour change)                                                                                                                                                                                                                         |
| 4, 5, 6→guard→11a, 11b, 12, 13 | `RENDERED_MARKS` / `KINDS` / `PRESETS` / `ORIENTATIONS`                                                                                                                                                          | _(review)_ consistent: flips 11a (`bar`), 11b (`horizontal`), 12 (`area`, both presets), 13 (`donut`)                                                                                                                                                                                                                                   |
| 4, 6→slice-1 `mount.spec`      | `min-donut` rejection asserts `/slice 2/`                                                                                                                                                                        | _(review)_ consistent: guard reasons name `slice 2`; Task 13 moves the case to `min-heatmap` and `/slice 3/`                                                                                                                                                                                                                            |
| 5→4, 7, 11a, 11b, 14, 15       | cumulative extents                                                                                                                                                                                               | _(owner feedback)_ **ruling R56:** `stackExtent` is the single accessor for domains, clipping, markers, labels, focus, hit rectangles, table clip state and the export summary; the validator reuses `stackPositions`                                                                                                                   |
| 5→7, 14, 15                    | stack arithmetic in core                                                                                                                                                                                         | **ruling:** `src/core/shares/index.ts` (`stackPositions`, `stackExtent`, `donutShares`) is DOM-free, imported by path, not exported publicly                                                                                                                                                                                            |
| 5 self                         | stack positions on time axes                                                                                                                                                                                     | _(owner feedback)_ **ruling R68:** key by resolved epoch; test with `Z` vs `+02:00`                                                                                                                                                                                                                                                     |
| 5 self                         | non-finite sums                                                                                                                                                                                                  | _(owner feedback)_ **ruling R67:** `sum-not-finite` (`INVALID_SPEC`), invalid fixture added; rejects only specs that cannot render today                                                                                                                                                                                                |
| 5→8                            | `ValueLabelModel` texts → `PlacedValueLabel` fit                                                                                                                                                                 | _(owner feedback)_ **ruling R60:** labels for every drawn nonzero member of both signs at `ok` and `partial` positions; layout owns fit and named omissions                                                                                                                                                                             |
| 5→7, 11a, 15                   | partial-stack cue                                                                                                                                                                                                | _(owner feedback)_ **ruling R65:** zero extent plus marker, legend entry, named note and "Partial" qualifier, independent of `labels.values`                                                                                                                                                                                            |
| 5→12                           | area `baseline`                                                                                                                                                                                                  | _(owner feedback)_ **ruling R66:** nearest-edge fill with a note; no domain change, no rejection                                                                                                                                                                                                                                        |
| 5→11a                          | stack totals via the `Bar` `label` prop would vanish with a null top member                                                                                                                                      | _(review)_ **ruling:** all value labels are a DravenViz overlay from `slotGeometry` and the extents                                                                                                                                                                                                                                     |
| 6→10→13→15                     | donut state, option precedence, keyboard                                                                                                                                                                         | _(owner feedback)_ **rulings R63/R64:** state centre wins; incomplete forces the legend; hidden legend or `legendValues: "none"` names slices in a note; every slice entry is navigable, focus on arc → legend row (`legendRowBoxes`, `data-dv-legend-row`) → ring tick                                                                 |
| 6→10→13                        | `DonutModel` → `LaidOutDonut` → `DonutChart`                                                                                                                                                                     | consistent: compass degrees clockwise from 12 o'clock; the adapter maps them to `startAngle=90`/`endAngle=-270`                                                                                                                                                                                                                         |
| 7→15                           | `DataTable` share, role and partial columns → React `DataTable`, print `renderDataTable`                                                                                                                         | consistent: both render the table model unchanged                                                                                                                                                                                                                                                                                       |
| 8→9, 10                        | `NoteLine.kind`                                                                                                                                                                                                  | _(review)_ consistent: Task 8 adds `segment`, `preset`, `state`; Tasks 9 and 10 use them                                                                                                                                                                                                                                                |
| 8→1, 11a, 15                   | `resolveSlots`                                                                                                                                                                                                   | _(owner feedback)_ **ruling R61:** one slot formula with the inter-slot gap for layout fit, rendering (`barCategoryGap` as a percent string, `barGap` in pixels), the spike oracle and interaction                                                                                                                                      |
| 8 self                         | omission notes shrink the plot                                                                                                                                                                                   | _(owner feedback)_ **ruling R72:** bounded loop until the omitted set is stable; boundary test                                                                                                                                                                                                                                          |
| 8, 9, 10→pipeline              | `verifyAndReport` reads `laid.manifest`                                                                                                                                                                          | consistent: Task 8 switches it; Tasks 9 and 10 add label groups                                                                                                                                                                                                                                                                         |
| 8→11b                          | `chartMargin`; horizontal value-axis titles                                                                                                                                                                      | owned by Task 11b; Task 8 specifies horizontal `yAxisTitles`                                                                                                                                                                                                                                                                            |
| 10→11a, 11b, 12, 13, 15        | `LaidOut` union vs `LaidOutChart`                                                                                                                                                                                | **ruling:** `LaidOutChart` keeps its Cartesian meaning; Task 10 widens `verifyAndReport` and `expectationsOf`                                                                                                                                                                                                                           |
| 11a→11b                        | `slotGeometry`, `ValueLabels`, `PartialCues`, overlays                                                                                                                                                           | consistent: 11b extends them to horizontal                                                                                                                                                                                                                                                                                              |
| 11a, 11b→14                    | bar `shape` items, pattern ids via `planIds`                                                                                                                                                                     | consistent: namespaced `<ns>_<chartId>-<n>`; two-instance isolation tested in Task 14                                                                                                                                                                                                                                                   |
| 11a, 11b, 13→15                | focus and hit geometry                                                                                                                                                                                           | _(owner feedback)_ **ruling R59:** rectangle and annulus containment from `slotGeometry`, extents and `laid.ring`; never Recharts DOM                                                                                                                                                                                                   |
| 11a / 13 → slice-1 tests       | `docs.spec` uses `min-bar`; `mount.spec`/`react.spec` use `min-donut`; `model-line`/`table` use `min-bar`/`min-area`/`min-donut` as unsupported                                                                  | each flip owned: Task 4, 5, 6, 7 (→ `min-heatmap`), 11a (`docs.spec` → `min-scatter`), 13 (`mount.spec`, `react.spec` → `min-heatmap`, `/slice 3/`)                                                                                                                                                                                     |
| 13 self, 11a self              | `mountError` shape is `{ code, message, chartId, path, rule }`                                                                                                                                                   | _(owner feedback)_ fixed: browser tests assert `rule`, not `issues` (unit tests through `catchErr` still read `issues`)                                                                                                                                                                                                                 |
| 12, 14                         | live `<desc>` vs exported `<desc>` (`summary()`)                                                                                                                                                                 | _(review)_ consistent: Task 14 extends `summary()` with exact singular/plural strings                                                                                                                                                                                                                                                   |
| 14→16                          | export path vs PDF compare                                                                                                                                                                                       | consistent: `tests/pdf/compare.ts` compares against the browser render, not the SVG                                                                                                                                                                                                                                                     |
| 16↔17                          | cross-path tolerance calibrated on lines; recalibration needs slice-2 PDF crops                                                                                                                                  | circular → **ruling** in Task 16: until Task 17 writes `families`, `compare.ts` uses `crossPdfBrowser` for every family; over-tolerance crops are recorded calibration-pending; Task 17 recalibrates (R55) and re-runs `test:pdf`                                                                                                       |
| 16→17                          | `read_report(report)` → `calibrate_pdf.py --report`                                                                                                                                                              | _(owner feedback)_ consistent: Task 16 parametrises the driver, Task 17 calls it for both reports                                                                                                                                                                                                                                       |
| 17 self                        | calibration plumbing: `render.ts` sizes and overrides, namespace → family map, nonzero samples, Chromium selection                                                                                               | _(owner feedback)_ fixed (R71)                                                                                                                                                                                                                                                                                                          |
| 16→18                          | per-instance options in the report JSON → `PdfSample` matching                                                                                                                                                   | _(owner feedback)_ **ruling R69:** match on spec hash and options; override inside render settings                                                                                                                                                                                                                                      |
| 17→19                          | REVIEW decisions → `VISUAL-REFS-2` status                                                                                                                                                                        | consistent: `pending-review` until the owner approves (D4)                                                                                                                                                                                                                                                                              |
| 19 self                        | report growth vs regression budgets                                                                                                                                                                              | _(owner feedback)_ **ruling R70:** `report-slice2` and slice-2 SVGs are §18.2 baselines; `report-slice1` stays a regression check; bundle growth attributed per family; the owner rules on new budgets                                                                                                                                  |
| 2 self                         | `maxItems` 10,000 + `category-count`; theme test is a guard                                                                                                                                                      | consistent: stated in Step 2                                                                                                                                                                                                                                                                                                            |
| 3 self                         | 24 catalog ids vs 24 report instances                                                                                                                                                                            | consistent: 21 distinct fixtures in the report (two instances of `bar-severity-counts`); `cartesian-empty-series` is test-only and not in the report                                                                                                                                                                                    |
| 4 self                         | include-zero default only for axes carrying bars; all-zero → `[0, 1]`                                                                                                                                            | consistent: line-only axes keep `fit`, so slice-1 domains are unchanged                                                                                                                                                                                                                                                                 |
| 5 self                         | percent axis `unit: "% of total"`; absent points = missing                                                                                                                                                       | consistent: validation forbids a caller unit there; R27                                                                                                                                                                                                                                                                                 |
| 6 self                         | legend `B — 0 (0%)` vs all-zero `A — 0 (–)`                                                                                                                                                                      | consistent: a zero slice in an `ok` donut has a 0 % share; in `all-zero` no share exists (§5.3)                                                                                                                                                                                                                                         |
| 7 self                         | absolute-stack total column only when totals are requested; partial qualifier always                                                                                                                             | consistent with "never silently aggregate" and R65                                                                                                                                                                                                                                                                                      |
| 8 self                         | horizontal labels wrap to 3 lines; vertical labels wrap to 2 then rotate                                                                                                                                         | intended difference, stated in the rule                                                                                                                                                                                                                                                                                                 |
| 9 self                         | sparkline 168.25 ≤ 180 and compact 195.5 ≤ 220 at fontScale 1                                                                                                                                                    | arithmetic checked                                                                                                                                                                                                                                                                                                                      |
| 9 self                         | legend text `1 services`                                                                                                                                                                                         | intended: units are verbatim                                                                                                                                                                                                                                                                                                            |
| 10 self                        | `innerRadius = 0.6 × outerRadius`; centre fit `2 × inner × 0.9`                                                                                                                                                  | consistent                                                                                                                                                                                                                                                                                                                              |
| 11a self                       | files created (`bars.tsx`, `geometry-store.ts`, `Patterns.tsx`, `Placeholders.tsx`, `ValueLabels.tsx`, `PartialCues.tsx`, `geometry-bars.spec.ts`) vs touched (`ChartView.tsx`, `docs.spec.ts`, `mount.spec.ts`) | consistent                                                                                                                                                                                                                                                                                                                              |
| 11b self                       | files created (`horizontal.tsx`, `geometry-horizontal.spec.ts`) vs touched (`bars.tsx`, `ValueLabels.tsx`, `PartialCues.tsx`, `verify.ts`)                                                                       | consistent (interaction geometry moved to Task 15)                                                                                                                                                                                                                                                                                      |
| 12 self                        | `AREA_FILL_OPACITY` is a named render constant, not a theme token                                                                                                                                                | consistent: design §7 and R53                                                                                                                                                                                                                                                                                                           |
| 14 self                        | `SLICE2` covers patterns, horizontal stacks, pie sectors, ranged areas and hidden axes                                                                                                                           | consistent                                                                                                                                                                                                                                                                                                                              |
| 15 self                        | `Datum.value` nullable only for donut datums; Cartesian keeps R5                                                                                                                                                 | consistent with R64 (donut-only override)                                                                                                                                                                                                                                                                                               |
| 17 self                        | 31 candidates: 3+1+1+1+1+2+1+1+1+1+1+1+2+1+3+1+1+3+1+1+1+2                                                                                                                                                       | arithmetic checked                                                                                                                                                                                                                                                                                                                      |
| 18 self                        | selector rule `gallery && slice ≤ 2` plus slice-3 `min-*`; staged index carries size and override                                                                                                                | consistent                                                                                                                                                                                                                                                                                                                              |
| 19 self                        | CI job shape unchanged; eleven GC rows for eleven slice-2 constraints                                                                                                                                            | consistent                                                                                                                                                                                                                                                                                                                              |

**Review items ruled against (kept as written):** none. Where the validation offered alternatives: segment omissions are named in a note (not drawn as callouts); the donut keyboard follows the owner's decision (every slice entry, R64) rather than the validator's "skip nulls" recommendation; the all-zero donut announcement keeps the §5.3 share text `(–)` (no share exists), while a zero slice in an `ok` donut announces `0 items (0%)`.

## Out of scope (later slices)

- **Slice 3:** scatter/bubble (including size outside `bubble.domain`), heatmap, progress bar and ring, static scatter label collision handling (the `StaticLabelPlacer` seam), annotation `x2 < x` and overlapping annotation labels, inline marker geometry (`r` set inline so host `circle{r}` CSS cannot change it), the multi-family A4 report and P3.
- **Slice 4:** the consumer TypeScript 5.4/6.0 declaration check (R40), the `Theme` shape freeze (legend quality strings), the narrow-width title cap (R24), making the cross-mode tolerances (`samePdf`, `crossSvgBrowser`) gate tests, the docs gallery/API/styling/export/testing pages, and P4 for `report-multi-family-a4`.

## Slice-2 exit criteria

- The Task 1 spike passed, or its fallbacks were applied and recorded in design §4 and the slice-2 ledger (R2).
- Every slice-2 family and mode (vertical and horizontal; single, grouped, absolute and percent stacked bars; single and stacked areas; composed dual axis; donut; both presets) renders through React, `mountCharts`, standalone SVG, the docs playground and a real DravenPDF PDF from the packed tarball; `not-implemented-in-slice` fires only for scatter, heatmap and progress.
- Pointer and keyboard interaction reach every drawn datum and every donut slice entry (R59, R64).
- All scripts in Task 19 Step 4 have actual recorded outcomes; nothing is reported as passing without a run.
- `test:pdf` reports `pass` for `report-slice1` and `report-slice2`. `UNVERIFIED` (exit 3) or `fail` leaves slice 2 incomplete and is reported as such.
- Slice-2 visual candidates are `approved` by the owner (`pending-review` keeps the slice open; never self-approved).
- P1 p95 ≤ 250 ms; size items within the §18.1 budgets or investigated with a recorded resolution; §18.2 baselines written; any new budget ruled by the owner.
- The slice-3 plan is written next, against design §21, reusing the interfaces produced here.
