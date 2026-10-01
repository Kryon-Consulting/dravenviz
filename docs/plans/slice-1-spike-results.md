# Slice 1 spike results: Recharts 3.10.1

Harness: `spikes/recharts-3.10/` (throwaway, self-contained). Recharts 3.10.1, React/ReactDOM/react-is 19.3.0, Vite 8.3.1,
Playwright 1.56.1 on the preinstalled Chromium (revision 1194). Run: `pnpm --dir spikes/recharts-3.10 install --ignore-workspace`
then `pnpm --dir spikes/recharts-3.10 exec playwright test` (set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`).
Raw numbers: `spikes/recharts-3.10/measurements.json`. Inventory candidate: `spikes/recharts-3.10/attribute-inventory.json`.

Layout used: chart 600 x 300, margin {top 20, right 30, bottom 10, left 10}, `YAxis width=50`, `XAxis height=30`,
so the expected plot box is x=60, y=20, w=510, h=240. All category axes use `scale="band"`, zero padding, `interval={0}`;
all numeric axes use `type="number"`, `scale="linear"`, explicit `domain`/`ticks`, `allowDataOverflow`. Animation is off on every mark.

## Result table

| # | Design section 4 point | Result | Measured |
|---|---|---|---|
| 1 | Overlay children inside the surface, aligned to marks; band centres; `usePlotArea()` equals layout box | PASS | Hook overlay and a plain `<rect>` child both inside `svg.recharts-surface`. Hook-scaled circle vs Line dot centre: max delta 0 (limit 0.5). Line-only chart dots at `plot.x + (k+0.5)*w/n`: max delta 0. `usePlotArea()` = {60, 20, 510, 240}, deltas 0/0/0/0. |
| 2 | Grouped bars side by side; `stackId` bars and areas share a band; `sign` offset; stacked area top = sum | PASS | Grouped: two 62-wide rects per band, no overlap. Stacked: identical x and width (128) per category. Negative members start exactly at the zero line (delta 0) and positives sit on the first bar (delta 0). Stacked area top vs `yScale(a+b)`: max delta 0; stacked area x values at band centres: max delta 0. |
| 3 | `null` members produce gaps | PASS | Line `[12,null,18,20]`: path `M123.75,164ZM378.75,116L506.25,100`, 2 moves. Bar: 3 rects for 4 categories, none zero-height. Stacked areas with a null member in both series: each fill path has 2 moves (broken). |
| 4 | First commit has final geometry | PASS | After `flushSync(root.render(...))` line, area, bar and dot geometry are each non-empty (1, 1, 4, 4 items) and byte-identical to the geometry 3 animation frames and 500 ms later. |
| 5 | Real chart passes normalize and strict allowlist; attribute inventory | PASS | Line + Bar + Area + grid + reference line + overlay chart. 0 disallowed elements or attributes after normalize; serialized SVG has no `class=`, `style=` or `recharts` (Recharts clip-path ids such as `recharts1-clip` are renamed by the id-namespacing step, which the probe performs). Negative control (5b): `onclick` and `foo` are injected into the clone before the normalize step, so they pass through the strip step and are reported by the validator as `attr:path@onclick`, `event:path@onclick`, `attr:path@foo`, so the allowlist can fail. |
| 6 | Inline `style` props resist host CSS (`text{fill:red} path{stroke-width:5} *{font-family:serif}`) | PASS | Negative control: an unstyled Line path is restyled to `stroke-width: 5px`, so the host rule does bite. Every component below kept its inline values. |

No point failed, so no section 4 fallback applies and section 4 needs no change for these points. Observations the controller may want to fold into the design are listed at the end.

### Point 6 per component (style forwarded and survives host CSS)

Forwarded and survived: `Line` (path), `Line.dot` (object prop), `Bar` (rectangle path), `Area` (fill path), `Area.curve`,
`XAxis.tick`, `YAxis.tick` (object `tick={{ style }}` reaches the `<text>`), `XAxis.axisLine`, `XAxis.tickLine`, `ReferenceLine`.
Render-prop variants (`tick`, `dot` functions returning our own SVG with `style`) also survive. Not forwarding: none observed.

## Public hook names (verified in `recharts/types/index.d.ts`)

Exported and used: `useXAxisScale(xAxisId?)`, `useYAxisScale(yAxisId?)`, `usePlotArea()`, `useXAxisDomain(xAxisId?)`, `useYAxisDomain(yAxisId?)`.
Also exported: `useOffset`, `useXAxisTicks`, `useYAxisTicks`, `useCartesianScale`, `useXAxisInverseScale` and `useYAxisInverseScale`
(plus `...InverseDataSnapScale` / `...InverseTickSnapScale`), `useActiveTooltipLabel`, `useActiveTooltipCoordinate`,
`useActiveTooltipDataPoints`, `useIsTooltipActive`. `useChartWidth`/`useChartHeight` are also exported. The scale hooks return
`(value, { position?: 'start' | 'middle' | 'end' }) => number | undefined`; band centres need `position: 'middle'`.
`useXAxisDomain()` returned `["A","B","C","D"]` and `useYAxisDomain()` returned `[0, 30]`, matching the model domain (the readiness comparison in section 4 is feasible).

## Attribute inventory summary

`attribute-inventory.json` maps Recharts component class (for example `recharts-curve`, `recharts-rectangle`,
`recharts-cartesian-axis-tick-line`) to element to attribute, each classified `presentation | geometry | metadata | passthrough | unclassified` (`passthrough` = `aria-*`, `data-dv-*`).
Harness-authored elements (marked `data-spike-*`) are excluded. Observed across all cases: 36 component keys, 72 distinct
element@attribute pairs: 15 presentation, 25 geometry, 32 metadata, **0 unclassified** (the suite fails if any appear).

Classification is explicit and per element, not a catch-all. Geometry is a per-tag table (`width`/`height` are geometry only on `svg` and `rect`;
`x`/`y` only on `rect`, `text`, `tspan`). Metadata is `class`, `style`, `tabindex`, `focusable`, `cursor`, `pointer-events`, any `data-*`,
plus a tag-specific table taken from the observed inventory. Anything else is `unclassified`: the normalizer does NOT strip it, so the strict allowlist reports it.

Metadata that Recharts emits and the normalizer removes (beyond `class`, `style`, `tabindex`):
- `line`: `x`, `y`, `width`, `height`, `angle`, `orientation` (axis and tick lines also carry `x1..y2`, the real geometry)
- `text`: `width`, `height`, `orientation`, `offset`
- `path` (bars): `name` (value `"undefined"` when no `name` prop), `k`, `radius`, `x`, `y`, `width`, `height`
- `path` (curves), `circle`: `width`, `height`
- `svg`: `tabindex`; the root also has `role="application"`, which finalize replaces with `role="img"`.

History: an earlier version of the probe stripped every attribute not in its geometry table, so the allowlist could not fail. That was
fixed; the tag-specific metadata table above was built from the observed inventory, and the injected-attribute control (5b, injected before normalize) proves unknown attributes are not stripped and now surface.

## Observations for the design (no failing point)

1. Axis tick labels are in a separate layer (`recharts-cartesian-axis-tick-labels`), not under `.recharts-xAxis`; tick lines and labels are siblings. Code must not assume a single axis group.
2. Bars below the baseline get a **negative height** attribute-wise for the rect geometry (`y` = bottom edge), although the path `d` is valid. Geometry tests should normalize with `min(y, y+h)`.
3. Recharts emits `<title>` and `<desc>` children on the surface root; `role="application"` and `tabindex="0"` on the root.
4. Clip-path and element ids contain `recharts` (`recharts1-clip`, `recharts-line-_r_2_`); the section 10 ID rewrite is required for the "no `recharts` string" rule, not optional.
5. `Bar` without a `name` prop emits `name="undefined"` on each rectangle path.
6. Materializing computed styles adds all 14 properties to every element including `title`/`desc`; pruning (section 10 step 3) matters for file size.

## Limits of this spike

- The probes cover one data size (4 categories). Band-centre, stacking and null behaviour were not exercised with time or linear x axes (slice 2 and later).
- The normalizer is a first cut: it omits the `display:none` / `data-dv-interactive` drop and pruning, and does not test computed-style equivalence of the re-loaded file.
- Stacked-area null handling was tested with `null` in every series at the same category; a partial missing member was not.
