# DravenViz V1 design

Date: 2026-09-30
Status: Revision 2, addressing the owner's design review of 2026-09-30 (export normalization, positioning ownership, clean-install sequence, readiness checks, percent-stack labels, datum names, custom-font export, `react-is`, `InvalidSpecError`, embedding identities, visual tolerances, CI browser install, provisional browsers). Draft for owner review. Implements `docs/spec.md` (the product brief). Where this document and the brief differ, the brief wins unless this document names the difference and the owner has approved it.

This document freezes the public contract, dependency versions, internal boundaries, fixtures and acceptance mapping for all four delivery slices. Slice plans (`docs/plans/`) implement it; a slice plan that needs a public API change updates this document first and goes back to the owner.

## 1. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                                                                      | Source                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| D1  | Planning: this design doc plus one detailed task plan per slice under `docs/plans/`. Slice 1 plan is written after this doc is approved; slices 2–4 are written when each starts.                                                                                                                                                             | Owner, 2026-09-30             |
| D2  | Package manager: pnpm 10 (`packageManager: "pnpm@10.33.0"`), committed `pnpm-lock.yaml`, clean install `pnpm install --frozen-lockfile`.                                                                                                                                                                                                      | Owner                         |
| D3  | React peer range for `@draven/viz/react`: `^18.3.0 \|\| ^19.0.0`, optional peers; CI tests React 18.3 and 19.x.                                                                                                                                                                                                                               | Owner                         |
| D4  | Visual baselines are accepted only by the owner in PR review; decisions are recorded in `tests/visual/REVIEW.md`. Candidates are never self-approved.                                                                                                                                                                                         | Owner                         |
| D5  | The hand-authored JSON Schema `schema/viz-spec-v1.schema.json` (draft 2020-12) is the source of truth. TypeScript types are generated from it; Ajv validates against it. CI fails on drift.                                                                                                                                                   | Owner                         |
| D6  | DravenPDF is consumed by `examples/dravenpdf/` as a uv project pinning `dravenpdf[server]` at git commit `7a249e0` of `Kryon-Consulting/dravenpdf`. DravenPDF is not modified.                                                                                                                                                                | Owner                         |
| D7  | Documentation site: Vite + React SPA with hash routing and CodeMirror 6, consuming the packed `@draven/viz` tarball.                                                                                                                                                                                                                         | Owner                         |
| D8  | Ownership split (revised after design review). DravenViz owns the *data meaning*: domains, ticks, stack membership and per-member contributions (including percent shares), gap and line-membership segmentation, bubble radii, colors, labels and layout boxes. Recharts owns *pixel placement* of its marks (band offsets, bar widths, stacking positions) given those inputs. DravenViz overlays (annotations, reference labels, quality markers, focus ring, empty/unavailable placeholders) read the same scales through Recharts' public hooks. Geometry tests compare rendered mark coordinates with DravenViz's own expected scale positions, so a future renderer replacement has an oracle. | Owner-approved design, revised |
| D9  | Recharts `3.10.1` (npm `latest` on 2026-09-30; `3.11.0-canary.*` is excluded). Exact version pinned, not a range, because internals are rendered into exported SVG.                                                                                                                                                                          | This doc                      |
| D10 | TypeScript `6.0.x` for development. TypeScript 7 drops the JavaScript compiler API that declaration bundling uses. Emitted declarations are checked against consumer TS `>=5.4`.                                                                                                                                                              | This doc                      |
| D11 | One Chromium for all browser, visual, docs and PDF checks: Chromium `141.0.7390.37` (Playwright revision 1194). `@playwright/test` pinned to `1.56.1`, which drives that revision. DravenPDF runs with `DRAVENPDF_CHROMIUM_PATH` pointing at the same binary.                                                                                 | This doc                      |
| D12 | Default font: Noto Sans from `notofonts/latin-greek-cyrillic` tag `NotoSans-v2.015`, weights 400 and 600, shipped as WOFF2 with SHA-256 hashes, provenance and OFL-1.1 license. Latin, Greek and Cyrillic coverage only; other scripts need a caller font.                                                                                     | This doc                      |
| D13 | Original DravenViz code has no chosen license. `package.json` sets `"private": true` and `"license": "UNLICENSED"`; publishing is blocked until the owner decides.                                                                                                                                                                            | Spec                          |
| D14 | Plain text only. No spec field accepts markup, CSS, URLs or code. Text that looks like markup (for example `</text><script>`) is valid and is displayed literally. "Reject raw markup" is satisfied because there is no markup-bearing field; unknown fields are rejected.                                                                  | Resolves a brief ambiguity    |
| D15 | Time semantics: date-only strings (`2026-07-06`) are calendar days, positioned and formatted as UTC days regardless of options. Date-time strings must carry `Z` or an offset; they are absolute instants formatted in the `timezone` render option (default `"UTC"`). The machine timezone is never read.                                         | Resolves a brief ambiguity    |
| D16 | `percent` number format treats raw values as percentage points (`45.2` displays as `45.2%`). Fractions must be converted by the caller.                                                                                                                                                                                                         | This doc                      |

## 2. Repository layout

```text
dravenviz/
  package.json                 private, UNLICENSED, exports map (section 3)
  pnpm-lock.yaml               the library's own lockfile; the root is the only pnpm project
                               (no pnpm-workspace.yaml). docs/site, examples/react and
                               tests/consumers/* are consumer templates, never workspace members
                               (section 16.1)
  .pack/  .stage/              gitignored: packed tarball; staged consumer installs
  .nvmrc                       22.22
  tsconfig.base.json  tsconfig.json  tsconfig.build.json
  tsup.config.ts               ESM + d.ts for the three entry points
  scripts/
    gen-types.ts               schema -> src/core/spec/types.gen.ts
    gen-validator.ts           schema -> src/core/validate/ajv.gen.js (Ajv standalone)
    check-drift.ts             regenerates into a temp dir and diffs
    build-browser.ts           esbuild IIFE -> dist/dravenviz.browser.js
    fetch-font.ts              one-time: downloads NotoSans-v2.015, verifies, writes assets/fonts
    build-manifest.ts          dist/asset-manifest.json
    measure-size.ts  measure-latency.ts
  schema/viz-spec-v1.schema.json
  assets/fonts/                NotoSans-Regular.woff2, NotoSans-SemiBold.woff2, noto-sans.css,
                               OFL.txt, PROVENANCE.md (tag, commit, source path, sha256)
  src/
    core/                      no DOM, no React
      spec/                    types.gen.ts, index.ts (re-exports, kind guards)
      validate/                validateSpec, semantic rules, limits, errors mapping
      theme/                   tokens, light/dark/print, resolveTheme, overrides validation
      format/                  number/date formatting (Intl), time parsing
      table/                   toDataTable
      errors.ts                DravenVizError, codes
      index.ts
    render/                    private; never exported from package.json
      model/                   buildModel per kind: scales, ticks, stacks, segments, sizes
      layout/                  text measurement interface, label policies, box layout
      fonts/                   FontFace loading and verification
      recharts/                cartesian, donut adapters (only place that imports recharts)
      primitives/              heatmap, progress, legend, title, annotation, patterns, markers
      svg/                     export: clone, sanitize, allowlist, namespace ids, embed fonts
      ChartView.tsx            model + layout -> React SVG tree (dispatch by kind)
    react/                     Chart component, interaction, DataTable component
    print/                     mountCharts, renderToSvg, lifecycle, data table DOM helper
    browser/                   IIFE entry: window.DravenViz
  fixtures/
    valid/<fixture-id>.json    one spec per file
    invalid/<fixture-id>.json  plus <fixture-id>.expected.json (code, path)
    reports/<report-id>.json   ordered spec lists for multi-chart pages
    index.ts                   typed fixture catalog (id, family, modes, coverage rows)
  examples/
    react/                     Vite React app, installs the packed tarball
    html/                      plain HTML, copies dist assets, two pages (basic, host-isolation)
    dravenpdf/                 pyproject.toml (uv), client.py, bundle/ (index.html, bootstrap.js,
                               report.css), README.md
    themes/security.json       example theme override with severity roles (not in core)
  tests/
    unit/                      Vitest, Node environment
    browser/                   Playwright specs against a static test harness page
    visual/                    baselines/<fixture>@<theme>.png, REVIEW.md, MISMATCHES.md
    package/                   npm pack + clean consumer install checks
    consumers/react/  consumers/core/   templates copied outside the tree at test time
    pdf/                       Python + Playwright driver for DravenPDF checks
    harness/                   static page used by browser tests (loads dist bundle)
  evidence/                    committed release evidence (section 17)
  docs/
    spec.md  design.md  plans/  site/
```

Dependency rules, enforced by ESLint `no-restricted-imports` and a test that scans the built ESM:

- `src/core/**` imports nothing from `src/render`, `src/react`, `src/print`, `react`, `recharts` or DOM globals (`lib: ["ES2022"]` in its tsconfig, no `DOM`).
- `recharts` is imported only under `src/render/recharts/**`.
- `src/react` and `src/print` import `src/render` but never each other.
- Public `.d.ts` files mention no `recharts` type (checked by grepping `dist/**/*.d.ts`).

## 3. Package surfaces

```json
{
  "name": "@draven/viz",
  "version": "0.1.0",
  "private": true,
  "license": "UNLICENSED",
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    ".":            { "types": "./dist/core/index.d.ts",  "import": "./dist/core/index.js" },
    "./react":      { "types": "./dist/react/index.d.ts", "import": "./dist/react/index.js" },
    "./print":      { "types": "./dist/print/index.d.ts", "import": "./dist/print/index.js" },
    "./browser":    "./dist/dravenviz.browser.js",
    "./styles.css": "./dist/dravenviz.css",
    "./schema.json":"./schema/viz-spec-v1.schema.json",
    "./asset-manifest.json": "./dist/asset-manifest.json",
    "./fonts/*":    "./assets/fonts/*",
    "./package.json": "./package.json"
  },
  "files": ["dist", "schema", "assets", "README.md", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"],
  "engines": { "node": ">=20.19" },
  "dependencies": { "recharts": "3.10.1" },
  "peerDependencies": { "react": "^18.3.0 || ^19.0.0", "react-dom": "^18.3.0 || ^19.0.0",
                        "react-is": "^18.3.0 || ^19.0.0" },
  "peerDependenciesMeta": { "react": { "optional": true }, "react-dom": { "optional": true },
                            "react-is": { "optional": true } }
}
```

`react-is` compatibility: Recharts 3.10.1 declares `react-is` as a peer and its README requires it to match the installed `react`. DravenViz forwards that requirement.

- **React consumers** install `react`, `react-dom` and `react-is` at the same major.minor (documented in README and Start here). For React 18 that is `react@18.3.1 react-dom@18.3.1 react-is@18.3.1`; for React 19 it is `19.x` of all three.
- **`test:package`** checks the React 18 and React 19 consumers after install. `react-is/package.json` must share major.minor with `react/package.json`, exactly one copy of each must exist in `node_modules`, and Recharts must resolve that copy. Startup fails with the resolved versions if any check fails.
- **Development** pins `react`, `react-dom` and `react-is` at `19.3.0`.
- **Browser bundle** embeds `react`, `react-dom` and `react-is` at `19.3.0`. They are isolated inside the IIFE and never read from or written to globals, so a host page's own React is unaffected (checked by the host-isolation example, which loads React 18 on the page).
- **Core-only consumers** don't need React or `react-is`. With npm, optional peers are not installed, and the core consumer test asserts that neither `react` nor `recharts` is loaded by `import "@draven/viz"`.

Ajv is a development dependency only: `scripts/gen-validator.ts` emits Ajv standalone code and bundles its `ajv/dist/runtime/*` helpers into `src/core/validate/ajv.gen.js`, so the package has no runtime `ajv` dependency (checked by `test:package` resolving the core consumer's module graph). `recharts` is a runtime dependency of `./react` and `./print`; core consumers get it installed but never load it (verified by the core consumer test importing `@draven/viz` with `--conditions` and checking no `recharts` module is resolved).

| Surface                         | Exports                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@draven/viz`                   | Types `VizSpec`, `CartesianSpec`, `DonutSpec`, `HeatmapSpec`, `ProgressSpec` and their parts; `validateSpec`, `isValidSpec`; `themes`, `resolveTheme`, theme types; `toDataTable`; `DravenVizError`, `InvalidSpecError`, `ErrorCode`; `DEFAULT_LIMITS`; `SCHEMA_VERSION`; `version` |
| `@draven/viz/react`             | `Chart`, `ChartProps`, `DatumEvent`, `ReadyInfo`, `DataTable`, `DataTableProps`                                                                                      |
| `@draven/viz/print`             | `mountCharts`, `renderToSvg`, `renderToSvgWithAssets`, `renderDataTable`, `MountOptions`, `ExportOptions`, `SvgExport`, `MountHandle`                                                                      |
| `dist/dravenviz.browser.js`     | `window.DravenViz = { mountCharts, renderToSvg, renderToSvgWithAssets, renderDataTable, validateSpec, toDataTable, InvalidSpecError, version }`; bundles its own React 19, ReactDOM and Recharts                  |
| `dist/dravenviz.css`            | Styles for HTML around the SVG (focus ring, tooltip, visually-hidden table, missing-state text) scoped under `.dravenviz-root`                                        |

The React adapter is compiled with `react/jsx-runtime` external. SSR import safety: no DOM access at module top level in `react` and `render`; covered by a Node import test.

## 4. Architecture

```text
unknown JSON ──validateSpec──▶ VizSpec ──buildModel(spec, RenderContext)──▶ ChartModel (DOM-free)
                                                         │
                         measureText (canvas, after fonts)│
                                                         ▼
                                        layoutChart(model, box, theme, measure) ──▶ LaidOutChart
                                                         │
                          ┌──────────────────────────────┴──────────────┐
                    render/recharts (Cartesian, donut)          render/primitives (heatmap, progress,
                    fed domains/ticks/contributions;             title, legend, annotations, notes)
                    places marks (bands, stacks)
                          └──────────────▶ one <svg> per chart ◀────────┘
                                                         │
                         react: interactive host         │  print: fixed size, static labels
                                                         ▼
                                          render/svg: exportSvg() ──▶ standalone SVG text
```

Units and their contracts:

| Unit                  | Responsibility                                                                                     | Depends on             |
| --------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| `core/validate`       | Schema + semantic validation, limits, error paths. Pure; never mutates input (input is deep-frozen in tests). | `core/spec`            |
| `core/theme`          | Token tree, built-in themes, typed overrides, role resolution                                      | –                      |
| `core/format`         | `formatNumber`, `formatTime`, `parseTimeValue` via `Intl`, explicit locale/timezone                | –                      |
| `core/table`          | `toDataTable(spec, options)` projection used by React, print and docs                              | `core/format`          |
| `render/model`        | Per-kind `buildModel`: scales, nice ticks, stack contributions, segments, markers, sizes, color scales, arcs, state flags (`empty`, `unavailable`), expected-mark manifest | core                   |
| `render/layout`       | Boxes for title, legend, axes, plot, notes; wrap/rotate/thin label policies; `LAYOUT_ERROR`       | model, `TextMeasurer`  |
| `render/fonts`        | Load `FontFace`s from `assetBaseUrl` or caller `fonts`, verify with `document.fonts.check`         | DOM                    |
| `render/recharts`     | Draw Cartesian and donut from a `LaidOutChart`; animation off; no Recharts tooltip or legend       | recharts, react        |
| `render/primitives`   | Heatmap, progress, title, legend, annotations, notes, marker shapes, patterns                      | react                  |
| `render/svg`          | `exportSvg(svgEl, opts)`: clone, sanitize, namespace IDs, embed fonts, serialize                   | DOM                    |
| `react`               | Container sizing (own `ResizeObserver`), readiness token, interaction, tooltip, keyboard          | render                 |
| `print`               | Batch mount, lifecycle, timeouts, disposal, offscreen export                                       | render                 |

`RenderContext` = `{ theme: ResolvedTheme, width, height, locale, timezone, mode: "interactive" | "static", printWidthMm?: number }`.

Recharts usage rules (`src/render/recharts`):

- All Cartesian specs render through `ComposedChart` (`layout="vertical"` for horizontal bars); donut through `PieChart` with `startAngle=90`, `endAngle=-270`.
- `isAnimationActive={false}` on every mark. No `ResponsiveContainer`, `Tooltip` or `Legend` from Recharts.
- Axes receive `type="number"`, explicit `domain=[min,max]`, `ticks=[...]`, `allowDataOverflow` only when the model selected an indicated clipping mode, `scale="linear"`. Category axes receive the category key list and `interval={0}` with DravenViz-provided tick renderers.
- **Grouping and stacking.** Grouped bars are separate `Bar`s without `stackId`; Recharts places them side by side in the category band. Stacked bars and areas use Recharts `stackId` so they share one band position. They are fed DravenViz-computed contributions: raw values for absolute stacks (`stackOffset="sign"`, so positives stack up and negatives down), and shares (value / total × 100) for percent stacks (`stackOffset="none"`). Recharts' `stackOffset="expand"` is never used, because it would renormalize a stack with a missing member. Unavailable or empty categories feed `null` for every member and draw a DravenViz placeholder instead.
- **Overlays.** Annotations, reference-line labels, quality markers, placeholders and the focus ring are chart children that call the public hooks `useXAxisScale`, `useYAxisScale` and `usePlotArea`. They never read Recharts DOM, class names or private state.
- Custom marks and labels use documented extension points only: `shape`, `dot`, `label`, `tick` render props, public hooks and SVG children of the chart.
- **Host-style isolation.** CSS rules beat SVG presentation attributes, so a host rule like `text { fill: red }` would restyle a chart drawn only with attributes. In the live DOM, DravenViz therefore sets visual properties (`fill`, `stroke`, `stroke-width`, `stroke-dasharray`, `opacity`, `font-family`, `font-size`, `font-weight`) as inline `style` on every element it draws. For Recharts elements it does the same through the `style` prop wherever Recharts forwards it, which the spike verifies per component. The guarantee: host rules without `!important` (type, class or universal selectors, inherited `font-family`, `zoom`) do not change chart rendering. Host `!important` rules are documented as out of scope, since only shadow DOM could block them and that would complicate print and export. Export normalization (section 10) turns these inline styles into attributes.
- **Slice 1 spike (Task 1).** A throwaway harness page on Chromium 141 confirms these points in Recharts 3.10.1, with a pass/fail table in `docs/plans/slice-1-spike-results.md`:
  1. Arbitrary SVG children and hook-based overlays render inside the surface, aligned with the marks to within 0.5 logical units.
  2. Grouped bars sit side by side, and `stackId` bars and areas share a band position, with explicit domains and `sign` offsets.
  3. `null` members produce gaps (not zero-height marks) in bars, lines and stacked areas.
  4. With animation disabled, the first commit already has the final geometry.
  5. A real exported chart passes the section 10 normalizer and strict allowlist, and the spike records the inventory of attributes Recharts actually emits.

  If point 1 fails, the fallback nests the Recharts surface in a DravenViz outer `<svg>` for composition. If 2, 3 or 4 fails for a mark type, that mark type is drawn by `render/primitives` from DravenViz scales instead. Composition alone does not fix unsupported geometry. Either change is recorded in section 4 before slice 2.

## 5. Chart specification (schema v1)

Common conventions:

- `id` fields: `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, unique within their collection (series, points in a series, categories, slices, rows, columns, items, annotations, reference lines, roles).
- Text fields: strings, 1–500 characters (`title` 1–200, `description` 0–2000), no control characters except `\n` in `description`/`caption`/`detail`. Always rendered as text.
- Numbers: JSON numbers that are finite. `Infinity` produced by JSON parsing (for example `1e400`) is rejected with `non-finite-number`. Quantities that may be missing use `number | null`.
- Colors: `^#[0-9a-fA-F]{6}$` only.
- `additionalProperties: false` everywhere.

### 5.1 Shared parts

```ts
type SchemaVersion = 1;

interface SpecBase {
  schemaVersion: 1;
  id: string;
  kind: "cartesian" | "donut" | "heatmap" | "progress";
  title: string;
  description?: string;          // chart summary; used for <desc> and table caption
  caption?: string;              // printed footnote under the chart (≥8 pt in print)
  roles?: Record<string, RoleDef>;   // caller-defined semantic roles
  legend?: LegendOptions;
}

interface RoleDef {              // no business meaning in core
  label?: string;                // legend/table label for the role
  color?: string;                // #RRGGBB; else a theme palette slot
  pattern?: "none" | "diagonal" | "dots" | "crosshatch";
  shape?: MarkerShape;
}

type MarkerShape = "circle" | "square" | "triangle" | "diamond" | "cross" | "none";
type Dash = "solid" | "dashed" | "dotted";
type Quality = "measured" | "partial" | "lagging" | "estimated";

interface NumberFormat {
  style?: "decimal" | "percent" | "currency" | "compact";   // default "decimal"
  currency?: string;             // ISO 4217, required when style = "currency"
  minimumFractionDigits?: number;  // 0–6
  maximumFractionDigits?: number;  // 0–6, default 0 for integers-only data else 1
  signDisplay?: "auto" | "always" | "exceptZero";
}

interface LegendOptions {
  show?: "auto" | "always" | "never";   // auto: shown when >1 series/slice/role
  position?: "top" | "bottom";          // default "bottom"
}
```

Styling precedence for a datum: datum `color` > datum `role` > series `color` > series `role` > theme palette slot by series index. A role's color comes from `roles[id].color`, else the theme's `roles[id]` (supplied by a caller theme override), else a palette slot. Roles referenced but not defined in the spec's `roles` are errors (`unknown-role`).

### 5.2 Cartesian

```ts
interface CartesianSpec extends SpecBase {
  kind: "cartesian";
  orientation?: "vertical" | "horizontal";   // default vertical; horizontal = categories on the
                                             // vertical axis, allowed only when every series is "bar"
  preset?: "standard" | "sparkline" | "compact-stack";   // default "standard"
  xAxis: CategoryAxis | LinearAxis | TimeAxis;
  yAxes: ValueAxis[];                        // 1–2
  series: Series[];                          // 1–16
  stacking?: {                               // applies to series sharing a stackId
    mode: "absolute" | "percent";
    valueUnit?: string;                      // percent only: unit of the raw member values
                                             // (e.g. "items"); required when mode = "percent"
    segmentLabels?: "none" | "share" | "value" | "value-and-share";   // default "none";
                                             // percent default "share"
  };
  bubble?: BubbleEncoding;                   // required if any scatter point has `size`
  referenceLines?: ReferenceLine[];          // 0–16
  annotations?: Annotation[];                // 0–16
  labels?: { values?: "none" | "totals" | "all" };  // static value labels; default "none"
}

interface CategoryAxis {
  id: string; scale: "category";
  categories: string[];          // 1–250 unique keys, display order
  labels?: string[];             // same length; displayed verbatim; default = categories
  label?: string;                // axis title
  labelPolicy?: "auto" | "wrap" | "rotate";   // default auto: wrap to 2 lines, then rotate 45°
}

interface LinearAxis {
  id: string; scale: "linear";
  label?: string; unit?: string; format?: NumberFormat;
  domain?: Domain;               // default { policy: "fit" }
}

interface TimeAxis {
  id: string; scale: "time";
  label?: string;
  domain?: { min?: string; max?: string };   // ISO values; default = data extent
  tickFormat?: "auto" | "day" | "week" | "month" | "quarter" | "year" | "hour";
}

interface ValueAxis {
  id: string;
  label?: string;
  unit?: string;                 // shown in axis title "(unit)", tooltips and table headers
  format?: NumberFormat;
  position?: "left" | "right";   // default: first left, second right (horizontal: bottom/top)
  domain?: Domain;               // default include-zero if the axis carries bars, else fit
  ticks?: { count?: number; values?: number[] };   // count 2–10, default nice 4–6
}

type Domain =
  | { policy: "include-zero" }                      // nice extent including 0
  | { policy: "fit" }                               // nice extent of data; forbidden for bar axes
  | { policy: "fixed"; min: number; max: number;
      overflow?: "error" | "clip-indicated" };      // default "error"

interface Series {
  id: string;
  label: string;
  mark: "bar" | "line" | "area" | "scatter";
  yAxisId: string;
  role?: string; color?: string;
  stackId?: string;              // bar or area only; members of a stack share mark and axis
  interpolation?: "linear" | "monotone";   // line/area; default linear
  dash?: Dash;                   // line; default from theme series style slot
  marker?: { shape?: MarkerShape; show?: "all" | "none" | "quality" };  // default: line "quality",
                                                                         // scatter "all"
  points: Point[];               // category axis: one per category at most; any order is an error
                                 // unless it matches categories order
}

interface Point {
  id: string;
  x: string | number;            // category key, number, or ISO time string
  value: number | null;          // y; null = missing
  displayValue?: string;         // label text; geometry never uses it
  quality?: Quality;             // default "measured"
  renderHint?: "line" | "marker-only" | "gap";   // default "line"
  role?: string; color?: string;
  shape?: MarkerShape;           // scatter status shape override
  size?: number | null;          // scatter only; requires `bubble`
  datumLabel?: string;           // human-readable name (e.g. "Payments API"); used by static
                                 // labels, tooltips, keyboard announcements and data tables.
                                 // Default: category label (category x) or the formatted x value
  staticLabel?: boolean;         // show this point's static label in static mode (and in
                                 // interactive mode when the Chart prop staticLabels is true).
                                 // Label text: datumLabel, else displayValue/formatted value
  note?: string;                 // per-point explanation shown in table/tooltip
}

interface BubbleEncoding {
  mode: "area" | "radius";       // "area" recommended
  domain: [number, number];      // size values mapped; 0 <= min < max
  range: [number, number];       // logical px radius at domain min/max; min >= 0
  minVisibleRadius?: number;     // default 2; drawn hollow when mapped radius < this (disclosed in legend)
}

interface ReferenceLine {
  id: string; axisId: string;    // any x or y axis id
  value: number | string;        // string for category/time x
  label?: string; dash?: Dash; role?: string;
}

interface Annotation {
  id: string;
  x: string | number;            // position on the x scale (independent of visible ticks)
  x2?: string | number;          // band end
  yAxisId?: string; y?: number;  // optional point marker bound to a named y axis
  label: string;                 // short on-chart text
  detail?: string;               // longer explanation, printed as a numbered note in static mode
}
```

Cartesian semantics (normative for the model and tests):

- **Gaps.** `value: null` or `renderHint: "gap"` draws no mark and breaks line/area membership. `renderHint: "marker-only"` draws a marker at the value and breaks membership on both sides. `"line"` with `quality: "lagging"` stays in the line and gets the quality marker. Quality never changes membership by itself.
- **Isolated points are always visible.** A measured point with no connected neighbor on either side (a singleton series, or a value between two gaps) is drawn as a marker even when `marker.show` is `"none"`. Otherwise a one-point line segment would be invisible.
- **Stacked areas with a missing member.** If any member of an area stack is null at an x position, every member of that stack has a gap there: the layers above would otherwise have no defined baseline. The data table marks the position "Unavailable (missing member)".
- **Quality markers.** `partial` = hollow marker, `lagging` = marker with outer ring, `estimated` = dashed segment into and out of the point. Each quality present is listed in the legend with its meaning; tables show the quality word.
- **Allowed combinations.** `renderHint` is valid on line/area points only; `size` on scatter only; `renderHint: "marker-only"` with `value: null` is an error (`marker-without-value`).
- **Bars.** Axes carrying bars resolve to include zero. A `fixed` domain excluding zero or any bar value is `bar-domain-excludes-data` unless `overflow: "clip-indicated"`, which draws a break marker at the clipped end and adds a note. Negative bars grow from zero.
- **Grouping and stacking.** Bars without `stackId` in the same category are grouped in series order. Series sharing `stackId` stack in series order.
  - Absolute stacks: positive values stack up from zero, negatives stack down from zero. Null members leave a gap in the stack and mark the category total as partial in labels and tables.
  - Percent stacks: all values must be `>= 0` (`negative-in-percent-stack`). If any member is null, the category is **unavailable**: no segments, a dashed outline bar and the text "Unavailable" (theme string). If the total is zero, the category is **empty**: a baseline tick and the text "No data (0)". Otherwise segments are value / total × 100 with exact geometry; no minimum segment size.
- **Scales.** Category positions are equally spaced in `categories` order. Linear and time x axes use actual distances. Bars are allowed only on category axes.
- **Domains.** `fit` pads to nice numbers; a flat series (all values equal, or a single point) gets a symmetric ±1 unit (or ±10 % of |value|) extent; empty data gets `[0, 1]` and the empty state.
- **Two y axes.** Each series, reference line and annotation marker binds to a named axis. The two axes never merge units. Each axis title shows its unit.
- **Labels.** Value labels use `displayValue` if present, else the axis format. `labels.values: "totals"` labels stack totals and ungrouped bars. `staticLabel: true` on a scatter point requires a `datumLabel` (`static-label-without-name`), so a selected label never shows a machine ID.
- **Percent stack values vs shares.** Geometry always uses shares, and labels, tooltips and tables say explicitly which number they show. For members `10` and `30`:
  - Segments span `[0, 25]` and `[25, 100]` on the 0–100 % axis (shares 25 % and 75 %).
  - Segment labels read `25%` and `75%` (`share`), or `10 items (25%)` (`value-and-share`).
  - Tooltips always show both, for example "Open: 10 items (25% of 40)".
  - The data table has a raw column per series, "Open (items)", plus a share column, "Open share (%)", plus a "Total (items)" column.

  The y axis bound to a percent stack is dedicated to it: the domain is implicitly `[0, 100]` with the percent format and title suffix "(% of total)". The axis must not declare `domain`, `format` or `unit` (`percent-axis-configured`). No other series (another stack, a line or a bar) may bind to that axis (`percent-axis-shared`). Other series can use the chart's second y axis, which keeps its own unit, so a percent composition plus a line on a count axis is allowed.
- **Presets.** `sparkline`: line/area only, one y axis, no axes, grid or legend. The graphic keeps a one-line series label with the last value and unit, and first/last value labels; `<desc>` and the data table state "Sparkline: axes and legend omitted". `compact-stack`: percent-stacked horizontal bars without axes; legend always shown with values.
- **Order.** Series and points are never sorted. Category-axis points out of category order are rejected (`point-order`). Linear/time points must be ascending in `x` for line/area (`point-order`); scatter points may be in any order.

### 5.3 Donut

```ts
interface DonutSpec extends SpecBase {
  kind: "donut";
  slices: Slice[];               // 1–32, drawn clockwise from 12 o'clock in given order
  unit?: string; format?: NumberFormat;
  center?: { value?: "total" | "none" | string; label?: string };  // default { value: "total" }
  legendValues?: "none" | "value" | "value-share";   // default "value-share"
}

interface Slice {
  id: string; label: string;
  value: number | null;          // >= 0; null = missing
  displayValue?: string; role?: string; color?: string;
}
```

- Negative values are rejected (`negative-slice`).
- **All zero:** a neutral full ring, center "0" and the note "No items (total 0)". Shares show "–".
- **Any null:** the distribution is incomplete. No slice arcs are drawn: a dashed track shows the unavailable state, the center shows "Incomplete", and the legend lists known values without shares plus "Not measured" rows. No percentage is claimed.
- Tiny slices keep their true angle. Slices below 3 % get no inline label; the legend carries value and share. Segment boundaries use a 1 px background-colored stroke so adjacent slices stay distinct in grayscale.

### 5.4 Heatmap

```ts
interface HeatmapSpec extends SpecBase {
  kind: "heatmap";
  rows: { id: string; label: string }[];      // 1–100, top to bottom
  columns: { id: string; label: string }[];   // 1–100, left to right; rows × columns <= 2500
  cells: { row: string; column: string; value: number | null;
           displayValue?: string; note?: string }[];   // exactly one per row×column pair
  scale: {
    type: "sequential" | "diverging" | "threshold";
    domain: number[];            // sequential: [min, max]; diverging: [min, mid, max];
                                 // threshold: ascending breakpoints (n)
    colors: string[];            // sequential: 2+ stops; diverging: 3+; threshold: n + 1
  };
  unit?: string; format?: NumberFormat;
  cellLabels?: "all" | "none";   // default "all"
  rowAxisLabel?: string; columnAxisLabel?: string;
}
```

- A missing pair is `missing-cell`. A duplicate pair is `duplicate-cell`.
- Null cells get a hatched pattern and "–", distinct from measured zero, which uses the scale color at 0 and "0". Values outside a sequential/diverging domain are errors (`value-outside-scale`); threshold scales cover all values.
- Label text color is black or white, whichever has the higher WCAG contrast against the cell fill.
- The scale legend (gradient or stepped swatches with domain labels, plus a "Not measured" swatch) is always shown.

### 5.5 Progress

```ts
interface ProgressSpec extends SpecBase {
  kind: "progress";
  variant: "bar" | "ring";
  domain: { min: number; max: number };   // min < max, required
  overflow?: "error" | "clip-indicated";   // default "error"
  unit?: string; format?: NumberFormat;
  items: ProgressItem[];                   // bar: 1–20 (stacked rows); ring: 1–6 (one row)
}

interface ProgressItem {
  id: string; label: string;
  value: number | null; displayValue?: string;
  target?: number | null; targetLabel?: string;
  role?: string; color?: string;
}
```

- Values and targets outside the domain are errors (`outside-progress-domain`) unless `overflow: "clip-indicated"`, which clips the fill and draws a chevron at the track end plus a note.
- Null values draw a dashed empty track and "Not measured". Zero draws an empty solid track and the formatted zero ("0%").
- The target marker is a perpendicular tick on bars and a radial tick on rings, labelled with `targetLabel`, or "Target" plus the formatted target.

### 5.6 Minimal fixtures per family

Every family has a complete minimal fixture under `fixtures/valid/`. These are the canonical examples used in docs, schema tests and snapshot tests:

```json
{"schemaVersion":1,"id":"min-bar","kind":"cartesian","title":"Items by region",
 "xAxis":{"id":"region","scale":"category","categories":["north","south"],"labels":["North","South"]},
 "yAxes":[{"id":"count","label":"Items","unit":"count","domain":{"policy":"include-zero"}}],
 "series":[{"id":"items","label":"Items","mark":"bar","yAxisId":"count",
   "points":[{"id":"n","x":"north","value":4},{"id":"s","x":"south","value":0}]}]}
```

```json
{"schemaVersion":1,"id":"min-line","kind":"cartesian","title":"Daily total",
 "xAxis":{"id":"day","scale":"time"},
 "yAxes":[{"id":"v","label":"Total","unit":"count"}],
 "series":[{"id":"t","label":"Total","mark":"line","yAxisId":"v",
   "points":[{"id":"a","x":"2026-07-01","value":3},{"id":"b","x":"2026-07-02","value":null},
             {"id":"c","x":"2026-07-03","value":5}]}]}
```

```json
{"schemaVersion":1,"id":"min-area","kind":"cartesian","title":"Inventory",
 "xAxis":{"id":"m","scale":"category","categories":["jan","feb"]},
 "yAxes":[{"id":"n","unit":"assets","domain":{"policy":"include-zero"}}],
 "stacking":{"mode":"absolute"},
 "series":[{"id":"a","label":"Servers","mark":"area","yAxisId":"n","stackId":"s",
   "points":[{"id":"a1","x":"jan","value":10},{"id":"a2","x":"feb","value":12}]},
  {"id":"b","label":"Laptops","mark":"area","yAxisId":"n","stackId":"s",
   "points":[{"id":"b1","x":"jan","value":5},{"id":"b2","x":"feb","value":6}]}]}
```

```json
{"schemaVersion":1,"id":"min-composed","kind":"cartesian","title":"Revenue and margin",
 "xAxis":{"id":"q","scale":"category","categories":["q1","q2"],"labels":["Q1","Q2"]},
 "yAxes":[{"id":"usd","label":"Revenue","unit":"USD","format":{"style":"currency","currency":"USD"}},
          {"id":"pct","label":"Margin","unit":"%","format":{"style":"percent"},"domain":{"policy":"fixed","min":0,"max":100}}],
 "series":[{"id":"rev","label":"Revenue","mark":"bar","yAxisId":"usd",
   "points":[{"id":"r1","x":"q1","value":120000},{"id":"r2","x":"q2","value":135000}]},
  {"id":"mar","label":"Margin","mark":"line","yAxisId":"pct",
   "points":[{"id":"m1","x":"q1","value":18.5},{"id":"m2","x":"q2","value":21}]}],
 "referenceLines":[{"id":"goal","axisId":"pct","value":20,"label":"Margin goal"}]}
```

```json
{"schemaVersion":1,"id":"min-scatter","kind":"cartesian","title":"Speed vs risk",
 "xAxis":{"id":"days","scale":"linear","label":"Days to fix","unit":"days"},
 "yAxes":[{"id":"risk","label":"Risk score","unit":"score","domain":{"policy":"fixed","min":0,"max":10}}],
 "bubble":{"mode":"area","domain":[0,100],"range":[2,18]},
 "series":[{"id":"svc","label":"Services","mark":"scatter","yAxisId":"risk",
   "points":[{"id":"a","x":4,"value":7.5,"size":40,"datumLabel":"Payments API","staticLabel":true},
             {"id":"b","x":12,"value":3,"size":0,"datumLabel":"Batch jobs"}]}]}
```

```json
{"schemaVersion":1,"id":"min-donut","kind":"donut","title":"Share by band",
 "slices":[{"id":"a","label":"0–30 days","value":12},{"id":"b","label":"31+ days","value":3}]}
```

```json
{"schemaVersion":1,"id":"min-heatmap","kind":"heatmap","title":"Counts",
 "rows":[{"id":"r1","label":"Alpha"}],"columns":[{"id":"c1","label":"Low"},{"id":"c2","label":"High"}],
 "cells":[{"row":"r1","column":"c1","value":0},{"row":"r1","column":"c2","value":null}],
 "scale":{"type":"sequential","domain":[0,10],"colors":["#f4f6f8","#1f4e79"]}}
```

```json
{"schemaVersion":1,"id":"min-progress","kind":"progress","title":"Readiness","variant":"ring",
 "domain":{"min":0,"max":100},"unit":"%","format":{"style":"percent"},
 "items":[{"id":"a","label":"East","value":72,"target":80},{"id":"b","label":"West","value":null}]}
```

## 6. Validation

```ts
interface ValidateOptions { limits?: Partial<Limits> }   // may only lower defaults
function validateSpec(input: unknown, options?: ValidateOptions): VizSpec;   // throws InvalidSpecError
function isValidSpec(input: unknown, options?: ValidateOptions):
  { ok: true; spec: VizSpec } | { ok: false; errors: ValidationIssue[] };

interface ValidationIssue {
  rule: string;          // stable rule id, e.g. "bar-domain-excludes-data"
  path: string;          // JSON Pointer, e.g. "/series/1/points/3/value"
  message: string;       // corrective: what is wrong and what to change
}
```

Order: size check on the serialized input (`JSON.stringify` length in UTF-8 bytes, 2 MiB) → Ajv schema (all errors) → semantic rules → limits. Returns a deep-frozen structured clone; input is never mutated.

Failures throw `InvalidSpecError`, keeping the brief's contract: a machine-readable code, a field path and a corrective message. `class InvalidSpecError extends DravenVizError` has:

- `code`: `"INVALID_SPEC"`, or `"LIMIT_EXCEEDED"` for protection limits.
- `rule`, `path` and `message`: from the first issue.
- `issues`: every issue found, capped at 50.
- `chartId`: when readable.

`instanceof InvalidSpecError` and `error.code` are both stable ways to detect it. The print and React adapters reject or report with the same `InvalidSpecError` instance.

Semantic rules (each has a unit test with a fixture under `fixtures/invalid/`): `duplicate-id`, `unknown-axis`, `unknown-role`, `x-not-in-categories`, `point-order`, `labels-length`, `horizontal-requires-bars`, `bar-on-continuous-axis`, `stack-mixed-marks`, `stack-mixed-axes`, `negative-in-percent-stack`, `bar-domain-excludes-data`, `fixed-domain-excludes-data`, `invalid-domain`, `marker-without-value`, `render-hint-on-bar`, `size-without-bubble`, `invalid-time`, `time-without-offset`, `mixed-x-types`, `negative-slice`, `missing-cell`, `duplicate-cell`, `value-outside-scale`, `scale-colors-length`, `outside-progress-domain`, `too-many-axes`, `non-finite-number`, `preset-incompatible`, `currency-required`, `static-label-without-name`, `percent-axis-configured`, `percent-axis-shared`, `percent-value-unit-required`, `duplicate-chart-embedding` (options).

Default limits (`DEFAULT_LIMITS`): series 16, total Cartesian points 10,000, category positions for bar axes 250, donut slices 32, heatmap cells 2,500, serialized JSON 2 MiB, annotations 16, reference lines 16, progress items 20. Lowering is allowed per call; raising throws `INVALID_OPTIONS`.

## 7. Themes

```ts
type ThemeName = "light" | "dark" | "print";
interface Theme {
  name: string; version: string;           // theme version recorded in evidence
  font: { family: string; weights: { regular: 400; strong: 600 } };
  text: { title: number; label: number; caption: number; lineHeight: number };  // logical px
  color: { background: string; text: string; mutedText: string; axis: string; grid: string;
           focus: string; missing: string; threshold: string; annotation: string };
  palette: string[];                       // 8 categorical slots
  roles: Record<string, { color: string; pattern?: RoleDef["pattern"]; shape?: MarkerShape }>;
                                           // empty in built-in themes; filled by caller overrides
  seriesStyles: { dash: Dash; shape: MarkerShape; pattern: RoleDef["pattern"] }[];  // 8 slots
  sequential: string[]; diverging: string[];
  spacing: { padding: number; legendGap: number; titleGap: number; barGap: number; groupGap: number };
  stroke: { line: number; axis: number; grid: number; reference: number; sliceBorder: number };
  marker: { size: number; hollowStroke: number };
  strings: { unavailable: string; notMeasured: string; noData: string; incomplete: string;
             target: string; clipped: string };   // en-US defaults; overridable
}
type ThemeOverrides = DeepPartial<Omit<Theme, "name">>;   // validated: colors hex, numbers finite and in range
function resolveTheme(base: ThemeName | Theme, overrides?: ThemeOverrides): Theme;
```

- The **print** theme has a white background, a grayscale-distinguishable palette paired with dash and shape per slot, `text.title = 17`, `text.label = 13` and `text.caption = 11` logical px at the reference width of 680. At 178 mm that is 12.6 pt, 9.6 pt and 8.2 pt: `effective_pt = size × (178 / 25.4 × 72) / 680 = size × 0.742`.
- When `printWidthMm` or `width` differs, the layout scales logical font sizes so the effective sizes stay at or above 12 / 9 / 8 pt. `LaidOutChart.metrics.effectivePt` records the result, and tests assert it.
- **Light** and **dark** use the same palette hues with adjusted luminance and `text.label = 12`.
- No theme default names business concepts. `examples/themes/security.json` supplies Critical/High/Medium/Low roles as an override.

## 8. Layout and label policy

The layout works in logical units inside a `viewBox="0 0 width height"`. Allocation order: title (wrapped, up to 3 lines) → legend (wrapped rows) → axis titles with units → tick labels → plot area → notes (annotation details, clipping notes, bubble disclosure, caption).

Label policies:

- **Category labels:** wrap to 2 lines at the band width. If they still don't fit, rotate 45°. If rotated labels overlap, thin every n-th label, always keeping the first and last. Category labels are never truncated; a thinned label remains in the data table and tooltip.
- **Time and linear ticks:** nice ticks with a count of 4–6. Duplicate formatted labels trigger a coarser tick format.
- **Annotations:** drawn at their scaled position regardless of which ticks are kept.
- **Minimum plot size:** 80 × 60 logical units. Below that, `LAYOUT_ERROR` is thrown with a message naming the element that did not fit and the minimum size needed.
- **Static mode:** a label is shown for every point with `staticLabel: true`, every annotation `label`, reference line labels, and `labels.values` selections. Collisions among selected scatter labels are resolved by trying 8 candidate positions in order; if all collide, the label is replaced by a numbered marker plus a numbered row in the notes. No label is dropped silently.
- **Text measurement:** a `TextMeasurer` interface `(text, font: {size, weight}) => {width, ascent, descent}`. The browser implementation uses canvas `measureText` after font verification. The Node test implementation uses per-character advance tables for Noto Sans 400/600, generated once by `scripts/fetch-font.ts` into `src/render/layout/noto-metrics.gen.ts`, so layout unit tests are deterministic.

## 9. Browser and print lifecycle

```ts
interface RenderOptions {
  width: number; height: number;            // positive logical units (print/export)
  theme?: ThemeName | Theme; themeOverrides?: ThemeOverrides;   // default "print" for print APIs
  namespace?: string;                       // default "dv"; ^[a-z][a-z0-9-]{0,31}$
  locale?: string;                          // default "en-US"
  timezone?: string;                        // IANA, default "UTC"
  assetBaseUrl?: string;                    // relative or same-origin http(s); resolves fonts/
  fonts?: FontAsset[];                      // replaces the default font set entirely
  printWidthMm?: number;                    // default 178 for print theme
  timeoutMs?: number;                       // default 10000
  limits?: Partial<Limits>;
}
interface FontAsset {
  family: string;                           // CSS family name used in SVG font-family
  weight: 400 | 600;                        // both weights required
  url: string;                              // relative (to the document) or same-origin http(s)
  format?: "woff2" | "woff" | "truetype";   // default inferred from extension
}
interface MountOptions extends RenderOptions {
  staticLabels?: boolean;                   // default true
  namespaces?: string[];                    // per-spec embedding namespaces, same length as specs;
                                            // default: every chart uses `namespace`
}
interface MountHandle {
  readonly ready: Promise<ReadyInfo[]>;     // one entry per spec, in order
  dispose(): void;                          // idempotent
}
interface ReadyInfo { chartId: string; renderId: number; width: number; height: number;
                      effectivePt?: { title: number; label: number; caption: number } }

function mountCharts(target: Element | Element[], specs: unknown[], options: MountOptions): MountHandle;
function renderToSvg(spec: unknown, options: ExportOptions): Promise<string>;
function renderToSvgWithAssets(spec: unknown, options: ExportOptions): Promise<SvgExport>;
interface ExportOptions extends RenderOptions {
  fontMode?: "external" | "embedded";       // default "external"
  fontHrefPrefix?: string;                  // external mode: prefix for @font-face URLs in the SVG;
                                            // default "fonts/"; relative paths or same-origin only
}
interface SvgExport {
  svg: string;
  fonts: { family: string; weight: 400 | 600; fileName: string;   // basename of the source url
           href: string;                                           // as written in the SVG
           sourceUrl: string; sha256: string; bytes: number }[];
}
function renderDataTable(target: Element, spec: VizSpec,
                         options?: { visuallyHidden?: boolean; locale?: string; timezone?: string }): () => void;
```

Mapping rules:

- If `target` is an array, `specs[i]` mounts into `target[i]`. Different lengths throw `INVALID_OPTIONS` synchronously.
- If `target` is a single element, a child `<div class="dravenviz-root" data-dravenviz-chart="<id>">` is appended per spec, in order.
- **Embedding identity** is the pair (namespace, chartId). Every SVG ID is `<namespace>-<chartId>-<n>`, and the root carries `data-dravenviz-ns` and `data-dravenviz-chart`.
- The same spec can be mounted more than once (for example two instances of `line-weekly-flow`) as long as each instance has a distinct namespace, through `namespaces[i]` or separate calls with different `namespace` values. The spec and its `id` are never modified.
- A pair that repeats within a batch, or that already exists in the document, is rejected with `INVALID_OPTIONS` (`duplicate-chart-embedding`) before anything mounts.
- React `<Chart>` defaults `namespace` to a sanitized `useId()` value, so instances are distinct without configuration and the value is stable across SSR and hydration.
- Report fixtures list entries as `{ "fixture": "line-weekly-flow", "namespace": "wf-a" }`, and the report loader passes those namespaces through.

Readiness sequence for `mountCharts`:

1. Validate options, then the whole batch. Any failure rejects `ready` with `INVALID_SPEC` or `LIMIT_EXCEEDED` (carrying `chartId` and `path`) before anything touches the DOM.
2. Load and verify fonts. Each font URL is fetched once as an `ArrayBuffer`, hashed with SHA-256, and registered with `new FontFace(family, buffer, { weight })`. `document.fonts.check()` must then succeed for each family and weight. The buffers are kept in a per-page font registry keyed by URL, so export embeds exactly the bytes used for measurement. Failures give `FONT_LOAD_FAILED` or `ASSET_LOAD_FAILED` with the URL.
3. Check the dimensions. `width` and `height` must be positive and finite (`INVALID_OPTIONS`), and the host element must be connected and rendered (`getClientRects().length > 0`, not `display: none`), else `ZERO_SIZE`. React's `"100%"` width also requires a measured width of 1 or more.
4. Build the model and layout (`LAYOUT_ERROR`), then render (`RENDER_FAILED` wraps any exception).
5. After React commits, wait for two animation frames, then verify the committed SVG against the model's expected-mark manifest:
   - The root carries `data-dv-render-id` equal to the current `renderId` (so stale commits never satisfy readiness), and its `viewBox` equals `0 0 width height`.
   - For every series and state the manifest expects, the corresponding `data-dv-mark` group exists with the expected element count: line segments, isolated-point markers, bars (including zero-height bars for measured zeros), placeholders for unavailable or empty categories, and the empty-state group for charts with no measured data.
   - Every numeric geometry attribute (`x`, `y`, `width`, `height`, `cx`, `cy`, `r`, and the numbers in `d` and `points`) is finite. There is no `NaN`.
   - Zero-area bounding boxes are not failures: a flat line has a zero-height box and a measured-zero bar has zero height. Only a *missing* expected mark or a non-finite coordinate fails.
6. Resolve.

Readiness fixtures that must resolve successfully: `line-measured-zero` (every value 0), `line-all-equal` (a flat line), `line-singleton` (one point, drawn as an isolated marker) and `line-all-missing` (every value null, so empty state with "No measured data"). `bar-all-zero` and `cartesian-empty-series` are added in slice 2.

The whole sequence is bounded by `timeoutMs` (`TIMEOUT`). Any failure disposes every mount the batch created and rejects. Calling `dispose()` before readiness rejects with `DISPOSED`.

`renderToSvg` mounts offscreen (`position: fixed; left: -100000px`, explicit size, `aria-hidden`) and waits for readiness. It then exports and removes the temporary root in `finally`, so it cleans up on success, error or timeout. Repeated calls leave no roots, observers or style nodes behind; the browser tests count these.

React `<Chart>`:

```ts
interface ChartProps {
  spec: VizSpec | unknown;              // validated internally on change (memoized by reference)
  theme?: ThemeName | Theme; themeOverrides?: ThemeOverrides;
  width?: number | "100%"; height: number;
  namespace?: string;                   // default: sanitized React useId(), unique per instance
  locale?: string; timezone?: string;
  assetBaseUrl?: string; fonts?: FontAsset[];
  staticLabels?: boolean;               // default false
  onDatumActivate?: (e: DatumEvent) => void;
  onReady?: (info: ReadyInfo) => void;
  onError?: (error: DravenVizError) => void;
  className?: string;
}
interface DatumEvent { chartId: string; seriesId?: string; datumId: string; datumLabel?: string;
                       value: number | null; source: "pointer" | "keyboard" }
```

- Every spec, option or size change starts a new `renderId`. Font or layout completions carrying an older `renderId` are discarded, so `onReady` fires once per `renderId` and only for the latest one.
- Width `"100%"` uses one `ResizeObserver`, debounced to animation frames and disconnected on unmount.
- Errors render an inline error panel (role `alert`, code and message, no data dump) and call `onError`. They never throw into the host tree.
- Keyboard: the chart root has `tabIndex=0`. Arrow keys move across data in series then point order (Left/Right within a series, Up/Down across series). Enter or Space activates. The focused datum gets a visible SVG focus ring and is announced in a polite live region (series label, `datumLabel` or category label, value with unit, quality).
- The tooltip is an HTML overlay outside the `<svg>`.

Error classes: `DravenVizError` (base) and `InvalidSpecError` (validation, section 6), both exported from `@draven/viz`. Error codes (`ErrorCode`): `INVALID_SPEC`, `INVALID_OPTIONS`, `LIMIT_EXCEEDED`, `FONT_LOAD_FAILED`, `ASSET_LOAD_FAILED`, `ZERO_SIZE`, `LAYOUT_ERROR`, `RENDER_FAILED`, `TIMEOUT`, `DISPOSED`, `EXPORT_FAILED`. `DravenVizError` has `{ code, message, chartId?, path?, issues?, cause? }`. Messages never include data values, SVG or HTML.

## 10. Standalone SVG export

Export has three stages: **normalize**, **validate strictly**, then **finalize**. Normalization exists because the live DOM contains renderer metadata. For example, Recharts' `Surface` emits `class="recharts-surface"` and a `style` attribute, and its layers carry `class` names. That is expected input for the normalizer, not an export failure.

**1. Normalize** (`render/svg/normalize.ts`). This runs on a deep clone of the live `<svg>`, using the live element's computed style.

1. Drop subtrees that aren't part of the static graphic: elements whose computed `display` is `none`, or with `visibility: hidden`, and elements marked `data-dv-interactive` (focus ring, hover highlight).
2. *Materialize* styles. For every element, copy these computed properties to presentation attributes when they are not already present as attributes: `fill`, `fill-opacity`, `stroke`, `stroke-width`, `stroke-opacity`, `stroke-dasharray`, `stroke-linecap`, `stroke-linejoin`, `opacity`, `font-family`, `font-size`, `font-weight`, `text-anchor`, `dominant-baseline`. Colors are converted to `#rrggbb` (with separate `*-opacity` when alpha < 1); CSS variables are resolved by the computed style.
3. Remove known renderer metadata: `class`, `style`, `tabindex`, `focusable`, `cursor`, `pointer-events`, `data-*` except `data-dv-*`, and any attribute in the Recharts attribute inventory that the slice 1 spike recorded as non-presentational (for example `name`, `orientation`, `type`, `index`, `width`/`height` on `g`). The inventory is a checked-in constant, `render/svg/recharts-metadata.ts`, with a test that fails if a Recharts upgrade emits an attribute that is not classified.
4. Replace Recharts' `<title>`/`<desc>` children of the root with DravenViz's own.

**2. Validate strictly** against an allowlist:

- Allowed elements: `svg g path rect circle ellipse line polyline polygon text tspan title desc defs clipPath linearGradient stop pattern style`.
- Allowed attributes: geometry attributes; the materialized presentation attributes listed above; `id`, `clip-path`, `transform`, `role`, `aria-*`, `data-dv-*`, and `xmlns`.
- Anything left after normalization fails with `EXPORT_FAILED` (rule `svg-disallowed-element` or `svg-disallowed-attribute`, naming the element path). Nothing is silently stripped at this stage.
- Event attributes (`on*`), `foreignObject`, `script`, `animate*`, `set`, `image`, `use` or `href` to anything but `#local-id`, and `url(...)` to non-local targets are always rejected.

**3. Finalize:**

- Root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" width="W" height="H" role="img" aria-labelledby=...>`, then `<title>` and `<desc>` (from `description`, plus a generated summary of missing and partial counts), and `font-family="<resolved family>, sans-serif"`.
- **Fonts** come from the resolved font set actually used for layout (default Noto Sans or the caller's `fonts`), never from hardcoded file names.
  - `external` mode: one `@font-face` per family and weight, with `src: url("<fontHrefPrefix><basename of the source url>") format("<format>")`.
  - `embedded` mode: the same rules with `data:font/<format>;base64,...` built from the exact bytes in the font registry (section 9, step 2), with the SHA-256 recorded in a `data-dv-font-sha256` attribute on the `<style>`.
  - `renderToSvgWithAssets` returns the list of font files and hrefs, so callers relocating an external-mode SVG copy exactly those files to `<svg directory>/<fontHrefPrefix>`.
- IDs are rewritten to `<namespace>-<chartId>-<n>` in document order. References (`url(#…)`, `href="#…"`, `aria-labelledby`) are rewritten to match. Two exports with different embedding identities share no IDs (tested).
- Serialization is `XMLSerializer` followed by deterministic attribute ordering and fixed number precision (2 decimals). The same inputs and environment give byte-identical SVG.

Export tests, in the slice 1 spike and then in `test:browser`:

- A real `line-weekly-flow` chart goes through all three stages in both font modes. The result contains no `class`/`style` attributes or `recharts` strings, and re-renders identically when loaded as a standalone file in Chromium.
- A custom-font test uses the OFL font Noto Serif v2.015 (test asset only, in `tests/assets/fonts/`) through `fonts`. It asserts that `font-family` names the custom family, the external `@font-face` URLs use the custom file names under `fontHrefPrefix`, and the embedded bytes' SHA-256 equals the loaded file's.
- An external-mode relocation test writes the SVG to a temporary directory, copies the files from `SvgExport.fonts` to `<dir>/<fontHrefPrefix>`, opens it in Chromium, and asserts through `document.fonts` that the custom face loaded and that the text widths match the in-page render within 0.5 units.

## 11. Data tables

```ts
interface DataTable {
  caption: string;                     // title + unit summary
  columns: { key: string; label: string; unit?: string; align: "start" | "end" }[];
  rows: { id: string; header: string; cells: { text: string; value: number | string | null;
          state: "measured" | "missing" | "partial" | "lagging" | "estimated" | "unavailable" | "empty" }[] }[];
  notes: string[];                     // annotation details, clipping, bubble disclosure, transformations
}
function toDataTable(spec: VizSpec, options?: { locale?: string; timezone?: string }): DataTable;
```

- **Cartesian:** one row per x position, one column per series (header "Label (unit)"). Scatter tables have one row per point with name (`datumLabel`), x, y, size and status columns; this is the static identification table. Percent stacks add share and total columns (section 5.2).
- **Donut:** Slice, value and share.
- **Heatmap:** one row per heatmap row and one column per heatmap column.
- **Progress:** Item, value, target and domain.

Missing cells read "Not measured", never an empty string or 0. React `<DataTable spec visuallyHidden />` and print `renderDataTable` both render this model as `<table>` DOM with text nodes only.

## 12. Security

- Validation is strict (section 5), all text is rendered as text nodes or through React escaping, and export uses an allowlist (section 10).
- `assetBaseUrl` and font URLs may only be relative or same-origin `http(s)`. Other schemes (`javascript:`, `data:` and so on) and cross-origin URLs give `INVALID_OPTIONS`. In offline mode (`mountCharts`, `renderToSvg`) there are no network requests beyond those URLs.
- The library contains no `eval`, `Function` or `innerHTML`, enforced by ESLint rules and a grep of `dist/`.
- Examples embed chart JSON as a separate `charts.json` file. The HTML helper example shows `<script type="application/json">` encoding that escapes `<`, `>`, `&`, U+2028 and U+2029.
- The library never calls `console.*` with data. The only logging is `console.warn` for deprecated options.

## 13. DravenPDF integration

Verified against `Kryon-Consulting/dravenpdf@7a249e0`:

- The route is `POST /v1/render/bundle` (multipart). Each `files` part's filename is its bundle path. `index.html` is sent as a file, and `options` is a JSON form field.
- `RenderOptions` accepts `paper`, `media`, `print_background`, `prefer_css_page_size`, `wait_until`, `wait_for_ready_flag`, `fail_on_resource_errors`, `fail_on_page_errors` and `timeout_ms` (≤ `DRAVENPDF_RENDER_TIMEOUT_MS`, default 30000). Unknown fields are rejected.
- `wait_for_ready_flag` waits for `window.__DRAVENPDF_READY__ === true`, then waits for images and `document.fonts.ready`.
- The response headers `X-DravenPdf-Resource-Errors` and `X-DravenPdf-Page-Errors` are asserted to be `0`.

`examples/dravenpdf/` contents:

| File                  | Purpose                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `pyproject.toml`      | Python 3.12; `dravenpdf[server] @ git+https://github.com/Kryon-Consulting/dravenpdf@7a249e0`; `httpx`       |
| `client.py`           | `python client.py --url $DRAVENPDF_URL --charts charts.json --out report.pdf`; key from `DRAVENPDF_API_KEY` |
| `bundle/index.html`   | A4 report page (`@page { size: A4; margin: 16mm }`), chart containers, data tables                         |
| `bundle/bootstrap.js` | Fetches `charts.json`, calls `DravenViz.mountCharts`, then `await handle.ready`, then sets `window.__DRAVENPDF_READY__ = true`. On rejection it throws an uncaught error (page error) and never sets the flag |
| `assets` (copied)     | Copied at run time from the packed tarball using `asset-manifest.json`                                      |
| `library_fallback.py` | Same bundle through the DravenPDF Python library (`assets=`), used only when the HTTP server cannot start   |

`dist/asset-manifest.json`: `{ "manifestVersion": 1, "package": "@draven/viz", "version": "0.1.0", "files": [{ "path": "dravenviz.browser.js", "source": "dist/dravenviz.browser.js", "sha256": "…", "bytes": 0, "role": "script" }, …fonts, css, schema] }`. Bundle paths match the `path` fields.

`test:pdf` runs these steps:

1. Build and pack.
2. Extract the tarball to a temp dir.
3. `uv sync` in `examples/dravenpdf`.
4. Start `dravenpdf serve` on a free port with a generated `DRAVENPDF_API_KEY` and `DRAVENPDF_CHROMIUM_PATH` set to Chromium 141.
5. Post the multi-family report and the single-chart comparison pages.
6. Rasterize them with `pdftoppm` (or DravenPDF `/v1/convert/pdf-to-images` at 150 dpi).
7. Run the comparisons.
8. Write the evidence.

If Python 3.12, uv or Chromium is missing, it prints `UNVERIFIED: <reason>` and exits with code 3. CI treats that as not passed.

## 14. Documentation site

`docs/site/` is a Vite + React SPA (hash routes) using CodeMirror 6 (`@codemirror/lang-json`). It is a consumer template: its committed `package.json` and `pnpm-lock.yaml` list only third-party dependencies, and it receives `@draven/viz` from the packed tarball when staged (section 16.1). The build output goes to `.stage/docs/dist`. Routes:

| Route          | Content                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `#/`           | Start here: environment matrix, install, first React chart, plain HTML chart, Python-to-DravenPDF quickstart, what needs a DOM   |
| `#/gallery`    | Grid of every fixture tagged `gallery`, grouped by family and mode. The detail view (`#/gallery/<fixtureId>`) shows the live chart, JSON, React/HTML/Python snippets, data table, SVG download and links to PDF evidence with hash and options |
| `#/playground` | Fixture selector, CodeMirror JSON editor, Validate and Render, Reset, theme, width/height, locale, timezone, font mode; errors listed by path; last good preview labelled "Showing last valid render"; print preview at explicit mm width; SVG and JSON download; copy options |
| `#/api`        | Generated from the schema (field tables) plus hand-written API pages; schema download                                           |
| `#/styling`    | Theme tokens, overrides, roles, fonts, embedding modes, label policies, printed font sizing, grayscale examples                 |
| `#/export`     | SVG preview/download, sample PDF preview/download (from `evidence/pdf/`), bundle and readiness explanation, asset copy, Python recipe |
| `#/testing`    | Commands, fixture IDs, baseline procedure, measured size/latency (from `evidence/perf/`), troubleshooting by error code         |

Code snippets are extracted from `examples/**` files that are compiled and run in tests, never duplicated by hand. Object URLs are revoked, and prior mounts disposed, on every re-render, reset and export.

## 15. Fixtures and coverage

Fixture IDs are stable file names in `fixtures/valid/` (V) or `fixtures/invalid/` (I). Brief items 1–11 map as follows:

| Brief item | Fixture IDs                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| 1          | V `line-weekly-flow` (the brief's JSON, extended with a lagging continuous point and an event annotation)      |
| 2          | V `bar-severity-counts`, `donut-severity-share` (spec `roles` carry labels only; colors come from the `examples/themes/security.json` override) |
| 3          | V `composed-revenue-margin`                                                                                   |
| 4          | V `bar-age-bands-percent` (zero-total row, missing-member row)                                                |
| 5          | V `scatter-service-risk` (13 services), `scatter-label-collisions`                                            |
| 6          | V `heatmap-service-severity`, `progress-regional-targets` (bar), `progress-readiness-rings` (ring)            |
| 7          | V `line-thinned-annotation`, `bar-long-labels`, `bar-negative-values`, `line-singleton`, `line-all-equal`, `line-measured-zero`, `line-all-missing`, `bar-all-zero`, `donut-all-zero`, `donut-missing-slice`, `cartesian-empty-series` |
| 8          | `examples/html/host-isolation.html` (two `line-weekly-flow` instances, hostile host CSS and fonts)             |
| 9          | V `text-markup-title`; I `invalid-infinite-value`, `invalid-string-number`, `invalid-unknown-field`, `invalid-oversized` (generated at test time), `invalid-bar-domain`, `invalid-percent-negative`, plus one per semantic rule |
| 10         | V `composed-remediation-days-counts`, `composed-flow-cumulative`                                              |
| 11         | V `bar-ranking-horizontal`, `bar-stacked-categories`, `bar-compact-percent`                                   |
| Extra      | V `area-inventory-stacked`, `area-single-gaps`, `line-sparkline`, `bar-grouped`, `perf-line-500x4` (seeded)    |
| Reports    | `report-slice1` (line fixtures), `report-multi-family-a4` (one or more of every family, with two instances of `line-weekly-flow`) |

Coverage rows from the brief ("Coverage scenarios derived from platform review") map to fixtures below. Each row must reach reviewed browser, SVG and PDF evidence before V1 acceptance (`evidence/verification-matrix.md`).

| Coverage row                               | Fixtures                                                                      | Slice |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ----- |
| Open-item/inventory trends, sparkline      | `line-weekly-flow`, `line-thinned-annotation`, `area-inventory-stacked`, `area-single-gaps`, `line-sparkline` | 1, 2  |
| Counts by service/region; rankings         | `bar-severity-counts`, `bar-ranking-horizontal`, `bar-stacked-categories`, `bar-grouped` | 2     |
| Age/severity/compliance composition        | `bar-age-bands-percent`, `bar-compact-percent`                                | 2     |
| Remediation time + counts; inflow/outflow  | `composed-remediation-days-counts`, `composed-flow-cumulative`, `composed-revenue-margin` | 2     |
| Risk vs remediation speed                  | `scatter-service-risk`, `scatter-label-collisions`                            | 3     |
| Overdue-age and coverage distributions     | `donut-severity-share`, `donut-all-zero`, `donut-missing-slice`               | 2     |
| Service by severity matrix                 | `heatmap-service-severity`                                                    | 3     |
| Regional targets and readiness             | `progress-regional-targets`, `progress-readiness-rings`                       | 3     |

Fixtures are generated from fixed values. Seeded ones (`perf-line-500x4`) use a documented mulberry32 seed of `20260930` and a generator script, and the generated file is committed.

## 16. Testing and scripts

| Script           | Runs                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `build`          | gen (types, validator) → tsup → esbuild browser bundle → CSS → asset manifest                                     |
| `pack:local`     | `build`, then `pnpm pack --pack-destination .pack` plus a `.sha256` file                                          |
| `stage <name>`   | Section 16.1: installs a consumer template (`docs`, `react`, `html`) from the packed tarball into `.stage/<name>` |
| `typecheck`      | `tsc -b` for src, tests, examples, docs site                                                                     |
| `lint`           | ESLint (boundary rules, no eval/innerHTML) + Prettier check                                                      |
| `check:drift`    | Regenerate types/validator/schema docs into temp and diff                                                        |
| `test`           | Vitest unit (Node): validation, model, layout with Noto metrics, formatting, tables, export sanitizer on JSDOM fixtures |
| `test:browser`   | Playwright on Chromium 141: harness pages (lifecycle, themes, resize, keyboard, fonts, disposal counts, SVG snapshots), visual comparisons |
| `test:pdf`       | Section 13; exit 3 = unverified                                                                                  |
| `test:package`   | `pnpm pack` → install the tarball with npm into temp React 18, React 19 and core-only consumers outside the repo; build and run them; plain HTML from copied assets; `publint` and `@arethetypeswrong/cli` |
| `dev:docs` / `build:docs` / `preview:docs` / `test:docs` | Docs site; `test:docs` runs Playwright against `preview:docs` (URL read from its output) |
| `measure`        | Size and latency measurements to `evidence/perf/`                                                                |

### 16.1 Clean checkout and packed consumers

The library root is the only pnpm project. Every consumer of `@draven/viz` (docs site, React example, clean-consumer tests, DravenPDF bundle) gets the library from the packed tarball, installed into an isolated directory *after* packing. So no committed lockfile ever records the tarball or its changing integrity. Exact sequence from a clean checkout:

```bash
pnpm install --frozen-lockfile        # library dev dependencies only
pnpm build                            # dist/, browser bundle, asset manifest
pnpm pack:local                       # -> .pack/draven-viz-<version>.tgz and .sha256
pnpm stage docs                       # -> .stage/docs (see below)
pnpm build:docs                       # vite build in .stage/docs -> .stage/docs/dist
```

`pnpm stage <name>` runs `scripts/stage-consumer.ts`, which does the following for `docs/site`, `examples/react` or `examples/html`:

1. Recreate `.stage/<name>/`.
2. Copy the template's `package.json` and `pnpm-lock.yaml`. Source folders (`src/`, `public/`, `index.html`, `vite.config.ts`) are symlinked back to the template so `dev:docs` hot-reloads edits; only sources are linked, never packages.
3. Run `pnpm install --frozen-lockfile --ignore-workspace`. This installs the template's third-party dependencies exactly as locked.
4. Run `pnpm add --ignore-workspace <abs path to .pack tarball>`. This changes only the staged, uncommitted lockfile. `recharts` and its transitive dependencies are resolved at this point.
5. Record `pnpm ls --depth Infinity --json` to `.stage/<name>/resolved.json` and fail if `@draven/viz` is not the tarball's version and sha256, or if `react`, `react-dom` and `react-is` differ in major.minor.

`dev:docs`, `build:docs`, `preview:docs` and `test:docs` all depend on `stage docs`, which depends on `pack:local`, which depends on `build`. `test:package` does not use pnpm staging: it copies `tests/consumers/{react18,react19,core}` to `os.tmpdir()` outside the repository and installs the tarball there with `npm install` (the ordinary consumer path). It then asserts that there are no symlinks under `node_modules/@draven/viz` and that the dependency versions resolved as expected (section 3). The plain-HTML consumer copies `dist` assets listed in `asset-manifest.json` into a temp directory and is served by a static server.

### 16.2 Visual comparison tolerances

Visual comparisons use `pixelmatch` on PNG crops at a common physical scale (150 dpi for PDF; the browser uses `deviceScaleFactor` so 1 logical unit matches the same physical size). Two separate settings are recorded per comparison type in `tests/visual/REVIEW.md`:

- **Pixel color threshold:** pixelmatch `threshold`, the per-pixel YIQ color distance, which starts at `0.1`, plus `includeAA: false`.
- **Allowed mismatch ratio:** the fraction of differing pixels allowed in the crop.

Each is calibrated separately for each comparison type:

- **Same-path repeat** (browser vs browser, PDF vs PDF): 10 unchanged renders; the allowed ratio is the maximum observed plus 0.05 percentage points.
- **Cross-path** (browser vs rasterized PDF, standalone SVG vs browser): 10 fixture pairs; the allowed ratio is the maximum observed plus 0.1 percentage points. It is capped at 1 %: above that, the difference is investigated and recorded in `MISMATCHES.md`, never absorbed by the tolerance.

Chart content is never masked. Structural and semantic assertions (series order, mark counts, domains, positions within 0.5 logical units) run alongside every image comparison.

CI (`.github/workflows/ci.yml`) has these jobs:

- `install` (frozen lockfile)
- `lint + typecheck + drift`
- `unit`
- `browser` (`pnpm exec playwright install --with-deps chromium` using the pinned `@playwright/test` 1.56.1, which installs revision 1194; locally the preinstalled `/opt/pw-browsers` copy is used)
- `package`
- `docs`
- `pdf`, which runs uv with Python 3.12 and Chromium. It is marked required, and `UNVERIFIED` fails the job rather than passing it.

## 17. Evidence

`evidence/` is committed per slice:

- `verification-matrix.md`: requirement or coverage row → fixture IDs → commands → artifact paths → status (`pass`, `fail` or `unverified`).
- `svg/<fixture>@<theme>.svg`
- `pdf/<report>.pdf`, `pdf/<report>.json` (spec hashes, options, DravenPDF commit, Chromium version, font hashes), `pdf/pages/*.png`, `pdf/crops/*.png`
- `visual/` diff images for failures
- `perf/size.json`, `perf/latency.json`, `perf/README.md` (hardware, OS, versions, scenarios)
- `screenshots/docs-*.png`

## 18. Performance and size

Scenarios (at least 30 measured samples after 5 warm-up runs, reporting p50/p95):

| ID  | Scenario                                                                                   | Target                 |
| --- | ------------------------------------------------------------------------------------------ | ---------------------- |
| P1  | Warmed `mountCharts` readiness, `perf-line-500x4` at 680×320, fonts preloaded, same page    | p95 ≤ 250 ms (brief)   |
| P2  | Fresh page load to readiness with font loading, same fixture                               | Budget after slice 1   |
| P3  | `report-multi-family-a4` readiness in a warmed page                                          | Budget after slice 3   |
| P4  | DravenPDF HTTP end-to-end for `report-slice1` and later `report-multi-family-a4`, concurrency 1 | Budget after slice 1 / 4 |

Sizes are measured from the packed tarball: browser bundle raw and gzip, ESM entry sizes, font bytes, SVG bytes per reference fixture, PDF bytes and page count. After slice 1, section 18 gets a budgets table: the measured value + 20 %, rounded up, with the basis stated. A regression over budget blocks performance acceptance until it is investigated and the resolution recorded.

## 19. Support matrix

| Item                     | Supported / pinned                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Node (develop/build)     | 22.22 pinned via `.nvmrc`; engines `>=20.19` for core validation in Node                              |
| pnpm                     | 10.33.0                                                                                              |
| TypeScript (dev)         | 6.0.x; declarations tested with consumer TS 5.4 and 6.0                                              |
| React (peer)             | 18.3.x and 19.x (tested 18.3.1 and 19.3.0), with `react-dom` and `react-is` at the same major.minor; browser bundle embeds React, ReactDOM and react-is 19.3.0 |
| Recharts                 | 3.10.1 exact                                                                                          |
| Browsers                 | Verified: Chromium 141 (automated). Provisional, not yet verified: Chrome/Edge ≥ 120, Firefox ≥ 121, Safari ≥ 17; these become "supported" only after a recorded manual or automated pass |
| Python (examples)        | 3.12 via uv                                                                                          |
| DravenPDF                | commit `7a249e0`                                                                                     |
| Test browser             | Chromium 141.0.7390.37 (Playwright 1.56.1, revision 1194)                                            |
| Font                     | Noto Sans v2.015, weights 400/600                                                                    |

## 20. Versioning

- Schema v1 fields keep their meaning. Additive, optional fields are allowed in v1 minors. Anything that invalidates an existing valid spec needs `schemaVersion: 2` and a migration guide.
- The package follows semver from 0.1.0. Public API changes go into `CHANGELOG.md`.
- `check:drift` ensures the schema, generated types, the docs API tables and the example specs (all validated in tests) never disagree.

## 21. Slices

| Slice | Delivers                                                                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Proof path first: Recharts spike (section 4) → one real `line-weekly-flow` render → normalize/export SVG → real DravenPDF PDF → docs playground rendering the same fixture from the packed tarball. Only then: repository hardening, CI; full v1 schema (all kinds, so the contract is fixed) with generated types and validator; themes; fonts; line model/layout/rendering incl. gaps, quality, annotations, reference lines; React `Chart`; `mountCharts`/`renderToSvg`; browser bundle; DravenPDF example with one real PDF; visual references for the line fixtures; size/latency measurements and budgets; docs shell with Start here and a working playground |
| 2     | Bars (all modes, horizontal, percent states), areas, composed/dual axis, donut, compact/sparkline presets; their fixtures, references and PDFs                                                                                             |
| 3     | Scatter/bubble with label collision handling, heatmap, progress bar/ring; the multi-family A4 report                                                                                                                                      |
| 4     | Clean-consumer package verification, docs gallery/API/styling/export/testing pages, `test:docs`, final evidence and verification matrix                                                                                                    |

Known risks and mitigations:

- **Recharts cannot host DravenViz overlays, co-locate stacks, or produce exportable SVG.** Slice 1 Task 1 spike; fallbacks in section 4.
- **Canvas text metrics differ from the Node metric tables.** Browser layout always uses canvas; Node tables are used only for unit tests. Visual tests guard browser output.
- **DravenPDF server start fails in CI.** Fall back to the library bundle API and document it. Never report the result as passed if neither path runs.
