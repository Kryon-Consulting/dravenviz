# Slice 2: bars, areas, composed/dual axis, donut and presets — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the slice-1 renderer to every slice-2 family in design §21: bars (single, grouped, absolute and 100 % stacked, vertical and horizontal, with the percent unavailable and empty states), single and stacked areas, composed bar + line charts on two named axes, donut, and the sparkline and compact-stack presets. Each family gets fixtures, a DOM-free model, layout, rendering through the same `mountCharts` / `<Chart>` / `renderToSvg` lifecycle, data tables, export coverage, visual candidates for owner review and a real DravenPDF report (`report-slice2`).

**Architecture:** Unchanged from slice 1: `validateSpec` → `buildModel` → layout → one React SVG tree → mount or export (normalize → strict validate → finalize). Cartesian families render through Recharts `ComposedChart` (`layout="vertical"` for horizontal bars) and donut through Recharts `PieChart` (design §4). DravenViz owns data meaning (domains, ticks, stack contributions and shares, gaps, states, labels, layout boxes); Recharts owns pixel placement of its marks (D8). Overlays (placeholders, quality markers, clip breaks, annotations, reference labels, sparkline labels, donut track and centre) are DravenViz SVG children positioned through Recharts' public hooks or DravenViz layout.

**Tech Stack:** As slice 1 (TypeScript 6.0, pnpm 10.33.0, Node 22.22, React 19.3.0 with react-is 19.3.0, Recharts 3.10.1, Ajv 8 standalone, tsup, esbuild, Vitest 5, Playwright 1.56.1 with Chromium 141.0.7390.37 revision 1194, Vite 8, CodeMirror 6; Python 3.12, uv, DravenPDF `7a249e0`, Noto Sans v2.015). No new runtime dependency.

**Spec:** `docs/spec.md` (product brief, binding) and `docs/design.md` (revision 4, the contract). Section references (§n) point to `docs/design.md`. Rulings R1–R46 in `docs/plans/handover/slice-1-ledger.md` bind unless a task below revisits one with a recorded reason. Slice-1 spike results: `docs/plans/slice-1-spike-results.md`. Slice-1 plan (interfaces reused here): `docs/plans/2026-09-30-slice-1-line-vertical-slice.md`.

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

- **Exact geometry, no minimum sizes.** Bars, stack segments and donut slices keep their true size; nothing is inflated for visibility. Small values are read through labels, the legend and the data table (spec "Preserve proportional geometry").
- **Percent stacks** are fed DravenViz-computed shares with `stackOffset="none"`; `stackOffset="expand"` is never used. A category with a missing member is **unavailable** (no segments, dashed outline, theme string "Unavailable"); a zero-total category is **empty** (baseline tick and "No data (0)"). Known members are never renormalised (§5.2).
- **Absolute stacks** use `stackOffset="sign"`: positive members stack up from zero, negative members down from zero, in series order. A null member leaves a gap and marks the category total partial.
- **Bars** appear only on category axes; every axis carrying bars includes zero; a measured zero is a drawn zero-height bar, a null is no bar (§5.2, §9).
- **Donut** draws no slice arcs and claims no share when any slice is null ("Incomplete"), and draws a neutral full ring with centre "0" when all slices are zero (§5.3).
- **Solid fills by default.** Bars, areas and donut slices are solid for palette slots 0–3; slots 4–7 carry the theme `seriesStyles[i].pattern`; a caller role `pattern` always wins. Stack segments and donut slices are separated by a background-coloured boundary stroke. Lines never take a pattern (decision in Task 2).
- **On-chart text in every mode.** Annotation and reference-line labels (R44), `labels.values` and `stacking.segmentLabels` are drawn in interactive and static mode alike; `staticLabels` governs `staticLabel` point labels only (decision in Task 8).
- `not-implemented-in-slice` remains only for scatter series, heatmap and progress (slice 3).
- Recharts is used only through documented props, render props (`shape`, `label`, `tick`) and public hooks; no Recharts class name, DOM structure or private state is read (spec; design §4).

## Review Focus

These seven situations are implied by the spec but not covered by any single task's main flow. Each has a named test in its owning task.

1. **A percent stack with a missing member next to an all-zero category in the same chart.** Expect the missing-member category unavailable (no segments, "Unavailable"), the all-zero category empty ("No data (0)"), the other categories' shares exact and summing to 100, and nothing renormalised. Owned by Task 5 (`missing member makes the category unavailable, never renormalised`) and Task 11 (`percent placeholders draw instead of segments`).
2. **An absolute stack whose members have mixed signs in one category.** Expect positives stacked up from zero and negatives down from zero in series order, and the total label showing the signed sum at the end of the side the sum falls on. Owned by Task 5 (`mixed-sign absolute stack grows both ways from zero`).
3. **A composed chart whose line axis crosses zero while the bar axis includes zero**, so the two zero baselines sit at different heights. Expect each series, marker and reference line bound to its own named axis, with no merged units. Owned by Task 4 (`dual axes keep separate domains and units`) and Task 11 (`reference line and markers bind to their named axis`).
4. **A donut with one zero slice and one slice under 3 %.** Expect no arc for the zero slice but a legend row "0 (0%)", the tiny slice drawn at its true angle with no inline label, and its value and share in the legend and table. Owned by Task 6 (`zero and tiny slices keep true angles`).
5. **Horizontal bars whose category labels are longer than the left gutter allows.** Expect labels wrapped to at most 3 lines and never truncated; a label that cannot fit throws `LAYOUT_ERROR` naming the label and the width it needs. Owned by Task 8 (`horizontal category labels wrap, never truncate`).
6. **A stacked area whose middle member is null at one x position.** Expect every member of the stack to gap there (the layers above have no baseline) and the data table to mark the position "Unavailable (missing member)". Owned by Task 5 (`null member gaps every member of an area stack`) and Task 12 (`stacked areas break at a partial-null position`).
7. **A sparkline in print at 680 × 180.** Expect no axes, grid or legend, every remaining text at least 9 pt (captions 8 pt), and the omission stated in `<desc>`, in the data-table notes and as a printed note. Owned by Task 9 (`sparkline omits axes and states it`).

---

## File structure (created or changed in this slice)

```text
spikes/recharts-3.10/  src/cases-slice2.tsx run-slice2.spec.ts (+ attribute-inventory.json extended)
docs/plans/slice-2-spike-results.md
schema/viz-spec-v1.schema.json            categories/labels cap removed (Task 2)
src/core/spec/types.gen.ts  src/core/validate/{ajv.gen.js,issues.ts}   regenerated / LIMIT_PATHS
src/core/shares/index.ts                  stack positions and donut shares, DOM-free, internal
src/core/table/index.ts                   bar, stack, area and donut tables
src/render/model/{types.ts,index.ts,cartesian.ts,bars.ts,stacks.ts,areas.ts,donut.ts,manifest.ts}
src/render/layout/{types.ts,index.ts,horizontal.ts,value-labels.ts,presets.ts,donut.ts}
src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts,bars.tsx,areas.tsx,DonutChart.tsx}
src/render/primitives/{Patterns.tsx,Placeholders.tsx,SparklineLabels.tsx,DonutParts.tsx,Legend.tsx}
src/render/{ChartView.tsx,pipeline.ts,verify.ts}
src/render/svg/recharts-metadata.ts
src/react/{interaction.ts,Chart.tsx}
fixtures/valid/<19 slice-2 fixtures>.json  fixtures/reports/report-slice2.json  fixtures/index.ts
examples/dravenpdf/{run_pdf_check.py,bundle/bootstrap.js,bundle/index.html}  scripts/test-pdf.ts
tests/unit/{model-bar.test.ts,model-stack.test.ts,model-donut.test.ts,layout-slice2.test.ts,table.test.ts,...}
tests/browser/{geometry-bars.spec.ts,geometry-areas.spec.ts,geometry-donut.spec.ts,export.spec.ts,mount.spec.ts,react.spec.ts}
tests/visual/{candidates.ts,generate.ts,REVIEW.md,tolerances.json}
docs/site/src/{fixtures.ts,components/PdfSample.tsx}  scripts/stage-consumer.ts  tests/docs/docs.spec.ts
evidence/{pdf/report-slice2.*,pdf/pages/report-slice2/,pdf/crops/<ns>.png,visual/,perf/,verification-matrix.md}
docs/design.md                            §4 (only if a spike fallback applies), §5.2, §6, §7, §8, §13, §15, §18
```

After Tasks 4–6 the model builds bar, area and donut models, but `buildLaid` keeps rejecting a family with `RENDER_FAILED` (`not-implemented-in-slice`) until its renderer lands: bars in Task 11, areas and presets in Task 12, donut in Task 13. From Task 13 on, the rule fires only for scatter, heatmap and progress.

---

### Task 1: Recharts 3.10.1 slice-2 spike (proof gate)

**Files:**

- Create: `spikes/recharts-3.10/src/cases-slice2.tsx`, `spikes/recharts-3.10/run-slice2.spec.ts`
- Modify: `spikes/recharts-3.10/src/export-probe.ts` (reused for the new cases), `spikes/recharts-3.10/attribute-inventory.json` (merged additions, same format)
- Create: `docs/plans/slice-2-spike-results.md`

**Interfaces:**

- Consumes: the slice-1 spike harness (same Vite page, the same plot box 600 × 300 with margin {top 20, right 30, bottom 10, left 10}, `YAxis width=50`, `XAxis height=30`, so plot x=60, y=20, w=510, h=240).
- Produces: pass/fail for spike points 7–16 below, measured deltas, the merged attribute inventory, and the fallback taken for any failed point. Tasks 11, 12, 13 and 14 read the results file.

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
  expect(r.shapeCalls.map((c: any) => c.value)).toEqual([4, 0, -2]); // recorded; null never reaches shape
  expect(r.zeroShapeHeight).toBe(0);
});
test('9 bars and areas wrapped in a DravenViz <g data-dv-mark> keep grouping and stacking', async ({
  page,
}) => {
  await page.goto('/?case=wrapped');
  const r = await page.evaluate(() => (window as any).probe.wrapped());
  expect(r.groupedDistinctX && r.stackedSameX && r.areaTopEqualsSum).toBe(true);
  expect(r.itemsInsideWrapper).toBe(true); // every bar path is a descendant of its wrapper g
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
test('11 dual axes: bars left, line right, distinct domains; bars on two axes share a band', async ({
  page,
}) => {
  await page.goto('/?case=dualaxis');
  const r = await page.evaluate(() => (window as any).probe.dualAxis());
  expect(r.leftDomain).toEqual([0, 160000]);
  expect(r.rightDomain).toEqual([-15, 5]);
  expect(r.lineOnRightScaleDelta).toBeLessThanOrEqual(0.5);
  expect(r.barsOnTwoAxesSideBySide).toBe(true); // recorded either way; Task 4 rejects nothing on it
});
test('12 areas: sign offset with a negative member, partial-null member, sizes 2/13/60, linear and time x', async ({
  page,
}) => {
  await page.goto('/?case=areas');
  const r = await page.evaluate(() => (window as any).probe.areas());
  expect(r.signNegativeBelowZero).toBe(true); // negative member draws below zero, positives above
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
  expect(r.allZeroSectors).toBe(0); // recorded: DravenViz draws the neutral ring itself
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

- [ ] **Step 2: Run** `pnpm --dir spikes/recharts-3.10 exec playwright test run-slice2.spec.ts` (with `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Expected: every test reports pass or fail. A failure is a result to record, not to hide.
- [ ] **Step 3: Implement the probes** in `cases-slice2.tsx` (geometry read from the DOM for the checks only). Extend `export-probe.ts` so the merged inventory classifies every new element@attribute pair (Pie sector paths and any `cx`/`cy`/`name` they carry, Bar `shape` output, Area fills, `pattern` children). Write the additions into `attribute-inventory.json` under new component keys; the existing keys stay byte-identical.
- [ ] **Step 4: Record** `docs/plans/slice-2-spike-results.md` in the slice-1 format: the result table, measured deltas, inventory summary (new pairs and their classes, 0 unclassified), and the partial-null area observation (closes the slice-1 spike limit "partial missing member was not tested"). Apply the matching fallback for any failed point, record it in design §4 and continue (Ruling R2, no stop):
  - **H** (point 7 or 14 fails): horizontal bars are drawn by `render/primitives` rectangles from DravenViz scales inside the same `ComposedChart` (overlays still read `usePlotArea`).
  - **Z** (point 8 fails, shape not called for zero): measured-zero bars are drawn as an overlay (a zero-height path at the scaled zero, band-slot width from the bars that did render, or from the D8 oracle when every bar in the series is zero).
  - **W** (point 9 fails): `verifyCommitted` counts items by a `data-dv-of="<manifest key>"` attribute on each `data-dv-item` instead of group nesting.
  - **A** (point 12 sign or partial-null fails): stacked areas are fed model-computed `[lower, upper]` ranges as ranged `Area`s without `stackId`.
  - **P** (point 13 fails): donut arcs are drawn by `render/primitives/DonutParts.tsx` from model angles (no `PieChart`).
  - Point 11's `barsOnTwoAxesSideBySide` and point 13's `allZeroSectors` are observations, not gates.
- [ ] **Step 5: Commit.** `spike: verify Recharts 3.10.1 horizontal bars, zero bars, percent stacks, areas and pie`

---

### Task 2: Contract adjustments and fill policy

**Files:**

- Modify: `schema/viz-spec-v1.schema.json` (remove `maxItems: 250` from `CategoryAxis.categories` and `CategoryAxis.labels`), regenerate `src/core/spec/types.gen.ts` and `src/core/validate/ajv.gen.js` with `pnpm gen`
- Modify: `src/core/validate/issues.ts` (drop the `/xAxis/categories` and `/xAxis/labels` entries from `LIMIT_PATHS`)
- Modify: `src/core/theme/tokens.ts` (doc comment of `SERIES_STYLES` states the fill policy; values unchanged)
- Modify: `docs/design.md` §5.2 (`categories: string[]; // 1+ unique keys; bar axes are limited to 250 by the bar-categories limit`), §6 (the limit applies to category axes carrying bars), §7 (fill policy), §8 (value and segment labels drawn in every mode), §13 and §15 (`report-slice2`), and `CHANGELOG.md` (Unreleased: category cap relaxed to bar axes, backward compatible)
- Test: `tests/unit/schema.test.ts`, `tests/unit/validate.test.ts`, `tests/unit/theme.test.ts`

**Interfaces:**

- Consumes: `schemaValidate`, `validateSpec`, `checkLimits` (`src/core/validate/limits.ts`, unchanged: it already applies `bar-categories` only when a category axis carries a bar series).
- Produces: a schema that admits more than 250 categories on axes without bars (bounded by the 2 MiB JSON limit and the 10,000-point limit), and the written fill policy every later task applies.
- **Decision (queued item "relax the 250-category cap"):** remove the schema cap rather than raise it. The semantic limit `bar-categories` (code `LIMIT_EXCEEDED`, path `/xAxis/categories`) remains the only category cap, and it already applies only to bar axes. Accepting more input is backward compatible under design §20 (no previously valid spec becomes invalid). Mismatched label counts stay `labels-length`.
- **Decision (queued item "series slots 4–7 carry default fill patterns"):** spec "Use solid fills by default. Reserve hatching/patterns for distinctions that need them" and design §7 (`seriesStyles` carry `pattern`). Bars, areas and donut slices have no dash or marker shape to fall back on, and the print palette's grayscale separation (≥ 0.08 relative luminance) is guaranteed only across slots 0–3 (slice-1 Task 7 test). So:
  - slots 0–3 are solid (`pattern: "none"`, as today);
  - slots 4–7 draw their theme pattern (`diagonal`, `dots`, `crosshatch`, `diagonal`) as a low-density overlay on the slot colour: 6-unit tile, 1-unit stroke in the theme background colour at opacity 0.45;
  - the precedence is datum role pattern > series role pattern > slot pattern, and a role `pattern: "none"` switches a slot pattern off;
  - line series never use a pattern;
  - stack segments get a 1-unit boundary stroke in the background colour, and donut slices use `theme.stroke.sliceBorder` (§5.3).

- [ ] **Step 1: Write the failing tests:**

```ts
test('line axis admits 300 categories', () => {
  // schema.test.ts
  expect(schemaValidate(lineSpecWithCategories(300))).toBe(true);
});
test('251 bar categories -> LIMIT_EXCEEDED bar-categories', () => {
  // validate.test.ts
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
  // theme.test.ts
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

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/schema.test.ts tests/unit/validate.test.ts tests/unit/theme.test.ts`. Expected: FAIL (the 300-category spec hits `schema-maxItems`).
- [ ] **Step 3: Implement** the schema edit, `pnpm gen`, the `LIMIT_PATHS` edit and the design/CHANGELOG text. Record both decisions in the ledger as rulings (R47 cap, R48 fills).
- [ ] **Step 4: Run** the tests and `pnpm check:drift`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): category cap applies to bar axes only; document the fill policy`

---

### Task 3: Slice-2 fixtures and `report-slice2`

**Files:**

- Create: `fixtures/valid/{bar-severity-counts,bar-ranking-horizontal,bar-stacked-categories,bar-age-bands-percent,bar-compact-percent,bar-grouped,bar-negative-values,bar-long-labels,bar-all-zero,cartesian-empty-series,area-inventory-stacked,area-single-gaps,composed-revenue-margin,composed-remediation-days-counts,composed-flow-cumulative,donut-severity-share,donut-all-zero,donut-missing-slice,line-sparkline}.json`, `fixtures/reports/report-slice2.json`
- Modify: `fixtures/index.ts` (entries; `FixtureEntry` gains `size?: { width: number; height: number }`, default 680 × 320, and `themeOverride?: "security"`, resolved from `examples/themes/security.json`)
- Test: `tests/unit/fixtures.test.ts`

**Interfaces:**

- Consumes: `validateSpec`, the slice-1 catalog helpers (`entry`, `loadFixture`, `specHash`).
- Produces: the fixture ids, values and catalog fields every later task asserts on, and `loadThemeOverride(entry): ThemeOverrides | undefined`.

All fixtures use `schemaVersion: 1`, print-safe text, and `slice: 2`, `gallery: true`, `modes: ["interactive","static","print"]` unless stated. Point ids are the first letter of their series id plus the 1-based position (`o1…o4` for `opened`) unless a fixture names them; slice ids are as listed. Values (category axis unless noted):

- `bar-severity-counts` (brief 2, `row:counts`), `themeOverride: "security"`: title `Findings by severity`; x `severity` categories `critical, high, medium, low`, labels `Critical, High, Medium, Low`; y `count` label `Findings`, unit `count`, include-zero; `roles` `critical|high|medium|low` with `label` only (no colours); one bar series `findings` with points `c 12 (role critical)`, `h 31 (high)`, `m 84 (medium)`, `l 122 (low)`; `labels: { values: "all" }`.
- `donut-severity-share` (brief 2, `row:distributions`), `themeOverride: "security"`: title `Share of findings by severity`; slices (id, label, value) `critical Critical 12`, `high High 31`, `medium Medium 84`, `low Low 122`, each with the role of the same id; `unit: "findings"`; `center: { value: "total", label: "Findings" }`; `legendValues: "value-share"`. Total 249.
- `composed-revenue-margin` (brief 3, `row:composed`): title `Revenue and margin by quarter`; x `quarter` with axis `label: "Quarter"`, categories `q1..q4`, labels `Q1 2026..Q4 2026`; y `usd` label `Revenue`, unit `USD`, format currency USD max 0 digits, include-zero; y `pct` label `Margin`, unit `%`, format percent max 1 digit, fixed 0–40; bar `rev` on `usd` `120000, 135000, 128000, 151000`; line `mar` on `pct` `18.5, 21, 19.2, 23.4`; reference `goal` on `pct` at `20`, label `Margin goal`.
- `bar-age-bands-percent` (brief 4, `row:composition`): title `Open items by age band`; x `service` with axis `label: "Service"`, categories `svc-a, svc-b, svc-c, svc-d`, labels `Payments, Identity, Reporting, Archive`; y `share` label `Share of items` (no domain, format or unit); `stacking: { mode: "percent", valueUnit: "items", segmentLabels: "share" }`; stack `age` with bar series `a0` `0–30 days` `10, 4, 0, 6`; `a1` `31–90 days` `30, 12, 0, null`; `a2` `91+ days` `0, 9, 0, 3`. So svc-a shares 25/75/0, svc-b 16/48/36, svc-c empty (total 0), svc-d unavailable (missing member).
- `bar-negative-values` (brief 7): title `Net change in open items`; categories `jan..jun`, labels `Jan..Jun`; y `change` label `Change`, unit `items`, include-zero; bar `net` `12, -8, 0, -15, 22, 5`; `labels: { values: "all" }`.
- `bar-long-labels` (brief 7): title `Open items by service`; 8 categories `s1..s8` with labels `Customer Identity Verification`, `Payments Settlement Gateway`, `Regional Logistics Planner`, `Internal Reporting Warehouse`, `Partner Onboarding Portal`, `Mobile Banking Backend`, `Document Archive Service`, `Notification Delivery Hub`; y `count` unit `items`; bar `open` `42, 17, 33, 8, 25, 51, 12, 29`. At 680 × 320 print the labels must reach the `rotate` stage (Task 8 asserts it; if measurement shows `wrap`, lengthen the labels, never change the assertion).
- `bar-all-zero` (brief 7, readiness §9): title `Items reopened`; categories `w1..w4`, labels `6 Jul, 13 Jul, 20 Jul, 27 Jul`; y `count` unit `items`; bar `reopened` `0, 0, 0, 0`.
- `cartesian-empty-series` (brief 7, readiness §9): title `No data yet`; categories `a, b, c`; y `count` unit `items`; bar `b` with `points: []`, line `l` with `points: []`. `gallery: false`, `modes: ["interactive","static"]`.
- `composed-remediation-days-counts` (brief 10, `row:composed`): title `Remediation time and resolved items`; categories `jan..jun`, labels `Jan..Jun`; y `count` label `Resolved`, unit `count`, include-zero, position left; y `days` label `Median time to remediate`, unit `days`, format max 0 digits, position right (default fit); bar `resolved` on `count` `34, 41, 38, 52, 47, 29`; line `days` on `days` `41, 38, 36, 31, 28, 25` with `d5` `quality: "lagging"` and `d6` `quality: "partial"`, `renderHint: "marker-only"`; reference `target` on `days` at `30`, label `30-day target`; annotation `a1` at `may`, label `Process change`, detail `Triage moved to the service teams on 4 May.`
- `composed-flow-cumulative` (brief 10, `row:composed`): title `Inflow, outflow and cumulative balance`; categories `w1..w6`, labels `Week 1..Week 6`; y `count` label `Items`, unit `items`, include-zero; y `balance` label `Balance`, unit `items`, position right (fit); bars `inflow` `20, 18, 25, 15, 12, 22` and `outflow` `15, 24, 28, 21, 14, 16` (grouped, no stackId); line `balance` on `balance` `5, -1, -4, -10, -12, -6` (supplied by the caller, never computed) with `b6` `quality: "lagging"`; reference `even` on `balance` at `0`, label `Break-even`; annotation `a1` at `w4`, label `Backlog drive`, detail `Extra triage capacity from week 4.`
- `bar-ranking-horizontal` (brief 11, `row:counts`): title `Oldest open items by service`; `orientation: "horizontal"`; 10 categories `r1..r10` with labels `Customer Identity Verification`, `Payments Settlement Gateway`, `Regional Logistics Planner`, `Internal Reporting Warehouse`, `Partner Onboarding Portal`, `Mobile Banking Backend`, `Document Archive Service`, `Notification Delivery Hub`, `Fleet Telemetry Collector`, `Billing Reconciliation Engine`; y `days` label `Open age`, unit `days`, include-zero; `roles` `overdue` (`label: "Overdue"`, `color: "#a61b1b"`) and `ontrack` (`label: "On track"`); bar `age` `68, 61, 55, 47, 40, 33, 28, 21, 14, 6` (caller rank order), points 1–4 `role: "overdue"`, the rest `ontrack`; reference `limit` on `days` at `30`, label `30-day threshold`; `labels: { values: "all" }`.
- `bar-stacked-categories` (brief 11, `row:counts`): title `Open items by service and severity`; categories `svc-a..svc-e`, labels `Payments API, Identity Service, Reporting Jobs, Archive Store, Edge Gateway`; y `count` unit `items`, include-zero; `stacking: { mode: "absolute" }`; stack `sev` with `crit` `4, 2, 6, null, 1`, `high` `12, 9, 15, 11, 3`, `med` `20, 31, 18, 25, 2`; reference `cap` at `40`, label `Capacity`; `labels: { values: "totals" }`. Totals 36, 42, 39, 36 (partial), 6; svc-e's `crit` 1 is a tiny segment drawn at its true height.
- `bar-compact-percent` (brief 11, `row:composition`), `size: 680 × 220`: title `Service compliance`; `preset: "compact-stack"`, `orientation: "horizontal"`; one category `all`, label `All services`; y `share` (no domain, format or unit); `stacking: { mode: "percent", valueUnit: "services", segmentLabels: "share" }`; stack `c` with `ok` `Compliant` 312, `minor` `Minor gaps` 71, `major` `Major gaps` 16, `crit` `Critical gaps` 1. Shares 78, 17.75, 4, 0.25.
- `bar-grouped` (extra, `row:counts`): title `Items by region`; categories `north, south, east, west`, labels `North, South, East, West`; y `count` unit `items`; bars `opened` `14, 22, 9, 17` (point `o4` `quality: "partial"`), `closed` `11, 25, 9, 12`, `reopened` `2, 0, null, 3`.
- `area-inventory-stacked` (extra, `row:open-item-trends`): title `Managed assets by type`; categories `jan..aug`, labels `Jan..Aug`; y `assets` unit `assets`, include-zero; `stacking: { mode: "absolute" }`; stack `inv` with area series `servers` `120, 124, 130, 133, 135, 140, 138, 142`, `laptops` `210, 215, 220, 226, null, 231, 236, 240`, `mobile` `80, 84, 90, 95, 97, 101, 104, 110`.
- `area-single-gaps` (extra, `row:open-item-trends`): title `Open items, weekly`; categories `w1..w10`; y `count` unit `items`, include-zero; area `open` with point ids equal to the category keys (`w1…w10`) and values `12, 14, null, 18, 17, 21, 19, 22, 24, 26`, with `w6` `quality: "partial"`, `renderHint: "marker-only"`, and `w9`, `w10` `quality: "estimated"`. Segments `[w1,w2]`, `[w4,w5]`, `[w7..w10]` with estimated range `[w8,w10]`.
- `donut-all-zero` (brief 7, `row:distributions`): title `Overdue items by age`; slices `a 0` `0–30 days`, `b 0` `31–90 days`, `c 0` `91+ days`; unit `items`.
- `donut-missing-slice` (brief 7, `row:distributions`): title `Encryption coverage`; slices `full 12` `Full`, `part null` `Partial`, `none 7` `None`, `unk 3` `Unknown`; unit `systems`.
- `line-sparkline` (extra, `row:open-item-trends`), `size: 680 × 180`: title `API latency, July`; `preset: "sparkline"`; time axis `day`; y `ms` label `p95 latency`, unit `ms`; line `lat` with point ids `p1…p30` over `2026-07-01`…`2026-07-30` and values `212, 208, 215, 220, 218, 225, 231, 228, 224, 219, 226, null, 233, 240, 236, 229, 222, 218, 214, 221, 227, 235, 242, 238, 231, 226, 219, 215, 210, 207`.
- `report-slice2`: `[{sc-a: bar-severity-counts}, {sc-b: bar-severity-counts}, {rh: bar-ranking-horizontal}, {gr: bar-grouped}, {st: bar-stacked-categories}, {ab: bar-age-bands-percent}, {cp: bar-compact-percent}, {nv: bar-negative-values}, {ll: bar-long-labels}, {bz: bar-all-zero}, {ai: area-inventory-stacked}, {ag: area-single-gaps}, {rm: composed-revenue-margin}, {rd: composed-remediation-days-counts}, {cf: composed-flow-cumulative}, {ds: donut-severity-share}, {dz: donut-all-zero}, {dm: donut-missing-slice}, {sp: line-sparkline}]`, written as `{ "fixture": …, "namespace": … }` entries in that order (19 instances, two of `bar-severity-counts`).

- [ ] **Step 1: Write the failing tests:** every new fixture passes `validateSpec`; the 19 new ids are catalogued with `slice: 2` (alongside the existing slice-2 `min-*` entries); `size` is `680×220` for `bar-compact-percent`, `680×180` for `line-sparkline` and absent elsewhere; `themeOverride` is `security` exactly for the two severity fixtures and `loadThemeOverride` returns the parsed `examples/themes/security.json`; `report-slice2` lists `bar-severity-counts` twice with distinct namespaces; **no namespace appears in both `report-slice1` and `report-slice2`** (their PDF crops share `evidence/pdf/crops/`); every report namespace matches `^[a-z][a-z0-9-]{0,31}$`; no slice-2 fixture has more than 250 categories.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/fixtures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Author** the fixtures and catalog entries (coverage tags `brief-<n>`, `row:<name>` with new rows `row:counts`, `row:composition`, `row:composed`, `row:distributions`, and `edge:<name>` for `negative`, `all-zero`, `empty-series`, `long-labels`, `horizontal`, `percent-states`, `stack-partial`, `donut-zero`, `donut-missing`, `sparkline`, `compact-stack`).
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `test(fixtures): slice-2 bar, area, composed, donut and preset fixtures and report-slice2`

---

### Task 4: Bar series model, composed charts and the render guard

**Files:**

- Create: `src/render/model/bars.ts`
- Modify: `src/render/model/{types.ts,cartesian.ts,manifest.ts}`, `src/render/pipeline.ts`
- Modify (narrowing only, no behaviour change): `src/render/recharts/{overlays.tsx,ids.ts}`, `src/render/primitives/Legend.tsx`, `src/react/interaction.ts` — every place that treats `model.series` as lines filters `s.mark === 'line'`
- Test: `tests/unit/model-bar.test.ts`; modify `tests/unit/model-line.test.ts` (the `min-bar` unsupported assertion becomes a bar-model assertion)

**Interfaces:**

- Consumes: `buildCartesianModel`, `buildValueScale`, `buildMarkers`, `variantOf`, `buildManifest` (slice 1), `Theme.seriesStyles`, the Task 2 fill policy, Task 3 fixtures.
- Produces:
  - `type FillPattern = "none" | "diagonal" | "dots" | "crosshatch"`.
  - `LineSeriesModel` gains `mark: "line"`. `type SeriesModel = LineSeriesModel | BarSeriesModel | AreaSeriesModel` (`AreaSeriesModel` lands in Task 5; until then the union has two members). `CartesianModel.series: SeriesModel[]`.
  - `BarSeriesModel = { mark: "bar"; id; label; axisId; stackId?: string; style: { color: string; pattern: FillPattern }; points: PointModel[]; bars: BarModel[]; markers: MarkerModel[]; clipped: ClippedModel[] }`.
  - `BarModel = { pointId: string; xKey: string; value: number; state: "measured" | "zero"; quality: Quality }` (one per non-null point, in point order; nulls have no entry).
  - `PointModel` gains `pattern?: FillPattern` (only when a datum role sets one).
  - `CartesianModel` gains `orientation: "vertical" | "horizontal"`, `preset: "standard" | "sparkline" | "compact-stack"` and `barSlots: string[]` (the order Recharts places bars in a band: each unstacked bar series id, or a stack id at its first member's position).
  - Manifest keys `series:<id>:bar` (count = bars incl. zero), and the existing `series:<id>:marker` and `series:<id>:clip-indicator` for bar series.
  - In `pipeline.ts`: `RENDERED_MARKS: ReadonlySet<Series["mark"]>` (initially `line`) and `RENDERED_KINDS` (initially `cartesian`); `buildLaid` throws `notImplemented(spec, …)` for an unlisted mark or kind before layout.
- Rules:
  - A y axis with no `domain` defaults to `include-zero` when any bar series binds to it, else `fit` (§5.2 ValueAxis comment; slice 1 always used `fit`, which was correct only because it had no bars).
  - Bar quality: `partial` → hollow marker and `lagging` → ringed marker at the bar's value end (reason `quality`, variants from `variantOf`); `estimated` → no marker; the bar outline is drawn dashed (Task 11). The legend lists each quality that draws a mark, as for lines.
  - `clip-indicated` bar axes: a bar beyond the domain records `{ pointId, side }` in `clipped` and the slice-1 clip note.
  - Fill: `style.pattern` = series role pattern > slot pattern; `point.pattern` from a datum role.

- [ ] **Step 1: Write the failing tests** (`ctx = { theme: themes.print, locale: 'en-US', timezone: 'UTC' }`):

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
test('partial bar gets a hollow marker and a legend entry', () => {
  expect((series('bar-grouped', 'opened') as BarSeriesModel).markers).toEqual([
    { pointId: 'o4', reason: 'quality', variant: 'hollow' },
  ]);
  expect(model('bar-grouped').legend.some((l) => l.id === 'quality:partial')).toBe(true);
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
test('roles colour datums; security override supplies colours and patterns', () => {
  const plain = series('bar-severity-counts', 'findings') as BarSeriesModel;
  expect(plain.points.every((p) => p.color === undefined)).toBe(true);
  const sec = seriesWithTheme(
    'bar-severity-counts',
    'findings',
    resolveTheme('print', readJson('examples/themes/security.json')),
  ) as BarSeriesModel;
  expect(sec.points.map((p) => p.pattern)).toEqual(['crosshatch', 'diagonal', 'dots', 'none']);
  expect(sec.points[0].color).toBe('#7f1d1d');
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
test('buildLaid rejects bars until their renderer lands', () => {
  expect(
    catchErr(() => buildLaid(validateSpec(loadFixture('min-bar')), layoutInput)),
  ).toMatchObject({ code: 'RENDER_FAILED', issues: [{ rule: 'not-implemented-in-slice' }] });
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-bar.test.ts tests/unit/model-line.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `bars.ts` builds `BarSeriesModel`; `cartesian.ts` dispatches per mark, computes the include-zero default and `barSlots`; area series still report `unsupported` until Task 5. Keep every slice-1 line test green (the line model's JSON output is unchanged except for the added `mark: "line"` and the new top-level fields).
- [ ] **Step 4: Run** them, plus `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): bar series model, composed axes and the per-family render guard`

---

### Task 5: Stacks (absolute and percent) and area series model

**Files:**

- Create: `src/core/shares/index.ts` (internal: imported by path from `render/model` and `core/table`, not re-exported from `src/core/index.ts`), `src/render/model/{stacks.ts,areas.ts}`
- Modify: `src/render/model/{types.ts,cartesian.ts,manifest.ts}`
- Test: `tests/unit/model-stack.test.ts`; modify `tests/unit/model-line.test.ts` (the `min-area` unsupported assertion)

**Interfaces:**

- Consumes: Task 4 model types, `buildSegments`, `buildMarkers`, `formatNumber`.
- Produces:
  - `stackPositions(spec: CartesianSpec): StackPositions[]` in `core/shares`, where `StackPositions = { stackId; mark: "bar" | "area"; mode: "absolute" | "percent"; axisId; members: string[]; positions: { xKey: string | number; state: "ok" | "partial" | "unavailable" | "empty"; total: number | null; members: { seriesId; value: number | null; share?: number; lower: number; upper: number }[] }[] }`. It is the single source of stack arithmetic for the model and the table.
    - Absolute: per position, positives accumulate upward from 0 and negatives downward from 0 in series order; `total` = signed sum of measured members; a null member makes the state `partial` (`lower = upper` for that member). An area stack with any null member at a position is `unavailable` there.
    - Percent: any null member → `unavailable`, every `share` undefined; total 0 → `empty`; otherwise `share = value / total × 100` and `[lower, upper]` accumulate the shares.
  - `StackModel = StackPositions` re-exposed on `CartesianModel.stacks`, plus `CartesianModel.stacking?: { mode; valueUnit?: string; segmentLabels: "none" | "share" | "value" | "value-and-share" }` (percent default `share`, absolute default `none`).
  - `AreaSeriesModel = { mark: "area"; id; label; axisId; stackId?: string; style: { color; dash; shape; width; pattern: FillPattern }; interpolation; points: PointModel[]; segments: SegmentModel[]; markers: MarkerModel[]; clipped: ClippedModel[] }`. Unstacked areas segment exactly like lines (gaps, marker-only, isolated markers, estimated ranges). A stacked area member's segments additionally break at every position its stack marks `unavailable`.
  - `ValueLabelModel = { kind: "bar" | "total" | "segment"; seriesId?: string; stackId?: string; xKey: string; value: number; text: string; sign: 1 | -1 }` on `CartesianModel.valueLabels`. Texts: bar and total labels use `displayValue` or the axis format; a partial total reads `36 (partial)`; segment labels read `25%` (`share`), `10 items` (`value`) or `10 items (25%)` (`value-and-share`), the share formatted `{ style: "percent", maximumFractionDigits: 1 }`; segment labels are created only for members with a value above 0. `labels.values: "totals"` labels stack totals and bars alone in their band (design §5.2 "ungrouped bars"); `"all"` additionally labels grouped bars; stack segments are labelled only through `stacking.segmentLabels`; line and area points are never labelled here (slice 3 owns point labels).
  - The y axis bound to a percent stack: domain `[0, 100]`, format percent, `unit: "% of total"` (validation already forbids a caller domain, format or unit there).
  - Manifest keys `series:<id>:area` (count = area segments), `series:<id>:estimated` for areas, `stack:<id>:unavailable` and `stack:<id>:empty` (counts of placeholder positions).
- Recharts feed (consumed by Task 11/12): absolute stacks pass raw values with chart-level `stackOffset="sign"`; percent stacks pass `share` with `stackOffset="none"`; unavailable and empty positions pass `null` for every member. `stacking.mode` is chart-level, so one chart never needs both offsets.

- [ ] **Step 1: Write the failing tests:**

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
test('percent axis is dedicated: [0, 100], "% of total"', () => {
  expect(model('bar-age-bands-percent').yAxes[0]).toMatchObject({
    domain: [0, 100],
    unit: '% of total',
  });
});
test('absolute stack totals; null member makes the total partial', () => {
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
});
test('null member gaps every member of an area stack', () => {
  const m = model('area-inventory-stacked');
  expect(m.stacks[0].positions[4].state).toBe('unavailable');
  for (const id of ['servers', 'laptops', 'mobile'])
    expect(
      (m.series.find((s) => s.id === id) as AreaSeriesModel).segments.map((g) => [
        g.pointIds[0],
        g.pointIds.at(-1),
      ]),
    ).toHaveLength(2);
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
test('segment and value label texts', () => {
  expect(
    model('bar-age-bands-percent')
      .valueLabels.filter((l) => l.kind === 'segment')
      .slice(0, 2)
      .map((l) => l.text),
  ).toEqual(['25%', '75%']);
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

- Consumes: `DonutSpec`, `Theme`, `formatNumber`, Task 2 fill policy.
- Produces:
  - `donutShares(spec: DonutSpec): { state: "ok" | "all-zero" | "incomplete"; total: number | null; slices: { id; value: number | null; share?: number }[] }` in `core/shares`.
  - `DonutModel = { kind: "donut"; chartId; title; description?; caption?; state: "ok" | "all-zero" | "incomplete"; unit?: string; total: number | null; slices: SliceModel[]; center: { value?: string; label?: string }; legend: LegendItem[]; legendOptions; notes: string[]; manifest: MarkManifest }`.
  - `SliceModel = { id; label; value: number | null; display: string; share?: number; shareText: string; startDeg: number; endDeg: number; color: string; pattern: FillPattern; inlineEligible: boolean }`. Angles are compass degrees, clockwise from 12 o'clock (`startDeg` of slice 0 is 0, `endDeg` of the last positive slice is 360); `inlineEligible` is `share >= 3`.
  - `ChartModel = CartesianModel | DonutModel | UnsupportedModel`; `buildModel` dispatches by kind; `unsupported` remains for heatmap and progress (and scatter marks).
  - Manifest keys `slice` (count of slices with value > 0, only in state `ok`), `donut:track` (1 in `all-zero` or `incomplete`), `donut:center` (1 unless the centre has neither value nor label).
- States (§5.3):
  - `ok`: shares exact, `shareText` `4.8%` style (`maximumFractionDigits: 1`), a zero slice has `startDeg === endDeg`.
  - `all-zero`: centre value `0`, note `No items (total 0)`, every `shareText` `–`.
  - `incomplete`: no angles drawn (`startDeg = endDeg = 0`), centre value `Incomplete` (theme `strings.incomplete`), `shareText` `–`, null slices display `Not measured`, note `Incomplete: 1 slice not measured; shares are not shown.` (pluralised).
  - Centre: `value: "total"` → formatted total (with no unit suffix), `"none"` → no value, any other string → shown verbatim; `label` verbatim.
  - Legend items per slice (`kind: "series"`, `swatch: "fill"`), text per `legendValues`: `value-share` → `Critical — 12 (4.8%)`, `value` → `Critical — 12`, `none` → `Critical`; in `incomplete` the share is omitted and nulls read `Partial — Not measured`.
  - Colours: slice role colour > slice colour > palette slot `i % 8`; pattern per Task 2 (slots 4–7 patterned; slice index wraps every 8, so slice 8 repeats slot 0 and is distinguished by order, legend and border; documented in §7).

- [ ] **Step 1: Write the failing tests:**

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
});
test('all-zero donut: neutral ring, centre 0, note', () => {
  const d = donut('donut-all-zero');
  expect(d.state).toBe('all-zero');
  expect(d.center.value).toBe('0');
  expect(d.notes).toEqual(['No items (total 0)']);
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
- [ ] **Step 3: Implement.** `buildLaid` still rejects donut (`RENDERED_KINDS` has only `cartesian`).
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut model with all-zero and incomplete states`

---

### Task 7: Data tables for bars, stacks, areas, presets and donut

**Files:**

- Modify: `src/core/table/index.ts`
- Test: `tests/unit/table.test.ts` (the `min-donut` not-implemented case moves to `min-heatmap`)

**Interfaces:**

- Consumes: `stackPositions`, `donutShares` (`core/shares`), `formatNumber`, `resolveTheme` strings.
- Produces: `toDataTable(spec, options)` (signature unchanged, §11) for every slice-2 spec. Column and cell rules:
  - Unstacked bars and composed charts: one column per series, header `Label (unit)` of its own axis (`Revenue (USD)`, `Margin (%)`).
  - Percent stacks: per member a raw column `<label> (<valueUnit>)` then a share column `<label> share (%)`, then `Total (<valueUnit>)`. Unavailable rows: missing member `Not measured` (`missing`), shares `Unavailable` (`unavailable`), total `Unavailable` (`unavailable`). Empty rows: shares and total `No data (0)` (`empty`).
  - Absolute stacks: a `Total (<unit>)` column only when `labels.values` is `totals` or `all` (the caller asked for totals); a partial total reads `36 (partial: 1 member not measured)` (`partial`).
  - Stacked areas: at an unavailable position the null member reads `Not measured` (`missing`) and every measured member reads `<value> — Unavailable (missing member)` (`unavailable`).
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
  expect(t.rows[2].cells.filter((_, i) => i % 2 === 1).map((c) => c.state)).toEqual([
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
  /* min-heatmap → RENDER_FAILED, rule not-implemented-in-slice */
});
```

The row-header column keeps the slice-1 rule: the x axis `label`, else the capitalised axis id (`Week` for `line-weekly-flow`). The expectations above rely on the Task 3 x labels `Quarter` (`composed-revenue-margin`) and `Service` (`bar-age-bands-percent`).

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/table.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): data tables for stacks, shares, areas and donuts`

---

### Task 8: Cartesian layout for bars, horizontal orientation and value labels

**Files:**

- Create: `src/render/layout/{horizontal.ts,value-labels.ts}`
- Modify: `src/render/layout/{types.ts,index.ts}`, `src/render/pipeline.ts` (`verifyAndReport` reads `laid.manifest`)
- Test: `tests/unit/layout-slice2.test.ts`

**Interfaces:**

- Consumes: `CartesianModel` (Tasks 4–5), `planXTicks`, `wrapWords`, `notoMeasurer`, `Theme`.
- Produces (additions to `LaidOutChart`, which keeps its name and stays the Cartesian layout):
  - `orientation: "vertical" | "horizontal"` and `grid: "horizontal" | "vertical"` (value-axis gridlines: horizontal lines for vertical plots, vertical lines for horizontal plots; spec "Default visual rules").
  - `manifest: MarkManifest`: the model manifest plus layout-decided groups `labels:value` (value and total labels drawn) and `labels:segment` (segment labels that fit). `verifyAndReport` verifies `laid.manifest` instead of `laid.model.manifest`.
  - `valueLabels: PlacedValueLabel[]`, `PlacedValueLabel = { kind; seriesId?; stackId?; xKey; text; width; height; visible: boolean }` (positions come from Recharts' bar geometry at render; layout reserves space and decides fit).
  - `placeholders: { stackId; xKey; kind: "unavailable" | "empty"; text: string; width: number }[]` (measured theme strings `Unavailable` and `No data (0)`).
  - `LegendItem` gains `swatch?: "line" | "fill" | "area"` and `pattern?: FillPattern`.
- Rules:
  - **Horizontal orientation** (`horizontal.ts`): categories run top to bottom on the left; the category axis box (`boxes.xAxis`, still keyed by `model.x.id`) sits left of the plot; value axes map `position: "left"` → bottom and `"right"` → top (§5.2), with horizontal tick labels. Category labels wrap at the gutter width to at most 3 lines and are never truncated; the gutter is the widest wrapped label, capped at 40 % of the inner width. A label needing more than 3 lines at the cap throws `LAYOUT_ERROR` naming the category label and the width it needs. If the band height is below the label's line count × line height, every n-th label is hidden (first and last kept), exactly like the slice-1 thin stage. `PlacedTick.rotate` is always 0 here.
  - **Value-label space** (`value-labels.ts`): when any value or total label exists, a gutter of one label line height (vertical) or of the widest label plus the tick gap (horizontal) is reserved beyond the plot edge on each side the labelled values reach (the max end for positive values, the min end for negatives). A value label wider than its bar slot (`bandWidth × (1 − theme.spacing.barGap) / barSlots.length`) in a vertical chart throws `LAYOUT_ERROR` naming "value labels" and the width needed. Segment labels exist only for members with a value above 0 (a zero segment has nothing to label; the table shows the 0), and are `visible` only when they fit inside their segment (width and height, computed from the share and the plot box); hidden ones add the note `Segment labels that do not fit their segment are omitted; the data table lists every value.`
  - Placeholder text must fit its band (vertical: band width; horizontal: band height for one line) or `LAYOUT_ERROR` names the placeholder.
  - Annotation and reference labels stay measured in every mode for every family and orientation (R44). **Decision:** `labels.values` and `stacking.segmentLabels` are also on-chart text in every mode: they are explicit spec choices, and hiding them in interactive mode would silently drop text the caller asked for (same reasoning as R44); `staticLabels` governs `staticLabel` point labels only.

- [ ] **Step 1: Write the failing tests** (all at 680 × 320, print theme, `printWidthMm: 178`, `notoMeasurer`):

```ts
test('horizontal ranking: categories left, value axis below, no overlap', () => {
  const l = laid('bar-ranking-horizontal');
  expect(l.orientation).toBe('horizontal');
  expect(l.grid).toBe('vertical');
  expect(l.boxes.xAxis.x + l.boxes.xAxis.width).toBeLessThanOrEqual(l.boxes.plot.x + 1e-6);
  expect(l.boxes.axes.days.y).toBeGreaterThanOrEqual(l.boxes.plot.y + l.boxes.plot.height - 1e-6);
  expect(l.xTicks.every((t) => t.rotate === 0)).toBe(true);
  expect(l.xTicks.map((t) => t.lines.join(' '))).toEqual(rankingLabels);
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
test('percent axis title and segment-label fit', () => {
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
  /* JSON of laid(line-weekly-flow) minus the new fields equals the committed snapshot from main */
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/layout-slice2.test.ts tests/unit/layout.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the `pass()` allocation order of §8; horizontal orientation swaps which boxes hold the category and value axes. `chartMargin` is generalised in Task 11, not here.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): horizontal bar layout, value-label gutters and segment-label fit`

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
  - **Sparkline** (§5.2): no axes (every axis box has zero width and height), no grid, no legend. Under the title, one label line per series: `<series label>: <last display> <unit>` (unit from the y axis, omitted when absent), e.g. `p95 latency: 207 ms`. First and last value labels (`212`, `207`) sit beside the first and last measured points; layout reserves a left and right gutter of their widths plus the tick gap. A note `Sparkline: axes and legend omitted` is always added to the notes (caption size) and to `<desc>` (Task 12). Manifest group `labels:sparkline` counts the labels drawn (3 per series with any measured value).
  - **Compact-stack** (§5.2): percent-stacked horizontal bars; no value axis, ticks or grid (the value axis box is zero-sized; Task 12 renders it hidden with domain `[0, 100]`); category labels at the left only when there is more than one category; the legend is always shown. With one category, legend items read `<label> — <value> <valueUnit> (<share>)`, e.g. `Compliant — 312 services (78%)`. With more than one category, legend items show labels only and a note `Values for each category are in the data table.` is added (the legend never sums across categories).
  - Arithmetic check at 680 wide, print, fontScale 1: sparkline needs 32 (padding) + 21.25 (title) + 10 + 16.25 (label line) + 5 + 60 (minimum plot) + 13.75 (note) + 10 = 168.25 ≤ 180; compact-stack needs 32 + 21.25 + 10 + 36.5 (2 legend rows) + 12 + 60 + 13.75 + 10 = 195.5 ≤ 220.

- [ ] **Step 1: Write the failing tests:**

```ts
test('sparkline omits axes and states it', () => {
  const l = laidAt('line-sparkline', 680, 180);
  expect(Object.values(l.boxes.axes).every((b) => b.width === 0 && b.height === 0)).toBe(true);
  expect(l.legendRows).toEqual([]);
  expect(l.notes.map((n) => n.text)).toContain('Sparkline: axes and legend omitted');
  expect(l.sparklineLabels.map((s) => s.text)).toEqual(['p95 latency: 207 ms', '212', '207']);
  expect(l.manifest.groups).toContainEqual({ key: 'labels:sparkline', count: 3 });
  expect(l.metrics.effectivePt!.label).toBeGreaterThanOrEqual(9);
  expect(l.metrics.effectivePt!.caption).toBeGreaterThanOrEqual(8);
});
test('sparkline too short is a layout error', () => {
  expect(() => laidAt('line-sparkline', 680, 100)).toThrow(/minimum/);
});
test('compact-stack: no value axis, legend with values, tiny segment not inflated', () => {
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
  expect(l.valueLabels.find((v) => v.text === '0.3%')!.visible).toBe(false); // 0.25 % segment: label omitted, geometry exact
  expect(l.notes.map((n) => n.text)).toContain(
    'Segment labels that do not fit their segment are omitted; the data table lists every value.',
  );
});
test('compact-stack with several categories keeps labels and drops legend values', () => {
  const l = laidOf(compactSpec({ categories: 3 }));
  expect(l.xTicks.filter((t) => t.visible)).toHaveLength(3);
  expect(l.notes.map((n) => n.text)).toContain('Values for each category are in the data table.');
});
```

The legend text `1 services` is the verbatim `valueUnit`; DravenViz does not inflect caller units (spec "Supplied labels are displayed verbatim").

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `presets.ts`.
- [ ] **Step 4: Run** them and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): sparkline and compact-stack preset layouts`

---

### Task 10: Donut layout and the `LaidOut` union

**Files:**

- Create: `src/render/layout/donut.ts`
- Modify: `src/render/layout/{types.ts,index.ts}`, `src/render/pipeline.ts` (`buildLaid` returns `LaidOut`; dispatches `layoutChart` / `layoutDonut`), and the `buildLaid` callers' types in `src/print/{mount.ts,export.ts}` and `src/react/Chart.tsx`
- Test: `tests/unit/layout-slice2.test.ts` (donut cases)

**Interfaces:**

- Consumes: `DonutModel` (Task 6), `wrapWords`, `computeFontScale`, `scaledEffectivePt`.
- Produces:
  - `layoutDonut(model: DonutModel, opts: LayoutOptions, measure: TextMeasurer): LaidOutDonut`.
  - `LaidOutDonut = { model: DonutModel; width; height; fontScale; boxes: { title: Box; legend: Box; plot: Box; notes: Box }; ring: { cx: number; cy: number; outerRadius: number; innerRadius: number }; titleLines: string[]; legendRows: LegendItem[][]; legendLabels: Record<string, string[]>; center: { valueLines: string[]; valueSize: number; labelLines: string[] }; sliceLabels: { sliceId: string; text: string; x: number; y: number; width: number; height: number; visible: boolean }[]; notes: NoteLine[]; manifest: MarkManifest; metrics: { effectivePt?: { title; label; caption } } }`.
  - `type LaidOut = LaidOutChart | LaidOutDonut` (discriminated by `laid.model.kind`). `LaidOutChart` keeps its slice-1 name and meaning (Cartesian) so slice-1 code does not churn.
- Rules: allocation order title → legend (default bottom, wrapped rows, items with values) → notes → plot. The ring is centred in the plot box, `outerRadius = min(plot.width, plot.height) / 2`, `innerRadius = 0.6 × outerRadius`. The centre value uses the title size and the centre label the label size; both must fit within `2 × innerRadius × 0.9` wide (wrap the label to at most 2 lines), else `LAYOUT_ERROR` naming the centre text. A slice label (its `shareText`) is `visible` only when the slice is `inlineEligible` and the label box fits inside the annulus sector at the mid-angle; otherwise the legend carries it (§5.3). `manifest` = model manifest plus `labels:slice` (visible slice labels).

- [ ] **Step 1: Write the failing tests:**

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
test('all-zero and incomplete donut layouts', () => {
  expect(laidDonut('donut-all-zero').center.valueLines).toEqual(['0']);
  expect(laidDonut('donut-all-zero').notes.map((n) => n.text)).toContain('No items (total 0)');
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
- [ ] **Step 3: Implement.** Update every `buildLaid` caller's type (`src/print/mount.ts`, `src/print/export.ts`, `src/react/Chart.tsx`) to `LaidOut`, narrowing with `laid.model.kind === 'cartesian'` where they read Cartesian fields.
- [ ] **Step 4: Run** them, `pnpm test` and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): donut layout and the LaidOut union`

---

### Task 11: Bar and composed rendering (vertical and horizontal)

**Files:**

- Create: `src/render/recharts/bars.tsx` (`BarSeries`, `StackSegments`, `ValueLabels`), `src/render/primitives/{Patterns.tsx,Placeholders.tsx}`, `tests/browser/geometry-bars.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/primitives/Legend.tsx`, `src/render/verify.ts`, `src/render/pipeline.ts` (`RENDERED_MARKS` adds `bar`), `tests/browser/mount.spec.ts`, `tests/docs/docs.spec.ts` (the not-implemented case selects `min-scatter` instead of `min-bar`)

**Interfaces:**

- Consumes: Task 1 results (fallbacks H, Z, W), `LaidOutChart` (Tasks 8–9), `planIds`, `DvText`, `Marker`, `strokeStyle`, the overlay hooks (`useXAxisScale`, `useYAxisScale`, `usePlotArea`).
- Produces:
  - `chartMargin(laid)` generalised to horizontal layouts (category axis on the left, value axes bottom/top) so `usePlotArea()` still equals `laid.boxes.plot` within 0.5.
  - Horizontal charts: `ComposedChart layout="vertical"`, category `YAxis type="category" scale="band"` with `width = boxes.xAxis.width` and the `PlacedTick` renderer, value `XAxis type="number" scale="linear" allowDataOverflow` per value axis (`orientation` bottom/top).
  - Bars: one Recharts `Bar` per bar series inside `<g data-dv-mark="series:<id>:bar">`, `isAnimationActive={false}`, a `name` prop (avoids `name="undefined"`, spike observation 5), `stackId` for stack members, and a `shape` render prop returning `<g data-dv-item><path d=…/></g>` with inline fill (and `url(#pattern-id)` when patterned) and the 1-unit background boundary stroke for stack segments. Zero bars draw a zero-height path (fallback Z if the spike showed the shape is not called). Estimated bars get a dashed outline.
  - Chart-level `stackOffset` = `"sign"` for absolute and `"none"` for percent; `barCategoryGap` from `theme.spacing.barGap`, `barGap` from `theme.spacing.groupGap` × the slot width.
  - `Patterns` (`<defs>` with one `<pattern patternUnits="userSpaceOnUse">` per distinct (pattern, colour) pair; ids planned by `planIds` under keys `pattern:<kind>:<hex>`).
  - `Placeholders`: unavailable → dashed outline across the band at full plot extent plus the theme text; empty → a 1-unit baseline tick across the band at the value axis zero plus `No data (0)`. Groups `stack:<id>:unavailable` / `stack:<id>:empty`, one `data-dv-item` each.
  - Value and segment labels through the `Bar` `label` render prop (documented extension point; positions from Recharts' bar geometry) as `DvText` role `direct`, inside `<g data-dv-mark="labels:value">` / `"labels:segment"`.
  - Overlays for horizontal orientation: gridlines vertical, annotations as horizontal lines at the category band centre with their label, reference lines vertical on value axes, quality markers at the bar's value end, clip breaks (a zigzag across the bar at the plot edge, `series:<id>:clip-indicator`).
  - `CommitExpectations` carries `orientation`; the probe reports the category domain from whichever axis holds it.
  - `RENDERED_MARKS` = `line`, `bar`.

- [ ] **Step 1: Write the failing tests** in `geometry-bars.spec.ts` (harness, print theme, 680 × 320 unless stated; the oracle maps values linearly from the model domain onto `laid.boxes.plot`; rect extents normalised with `min(y, y + h)`):

```ts
test('min-bar mounts with a drawn zero bar', async ({ page }) => {
  await h(page).mount(['min-bar'], opts);
  expect(await items(page, 'series:items:bar')).toBe(2);
});
test('negative bars span zero to value', async ({ page }) => {
  /* bar-negative-values: each bar [yScale(0), yScale(v)] ±0.5; v<0 below the zero line */
});
test('grouped bars: order, band containment, missing bar absent', async ({ page }) => {
  /* bar-grouped: per category the bars are opened, closed, reopened left to right, inside band k,
     group centred on the band centre ±0.5; reopened has 3 items; o4 partial marker centre at the bar top centre ±0.5 */
});
test('absolute stack segments are contiguous; partial total labelled', async ({ page }) => {
  /* bar-stacked-categories: each segment's lower edge equals the previous upper edge ±0.5; svc-d has no crit segment;
     total labels read 36, 42, 39, 36 (partial), 6; svc-e crit segment height = |yScale(1) − yScale(0)| ±0.5 (not inflated) */
});
test('percent placeholders draw instead of segments', async ({ page }) => {
  /* bar-age-bands-percent: svc-a segment heights 25 % and 75 % of plot height ±0.5; no segment items for svc-c, svc-d;
     placeholder texts 'No data (0)' at svc-c and 'Unavailable' at svc-d; dashed outline spans the plot height at svc-d */
});
test('horizontal ranking: bars from zero, plot area, threshold', async ({ page }) => {
  /* bar-ranking-horizontal: usePlotArea equals laid.boxes.plot ±0.5; category k centred at plot.y+(k+0.5)·h/10 ±0.5;
     bar widths ∝ values ±0.5 starting at xScale(0); reference line vertical at xScale(30) with label '30-day threshold';
     overdue bars filled #a61b1b */
});
test('reference line and markers bind to their named axis', async ({ page }) => {
  /* composed-remediation-days-counts: d5 ringed marker and d6 hollow marker at the days-axis scale ±0.5; reference at days 30;
     composed-flow-cumulative: balance line vertex for −12 below the balance-axis zero, 'Break-even' at the balance zero;
     composed-revenue-margin: line points at band centres on the pct axis, 'Margin goal' at pct 20 */
});
test('clip-indicated bar draws a break marker', async ({ page }) => {
  /* inline spec fixed 0..50 clip, value 80: break at plot top ±0.5, note text rendered */
});
test('annotation and reference labels draw in interactive mode on bars (R44)', async ({ page }) => {
  /* mount composed-remediation-days-counts with staticLabels:false: 'Process change' and '30-day target' text present;
     an inline horizontal spec with an annotation draws a horizontal annotation line at its band centre */
});
test('security override patterns render as local pattern fills', async ({ page }) => {
  /* bar-severity-counts with the security override: critical/high/medium bars fill url(#…) resolving to a <pattern> in the svg; low is solid */
});
```

`mount.spec.ts` additions: `bar-all-zero` and `cartesian-empty-series` resolve (§9 readiness fixtures); hiding one bar item through a harness hook rejects `RENDER_FAILED` `mark-count-mismatch`; `min-area` still rejects `not-implemented-in-slice` (until Task 12 flips it).

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-bars.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** If the spike took fallback H, horizontal bars are DravenViz rectangles from the D8 oracle inside the same chart; record which path is live in a comment at the top of `bars.tsx`.
- [ ] **Step 4: Run** them, the whole `--project browser` suite (slice-1 line tests stay green) and `pnpm build:docs && pnpm test:docs`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): vertical, horizontal, grouped, stacked and percent bars with composed axes`

---

### Task 12: Area and preset rendering

**Files:**

- Create: `src/render/recharts/areas.tsx`, `src/render/primitives/SparklineLabels.tsx`, `tests/browser/geometry-areas.spec.ts`
- Modify: `src/render/recharts/{CartesianChart.tsx,overlays.tsx,ids.ts}`, `src/render/pipeline.ts` (`RENDERED_MARKS` adds `area`), `tests/browser/mount.spec.ts`

**Interfaces:**

- Consumes: Task 1 point 12 result (fallback A), Task 5 area and stack models, Task 9 preset layouts, the slice-1 `SeriesLines` estimated-range clip mechanism.
- Produces:
  - Unstacked areas: one Recharts `Area` per segment (own data key, like slice-1 lines), fill at the named render constant `AREA_FILL_OPACITY = 0.25` in `primitives/style.ts`, top stroke in the series dash; estimated ranges dashed through the slice-1 complementary clip paths; group `series:<id>:area` with one `data-dv-item` per segment.
  - Stacked areas: one `Area` per member with `stackId`, opaque fill and the 1-unit background boundary stroke, data `null` at every unavailable position (so all members break together); fallback A feeds `[lower, upper]` ranges without `stackId`.
  - Sparkline: no axes rendered (`XAxis`/`YAxis` with `hide`), no grid, no legend; `SparklineLabels` (`labels:sparkline`, role `direct`); `<desc>` ends with `Sparkline: axes and legend omitted`.
  - Compact-stack: value axis `hide` with domain `[0, 100]`; segment labels per Task 8 fit; legend from Task 9.
  - `RENDERED_MARKS` = `line`, `bar`, `area` (scatter stays rejected).

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
     no tick text; legend text 'Compliant — 312 services (78%)' */
});
test('annotation on an area chart draws in interactive mode (R44)', async ({ page }) => {
  /* inline area spec with annotation, staticLabels:false */
});
```

`mount.spec.ts`: `min-area`, `area-single-gaps`, `line-sparkline` (680 × 180) and `bar-compact-percent` (680 × 220) resolve.

- [ ] **Step 2: Run** `pnpm test:browser --project browser tests/browser/geometry-areas.spec.ts tests/browser/mount.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them and the whole `--project browser` suite. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): single and stacked areas, sparkline and compact-stack presets`

---

### Task 13: Donut rendering

**Files:**

- Create: `src/render/recharts/DonutChart.tsx`, `src/render/primitives/DonutParts.tsx` (track, centre, slice labels), `tests/browser/geometry-donut.spec.ts`
- Modify: `src/render/ChartView.tsx` (dispatch on `laid.model.kind`), `src/render/verify.ts` (`expectationsOf` returns no axis expectations for donut; the probe check is skipped), `src/render/pipeline.ts` (`RENDERED_KINDS` adds `donut`; `notImplemented` message becomes `… Scatter, heatmap and progress charts are added in slice 3.`), `tests/browser/mount.spec.ts` and `tests/browser/react.spec.ts` (the not-implemented cases use `min-heatmap` instead of `min-donut`)

**Interfaces:**

- Consumes: `LaidOutDonut` (Task 10), Task 1 point 13 (fallback P), `Patterns`, `Legend`, `Title`, `Notes`, `planIds`.
- Produces:
  - `DonutChart(props: { laid: LaidOutDonut; theme; renderId; namespace; family; measure }): ReactElement`: a Recharts `PieChart` of `laid.width × laid.height` with one `Pie` (`cx`, `cy`, `innerRadius`, `outerRadius` from `laid.ring`, `startAngle={90}`, `endAngle={-270}`, `paddingAngle={0}`, `minAngle={0}`, `isAnimationActive={false}`, data = slices with value > 0 in order), a `shape` render prop drawing each sector as `<g data-dv-item><path/></g>` with fill (or pattern) and `stroke = background`, `strokeWidth = theme.stroke.sliceBorder`, inside `<g data-dv-mark="slice">`. The root carries the same `data-dv-render-id`, `data-dravenviz-ns`, `data-dravenviz-chart`, `role="img"`, title and desc as Cartesian charts.
  - `DonutParts`: `donut:track` (all-zero: a full ring in `theme.color.grid`; incomplete: a dashed ring outline in `theme.color.missing`), `donut:center` (value and label `DvText`, roles `direct`), `labels:slice`.
  - `RENDERED_KINDS` = `cartesian`, `donut`; `not-implemented-in-slice` now fires only for scatter series, heatmap and progress.

- [ ] **Step 1: Write the failing tests** in `geometry-donut.spec.ts`:

```ts
test("severity donut: arcs at model angles, clockwise from 12 o'clock", async ({ page }) => {
  /* donut-severity-share: for each slice the arc's start and end points on the outer radius equal
     (cx + R·sin θ, cy − R·cos θ) for the model's startDeg/endDeg within 0.5 units; slice order clockwise;
     every sector stroke is the background colour at sliceBorder width; centre texts '249' and 'Findings' */
});
test('all-zero donut draws the neutral ring only', async ({ page }) => {
  /* donut-all-zero: donut:track 1 item, no slice group, centre '0', note rendered */
});
test('missing-slice donut draws the dashed track and no arcs', async ({ page }) => {
  /* donut-missing-slice: dashed stroke on the track, no slice group, centre 'Incomplete', legend 'Partial — Not measured' */
});
test('zero slice draws no arc but keeps its legend row', async ({ page }) => {
  /* inline donut [50,0,1,49]: 3 slice items; legend 'B — 0 (0%)'; tiny slice arc spans 3.6° ±0.5 units */
});
test('min-donut mounts; heatmap is the not-implemented example', async ({ page }) => {
  await expect(h(page).mount(['min-donut'], opts)).resolves.toHaveLength(1);
  expect(await h(page).mountError(['min-heatmap'], opts)).toMatchObject({
    code: 'RENDER_FAILED',
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

- Modify: `src/render/svg/recharts-metadata.ts` (classify the Task 1 inventory additions), `src/render/svg/normalize.ts` (only if a new element needs handling, e.g. materializing styles on `pattern` children), `tests/unit/recharts-metadata.test.ts`, `tests/unit/svg-validate.test.ts`, `tests/browser/export.spec.ts`

**Interfaces:**

- Consumes: the merged `attribute-inventory.json` (Task 1), `normalizeSvg`, `validateSvg`, `finalizeSvg`, `renderToSvg`, `renderToSvgWithAssets` (slice 1), Tasks 11–13 renderers.
- Produces: §10 guarantees for every slice-2 family; no API change.

- [ ] **Step 1: Write the failing tests.** `recharts-metadata.test.ts` already fails when the merged inventory has an unclassified pair; add `pie sector and bar shape attributes are classified` naming the new pairs. `svg-validate.test.ts`: a `<pattern>` with a `path` child and `patternUnits="userSpaceOnUse"` passes; `fill="url(#p)"` with no `<pattern id="p">` fails `svg-dangling-reference`. `export.spec.ts`:

```ts
const SLICE2 = [
  'bar-age-bands-percent',
  'bar-ranking-horizontal',
  'area-inventory-stacked',
  'donut-severity-share',
  'line-sparkline',
  'bar-compact-percent',
];
test('slice-2 charts export without renderer metadata', async ({ page }) => {
  for (const id of SLICE2) {
    const svg = await h(page).renderToSvg(id, { ...sizeOf(id), namespace: 'x' });
    expect(svg).not.toMatch(/class=|(^|\s)style="|recharts|foreignObject|<script|on[a-z]+=/i);
  }
});
test('pattern fills keep namespaced local references', async ({ page }) => {
  /* bar-severity-counts with the security override: every fill="url(#…)" resolves to a <pattern> whose id matches ^x_bar-severity-counts-\d+$ */
});
test('computed-style equivalence after standalone reload (slice 2)', async ({ page }) => {
  /* the slice-1 property list, for every id in SLICE2 */
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
- [ ] **Step 3: Implement** the classifications (each new pair as geometry or metadata per tag, never a catch-all; anything unknown still reaches strict validation and fails).
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(export): allowlist and normalization coverage for bars, areas, donut and patterns`

---

### Task 15: React interaction and tables for the new families

**Files:**

- Modify: `src/react/{interaction.ts,Chart.tsx}`, `tests/browser/react.spec.ts`, `tests/unit/react.test.ts`

**Interfaces:**

- Consumes: `LaidOut`, `navigableDatums`, `moveFocus`, `announcement`, `DatumEvent` (slice 1), `stackPositions`.
- Produces: `navigableDatums(laid: LaidOut)` covering bars (one datum per drawn bar, zero bars included, nulls and placeholders skipped), area points (as lines) and donut slices (one row; Left/Right move, Up/Down do nothing). Focus-ring positions: bar value-end centre (from the D8 oracle: band centre plus slot offset, value scaled on the bound axis), area point, donut slice mid-angle at the ring's mid-radius. Tooltip and announcement texts:
  - bar: `Findings, Critical: 12 count`;
  - percent stack member: `0–30 days, Payments: 10 items (25% of 40)` (§5.2 "tooltips always show both");
  - absolute stack member in a partial category: value plus `(total partial)`;
  - donut: `Critical: 12 findings (4.8%)`, or `Partial: Not measured` in an incomplete donut;
  - `DatumEvent` for a donut slice has no `seriesId` and `datumId` = slice id.

- [ ] **Step 1: Write the failing tests:**

```ts
test('keyboard over grouped bars skips the missing bar', async ({ page }) => {
  /* bar-grouped: within series reopened, ArrowRight moves r1 → r2 (value 0, focusable) → r4; r3 (null) is never focused (R5 navigation rules) */
});
test('percent tooltip shows value and share', async ({ page }) => {
  /* hover svc-a 0–30 segment → tooltip '0–30 days, Payments: 10 items (25% of 40)' */
});
test('donut keyboard and activation', async ({ page }) => {
  /* donut-severity-share: focus; ArrowRight ×2; Enter → onDatumActivate({ datumId: 'high', source: 'keyboard' }) with no seriesId;
     live region 'High: 31 findings (12.4%)' */
});
test('DataTable renders share columns', async ({ page }) => {
  /* <DataTable spec=bar-age-bands-percent> has 8 header cells and 'Unavailable' in row 4 */
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

- Modify: `examples/dravenpdf/run_pdf_check.py` (`--report <id>`, default `report-slice1`), `examples/dravenpdf/bundle/{bootstrap.js,index.html}`, `examples/dravenpdf/test_driver.py`, `scripts/test-pdf.ts` (runs `report-slice1` then `report-slice2` against one warm server), `tests/pdf/compare.ts` (per-instance size), `tests/unit/pdf-prerequisites.test.ts`
- Create (evidence): `evidence/pdf/report-slice2.pdf`, `evidence/pdf/report-slice2.json`, `evidence/pdf/pages/report-slice2/page-*.png`, `evidence/pdf/crops/<namespace>.png` for the 19 slice-2 namespaces

**Interfaces:**

- Consumes: `report-slice2` and the catalog `size`/`themeOverride` fields (Task 3), the packed tarball, `asset-manifest.json`, the proven frame-discovery method recorded in `docs/plans/slice-1-pdf-probe-results.md` (`link-dest`, Ruling R35), `tests/visual/tolerances.json` (`crossPdfBrowser`).
- Produces:
  - `charts.json` entries `{ spec, namespace, width, height, themeOverrides? }`. `bootstrap.js` groups entries by (width, height, themeOverrides), calls `mountCharts` once per group (each with `fit: "width"`, `theme: "print"`, its namespaces), awaits every handle, renders the tables, then sets `window.__DRAVENPDF_READY__ = true`; any rejection stays an uncaught page error.
  - Evidence layout: `report-slice1` paths are unchanged; `report-slice2` writes its PDF and JSON beside them, pages under `pages/report-slice2/`, and crops under `crops/<namespace>.png` (namespaces are disjoint, Task 3 test).
  - Checks for `report-slice2` (in addition to every slice-1 check, which runs per report):
    - A4, ≥ 1 page; every instance found exactly once by `link-dest`; each frame 178 mm wide (±0.5 mm) with the aspect ratio of its own size (680 : 320, 680 : 220 or 680 : 180, ±0.5 %).
    - Text layer: each title appears instances × 2 times (`Findings by severity` 4 times); extra text `Unavailable`, `No data (0)`, `Incomplete`, `No items (total 0)`, `Sparkline: axes and legend omitted`, `Margin goal`, `30-day target`, `Break-even`, `30-day threshold`, `Capacity`, `Not measured`, `Process change`; every match inside its frame or table.
    - Logical labels, effective font sizes by role (title 12–14 pt; tick, axis-title, legend, annotation, reference, direct ≥ 9 pt; note, caption ≥ 8 pt; −0.05 pt tolerance; ±0.15 pt against `ReadyInfo.effectivePt`) and oriented-quad clipping/overlap checks, exactly as slice 1.
    - Cross-path crop comparison against the browser print render at the same size, at the calibrated `crossPdfBrowser` tolerance.
  - **Ruling on the tolerance (pre-flight finding 16↔17):** `crossPdfBrowser` was calibrated on line charts only. If a slice-2 crop exceeds it, the run records the instance, its ratio and an investigation in `tests/visual/MISMATCHES.md`. A displaced mark, missing label or clipping is a defect fixed here. An antialiasing-only difference is input to Task 17's recalibration (max + 0.1 pp over 10 pairs, capped at 1 %). Task 16 is complete when every other check passes and each over-tolerance crop is recorded as calibration-pending with that investigation; Task 17 re-runs `pnpm test:pdf`, which must then pass outright. Nothing is ever masked.

- [ ] **Step 1: Write the failing checks** in `run_pdf_check.py` (report-parametrised) and `test_driver.py` (`groups entries by size and override`, `aspect checked per instance`, `report-slice2 namespaces disjoint from report-slice1`); keep `missing font fails the PDF render` (504 `render_timeout`, R36) running once.
- [ ] **Step 2: Run** `pnpm test:pdf`. Expected: FAIL (no `report-slice2` bundle).
- [ ] **Step 3: Implement** the driver, bootstrap and compare changes.
- [ ] **Step 4: Run** `pnpm test:pdf`. Expected: `PASS` for both reports (or the recorded calibration-pending state above), or `UNVERIFIED` with exit code 3 if a prerequisite is missing. Inspect every page render at 100 % and in grayscale for clipped text, overlaps, missing glyphs, unreadable patterns and unintended chart splits, and record the inspection in `evidence/pdf/report-slice2.json` (`review` field).
- [ ] **Step 5: Commit** the example changes and evidence. `feat(pdf): report-slice2 with bars, areas, composed charts, donuts and presets`

---

### Task 17: Visual candidates and recalibration (owner gate D4)

**Files:**

- Modify: `tests/visual/{candidates.ts,generate.ts,visual.spec.ts,calibrate.ts,REVIEW.md,MISMATCHES.md,tolerances.json}`
- Create: `tests/visual/baselines/candidates/<id>.png` for the slice-2 candidates

**Interfaces:**

- Consumes: the slice-1 generator and review-page flow (`pnpm visual:candidates` → `evidence/visual/index.html`), `pnpm visual:calibrate`, Task 16 crops, the catalog `size`/`themeOverride`.
- Produces:
  - `Candidate` gains `width` and `height` (from the fixture's catalog `size`, default 680 × 320) and applies the fixture's `themeOverride`.
  - 28 slice-2 candidates: `bar-severity-counts@{light,dark,print}`, `bar-ranking-horizontal@print`, `bar-stacked-categories@print`, `bar-age-bands-percent@{light,print}`, `bar-compact-percent@print`, `bar-grouped@print`, `bar-negative-values@print`, `bar-long-labels@print`, `bar-all-zero@print`, `cartesian-empty-series@print`, `area-inventory-stacked@{light,print}`, `area-single-gaps@print`, `composed-revenue-margin@{light,dark,print}`, `composed-remediation-days-counts@print`, `composed-flow-cumulative@print`, `donut-severity-share@{light,dark,print}`, `donut-all-zero@print`, `donut-missing-slice@print`, `line-sparkline@{light,print}`.
  - The review page shows, per candidate, the browser render, the standalone SVG, the PDF crop (from `report-slice1` or `report-slice2`, whichever holds the fixture) and the data table, plus a grayscale rendering of each print candidate (spec "Review the A4 result … in grayscale"). Items to flag for the owner: pattern density on slots 4–7 and the security roles, the 0.25 % compact segment, percent placeholders, donut centre sizing, sparkline proportions.
  - Recalibration over slice 1 + slice 2 with the §16.2 rules; `tolerances.json` is rewritten only by `visual:calibrate`. The 14 approved slice-1 baselines are untouched.
- Visual baselines stay `pending owner review` until the owner approves them in the PR; the generator never writes `baselines/approved/` (D4, R6). CI's `visual` step stays red for pending candidates (R41).

- [ ] **Step 1: Write** the candidate list and structural assertions in `visual.spec.ts` for the new families (manifest mark counts, domain labels, segment and slice counts, annotation position ±0.5).
- [ ] **Step 2: Run** `pnpm visual:calibrate && pnpm exec playwright test --project=visual`. Expected: FAIL with `pending owner review` for each slice-2 candidate; slice-1 baselines still pass.
- [ ] **Step 3: Generate** the candidates with `pnpm visual:candidates`, fill `REVIEW.md` (`pending`), publish the review page for the owner with the same flow as slice 1, and re-run `pnpm test:pdf` at the recalibrated tolerance (it must pass; resolve any Task 16 calibration-pending entries in `MISMATCHES.md`).
- [ ] **Step 4: Owner review gate.** Approved PNGs move to `baselines/approved/` in a commit citing the review, with SHA-256 checked against the reviewed images. Re-run: PASS.
- [ ] **Step 5: Commit** the candidates and records. `test(visual): slice-2 reference candidates and recalibrated tolerances`

---

### Task 18: Docs playground for slice-2 fixtures

**Files:**

- Modify: `docs/site/src/{fixtures.ts,components/PdfSample.tsx,routes/Playground.tsx}`, `scripts/stage-consumer.ts` (copies `report-slice2.pdf/.json`, checks their spec hashes like slice 1), `tests/docs/docs.spec.ts`

**Interfaces:**

- Consumes: the packed tarball, `FIXTURES`, `evidence/pdf/report-slice{1,2}.json`.
- Produces: the fixture selector lists `gallery: true` fixtures of slices 1 and 2 at their catalog size, plus the `min-*` fixtures of slice-3 kinds (`min-scatter`, `min-heatmap`, `min-progress`), which still show `not-implemented-in-slice`. Selecting a fixture also sets the width and height inputs to its catalog size and applies its `themeOverride` (shown as "Theme override: security"). The PDF sample link points to whichever report holds the fixture, with its spec hash, labelled "Original fixture sample" when edited.

- [ ] **Step 1: Write the failing tests:**

```ts
test('slice-2 fixtures are selectable and render', async ({ page }) => {
  /* options include bar-age-bands-percent, donut-severity-share, line-sparkline; selecting each renders an svg with its <title>;
     line-sparkline sets Height to 180 */
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
- [ ] **Step 5: Commit.** `feat(docs): playground renders slice-2 fixtures with their PDF samples`

---

### Task 19: Measurements, verification matrix and slice close-out

**Files:**

- Modify: `scripts/measure-size.ts` (SVG bytes for every slice-2 `static` fixture; `report-slice2` PDF bytes and pages), `evidence/perf/{size.json,latency.json,README.md}`, `docs/design.md` §18 (slice-2 measured column; budgets unchanged unless the owner rules), `evidence/verification-matrix.md`, `tests/unit/matrix.test.ts`, `CHANGELOG.md`, `docs/plans/handover/slice-1-ledger.md` (slice-2 section) or a new `docs/plans/handover/slice-2-ledger.md`
- CI: `.github/workflows/ci.yml` keeps its job shape (`install`, `lint-typecheck`, `unit`, `browser` with the separate `visual` step, `package`, `docs`, `pdf`); no job is added or removed.

**Interfaces:**

- Consumes: every earlier task's evidence.
- Produces:
  - Size: browser bundle raw and gzip, ESM entries, fonts, SVG bytes per slice-2 reference fixture (both font modes), `report-slice2` PDF bytes and page count, each compared with the §18.1 budget. An item over budget gets an investigation and a recorded resolution in `evidence/perf/README.md` before performance acceptance; budgets are not raised to absorb it.
  - Latency: P1 (`perf-line-500x4`), P2 and P4 (`report-slice1`) re-measured with the slice-1 method, unchanged in definition. **Decision:** no bar/area perf scenario is added, because design §18 defines none for slice 2 (P3 `report-multi-family-a4` is slice 3). P1 p95 must stay ≤ 250 ms (R7 if not).
  - Matrix rows (`fixtures`, command, artifacts, status): `SPEC-2` (`bar-severity-counts`, `donut-severity-share`), `SPEC-3` (`composed-revenue-margin`), `SPEC-4` (`bar-age-bands-percent`), `SPEC-7-S2` (`bar-long-labels`, `bar-negative-values`, `bar-all-zero`, `donut-all-zero`, `donut-missing-slice`, `cartesian-empty-series`), `SPEC-10` (`composed-remediation-days-counts`, `composed-flow-cumulative`), `SPEC-11` (`bar-ranking-horizontal`, `bar-stacked-categories`, `bar-compact-percent`), `ROW-OPEN-ITEM-TRENDS` extended (`area-inventory-stacked`, `area-single-gaps`, `line-sparkline`), `ROW-COUNTS`, `ROW-COMPOSITION`, `ROW-COMPOSED`, `ROW-DISTRIBUTIONS`, `VISUAL-REFS-2` (`pending-review` until the owner approves), `PDF-SLICE2`, and one `GC-` row per slice-2 global constraint (`GC-15`…`GC-23`, nine rows).

- [ ] **Step 1: Write** `matrix.test.ts` additions: every new row's fixtures exist in `FIXTURES` and artifacts exist; no row claims `pass` for PDF when `evidence/pdf/report-slice2.json` has `result != "pass"`; `VISUAL-REFS-2` is `pass` only when every slice-2 candidate's REVIEW decision is approved.
- [ ] **Step 2: Run** `pnpm test:matrix && pnpm check:matrix`. Expected: FAIL.
- [ ] **Step 3: Run** `pnpm measure`, write the matrix from actual outcomes, update §18 and the CHANGELOG (Unreleased: slice-2 families), and write the slice-2 ledger section (rulings R47+, outcomes, deferred minors).
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm check:drift && pnpm test && pnpm test:perf && pnpm test:matrix && pnpm check:matrix && pnpm test:browser && pnpm test:dist && pnpm test:package && pnpm build:docs && pnpm test:docs && pnpm test:pdf`, and record each real outcome in the matrix's "Step 4 runs" table.
- [ ] **Step 5: Commit.** `ci: slice-2 measurements and verification matrix`

---

## Pre-flight scan

Pairs of tasks that share a file or interface, then each task's own consistency. Findings marked **ruling** are decided here and bind the briefs.

| Tasks                             | Shared file / interface                                                                                                                                   | Finding                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1→11, 12, 13                      | spike fallbacks H, Z, W, A, P → renderers                                                                                                                 | consistent: each renderer task names the fallback it takes and records the live path                                                                                                                             |
| 1→14                              | merged `attribute-inventory.json` → `recharts-metadata.ts`                                                                                                | consistent: existing keys stay byte-identical; the test reads the merged file                                                                                                                                    |
| 2→3                               | schema category cap removed → fixtures                                                                                                                    | consistent: no slice-2 fixture exceeds 250 categories (Task 3 test)                                                                                                                                              |
| 2→4, 5, 6, 11, 13                 | fill policy (slots 4–7, role pattern, boundary strokes) → `style.pattern` → `Patterns`                                                                    | consistent: precedence datum role > series role > slot is stated once (Task 2) and reused                                                                                                                        |
| 3→4…18                            | fixture ids and values                                                                                                                                    | arithmetic checked: stacked totals 36/42/39/36/6; percent shares 25/75/0 and 16/48/36; compact 78/17.75/4/0.25 of 400; donut total 249 with shares 4.8/12.4/33.7/49 %; min-area totals 15/18                     |
| 3→7                               | Task 7 expects row-header columns `Quarter` and `Service`; the slice-1 table uses the x `label`, else the capitalised axis id                             | gap found while drafting → **ruling:** Task 3 gives those two fixtures x labels `Quarter` and `Service`; Task 7 keeps the slice-1 header rule unchanged                                                          |
| 3→16, 17, 18                      | catalog `size` / `themeOverride` → bootstrap groups, candidate size, playground size                                                                      | consistent: one source (the catalog); report entries carry only fixture and namespace                                                                                                                            |
| 4→5                               | `SeriesModel` union, `CartesianModel` new fields                                                                                                          | consistent: Task 4 ships a two-member union; Task 5 adds `AreaSeriesModel`                                                                                                                                       |
| 4→8, 11, 15                       | slice-1 code assuming every series is a line                                                                                                              | finding → **ruling:** Task 4 narrows overlays, ids, Legend and interaction with `s.mark === 'line'` (no behaviour change) so every intermediate commit typechecks                                                |
| 4, 5, 6→pipeline guard→11, 12, 13 | `RENDERED_MARKS` / `RENDERED_KINDS`                                                                                                                       | consistent: the model stops reporting unsupported early, and the guard keeps unrendered families rejected until their renderer task flips them                                                                   |
| 5→7, 15                           | stack arithmetic needed by the model, the table and tooltips                                                                                              | finding: `core/table` cannot import `render/model` (§2) → **ruling:** `src/core/shares/index.ts` (`stackPositions`, `donutShares`) is the single DOM-free source, imported by path and not exported publicly     |
| 5→8                               | `ValueLabelModel` texts → `PlacedValueLabel` fit                                                                                                          | consistent: the model owns text, layout owns fit and gutters                                                                                                                                                     |
| 6→10→13                           | `DonutModel` → `LaidOutDonut` → `DonutChart`                                                                                                              | consistent: angles are compass degrees clockwise from 12 o'clock; the adapter maps them to Recharts `startAngle=90`/`endAngle=-270`                                                                              |
| 7→15                              | `DataTable` share columns → React `DataTable`, print `renderDataTable`                                                                                    | consistent: both render the table model unchanged                                                                                                                                                                |
| 8→9                               | `pass()` allocation; preset dispatch                                                                                                                      | consistent: presets reuse the Task 8 helpers inside `layoutChart`                                                                                                                                                |
| 8, 9, 10→pipeline                 | `verifyAndReport` reads `laid.manifest`                                                                                                                   | consistent: Task 8 switches it; Tasks 9 and 10 add label groups to `laid.manifest`                                                                                                                               |
| 8→11                              | `chartMargin` assumes left/right y axes and a bottom x axis                                                                                               | finding → owned by Task 11 (generalised for horizontal layouts)                                                                                                                                                  |
| 10→11, 12, 13, 15                 | `LaidOut` union vs `LaidOutChart`                                                                                                                         | **ruling:** `LaidOutChart` keeps its slice-1 Cartesian meaning; `LaidOut` is the union, so slice-1 renderer code does not churn                                                                                  |
| 11→14                             | bar `shape` items, pattern ids via `planIds`                                                                                                              | consistent: pattern ids are namespaced `<ns>_<chartId>-<n>` and renamed by finalize                                                                                                                              |
| 11, 12, 13→15                     | focus-ring geometry                                                                                                                                       | consistent: interaction uses the D8 oracle (band, slot, scaled value), never Recharts DOM                                                                                                                        |
| 11 / 13 → slice-1 tests           | `docs.spec` uses `min-bar`, `mount.spec` and `react.spec` use `min-donut`, `model-line`/`table` tests use `min-bar`/`min-area`/`min-donut` as unsupported | each flip is owned: Task 4 (`min-bar` model), Task 5 (`min-area` model), Task 6 (`min-donut` model), Task 7 (table), Task 11 (`docs.spec` → `min-scatter`), Task 13 (`mount.spec`, `react.spec` → `min-heatmap`) |
| 14→16                             | export path vs PDF compare                                                                                                                                | consistent: `tests/pdf/compare.ts` compares against the browser render, not the SVG                                                                                                                              |
| 16↔17                             | cross-path tolerance calibrated on lines; recalibration needs slice-2 PDF crops                                                                           | circular → **ruling** in Task 16: over-tolerance crops are recorded calibration-pending with an investigation; Task 17 recalibrates and re-runs `test:pdf`, which must pass outright                             |
| 16→18                             | `evidence/pdf/report-slice2.json` → staged docs PDF links                                                                                                 | consistent: stage checks spec hashes as in slice 1                                                                                                                                                               |
| 17→19                             | REVIEW decisions → `VISUAL-REFS-2` status                                                                                                                 | consistent: `pending-review` until the owner approves (D4)                                                                                                                                                       |
| 1 self                            | spike points numbered 7–16 continue slice-1 points 1–6; observation points 11/13 are not gates                                                            | consistent                                                                                                                                                                                                       |
| 2 self                            | removing `maxItems` vs keeping a limit path                                                                                                               | consistent: `bar-categories` semantic limit unchanged; `LIMIT_PATHS` entries removed with the schema caps                                                                                                        |
| 3 self                            | 19 catalog ids vs 19 report instances                                                                                                                     | consistent: 18 distinct fixtures in the report (two instances of `bar-severity-counts`); `cartesian-empty-series` is test-only and not in the report                                                             |
| 4 self                            | include-zero default only for axes carrying bars                                                                                                          | consistent: line-only axes keep `fit`, so slice-1 domains are unchanged                                                                                                                                          |
| 5 self                            | percent axis `unit: "% of total"` set by the model                                                                                                        | consistent: validation already forbids a caller unit there (`percent-axis-configured`)                                                                                                                           |
| 6 self                            | legend `B — 0 (0%)` vs `shareText` with one fraction digit                                                                                                | consistent: `formatNumber(0, percent, max 1)` is `0%`                                                                                                                                                            |
| 7 self                            | absolute-stack total column only when totals are requested                                                                                                | consistent with "never silently aggregate"; percent stacks always have it (§5.2)                                                                                                                                 |
| 8 self                            | horizontal labels wrap to 3 lines; vertical labels wrap to 2 then rotate                                                                                  | intended difference (horizontal has no rotate stage), stated in the rule                                                                                                                                         |
| 9 self                            | sparkline 168.25 ≤ 180 and compact 195.5 ≤ 220 at fontScale 1                                                                                             | arithmetic checked                                                                                                                                                                                               |
| 9 self                            | legend text `1 services`                                                                                                                                  | intended: units are verbatim, stated under the tests                                                                                                                                                             |
| 10 self                           | `innerRadius = 0.6 × outerRadius`; centre fit `2 × inner × 0.9`                                                                                           | consistent                                                                                                                                                                                                       |
| 11 self                           | files created (`bars.tsx`, `Patterns.tsx`, `Placeholders.tsx`, `geometry-bars.spec.ts`) vs touched (`docs.spec.ts`, `mount.spec.ts`)                      | consistent                                                                                                                                                                                                       |
| 12 self                           | `AREA_FILL_OPACITY` is a named render constant, not a theme token                                                                                         | **ruling:** no `Theme` shape change in slice 2 (the theme freeze is a slice-4 item); the constant is documented in §7                                                                                            |
| 13 self                           | `react.spec` and `mount.spec` not-implemented cases move to `min-heatmap`                                                                                 | consistent                                                                                                                                                                                                       |
| 14 self                           | six representative fixtures cover every new element (rect/path bars, area paths, pie sectors, patterns, hidden axes)                                      | consistent                                                                                                                                                                                                       |
| 15 self                           | tooltip strings match §5.2 ("Open: 10 items (25% of 40)")                                                                                                 | consistent                                                                                                                                                                                                       |
| 16 self                           | evidence paths: slice-1 unchanged, slice-2 pages in a subdirectory, crops shared by disjoint namespaces                                                   | consistent (Task 3 test enforces disjointness)                                                                                                                                                                   |
| 17 self                           | 28 candidates: 3+1+1+2+1+1+1+1+1+1+2+1+3+1+1+3+1+1+2                                                                                                      | arithmetic checked                                                                                                                                                                                               |
| 18 self                           | selector rule `gallery && slice ≤ 2` plus slice-3 `min-*`                                                                                                 | consistent                                                                                                                                                                                                       |
| 19 self                           | CI job shape unchanged; matrix rows reference only catalogued fixtures                                                                                    | consistent                                                                                                                                                                                                       |

## Out of scope (later slices)

- **Slice 3:** scatter/bubble (including size outside `bubble.domain`), heatmap, progress bar and ring, static scatter label collision handling (the `StaticLabelPlacer` seam), annotation `x2 < x` and overlapping annotation labels, inline marker geometry (`r` set inline so host `circle{r}` CSS cannot change it), the multi-family A4 report and P3.
- **Slice 4:** the consumer TypeScript 5.4/6.0 declaration check (R40), the `Theme` shape freeze (legend quality strings), the narrow-width title cap (R24), making the cross-mode tolerances (`samePdf`, `crossSvgBrowser`) gate tests, the docs gallery/API/styling/export/testing pages, and P4 for `report-multi-family-a4`.

## Slice-2 exit criteria

- The Task 1 spike passed, or its fallbacks were applied and recorded in design §4 (R2).
- Every slice-2 family renders through React, `mountCharts`, standalone SVG, the docs playground and a real DravenPDF PDF from the packed tarball; `not-implemented-in-slice` fires only for scatter, heatmap and progress.
- All scripts in Task 19 Step 4 have actual recorded outcomes; nothing is reported as passing without a run.
- `test:pdf` reports `pass` for `report-slice1` and `report-slice2`. `UNVERIFIED` (exit 3) or `fail` leaves slice 2 incomplete and is reported as such.
- Slice-2 visual candidates are `approved` by the owner (`pending-review` keeps the slice open; never self-approved).
- P1 p95 ≤ 250 ms; size items within the §18.1 budgets or investigated with a recorded resolution.
- The slice-3 plan is written next, against design §21, reusing the interfaces produced here.
