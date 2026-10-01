# Slice 2: bars, areas, composed/dual axis, donut and presets — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the slice-1 renderer to every slice-2 family in design §21: bars (single, grouped, absolute and 100 % stacked, vertical and horizontal, with the percent unavailable and empty states), single and stacked areas, composed bar + line charts on two named axes, donut, and the sparkline and compact-stack presets. Each family gets fixtures, a DOM-free model, layout, rendering through the same `mountCharts` / `<Chart>` / `renderToSvg` lifecycle, data tables, export coverage, visual candidates for owner review and a real DravenPDF report (`report-slice2`).

**Architecture:** Unchanged from slice 1: `validateSpec` → `buildModel` → layout → one React SVG tree → mount or export (normalize → strict validate → finalize). Cartesian families render through Recharts `ComposedChart` (`layout="vertical"` for horizontal bars) and donut through Recharts `PieChart` (design §4). DravenViz owns data meaning (domains, ticks, stack contributions and shares, gaps, states, labels, layout boxes); Recharts owns pixel placement of its marks (D8). Overlays (placeholders, value labels, quality markers, clip breaks, annotations, reference labels, sparkline labels, donut track and centre) are DravenViz SVG children positioned through Recharts' public hooks, the D8 oracle or DravenViz layout.

**Tech Stack:** As slice 1 (TypeScript 6.0, pnpm 10.33.0, Node 22.22, React 19.3.0 with react-is 19.3.0, Recharts 3.10.1, Ajv 8 standalone, tsup, esbuild, Vitest 5, Playwright 1.56.1 with Chromium 141.0.7390.37 revision 1194, Vite 8, CodeMirror 6; Python 3.12, uv, DravenPDF `7a249e0`, Noto Sans v2.015). No new runtime dependency.

**Spec:** `docs/spec.md` (product brief, binding) and `docs/design.md` (revision 4, the contract). Section references (§n) point to `docs/design.md`. Rulings R1–R46 in `docs/plans/handover/slice-1-ledger.md` bind unless a task below revisits one with a recorded reason. Slice-1 spike results: `docs/plans/slice-1-spike-results.md`. Slice-1 plan (interfaces reused here): `docs/plans/2026-09-30-slice-1-line-vertical-slice.md`.

**Rulings ledger:** every ruling made while executing this plan goes into `docs/plans/handover/slice-2-ledger.md` (created by the controller at execution time), numbered from **R47**, in the form `Ruling Rn: <decision> — <why> — <cost if wrong>`. A decision made inside a task (Task 2 cap and fills, Task 8 labels, Task 12 opacity, Task 17 tolerance, and any spike fallback) gets its own R-number when it is made, not at close-out.

**Test helpers:** spec builders and wrappers used in the unit tests below (`catchErr`, `lineSpecWithCategories`, `barSpecWithCategories`, `composedSpecWithCategories`, `model`, `modelOf`, `series`, `seriesWithTheme`, `barSpec`, `groupedBarSpec`, `stackSpec`, `donut`, `donutOf`, `donutSpec`, `laid`, `laidOf`, `laidAt`, `laidDonut`, `laidDonutOf`, `horizontalSpec`, `compactSpec`, `labelInsideSector`, `expectNoBoxOverlap`, `sparklineSpec`, `withoutSlice2Fields`, and the constant `rankingLabels`) live in `tests/unit/helpers/slice2.ts`. `laidOf(spec, width?, height?)` takes optional dimensions (default 680 × 320), like `laidAt(id, width, height)`. Task 2 creates the file; each later task adds the helpers its tests use before writing the tests. Browser helpers (`h(page)`, `items(page, key)`, `sizeOf(id)`, `overrideOf(id)`) extend `tests/browser/helpers.ts`.

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

- **Exact geometry, no minimum sizes.** Bars, stack segments and donut slices keep their true size; nothing is inflated for visibility. Small values are read through labels, named notes, the legend and the data table (spec "Preserve proportional geometry").
- **Percent stacks** are fed DravenViz-computed shares with `stackOffset="none"`; `stackOffset="expand"` is never used. A category with a missing member (a `null` value or no point at all, R27) is **unavailable** (no segments, dashed outline, `strings.unavailable`); a zero-total category is **empty** (baseline tick and `${strings.noData} (0)`, i.e. "No data (0)"). Known members are never renormalised (§5.2).
- **Absolute stacks** use `stackOffset="sign"`: positive members stack up from zero, negative members down from zero, in series order. A missing member leaves a gap and marks the category total partial.
- **Bars** appear only on category axes; every axis carrying bars includes zero; a measured zero is a drawn zero-height bar, a null is no bar (§5.2, §9).
- **Donut** draws no slice arcs and claims no share when any slice is null ("Incomplete"), and draws a neutral full ring with centre "0" when all slices are zero (§5.3).
- **Solid fills by default.** Bars, areas and donut slices are solid for palette slots 0–3; slots 4–7 carry the theme `seriesStyles[i].pattern`; a caller role `pattern` always wins. Stack segments and donut slices are separated by a background-coloured boundary of `theme.stroke.sliceBorder`. Lines never take a pattern (Task 2).
- **Colour never stands alone.** Every role used by a drawn datum has a legend entry with its label (and pattern swatch when it has one), and the data table names the role (Tasks 4, 7).
- **On-chart text in every mode.** Annotation and reference-line labels (R44), `labels.values` and `stacking.segmentLabels` are drawn in interactive and static mode alike; `staticLabels` governs `staticLabel` point labels only (Task 8). A segment label that does not fit is named in a printed note; never hidden behind a bare pointer to the table.
- `not-implemented-in-slice` remains only for scatter series, heatmap and progress (slice 3).
- Recharts is used only through documented props, render props (`shape`, `tick`) and public hooks; no Recharts class name, DOM structure or private state is read (spec; design §4).

## Review Focus

These nine situations are implied by the spec but not covered by any single task's main flow. Each has a named test in its owning task.

1. **A percent stack with a missing member next to an all-zero category in the same chart.** Expect the missing-member category unavailable (no segments, "Unavailable"), the all-zero category empty ("No data (0)"), the other categories' shares exact and summing to 100, and nothing renormalised. Owned by Task 5 (`missing member makes the category unavailable, never renormalised`) and Task 11a (`percent placeholders draw instead of segments`).
2. **An absolute stack whose members have mixed signs in one category.** Expect positives stacked up from zero and negatives down from zero in series order, and the total label showing the signed sum at the end of the side the sum falls on. Owned by Task 5 (`mixed-sign absolute stack grows both ways from zero`), Task 11a (`mixed-sign vertical stack places its total on the sum side`) and Task 11b (`horizontal absolute stack with negative members`).
3. **A composed chart whose line axis crosses zero while the bar axis includes zero**, so the two zero baselines sit at different heights. Expect each series, marker and reference line bound to its own named axis, with no merged units. Owned by Task 4 (`dual axes keep separate domains and units`) and Task 11a (`reference line and markers bind to their named axis`).
4. **A donut with one zero slice and one slice under 3 %.** Expect no arc for the zero slice but a legend row "0 (0%)", the tiny slice drawn at its true angle with no inline label, and its value and share in the legend and table. Owned by Task 6 (`zero and tiny slices keep true angles`) and Task 13 (`tiny-slice donut keeps true angles`).
5. **Horizontal bars whose category labels are longer than the left gutter allows.** Expect labels wrapped to at most 3 lines and never truncated; a label that cannot fit throws `LAYOUT_ERROR` naming the label and the width it needs. Owned by Task 8 (`horizontal category labels wrap, never truncate`).
6. **A stacked area whose middle member is null at one x position.** Expect every member of the stack to gap there (the layers above have no baseline) and the data table to mark the position "Unavailable (missing member)". Owned by Task 5 (`null member gaps every member of an area stack`) and Task 12 (`stacked areas break at a partial-null position`).
7. **A sparkline in print at 680 × 180.** Expect no axes, grid or legend, every remaining text at least 9 pt (captions 8 pt), and the omission stated in the live and exported `<desc>`, in the data-table notes and as a printed note. Owned by Task 9 (`sparkline omits axes and states it`) and Task 14 (`exported desc keeps preset and state summaries`).
8. **A stack member with no point at one category** (allowed: "one per category at most"). Expect it treated exactly like a null member: the percent category unavailable, the absolute total partial, the area stack gapped. Owned by Task 5 (`absent point counts as a missing member`).
9. **A stack whose top member is null at a category.** Expect the stack total label still drawn (it belongs to the stack, not to a member) and readiness to pass. Owned by Task 11a (`total label survives a null top member`).

---

## File structure (created or changed in this slice)

```text
spikes/recharts-3.10/  src/cases-slice2.tsx run-slice2.spec.ts (+ attribute-inventory.json extended)
docs/plans/slice-2-spike-results.md
schema/viz-spec-v1.schema.json            categories/labels cap 250 -> 10,000 (Task 2)
src/core/spec/types.gen.ts  src/core/validate/{ajv.gen.js,allowed.gen.ts,issues.ts,limits.ts}
src/core/shares/index.ts                  stack positions and donut shares, DOM-free, internal
src/core/table/index.ts                   bar, stack, area, role and donut tables
src/render/model/{types.ts,index.ts,cartesian.ts,bars.ts,stacks.ts,areas.ts,donut.ts,roles.ts,manifest.ts}
src/render/layout/{types.ts,index.ts,horizontal.ts,value-labels.ts,presets.ts,donut.ts}
src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts,bars.tsx,horizontal.tsx,areas.tsx,DonutChart.tsx}
src/render/primitives/{Patterns.tsx,Placeholders.tsx,ValueLabels.tsx,SparklineLabels.tsx,DonutParts.tsx,Legend.tsx,style.ts}
src/render/{ChartView.tsx,pipeline.ts,verify.ts}
src/render/svg/recharts-metadata.ts  src/print/export.ts (desc summary)
src/react/{interaction.ts,Chart.tsx}
fixtures/valid/<22 slice-2 fixtures>.json  fixtures/reports/report-slice2.json  fixtures/index.ts
examples/dravenpdf/{run_pdf_check.py,test_driver.py,bundle/bootstrap.js,bundle/index.html}  scripts/test-pdf.ts
tests/unit/{model-bar,model-stack,model-donut,layout-slice2}.test.ts  tests/unit/helpers/slice2.ts
tests/unit/fixtures/layout-slice1-snapshot.json
tests/browser/{geometry-bars,geometry-horizontal,geometry-areas,geometry-donut}.spec.ts (+ export, mount, react specs)
tests/visual/{candidates.ts,generate.ts,calibrate.ts,visual.spec.ts,REVIEW.md,MISMATCHES.md,tolerances.json}
docs/site/src/{fixtures.ts,components/PdfSample.tsx,routes/Playground.tsx}  scripts/stage-consumer.ts  tests/docs/docs.spec.ts
evidence/{pdf/report-slice2.*,pdf/pages/report-slice2/,pdf/crops/<ns>.png,visual/,perf/,verification-matrix.md}
docs/design.md                            §4, §5.1, §5.2, §5.3, §6, §7, §8, §13, §15, §18 (list in Task 2)
```

After Tasks 4–6 the model builds bar, area and donut models, but `buildLaid` keeps rejecting a family with `RENDER_FAILED` (`not-implemented-in-slice`) until its renderer lands: the guard checks mark (`RENDERED_MARKS`), kind (`RENDERED_KINDS`) and preset (`RENDERED_PRESETS`). Vertical bars land in Task 11a; horizontal bars in Task 11b; areas and both presets in Task 12; donut in Task 13. From Task 13 on, the rule fires only for scatter, heatmap and progress.

---

### Task 1: Recharts 3.10.1 slice-2 spike (proof gate)

**Files:**

- Create: `spikes/recharts-3.10/src/cases-slice2.tsx`, `spikes/recharts-3.10/run-slice2.spec.ts`
- Modify: `spikes/recharts-3.10/src/export-probe.ts` (reused for the new cases), `spikes/recharts-3.10/attribute-inventory.json` (merged additions, same format)
- Create: `docs/plans/slice-2-spike-results.md`

**Interfaces:**

- Consumes: the slice-1 spike harness (same Vite page, the same plot box 600 × 300 with margin {top 20, right 30, bottom 10, left 10}, `YAxis width=50`, `XAxis height=30`, so plot x=60, y=20, w=510, h=240).
- Produces: pass/fail for spike points 7–16 below, measured deltas, the merged attribute inventory, the fallback taken for any failed point, and the point-11 answer that Task 4 reads. Tasks 4, 11a, 11b, 12, 13 and 14 read the results file.

The slice-1 spike proved grouped/stacked bars and stacked areas on 4 categories, null gaps, first-commit geometry, export and host-style isolation (points 1–6). Slice 2 needs these unproven behaviours:

- [ ] **Step 1: Write the spike checks** in `run-slice2.spec.ts`, one test per point, against cases in `cases-slice2.tsx`:

```ts
test('7 horizontal bars: category band rows, overlays, plot area', async ({ page }) => {
  await page.goto('/?case=horizontal'); // ComposedChart layout="vertical", YAxis type=category scale=band, XAxis number
  const r = await page.evaluate(() => (window as any).probe.horizontal());
  expect(r.categoryDomain).toEqual(['A', 'B', 'C', 'D']); // useYAxisDomain(catId)
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
  await page.goto('/?case=wrapped');
  const r = await page.evaluate(() => (window as any).probe.wrapped());
  expect(r.groupedDistinctX && r.stackedSameX && r.areaTopEqualsSum).toBe(true);
  expect(r.itemsInsideWrapper).toBe(true); // every bar path is a descendant of its wrapper g
  expect(r.slotOracleDelta).toBeLessThanOrEqual(0.5); // bar x/width vs the D8 slot oracle (band, barCategoryGap, barGap)
});
test('10 percent stack: shares with stackOffset none; all-null category draws nothing', async ({
  page,
}) => {
  await page.goto('/?case=percent'); // members fed shares [25,75,0],[16,48,36],[null,null,null]
  const r = await page.evaluate(() => (window as any).probe.percent());
  expect(r.segmentEdgesDelta).toBeLessThanOrEqual(0.5); // edges at yScale(0), yScale(25), yScale(100)
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
  expect(typeof r.barsOnTwoAxesSideBySide).toBe('boolean'); // recorded; Task 4 reads it
});
test('12 areas: sign offset with a negative member, partial-null member, sizes 2/13/60, linear and time x', async ({
  page,
}) => {
  await page.goto('/?case=areas');
  const r = await page.evaluate(() => (window as any).probe.areas());
  expect(r.signNegativeBelowZero).toBe(true);
  expect(r.partialNull).toEqual({ recorded: true }); // shape of each member's path when only the middle member is null
  for (const n of [2, 13, 60]) expect(r.bandCentreDelta[n]).toBeLessThanOrEqual(0.5);
  expect(r.linearXDelta).toBeLessThanOrEqual(0.5);
  expect(r.timeXDelta).toBeLessThanOrEqual(0.5);
});
test("13 pie: 12 o'clock start, clockwise, exact boundaries; zero slice; all-zero", async ({
  page,
}) => {
  await page.goto('/?case=pie'); // Pie startAngle=90 endAngle=-270 paddingAngle=0 minAngle=0
  const r = await page.evaluate(() => (window as any).probe.pie());
  expect(r.firstStartDeg).toBeCloseTo(0, 2); // compass degrees, clockwise from 12 o'clock
  expect(r.maxBoundaryErrorDeg).toBeLessThanOrEqual(0.01);
  expect(r.zeroSliceArcLength).toBe(0);
  expect(typeof r.allZeroSectors).toBe('number'); // recorded: DravenViz draws the neutral ring itself
});
test('14 hidden value axis keeps scale hooks and takes no space', async ({ page }) => {
  await page.goto('/?case=hiddenaxis'); // XAxis hide domain [0,100] in layout="vertical"
  const r = await page.evaluate(() => (window as any).probe.hiddenAxis());
  expect(r.plotAreaMatchesLayoutBox && r.scaleHookWorks).toBe(true);
});
test('15 slice-2 charts survive normalize + strict allowlist', async ({ page }) => {
  await page.goto('/?case=export2'); // horizontal + percent bars, stacked areas, pie, a <pattern> fill
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

- [ ] **Step 2: Run** `pnpm --dir spikes/recharts-3.10 exec playwright test run-slice2.spec.ts` (with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Expected: FAIL everywhere, because `probe.*` for the new cases does not exist yet.
- [ ] **Step 3: Implement the probes** in `cases-slice2.tsx` (geometry read from the DOM for the checks only). Extend `export-probe.ts` so the merged inventory classifies every new element@attribute pair (Pie sector paths and any `cx`/`cy`/`name` they carry, Bar `shape` output, Area fills, `pattern` children). Write the additions into `attribute-inventory.json` under new component keys; the existing keys stay byte-identical.
- [ ] **Step 4: Run the spike again and record** `docs/plans/slice-2-spike-results.md` in the slice-1 format: every test now reports a real pass or fail (a failure is a result to record, not to hide), the result table, measured deltas, the inventory summary (new pairs and their classes, 0 unclassified), the point-11 answer, and the partial-null area observation (closes the slice-1 spike limit "partial missing member was not tested"). Apply the matching fallback for any failed point, record it in design §4 and as a ruling in the slice-2 ledger, and continue (R2, no stop):
  - **H** (point 7 or 14 fails): horizontal bars are drawn by `render/primitives` rectangles from DravenViz scales inside the same `ComposedChart` (overlays still read `usePlotArea`).
  - **Z** (point 8 fails, shape not called for zero): measured-zero bars are drawn as an overlay (a zero-height path at the scaled zero, slot from the D8 oracle).
  - **W** (point 9 wrapper check fails): `verifyCommitted` counts items by a `data-dv-of="<manifest key>"` attribute on each `data-dv-item` instead of group nesting.
  - **O** (point 9 slot-oracle check fails): value labels, focus ring and label fit read bar geometry from the committed `shape` props reported through a probe attribute (`data-dv-slot`) instead of the formula; Task 8 label-fit checks then use the conservative bound `bandWidth × (1 − barGap) / barSlots.length × 0.9`.
  - **A** (point 12 sign or partial-null fails): stacked areas are fed model-computed `[lower, upper]` ranges as ranged `Area`s without `stackId`.
  - **P** (point 13 fails): donut arcs are drawn by `render/primitives/DonutParts.tsx` from model angles (no `PieChart`).
  - Point 11 `barsOnTwoAxesSideBySide` and point 13 `allZeroSectors` are observations, not gates.
- [ ] **Step 5: Commit.** `spike: verify Recharts 3.10.1 horizontal bars, zero bars, percent stacks, areas and pie`

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
- **Decision R47 (queued item "relax the 250-category cap"; controller decision):** the schema keeps a protection bound of `maxItems: 10000` on `categories` and `labels` (matching the 10,000-point limit), reported as `LIMIT_EXCEEDED` rule `category-count` at `/xAxis/categories` (or `/xAxis/labels`). The semantic limit `bar-categories` (250, bar axes only) is unchanged. Accepting more input is backward compatible (design §20). Mismatched label counts stay `labels-length`.
- **Decision R48 (queued item "series slots 4–7 carry default fill patterns"):** spec "Use solid fills by default. Reserve hatching/patterns for distinctions that need them" and design §7 (`seriesStyles` carry `pattern`). Bars, areas and donut slices have no dash or marker shape to fall back on, and the print palette's grayscale separation (≥ 0.08 relative luminance) is guaranteed only across slots 0–3 (slice-1 Task 7 test). So:
  - slots 0–3 are solid (`pattern: "none"`, as today);
  - slots 4–7 draw their theme pattern (`diagonal`, `dots`, `crosshatch`, `diagonal`) as a low-density overlay on the slot colour, with geometry from named render constants in `src/render/primitives/style.ts`: `PATTERN_TILE = 6`, `PATTERN_STROKE = 1`, `PATTERN_OPACITY = 0.45` (stroke in the theme background colour);
  - precedence: datum role pattern > series role pattern > slot pattern; a role `pattern: "none"` switches a slot pattern off;
  - line series never use a pattern;
  - stack segment boundaries and donut slice borders both use `theme.stroke.sliceBorder` in the background colour.
- **Design-edit list** (every design-text change the slice needs; each item cites its ruling):
  1. §4: `buildLaid` returns `LaidOut = LaidOutChart | LaidOutDonut`; value labels and stack totals are overlays positioned from the D8 oracle; the render guard covers presets.
  2. §5.1: a role without a colour falls back to a palette slot by the role's position in `spec.roles` (then wraps every 8); every role used by a drawn datum gets a legend entry (`kind: "role"`) and a table role column (R49).
  3. §5.2 `CategoryAxis.categories` comment: `1–10,000 unique keys; axes carrying bars are limited to 250 (bar-categories)`.
  4. §5.2 `labels` comment: `on-chart value labels, drawn in every mode; default "none"` (replaces "static value labels").
  5. §5.2 bar quality encodings: `partial` → hollow marker and `lagging` → ringed marker at the bar's value end; `estimated` → dashed bar outline; each is listed in the legend (R50).
  6. §5.2 percent states: unavailable when a member is null **or has no point** at the category (R27); empty text is `${strings.noData} (0)`.
  7. §5.2 compact-stack: legend with values when the stack has one category; with several categories the legend shows labels only and the segment labels plus a note carry values, because a legend value would have to sum across categories (R51).
  8. §5.2 sparkline label line: `<series label>: <last display> <unit>` plus first/last value labels.
  9. §5.3: slice `color` > slice role colour > palette slot; all-zero legend text `<label> — 0 (–)`.
  10. §6: limit rule `category-count` (R47), a fixed schema bound of 10,000 that cannot be lowered per call (it has no `Limits` key; per-call lowering stays available for bar axes through `barCategories`); if Task 1 point 11 shows bars on two y axes overlap, the rule `bar-axes-split` (R52, conditional, see Task 4).
  11. §7: fill policy and pattern constants (R48), stack boundaries use `stroke.sliceBorder`, donut slot wrap after 8 slices, `AREA_FILL_OPACITY` (Task 12, R53).
  12. §8: value and segment labels drawn in every mode; a segment label that does not fit is listed by name in a printed note; more than 8 omitted segment labels throw `LAYOUT_ERROR` (R54).
  13. §13 and §15: `report-slice2`, the fixtures `bar-horizontal-stacked` and `donut-tiny-slices`, and per-entry sizes.
  14. §16.2: cross-path tolerances are recorded per family; the line value changes only if line pairs change (Task 17, R55).

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
- [ ] **Step 3: Implement** the schema edit, `pnpm gen`, the `LIMIT_PATHS` and rule-id edits, the design-edit list (items 1–14; items 10's conditional part and 11's opacity are written when Task 4 and Task 12 decide them) and the CHANGELOG. Record R47 and R48 in the slice-2 ledger.
- [ ] **Step 4: Run** the tests and `pnpm check:drift`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): category caps (250 for bars, 10,000 otherwise); fill policy and slice-2 design text`

---

### Task 3: Slice-2 fixtures and `report-slice2`

**Files:**

- Create: `fixtures/valid/{bar-severity-counts,bar-ranking-horizontal,bar-horizontal-grouped,bar-horizontal-stacked,bar-stacked-categories,bar-age-bands-percent,bar-compact-percent,bar-grouped,bar-negative-values,bar-long-labels,bar-all-zero,cartesian-empty-series,area-inventory-stacked,area-single-gaps,composed-revenue-margin,composed-remediation-days-counts,composed-flow-cumulative,donut-severity-share,donut-tiny-slices,donut-all-zero,donut-missing-slice,line-sparkline}.json` (22 fixtures), `fixtures/reports/report-slice2.json`
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
- `report-slice2`: `[{sc-a: bar-severity-counts}, {sc-b: bar-severity-counts}, {rh: bar-ranking-horizontal}, {hg: bar-horizontal-grouped}, {hs: bar-horizontal-stacked}, {gr: bar-grouped}, {st: bar-stacked-categories}, {ab: bar-age-bands-percent}, {cp: bar-compact-percent}, {nv: bar-negative-values}, {ll: bar-long-labels}, {bz: bar-all-zero}, {ai: area-inventory-stacked}, {ag: area-single-gaps}, {rm: composed-revenue-margin}, {rd: composed-remediation-days-counts}, {cf: composed-flow-cumulative}, {ds: donut-severity-share}, {dt: donut-tiny-slices}, {dz: donut-all-zero}, {dm: donut-missing-slice}, {sp: line-sparkline}]`, written as `{ "fixture": …, "namespace": … }` entries in that order (22 instances of 21 fixtures, two of `bar-severity-counts`).

- [ ] **Step 1: Write the failing tests:** every new fixture passes `validateSpec`; the 22 new ids are catalogued with `slice: 2` (alongside the existing slice-2 `min-*` entries); every series has a non-empty `label` and every reference line an `axisId` that exists; `size` is `680×220` for `bar-compact-percent`, `680×180` for `line-sparkline` and absent elsewhere; `themeOverride` is `security` exactly for the two severity fixtures and `loadThemeOverride` returns the parsed `examples/themes/security.json`; `report-slice2` lists `bar-severity-counts` twice with distinct namespaces; **no namespace appears in both `report-slice1` and `report-slice2`** (their PDF crops share `evidence/pdf/crops/`); every report namespace matches `^[a-z][a-z0-9-]{0,31}$`; no slice-2 fixture has more than 250 categories.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/fixtures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Author** the fixtures and catalog entries (coverage tags `brief-<n>`, `row:<name>` with new rows `row:counts`, `row:composition`, `row:composed`, `row:distributions`, and the `edge:<name>` tags given above plus `edge:all-zero`, `edge:empty-series`, `edge:percent-states`).
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
  - `BarModel = { pointId: string; xKey: string; value: number; state: "measured" | "zero"; quality: Quality }` (one per non-null point, in point order; nulls and absent points have no entry).
  - `PointModel` gains `pattern?: FillPattern` and `roleId?: string`.
  - `roles.ts`: `resolveRole(spec, theme, roleId): { color: string; pattern?: FillPattern; shape?: MarkerShape; label: string }` — colour `spec.roles[id].color` > `theme.roles[id].color` > palette slot by the role's position in `Object.keys(spec.roles)` (mod 8); pattern from the spec role, the theme role, else that slot's pattern; label `spec.roles[id].label ?? id`. Datum precedence stays §5.1: datum `color` > datum role > series `color` > series role > series slot.
  - `LegendItem.kind` gains `"role"` (`label`, `color`, `pattern`, `swatch: "fill"` for bar/area datums, `"marker"` for line datums). Each role used by a drawn datum appears once, in `spec.roles` order, after the series items; a series whose every drawn datum has a role gets no series item (its role items replace it). **A series-level `role` produces no role item:** it only colours the series (§5.1), and the series keeps its own legend item labelled with the series label; role items come from datum-level roles only. This keeps the slice-1 test in `tests/unit/model-line.test.ts` (series role `hot`, legend `Opened, Closed, Partial, Lagging`) green.
  - `CartesianModel` gains `orientation: "vertical" | "horizontal"`, `preset: "standard" | "sparkline" | "compact-stack"` and `barSlots: string[]` (the order Recharts places bars in a band: each unstacked bar series id, or a stack id at its first member's position).
  - Manifest keys `series:<id>:bar` (count = bars incl. zero), and the existing `series:<id>:marker` and `series:<id>:clip-indicator` for bar series.
  - In `pipeline.ts`: `RENDERED_MARKS: ReadonlySet<Series["mark"]>` (initially `line`), `RENDERED_KINDS` (initially `cartesian`), `RENDERED_PRESETS` (initially `standard`), and `RENDERED_ORIENTATIONS` (initially `vertical`); `buildLaid` throws `notImplemented(spec, reason)` for an unlisted value before layout. Reason texts keep the slice named, so slice-1 assertions on `/slice 2/` hold: `bar series are drawn later in slice 2`, `area series are drawn later in slice 2`, `donut charts are drawn later in slice 2`, `the sparkline preset is drawn later in slice 2`, `the compact-stack preset is drawn later in slice 2`, `horizontal bars are drawn later in slice 2`; scatter, heatmap and progress keep their `slice 3` reasons.
- Rules:
  - A y axis with no `domain` defaults to `include-zero` when any bar series binds to it, else `fit` (§5.2 ValueAxis comment; slice 1 always used `fit`, correct only because it had no bars). An include-zero axis whose data are all zero resolves to `[0, 1]` (slice-1 collapse rule).
  - Bar quality (R50): `partial` → hollow marker and `lagging` → ringed marker at the bar's value end (reason `quality`, variants from `variantOf`); `estimated` → no marker, dashed bar outline (Task 11a) and a legend entry `Estimated — Dashed outline: the value is estimated.` (`variant: "dashed-outline"`). Each quality that draws something is listed, as for lines.
  - `clip-indicated` bar axes: a bar beyond the domain records `{ pointId, side }` in `clipped` and the slice-1 clip note.
  - **Bars on two y axes (R52, decided from Task 1 point 11):** if Recharts places bars bound to different y axes side by side in one band, `barSlots` spans all bar series whatever their axis (as above). If it overlaps them, add the validation rule `bar-axes-split` (`INVALID_SPEC`, path `/series/<i>/yAxisId`, message "Bars must share one y axis; bind the other bars to the same axis or draw them as lines") with an invalid fixture and its expected file, and write it into design §6. No slice-2 fixture binds bars to two axes, so either branch is cheap.

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
  expect(r.bars[1]).toMatchObject({ value: 0, state: 'zero' });
});
test('negative bars grow from zero; domain covers both signs', () => {
  const y = model('bar-negative-values').yAxes[0];
  expect(y.domain[0]).toBeLessThanOrEqual(-15);
  expect(y.domain[1]).toBeGreaterThanOrEqual(22);
  expect(y.ticks.map((t) => t.value)).toContain(0);
});
test('grouped bars keep series order', () => {
  expect(model('bar-grouped').barSlots).toEqual(['opened', 'closed', 'reopened']);
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
test('every role used by a drawn datum has a legend entry', () => {
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
- [ ] **Step 3: Implement.** `bars.ts` builds `BarSeriesModel`; `roles.ts` resolves roles and their legend items; `cartesian.ts` dispatches per mark, computes the include-zero default and `barSlots`; area series still report `unsupported` until Task 5. Read Task 1 point 11 and take the R52 branch; record R49 (role fallback and legend), R50 (bar quality) and R52 in the slice-2 ledger. Keep every slice-1 line test green (the line model's JSON output is unchanged except for the added `mark: "line"` and the new top-level fields; slice-1 line fixtures use no roles).
- [ ] **Step 4: Run** them, plus `pnpm test` and `pnpm test:browser --project browser tests/browser/mount.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): bar series model, role legend, composed axes and the render guard`

---

### Task 5: Stacks (absolute and percent) and area series model

**Files:**

- Create: `src/core/shares/index.ts` (internal: imported by path from `render/model` and `core/table`, not re-exported from `src/core/index.ts`), `src/render/model/{stacks.ts,areas.ts}`
- Modify: `src/render/model/{types.ts,cartesian.ts,manifest.ts}`
- Test: `tests/unit/model-stack.test.ts`; modify `tests/unit/model-line.test.ts` (the `min-area` unsupported assertion)

**Interfaces:**

- Consumes: Task 4 model types, `buildSegments`, `buildMarkers`, `formatNumber`.
- Produces:
  - `stackPositions(spec: CartesianSpec): StackPositions[]` in `core/shares`, where `StackPositions = { stackId; mark: "bar" | "area"; mode: "absolute" | "percent"; axisId; members: string[]; positions: { xKey: string | number; state: "ok" | "partial" | "unavailable" | "empty"; total: number | null; members: { seriesId; value: number | null; share?: number; lower: number; upper: number }[] }[] }`. It is the single source of stack arithmetic for the model, the table and tooltips.
    - Positions are every category (category axis) or the union of member x values in ascending order (linear/time area stacks).
    - **A member with no point at a position counts as a null member (R27).**
    - Absolute: per position, positives accumulate upward from 0 and negatives downward from 0 in series order; `total` = signed sum of measured members; a missing member makes the state `partial` (`lower = upper` for that member). An area stack with any missing member at a position is `unavailable` there.
    - Percent: any missing member → `unavailable`, every `share` undefined; total 0 → `empty`; otherwise `share = value / total × 100` and `[lower, upper]` accumulate the shares.
  - `StackModel = StackPositions` on `CartesianModel.stacks`, plus `CartesianModel.stacking?: { mode; valueUnit?: string; segmentLabels: "none" | "share" | "value" | "value-and-share" }` (percent default `share`, absolute default `none`).
  - `AreaSeriesModel = { mark: "area"; id; label; axisId; stackId?: string; style: { color; dash; shape; width; pattern: FillPattern }; interpolation; points: PointModel[]; segments: SegmentModel[]; markers: MarkerModel[]; clipped: ClippedModel[] }`. Unstacked areas segment exactly like lines (gaps, marker-only, isolated markers, estimated ranges). A stacked area member's segments additionally break at every position its stack marks `unavailable`.
  - `ValueLabelModel = { kind: "bar" | "total" | "segment"; seriesId?: string; stackId?: string; xKey: string; value: number; text: string; sign: 1 | -1 }` on `CartesianModel.valueLabels`. Texts: bar and total labels use `displayValue` or the axis format; a partial total reads `36 (partial)`; segment labels read `25%` (`share`), `10 items` (`value`) or `10 items (25%)` (`value-and-share`), the share formatted `{ style: "percent", maximumFractionDigits: 1 }`. Segment labels are created only at positions in state `ok` and only for members with a value above 0. `labels.values: "totals"` labels stack totals and bars alone in their band (design §5.2 "ungrouped bars"); `"all"` additionally labels grouped bars; stack segments are labelled only through `stacking.segmentLabels`; line and area points are never labelled here (slice 3 owns point labels). A total's `sign` is the sign of the signed sum (0 counts as positive).
  - The y axis bound to a percent stack: domain `[0, 100]`, format percent, `unit: "% of total"` (validation already forbids a caller domain, format or unit there).
  - Manifest keys `series:<id>:area` (count = area segments), `series:<id>:estimated` for areas, `stack:<id>:unavailable` and `stack:<id>:empty` (counts of placeholder positions).
- Recharts feed (consumed by Tasks 11a, 11b, 12): absolute stacks pass raw values with chart-level `stackOffset="sign"`; percent stacks pass `share` with `stackOffset="none"`; unavailable and empty positions pass `null` for every member. `stacking.mode` is chart-level, so one chart never needs both offsets.

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
  const pct = modelOf(stackSpec({ mode: 'percent', a: [5, 5], b: [5, 'absent'] })).stacks[0]
    .positions[1];
  expect(pct.state).toBe('unavailable');
  const abs = modelOf(stackSpec({ mode: 'absolute', a: [5, 5], b: [5, 'absent'] })).stacks[0]
    .positions[1];
  expect(abs).toMatchObject({ state: 'partial', total: 5 });
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
test('single area segments like a line', () => {
  const a = model('area-single-gaps').series[0] as AreaSeriesModel;
  expect(a.segments.map((g) => g.pointIds.length)).toEqual([2, 2, 4]);
  expect(a.segments[2].estimatedRanges).toEqual([['w8', 'w10']]);
  expect(a.markers.map((k) => [k.pointId, k.reason])).toEqual([['w6', 'marker-only']]);
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

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-stack.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `core/shares` (stacks part), `stacks.ts`, `areas.ts`; remove the area `unsupported` branch. The `boundaries` test must still pass (`core/shares` imports nothing from render).
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): absolute and percent stacks, area series and value-label texts`

---

### Task 6: Donut model

**Files:**

- Create: `src/render/model/donut.ts`
- Modify: `src/core/shares/index.ts` (add `donutShares`), `src/render/model/{types.ts,index.ts,manifest.ts,cartesian.ts}` (drop the donut branch from `unsupported`)
- Test: `tests/unit/model-donut.test.ts`; modify `tests/unit/model-line.test.ts` (`non-line kinds report unsupported` now uses `min-heatmap`)

**Interfaces:**

- Consumes: `DonutSpec`, `Theme`, `formatNumber`, `resolveRole` (Task 4), R48.
- Produces:
  - `donutShares(spec: DonutSpec): { state: "ok" | "all-zero" | "incomplete"; total: number | null; slices: { id; value: number | null; share?: number }[] }` in `core/shares`.
  - `DonutModel = { kind: "donut"; chartId; title; description?; caption?; state: "ok" | "all-zero" | "incomplete"; unit?: string; total: number | null; slices: SliceModel[]; center: { value?: string; label?: string }; legend: LegendItem[]; legendOptions; notes: string[]; manifest: MarkManifest }`.
  - `SliceModel = { id; label; value: number | null; display: string; share?: number; shareText: string; startDeg: number; endDeg: number; color: string; pattern: FillPattern; inlineEligible: boolean }`. Angles are compass degrees, clockwise from 12 o'clock (`startDeg` of slice 0 is 0, `endDeg` of the last positive slice is 360); `inlineEligible` is `share >= 3`.
  - `ChartModel = CartesianModel | DonutModel | UnsupportedModel`; `buildModel` dispatches by kind; `unsupported` remains for heatmap and progress (and scatter marks).
  - Manifest keys `slice` (count of slices with value > 0, only in state `ok`), `donut:track` (1 in `all-zero` or `incomplete`), `donut:center` (1 unless the centre has neither value nor label).
- States (§5.3):
  - `ok`: shares exact, `shareText` `4.8%` style (`maximumFractionDigits: 1`), a zero slice has `startDeg === endDeg`.
  - `all-zero`: centre value `0`, note `No items (total 0)`, every `shareText` `–`, legend `0–30 days — 0 (–)` under `value-share`.
  - `incomplete`: no angles drawn (`startDeg = endDeg = 0`), centre value `Incomplete` (`strings.incomplete`), `shareText` `–`, null slices display `Not measured`, note `Incomplete: 1 slice not measured; shares are not shown.` (pluralised).
  - Centre: `value: "total"` → formatted total (no unit suffix), `"none"` → no value, any other string → shown verbatim; `label` verbatim.
  - Legend items per slice (`kind: "series"`, `swatch: "fill"`; a donut has no separate role items because each slice already has its own entry), text per `legendValues`: `value-share` → `Critical — 12 (4.8%)`, `value` → `Critical — 12`, `none` → `Critical`; in `incomplete` the share is omitted and nulls read `Partial — Not measured`.
  - Colour (§5.1, R49): slice `color` > slice role colour (`resolveRole`) > palette slot `i % 8`; pattern from the role, else the slot (slots 4–7 patterned). Slice 8 and later repeat slots; they are distinguished by order, legend and border (§7 edit).

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
  expect(d.manifest.groups.some((g) => g.key === 'slice')).toBe(false);
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
- [ ] **Step 3: Implement.** `buildLaid` still rejects donut (`RENDERED_KINDS` has only `cartesian`) with `donut charts are drawn later in slice 2`, so `mount.spec`'s `/slice 2/` assertion stays green.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut model with all-zero and incomplete states`

---

### Task 7: Data tables for bars, stacks, areas, roles, presets and donut

**Files:**

- Modify: `src/core/table/index.ts`
- Test: `tests/unit/table.test.ts` (the `min-donut` not-implemented case moves to `min-heatmap`)

**Interfaces:**

- Consumes: `stackPositions`, `donutShares` (`core/shares`), `formatNumber`, `resolveTheme` strings.
- Produces: `toDataTable(spec, options)` (signature unchanged, §11) for every slice-2 spec. The row-header column keeps the slice-1 rule: the x axis `label`, else the capitalised axis id. Column and cell rules:
  - Unstacked bars and composed charts: one column per series, header `Label (unit)` of its own axis (`Revenue (USD)`, `Margin (%)`).
  - Roles (R49): when any point of a series carries a role, a column `<series label> role` follows that series' value column; its cells read the role label (`roles[id].label ?? id`, `state: "measured"`, `value` = role id), or `–` for a point without a role.
  - Percent stacks: per member a raw column `<label> (<valueUnit>)` then a share column `<label> share (%)`, then `Total (<valueUnit>)`. Unavailable rows: missing member `Not measured` (`missing`), shares `Unavailable` (`unavailable`), total `Unavailable` (`unavailable`). Empty rows: shares and total `No data (0)` (`empty`).
  - Absolute stacks: a `Total (<unit>)` column only when `labels.values` is `totals` or `all` (the caller asked for totals); a partial total reads `36 (partial: 1 member not measured)` (`partial`).
  - Stacked areas: at an unavailable position the missing member reads `Not measured` (`missing`) and every measured member reads `<value> — Unavailable (missing member)` (`unavailable`).
  - Sparkline: notes include `Sparkline: axes and legend omitted`.
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
test('absolute stack with totals: partial total', () => {
  const t = toDataTable(validateSpec(loadFixture('bar-stacked-categories')));
  expect(t.columns.at(-1)!.label).toBe('Total (items)');
  expect(t.rows[3].cells.at(-1)).toMatchObject({
    text: '36 (partial: 1 member not measured)',
    state: 'partial',
  });
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
- [ ] **Step 5: Commit.** `feat(core): data tables for stacks, shares, roles, areas and donuts`

---

### Task 8: Cartesian layout for bars, horizontal orientation and value labels

**Files:**

- Create: `src/render/layout/{horizontal.ts,value-labels.ts}`, `tests/unit/fixtures/layout-slice1-snapshot.json`
- Modify: `src/render/layout/{types.ts,index.ts}`, `src/render/pipeline.ts` (`verifyAndReport` reads `laid.manifest`)
- Test: `tests/unit/layout-slice2.test.ts`

**Interfaces:**

- Consumes: `CartesianModel` (Tasks 4–5), `planXTicks`, `wrapWords`, `notoMeasurer`, `Theme`.
- Produces (additions to `LaidOutChart`, which keeps its name and stays the Cartesian layout):
  - `orientation: "vertical" | "horizontal"` and `grid: "horizontal" | "vertical"` (value-axis gridlines: horizontal lines for vertical plots, vertical lines for horizontal plots; spec "Default visual rules").
  - `manifest: MarkManifest`: the model manifest plus layout-decided groups `labels:value` (value and total labels drawn) and `labels:segment` (segment labels that fit). `verifyAndReport` verifies `laid.manifest` instead of `laid.model.manifest`.
  - `valueLabels: PlacedValueLabel[]`, `PlacedValueLabel = { kind; seriesId?; stackId?; xKey; text; sign; width; height; visible: boolean }`. Layout reserves space and decides fit; positions are computed at render by the `ValueLabels` overlay from the D8 oracle (Task 11a), so a stack total never depends on a member being drawn.
  - `placeholders: { stackId; xKey; kind: "unavailable" | "empty"; text: string; width: number }[]` (texts `strings.unavailable` and `${strings.noData} (0)`).
  - `NoteLine.kind` gains `"segment"` (omitted segment labels), `"preset"` (sparkline and compact-stack notes) and `"state"` (donut all-zero and incomplete notes).
  - `LegendItem` gains `swatch?: "line" | "fill" | "area" | "marker"` and `pattern?: FillPattern` (role items set them in Task 4).
- Rules:
  - **Horizontal orientation** (`horizontal.ts`): categories run top to bottom on the left; the category axis box (`boxes.xAxis`, still keyed by `model.x.id`) sits left of the plot; value axes map `position: "left"` → bottom and `"right"` → top (§5.2), with horizontal tick labels. Each value axis title is horizontal text centred on the plot width, below the bottom axis's tick labels or above the top axis's; in horizontal orientation `yAxisTitles[id]` holds those horizontal lines (wrapped to at most 2 lines at the plot width), not rotated columns. Category labels wrap at the gutter width to at most 3 lines and are never truncated; the gutter is the widest wrapped label, capped at 40 % of the inner width. A label needing more than 3 lines at the cap throws `LAYOUT_ERROR` naming the category label and the width it needs. If the band height is below the label's line count × line height, every n-th label is hidden (first and last kept), exactly like the slice-1 thin stage. `PlacedTick.rotate` is always 0 here.
  - **Value-label space** (`value-labels.ts`): when any value or total label exists, a gutter of one label line height (vertical) or of the widest label plus the tick gap (horizontal) is reserved beyond the plot edge on each side the labelled values reach (the max end for positive values, the min end for negatives). A value label wider than its bar slot (`bandWidth × (1 − theme.spacing.barGap) / barSlots.length`, or the fallback-O bound) in a vertical chart throws `LAYOUT_ERROR` naming "value labels" and the width needed.
  - **Segment labels (R54, controller decision):** a segment label is `visible` only when it fits inside its segment (width and height, from the share and the plot box). Each label that does not fit is **named** in one printed note of kind `segment`: `Segment labels not shown: <category label> — <member label> <text>; …` (for example `Segment labels not shown: All services — Critical gaps 0.3%`). More than **8** omitted segment labels in one chart throw `LAYOUT_ERROR` naming the count and advising a larger chart or `segmentLabels: "none"`. The note keeps every small segment readable on the chart itself (spec "small segments readable through labels or legend"; "use a callout/legend instead").
  - Placeholder text must fit its band (vertical: band width; horizontal: band height for one line) or `LAYOUT_ERROR` names the placeholder.
  - Annotation and reference labels stay measured in every mode for every family and orientation (R44). **Decision R54 (first part):** `labels.values` and `stacking.segmentLabels` are also on-chart text in every mode: they are explicit spec choices, and hiding them in interactive mode would silently drop text the caller asked for (same reasoning as R44); `staticLabels` governs `staticLabel` point labels only.

- [ ] **Step 1: Write the failing tests** (all at 680 × 320, print theme, `printWidthMm: 178`, `notoMeasurer`; add `laid`, `laidOf`, `horizontalSpec`, `expectNoBoxOverlap` to the helpers first). Before changing any layout code, generate `tests/unit/fixtures/layout-slice1-snapshot.json` from the unmodified code: the JSON of `laid('line-weekly-flow')`, `laid('line-category-labels-rotate')` and `laid('line-fixed-domain-clipped')`, and commit it with the tests.

```ts
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
test('legend swatches follow the mark', () => {
  const l = laid('composed-revenue-margin');
  expect(l.legendRows.flat().map((i) => [i.id, i.swatch])).toEqual([
    ['rev', 'fill'],
    ['mar', 'line'],
  ]);
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

The existing `tests/unit/layout.test.ts` must also pass unchanged.

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/layout-slice2.test.ts tests/unit/layout.test.ts`. Expected: FAIL (the snapshot test passes; the rest fail).
- [ ] **Step 3: Implement.** Keep the `pass()` allocation order of §8; horizontal orientation swaps which boxes hold the category and value axes. `chartMargin` is generalised in Task 11b, not here. Record R54 in the slice-2 ledger.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): horizontal bar layout, value-label gutters and named segment-label omissions`

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
  - **Compact-stack** (§5.2, R51): percent-stacked horizontal bars; no value axis, ticks or grid (the value axis box is zero-sized; Task 12 renders it hidden with domain `[0, 100]`); category labels at the left only when there is more than one category; the legend is always shown. With one category, legend items read `<label> — <value> <valueUnit> (<share>)`, e.g. `Compliant — 312 services (78%)`. With more than one category, legend items show labels only and a `preset` note `Values for each category are shown on the segments and in the data table.` is added (the legend never sums across categories; omitted segment labels are still named per Task 8).
  - Arithmetic check at 680 wide, print, fontScale 1: sparkline needs 32 (padding) + 21.25 (title) + 10 + 16.25 (label line) + 5 + 60 (minimum plot) + 13.75 (note) + 10 = 168.25 ≤ 180; compact-stack needs 32 + 21.25 + 10 + 36.5 (2 legend rows) + 12 + 60 + 13.75 (one note line) + 10 = 195.5 ≤ 220.

- [ ] **Step 1: Write the failing tests** (add `laidAt`, `compactSpec` to the helpers first):

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
  expect(l.valueLabels.find((v) => v.text === '0.3%')!.visible).toBe(false); // geometry exact, label omitted
  expect(l.notes.find((n) => n.kind === 'segment')!.text).toBe(
    'Segment labels not shown: All services — Critical gaps 0.3%',
  );
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
  - `LaidOutDonut = { model: DonutModel; width; height; fontScale; boxes: { title: Box; legend: Box; plot: Box; notes: Box }; ring: { cx: number; cy: number; outerRadius: number; innerRadius: number }; titleLines: string[]; legendRows: LegendItem[][]; legendLabels: Record<string, string[]>; center: { valueLines: string[]; valueSize: number; labelLines: string[] }; sliceLabels: { sliceId: string; text: string; x: number; y: number; width: number; height: number; visible: boolean }[]; notes: NoteLine[]; manifest: MarkManifest; metrics: { effectivePt?: { title; label; caption } } }`.
  - `type LaidOut = LaidOutChart | LaidOutDonut` (discriminated by `laid.model.kind`). `LaidOutChart` keeps its slice-1 name and meaning (Cartesian) so slice-1 code does not churn.
- Rules: allocation order title → legend (default bottom, wrapped rows, items with values) → notes (state notes of kind `state`) → plot. The ring is centred in the plot box, `outerRadius = min(plot.width, plot.height) / 2`, `innerRadius = 0.6 × outerRadius`. The centre value uses the title size and the centre label the label size; both must fit within `2 × innerRadius × 0.9` wide (wrap the label to at most 2 lines), else `LAYOUT_ERROR` naming the centre text. A slice label (its `shareText`) is `visible` only when the slice is `inlineEligible` and the label box fits inside the annulus sector at the mid-angle; otherwise the legend carries its value and share (§5.3; the donut legend always lists every slice, so no omission note is needed). `manifest` = model manifest plus `labels:slice` (visible slice labels).

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
test('all-zero and incomplete donut layouts', () => {
  expect(laidDonut('donut-all-zero').center.valueLines).toEqual(['0']);
  expect(laidDonut('donut-all-zero').notes.map((n) => [n.kind, n.text])).toContainEqual([
    'state',
    'No items (total 0)',
  ]);
  expect(laidDonut('donut-missing-slice').center.valueLines).toEqual(['Incomplete']);
  expect(laidDonut('donut-missing-slice').sliceLabels.every((s) => !s.visible)).toBe(true);
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
- [ ] **Step 3: Implement.** Narrow with `laid.model.kind === 'cartesian'` where callers read Cartesian fields; `verifyAndReport` accepts either layout.
- [ ] **Step 4: Run** them, `pnpm test` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut layout and the LaidOut union`

---

### Task 11a: Vertical bars, stacks, placeholders, patterns and labels

**Files:**

- Create: `src/render/recharts/bars.tsx` (`BarSeries`, stack segments), `src/render/primitives/{Patterns.tsx,Placeholders.tsx,ValueLabels.tsx}`, `tests/browser/geometry-bars.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/primitives/{Legend.tsx,style.ts}`, `src/render/pipeline.ts` (`RENDERED_MARKS` adds `bar`; `RENDERED_ORIENTATIONS` stays `vertical`), `tests/browser/mount.spec.ts`, `tests/docs/docs.spec.ts` (the not-implemented case selects `min-scatter` instead of `min-bar`)

**Interfaces:**

- Consumes: Task 1 results (fallbacks Z, W, O), `LaidOutChart` (Tasks 8–9), `planIds`, `DvText`, `Marker`, `strokeStyle`, the overlay hooks (`useXAxisScale`, `useYAxisScale`, `usePlotArea`), R48–R50.
- Produces:
  - Bars: one Recharts `Bar` per bar series inside `<g data-dv-mark="series:<id>:bar">`, `isAnimationActive={false}`, a `name` prop (avoids `name="undefined"`, spike observation 5), `stackId` for stack members, and a `shape` render prop returning `<g data-dv-item><path d=…/></g>` with inline fill (or `url(#pattern-id)`) and, for stack segments, a boundary stroke of `theme.stroke.sliceBorder` in the background colour. Zero bars draw a zero-height path (fallback Z if the spike showed the shape is not called). Estimated bars get a dashed outline.
  - Chart-level `stackOffset` = `"sign"` for absolute and `"none"` for percent; `barCategoryGap` from `theme.spacing.barGap`, `barGap` from `theme.spacing.groupGap` × the slot width.
  - `slotGeometry(laid, seriesOrStackId, xKey)` in `bars.tsx`: the D8 oracle (band from the category scale, slot from `barSlots`, `barGap` and `groupGap`), checked against committed bars by the geometry tests.
  - `Patterns`: `<defs>` with one `<pattern patternUnits="userSpaceOnUse">` per distinct (pattern, colour) pair, tile from `PATTERN_TILE`/`PATTERN_STROKE`/`PATTERN_OPACITY`; ids planned by `planIds` under keys `pattern:<kind>:<hex>`.
  - `Placeholders`: unavailable → dashed outline across the band at full plot extent plus the text; empty → a baseline tick of `theme.stroke.axis` across the band at the value axis zero plus `No data (0)`. Text role `direct` (≥ 9 pt). Groups `stack:<id>:unavailable` / `stack:<id>:empty`, one `data-dv-item` each.
  - `ValueLabels` overlay (`labels:value`, `labels:segment`, role `direct`): positions from `slotGeometry` and the bound axis scale (`useYAxisScale`), never from the `Bar` `label` prop, so a stack total is drawn even when its top member is null; a total sits beyond the end of the side its signed sum falls on.
  - Legend swatches: `fill` (rect with pattern when set), `area`, `line`, `marker`; role items per Task 4.
  - Overlays for vertical bars: quality markers at the bar's value end; clip breaks (a zigzag across the bar at the plot edge, `series:<id>:clip-indicator`); annotations and references as slice 1 (R44).
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
test('grouped bars: order, slot oracle, missing bar absent', async ({ page }) => {
  /* bar-grouped: per category the bars are opened, closed, reopened left to right; each bar x/width equals slotGeometry ±0.5;
     reopened has 3 items; o4 partial marker centre at the bar top centre ±0.5 */
});
test('absolute stack segments are contiguous; partial total labelled', async ({ page }) => {
  /* bar-stacked-categories: each segment's lower edge equals the previous upper edge ±0.5; svc-d has no crit segment;
     total labels read 36, 42, 39, 36 (partial), 6; svc-e crit segment height = |yScale(1) − yScale(0)| ±0.5 (not inflated);
     segment boundary stroke width = theme.stroke.sliceBorder */
});
test('total label survives a null top member', async ({ page }) => {
  /* inline absolute stack a:[3,4], b:[2,null] with labels totals: both totals drawn (5 at category 1, 4 at category 2), readiness resolves */
});
test('mixed-sign vertical stack places its total on the sum side', async ({ page }) => {
  /* inline stack a:[5], b:[-9], c:[1] (total -3): the total label sits below yScale(-9) ±0.5 + label gap; positives above zero, negatives below */
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
test('clip-indicated bar draws a break marker', async ({ page }) => {
  /* inline vertical spec, fixed 0..50 domain, overflow clip-indicated, value 80: zigzag break at the plot top ±0.5 across the bar; the clip note text is rendered */
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

`mount.spec.ts` additions: `bar-all-zero` and `cartesian-empty-series` resolve (§9 readiness fixtures); hiding one bar item through a harness hook rejects `RENDER_FAILED` `mark-count-mismatch`; `min-area` still rejects `not-implemented-in-slice` (until Task 12); `bar-ranking-horizontal` rejects with `horizontal bars are drawn later in slice 2` (until Task 11b).

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-bars.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Record which spike fallbacks are live in a comment at the top of `bars.tsx`.
- [ ] **Step 4: Run** them, the whole `--project browser` suite (slice-1 line tests stay green) and `pnpm build:docs && pnpm test:docs`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): vertical, grouped, stacked and percent bars with patterns, placeholders and value labels`

---

### Task 11b: Horizontal orientation, overlays and clip breaks

**Files:**

- Create: `src/render/recharts/horizontal.tsx` (category `YAxis`, value `XAxis` set-up), `tests/browser/geometry-horizontal.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,bars.tsx}`, `src/render/primitives/ValueLabels.tsx`, `src/render/verify.ts` (`CommitExpectations` carries `orientation`; the probe reports the category domain from whichever axis holds it), `src/render/pipeline.ts` (`RENDERED_ORIENTATIONS` adds `horizontal`), `src/react/interaction.ts` (focus geometry for horizontal bars, used by Task 15), `tests/browser/mount.spec.ts`

**Interfaces:**

- Consumes: Task 1 point 7 (fallback H), Task 8 horizontal layout, Task 11a bars and overlays.
- Produces:
  - `chartMargin(laid)` generalised to horizontal layouts (category axis on the left, value axes bottom/top) so `usePlotArea()` still equals `laid.boxes.plot` within 0.5.
  - Horizontal charts: `ComposedChart layout="vertical"`, category `YAxis type="category" scale="band"` with `width = boxes.xAxis.width` and the `PlacedTick` renderer, value `XAxis type="number" scale="linear" allowDataOverflow` per value axis (`orientation` bottom/top), horizontal value-axis titles from `yAxisTitles`.
  - Horizontal overlays: vertical gridlines; annotations as horizontal lines at the category band centre with their label; reference lines vertical on value axes; quality markers and value labels at the bar's value end (right for positive, left for negative); clip breaks at the left/right plot edge.
  - `slotGeometry` handles both orientations; `RENDERED_ORIENTATIONS` = `vertical`, `horizontal`. If fallback H applies, horizontal bars are DravenViz rectangles from `slotGeometry` inside the same chart.

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
test('horizontal clip break and annotation', async ({ page }) => {
  /* inline horizontal spec fixed 0..50 clip with value 80: zigzag at the plot's right edge ±0.5, clip note rendered;
     an annotation on category 2 draws a horizontal line at its band centre with its label (R44, staticLabels:false) */
});
test('horizontal value axis title and ticks', async ({ page }) => {
  /* bar-ranking-horizontal: 'Open age (days)' drawn horizontally below the tick labels, centred on the plot ±0.5; tick labels do not overlap */
});
```

`mount.spec.ts`: `bar-ranking-horizontal`, `bar-horizontal-grouped` and `bar-horizontal-stacked` resolve; `bar-compact-percent` still rejects with `the compact-stack preset is drawn later in slice 2` (until Task 12).

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-horizontal.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): horizontal bars with overlays, clip breaks and grouped/stacked modes`

---

### Task 12: Area and preset rendering

**Files:**

- Create: `src/render/recharts/areas.tsx`, `src/render/primitives/SparklineLabels.tsx`, `tests/browser/geometry-areas.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/primitives/style.ts` (`AREA_FILL_OPACITY`), `src/render/pipeline.ts` (`RENDERED_MARKS` adds `area`; `RENDERED_PRESETS` adds `sparkline` and `compact-stack`), `docs/design.md` §7 (`AREA_FILL_OPACITY`, R53), `tests/browser/mount.spec.ts`

**Interfaces:**

- Consumes: Task 1 point 12 (fallback A) and point 14, Task 5 area and stack models, Task 9 preset layouts, the slice-1 `SeriesLines` estimated-range clip mechanism.
- Produces:
  - Unstacked areas: one Recharts `Area` per segment (own data key, like slice-1 lines), fill at the named render constant `AREA_FILL_OPACITY = 0.25`, top stroke in the series dash; estimated ranges dashed through the slice-1 complementary clip paths; group `series:<id>:area` with one `data-dv-item` per segment.
  - Stacked areas: one `Area` per member with `stackId`, opaque fill and the `theme.stroke.sliceBorder` background boundary, data `null` at every unavailable position (so all members break together); fallback A feeds `[lower, upper]` ranges without `stackId`.
  - Sparkline: axes rendered with `hide`, no grid, no legend; `SparklineLabels` (`labels:sparkline`, role `direct`); the live `<desc>` ends with `Sparkline: axes and legend omitted`.
  - Compact-stack: value axis `hide` with domain `[0, 100]`; segment labels per Task 8; legend from Task 9.
  - `RENDERED_MARKS` = `line`, `bar`, `area`; `RENDERED_PRESETS` = `standard`, `sparkline`, `compact-stack` (scatter stays rejected).

- [ ] **Step 1: Write the failing tests** in `geometry-areas.spec.ts`:

```ts
test('min-area stack top equals the sum at band centres', async ({ page }) => {
  /* top edge y at each category = yScale(a+b) ±0.5 at plot.x+(k+0.5)·w/n */
});
test('stacked areas break at a partial-null position', async ({ page }) => {
  /* area-inventory-stacked: every member's area item count is 2 and no fill path covers the May band centre;
     the data table row for May reads '135 — Unavailable (missing member)' */
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
- [ ] **Step 3: Implement.** Record R53 (`AREA_FILL_OPACITY` as a render constant, no `Theme` shape change before the slice-4 freeze) in the slice-2 ledger and design §7.
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): single and stacked areas, sparkline and compact-stack presets`

---

### Task 13: Donut rendering

**Files:**

- Create: `src/render/recharts/DonutChart.tsx`, `src/render/primitives/DonutParts.tsx` (track, centre, slice labels), `tests/browser/geometry-donut.spec.ts`
- Modify: `src/render/ChartView.tsx` (dispatch on `laid.model.kind`), `src/render/verify.ts` (donut branch of `expectationsOf`: no axis expectations; the probe check is skipped), `src/render/pipeline.ts` (`RENDERED_KINDS` adds `donut`; `notImplemented` message becomes `… Scatter, heatmap and progress charts are added in slice 3.`), `tests/browser/mount.spec.ts` and `tests/browser/react.spec.ts` (the not-implemented cases use `min-heatmap` and assert `/slice 3/` instead of `min-donut` and `/slice 2/`)

**Interfaces:**

- Consumes: `LaidOutDonut` (Task 10), Task 1 point 13 (fallback P), `Patterns`, `Legend`, `Title`, `Notes`, `planIds`.
- Produces:
  - `DonutChart(props: { laid: LaidOutDonut; theme; renderId; namespace; family; measure }): ReactElement`: a Recharts `PieChart` of `laid.width × laid.height` with one `Pie` (`cx`, `cy`, `innerRadius`, `outerRadius` from `laid.ring`, `startAngle={90}`, `endAngle={-270}`, `paddingAngle={0}`, `minAngle={0}`, `isAnimationActive={false}`, data = slices with value > 0 in order), a `shape` render prop drawing each sector as `<g data-dv-item><path/></g>` with fill (or pattern) and `stroke = background`, `strokeWidth = theme.stroke.sliceBorder`, inside `<g data-dv-mark="slice">`. The root carries the same `data-dv-render-id`, `data-dravenviz-ns`, `data-dravenviz-chart`, `role="img"`, title and desc as Cartesian charts.
  - `DonutParts`: `donut:track` (all-zero: a full ring in `theme.color.grid`; incomplete: a dashed ring outline in `theme.color.missing`), `donut:center` (value and label `DvText`, role `direct`), `labels:slice` (role `direct`).
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
test('min-donut mounts; heatmap is the not-implemented example', async ({ page }) => {
  await expect(h(page).mount(['min-donut'], opts)).resolves.toHaveLength(1);
  expect(await h(page).mountError(['min-heatmap'], opts)).toMatchObject({
    code: 'RENDER_FAILED',
    message: expect.stringMatching(/slice 3/),
    issues: [{ rule: 'not-implemented-in-slice' }],
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
  - percent stacks: `N categories unavailable (missing member); M categories empty (total 0).` (only the non-zero parts; singular `category` when the count is 1);
  - absolute stacks: `N category totals partial.` (singular `1 category total partial.`);
  - donut: `All slices are zero.` or `Incomplete: N slices not measured; shares are not shown.`

- [ ] **Step 1: Write the failing tests.** `recharts-metadata.test.ts` already fails when the merged inventory has an unclassified pair; add `pie sector and bar shape attributes are classified` naming the new pairs. `svg-validate.test.ts`: a `<pattern>` with a `path` child and `patternUnits="userSpaceOnUse"` passes; `fill="url(#p)"` with no `<pattern id="p">` fails `svg-dangling-reference`. `export.spec.ts`:

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
  /* <desc> of line-sparkline contains 'Sparkline: axes and legend omitted.'; bar-age-bands-percent contains
     exactly '1 category unavailable (missing member); 1 category empty (total 0).'; donut-missing-slice contains exactly
     'Incomplete: 1 slice not measured; shares are not shown.'; bar-stacked-categories contains exactly '1 category total partial.' */
});
test('computed-style equivalence after standalone reload (slice 2)', async ({ page }) => {
  /* the slice-1 property list, for every id in SLICE2, including <pattern> children */
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

Exact strings: singular `1 category unavailable (missing member)`, `1 category empty (total 0)`, `1 category total partial`, `1 slice not measured`; plural `2 categories unavailable (missing member)`, `2 categories empty (total 0)`, `2 category totals partial`, `2 slices not measured`. The Task 6 and Task 7 incomplete note uses the same nouns (`Incomplete: 1 slice not measured; …`, `Incomplete: 2 slices not measured; …`).

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/recharts-metadata.test.ts tests/unit/svg-validate.test.ts && pnpm test:browser --project browser tests/browser/export.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the classifications (each new pair as geometry or metadata per tag, never a catch-all; anything unknown still reaches strict validation and fails), the normalizer changes and the `summary()` additions.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(export): allowlist, pattern and desc-summary coverage for bars, areas and donuts`

---

### Task 15: React interaction and tables for the new families

**Files:**

- Modify: `src/react/{interaction.ts,Chart.tsx}`, `tests/browser/react.spec.ts`, `tests/unit/react.test.ts`

**Interfaces:**

- Consumes: `LaidOut`, `navigableDatums`, `moveFocus`, `announcement`, `DatumEvent` (slice 1), `stackPositions`, `slotGeometry` (Task 11a/11b).
- Produces: `navigableDatums(laid: LaidOut)` covering bars (one datum per drawn bar, zero bars included, nulls and placeholders skipped), area points (as lines) and donut slices (one row; Left/Right move, Up/Down do nothing). In a composed chart, Up/Down move across series in series order, bars and lines alike, landing on the nearest x. Focus-ring positions: bar value-end centre from `slotGeometry` (vertical: top or bottom end; horizontal: right or left end), area point, donut slice mid-angle at the ring's mid-radius. Tooltip and announcement texts:
  - bar: `Findings, Critical: 12 count`;
  - percent stack member: `0–30 days, Payments: 10 items (25% of 40)` (§5.2 "tooltips always show both");
  - absolute stack member in a partial category: value plus `(total partial)`;
  - a datum with a role: the role label after the value, e.g. `Open age, Customer Identity Verification: 68 days (Overdue)`;
  - donut: `Critical: 12 findings (4.8%)`, or `Partial: Not measured` in an incomplete donut;
  - `DatumEvent` for a donut slice has no `seriesId` and `datumId` = slice id.

- [ ] **Step 1: Write the failing tests:**

```ts
test('keyboard over grouped bars skips the missing bar', async ({ page }) => {
  /* bar-grouped: within series reopened, ArrowRight moves r1 → r2 (value 0, focusable) → r4; r3 (null) is never focused (R5 navigation rules) */
});
test('horizontal focus ring sits at the bar value end', async ({ page }) => {
  /* bar-ranking-horizontal: focus the first datum (`a1`, category `r1`); the focus ring centre is at (xScale(68), band centre of r1) ±0.5 and visible (non-zero bbox, stroke = theme focus colour) */
});
test('composed Up/Down moves between bars and the line', async ({ page }) => {
  /* composed-revenue-margin: focus rev r2; ArrowDown → mar m2; ArrowUp → rev r2; live region names 'Margin' then 'Revenue' */
});
test('percent tooltip shows value and share', async ({ page }) => {
  /* hover svc-a 0–30 segment → tooltip '0–30 days, Payments: 10 items (25% of 40)' */
});
test('donut keyboard, focus ring and activation', async ({ page }) => {
  /* donut-severity-share: focus; ArrowRight ×2; focus ring present, visible, and its centre lies inside the annulus (inner < r < outer);
     Enter → onDatumActivate({ datumId: 'high', source: 'keyboard' }) with no seriesId; live region 'High: 31 findings (12.4%)' */
});
test('DataTable renders share and role columns', async ({ page }) => {
  /* <DataTable spec=bar-age-bands-percent> has 8 header cells and 'Unavailable' in row 4; bar-ranking-horizontal has an 'Open age role' column */
});
test('unavailable categories are not focusable', async ({ page }) => {
  /* bar-age-bands-percent: svc-d members are never focused */
});
```

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/react.spec.ts && pnpm vitest run tests/unit/react.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(react): keyboard, tooltips and activation for bars, areas and donuts`

---

### Task 16: DravenPDF `report-slice2` with real PDF evidence

**Files:**

- Modify: `examples/dravenpdf/run_pdf_check.py` (`--report <id>`, default `report-slice1`), `examples/dravenpdf/bundle/{bootstrap.js,index.html}`, `examples/dravenpdf/test_driver.py`, `scripts/test-pdf.ts` (runs `report-slice1` then `report-slice2` against one warm server), `tests/pdf/compare.ts` (per-instance size and per-family tolerance), `tests/unit/pdf-prerequisites.test.ts`
- Create (evidence): `evidence/pdf/report-slice2.pdf`, `evidence/pdf/report-slice2.json`, `evidence/pdf/pages/report-slice2/page-*.png`, `evidence/pdf/crops/<namespace>.png` for the 22 slice-2 namespaces

**Interfaces:**

- Consumes: `report-slice2` and the catalog `size`/`themeOverride` fields (Task 3), the packed tarball, `asset-manifest.json`, the proven frame-discovery method recorded in `docs/plans/slice-1-pdf-probe-results.md` (`link-dest`, Ruling R35), `examples/dravenpdf/frame_calibration.json`, `tests/visual/tolerances.json`.
- Produces:
  - `charts.json` entries `{ spec, namespace, width, height, themeOverrides? }`. `bootstrap.js` groups entries by (width, height, themeOverrides), calls `mountCharts` once per group (each with `fit: "width"`, `theme: "print"`, its namespaces), awaits every handle, renders the tables, then sets `window.__DRAVENPDF_READY__ = true`; any rejection stays an uncaught page error.
  - Evidence layout: `report-slice1` paths are unchanged; `report-slice2` writes its PDF and JSON beside them, pages under `pages/report-slice2/`, and crops under `crops/<namespace>.png` (namespaces are disjoint, Task 3 test).
  - Checks for `report-slice2` (in addition to every slice-1 check, which runs per report):
    - A4, ≥ 1 page; every instance found exactly once by `link-dest`, with the identity residual (R35) ≤ 2 pt for **every** instance, including the 680 × 180 and 680 × 220 frames; each frame 178 mm wide (±0.5 mm) with the aspect ratio of its own size (680 : 320, 680 : 220 or 680 : 180, ±0.5 %).
    - Text layer: each title appears instances × 2 times (`Findings by severity` 4 times); extra text `Unavailable`, `No data (0)`, `Incomplete`, `No items (total 0)`, `Sparkline: axes and legend omitted`, `Segment labels not shown`, `Margin goal`, `30-day target`, `Break-even`, `30-day threshold`, `Capacity`, `Not measured`, `Process change`, `Overdue`; every match inside its frame or table.
    - Logical labels, effective font sizes by role (title 12–14 pt; tick, axis-title, legend, annotation, reference, direct ≥ 9 pt; note, caption ≥ 8 pt; −0.05 pt tolerance; ±0.15 pt against `ReadyInfo.effectivePt`) and oriented-quad clipping/overlap checks, exactly as slice 1.
    - Cross-path crop comparison against the browser print render at the same size, at `tolerances.crossPdfBrowser` (the slice-1 line value) for every family until Task 17 writes the `families` keys; `compare.ts` reads `families[<family>].crossPdfBrowser` when present and falls back to `crossPdfBrowser` when the family key is absent.
  - **Ruling on the tolerance (pre-flight finding 16↔17):** the cross-path tolerance was calibrated on line charts only. If a slice-2 crop exceeds it, the run records the instance, its ratio and an investigation in `tests/visual/MISMATCHES.md`. A displaced mark, missing label or clipping is a defect fixed here. An antialiasing-only difference is input to Task 17's recalibration. Task 16 is complete when every other check passes and each over-tolerance crop is recorded as calibration-pending with that investigation; Task 17 re-runs `pnpm test:pdf`, which must then pass outright. Nothing is ever masked.

- [ ] **Step 1: Write the failing checks** in `run_pdf_check.py` (report-parametrised) and `test_driver.py` (`groups entries by size and override`, `aspect checked per instance`, `link-dest residual within 2 pt per instance`, `report-slice2 namespaces disjoint from report-slice1`); keep `missing font fails the PDF render` (504 `render_timeout`, R36) running once.
- [ ] **Step 2: Run** `pnpm test:pdf`. Expected: FAIL (no `report-slice2` bundle).
- [ ] **Step 3: Implement** the driver, bootstrap and compare changes.
- [ ] **Step 4: Run** `pnpm test:pdf`. Expected: `PASS` for both reports (or the recorded calibration-pending state above), or `UNVERIFIED` with exit code 3 if a prerequisite is missing. Inspect every page render at 100 % and in grayscale for clipped text, overlaps, missing glyphs, unreadable patterns and unintended chart splits, and record the inspection in `evidence/pdf/report-slice2.json` (`review` field).
- [ ] **Step 5: Commit** the example changes and evidence. `feat(pdf): report-slice2 with bars, areas, composed charts, donuts and presets`

---

### Task 17: Visual candidates and recalibration (owner gate D4)

**Files:**

- Modify: `tests/visual/{candidates.ts,generate.ts,visual.spec.ts,calibrate.ts,tolerances.ts,REVIEW.md,MISMATCHES.md,tolerances.json}`
- Create: `tests/visual/baselines/candidates/<id>.png` for the slice-2 candidates

**Interfaces:**

- Consumes: the slice-1 generator and review-page flow (`pnpm visual:candidates` → `evidence/visual/index.html`), `pnpm visual:calibrate`, Task 16 crops, the catalog `size`/`themeOverride`.
- Produces:
  - `Candidate` gains `width` and `height` (from the fixture's catalog `size`, default 680 × 320) and applies the fixture's `themeOverride`.
  - 31 slice-2 candidates: `bar-severity-counts@{light,dark,print}`, `bar-ranking-horizontal@print`, `bar-horizontal-grouped@print`, `bar-horizontal-stacked@print`, `bar-stacked-categories@print`, `bar-age-bands-percent@{light,print}`, `bar-compact-percent@print`, `bar-grouped@print`, `bar-negative-values@print`, `bar-long-labels@print`, `bar-all-zero@print`, `cartesian-empty-series@print` (test-only fixture, not in `report-slice2`: the review page shows "no PDF crop"), `area-inventory-stacked@{light,print}`, `area-single-gaps@print`, `composed-revenue-margin@{light,dark,print}`, `composed-remediation-days-counts@print`, `composed-flow-cumulative@print`, `donut-severity-share@{light,dark,print}`, `donut-tiny-slices@print`, `donut-all-zero@print`, `donut-missing-slice@print`, `line-sparkline@{light,print}`.
  - The review page shows, per candidate, the browser render, the standalone SVG, the PDF crop (from `report-slice1` or `report-slice2`, whichever holds the fixture) and the data table, plus a grayscale rendering of each print candidate (spec "Review the A4 result … in grayscale"). Items to flag for the owner: slot-4/5 pattern density (`donut-tiny-slices`) and the security role patterns, the 0.25 % compact segment and its named-omission note, percent placeholders, donut centre sizing, sparkline proportions, role legends.
  - **Recalibration with a condition (R55):** `visual:calibrate` records observed maxima **per family** (`line`, `bar`, `area`, `composed`, `donut`) for each comparison type and writes `tolerances.json` as `{ tolerances: { …slice-1 keys… }, families: { <family>: { sameBrowser, samePdf, crossSvgBrowser, crossPdfBrowser } }, calibration }`. The `line` values stay the slice-1 values unless the line pairs themselves change in the new run; slice-2 families get their own values by the §16.2 rules (same-path max + 0.05 pp, cross-path max + 0.1 pp, capped at 1 %). Pattern antialiasing therefore never loosens line comparisons. `visual.spec.ts` and `tests/pdf/compare.ts` read the value for the fixture's family. The 14 approved slice-1 baselines are untouched.
- Visual baselines stay `pending owner review` until the owner approves them in the PR; the generator never writes `baselines/approved/` (D4, R6). CI's `visual` step stays red for pending candidates (R41).

- [ ] **Step 1: Write** the candidate list and structural assertions in `visual.spec.ts` for the new families (manifest mark counts, domain labels, segment and slice counts, annotation position ±0.5), and the per-family tolerance lookup.
- [ ] **Step 2: Run** `pnpm visual:calibrate && pnpm exec playwright test --project=visual`. Expected: FAIL with `pending owner review` for each slice-2 candidate; slice-1 baselines still pass at the unchanged line tolerance.
- [ ] **Step 3: Generate** the candidates with `pnpm visual:candidates`, fill `REVIEW.md` (`pending`), publish the review page for the owner with the same flow as slice 1, and re-run `pnpm test:pdf` at the recalibrated tolerances (it must pass; resolve any Task 16 calibration-pending entries in `MISMATCHES.md`). Record R55 in the slice-2 ledger.
- [ ] **Step 4: Owner review gate.** Approved PNGs move to `baselines/approved/` in a commit citing the review, with SHA-256 checked against the reviewed images. Re-run: PASS.
- [ ] **Step 5: Commit** the candidates and records. `test(visual): slice-2 reference candidates and per-family tolerances`

---

### Task 18: Docs playground for slice-2 fixtures

**Files:**

- Modify: `docs/site/src/{fixtures.ts,components/PdfSample.tsx,routes/Playground.tsx}`, `scripts/stage-consumer.ts` (the staged `fixtures/index.json` gains `size` and `themeOverride` per fixture, with the override JSON copied to `fixtures/themes/security.json`; copies `report-slice2.pdf/.json` and checks their spec hashes like slice 1), `tests/docs/docs.spec.ts`

**Interfaces:**

- Consumes: the packed tarball, `FIXTURES`, `evidence/pdf/report-slice{1,2}.json`.
- Produces: `FixtureInfo` gains `size?: { width; height }` and `themeOverride?: "security"`. The fixture selector lists `gallery: true` fixtures of slices 1 and 2, plus the `min-*` fixtures of slice-3 kinds (`min-scatter`, `min-heatmap`, `min-progress`), which still show `not-implemented-in-slice`. Selecting a fixture sets the width and height inputs to its catalog size and applies its `themeOverride` through `themeOverrides` (shown as "Theme override: security"). The PDF sample link points to whichever report holds the fixture, with its spec hash, labelled "Original fixture sample" when edited.

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
test('slice-2 SVG download is portable', async ({ page }) => {
  /* bar-ranking-horizontal default download: <svg xmlns, data:font/woff2, no class= */
});
```

- [ ] **Step 2: Run** `pnpm build:docs && pnpm test:docs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it. Expected: PASS. Refresh `evidence/screenshots/docs-playground.png` with a slice-2 fixture selected.
- [ ] **Step 5: Commit.** `feat(docs): playground renders slice-2 fixtures with their sizes, overrides and PDF samples`

---

### Task 19: Measurements, verification matrix and slice close-out

**Files:**

- Modify: `scripts/measure-size.ts` (SVG bytes for every slice-2 `static` fixture; `report-slice2` PDF bytes and pages), `evidence/perf/{size.json,latency.json,README.md}`, `docs/design.md` §18 (slice-2 measured column; budgets unchanged unless the owner rules), `evidence/verification-matrix.md`, `tests/unit/matrix.test.ts`, `CHANGELOG.md`, `docs/plans/handover/slice-2-ledger.md` (outcomes, deferred minors; the rulings are already there)
- CI: `.github/workflows/ci.yml` keeps its job shape (`install`, `lint-typecheck`, `unit`, `browser` with the separate `visual` step, `package`, `docs`, `pdf`); no job is added or removed.

**Interfaces:**

- Consumes: every earlier task's evidence.
- Produces:
  - Size: browser bundle raw and gzip, ESM entries, fonts, SVG bytes per slice-2 reference fixture (both font modes), `report-slice2` PDF bytes and page count, each compared with the §18.1 budget. An item over budget gets an investigation and a recorded resolution in `evidence/perf/README.md` before performance acceptance; budgets are not raised to absorb it.
  - Latency: P1 (`perf-line-500x4`), P2 and P4 (`report-slice1`) re-measured with the slice-1 method, unchanged in definition. **Decision:** no bar/area perf scenario is added, because design §18 defines none for slice 2 (P3 `report-multi-family-a4` is slice 3). P1 p95 must stay ≤ 250 ms (R7 if not).
  - Matrix rows (`fixtures`, command, artifacts, status): `SPEC-2` (`bar-severity-counts`, `donut-severity-share`), `SPEC-3` (`composed-revenue-margin`), `SPEC-4` (`bar-age-bands-percent`), `SPEC-7-S2` (`bar-long-labels`, `bar-negative-values`, `bar-all-zero`, `donut-all-zero`, `donut-missing-slice`, `donut-tiny-slices`, `cartesian-empty-series`), `SPEC-10` (`composed-remediation-days-counts`, `composed-flow-cumulative`), `SPEC-11` (`bar-ranking-horizontal`, `bar-horizontal-grouped`, `bar-horizontal-stacked`, `bar-stacked-categories`, `bar-compact-percent`), `ROW-OPEN-ITEM-TRENDS` extended (`area-inventory-stacked`, `area-single-gaps`, `line-sparkline`), `ROW-COUNTS` (`bar-severity-counts`, `bar-ranking-horizontal`, `bar-horizontal-grouped`, `bar-horizontal-stacked`, `bar-stacked-categories`, `bar-grouped`), `ROW-COMPOSITION`, `ROW-COMPOSED`, `ROW-DISTRIBUTIONS` (`donut-severity-share`, `donut-tiny-slices`, `donut-all-zero`, `donut-missing-slice`), `VISUAL-REFS-2` (`pending-review` until the owner approves), `PDF-SLICE2`, and one `GC-` row per slice-2 global constraint (`GC-15`…`GC-24`, ten rows).

- [ ] **Step 1: Write** `matrix.test.ts` additions: every new row's fixtures exist in `FIXTURES` and artifacts exist; no row claims `pass` for PDF when `evidence/pdf/report-slice2.json` has `result != "pass"`; `VISUAL-REFS-2` is `pass` only when every slice-2 candidate's REVIEW decision is approved.
- [ ] **Step 2: Run** `pnpm test:matrix && pnpm check:matrix`. Expected: FAIL.
- [ ] **Step 3: Run** `pnpm measure`, write the matrix from actual outcomes, update §18 and the CHANGELOG (Unreleased: slice-2 families), and complete the slice-2 ledger (outcomes, deferred minors).
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm check:drift && pnpm test && pnpm test:perf && pnpm test:matrix && pnpm check:matrix && pnpm test:browser && pnpm test:dist && pnpm test:package && pnpm build:docs && pnpm test:docs && pnpm test:pdf`, and record each real outcome in the matrix's "Step 4 runs" table.
- [ ] **Step 5: Commit.** `ci: slice-2 measurements and verification matrix`

---

## Pre-flight scan

Pairs of tasks that share a file or interface, then each task's own consistency. Findings marked **ruling** are decided here and bind the briefs. Rows marked _(review)_ were added or corrected after the independent plan review.

| Tasks                          | Shared file / interface                                                                                                                                                      | Finding                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1→4                            | spike point 11 (bars on two y axes) → `barSlots`                                                                                                                             | _(review)_ **ruling R52:** Task 4 reads the result; side by side → `barSlots` spans all bar series; overlap → new rule `bar-axes-split` (design §6)                                                                                                                                                                                       |
| 1→11a, 11b, 12, 13             | spike fallbacks H, Z, W, O, A, P → renderers                                                                                                                                 | consistent: each renderer task names the fallback it takes and records the live path                                                                                                                                                                                                                                                      |
| 1→11a, 15                      | spike point 9 slot-oracle delta → `slotGeometry`                                                                                                                             | consistent: fallback O replaces the formula with committed geometry                                                                                                                                                                                                                                                                       |
| 1→14                           | merged `attribute-inventory.json` → `recharts-metadata.ts`                                                                                                                   | consistent: existing keys stay byte-identical; the test reads the merged file                                                                                                                                                                                                                                                             |
| 2→3                            | category caps (250 bars, 10,000 otherwise) → fixtures                                                                                                                        | consistent: no slice-2 fixture exceeds 250 categories (Task 3 test)                                                                                                                                                                                                                                                                       |
| 2→4, 5, 6, 11a, 13             | fill policy (slots 4–7, role pattern, `sliceBorder` boundaries, pattern constants)                                                                                           | consistent: stated once (Task 2, R48) and reused                                                                                                                                                                                                                                                                                          |
| 2→all                          | design-edit list                                                                                                                                                             | _(review)_ consistent: every design change (role fallback and legend, bar quality, compact legend, §5.2 comments, boundary stroke, segment-label omissions, tolerances) is listed in Task 2 with its ruling                                                                                                                               |
| 3→4…18                         | fixture ids and values                                                                                                                                                       | arithmetic checked: stacked totals 36/42/39/36/6; horizontal-stacked totals 8/−4/11/0; horizontal-grouped shares `bar-grouped`'s values; percent shares 25/75/0 and 16/48/36; compact 78/17.75/4/0.25 of 400; donut total 249 with shares 4.8/12.4/33.7/49 %; tiny-slice donut 220 with 54.5/29.1/13.6/0/1.8/0.9 %; min-area totals 15/18 |
| 3→4, 9, 15, 16                 | series labels and reference `axisId`s                                                                                                                                        | _(review)_ gap fixed: Task 3 names every series label and axis; the sparkline label line uses the series label `p95 latency`                                                                                                                                                                                                              |
| 3→7                            | row-header columns `Quarter`, `Service`                                                                                                                                      | consistent: Task 3 gives those fixtures x labels; Task 7 keeps the slice-1 header rule                                                                                                                                                                                                                                                    |
| 3→16, 17, 18                   | catalog `size` / `themeOverride` → bootstrap groups, candidate size, playground size                                                                                         | consistent: one source (the catalog), staged into the docs index by Task 18                                                                                                                                                                                                                                                               |
| 4→5                            | `SeriesModel` union, `CartesianModel` new fields                                                                                                                             | consistent: Task 4 ships a two-member union; Task 5 adds `AreaSeriesModel`                                                                                                                                                                                                                                                                |
| 4→6, 7, 11a, 15                | `resolveRole`, role legend items, role table column                                                                                                                          | _(review)_ consistent: §5.1 precedence and slot fallback in one function (R49)                                                                                                                                                                                                                                                            |
| 4→8, 11a, 15                   | slice-1 code assuming every series is a line                                                                                                                                 | **ruling:** Task 4 narrows overlays, ids, Legend and interaction with `s.mark === 'line'` (no behaviour change) so every intermediate commit typechecks                                                                                                                                                                                   |
| 4, 5, 6→guard→11a, 11b, 12, 13 | `RENDERED_MARKS` / `KINDS` / `PRESETS` / `ORIENTATIONS`                                                                                                                      | _(review)_ fixed: presets and orientation are gated too, so `line-sparkline` and horizontal specs never reach an unprepared renderer; flips: 11a (`bar`), 11b (`horizontal`), 12 (`area`, both presets), 13 (`donut`)                                                                                                                     |
| 4, 6→slice-1 `mount.spec`      | `min-donut` rejection asserts `/slice 2/`                                                                                                                                    | _(review)_ fixed: guard reasons name `slice 2`; Task 13 moves the case to `min-heatmap` and `/slice 3/`                                                                                                                                                                                                                                   |
| 5→7, 14, 15                    | stack arithmetic needed by the model, the table, the export summary and tooltips                                                                                             | **ruling:** `src/core/shares/index.ts` (`stackPositions`, `donutShares`) is the single DOM-free source, imported by path and not exported publicly                                                                                                                                                                                        |
| 5→8                            | `ValueLabelModel` texts → `PlacedValueLabel` fit                                                                                                                             | consistent: the model owns text (only `ok` positions get segment labels), layout owns fit, gutters and named omissions                                                                                                                                                                                                                    |
| 5→11a                          | stack totals drawn via the `Bar` `label` prop would vanish with a null top member                                                                                            | _(review)_ **ruling:** all value labels are a DravenViz overlay from `slotGeometry` and the axis scale; test `total label survives a null top member`                                                                                                                                                                                     |
| 6→10→13                        | `DonutModel` → `LaidOutDonut` → `DonutChart`                                                                                                                                 | consistent: angles are compass degrees clockwise from 12 o'clock; the adapter maps them to Recharts `startAngle=90`/`endAngle=-270`                                                                                                                                                                                                       |
| 7→15                           | `DataTable` share and role columns → React `DataTable`, print `renderDataTable`                                                                                              | consistent: both render the table model unchanged                                                                                                                                                                                                                                                                                         |
| 8→9, 10                        | `NoteLine.kind`                                                                                                                                                              | _(review)_ fixed: Task 8 adds `segment`, `preset`, `state`; Tasks 9 and 10 use them                                                                                                                                                                                                                                                       |
| 8→9                            | `pass()` allocation; preset dispatch                                                                                                                                         | consistent: presets reuse the Task 8 helpers inside `layoutChart`                                                                                                                                                                                                                                                                         |
| 8, 9, 10→pipeline              | `verifyAndReport` reads `laid.manifest`                                                                                                                                      | consistent: Task 8 switches it; Tasks 9 and 10 add label groups                                                                                                                                                                                                                                                                           |
| 8→11b                          | `chartMargin` assumes left/right y axes and a bottom x axis; horizontal value-axis titles                                                                                    | owned by Task 11b; Task 8 specifies horizontal `yAxisTitles`                                                                                                                                                                                                                                                                              |
| 10→11a, 11b, 12, 13, 15        | `LaidOut` union vs `LaidOutChart`                                                                                                                                            | **ruling:** `LaidOutChart` keeps its Cartesian meaning; `LaidOut` is the union; Task 10 widens `verifyAndReport` and `expectationsOf` so callers need not narrow                                                                                                                                                                          |
| 11a→11b                        | `slotGeometry`, `ValueLabels`, overlays                                                                                                                                      | consistent: 11b extends them to horizontal                                                                                                                                                                                                                                                                                                |
| 11a, 11b→14                    | bar `shape` items, pattern ids via `planIds`                                                                                                                                 | consistent: pattern ids are namespaced `<ns>_<chartId>-<n>` and renamed by finalize; Task 14 tests two-instance isolation                                                                                                                                                                                                                 |
| 11a, 11b, 13→15                | focus-ring geometry                                                                                                                                                          | consistent: interaction uses `slotGeometry` and `laid.ring`, never Recharts DOM                                                                                                                                                                                                                                                           |
| 11a / 13 → slice-1 tests       | `docs.spec` uses `min-bar`; `mount.spec` and `react.spec` use `min-donut` (with `/slice 2/`); `model-line`/`table` tests use `min-bar`/`min-area`/`min-donut` as unsupported | each flip owned: Task 4 (`min-bar` model), Task 5 (`min-area` model), Task 6 (`min-donut` model), Task 7 (table → `min-heatmap`), Task 11a (`docs.spec` → `min-scatter`), Task 13 (`mount.spec`, `react.spec` → `min-heatmap`, `/slice 3/`)                                                                                               |
| 12, 14                         | live `<desc>` vs exported `<desc>` (`summary()` in `src/print/export.ts`)                                                                                                    | _(review)_ fixed: Task 14 extends `summary()` so the export keeps the sparkline sentence and stack/donut states                                                                                                                                                                                                                           |
| 14→16                          | export path vs PDF compare                                                                                                                                                   | consistent: `tests/pdf/compare.ts` compares against the browser render, not the SVG                                                                                                                                                                                                                                                       |
| 16↔17                          | cross-path tolerance calibrated on lines; recalibration needs slice-2 PDF crops                                                                                              | circular → **ruling** in Task 16: over-tolerance crops are recorded calibration-pending with an investigation; Task 17 recalibrates per family (R55) and re-runs `test:pdf`, which must pass outright                                                                                                                                     |
| 16→18                          | `evidence/pdf/report-slice2.json` → staged docs PDF links                                                                                                                    | consistent: stage checks spec hashes as in slice 1                                                                                                                                                                                                                                                                                        |
| 17→19                          | REVIEW decisions → `VISUAL-REFS-2` status                                                                                                                                    | consistent: `pending-review` until the owner approves (D4)                                                                                                                                                                                                                                                                                |
| 1 self                         | probes written in Step 3, first run in Step 2 expected to fail, real results in Step 4                                                                                       | _(review)_ fixed                                                                                                                                                                                                                                                                                                                          |
| 2 self                         | `maxItems` 10,000 + `category-count`; theme test is a guard                                                                                                                  | consistent: stated in Step 2                                                                                                                                                                                                                                                                                                              |
| 3 self                         | 22 catalog ids vs 22 report instances                                                                                                                                        | consistent: 21 distinct fixtures in the report (two instances of `bar-severity-counts`); `cartesian-empty-series` is test-only and not in the report                                                                                                                                                                                      |
| 4 self                         | include-zero default only for axes carrying bars; all-zero → `[0, 1]`                                                                                                        | consistent: line-only axes keep `fit`, so slice-1 domains are unchanged                                                                                                                                                                                                                                                                   |
| 5 self                         | percent axis `unit: "% of total"`; absent points = missing                                                                                                                   | consistent: validation forbids a caller unit there; R27                                                                                                                                                                                                                                                                                   |
| 6 self                         | legend `B — 0 (0%)` vs all-zero `A — 0 (–)`                                                                                                                                  | consistent: a zero slice in an `ok` donut has a 0 % share; in `all-zero` no share exists                                                                                                                                                                                                                                                  |
| 7 self                         | absolute-stack total column only when totals are requested; role column                                                                                                      | consistent with "never silently aggregate"; percent stacks always have it (§5.2)                                                                                                                                                                                                                                                          |
| 7 self                         | `[1, 3, 5, 6]` share and total indices of the empty row                                                                                                                      | _(review)_ fixed (was a filter that could not match)                                                                                                                                                                                                                                                                                      |
| 8 self                         | horizontal labels wrap to 3 lines; vertical labels wrap to 2 then rotate                                                                                                     | intended difference (horizontal has no rotate stage), stated in the rule                                                                                                                                                                                                                                                                  |
| 8 self                         | segment-label omission bound 8                                                                                                                                               | _(review)_ controller decision, R54                                                                                                                                                                                                                                                                                                       |
| 8 self                         | slice-1 snapshot generated before the layout change                                                                                                                          | _(review)_ fixed: the snapshot is created and committed in Step 1 from unmodified code                                                                                                                                                                                                                                                    |
| 9 self                         | sparkline 168.25 ≤ 180 and compact 195.5 ≤ 220 at fontScale 1                                                                                                                | arithmetic checked                                                                                                                                                                                                                                                                                                                        |
| 9 self                         | legend text `1 services`                                                                                                                                                     | intended: units are verbatim, stated under the tests                                                                                                                                                                                                                                                                                      |
| 10 self                        | `innerRadius = 0.6 × outerRadius`; centre fit `2 × inner × 0.9`                                                                                                              | consistent                                                                                                                                                                                                                                                                                                                                |
| 11a self                       | files created (`bars.tsx`, `Patterns.tsx`, `Placeholders.tsx`, `ValueLabels.tsx`, `geometry-bars.spec.ts`) vs touched (`docs.spec.ts`, `mount.spec.ts`)                      | consistent                                                                                                                                                                                                                                                                                                                                |
| 11b self                       | files created (`horizontal.tsx`, `geometry-horizontal.spec.ts`) vs touched (`bars.tsx`, `ValueLabels.tsx`, `verify.ts`, `interaction.ts`)                                    | consistent                                                                                                                                                                                                                                                                                                                                |
| 12 self                        | `AREA_FILL_OPACITY` is a named render constant, not a theme token                                                                                                            | _(review)_ fixed: Task 12 lists `docs/design.md` §7 and records R53                                                                                                                                                                                                                                                                       |
| 13 self                        | `react.spec` and `mount.spec` not-implemented cases move to `min-heatmap` with `/slice 3/`                                                                                   | consistent                                                                                                                                                                                                                                                                                                                                |
| 14 self                        | `SLICE2` now includes patterns (`bar-severity-counts` with the override, `donut-tiny-slices`), horizontal stacks, pie sectors and hidden axes                                | _(review)_ fixed (the previous six fixtures drew no pattern)                                                                                                                                                                                                                                                                              |
| 15 self                        | tooltip strings match §5.2 ("Open: 10 items (25% of 40)")                                                                                                                    | consistent                                                                                                                                                                                                                                                                                                                                |
| 16 self                        | evidence paths: slice-1 unchanged, slice-2 pages in a subdirectory, crops shared by disjoint namespaces; per-instance `link-dest` residual                                   | consistent                                                                                                                                                                                                                                                                                                                                |
| 17 self                        | 31 candidates: 3+1+1+1+1+2+1+1+1+1+1+1+2+1+3+1+1+3+1+1+1+2                                                                                                                   | arithmetic checked                                                                                                                                                                                                                                                                                                                        |
| 18 self                        | selector rule `gallery && slice ≤ 2` plus slice-3 `min-*`; staged index carries size and override                                                                            | consistent                                                                                                                                                                                                                                                                                                                                |
| 19 self                        | CI job shape unchanged; matrix rows reference only catalogued fixtures; ten GC rows for ten slice-2 constraints                                                              | consistent                                                                                                                                                                                                                                                                                                                                |

**Review items ruled against (kept as written):** none. Two items are resolved by choice where the review offered alternatives: segment-label omissions are named in a note (not drawn as callouts), and bars on two axes follow the spike-11 branch (R52).

## Out of scope (later slices)

- **Slice 3:** scatter/bubble (including size outside `bubble.domain`), heatmap, progress bar and ring, static scatter label collision handling (the `StaticLabelPlacer` seam), annotation `x2 < x` and overlapping annotation labels, inline marker geometry (`r` set inline so host `circle{r}` CSS cannot change it), the multi-family A4 report and P3.
- **Slice 4:** the consumer TypeScript 5.4/6.0 declaration check (R40), the `Theme` shape freeze (legend quality strings), the narrow-width title cap (R24), making the cross-mode tolerances (`samePdf`, `crossSvgBrowser`) gate tests, the docs gallery/API/styling/export/testing pages, and P4 for `report-multi-family-a4`.

## Slice-2 exit criteria

- The Task 1 spike passed, or its fallbacks were applied and recorded in design §4 and the slice-2 ledger (R2).
- Every slice-2 family and mode (vertical and horizontal; single, grouped, absolute and percent stacked bars; single and stacked areas; composed dual axis; donut; both presets) renders through React, `mountCharts`, standalone SVG, the docs playground and a real DravenPDF PDF from the packed tarball; `not-implemented-in-slice` fires only for scatter, heatmap and progress.
- All scripts in Task 19 Step 4 have actual recorded outcomes; nothing is reported as passing without a run.
- `test:pdf` reports `pass` for `report-slice1` and `report-slice2`. `UNVERIFIED` (exit 3) or `fail` leaves slice 2 incomplete and is reported as such.
- Slice-2 visual candidates are `approved` by the owner (`pending-review` keeps the slice open; never self-approved).
- P1 p95 ≤ 250 ms; size items within the §18.1 budgets or investigated with a recorded resolution.
- The slice-3 plan is written next, against design §21, reusing the interfaces produced here.
