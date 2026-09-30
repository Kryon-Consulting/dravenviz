# DravenViz: independent TypeScript visualization library

Date: 2026-09-30
Status: Standalone handoff specification for review. TypeScript and independence from the application are user requirements. This document replaces the earlier Valio-specific integration specification.

## Assignment and available context

Build DravenViz as a new, independently installable TypeScript library in its own project directory/repository. The implementing agent has this document and access to DravenPDF, but has no access to Valio Guard, Draven Sentinel, their frontend/backend source, their tests, their saved report schema, or their live pages.

This document is the complete product brief. Do not request those application sources as a prerequisite, infer unavailable APIs, extract application components, or assume a parent npm workspace. Use synthetic datasets and consumer examples supplied by the new library project. Application migration is a later assignment performed by agents that have those applications.

The library must be reusable in unrelated frontend projects and offline reporting pipelines. A financial dashboard, an infrastructure report, and a security platform should be able to use the same package without application-specific dependencies.

Delivery means a built and tested library, clean-consumer installation evidence, a runnable documentation site with a chart gallery and playground, working browser and SVG examples, and a real DravenPDF integration example. A specification, scaffold, wrapper demo, or screenshots alone do not complete the build assignment.

## Architectural decisions

- Language: TypeScript, published artifacts usable from JavaScript.
- Product/project name: `dravenviz`; npm package name: `@draven/viz`. Do not publish to a registry without a separate user instruction; verify local distribution with `npm pack`.
- One rendering implementation per chart family, shared by frontend, SVG export, and offline print.
- SVG is the canonical chart graphic. HTML can provide accessible data tables, tooltips, and surrounding examples. Canvas/WebGL and screenshot-based report charts are outside V1.
- Use React and Recharts as the primary internal renderer for V1 Cartesian, scatter/bubble, and donut charts. Create an independent DravenViz repository that installs Recharts as a dependency; do not fork the Recharts repository as the project scaffold or copy its rendering engine. Implement bounded private SVG primitives for heatmaps and linear/circular progress, sharing the same themes, layout rules, readiness, and export lifecycle. Each family's implementation serves both browser and print modes.
- Consumers must use DravenViz APIs; Recharts components, props, internal axis maps, and types must not leak into the public contract. Use documented upstream extension points for custom marks/labels; do not depend on private state or DOM class names. Select a supported released dependency version, record it, and lock the development/test environment. Do not copy an application's dependency manifest or select an upstream canary by accident.
- Use the official Recharts documentation, examples/Storybook, source, and tests as technical references at the selected release/tag: https://github.com/recharts/recharts and https://recharts.github.io/en-US/guide/getting-started/. Upstream `main` is development, not the release contract. Recharts supplies chart mechanics; DravenViz owns the JSON contract, validation, visual system, static label policies, font readiness, standalone SVG export, and PDF acceptance. Record attribution/license notices for dependencies and any adapted upstream material.
- React is an adapter dependency, not a dependency of the schema/theme core. The standalone browser bundle includes its renderer dependencies so plain HTML and Python-generated reports can use it without React tooling.
- Node is needed to develop/build the package. Normal browser rendering and DravenPDF integration must not require an additional Node service or on-demand Node invocation from Python.
- DravenPDF remains a generic HTML-to-PDF engine. It does not depend on DravenViz. DravenViz does not require DravenPDF to render a chart; its PDF integration is an example/adapter around the existing engine.
- Removing Recharts internally is a later, separate optimization. V1 must make that replacement possible without changing consumer specifications.

## Package surfaces and distribution

| Surface                          | Required exports                                                                   | Environment                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@draven/viz`                    | `VizSpec`, `validateSpec`, theme types and built-in themes, structured error types | DOM-free and React-free; importable in Node for validation                                             |
| `@draven/viz/react`              | `Chart` and browser interaction types                                              | React frontend; imports safe during SSR, but server rendering of final chart SVG is not promised in V1 |
| `@draven/viz/print`              | `mountCharts`, `renderToSvg`, standalone SVG serialization                         | Browser DOM; fixed dimensions and static rendering                                                     |
| `dist/dravenviz.browser.js`      | Global `DravenViz` exposing `mountCharts` and `renderToSvg`                        | Plain HTML/Chromium; no module loader, CDN, development server, or external runtime required           |
| `schema/viz-spec-v1.schema.json` | Versioned authoritative JSON Schema                                                | Any language that creates/validates chart JSON                                                         |
| `assets/fonts/`                  | Default font files, CSS, provenance, and redistribution license                    | Optional explicit asset loading by consumers; never injected from the network                          |

Ship compiled ESM, declarations, stylesheet/assets, browser bundle, schema, README, changelog, and dependency/license notices. Consumers must not compile library TS/TSX or configure library-specific source aliases. React frontend builds must not bundle a second React copy. Declare the supported React peer range explicitly and test the advertised range. Make React peers optional for core-only consumers, while documenting that the React adapter requires them; the print/browser distribution may bundle its own isolated React renderer.

Keep documentation-site tooling and dependencies outside the library's runtime exports/browser bundle. Pin the selected package manager/toolchain and commit a lockfile; document a reproducible clean installation command. Keep registry publication disabled during the initial local delivery. Do not choose an open-source license for original DravenViz code on the owner's behalf; retain dependency/font notices and document that the owner's distribution license remains a separate decision.

Do not rely on Tailwind, Redux, router, an application's CSS variables, its data-fetching library, icon set, or API. Scope styles under DravenViz roots; do not alter `body`, global headings, or host application styles. Document minimum browser and Node/toolchain support chosen during implementation. CJS distribution is optional, not a V1 requirement.

A suitable project structure is:

```text
dravenviz/
  src/core/        schema-facing types, validation, themes, errors
  src/render/      private renderer implementation
  src/react/       public React adapter
  src/print/       static browser adapter and SVG export
  schema/
  assets/fonts/
  examples/react/
  examples/html/
  examples/dravenpdf/
  docs/site/      documentation, gallery, and playground application
  fixtures/
  tests/
  package.json
```

Equivalent internal organization is acceptable if the dependency boundaries and shipped artifacts are preserved.

## V1 chart scope

Implement these generic chart capabilities in vertical slices:

| Family             | Required modes                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Cartesian bars     | Vertical/horizontal; single, grouped, stacked, and 100% stacked                                                                       |
| Cartesian lines    | Single/multiple series, explicit gaps, markers, linear/monotone interpolation                                                         |
| Cartesian areas    | Single and stacked area, explicit gaps                                                                                                |
| Composed Cartesian | Bar + line with named axes and distinct units; reference thresholds                                                                   |
| Scatter/bubble     | Numeric x/y axes, optional size encoding, status shapes/colors, selected point labels                                                 |
| Donut              | Ordered slices, legend, center value/label, all-zero handling                                                                         |
| Heatmap            | Ordered rows/columns, numeric or missing cells, explicit color scale, cell labels                                                     |
| Progress           | Linear target bar and circular ring; value/domain, optional target marker, label and units; distinct measured-zero and missing states |

A sparkline is a line preset that hides axes/legend; a risk matrix is a configured heatmap. They do not require separate engines. Generic annotations and semantic roles can express severity distributions or quality warnings, but the core must not contain cybersecurity terms or business rules.

Exclude from V1: directed/network/attack-path graph layout, report sections/pagination, complete dashboard composition, generic drawing framework, pandas/Python package, animation framework, Canvas/WebGL, and a full replacement for every Recharts feature.

### Coverage scenarios derived from platform review

A 2026-09-30 review inspected the live Findings trends page and chart source across overview/dashboard, findings, inventory, compliance, and reports. The following patterns define capability coverage, not application dependencies or a promise to reproduce entire dashboard cards. Recreate them with synthetic inputs in the standalone project; access to the original platform is unnecessary.

| Observed pattern                                                              | Generic DravenViz capability                                | Required static evidence                                                                                                                                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-item and inventory trends; compact headline trends                       | Multi-line, single/stacked area, sparkline preset           | Missing intervals, partial marker-only points, lagging continuous points, event annotations and their explanatory text                                                 |
| Counts by service/region; remediation rankings                                | Horizontal/vertical bars, grouped and absolute stacked bars | Long category labels, totals/values, caller-provided datum colors, numeric thresholds                                                                                  |
| Age, severity, and compliance-band composition                                | 100% stacked bars, including a compact axis-free preset     | Truthful segment proportions, zero-total/missing states, small segments readable through labels or legend                                                              |
| Remediation time plus resolved counts; inflow/outflow plus cumulative balance | Composed grouped bars + line with named axes                | Days/count units on separate axes, negative cumulative values, reference lines, explicit marker axis binding                                                           |
| Risk versus remediation speed                                                 | Scatter/bubble                                              | 13 points with numeric spacing, area encoding, caller-selected status shapes/colors, horizontal/vertical thresholds, selected labels and a static identification table |
| Overdue-age and encryption coverage distributions                             | Donut                                                       | Center value/label, ordered legend with counts/shares, tiny slices, missing/all-zero states                                                                            |
| Service by severity matrix                                                    | Heatmap                                                     | Ordered row/column labels, numeric cells, contrasting text, missing versus measured-zero cells, scale legend                                                           |
| Regional target compliance and readiness percentage                           | Linear target bars and circular progress rings              | Target indicator, explicit domain/units, value labels, caller-selected status colors, missing distinct from zero                                                       |

Thresholds, status roles/colors, selected labels, supplied rank order, and metric calculations belong to the consumer. DravenViz must not infer SLA policy, severity bands, cumulative values, or top-N selection. Support per-datum semantic roles/colors through the typed public contract without accepting arbitrary HTML/CSS.

Some current application charts use HTML/CSS for bars, rings, and heatmaps. Recreate their generic graphics as SVG inside DravenViz so export does not depend on capturing host HTML. Preserve proportional geometry: do not inflate a small bar or stack segment to a minimum percentage width for visibility; use a callout/legend instead. Bubble minimum-visible-size behavior remains the explicitly disclosed exception described below.

Tables, scorecards, KPI cards, period selectors, navigation, and dashboard card layouts remain consumer composition. Network/attack-path diagrams use a distinct layout engine and remain outside V1. This review establishes chart-family coverage; it does not constitute visual QA of every platform page or state.

## Data and public API contract

Own one versioned JSON Schema and generate TypeScript types from it; validate runtime input against the same schema plus necessary semantic checks. No separately maintained Python rendering implementation or duplicate Python schema is required. Python examples construct ordinary JSON.

The normative concepts are:

- `schemaVersion: 1`, stable `id`, chart `kind`, `title`, and optional `description`.
- Ordered series/rows/categories with stable IDs and labels. Raw numeric values or explicit nulls remain separate from optional `displayValue` strings.
- Axis IDs, scales, labels, units, domains, and formatting settings.
- Explicit mark/series selection, marker styles, stacking mode, interpolation, reference lines, and annotations.
- Explicit point rendering hints for continuous-line membership and quality markers.
- Separate rendering options for dimensions, theme, namespace, locale/timezone, and font assets.

Use chart-kind discriminated unions. A Cartesian specification can compose series whose `mark` is `bar`, `line`, `area`, or `scatter`, each associated with a named y axis. Donut, heatmap, and progress have their own bounded typed shapes. Finalize the complete field names and public signatures in the implementation plan before coding; the example below fixes the minimal Cartesian contract and its meaning.

```json
{
  "schemaVersion": 1,
  "id": "weekly-flow",
  "kind": "cartesian",
  "title": "Items opened and closed",
  "description": "Weekly counts; one week was only partially measured.",
  "xAxis": {
    "id": "week",
    "scale": "category",
    "categories": ["2026-07-06", "2026-07-13", "2026-07-20"],
    "labels": ["6 Jul", "13 Jul", "20 Jul"]
  },
  "yAxes": [{
    "id": "count",
    "label": "Items",
    "unit": "count",
    "domain": {"policy": "include-zero"}
  }],
  "series": [{
    "id": "opened",
    "label": "Opened",
    "mark": "line",
    "yAxisId": "count",
    "interpolation": "linear",
    "points": [
      {"id": "o1", "x": "2026-07-06", "value": 12},
      {"id": "o2", "x": "2026-07-13", "value": null},
      {"id": "o3", "x": "2026-07-20", "value": 18,
       "quality": "partial", "renderHint": "marker-only"}
    ]
  }, {
    "id": "closed",
    "label": "Closed",
    "mark": "line",
    "yAxisId": "count",
    "interpolation": "linear",
    "points": [
      {"id": "c1", "x": "2026-07-06", "value": 8},
      {"id": "c2", "x": "2026-07-13", "value": 10},
      {"id": "c3", "x": "2026-07-20", "value": 14}
    ]
  }]
}
```

`validateSpec(input: unknown): VizSpec` returns validated data or throws `InvalidSpecError` with a machine-readable code, field path, and corrective message. It must not mutate inputs or repair malformed quantities silently.

The intended React usage is:

```tsx
import { Chart } from '@draven/viz/react';

<Chart
  spec={spec}
  theme="light"
  width="100%"
  height={320}
  onDatumActivate={({ seriesId, datumId }) => selectDatum(seriesId, datumId)}
/>
```

Callbacks are separate from chart JSON. The library returns stable IDs; the consuming application owns navigation, filters, API requests, entitlements, and business interpretation. An optional `onReady` callback must have documented completion semantics, not mean merely that React has mounted.

The intended browser print usage is:

```js
const handle = DravenViz.mountCharts(root, specs, {
  width: 680,
  height: 320,
  theme: 'print',
  namespace: 'example-report',
  locale: 'en-US',
  timezone: 'UTC',
  assetBaseUrl: './assets/'
});
await handle.ready;
const svg = await DravenViz.renderToSvg(specs[0], {
  width: 680, height: 320, theme: 'print', namespace: 'export-one',
  assetBaseUrl: './assets/'
});
```

`mountCharts` returns a ready promise and disposal operation. Failed validation, missing assets/fonts, or chart exceptions reject readiness. `renderToSvg` may use an offscreen browser mount in V1; it must clean up afterward. It returns standalone SVG text, not a screenshot. This API requires a DOM: pure Node synchronous SVG rendering and Python `to_svg()` without a JS executor are explicitly not V1 promises.

### Lifecycle and error behavior

- Finalize all chart-kind schemas, theme/format/label options, table-helper signatures, adapter props, and mount/export signatures in the implementation plan. Specify defaults, valid combinations, units, and representative input/output examples; do not discover incompatible public APIs independently in each delivery slice. The plan must include a complete minimal fixture for every family and a dependency/environment support matrix.
- Mounting several specifications has a documented mapping from ordered specs to containers. Validate the complete batch before committing charts. A failure must reject batch readiness and release mounts/resources created by that batch rather than leave an apparently successful partial report. Distinguish invalid input, font/asset failures, layout errors, render failures, timeout, and disposal with stable error codes and chart IDs/field paths where applicable.
- Readiness is bounded: provide a documented configurable timeout with an initial 10,000 ms default for mounting/export, separate from DravenPDF's request timeout. Font loading, known positive dimensions, and completed layout all fall within that bound. Static export uses explicit numeric dimensions, disables upstream animation, and resolves only after final SVG geometry exists. Hidden/zero-size hosts must not produce a successful blank SVG.
- Disposal is idempotent and releases React roots, observers, temporary DOM, and export resources. Disposal before readiness rejects the pending operation with a documented cancellation/disposal error; failures also clean up. `renderToSvg` always cleans up its temporary mount on success, failure, and timeout.
- React prop changes and responsive resizes must produce the latest valid chart. A stale font/layout completion must not fire readiness for an obsolete spec or overwrite a newer render. Specify React error reporting and completion semantics; verify repeated updates, unmounts, and exports without accumulating live roots/observers.
- Browser interaction callbacks and tooltip DOM never enter static SVG/PDF output. Export must retain data marks, units, quality markers, reference lines, and explanatory text. Document which labels/annotations are selected by a static preset and how the data table supplies remaining detail.

V1 schema changes must retain their documented meaning. Changes that invalidate existing specifications require a new schema version and migration guidance; package/API changes follow documented semantic-versioning rules. Generate or check schema/types, API examples, and documentation together to prevent drift.

## Truthful rendering rules

- Null means missing, not zero. A measured zero must remain distinguishable from an unavailable value.
- Missing points break continuous lines/areas. Do not connect across gaps by default. Explicit `renderHint: "marker-only"` plots the stored value as a marker and breaks line membership on both sides. `renderHint: "gap"` plots neither a mark nor a connecting segment.
- Quality labels such as `partial` and `lagging` supply styling/description. They must not infer business policy: a client can choose marker-only for a partial observation or keep a lagging value in the line. Defaults and allowed combinations must be documented and tested.
- Numeric bar axes include zero. Explicit fixed domains that exclude bar values or zero are errors unless the caller selects a documented clipping mode that visibly indicates clipping. Line/scatter axes can use fitted or explicit domains.
- Preserve category/series order. Use actual numeric/time distance for linear/time x axes; categories are equally spaced. ISO dates/time values use declared timezone semantics; never the machine's implicit timezone. Supplied labels are displayed verbatim after escaping.
- Preserve units on every axis, tooltip, legend where applicable, and data table. Composite hours/count axes must not be silently combined.
- Percentage stacks require nonnegative values and all members measured. If a member is missing, render that category as unavailable rather than renormalizing the known subset to 100%. Zero-total stacks have a documented empty state, not division by zero. Absolute stacks must document signed-value behavior.
- Donuts reject negatives and show an explicit empty graphic for all-zero input. Missing slices must not yield a claimed complete percentage distribution.
- Progress values and targets use an explicit increasing numeric domain. Null values render a labeled missing state, distinct from measured zero; out-of-domain values/targets are validation errors unless an explicit, visibly indicated clipping policy is selected. Do not silently clamp rings or target bars.
- Bubble size mapping explicitly declares area versus radius and its domain/range. Prefer area encoding; document minimum-visible-size behavior so a zero is not mistaken for a large quantity.
- Annotations are positioned using the relevant axis scale, independently of the tick labels retained after label thinning. Reference thresholds bind to named axes.
- Never silently aggregate, sample, sort by value, truncate, or substitute data. Explicit options must disclose transformations in metadata/examples.

Use initial validation limits of 16 Cartesian series, 10,000 total Cartesian points, 250 categorical positions for bars, 32 donut slices, 2,500 heatmap cells, and 2 MiB serialized chart JSON. Validate before mounting. Document configurable lower limits; raising these defaults requires performance evidence. These are protection limits, not a promise that every admitted dataset has readable labels. Label thinning/wrapping must not remove data or annotations.

## Themes, layout, fonts, and SVG

Supply light, dark, and print themes with resolved typography, chart palettes, spacing, axes, grid, legend, and marker roles. Theme overrides are typed values rather than arbitrary CSS/HTML. Different series must remain identifiable by labels and shapes/dashes/patterns, not color alone. Print defaults use a white background and grayscale-readable distinctions. No animation is required in V1.

All charts use logical width/height and a viewBox. React can resize/recompute layout; print uses fixed dimensions. Same spec/options/dependency versions/font files/environment produce equivalent geometry and stable export serialization. Stable IDs derive from caller namespace/chart ID; duplicate chart instances require distinct embedding namespaces. Test title, clip, gradient, and pattern ID isolation. Do not claim byte-identical PDF files.

Bundle a pinned default Noto Sans font with its exact source, file hashes, weights, and OFL license. Noto's official documentation permits redistribution under the Open Font License: https://notofonts.github.io/noto-docs/website/use/. Support custom caller-provided fonts and explicit assets. Do not download fonts at render time. The browser/print adapter must load and verify intended fonts before measuring/layout; failure must reject print readiness rather than silently use a fallback. Do not promise arbitrary-script coverage from a small Latin font subset; document coverage and custom-font support.

Standalone SVG must include `xmlns`, viewBox, intrinsic dimensions, title/description, explicit font family, resolved visual colors, and local-reference IDs. Offer external-font and self-contained-font export modes; the latter includes the selected font data/license-compatible embedding and makes portability explicit. Preserve text as text where feasible. Exclude foreignObject, embedded scripts, animation, tooltip DOM, and event attributes from exported SVG. Print examples embed inline SVG in HTML, preserving vector geometry where Chromium supports it.

Default layout must handle long titles, multi-line legends, axis units, rotated/wrapped category labels, negative values, singleton series, identical values, and empty data without overlap. If the requested dimensions cannot fit required content, return an actionable layout error or use a documented label policy rather than silently hiding critical text.

## Visual quality and acceptance evidence

The visual goal is a coherent, polished chart system for browsers and printed documents. Print should retain the browser chart's visual language while using static labels and annotations to replace information otherwise available through interaction. A working renderer, valid SVG, or passing structural snapshot alone does not establish visual quality. This project uses its own synthetic fixtures and references; access to a consuming application's charts is not required.

### Reference gallery and baseline review

- Maintain a versioned reference gallery under `examples/` and reviewed visual fixtures under `tests/visual/`. Include a reference for every V1 family and its required modes, reusing the synthetic fixtures below. The first delivery slice establishes the multi-line reference across React, plain HTML, standalone SVG, and real PDF; subsequent slices extend the same design system.
- Include representative light, dark, and print references, plus long labels, gaps/partial observations, negative values, percentage stacks with missing members, and empty states. Use both a normal browser presentation and the final A4 print presentation. Identical data must have identical business meaning across references.
- Record the reference's fixture/spec hash, theme version, logical dimensions, font hashes, renderer/dependency versions, and pinned browser/PDF rasterizer environment. Record the review decision and any intentional differences between modes. Candidate output is not an approved baseline merely because it renders successfully.
- Review references for hierarchy, readability, spacing, series identification, accurate scales, and consistency. Keep a short mismatch ledger linking reference, actual output, and resolution. Changes to an accepted baseline require an explained visual change and review; do not automatically regenerate baselines to make a failed comparison pass.

### Physical print sizing

Use an A4 acceptance document with 16 mm left/right margins, giving a 178 mm chart width. Preserve SVG aspect ratio and test the complete document at actual printed size, not only enlarged screenshots. Other widths are supported through explicit rendering options and must remain subject to the same readability rules.

| Element                                                      | Default target at final printed size |
| ------------------------------------------------------------ | ------------------------------------ |
| Chart title                                                  | 12–14 pt                             |
| Axis ticks/titles, legends, direct value labels, annotations | At least 9 pt; target 9–10 pt        |
| Supporting caption or coverage footnote                      | At least 8 pt                        |

Measure effective text size after SVG scaling. For an aspect-preserving width fit, `effective_font_pt = logical_font_size * printed_width_pt / viewBox_width`. At 178 mm width, a 680-unit viewBox needs approximately 12.2-unit text to meet the 9 pt label minimum; a 9-unit SVG label is not 9 pt on paper. Browser defaults may use different logical sizes. Do not shrink labels below the print minimum to force a layout to fit: wrap, thin nonessential tick labels, allocate more space, or return a documented layout error. Explicitly label presets such as sparklines that intentionally omit axes/legends.

### Default visual rules

- Use the pinned bundled font, consistent typographic hierarchy, a white print background, and restrained semantic palettes. Resolve all colors in exported SVG. Theme tokens must define grids, axes, marks, text, quality markers, thresholds, and spacing consistently across chart families.
- Use subtle value-axis gridlines for Cartesian comparison (horizontal gridlines for vertical plots), usually four to six readable major ticks when the range permits, and minimal plot borders. Avoid duplicate formatted ticks; retain a meaningful zero baseline for bars. Exceptions such as heatmaps and axis-free presets have explicit reference examples.
- Use solid fills by default. Reserve hatching/patterns for distinctions that need them; do not blanket every series with dense patterns. Validate grayscale readability using labels, dashes, marker shapes, selective patterns, and visible segment boundaries as appropriate to the family. Color alone must not encode an essential distinction.
- Give legends enough space to wrap; do not cover marks or axes. Preserve first/last date labels where space permits. Prefer direct labels or optional endpoint/threshold annotations where they help static reading. An annotation's position and value must remain faithful to the data even when tick labels are thinned.
- Maintain gaps and quality cues, explicit units, and truthful interpolation. Decorative smoothing must not invent a trend or bridge missing observations. Labels must use supplied display values or the declared formatter; geometry uses raw values, never numbers parsed from rounded display strings.
- Set chart height, padding, line weights, bar gaps, and marker sizes through named theme/preset options. Use a consistent family of proportions across the reference gallery rather than stretching every chart to one shape. Print hosts keep the title, plot, legend, and caption together when they fit on a page; report pagination remains outside the library.

### Browser, standalone SVG, and PDF comparisons

- Render the same fixture/spec with identical logical dimensions, print theme, namespace policy, locale/timezone, font files, and dependency versions through the React adapter, plain HTML adapter, standalone SVG export, and DravenPDF. Disable interactions for the comparison. Font loading and final layout readiness must complete before captures or printing.
- Compare chart geometry and meaning: plotted values, domains, category/series order, gaps, quality markers, thresholds, and annotation positions. Document changes attributable to deliberately different browser/print themes separately; do not demand matching geometry for differently sized or differently configured charts.
- Maintain pinned visual regression captures for browser and rasterized PDF chart regions. Compare at a common physical scale, with a small documented raster tolerance calibrated against repeated unchanged renders. Allow antialiasing differences; never mask chart content or increase tolerance to conceal displaced marks, missing labels, or clipping. Structural/semantic assertions supplement image comparisons.
- Inspect full PDF page renders as well as chart crops. Acceptance requires no clipped text, overlapping legend/axis labels, missing glyphs, misplaced annotations, unreadable patterns, distorted aspect ratios, or unintended chart splits. Review the A4 result at 100% physical size and in grayscale. Keep equivalent data tables readable in the integration example.
- Store the generated sample PDF, page/crop captures, comparison results, review/mismatch record, and reproduction commands as release/test evidence. No real tenant data is needed. When an engine/browser/font update intentionally changes a reference, retain the reason and verification evidence with the baseline update.

### Measured performance and size

Measure the packaged distribution, not an unbundled development build. Report the standalone browser bundle's raw and gzip bytes, font bytes separately, SVG bytes per reference chart, and sample PDF bytes/page count. Do not call a build small or fast without these measurements.

For latency, use at least 30 measured samples per representative scenario after documented warm-up, and report p50/p95, hardware, OS, dependency/font versions, and concurrency. Record warmed chart readiness separately from fresh-page readiness with font loading and from complete DravenPDF HTTP export latency. Include the representative 500-point/four-series chart and a fixed multi-family A4 report whose fixture and page count are recorded.

Retain the initial warmed readiness target of p95 <= 250 ms; this excludes browser launch and font loading. The implementation plan must identify the measurement scenarios and how budgets will be established. After the first vertical-slice measurements, update the plan with numeric bundle/SVG/PDF size and end-to-end latency budgets, explain their basis, and apply them to later slices. A regression outside those budgets requires investigation and a recorded resolution before performance acceptance. Do not invent a hardware-independent end-to-end guarantee or claim superiority to another engine without an equivalent measured comparison.

## Accessibility and security

- Use semantic chart summaries/title/description and equivalent data tables. Expose data-table helpers or adapters so hosts can choose visible or screen-reader tables without duplicating data projection. Keyboard inspection and activation must use stable IDs and visible focus cues.
- Preserve distinct missing/zero/partial descriptions in summaries, tooltips, and tables. Do not claim PDF/UA compliance merely because the source SVG is semantic or DravenPDF is tagged.
- Escape every user-controlled text/attribute value. Reject raw markup, event handlers, executable URL schemes, remote asset references in offline mode, non-finite coordinates, and unsupported theme values. A title containing `</text><script>...</script>` must render as text.
- Prefer separately bundled JSON over executable inline data. If an HTML helper embeds JSON, encode it against closing-script/HTML injection. Never log datasets, SVG, HTML, or credentials by default.
- Only the trusted packaged renderer executes JavaScript. Chart JSON is data, not executable customization. Strict schema/attribute allowlists must not be disabled to make export easier.

## DravenPDF integration: complete context

The fresh agent may inspect the available DravenPDF project to confirm actual signatures. Locate its root from the supplied workspace; do not assume the author's absolute filesystem path. Read `docs/http-api.md`, `src/dravenpdf/options.py`, and `src/dravenpdf/render/waits.py`. Documentation marked planned must be checked against source.

The verified HTTP route is `POST /v1/render/bundle`. It takes multipart files whose filenames are relative bundle paths. Supply `index.html` (or the HTML form field), renderer JS, CSS, chart JSON, and fonts. Relative assets are served from memory; external URLs are unnecessary. Authentication is `X-API-Key`, supplied from the caller's environment and never included in chart JSON/browser code. The response is `application/pdf`.

Use these options, confirming against the available server:

```json
{
  "paper": "A4",
  "media": "print",
  "print_background": true,
  "prefer_css_page_size": true,
  "wait_until": "load",
  "wait_for_ready_flag": true,
  "fail_on_resource_errors": true,
  "fail_on_page_errors": true,
  "timeout_ms": 30000
}
```

The example HTML loads `dravenviz.browser.js`, relative CSS/fonts, and `charts.json`, then calls `mountCharts`. After all chart readiness promises resolve, its integration bootstrap sets `window.__DRAVENPDF_READY__ = true`. This flag belongs to the example/integration bootstrap, not the generic chart renderer. On failure, surface an uncaught page error and never set ready. The readiness promise covers font loading, known dimensions, completed chart commit/layout, and all required chart mounts. Do not use a fixed sleep or load/networkidle alone as evidence of chart completion.

Provide a minimal runnable Python HTTP client example using the above multipart API and configurable URL/key, plus a versioned asset manifest mapping filenames to the files shipped by DravenViz. Python supplies ordinary chart JSON and document HTML; it does not draw charts or invoke Node. Demonstrate that the packed library's assets can be copied into any backend's build context without the original frontend repository.

Run a real A4 render containing multiple chart families and multiple instances of the same chart. Inspect PDF page renders for labels, patterns, clipping, gaps, and pagination. If HTTP service execution is unavailable but the DravenPDF library can run, use its verified bundle API and explain how to run the HTTP example; do not modify DravenPDF or expose a service publicly merely to complete the example.

## Documentation site, gallery, and playground

Ship a navigable documentation site in the standalone repository, with DravenViz branding, readable examples, and responsive layouts. It is a required user-facing deliverable, not only a README, generated API listing, or Storybook component catalogue. A lightweight React/static documentation app is sufficient; choose its tooling in the implementation plan. Local use and a static production build are required; public hosting/deployment is not part of this assignment.

Provide these pages or clearly navigable sections:

| Section                     | Required content and behavior                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start here                  | Package/environment matrix, clean install, first React chart, plain HTML chart, and Python-to-DravenPDF quickstart; explain which operations require a DOM                                                                                               |
| Chart gallery               | All eight V1 families and required modes, including sparklines, axis-free stacks, target bars, and circular rings; select an example to see its JSON, live chart, usage snippet, and linked export evidence                                              |
| Playground                  | Editable JSON, fixture selector, explicit Validate/Render and Reset actions, light/dark/print theme, logical dimensions, and formatter/locale/timezone options supported by the API; expose field-path errors and preserve the editable input on failure |
| API and schema              | Core, React, print/browser exports; complete chart-kind fields and defaults, options, errors, lifecycle/disposal, callbacks, table helpers, and versioning; downloadable authoritative schema                                                            |
| Styling and print           | Theme tokens/overrides, supplied datum roles/colors, fonts/assets and embedding modes, static label policies, final printed font sizing, and grayscale examples                                                                                          |
| SVG and PDF                 | Current-chart SVG preview/download, matched sample PDF preview/download, offline bundle/readiness explanation, asset-copy instructions, and runnable Python custom-PDF recipe                                                                            |
| Testing and troubleshooting | Exact verification commands, fixture IDs, baseline review/update procedure, measured performance/size results, and remedies for invalid specs, missing fonts/assets, zero dimensions, clipping, readiness failures, and unsupported SSR/Node export      |

### Playground and export behavior

- Render through the public DravenViz APIs, not a second demo renderer. Use the same fixtures as automated tests and export examples. Documentation may select options and show formatted results but must not implement its own scales, chart geometry, or business calculations.
- Validate JSON and semantic constraints before mounting. Display errors clearly and identify a retained last-successful preview as such; it must not appear to represent invalid edited input. No `eval`, executable JSON, arbitrary HTML, or code execution from the editor.
- Show an equivalent data table and a print preview with explicit physical width alongside chart options. Label the HTML print preview as a preview; a real generated PDF is separate evidence. On SVG download, await renderer readiness and export the current validated spec/options with the selected external/self-contained font mode. Repeated edit/render/reset/export actions must clean up prior mounts and object URLs.
- Provide copyable React, plain HTML, and Python examples with imports/asset paths matching shipped artifacts. Allow downloading the current validated chart JSON and copying the reproducible rendering options. No application-specific aliases, APIs, or unavailable source paths may appear in runnable examples.
- Include verified generated PDF samples for the gallery/coverage fixtures and a multi-family A4 report. Record the fixture/spec hash and rendering options for each PDF. If edits or options differ from its sample, visibly identify the PDF as the original fixture sample rather than the current playground output.
- For a custom PDF, provide a short recipe that takes the downloaded JSON/options and invokes the local Python example against a configurable DravenPDF URL, producing an inspectable output file. A one-click live PDF service bridge is optional, not needed for V1; if implemented, credentials stay in a local server-side environment and never in the browser bundle. Normal docs/gallery/SVG use must work without DravenPDF running.
- Serve scripts, styles, fonts, schema, and fixture data locally. No runtime CDN, analytics, account/login, dataset uploads, or remote font dependency is required. User-entered chart data stays in the page; optional persistence/sharing features are outside V1.

### Documentation verification and delivery

Add `dev:docs`, `build:docs`, `preview:docs`, and `test:docs` scripts. The README gives the exact commands and reports the actual local URL when launched; do not assume a fixed available port. Build the library before the docs production build, and exercise documentation against its public compiled exports rather than library source aliases.

Run browser checks against the built documentation site: gallery navigation and all family modes, valid and invalid JSON edits, reset, theme/dimension changes, current SVG downloads, sample PDF links/metadata, data tables, keyboard operation, and repeated render/export cleanup. Typecheck/execute runnable snippets as appropriate, and check internal links/assets for missing files. Keep docs tooling out of `npm pack`; ship consumer README/schema/API guidance and the required example assets without requiring the docs app to install the library.

The final handoff includes the built static docs output or reproducible build instructions, screenshots of the gallery/playground, generated SVG/PDF evidence, and verification results. Do not claim docs or PDF checks passed if their prerequisites were unavailable.

## Synthetic fixtures and examples

Create fixtures in this project; no application fixtures are available. The examples below are mandatory:

1. Weekly-flow multi-line fixture from the JSON example, including measured, missing, partial marker-only, and lagging continuous points.
2. Findings-by-severity bar/donut example using generic data: Critical 12, High 31, Medium 84, Low 122. All security labels/colors live in the example's adapter/theme override, not in core defaults.
3. Revenue/expenses composed chart with one currency axis and one percentage axis, showing generic reuse outside cybersecurity.
4. Percentage age-band stacks with a zero-total row and a missing member; missing rows must not be renormalized.
5. Scatter/bubble example with 13 synthetic services, numeric x/y values, area encoding, threshold lines, and shape distinctions.
6. Heatmap with ordered rows/columns, missing cells, measured-zero cells, contrasting cell labels, and a scale legend; linear target-bar and circular progress-ring examples with target markers and distinct zero/missing states.
7. Time annotation on a position whose tick label was thinned, plus long labels, negative values, singleton/all-equal, and all-zero examples.
8. Host-style isolation example with unrelated fonts/CSS and two independent chart instances.
9. Malicious text/invalid-number/oversized-input fixtures with precise validation errors.
10. Remediation-time/count composed fixture and grouped inflow/outflow plus cumulative-balance fixture. Include distinct axis units, a negative cumulative value, thresholds, partial/lagging markers bound to the correct axis, and static explanations.
11. Horizontal ranking and vertical stacked-category fixtures with long labels, supplied datum roles/colors, reference thresholds, and compact axis-free percentage composition. Include tiny segments without inflating their geometry.

The coverage table above is an acceptance checklist. Every row must link to executable fixture IDs and reviewed browser, standalone SVG, and PDF evidence. Extend the bubble fixture with selected-label collision cases and static point identification; extend trend fixtures with event annotations whose explanation survives export. Named application patterns are references for behavior, not names or business defaults required in the core API.

No real account IDs, tenant identifiers, network endpoints, secrets, or private application data are necessary. Fixed seeds/dates make visual fixtures reproducible.

## Delivery order and completion criteria

1. Establish the standalone package, schema/core, fonts, and one multi-line chart; demonstrate React, plain HTML, SVG export, and one real PDF through the same renderer. Establish its reviewed visual references, physical print sizing, and initial performance/size measurements before extending the renderer families. Add the documentation shell, quickstart, and a working playground for this slice so usability is exercised early.
2. Extend the typed contracts/renderers for V1 bars, areas, composed axes, and donut. Add private renderer logic without leaking upstream types.
3. Complete scatter/bubble, heatmap, progress, annotations, and corresponding edge-case fixtures.
4. Verify distributable artifacts in clean consumer projects; complete the documentation site's gallery/API/troubleshooting pages and tests, and finish the multi-family PDF example.

These are build slices, not separate approval requests inferred from this document. Follow the user's execution instructions and applicable agent workflow. The complete V1 assignment includes all four slices. Future application migration and replacement of Recharts internals are separate scopes.

Maintain a verification matrix linking each requirement/coverage row to fixtures, commands, and evidence. Automate the reproducible build, schema/type consistency, unit, browser, docs, and clean-package checks in the repository's CI workflow; the required PDF integration check runs in a documented environment with DravenPDF/Chromium available. Missing PDF prerequisites must produce an explicit unverified result, never a substituted screenshot or a reported pass. Do not add service secrets to source or silently depend on an author's local setup.

Acceptance requires:

- Public APIs and all advertised V1 families behave according to the documented schema and rendering rules.
- Core imports/validation work in Node without React or a DOM; browser-backed methods document their environment requirement.
- React examples work from installed package artifacts; plain HTML works from the self-contained browser bundle with no application framework/build setup.
- Unit/contract tests cover validation, domains, ordering, stack normalization, missing-value semantics, and ID/namespace behavior. SVG structural snapshots are stable within the declared environment.
- Browser tests verify populated rendering, themes, responsive dimensions, interactions, keyboard behavior, long labels, font loading, disposal, and failure readiness. Use pinned Chromium/fonts and review visual regression fixtures.
- Lifecycle tests cover bounded readiness, zero-size hosts, batch failure cleanup, disposal before ready, repeated exports, and stale React update completion. Package/schema/API compatibility and example checks prevent undocumented drift.
- Real DravenPDF output preserves the chart's series/values/domain/quality cues at equal dimensions/theme, then remains readable in A4 print layout. Test offline operation and missing-font/script/data failures.
- The visual reference gallery, final-size typography checks, same-input browser/SVG/PDF comparisons, full-page PDF review, and mismatch/baseline records satisfy "Visual quality and acceptance evidence" above. Include at least one reviewed reference per V1 family and coverage of its required modes; a structural snapshot alone is insufficient.
- `npm pack` contains all exports, schema, declarations, font assets/licenses, manifest, and browser bundle. Install the tarball into a clean React consumer and a clean non-React/core consumer outside the source tree; no symlinks or hidden workspace dependencies. Test a plain HTML consumer from copied dist assets.
- Supply the packaged-size and latency measurements, sample counts, scenario definitions, numeric budgets, and regression results required by "Measured performance and size" above. Initial chart-readiness target is p95 <= 250 ms with fonts already loaded; investigate misses before claiming performance acceptance. This excludes Chromium launch and total PDF rendering. Do not claim a 100 MB total browser budget.
- Scripts include `build`, `typecheck`, `test`, `test:browser`, `test:pdf`, and `test:package`; README explains prerequisites and exact commands. Report any unavailable integration checks as unverified, never passed.
- The documentation site satisfies the required sections, gallery/playground/export behavior, compiled-API examples, local/static build, and `test:docs` checks above. A README or disconnected chart demo alone does not satisfy this deliverable.
- Final delivery includes source, build artifacts or reproducible build instructions, packed-package evidence, rendered examples/PDF evidence, actual verification outcomes, API documentation, and any remaining limitations. Do not publish/deploy or migrate an external application without separate instructions.

## Future application adoption

A consuming application maps its own API data to VizSpec, supplies domain-specific labels/themes, and handles routing/filtering/loading states outside the package. It can replace direct Recharts imports chart by chart with DravenViz while retaining its existing queries and business meaning. Python report services can ship the same packed browser assets and JSON with their existing HTML.

The library is not a framework-specific UI component set or a report-template project. It can later gain additional frontend adapters, graph layouts, or a DOM-free SVG renderer behind the same public chart contract. Those additions must not compromise the independent package boundary established in V1.

## Fresh-agent starting instruction

Read this specification and the available DravenPDF bundle/readiness source. Inspect only the new library workspace and that dependency. Produce a concrete implementation plan covering complete chart-kind schemas/API signatures, dependency/environment versions, build/package outputs, synthetic fixtures and coverage mapping, browser/print lifecycle and errors, documentation site/playground, and all acceptance checks; then build according to the user's review/execution instructions. Confirm the new project directory and how DravenPDF is available from the supplied workspace; do not create a nested application repository or assume the original author's filesystem paths. Establish the first end-to-end vertical slice before extending families, and deliver every V1 slice including docs and package verification. The original application code and live sites are not prerequisites. All needed application context has been replaced by explicit behaviors and examples here.
