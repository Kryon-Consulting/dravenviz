# Slice 1: multi-line vertical slice — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove one multi-line chart end to end through a single renderer: React, plain HTML, standalone SVG, a real DravenPDF PDF and the docs playground. The contract for every chart family is fixed now, even though only line charts render in this slice.

**Architecture:** The chart JSON flows through `validateSpec` → `buildModel` → `layoutChart` → a React SVG tree (Recharts `ComposedChart` for the line marks, plus DravenViz overlays that use Recharts' public scale hooks). From that tree it is either mounted (React, `mountCharts`) or exported (normalize → strict validate → finalize). Every consumer — docs, examples, PDF bundle, clean-consumer tests — uses the packed tarball.

**Tech Stack:** TypeScript 6.0, pnpm 10.33.0, Node 22.22, React 19.3.0 (with react-is 19.3.0), Recharts 3.10.1, Ajv 8 (standalone), tsup, esbuild, Vitest 5, Playwright 1.56.1 (Chromium 141.0.7390.37, revision 1194), Vite 8, CodeMirror 6. The PDF side uses Python 3.12, uv, DravenPDF `7a249e0` and Noto Sans v2.015.

**Spec:** `docs/spec.md` (product brief) and `docs/design.md` (revision 2, the contract). Section references below (§n) point to `docs/design.md`.

## Global Constraints

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

## Review Focus

These five situations are implied by the spec but not covered by any single task's main flow. Each has a test in its owning task.

1. **A host hidden in a collapsed tab** (`display: none` ancestor) when `mountCharts` runs. Expect `ready` to reject with `ZERO_SIZE`, leave no blank SVG and no mounted root. Owned by Task 12 (`rejects ZERO_SIZE for hidden ancestor`).
2. **Two `mountCharts` calls on one page reusing the default namespace for the same fixture.** Expect the second call to reject with `INVALID_OPTIONS` (`duplicate-chart-embedding`) and the first to stay intact. Owned by Task 12 (`second batch with same embedding identity is rejected`).
3. **A font file 404 inside the DravenPDF bundle.** Expect the bootstrap to throw an uncaught error, never set the ready flag, and DravenPDF to answer 422 `render_incomplete`. `test:pdf` asserts that failure, not a PDF. Owned by Task 16 (`missing font fails the PDF render`).
4. **A React spec change while fonts from the previous render are still loading.** Expect `onReady` exactly once, for the newest `renderId`, and the DOM to show the newest spec. Owned by Task 14 (`stale font completion does not fire onReady`).
5. **The machine timezone differs from the render timezone** (the test process runs with `TZ=America/New_York`, render `timezone: "Asia/Tokyo"`). Expect date-time ticks formatted in Tokyo time, and date-only ticks unchanged from the UTC run. Owned by Task 6 (`machine TZ never leaks`).

---

## File structure (created in this slice)

```text
package.json  pnpm-lock.yaml  .nvmrc  .gitignore  .npmrc
tsconfig.base.json  tsconfig.json  tsconfig.core.json  tsconfig.build.json
eslint.config.js  prettier.config.js  vitest.config.ts  playwright.config.ts  tsup.config.ts
.github/workflows/ci.yml
spikes/recharts-3.10/            throwaway spike (kept for reproducibility, excluded from pack)
scripts/  fetch-font.ts gen-types.ts gen-validator.ts check-drift.ts build-browser.ts
          build-manifest.ts stage-consumer.ts measure-size.ts measure-latency.ts gen-fixtures.ts
schema/viz-spec-v1.schema.json
assets/fonts/  NotoSans-Regular.woff2 NotoSans-SemiBold.woff2 noto-sans.css OFL.txt PROVENANCE.md
src/core/      errors.ts index.ts version.ts
               spec/{types.gen.ts,index.ts}
               validate/{ajv.gen.js,ajv.gen.d.ts,index.ts,semantic/*.ts,limits.ts,issues.ts}
               format/{number.ts,time.ts}
               theme/{tokens.ts,light.ts,dark.ts,print.ts,resolve.ts,index.ts}
               table/index.ts
src/render/    model/{types.ts,index.ts,cartesian.ts,scale.ts,ticks.ts,segments.ts,manifest.ts}
               layout/{types.ts,index.ts,measure.ts,canvas-measure.ts,noto-metrics.gen.ts,labels.ts,print-scale.ts}
               fonts/{registry.ts,load.ts}
               recharts/{CartesianChart.tsx,overlays.tsx}
               primitives/{Title.tsx,Legend.tsx,Notes.tsx,Marker.tsx,EmptyState.tsx}
               svg/{normalize.ts,validate.ts,finalize.ts,recharts-metadata.ts,ids.ts}
               ChartView.tsx verify.ts render-id.ts
src/react/     Chart.tsx DataTable.tsx interaction.ts index.ts
src/print/     mount.ts export.ts table-dom.ts lifecycle.ts index.ts
src/browser/   index.ts
src/styles/    dravenviz.css
fixtures/valid/*.json  fixtures/invalid/*.json(+.expected.json)  fixtures/reports/report-slice1.json
fixtures/index.ts
examples/html/{basic.html,host-isolation.html,README.md}
examples/react/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,src/main.tsx}
examples/dravenpdf/{pyproject.toml,uv.lock,client.py,library_fallback.py,run_pdf_check.py,
                    bundle/{index.html,bootstrap.js,report.css},README.md}
docs/site/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,src/**}
tests/unit/**  tests/browser/**  tests/harness/**  tests/visual/{REVIEW.md,MISMATCHES.md,baselines/}
tests/package/**  tests/consumers/{react18,react19,core}/
tests/assets/fonts/NotoSerif-{Regular,SemiBold}.woff2 (+ OFL, PROVENANCE)
evidence/{verification-matrix.md,svg/,pdf/,perf/,screenshots/}
```

In slice 1 the renderer supports `kind: "cartesian"` with only `mark: "line"` series. Every other kind or mark validates, but mounting it rejects with `RENDER_FAILED` (rule `not-implemented-in-slice`). The error message names the slice that adds it. This rule is removed as slices 2 and 3 land.

---

### Task 1: Recharts 3.10.1 spike (throwaway, proof gate)

**Files:**
- Create: `spikes/recharts-3.10/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,src/cases.tsx,src/export-probe.ts,run.spec.ts,playwright.config.ts}`
- Create: `docs/plans/slice-1-spike-results.md`
- Create (candidate): `spikes/recharts-3.10/attribute-inventory.json`

**Interfaces:**
- Produces: the pass/fail result for each of the five §4 spike points plus the host-style isolation check (test 6), and the attribute inventory that Task 13 turns into `render/svg/recharts-metadata.ts`.

- [ ] **Step 1: Write the spike checks as Playwright tests** in `spikes/recharts-3.10/run.spec.ts`, one test per §4 point, against the page cases in `src/cases.tsx`:

```ts
test('1 overlay children render inside surface and align with marks', async ({ page }) => {
  await page.goto('/?case=overlay');
  const r = await page.evaluate(() => (window as any).probe.overlayAlignment());
  expect(r.overlayInsideSurface).toBe(true);
  expect(r.maxDeltaUnits).toBeLessThanOrEqual(0.5);   // hook-scaled circle vs Line dot centres
  expect(r.lineOnlyBandCentres).toBe(true);            // explicit scale="band": centre k at (k+0.5)·w/n
  expect(r.plotAreaMatchesLayoutBox).toBe(true);       // usePlotArea() == margins + explicit axis sizes
});
test('2 grouped bars side by side; stackId bars/areas share band', async ({ page }) => {
  await page.goto('/?case=stacks');
  const r = await page.evaluate(() => (window as any).probe.stacks());
  expect(r.groupedDistinctX).toBe(true);
  expect(r.stackedSameX).toBe(true);                   // same x and width per category
  expect(r.signOffsetNegativeBelowZero).toBe(true);
  expect(r.areaStackTopEqualsSum).toBe(true);
});
test('3 null members create gaps', async ({ page }) => {
  await page.goto('/?case=nulls');
  const r = await page.evaluate(() => (window as any).probe.nulls());
  expect(r.lineSegments).toBe(2);                      // [12,null,18,20] -> 2 path moves
  expect(r.barForNull).toBe('absent');                 // no rect, not a 0-height rect
  expect(r.stackedAreaBreak).toBe(true);
});
test('4 first commit has final geometry with animation off', async ({ page }) => {
  await page.goto('/?case=noanim');
  const r = await page.evaluate(() => (window as any).probe.firstCommitStable());
  expect(r.pathAfterCommit).toBe(r.pathAfter500ms);
});
test('6 inline style props resist host CSS', async ({ page }) => {
  await page.goto('/?case=hostcss');                   // host: text{fill:red} path{stroke-width:5} *{font-family:serif}
  const r = await page.evaluate(() => (window as any).probe.hostCss());
  expect(r.componentsForwardingStyle).toEqual(expect.arrayContaining(['Line', 'XAxis.tick', 'YAxis.tick']));
  expect(r.textFillsUnchanged && r.lineStrokeWidthsUnchanged && r.fontFamilyUnchanged).toBe(true);
});
test('5 real chart survives normalize + strict allowlist', async ({ page }) => {
  await page.goto('/?case=export');
  const r = await page.evaluate(() => (window as any).probe.exportProbe());
  expect(r.disallowedAfterNormalize).toEqual([]);
  expect(r.svg).not.toMatch(/class=|style=|recharts/);
});
```

- [ ] **Step 2: Run the spike.** `pnpm --dir spikes/recharts-3.10 install --ignore-workspace && pnpm --dir spikes/recharts-3.10 exec playwright test`. Expected: every test reports pass or fail. A failure here is a result, not a bug to hide.
- [ ] **Step 3: Implement the probes.**
  - `probe.*` in `src/cases.tsx` and `src/export-probe.ts` read geometry from the DOM for the checks only; the product code never does this.
  - `export-probe.ts` is a first cut of the §10 normalize and validate steps.
  - It writes `attribute-inventory.json`: every element name and attribute name seen per Recharts component, each classified `presentation | geometry | metadata`.
- [ ] **Step 4: Record the results** in `docs/plans/slice-1-spike-results.md`: the pass/fail table, measured deltas and the inventory summary. If any point fails, apply the matching §4 fallback: update `docs/design.md` §4, then stop and ask the owner before Task 10.
- [ ] **Step 5: Commit.** `git add spikes docs/plans/slice-1-spike-results.md && git commit -m "spike: verify Recharts 3.10.1 overlays, stacks, gaps and export"`

---

### Task 2: Repository and toolchain bootstrap

**Files:**
- Create: `package.json`, `.nvmrc` (`22.22`), `.npmrc` (`engine-strict=true`), `.gitignore` (`node_modules dist .pack .stage coverage test-results playwright-report`), `tsconfig.base.json`, `tsconfig.json`, `tsconfig.core.json` (`lib: ["ES2022"]`, no DOM, includes `src/core`), `tsconfig.build.json`, `eslint.config.js`, `prettier.config.js`, `vitest.config.ts`, `playwright.config.ts`
- Create: `.github/workflows/ci.yml` (jobs `install`, `lint-typecheck`, `unit`; the other jobs are added by later tasks)
- Test: `tests/unit/boundaries.test.ts`

**Interfaces:**
- Produces:
  - Scripts `build`, `typecheck`, `lint`, `test`, `test:browser`, `check:drift`. Placeholders fail loudly with `not implemented until Task N` until their task lands.
  - `packageManager: "pnpm@10.33.0"`.
  - The `exports` map exactly as in §3.
  - Dev dependencies pinned exactly: `recharts@3.10.1` (a runtime dependency), `react@19.3.0`, `react-dom@19.3.0`, `react-is@19.3.0`, `typescript@6.0.3`, `@playwright/test@1.56.1`, `vitest@5.0.3`, `ajv@8.20.0`, `json-schema-to-typescript@16.0.0`, `tsup@8.5.1`, `esbuild` (tsup's), `pixelmatch`, `pngjs`, `publint`, `@arethetypeswrong/cli`.
  - `playwright.config.ts` sets `use.launchOptions.executablePath` from `PW_CHROMIUM_PATH` when that is set; otherwise it uses the Playwright-managed revision 1194.

- [ ] **Step 1: Write the failing test** `tests/unit/boundaries.test.ts`:

```ts
test('core imports no DOM/React/Recharts', () => {
  const offenders = scanImports('src/core', [/^react/, /^recharts/, /src\/(render|react|print)/]);
  expect(offenders).toEqual([]);
});
test('recharts only under src/render/recharts', () => {
  expect(filesImporting('src', 'recharts').every(f => f.startsWith('src/render/recharts/'))).toBe(true);
});
test('no eval / Function / innerHTML in src', () => {
  expect(grep('src', /\beval\(|new Function\(|\.innerHTML\s*=/)).toEqual([]);
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run tests/unit/boundaries.test.ts`. Expected: FAIL, because `scanImports` isn't defined.
- [ ] **Step 3: Implement the helpers** `scanImports`, `filesImporting` and `grep` in `tests/unit/helpers/fs-scan.ts`, using `fs` and a regex over `import … from '…'` / `import('…')`. Configure ESLint `no-restricted-imports` with the same rules, plus `no-restricted-properties` for `innerHTML`.
- [ ] **Step 4: Run** `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm vitest run tests/unit/boundaries.test.ts`. Expected: PASS (the scans find no source files yet and return empty lists).
- [ ] **Step 5: Commit.** `chore: bootstrap pnpm/TypeScript toolchain and boundary checks`

---

### Task 3: Pinned fonts and Node text metrics

**Files:**
- Create: `scripts/fetch-font.ts`, `assets/fonts/*`, `src/render/layout/noto-metrics.gen.ts`, `tests/assets/fonts/NotoSerif-*.woff2` (+ `OFL.txt`, `PROVENANCE.md`)
- Test: `tests/unit/fonts.test.ts`

**Interfaces:**
- Produces:
  - `assets/fonts/PROVENANCE.md`: tag `NotoSans-v2.015`, tag commit `c4a321e123e4d4ff315f57f4e0adf294fe3a95be`, the zip URL, the path of each file inside the zip, and its SHA-256.
  - `noto-metrics.gen.ts` exports `NOTO_METRICS: { unitsPerEm: number; ascender: number; descender: number; advances: Record<400|600, Record<number /*codepoint*/, number>> }` for U+0020–U+024F and the Greek/Cyrillic basic blocks.
  - The same data for Noto Serif, for the custom-font tests.
- Decision: the source is `https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.015/NotoSans-v2.015.zip`, whose zip SHA-256 is `0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5` (verified 2026-09-30). The release ships no WOFF2, so the script takes the static unhinted instances `NotoSans/unhinted/ttf/NotoSans-Regular.ttf` and `NotoSans/unhinted/ttf/NotoSans-SemiBold.ttf` and compresses them to WOFF2 with `wawoff2` (a dev dependency). Both the TTF and WOFF2 hashes are recorded.
- Advance widths come from the TTF `hmtx` table, read with `fontkit` (a dev dependency).
- Noto Serif for tests comes from tag `NotoSerif-v2.015` (tag commit `1eee5de7230d240118f8ad8d1e5fe4c91acae943`) using the same procedure. Its zip hash is recorded on first fetch.
- The script runs once and its outputs are committed; CI never downloads fonts.

- [ ] **Step 1: Write the failing test:**

```ts
test('shipped font files match PROVENANCE hashes', () => {
  for (const { file, sha256 } of readProvenance('assets/fonts/PROVENANCE.md'))
    expect(sha256File(`assets/fonts/${file}`)).toBe(sha256);
});
test('OFL license present and css references both weights', () => {
  expect(read('assets/fonts/OFL.txt')).toMatch(/SIL OPEN FONT LICENSE Version 1.1/);
  expect(read('assets/fonts/noto-sans.css')).toMatch(/font-weight:\s*400[\s\S]*font-weight:\s*600/);
});
test('metrics cover ASCII for both weights', () => {
  for (const w of [400, 600] as const)
    for (let cp = 0x20; cp < 0x7f; cp++) expect(NOTO_METRICS.advances[w][cp]).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/fonts.test.ts`. Expected: FAIL (the files are missing).
- [ ] **Step 3: Implement `scripts/fetch-font.ts`**, run it once with `pnpm tsx scripts/fetch-font.ts`, and commit its outputs. It deletes the downloaded zip afterwards.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(assets): pin Noto Sans v2.015 with provenance and metrics`

---

### Task 4: Schema v1 for all kinds, generated types and precompiled validator

**Files:**
- Create: `schema/viz-spec-v1.schema.json`, `scripts/gen-types.ts`, `scripts/gen-validator.ts`, `scripts/check-drift.ts`, `src/core/spec/types.gen.ts`, `src/core/spec/index.ts`, `src/core/validate/ajv.gen.js` (+ `.d.ts`)
- Create: `fixtures/valid/min-{bar,line,area,composed,scatter,donut,heatmap,progress}.json` (verbatim from §5.6)
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Produces:
  - Types `VizSpec`, `CartesianSpec`, `DonutSpec`, `HeatmapSpec` and `ProgressSpec`, plus every part named in §5 (`Series`, `Point`, `ValueAxis`, `CategoryAxis`, `LinearAxis`, `TimeAxis`, `Domain`, `NumberFormat`, `RoleDef`, `Annotation`, `ReferenceLine`, `BubbleEncoding`, `Slice`, `ProgressItem`, `LegendOptions`, `MarkerShape`, `Dash`, `Quality`).
  - `isCartesian(spec)` and the other kind guards in `spec/index.ts`.
  - `schemaValidate(input): boolean & { errors?: AjvError[] }` from `ajv.gen.js`, with no runtime `ajv` import (the helpers are inlined).
- Decision: the schema is one root `oneOf` over four `$defs` (`CartesianSpec`, `DonutSpec`, `HeatmapSpec`, `ProgressSpec`), discriminated by `kind` with `const`. `json-schema-to-typescript` runs with `unreachableDefinitions: true` and `strictIndexSignatures: true`. Named `$defs` become exported interfaces with §5 names (the `title` of each `$def` sets the name).

- [ ] **Step 1: Write the failing test:**

```ts
test.each(MIN_FIXTURES)('%s passes the schema', (id) => {
  expect(schemaValidate(loadFixture(id))).toBe(true);
});
test('unknown field rejected with its path', () => {
  const bad = { ...loadFixture('min-line'), colour: 'red' };
  expect(schemaValidate(bad)).toBe(false);
  expect(schemaValidate.errors![0]).toMatchObject({ keyword: 'additionalProperties' });
});
test('schema file declares 2020-12 and schemaVersion const 1', () => {
  const s = readJson('schema/viz-spec-v1.schema.json');
  expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
  expect(s.$defs.SpecBase.properties.schemaVersion.const).toBe(1);
});
test('generated files are up to date', () => {
  expect(runDriftCheck()).toEqual({ ok: true, diffs: [] });
});
test('generated validator has no runtime ajv import', () => {
  expect(read('src/core/validate/ajv.gen.js')).not.toMatch(/from ["']ajv|require\(["']ajv/);
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/schema.test.ts`. Expected: FAIL.
- [ ] **Step 3: Author the schema** exactly per §5 (all field constraints, lengths, patterns, enums and `minItems`/`maxItems` counts). Implement `gen-types.ts` and `gen-validator.ts` (Ajv `strict: true`, `allErrors: true`, standalone `code.source`, then an esbuild bundle of the generated module inlining `ajv/dist/runtime/*`). Implement `check-drift.ts`, which regenerates into `os.tmpdir()` and byte-compares. Wire `pnpm gen` and `pnpm check:drift`.
- [ ] **Step 4: Run** `pnpm gen && pnpm vitest run tests/unit/schema.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): schema v1 for all chart kinds with generated types and validator`

---

### Task 5: `validateSpec`, semantic rules, limits and `InvalidSpecError`

**Files:**
- Create: `src/core/errors.ts`, `src/core/validate/{index.ts,issues.ts,limits.ts}`, `src/core/validate/semantic/{common.ts,cartesian.ts,donut.ts,heatmap.ts,progress.ts}`, `src/core/index.ts`, `src/core/version.ts`
- Create: `fixtures/invalid/<rule>.json` plus `<rule>.expected.json` for every rule in §6, and `fixtures/valid/text-markup-title.json`
- Test: `tests/unit/validate.test.ts`

**Interfaces:**
- Consumes: `schemaValidate` (Task 4).
- Produces:
  - `class DravenVizError extends Error { readonly code: ErrorCode; readonly chartId?: string; readonly path?: string; }`
  - `class InvalidSpecError extends DravenVizError { readonly rule: string; readonly issues: readonly ValidationIssue[]; }`
  - `type ErrorCode` (the §9 list).
  - `validateSpec(input: unknown, options?: ValidateOptions): VizSpec` and `isValidSpec(...)`.
  - `DEFAULT_LIMITS: Readonly<Limits>`, where `Limits = { series; cartesianPoints; barCategories; donutSlices; heatmapCells; jsonBytes; annotations; referenceLines; progressItems }`.
- Ajv error mapping: `instancePath` becomes `path`; the `keyword` maps to a rule of the form `schema-<keyword>`; the message is rewritten to say how to fix it (for example `additionalProperties` → "Remove unknown field 'colour' (allowed: …)").

- [ ] **Step 1: Write the failing tests:**

```ts
test.each(INVALID_FIXTURES)('%s rejected with expected rule and path', (id) => {
  const expected = loadExpected(id);           // { code, rule, path }
  const err = catchErr(() => validateSpec(loadInvalid(id)));
  expect(err).toBeInstanceOf(InvalidSpecError);
  expect(err).toMatchObject(expected);
  expect(err.message).toMatch(/\S/);
});
test('Infinity from JSON parse is non-finite-number', () => {
  const spec = JSON.parse(read('fixtures/valid/min-line.json').replace('"value":3', '"value":1e400'));
  expect(catchErr(() => validateSpec(spec))).toMatchObject({ rule: 'non-finite-number', path: '/series/0/points/0/value' });
});
test('does not mutate input and returns frozen clone', () => {
  const input = loadFixture('min-line'); const snapshot = structuredClone(input);
  const out = validateSpec(deepFreeze(input));
  expect(input).toEqual(snapshot); expect(out).not.toBe(input); expect(Object.isFrozen(out.series[0])).toBe(true);
});
test('markup-looking title is valid text', () => {
  expect(validateSpec(loadFixture('text-markup-title')).title).toBe('</text><script>alert(1)</script>');
});
test('oversized input -> LIMIT_EXCEEDED before schema', () => {
  expect(catchErr(() => validateSpec(makeLineSpecOfBytes(2 * 1024 * 1024 + 1)))).toMatchObject({ code: 'LIMIT_EXCEEDED', rule: 'json-bytes' });
});
test('lower limits allowed, raising throws INVALID_OPTIONS', () => {
  expect(catchErr(() => validateSpec(loadFixture('min-line'), { limits: { series: 17 } }))).toMatchObject({ code: 'INVALID_OPTIONS' });
  expect(catchErr(() => validateSpec(twoSeriesSpec(), { limits: { series: 1 } }))).toMatchObject({ code: 'LIMIT_EXCEEDED' });
});
```

The Node-import check against the compiled `dist/core` is in Task 15, once the complete build exists.

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `validateSpec` in the order from §6 (bytes → schema → semantic → limits). Implement every semantic rule in §6, including the revision-2 additions `static-label-without-name`, `percent-axis-configured`, `percent-axis-shared` and `percent-value-unit-required`, even though their families render in later slices. Issues are capped at 50.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): validateSpec with semantic rules, limits and InvalidSpecError`

---

### Task 6: Number and time formatting

**Files:**
- Create: `src/core/format/number.ts`, `src/core/format/time.ts`
- Test: `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  - `formatNumber(value: number, format: NumberFormat | undefined, locale: string): string`
  - `parseTimeValue(value: string): { epochMs: number; kind: "date" | "instant" }`, which throws `InvalidSpecError` (rule `invalid-time` or `time-without-offset`)
  - `formatTime(epochMs: number, kind: "date" | "instant", unit: TimeTickUnit, locale: string, timezone: string): string`, where `TimeTickUnit = "hour"|"day"|"week"|"month"|"quarter"|"year"`. `kind: "date"` always formats in `UTC`.

- [ ] **Step 1: Write the failing tests:**

```ts
test('percent style uses percentage points', () => { expect(formatNumber(45.2, { style: 'percent', maximumFractionDigits: 1 }, 'en-US')).toBe('45.2%'); });
test('currency requires code', () => { expect(formatNumber(120000, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }, 'en-US')).toBe('$120,000'); });
test('locale decimal', () => { expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, 'de-DE')).toBe('1.234,5'); });
test('date-only is a UTC calendar day', () => { expect(parseTimeValue('2026-07-06')).toEqual({ epochMs: Date.UTC(2026, 6, 6), kind: 'date' }); });
test('date-time without offset rejected', () => { expect(() => parseTimeValue('2026-07-06T10:00:00')).toThrow(/time-without-offset/); });
test('machine TZ never leaks', () => {            // this file runs under TZ=America/New_York (vitest env)
  const { epochMs } = parseTimeValue('2026-07-06T23:30:00Z');
  expect(formatTime(epochMs, 'instant', 'day', 'en-US', 'Asia/Tokyo')).toBe('Jul 7');
  expect(formatTime(Date.UTC(2026, 6, 6), 'date', 'day', 'en-US', 'Asia/Tokyo')).toBe('Jul 6');
});
```

- [ ] **Step 2: Run** `TZ=America/New_York pnpm vitest run tests/unit/format.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** with `Intl.NumberFormat` (percent: divide by 100, then `style: 'percent'`) and `Intl.DateTimeFormat` with an explicit `timeZone`. Parsing uses a strict ISO 8601 regex followed by `Date.UTC` arithmetic; `Date.parse` is never called on strings without an offset. Vitest's config sets `env.TZ = 'America/New_York'` for this file.
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): explicit locale/timezone number and time formatting`

---

### Task 7: Themes

**Files:**
- Create: `src/core/theme/{tokens.ts,light.ts,dark.ts,print.ts,resolve.ts,index.ts}`, `examples/themes/security.json`
- Test: `tests/unit/theme.test.ts`

**Interfaces:**
- Produces: `Theme`, `ThemeName` and `ThemeOverrides` (as in §7); `themes: Readonly<Record<ThemeName, Theme>>`; `resolveTheme(base: ThemeName | Theme, overrides?: ThemeOverrides): Theme` (which throws `INVALID_OPTIONS` with a path for a bad override); `effectivePt(logicalSize: number, viewBoxWidth: number, printWidthMm: number): number`.
- Values:
  - The print theme uses `text = { title: 17, label: 13, caption: 11, lineHeight: 1.25 }` and background `#ffffff`.
  - Light and dark use label 12, title 16 and caption 11.
  - All themes have 8 palette slots, each paired with a dash and a shape. Slot 0 is solid/circle, slot 1 dashed/square, slot 2 dotted/triangle, slot 3 solid/diamond, and slots 4–7 repeat the dashes with the remaining shapes and hues.
  - `strings` hold the en-US text from §5.

- [ ] **Step 1: Write the failing tests:**

```ts
test('print sizes meet A4 minima at 680 units / 178 mm', () => {
  const t = themes.print;
  expect(effectivePt(t.text.title, 680, 178)).toBeGreaterThanOrEqual(12);
  expect(effectivePt(t.text.title, 680, 178)).toBeLessThanOrEqual(14);
  expect(effectivePt(t.text.label, 680, 178)).toBeGreaterThanOrEqual(9);
  expect(effectivePt(t.text.caption, 680, 178)).toBeGreaterThanOrEqual(8);
});
test('series slots differ by dash or shape, not color alone', () => {
  const s = themes.print.seriesStyles; for (let i = 1; i < 8; i++) for (let j = 0; j < i; j++)
    expect(s[i].dash !== s[j].dash || s[i].shape !== s[j].shape).toBe(true);
});
test('no business words in built-in themes', () => {
  expect(JSON.stringify(themes)).not.toMatch(/critical|severity|vulnerab|finding|sla/i);
});
test('override rejects non-hex color with path', () => {
  expect(catchErr(() => resolveTheme('light', { color: { text: 'red' } } as any))).toMatchObject({ code: 'INVALID_OPTIONS', path: '/color/text' });
});
test('security example override supplies role colors', () => {
  expect(resolveTheme('print', readJson('examples/themes/security.json')).roles.critical.color).toMatch(/^#[0-9a-f]{6}$/i);
});
```

- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement.** Grayscale check for print: the palette's relative luminance values must be at least 0.08 apart pairwise across 4 slots (asserted in the test file as an extra case).
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(core): light, dark and print themes with typed overrides`

---

### Task 8: Slice-1 fixtures

**Files:**
- Create: `fixtures/valid/{line-weekly-flow,line-thinned-annotation,line-singleton,line-all-equal,line-measured-zero,line-all-missing,line-irregular-numeric,line-irregular-time,line-fixed-domain-clipped,line-estimated-monotone,line-category-labels-wrap,line-category-labels-rotate,line-category-labels-thin,perf-line-500x4}.json`, `fixtures/reports/report-slice1.json`, `fixtures/index.ts`, `scripts/gen-fixtures.ts`
- Test: `tests/unit/fixtures.test.ts`

**Interfaces:**
- Produces: `FIXTURES: readonly FixtureEntry[]`, where `FixtureEntry = { id: string; file: string; family: "line"|"bar"|"area"|"composed"|"scatter"|"donut"|"heatmap"|"progress"; modes: string[]; coverage: string[]; slice: 1|2|3; gallery: boolean }`. Also `loadFixture(id): unknown` and `specHash(spec): string` (SHA-256 of canonical JSON with sorted keys).
- `line-weekly-flow` content:
  - It extends the brief's example: week `2026-07-13` of `opened` is `null`, week `2026-07-20` is `18` with `partial`/`marker-only`, and the `closed` series stays as in the brief.
  - It adds a fourth week, `2026-07-27`, with `opened: 21` and `closed: 16`. The `closed` point is `quality: "lagging"` and stays in the line.
  - It has an annotation at `2026-07-20` with label `Partial week` and detail `Collection paused 22–24 Jul; value is a partial count.`
  - It has a reference line on the `count` axis at value `15`, labelled `Target`.
- Edge fixtures (all single-series lines, category x axis of 4 weeks unless noted):
  - `line-singleton`: one point, `p1 = 5`.
  - `line-all-equal`: values `7, 7, 7, 7`, no domain, so `fit` applies.
  - `line-measured-zero`: values `0, 0, 0, 0` with `domain: { policy: "include-zero" }`.
  - `line-all-missing`: values `null ×4`.
- `line-fixed-domain-clipped`: category axis of 5 weeks; y axis `domain: { policy: "fixed", min: 0, max: 100, overflow: "clip-indicated" }`, unit `%`; values `40, 130, 85, -10, 60`.
- `line-estimated-monotone`: category axis of 6 months, two series:
  - `forecast`, `interpolation: "monotone"`, values `10, 14, 13, 18, 24, 23`, with points 4 and 5 `quality: "estimated"`;
  - `actual`, `linear`, values `12, 12, 15, 17, null, null`.
- `line-category-labels-{wrap,rotate,thin}` show each stage of the label policy at 680×320 print, all with one line series. Labels are two-word place names of 18–24 characters, such as "North Harbour Depot", with no word over 12 characters.
  - `-wrap`: 6 categories. The band is about 100 units, so each label fits on 2 wrapped lines with no rotation.
  - `-rotate`: 14 categories. The band is about 43 units, too narrow for the wrapped width, so labels rotate −45°. The rotated footprint (about 1.414 × line height) still fits, so nothing is thinned.
  - `-thin`: 60 categories. The band is about 10 units, below the rotated footprint, so every n-th label is hidden and the first and last stay visible.

  The exact band widths come from the layout, and Task 10 asserts the policy stage, not the numbers above.
- `line-irregular-numeric`: linear x axis with x = `0, 1, 2, 10, 11` and values `3, 4, 5, 6, 7`.
- `line-irregular-time`: time axis with date-only x values `2026-07-01, 2026-07-02, 2026-07-09, 2026-08-09`.
- `line-thinned-annotation`: a time axis with 90 daily date-only points from `2026-07-01` to `2026-09-28`, two series, one of which has 60-character long labels, and an annotation at `2026-08-12` with label `Policy change` and a detail. Monthly ticks do not include 12 Aug.
- `perf-line-500x4`: 4 series × 125 points (500 in total) on a time axis. Values come from mulberry32 with seed `20260930`, generated by `scripts/gen-fixtures.ts`, and the output is committed.
- `report-slice1`: `[{fixture:"line-weekly-flow",namespace:"wf-a"},{fixture:"line-weekly-flow",namespace:"wf-b"},{fixture:"line-thinned-annotation",namespace:"ta"},{fixture:"line-singleton",namespace:"sg"},{fixture:"line-measured-zero",namespace:"mz"},{fixture:"line-all-missing",namespace:"am"},{fixture:"line-fixed-domain-clipped",namespace:"fc"},{fixture:"line-estimated-monotone",namespace:"em"}]`. Eight instances, which print across more than one A4 page.

- [ ] **Step 1: Write the failing tests:** every valid fixture passes `validateSpec`; `specHash` is stable across key order; `gen-fixtures` output equals the committed file; the report lists `line-weekly-flow` twice with distinct namespaces.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Author the fixtures** and implement the catalog.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `test(fixtures): slice-1 line fixtures, perf fixture and report`

---

### Task 9: Line model (DOM-free)

**Files:**
- Create: `src/render/model/{types.ts,index.ts,cartesian.ts,scale.ts,ticks.ts,segments.ts,manifest.ts}`
- Test: `tests/unit/model-line.test.ts`

**Interfaces:**
- Consumes: `VizSpec`, `Theme`, `parseTimeValue`, `formatNumber`, `formatTime`.
- Produces:
  - `buildModel(spec: VizSpec, ctx: ModelContext): ChartModel`, where `ModelContext = { theme: Theme; locale: string; timezone: string }`.
  - `ChartModel = CartesianModel | UnsupportedModel` in slice 1. `UnsupportedModel = { kind: "unsupported"; reason: string }` maps to `not-implemented-in-slice` downstream.
  - `CartesianModel = { kind: "cartesian"; chartId; title; description?; caption?; x: XScaleModel; yAxes: YAxisModel[]; series: LineSeriesModel[]; annotations: AnnotationModel[]; referenceLines: ReferenceLineModel[]; state: "ok" | "empty"; legend: LegendItem[]; notes: string[]; manifest: MarkManifest }`
  - `XScaleModel = { type: "category"; keys: string[]; labels: string[] } | { type: "linear" | "time"; domain: [number, number]; ticks: TickModel[] }`, where `TickModel = { value: number | string; label: string; essential: boolean }` and first and last are essential.
  - `YAxisModel = { id; label?; unit?; domain: [number, number]; ticks: TickModel[]; position: "left" | "right" }`
  - `LineSeriesModel = { id; label; axisId; style: { color; dash; shape; width }; interpolation; points: PointModel[]; segments: SegmentModel[]; markers: { pointId; reason: "quality" | "marker-only" | "isolated" | "all"; variant: "filled" | "hollow" | "ringed" }[]; clipped: { pointId; side: "above" | "below" }[] }`
  - `SegmentModel = { pointIds: string[]; estimatedRanges: [string, string][] }`. Each range holds the point IDs bounding one dashed x range: from the point before an estimated run to the point after it, clamped to the segment.
  - `YAxisModel` also carries `overflow: "error" | "clip-indicated"`.
  - `PointModel = { id; xKey: string | number; value: number | null; label: string /* datumLabel ?? category label ?? formatted x */; display: string; quality; renderHint; note? }`
  - `MarkManifest = { groups: { key: string; count: number }[] }` with keys `series:<id>:segment`, `series:<id>:estimated`, `series:<id>:marker`, `series:<id>:clip-indicator`, `annotation`, `reference`, `empty-state`.
- Algorithms the signatures don't determine:
  - **Nice ticks:** Heckbert's nice-number algorithm, targeting 5 ticks and accepting 4–6. If the target can't be met, pick the step (1, 2, 2.5 or 5 × 10ⁿ) whose count is closest to 5 and whose formatted labels are all distinct.
  - **Domains:** `include-zero` → nice(min(0, dataMin), max(0, dataMax)); if that collapses (every value 0), the domain is `[0, 1]`. `fit` → nice(dataMin, dataMax). A flat series under `fit` gets ±max(1, 10 % × |v|). No measured data gives `[0, 1]` and `state: "empty"`.
  - **Segmentation:** split the points in order; a point joins the current segment only if `value !== null && renderHint === "line"`. `marker-only` and `gap` close the segment. A segment with exactly one point is removed, and its point becomes a marker with `reason: "isolated"`.

- [ ] **Step 1: Write the failing tests:**

```ts
const ctx = { theme: themes.print, locale: 'en-US', timezone: 'UTC' };
test('weekly-flow segments and markers', () => {
  const m = buildModel(validateSpec(loadFixture('line-weekly-flow')), ctx) as CartesianModel;
  const opened = m.series.find(s => s.id === 'opened')!;
  expect(opened.segments).toEqual([]);          // o1 isolated (next is null), o3 marker-only, o4 isolated
  expect(opened.markers.map(k => [k.pointId, k.reason])).toEqual([['o1','isolated'],['o3','marker-only'],['o4','isolated']]);
  const closed = m.series.find(s => s.id === 'closed')!;
  expect(closed.segments).toEqual([{ pointIds: ['c1','c2','c3','c4'], estimatedRanges: [] }]);
  expect(closed.markers).toEqual([{ pointId: 'c4', reason: 'quality', variant: 'ringed' }]);
});
test('include-zero domain and 4–6 distinct ticks', () => {
  const y = (buildModel(validateSpec(loadFixture('line-weekly-flow')), ctx) as CartesianModel).yAxes[0];
  expect(y.domain[0]).toBe(0); expect(y.ticks.length).toBeGreaterThanOrEqual(4); expect(y.ticks.length).toBeLessThanOrEqual(6);
  expect(new Set(y.ticks.map(t => t.label)).size).toBe(y.ticks.length);
});
test('flat, singleton, zero and all-missing', () => {
  expect(yDomain('line-all-equal')).toEqual([6, 8]);            // value 7, ±1
  expect(markers('line-singleton')).toEqual([['p1', 'isolated']]);
  expect(yDomain('line-measured-zero')).toEqual([0, 1]);
  expect(model('line-all-missing').state).toBe('empty');
  expect(model('line-all-missing').manifest.groups).toContainEqual({ key: 'empty-state', count: 1 });
});
test('annotation x independent of ticks', () => {
  const m = model('line-thinned-annotation');
  expect(m.annotations[0].xKey).toBe('2026-08-12');
  expect((m.x as any).ticks?.some((t: TickModel) => t.value === Date.UTC(2026, 7, 12)) ?? false).toBe(false);
});
test('fixed clip-indicated domain is kept and clipped points recorded', () => {
  const m = model('line-fixed-domain-clipped');
  expect(m.yAxes[0].domain).toEqual([0, 100]); expect(m.yAxes[0].overflow).toBe('clip-indicated');
  expect(m.series[0].clipped).toEqual([{ pointId: 'p2', side: 'above' }, { pointId: 'p4', side: 'below' }]);
  expect(m.notes).toEqual(expect.arrayContaining([expect.stringMatching(/1 value above 100 .*clipped/), expect.stringMatching(/1 value below 0 .*clipped/)]));
  expect(m.manifest.groups).toContainEqual({ key: 'series:s:clip-indicator', count: 2 });
});
test('estimated points produce dashed ranges; monotone kept', () => {
  const f = model('line-estimated-monotone').series.find(s => s.id === 'forecast')!;
  expect(f.interpolation).toBe('monotone');
  expect(f.segments).toEqual([{ pointIds: ['f1','f2','f3','f4','f5','f6'], estimatedRanges: [['f3','f6']] }]);
  expect(model('line-estimated-monotone').manifest.groups).toContainEqual({ key: 'series:forecast:estimated', count: 1 });
});
test('model is deterministic and does not touch the DOM', () => {
  expect(JSON.stringify(model('line-weekly-flow'))).toBe(JSON.stringify(model('line-weekly-flow')));
  expect(typeof (globalThis as any).document).toBe('undefined');
});
test('non-line kinds report unsupported in slice 1', () => {
  expect(buildModel(validateSpec(loadFixture('min-donut')), ctx)).toMatchObject({ kind: 'unsupported' });
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/model-line.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the files listed.
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): DOM-free line model with gaps, markers and manifest`

---

### Task 10: Layout and text measurement

**Files:**
- Create: `src/render/layout/{types.ts,index.ts,measure.ts,canvas-measure.ts,labels.ts,print-scale.ts}`
- Test: `tests/unit/layout.test.ts`

**Interfaces:**
- Consumes: `CartesianModel`, `Theme`, `NOTO_METRICS`.
- Produces:
  - `type TextMeasurer = (text: string, font: { size: number; weight: 400 | 600 }) => { width: number; ascent: number; descent: number }`
  - `notoMeasurer: TextMeasurer`, for tests and Node.
  - `createCanvasMeasurer(family: string): TextMeasurer`, browser only, in `canvas-measure.ts`.
  - `layoutChart(model: CartesianModel, opts: LayoutOptions, measure: TextMeasurer): LaidOutChart`, where `LayoutOptions = { width: number; height: number; theme: Theme; mode: "interactive" | "static"; printWidthMm?: number }`.
  - `LaidOutChart = { model; width; height; fontScale: number; boxes: { title: Box; legend: Box; plot: Box; axes: Record<string, Box>; notes: Box }; titleLines: string[]; legendRows: LegendItem[][]; xTicks: PlacedTick[]; notes: NoteLine[]; metrics: { effectivePt?: { title: number; label: number; caption: number } } }`
  - `Box = { x; y; width; height }`. `PlacedTick = { value; lines: string[]; rotate: 0 | -45; visible: boolean }`.
- Rules (from §8):
  - The title wraps to at most 3 lines.
  - Category and time tick labels: wrap to 2 lines, then rotate −45°, then thin every n-th label while keeping first and last visible.
  - Notes are numbered annotation details: "① Partial week — Collection paused…".
  - `fontScale` = max(1, the minimum pt ÷ effective pt over title, label and caption) when `printWidthMm` is set.
  - A plot area smaller than 80 × 60 throws `DravenVizError("LAYOUT_ERROR")`, with a message naming the element that consumed the space and the minimum size needed.

- [ ] **Step 1: Write the failing tests:** `line-weekly-flow` at 680×320 in print mode has non-overlapping boxes (pairwise intersection area 0), plot ≥ 80×60, and `metrics.effectivePt.label >= 9`. At a logical width of 1200 and `printWidthMm` 178, a 13-unit label alone would be 13 × 504.57 / 1200 ≈ 5.5 pt, so `fontScale` must be about 1.74 (driven by the caption: 8 / (11 × 0.4205)). Assert `fontScale > 1`, `effectivePt.label >= 9`, `effectivePt.caption >= 8` and `12 <= effectivePt.title <= 14`. The same scaling-up case at a logical width of 680 and `printWidthMm` 100 gives `fontScale > 1`. At a width of 400 and 178 mm, labels are already ≈ 16.4 pt, so `fontScale === 1`: layout never scales text down. Label policy stages at 680×320 print:
- `line-category-labels-wrap`: every tick has `rotate: 0`, some have 2 `lines`, and all are `visible`.
- `-rotate`: every tick has `rotate: -45`, all `visible`, and no two rotated label quads intersect.
- `-thin`: `rotate: -45`, some `visible: false`, the first and last visible, and the visible labels' rotated quads don't intersect.
- In all three, no label text is truncated: each tick's joined `lines` equal the source label.

`line-thinned-annotation` is kept for annotation placement between ticks, not for thinning. At 680 wide, its annotation x lies strictly between two visible ticks, its note is present, and the test makes no assertion about hidden ticks. A 200×120 box throws `LAYOUT_ERROR` whose message contains "minimum". A long title of 180 characters wraps to at most 3 lines with no line wider than the width minus padding.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the layout.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): layout with wrap/rotate/thin label policy and print scaling`

---

### Task 11: Font runtime and browser test harness

**Files:**
- Create: `src/render/fonts/{registry.ts,load.ts}`, `tests/harness/{vite.config.ts,index.html,harness.ts}`, the `webServer` entry in `playwright.config.ts`
- Test: `tests/browser/fonts.spec.ts`

**Interfaces:**
- Produces:
  - `defaultFontAssets(assetBaseUrl?: string): FontAsset[]`, which returns `fonts/NotoSans-Regular.woff2` (400) and `fonts/NotoSans-SemiBold.woff2` (600), resolved against `assetBaseUrl`.
  - `loadFonts(assets: FontAsset[], signal: AbortSignal): Promise<ResolvedFontSet>`
  - `ResolvedFontSet = { family: string; faces: ResolvedFace[] }`, where `ResolvedFace = { weight; url; fileName; format; sha256; bytes; buffer: ArrayBuffer }`
  - `fontRegistry.get(url): ResolvedFace | undefined`
  - `assertSameOriginOrRelative(url: string): void` (`INVALID_OPTIONS`)
- The harness is a Vite dev server over `tests/harness`, importing `src` directly (internal tests only). It exposes `window.__h = { loadFonts, mount, exportSvg, counts }` and serves `assets/fonts` at `/fonts/`.

- [ ] **Step 1: Write the failing tests:** loading the defaults resolves with two faces whose SHA-256 values equal `PROVENANCE.md`, and `document.fonts.check('13px "Noto Sans"')` is true. A 404 URL rejects with `FONT_LOAD_FAILED` including the URL. `javascript:alert(1)` and `https://evil.example/f.woff2` reject with `INVALID_OPTIONS` before any fetch (asserted through `page.on('request')`). An aborted signal rejects with `DISPOSED`. The same URL loaded twice results in one network request.
- [ ] **Step 2: Run** `pnpm test:browser tests/browser/fonts.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** it: `fetch` → `arrayBuffer` → `crypto.subtle.digest('SHA-256')` → `new FontFace(family, buffer, { weight: String(w) })` → `document.fonts.add` → `await face.load()` → `document.fonts.check`.
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): verified font loading with byte registry`

---

### Task 12: SVG rendering (Recharts line adapter, overlays, primitives), `mountCharts` and data table DOM

**Files:**
- Create: `src/render/ChartView.tsx`, `src/render/recharts/{CartesianChart.tsx,overlays.tsx}`, `src/render/primitives/{Title,Legend,Notes,Marker,EmptyState}.tsx`, `src/render/verify.ts`, `src/render/render-id.ts`, `src/print/{mount.ts,lifecycle.ts,table-dom.ts,index.ts}`, `src/core/table/index.ts`, `src/styles/dravenviz.css`
- Test: `tests/unit/table.test.ts`, `tests/browser/mount.spec.ts`, `tests/browser/geometry.spec.ts`

**Interfaces:**
- Consumes: `LaidOutChart`, `ResolvedFontSet`, `createCanvasMeasurer`.
- Produces:
  - `ChartView(props: { laid: LaidOutChart; renderId: number; namespace: string; fontFamily: string; interactive?: InteractionProps }): JSX.Element`. It renders a Recharts `ComposedChart` sized `laid.width × laid.height` with `margin` taken from `laid.boxes.plot`. Every `Line` has `isAnimationActive={false}` and `connectNulls={false}`, with data derived from the segments: each segment becomes a separate `Line` dataKey, so segment breaks are exact and never depend on Recharts' null handling. Markers, annotations, reference labels, notes, title and legend are chart children.
  - The root `<svg>` carries `data-dv-render-id`, `data-dravenviz-ns` and `data-dravenviz-chart`. Each mark group carries `data-dv-mark="<manifest key>"`, and interactive-only elements carry `data-dv-interactive`.
  - Every `<text>` DravenViz draws (including tick labels through the custom `tick` renderer) carries `data-dv-label-id` and `data-dv-text-role` (`title | tick | axis-title | legend | annotation | reference | direct | note | caption`). Task 16 uses these to map PDF text to roles.
  - `verifyCommitted(svg: SVGSVGElement, manifest: MarkManifest, renderId: number, width: number, height: number): void`, which throws `RENDER_FAILED` with the failing check (§9 step 5).
  - `mountCharts(target: Element | Element[], specs: unknown[], options: MountOptions): MountHandle` (§9).
  - `renderDataTable(target: Element, spec: VizSpec, options?): () => void`
  - `toDataTable(spec: VizSpec, options?): DataTable` (§11)
  - `nextRenderId(): number`
- Rules:
  - Readiness runs the §9 sequence inside a single `AbortController`, with `Promise.race` against the timeout. Any failure calls the batch's `disposeAll()` before rejecting.
  - `mountCharts` resolves `ReadyInfo[]` in spec order.
  - Overlay components compute pixel positions with `useXAxisScale()`/`useYAxisScale(axisId)` from `recharts` (public hooks).

- [ ] **Step 1: Write the failing tests.**

`tests/unit/table.test.ts` covers `toDataTable(line-weekly-flow)`:
- Columns `Week`, `Opened (count)` and `Closed (count)`.
- The row for `2026-07-13` has an Opened cell `{ text: 'Not measured', value: null, state: 'missing' }`.
- The `2026-07-20` row has state `partial`.
- `notes` contains the annotation detail.

`tests/browser/mount.spec.ts` (against the harness):

```ts
test('mounts weekly-flow and resolves after final geometry', async ({ page }) => {
  const info = await h(page).mount(['line-weekly-flow'], { width: 680, height: 320, theme: 'print', namespace: 'r' });
  expect(info).toEqual([expect.objectContaining({ chartId: 'weekly-flow', width: 680, height: 320 })]);
  expect(await page.locator('svg[data-dravenviz-chart="weekly-flow"] [data-dv-mark="series:closed:segment"] path').count()).toBe(1);
});
test('flat, singleton, zero and all-missing charts become ready', async ({ page }) => {
  for (const id of ['line-all-equal', 'line-singleton', 'line-measured-zero', 'line-all-missing'])
    await expect(h(page).mount([id], opts)).resolves.toHaveLength(1);
});
test('batch validation failure mounts nothing', async ({ page }) => {
  const err = await h(page).mountError(['line-weekly-flow', 'invalid-unknown-field'], opts);
  expect(err).toMatchObject({ code: 'INVALID_SPEC', chartId: expect.any(String), path: '/colour' });
  expect(await h(page).counts()).toEqual({ roots: 0, observers: 0, svgs: 0 });
});
test('render failure in chart 2 disposes chart 1', async ({ page }) => { /* inject a throwing spec via harness hook → RENDER_FAILED; counts all 0 */ });
test('rejects ZERO_SIZE for hidden ancestor', async ({ page }) => { /* host inside display:none → ZERO_SIZE; svgs 0 */ });
test('second batch with same embedding identity is rejected', async ({ page }) => { /* INVALID_OPTIONS duplicate-chart-embedding; first chart still present */ });
test('two instances with distinct namespaces share no ids', async ({ page }) => { /* ids of wf-a ∩ ids of wf-b = ∅ */ });
test('dispose before ready rejects DISPOSED and cleans up', async ({ page }) => { /* delay font route; dispose(); ready rejects DISPOSED; counts 0 */ });
test('timeout rejects TIMEOUT and cleans up', async ({ page }) => { /* font route never responds; timeoutMs 300 */ });
test('unsupported kind rejects not-implemented-in-slice', async ({ page }) => { /* min-donut → RENDER_FAILED rule not-implemented-in-slice */ });
test('title markup renders as text', async ({ page }) => { /* text-markup-title: no <script> element in document; <text> content equals title */ });
```

`tests/browser/geometry.spec.ts`:
- The Recharts plot area equals the layout's plot box: an overlay probe reading `usePlotArea()` reports `laid.boxes.plot` within 0.5 units, for `line-weekly-flow` with one y axis and for a two-axis variant built in the test.
- For `line-weekly-flow` (category axis, explicit band scale), every rendered marker centre and every path vertex matches the model's expected pixel position within 0.5 units. The oracle maps y linearly from the model's `domain` onto `laid.boxes.plot`, and category `k` of `n` sits at `plot.x + (k + 0.5) × plot.width / n`.
- `line-fixed-domain-clipped`: the y axis tick labels are exactly `0, 20, 40, 60, 80, 100`, and the probe's `useYAxisDomain()` is `[0, 100]`. A screenshot of the region outside the plot box contains no pixel of the series stroke color (a geometric clipping check on the series layer alone, rendered with other layers hidden; it isn't a visual-regression mask). Two chevrons sit at the top and bottom plot edges at categories 2 and 4 (±0.5), and the note text is rendered.
- `line-estimated-monotone`: the forecast path data contains cubic `C` commands and passes through every point's pixel position (±0.5). The dashed copy's clip rectangles span exactly x(f3)…x(f6). For every monotone run of values in the data, the curve's sampled y stays within that run's value range (no overshoot, ±0.5).
- For `line-irregular-numeric` and `line-irregular-time`, the vertex x positions are proportional to their x values: the pixel gap from x = 2 to 10 is 8 times the gap from 0 to 1 (±0.5 units), and the gap from 2026-07-09 to 2026-08-09 is 31/7 times the gap from 2026-07-02 to 2026-07-09 (±0.5).
- The annotation line x equals the scaled x of `2026-07-20` within 0.5.

- [ ] **Step 2: Run** `pnpm vitest run tests/unit/table.test.ts && pnpm test:browser tests/browser/mount.spec.ts tests/browser/geometry.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (design §4 scales and plot bounds):
  - A category x axis gets `type="category"`, **`scale="band"`**, `dataKey="x"`, `interval={0}`, `padding={{ left: 0, right: 0 }}`, `height={laid.boxes.axes.x.height}`, and a custom `tick` that renders the `PlacedTick` lines.
  - Linear and time x axes get `type="number"`, `scale="linear"`, `domain` (epoch milliseconds for time) and explicit `ticks`.
  - Each y axis gets `type="number"`, `domain`, `ticks`, `width={laid.boxes.axes[id].width}` and **`allowDataOverflow={true}`** (design §4: DravenViz's domain is authoritative; `false` would let Recharts widen a fixed domain). `verifyCommitted` also compares `useYAxisDomain(id)`/`useXAxisDomain()`, reported by an overlay probe, with the model's domain.
  - Clip indicators are a DravenViz overlay (`data-dv-mark="series:<id>:clip-indicator"`): a chevron at the plot edge at the point's scaled x.
  - Estimated ranges: each segment renders one Recharts `Line` for the solid curve and a second identical `Line` with the theme's estimated dash. Each is clipped by a `<clipPath>` of x-range rectangles computed from the x scale (complementary sets, so they don't overlap), and each clip path has a namespaced ID.
  - `ComposedChart`'s `margin` is `{ top: plot.y, left: plot.x − Σ left-axis widths, right: width − (plot.x + plot.width) − Σ right-axis widths, bottom: height − (plot.y + plot.height) − x-axis height }`. Recharts' `Tooltip`, `Legend` and `ResponsiveContainer` are not used. `harness.counts()` counts React roots via a registry in `lifecycle.ts`, live `ResizeObserver`s via a wrapped constructor in the harness, and `svg[data-dravenviz-chart]` elements.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(print): line rendering, batch mountCharts lifecycle and data tables`

---

### Task 13: Standalone SVG export (normalize → validate → finalize)

**Files:**
- Create: `src/render/svg/{normalize.ts,validate.ts,finalize.ts,recharts-metadata.ts,ids.ts}`, `src/print/export.ts`
- Test: `tests/unit/svg-validate.test.ts` (JSDOM), `tests/browser/export.spec.ts`, `tests/unit/recharts-metadata.test.ts`

**Interfaces:**
- Consumes: the Task 1 inventory, `fontRegistry`, `mountCharts` internals.
- Produces:
  - `normalizeSvg(live: SVGSVGElement): SVGSVGElement` (a detached clone)
  - `validateSvg(el: SVGSVGElement): void` (`EXPORT_FAILED` with `rule` and `path`, such as `/svg/g[2]/path[1]@onclick`)
  - `finalizeSvg(el: SVGSVGElement, ctx: { namespace; chartId; title; desc; fonts: ResolvedFontSet; fontMode; fontHrefPrefix }): { svg: string; fonts: SvgExport["fonts"] }`
  - `renderToSvg` and `renderToSvgWithAssets` (§9)
  - `RECHARTS_METADATA_ATTRIBUTES: ReadonlySet<string>` and `RECHARTS_PRESENTATION_ATTRIBUTES: ReadonlySet<string>`
- `renderToSvg` defaults to `theme: "print"`, `fontMode: "external"` and `fontHrefPrefix: "fonts/"`. Numbers are rounded to 2 decimals and attributes sorted alphabetically, except that `xmlns` comes first on the root.

- [ ] **Step 1: Write the failing tests.**

`svg-validate.test.ts` runs on hand-built DOM:
- `onclick`, `foreignObject`, `script`, `animate`, `<use href="https://x">` and `fill="url(https://x#a)"` each throw `EXPORT_FAILED` with the matching rule.
- A `class` attribute that survives normalization throws `svg-disallowed-attribute`. This proves the stage order; normalization runs first in real exports.

`recharts-metadata.test.ts`: every attribute in `spikes/recharts-3.10/attribute-inventory.json` is either in one of the two sets or allowed geometry. Nothing is unclassified.

`export.spec.ts`:

```ts
test('real chart exports without renderer metadata', async ({ page }) => {
  const svg = await h(page).renderToSvg('line-weekly-flow', { width: 680, height: 320, namespace: 'x' });
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  expect(svg).toMatch(/viewBox="0 0 680 320"/); expect(svg).toMatch(/<title>Items opened and closed<\/title>/);
  expect(svg).not.toMatch(/class=|style="|recharts|foreignObject|<script|on[a-z]+=/i);
  expect(svg).toMatch(/@font-face[^}]*url\("fonts\/NotoSans-Regular.woff2"\)/);
});
test('byte-identical repeat export', async ({ page }) => { /* export twice → identical strings */ });
test('export cleans up on success, failure and timeout', async ({ page }) => { /* counts 0 after each */ });
test('inherited fill: child initial value survives under colored parent', async ({ page }) => {
  /* harness injects <g fill="red"><rect style="fill:black" .../></g> into the chart overlay;
     exported rect has fill="#000000"; a sibling <rect fill="red"/> under the same g may be pruned;
     the root <svg> carries fill, stroke, font-family, font-size, font-weight, text-anchor explicitly */
});
test('computed-style equivalence after standalone reload', async ({ page }) => {
  /* for line-weekly-flow, line-estimated-monotone and line-fixed-domain-clipped: load exported SVG as a standalone
     document; for every element pair (matched by data-dv-* path/index) compare getComputedStyle for fill, fill-opacity,
     stroke, stroke-width, stroke-opacity, stroke-dasharray, opacity, font-family, font-size, font-weight, text-anchor:
     all equal to the live render */
});
test('export uses effective style over attribute', async ({ page }) => {
  /* harness injects an overlay element with fill="blue" style="fill:red" and a <pattern id="p"> filled shape;
     exported svg: that element has fill="#ff0000"; pattern reference is url(#x-weekly-flow-N) matching the renamed pattern id;
     a url(#missing) reference makes export reject EXPORT_FAILED rule svg-dangling-reference */
});
test('embedded mode embeds exactly the measured bytes', async ({ page }) => {
  const { svg, fonts } = await h(page).renderToSvgWithAssets('line-weekly-flow', { ...o, fontMode: 'embedded' });
  expect(fonts.map(f => f.sha256)).toEqual(provenanceHashes());
  expect(sha256OfDataUrls(svg)).toEqual(provenanceHashes());
});
test('custom font drives family, hrefs and embedded bytes', async ({ page }) => {
  const fontsOpt = [{ family: 'Test Serif', weight: 400, url: '/test-fonts/NotoSerif-Regular.woff2' },
                    { family: 'Test Serif', weight: 600, url: '/test-fonts/NotoSerif-SemiBold.woff2' }];
  const ext = await h(page).renderToSvgWithAssets('line-weekly-flow', { ...o, fonts: fontsOpt, fontHrefPrefix: 'assets/f/' });
  expect(ext.svg).toMatch(/font-family="Test Serif, sans-serif"/);
  expect(ext.svg).toMatch(/url\("assets\/f\/NotoSerif-Regular.woff2"\)/);
  expect(ext.svg).not.toMatch(/NotoSans/);
  const emb = await h(page).renderToSvgWithAssets('line-weekly-flow', { ...o, fonts: fontsOpt, fontMode: 'embedded' });
  expect(sha256OfDataUrls(emb.svg)).toEqual(serifHashes());
});
test('relocated external SVG loads its custom font', async ({ page, browser }) => {
  /* write ext.svg to tmp dir; copy ext.fonts files to <tmp>/assets/f/; open file:// in new page;
     await document.fonts.ready; check('13px "Test Serif"') true; widths of <text> nodes equal in-page widths ±0.5 */
});
test('standalone file re-renders identically', async ({ page }) => { /* screenshot of file vs in-page svg: 0 mismatched px at threshold 0.1 */ });
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the three stages exactly as §10 describes. Normalization uses `getComputedStyle` on the *live* element that pairs with each clone node (the clone and the live tree are walked together).
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(export): normalized, allowlisted standalone SVG with font modes`

---

### Task 14: React `Chart` adapter and `DataTable` (source-level)

**Files:**
- Create: `src/react/{Chart.tsx,DataTable.tsx,interaction.ts,index.ts}`, `tests/harness/react.html`
- Test: `tests/browser/react.spec.ts` (harness page `react.html`, importing `src/react` through the Task 11 harness)

**Interfaces:**
- Consumes: `ChartView`, `loadFonts`, `layoutChart`, `buildModel`, `validateSpec`, `verifyCommitted`, `nextRenderId`.
- Produces:
  - `Chart(props: ChartProps): JSX.Element` (§9)
  - `DataTable(props: { spec: VizSpec; visuallyHidden?: boolean; locale?: string; timezone?: string }): JSX.Element`
- Semantics:
  - Each change to `spec`, a style option, `width` or `height` (or a measured resize) creates a new `renderId`. An effect runs fonts → layout → commit → `verifyCommitted`, then calls `onReady` only if its `renderId` is still the current one.
  - Errors render `<div role="alert" class="dravenviz-error">` with the code and message, then call `onError`.
  - `namespace` defaults to `useId()` with non-`[a-z0-9-]` characters replaced by `-`, prefixed with `dv`.
  - Keyboard behavior follows §9: the focus ring has `data-dv-interactive`, and a live region `aria-live="polite"` announces the datum.

- [ ] **Step 1: Write the failing tests.**

```ts
test('onReady once per render with final geometry', async ({ page }) => { /* mount; readyCalls = [{renderId: n}]; svg present */ });
test('stale font completion does not fire onReady', async ({ page }) => {
  /* route fonts with 400 ms delay; render spec A; after 50 ms switch prop to spec B;
     expect readyCalls to equal [{ chartId: 'B', renderId: 2 }] and DOM title B */
});
test('resize re-renders with the latest size', async ({ page }) => { /* width 100% container 600→400; last onReady width 400 */ });
test('keyboard navigates and activates with stable ids', async ({ page }) => {
  /* focus chart; ArrowRight x2; Enter → onDatumActivate({ seriesId:'opened', datumId:'o3', source:'keyboard' });
     live region text contains 'Opened' and '18' and 'partial' */
});
test('pointer activation', async ({ page }) => { /* click marker o1 → datumId o1, source pointer */ });
test('invalid spec shows alert and calls onError', async ({ page }) => { /* role=alert has INVALID_SPEC; onError code INVALID_SPEC */ });
test('100 prop updates and unmount leave no roots or observers', async ({ page }) => { /* counts return to 0 */ });
test('tooltip DOM never inside svg', async ({ page }) => { /* hover; tooltip exists; svg has no descendant with role tooltip */ });
```

- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the adapter. This task doesn't build or pack; the compiled `dist/react` entry, SSR import check and packed React example come in Task 15.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(react): Chart adapter with render tokens, keyboard and data table`

---

### Task 15: Complete build, browser bundle, asset manifest, packing, staging and examples

**Files:**
- Create: `tsup.config.ts`, `scripts/build-browser.ts`, `scripts/build-manifest.ts`, `scripts/stage-consumer.ts`, `src/browser/index.ts`, `examples/html/{basic.html,host-isolation.html,charts.json,README.md}`, `examples/react/{package.json,pnpm-lock.yaml,index.html,vite.config.ts,src/main.tsx}`, `THIRD_PARTY_NOTICES.md`, `README.md` (the slice-1 subset), `CHANGELOG.md`
- Test: `tests/unit/dist.test.ts`, `tests/unit/core-node-import.test.ts`, `tests/unit/react-ssr-import.test.ts`, `tests/browser/html-examples.spec.ts`, `tests/unit/stage.test.ts`

**Prerequisites:** Tasks 5–14. Every source entry (`src/core`, `src/react`, `src/print`, `src/browser`) exists before this task, so the first complete `build` and `pack:local` run here.

**Interfaces:**
- Produces:
  - `dist/core|react|print/*.js` + `.d.ts`, `dist/dravenviz.browser.js` (an IIFE assigning `window.DravenViz`), `dist/dravenviz.css` and `dist/asset-manifest.json` (§13 shape).
  - Scripts `build` and `pack:local`, which writes `.pack/draven-viz-0.1.0.tgz` plus `.sha256`.
  - `stage-consumer.ts <docs|react|html> [--watch]` (design §16.1): it copies the template's sources into `.stage/<name>` (no symlinks), installs, adds the tarball, and emits the resolution report.
- `THIRD_PARTY_NOTICES.md` lists the licenses and versions of the bundled `react`, `react-dom`, `react-is`, `scheduler`, `recharts` and its runtime dependencies, generated from `node_modules/*/package.json` and LICENSE files by `scripts/build-manifest.ts --notices`, plus Noto Sans OFL-1.1.

- [ ] **Step 1: Write the failing tests.**

`dist.test.ts`:
- `dist/**/*.d.ts` doesn't match `/recharts/`.
- DravenViz's own compiled modules (`dist/core`, `dist/react`, `dist/print`, whose dependencies are external) contain no `eval(`, `new Function(`, `innerHTML` or `dangerouslySetInnerHTML`. The IIFE browser bundle is not string-scanned, because it legitimately contains ReactDOM's `innerHTML` code path and React's production-error URLs. Offline and no-eval behavior are verified at runtime instead (next file).
- Every entry in the manifest exists with a matching SHA-256.
- The `.pack` tarball's file list includes `dist/`, `schema/`, `assets/fonts/`, `README.md`, `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md`, and excludes `docs/`, `spikes/`, `tests/`, `fixtures/` and `examples/`.

`html-examples.spec.ts` serves a temp directory containing only the manifest-copied assets plus `examples/html/*`:
- `basic.html` reaches `window.__ready === true`, and its inline SVG matches `renderToSvg` geometry.
- `host-isolation.html` has hostile but non-`!important` CSS (`* { font-family: "Comic Sans MS" } text { fill: red; font-size: 20px } path { stroke-width: 5 } body { zoom: 1.3 }`; see design §4 host-style isolation), loads a local React 18 UMD build (copied from the dev dependency aliases `react18: npm:react@18.3.1` and `react-dom18: npm:react-dom@18.3.1`, `umd/*.production.min.js`, never a CDN), and holds two instances with namespaces `a` and `b`. Both charts must be ready, their computed text `font-family` must start with `Noto Sans`, their text fill must equal the theme text color, the page's `window.React.version` must still be `18.x`, and the two charts must share no IDs.
- Offline and no-eval behavior are proven at runtime:
  - Every request to a host other than the test origin is intercepted with `page.route`, aborted and recorded, and the test asserts the record is empty.
  - The pages are served with `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'` (no `unsafe-eval`), and the charts must become ready with zero `securitypolicyviolation` events.

`core-node-import.test.ts` (moved from Task 5): `node --input-type=module -e "import('@draven/viz')"` resolved against `dist`. It asserts exit code 0 and, through the loader trace, that neither `react` nor `recharts` was loaded.

`react-ssr-import.test.ts` (moved from Task 14): in Node without a DOM, `await import('../../dist/react/index.js')` and `renderToString(<Chart spec={…} height={320} />)` do not throw, and the output contains a placeholder `div.dravenviz-root`. Final SVG isn't promised under SSR.

`stage.test.ts`:
- After `pnpm stage react`, `.stage/react/src` holds regular files, not symlinks.
- Vite's resolution report, `.stage/react/resolution.json`, is written by the `dv-resolution-report` plugin during `vite build`. Every resolved ID for `@draven/viz*`, `react`, `react-dom`, `react-is` and `recharts` must have a real path under `.stage/react/node_modules/`, never under the repository root's `node_modules` or the template directory.
- `@draven/viz/package.json` in the stage has the tarball's version and its files match the tarball's SHA-256 listing.
- Exactly one real path each for `react` and `react-is` appears in the report.

- [ ] **Step 2: Run** `pnpm build && pnpm pack:local && pnpm vitest run tests/unit/dist.test.ts tests/unit/core-node-import.test.ts tests/unit/react-ssr-import.test.ts tests/unit/stage.test.ts && pnpm test:browser tests/browser/html-examples.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The tsup ESM build keeps `react`, `react-dom`, `react-is`, `recharts` and `react/jsx-runtime` external.
  - The esbuild IIFE bundles everything, with `define: { 'process.env.NODE_ENV': '"production"' }`, `minify: true`, `legalComments: 'linked'` and `globalName: 'DravenViz'`.
  - The CSS scopes every selector under `.dravenviz-root` and styles only HTML around the SVG. Chart visuals rely on inline styles (design §4 host-style isolation), not on this stylesheet.
  - `examples/react`: `pnpm stage react && pnpm --dir .stage/react build` must succeed, and `main.tsx` imports only `@draven/viz` and `@draven/viz/react`. Its `vite.config.ts` sets `resolve.dedupe: ['react', 'react-dom', 'react-is']` and `resolve.preserveSymlinks: false`, and registers the `dv-resolution-report` plugin (shared file `scripts/vite-resolution-report.ts`, copied into each stage).
  - `stage-consumer.ts --watch` (used by `dev:docs`) watches the template's source folders with `fs.watch` (recursive) and mirrors changes into the stage by copying, so Vite HMR sees ordinary files.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(build): complete build, browser bundle, manifest, packing, staging and examples`

---

### Task 16: DravenPDF example and a real PDF (`test:pdf`)

**Files:**
- Create: `examples/dravenpdf/{pyproject.toml,uv.lock,client.py,library_fallback.py,run_pdf_check.py,probe_frames.py,frame_calibration.json,README.md}`, `examples/dravenpdf/probe/{index.html,probe.css,charts.json}`, `docs/plans/slice-1-pdf-probe-results.md`, `examples/dravenpdf/bundle/{index.html,bootstrap.js,report.css}`, `tests/pdf/compare.ts`
- Test: `run_pdf_check.py` itself (it is the `test:pdf` driver), plus `tests/pdf/compare.ts`, called by it

**Interfaces:**
- Consumes: the packed tarball, `asset-manifest.json`, `report-slice1`, `renderToSvg` (for the comparison), and Chromium 141 through `PW_CHROMIUM_PATH` (default `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).
- Produces:
  - `client.py`: `render_bundle(url: str, api_key: str, bundle_dir: Path, options: dict) -> bytes`, a multipart `POST /v1/render/bundle` with each file's bundle path as its filename, `options` as a JSON field, and the `X-API-Key` header. It checks that `X-DravenPdf-Resource-Errors` and `X-DravenPdf-Page-Errors` are both `0` and raises on anything else.
  - `pnpm test:pdf`:
    1. Run `pack:local`.
    2. Extract the tarball to a temp directory, then copy the manifest files into `<tmp>/bundle/` next to `index.html`, `bootstrap.js`, `report.css` and `charts.json` (the report's specs, with namespaces written as `[{spec, namespace}]`).
    3. Run `uv sync` in `examples/dravenpdf`.
    4. Start `uv run dravenpdf serve --port <free>` with a random `DRAVENPDF_API_KEY` and `DRAVENPDF_CHROMIUM_PATH`, and wait for `/readyz` 200 (30 s).
    5. POST with the §13 options (`paper: A4`, `media: print`, `print_background: true`, `prefer_css_page_size: true`, `wait_until: load`, `wait_for_ready_flag: true`, `fail_on_resource_errors: true`, `fail_on_page_errors: true`, `timeout_ms: 30000`).
    6. Write `evidence/pdf/report-slice1.pdf` and `report-slice1.json` (spec hashes, options, DravenPDF commit `7a249e0`, Chromium version, font hashes).
    7. Rasterize at 150 dpi with `pypdfium2`, which DravenPDF already depends on, into `evidence/pdf/pages/`.
    8. Locate each chart instance's **frame** (the box of its SVG, not its title) using the method recorded in `docs/plans/slice-1-pdf-probe-results.md` by Part A below. It is either `link-dest` (link annotation rect, with identity resolved through the link's destination) or `markers` (corner tokens with calibrated offsets). The driver refuses to run if the results file doesn't name a proven method.
       - It fails unless every report instance is found exactly once and each frame is 178 mm wide (±0.5 mm) with the aspect ratio 680 : 320 (±0.5 %).
       - Crop each frame rect from the 150 dpi page render into `evidence/pdf/crops/<namespace>.png`.
       - `report-slice1.json` records, per instance: `fixture`, `namespace`, `page` (1-based), `rectPt` `[x0, y0, x1, y1]` (PDF user space, bottom-left origin), `rectMm`, `method` and the crop file's SHA-256.
       - Title searches stay as *text-content* checks only, never as crop anchors.
    9. Run `tests/pdf/compare.ts` (§16.2 cross-path) against the browser print-theme render of the same fixture at the same physical size.
    10. Stop the server.
  - If the server cannot start, `library_fallback.py` renders the same bundle through `dravenpdf`'s Python bundle API, and the result is marked `path: "library"`.
  - Missing `uv`, Python 3.12 or Chromium prints `UNVERIFIED: <reason>` and exits with code 3.
- Report instrumentation (in the example report HTML only, never in the library):
  - Every chart SVG is wrapped in `<a class="dv-frame" href="#dvt-<namespace>" style="display:block">`, whose box is exactly the SVG box.
  - Each data table's caption contains `<span id="dvt-<namespace>" class="dv-token">DVT<namespace></span>`.
  - Each frame carries two absolutely positioned corner tokens, `DVF<namespace>TL` and `DVF<namespace>BR`.
  - Tokens are 1 pt text in the background color, and every PDF text check excludes text matching `^DV[FT]`.
- `bootstrap.js`:

```js
const res = await fetch('charts.json'); if (!res.ok) throw new Error(`charts.json ${res.status}`);
const entries = await res.json();
const targets = entries.map(e => document.querySelector(`[data-chart-slot="${e.namespace}"]`));
const handle = DravenViz.mountCharts(targets, entries.map(e => e.spec),
  { width: 680, height: 320, theme: 'print', namespaces: entries.map(e => e.namespace),
    locale: 'en-US', timezone: 'UTC', assetBaseUrl: './' });
await handle.ready;                       // rejection propagates as an uncaught page error
document.querySelectorAll('[data-chart-slot]').forEach(renderTable);   // DravenViz.renderDataTable
window.__DRAVENPDF_READY__ = true;
```

- `index.html`: `@page { size: A4; margin: 16mm }`. Chart slots are `width: 178mm`, the SVG is scaled to 100 % width with its aspect ratio preserved, and `break-inside: avoid` keeps each chart with its table.

**Part A — PDF frame-discovery probe (gate for step 8).** This runs before the report checks are relied on.

- [ ] **Step A1: Build the probe bundle** `examples/dravenpdf/probe/`. It holds 7 instances of `line-weekly-flow` (namespaces `p1`…`p7`) with forced page breaks, so they fall on 3 pages. The table captions (link targets) are in *reverse* order to the frames, which proves identity isn't taken from enumeration order.
  - Each frame also holds a ground-truth reference: an absolutely positioned `div` exactly covering the frame, with a `0.5pt solid #ff00ff` outline drawn inside its box. In the PDF it becomes a path object with stroke `#ff00ff`, whose bounds (`FPDFPageObj_GetBounds`, inset by half the stroke width) are the true frame rect.
- [ ] **Step A2: Measure both candidate methods** with `examples/dravenpdf/probe_frames.py`, which renders the probe through the same DravenPDF server and options.
  - **`link-dest`:** enumerate links per page (`FPDFLink_Enumerate`, `FPDFLink_GetAnnotRect`). Resolve each link's destination (`FPDFLink_GetDest`, or `FPDFAction_GetDest` on its action; then `FPDFDest_GetDestPageIndex` and `FPDFDest_GetLocationInPage`) to the `DVT<ns>` token whose char box contains or is nearest to that location (≤ 2 pt). Pass if all 7 namespaces resolve correctly and every link rect edge is within 0.25 pt of the ground-truth rect.
  - **`markers`:** find the `DVF<ns>TL`/`DVF<ns>BR` tokens. Compute the offset between each token's loose char box corner (`get_charbox(loose=True)`) and the ground-truth frame corner. Pass if, after subtracting the mean offset (`dx`, `dy` per corner type), every residual is ≤ 0.25 pt across all 7 instances and 3 pages.
- [ ] **Step A3: Record** `docs/plans/slice-1-pdf-probe-results.md`: the per-instance measurements, pass/fail per method, the chosen method (`link-dest` preferred when it passes), and for `markers` the calibrated `dx`/`dy` constants (also written to `examples/dravenpdf/frame_calibration.json`, which the driver reads). Keep the probe PDF under `evidence/pdf/probe/`. If neither method passes, stop and ask the owner before relying on crops.

**Part B — report checks.**

- [ ] **Step 1: Write the failing checks** in `run_pdf_check.py`:
  - The PDF is A4 (595 × 842 pt ± 1) and has ≥ 1 page.
  - Its text layer (`pypdfium2` `get_textpage`) contains every chart title the expected number of times. Each instance contributes its SVG title text *and* its data-table caption, so the count is instances × 2: `Items opened and closed` must appear 4 times for the two `line-weekly-flow` instances. The text layer must also contain `Partial week`, `Target`, `Not measured` and `Collection paused`. Every text match must fall inside its instance's frame rect or its table; this checks content, not crop position.
  - The chart crops compare within the calibrated cross-path tolerance.
  - **Logical labels.** The step-9 browser render of the same fixtures returns a label manifest per instance: every SVG `<text>` DravenViz draws carries `data-dv-label-id` and `data-dv-text-role` (`title | tick | axis-title | legend | annotation | reference | direct | note | caption`), and the manifest lists `{ labelId, role, text, rotate }` in DOM order.
    - In the PDF, the text objects inside each frame (`page.get_objects(filter=[FPDF_PAGEOBJ_TEXT], max_depth=16)`, which descends into form XObjects) are taken in content order, excluding `^DV[FT]` instrumentation tokens.
    - They are grouped into labels by concatenating consecutive objects until their whitespace-normalized text equals the next manifest label's text.
    - The check fails if any object is left unassigned or any manifest label is missing. The mapping gives every label its role.
  - **Effective font size** per label comes from its text objects, not glyph boxes: `effective_pt = FPDFTextObj_GetFontSize(obj) × sqrt(|a·d − b·c|)`, where `[a b c d e f]` is the object's `FPDFPageObj_GetMatrix` composed with every enclosing form object's matrix.
    - By role: `title` must be 12–14 pt; `tick`, `axis-title`, `legend`, `annotation`, `reference` and `direct` ≥ 9 pt; `note` and `caption` ≥ 8 pt. Each has a −0.05 pt tolerance for float rounding.
    - Each role must also agree within ±0.15 pt with `ReadyInfo.effectivePt` from the browser render.
  - **Geometry uses oriented regions, not enclosing rectangles.**
    - Each text object's region is its transformed quadrilateral (`FPDFPageObj_GetRotatedBounds`), and a label's region is the set of its objects' quads.
    - *Clipping:* every quad vertex of every label lies inside its frame rect and the page's printable area.
    - *Overlap:* for every pair of distinct labels in a frame, the intersection area of their quads, computed by convex polygon clipping (Sutherland–Hodgman), is ≤ 0.25 pt². Rotated tick labels whose axis-aligned boxes overlap therefore pass as long as their real regions don't.
  - `missing font fails the PDF render`: with `fonts/NotoSans-Regular.woff2` deleted from the bundle, the server responds 422 with code `render_incomplete`, and no PDF is written.
- [ ] **Step 2: Run** `pnpm test:pdf`. Expected: FAIL, because the bundle doesn't exist yet.
- [ ] **Step 3: Implement** the example files and the driver.
- [ ] **Step 4: Run** `pnpm test:pdf`. Expected: `PASS` with the evidence paths printed, or `UNVERIFIED` with exit code 3 if a prerequisite is missing. Never a silent pass.
- [ ] **Step 5: Commit** the example and the evidence. `feat(pdf): DravenPDF bundle example with real A4 PDF evidence`

---

### Task 17: Docs site shell (Start here and a working playground) and `test:docs`

**Files:**
- Create: `docs/site/{package.json,pnpm-lock.yaml,index.html,vite.config.ts}`, `docs/site/src/{main.tsx,App.tsx,routes/Start.tsx,routes/Playground.tsx,components/*.tsx,fixtures.ts,snippets.ts}`, `tests/docs/{docs.spec.ts,playwright.config.ts}`
- Test: `tests/docs/docs.spec.ts`

**Interfaces:**
- Consumes: only `@draven/viz`, `@draven/viz/react` and `@draven/viz/print` from the staged tarball (§16.1), plus fixture JSON copied into `docs/site/public/fixtures/` by `stage docs`, and the example snippets read at build time from `examples/**` through a Vite `?raw` import of files copied into the stage.
- Produces: the scripts `dev:docs`, `build:docs`, `preview:docs` and `test:docs`. `preview:docs` prints the actual URL, and `test:docs` parses it from stdout.
- Playground behavior (brief section "Playground and export behavior"):
  - A fixture selector limited to `gallery: true` slice-1 fixtures, plus `min-*` fixtures of unimplemented kinds, which show the `not-implemented-in-slice` error.
  - A CodeMirror JSON editor, **Validate**, **Render** and **Reset**, and theme, width, height, locale, timezone and font-mode controls.
  - Errors are listed with their `path`, and the input stays as typed.
  - After a failed edit, the last valid preview stays under the banner "Showing last valid render — not your current input".
  - A data table; a print preview at `178 mm` CSS width labelled "HTML print preview (not a PDF)".
  - SVG download through `renderToSvgWithAssets`, which awaits readiness and revokes the object URL after the click.
    - **The default download is a portable single file with embedded fonts** (`fontMode: "embedded"`), which opens correctly on its own.
    - "External fonts (smaller)" downloads a zip (built with `fflate`, a docs-only dependency) containing `chart.svg`, the exact font files listed in `SvgExport.fonts` under `fonts/`, the font licenses, and a `README.txt` explaining that `fonts/` must stay next to the SVG.
  - JSON download; copy options.
  - A link to `evidence/pdf/report-slice1.pdf`, copied into the stage, with its spec hash. It is labelled "Original fixture sample" whenever the current JSON's `specHash` differs.
- Start here: the environment matrix (§19), the install commands from §16.1, the first React chart and the plain HTML chart (snippets from `examples/`), the Python → DravenPDF quickstart (from `examples/dravenpdf/README.md`), and "What needs a DOM".

- [ ] **Step 1: Write the failing tests:**

```ts
test('start page shows install and all three quickstarts', async ({ page }) => { /* headings; snippet text equals examples file contents */ });
test('valid edit renders; invalid edit shows path and keeps input', async ({ page }) => {
  /* select line-weekly-flow; change title → Render → svg <title> updated;
     insert "colour":"red" → Validate → error list contains '/colour'; editor text still contains "colour";
     banner 'Showing last valid render' visible */
});
test('reset restores fixture', async ({ page }) => { /* … */ });
test('theme and size changes re-render', async ({ page }) => { /* dark → svg rect background fill equals dark bg; width 480 → viewBox 0 0 480 320 */ });
test('svg download matches current validated spec and options', async ({ page }) => {
  /* default download: file starts with <svg xmlns; contains edited title; no class=; contains data:font/woff2;base64;
     opened alone in a new page it renders with document.fonts.check('13px "Noto Sans"') true */
});
test('external-font zip is self-consistent', async ({ page }) => {
  /* zip has chart.svg, fonts/NotoSans-Regular.woff2, fonts/NotoSans-SemiBold.woff2, OFL.txt, README.txt;
     font sha256 equal PROVENANCE; unzipped chart.svg loads its fonts from ./fonts/ */
});
test('repeated render/export leaves no leaked mounts or object URLs', async ({ page }) => {
  /* 20 cycles; window.__dvCounts roots<=1; URL.createObjectURL minus revokeObjectURL === 0 */
});
test('keyboard: controls reachable and chart focusable', async ({ page }) => { /* Tab order reaches Render, chart root */ });
test('no external requests', async ({ page }) => { /* all requests same origin */ });
test('sample PDF link present with hash and labelled when edited', async ({ page }) => { /* … */ });
```

- [ ] **Step 2: Run** `pnpm test:docs`. Expected: FAIL.
- [ ] **Step 3: Implement** the site. No `eval` and no `dangerouslySetInnerHTML`: snippets render as text inside `<pre>`.
- [ ] **Step 4: Run** `pnpm test:docs`. Expected: PASS. Save screenshots of Start and Playground to `evidence/screenshots/`.
- [ ] **Step 5: Commit.** `feat(docs): documentation shell with Start here and playground on packed build`

**Milestone — proof path complete** (only if Task 16 reported `pass`; an `UNVERIFIED` PDF means the milestone isn't reached, and the report says so). One fixture now renders through React, plain HTML, a normalized standalone SVG, a real DravenPDF PDF and the docs playground, all from the packed tarball. Stop and report to the owner, with the evidence paths, before Task 18.

---

### Task 18: Clean-consumer package checks (`test:package`)

**Files:**
- Create: `tests/consumers/{react18,react19,core}/{package.json,index.*}`, `tests/package/run.ts`
- Test: `tests/package/run.ts` (the `test:package` driver)

**Interfaces:**
- Produces: `pnpm test:package`, which copies each consumer to `os.tmpdir()/dravenviz-consumer-*` and runs `npm install <tarball>` plus the consumer's pinned dependencies:
  - react18 installs `react@18.3.1 react-dom@18.3.1 react-is@18.3.1 vite@8.3.1`.
  - react19 installs the same three packages at `19.3.0`.
  - core installs nothing else.
- Assertions:
  - `node_modules/@draven/viz` is a real directory with no symlinks inside.
  - `react-is` major.minor equals `react`'s, and there is one copy each of `react` and `react-is` (`npm ls react react-is --all --json`). Recharts resolves that same `react-is` (its `require.resolve` from inside `recharts` matches the top-level path).
  - The React consumers build with Vite and run a Playwright smoke test (chart ready, `onReady` called).
  - The core consumer runs `node index.mjs`: it validates `min-line`, prints the rule and path of an invalid spec, and the Node loader trace shows neither `react` nor `recharts`. `publint` and `attw --pack` pass.
  - The plain-HTML check reuses Task 15's temp-directory test against the extracted tarball.

- [ ] **Step 1: Write the driver's assertions** as listed.
- [ ] **Step 2: Run** `pnpm test:package`. Expected: FAIL until the consumers exist.
- [ ] **Step 3: Implement** the consumers.
- [ ] **Step 4: Run** it. Expected: PASS, with the resolved versions printed.
- [ ] **Step 5: Commit.** `test(package): clean React 18/19 and core consumers from the tarball`

---

### Task 19: Visual references and tolerance calibration

**Files:**
- Create: `tests/visual/{visual.spec.ts,calibrate.ts,REVIEW.md,MISMATCHES.md}`, `tests/visual/baselines/candidates/*.png`
- Test: `tests/visual/visual.spec.ts`

**Interfaces:**
- Produces:
  - Candidate references: `line-weekly-flow@{light,dark,print}` at 680×320; `line-thinned-annotation@print`; `line-{singleton,all-equal,measured-zero,all-missing}@print`; `line-fixed-domain-clipped@print`; `line-estimated-monotone@{light,print}`; `line-category-labels-{wrap,rotate,thin}@print`.
  - For every fixture in `report-slice1`, the browser, standalone SVG and PDF crop (from Task 16) are shown side by side, so clipping indicators, estimated dashes and monotone curves are reviewed in all three outputs.
  - `pnpm visual:calibrate`, which renders each comparison type 10 times and writes the observed maxima and the derived allowed ratios (§16.2) to `REVIEW.md`.
  - `visual.spec.ts`, which compares against `baselines/approved/` only. When no approved baseline exists, the test reports `pending owner review` and fails, so CI stays red until approval.
- `REVIEW.md` records for each reference: fixture ID, spec hash, theme version, dimensions, font hashes, Recharts, React and Chromium versions, the DravenPDF commit, the rasterizer (`pypdfium2` version) and its dpi, a decision field (`pending | approved by <owner> on <date> | changes requested`) and any intentional mode differences. Nothing is ever self-approved (D4).

- [ ] **Step 1: Write** `visual.spec.ts` with the pending-review behavior and structural assertions (mark counts from the manifest, domain labels, and annotation position within 0.5).
- [ ] **Step 2: Run** `pnpm visual:calibrate && pnpm test:browser tests/visual`. Expected: FAIL with `pending owner review`.
- [ ] **Step 3: Generate the candidates.** Build a review page, `evidence/visual/index.html`, that shows each candidate next to its data table and PDF crop, and fill `REVIEW.md` with metadata and `pending`.
- [ ] **Step 4: Owner review gate.** The owner approves or requests changes in the PR; approved PNGs move to `baselines/approved/` in a commit that cites the review. Re-run: PASS.
- [ ] **Step 5: Commit** the candidates and records. `test(visual): slice-1 reference candidates and calibrated tolerances`

---

### Task 20: Size and latency measurement, and budgets

**Files:**
- Create: `scripts/measure-size.ts`, `scripts/measure-latency.ts`, `tests/harness/perf.html`, `evidence/perf/{size.json,latency.json,README.md}`
- Modify: `docs/design.md` §18 (the budgets table)

**Interfaces:**
- Produces: `pnpm measure`, which writes the following.
- **Size** (from the extracted tarball): raw and gzip bytes (level 9) of `dravenviz.browser.js`; raw bytes of each ESM entry; font bytes; the SVG bytes of each slice-1 fixture export in both font modes; the PDF bytes and page count of `report-slice1`.
- **Latency** (5 warm-up runs, then 30 measured samples, p50/p95 by the nearest-rank method):
  - P1: warmed `mountCharts` readiness of `perf-line-500x4` at 680×320 in a page with fonts preloaded, disposed between samples.
  - P2: a fresh page load until readiness, fonts included.
  - P4: `report-slice1` DravenPDF HTTP end to end, concurrency 1, server already warm.
- `README.md` records CPU model, cores, RAM, OS, Node, Chromium, Recharts and React versions and the font hashes.

- [ ] **Step 1: Write** `tests/unit/perf-report.test.ts`: the JSON files validate against a small schema with the required fields, `samples.length === 30` per scenario, and P1 p95 ≤ 250 ms. A miss fails the test with an explicit message, which must lead to investigation and not to a threshold change.
- [ ] **Step 2: Run** `pnpm measure && pnpm vitest run tests/unit/perf-report.test.ts`. Expected: FAIL until the scripts exist.
- [ ] **Step 3: Implement** both scripts. Then set the budgets in design §18 to the measured value + 20 %, rounded up (bundle gzip rounded to 10 KB, latency to 10 ms), with the basis written beside each budget.
- [ ] **Step 4: Run** again. Expected: PASS. If P1 misses, the test stays failing. Record the investigation in `evidence/perf/README.md` and ask the owner. Only an owner-accepted entry in `evidence/perf/EXCEPTIONS.md` (read by the test, with an expiry) turns the failure into a documented exception.
- [ ] **Step 5: Commit.** `perf: slice-1 size and latency measurements with budgets`

---

### Task 21: CI completion and verification matrix

**Files:**
- Modify: `.github/workflows/ci.yml` (add jobs `browser`, `package`, `docs` and `pdf`)
- Create: `evidence/verification-matrix.md`, `scripts/check-matrix.ts`
- Test: `tests/unit/matrix.test.ts`

**Interfaces:**
- CI jobs:
  - `browser`: `pnpm exec playwright install --with-deps chromium`, then `pnpm test:browser`.
  - `package`: `pnpm test:package`.
  - `docs`: `pnpm build:docs && pnpm test:docs`.
  - `pdf`: `astral-sh/setup-uv` with Python 3.12 and the Playwright Chromium path, then `pnpm test:pdf`. Exit code 3 fails the job with the "UNVERIFIED" annotation.
  - Visual tests run in `browser` and fail while any baseline is pending review.
- `verification-matrix.md` has one row per slice-1 requirement: the brief's items 1 and 7 (line parts), the "Open-item and inventory trends" coverage row (line part), and every Global Constraint. Each row lists fixture IDs, the command, artifact paths and a status of `pass | fail | unverified | pending-review`. `check-matrix.ts` verifies that every referenced fixture ID and artifact path exists.

- [ ] **Step 1: Write** `matrix.test.ts`: every row's fixtures exist in `FIXTURES`, every artifact path exists, and no row claims `pass` for PDF when `evidence/pdf/report-slice1.json` has `result != "pass"`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Write** the matrix from the actual results of Tasks 12–20, and complete the CI.
- [ ] **Step 4: Run** `pnpm lint && pnpm typecheck && pnpm check:drift && pnpm test && pnpm test:browser && pnpm test:package && pnpm build:docs && pnpm test:docs && pnpm test:pdf`, and record the real outcomes in the matrix.
- [ ] **Step 5: Commit.** `ci: full slice-1 pipeline and verification matrix`

---

## Slice-1 exit criteria

- The Task 1 spike passed, or its fallbacks were applied and approved by the owner.
- The proof-path milestone (after Task 17) was reported with evidence.
- All scripts in Task 21 Step 4 have actual recorded outcomes; nothing is reported as passing without a run. Visual references must be `approved` (`pending-review` keeps the slice open).
- P1 p95 ≤ 250 ms. A miss satisfies this criterion only through an **owner-accepted exception** recorded in `evidence/perf/EXCEPTIONS.md` (the measured value, the investigation, the cause, the accepted limit and its expiry, and the owner's approval in the PR). A recorded investigation alone doesn't count. Budgets are written into design §18.
- The PDF proof is complete only when `test:pdf` reports `pass`. `UNVERIFIED` (exit 3) or `fail` leaves the proof path and slice 1 **incomplete**. It is reported honestly, and the slice isn't closed until a real PDF passes in the documented environment.
- The slice-2 plan is written next, against design §21, reusing the interfaces produced here.
