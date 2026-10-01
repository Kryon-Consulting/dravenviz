// Throwaway spike harness for design section 4. Probes read the DOM for measurement only.
import React, { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  useXAxisScale,
  useYAxisScale,
  usePlotArea,
  useXAxisDomain,
  useYAxisDomain,
} from 'recharts';
import { collectInventory, exportProbe } from './export-probe';

// Layout box the DravenViz layout would own: margins + explicit axis sizes.
const W = 600;
const H = 300;
const MARGIN = { top: 20, right: 30, bottom: 10, left: 10 };
const Y_AXIS_W = 50;
const X_AXIS_H = 30;
const EXPECTED_PLOT = {
  x: MARGIN.left + Y_AXIS_W,
  y: MARGIN.top,
  width: W - MARGIN.left - MARGIN.right - Y_AXIS_W,
  height: H - MARGIN.top - MARGIN.bottom - X_AXIS_H,
};

type Row = { k: string; a: number | null; b?: number | null };
const CATS = ['A', 'B', 'C', 'D'];
const LINE_DATA: Row[] = [
  { k: 'A', a: 12 },
  { k: 'B', a: 25 },
  { k: 'C', a: 18 },
  { k: 'D', a: 20 },
];

const w = window as any;
w.hooks = {} as Record<string, any>;

function Capture({ name }: { name: string }) {
  const xs = useXAxisScale();
  const ys = useYAxisScale();
  const plot = usePlotArea();
  const xd = useXAxisDomain();
  const yd = useYAxisDomain();
  w.hooks[name] = { xs, ys, plot, xd, yd };
  return null;
}

function Overlay({ data, field }: { data: Row[]; field: 'a' | 'b' }) {
  const xs = useXAxisScale();
  const ys = useYAxisScale();
  if (!xs || !ys) return null;
  return (
    <g data-spike-overlay="1">
      {data.map((d) => {
        const v = d[field];
        if (v == null) return null;
        const cx = xs(d.k, { position: 'middle' });
        const cy = ys(v);
        if (cx == null || cy == null) return null;
        return <circle key={d.k} data-spike-overlay-dot={d.k} cx={cx} cy={cy} r={3} fill="none" stroke="#f0f" />;
      })}
    </g>
  );
}

const xAxisBand = (extra: object = {}) => (
  <XAxis
    dataKey="k"
    type="category"
    scale="band"
    padding={{ left: 0, right: 0 }}
    interval={0}
    height={X_AXIS_H}
    {...extra}
  />
);
const yAxisNum = (domain: [number, number], ticks: number[], extra: object = {}) => (
  <YAxis
    type="number"
    scale="linear"
    domain={domain}
    ticks={ticks}
    allowDataOverflow={true}
    width={Y_AXIS_W}
    {...extra}
  />
);

function Chart(props: { id: string; data: Row[]; children: React.ReactNode; stackOffset?: 'sign' | 'none'; barGap?: number }) {
  return (
    <div id={props.id} style={{ width: W, height: H }}>
      <ComposedChart
        width={W}
        height={H}
        data={props.data}
        margin={MARGIN}
        stackOffset={props.stackOffset}
        barCategoryGap={0}
        barGap={props.barGap}
      >
        {props.children}
      </ComposedChart>
    </div>
  );
}

const num = (s: string | null) => (s == null ? NaN : parseFloat(s));
const q = <T extends Element = Element>(root: ParentNode, sel: string) => Array.from(root.querySelectorAll<T>(sel));
const svgOf = (id: string) => document.querySelector(`#${id} svg.recharts-surface`) as SVGSVGElement;
const pathPoints = (d: string) =>
  (d.match(/[ML]\s*-?[\d.e+-]+[ ,]-?[\d.e+-]+/g) ?? []).map((t) => t.slice(1).trim().split(/[ ,]+/).map(Number));

// ---------------------------------------------------------------- case: overlay
function OverlayCase() {
  return (
    <Chart id="c" data={LINE_DATA}>
      <CartesianGrid vertical={false} />
      {xAxisBand()}
      {yAxisNum([0, 30], [0, 10, 20, 30])}
      <Line dataKey="a" isAnimationActive={false} stroke="#2a6" dot={{ r: 4, fill: '#2a6' }} />
      <Overlay data={LINE_DATA} field="a" />
      <rect data-spike-plain="1" x={70} y={30} width={10} height={10} fill="none" stroke="#f0f" />
      <Capture name="overlay" />
    </Chart>
  );
}
function overlayAlignment() {
  const svg = svgOf('c');
  const overlay = svg.querySelector('[data-spike-overlay]');
  const overlayInsideSurface = !!overlay && svg.contains(overlay);
  const plain = svg.querySelector('rect[data-spike-plain]');
  const plainChildInsideSurface = !!plain && svg.contains(plain) && plain.getAttribute('x') === '70';
  const dots = q(svg, '.recharts-line-dots circle');
  const ov = q(svg, 'circle[data-spike-overlay-dot]');
  // Recharts dot centres vs hook-scaled overlay circles
  let maxDeltaUnits = Infinity;
  if (dots.length === ov.length && dots.length > 0) {
    maxDeltaUnits = 0;
    dots.forEach((d, i) => {
      maxDeltaUnits = Math.max(
        maxDeltaUnits,
        Math.abs(num(d.getAttribute('cx')) - num(ov[i].getAttribute('cx'))),
        Math.abs(num(d.getAttribute('cy')) - num(ov[i].getAttribute('cy'))),
      );
    });
  }
  const p = w.hooks.overlay.plot;
  const n = CATS.length;
  // band centres measured from the Line's own dot DOM, compared to the ideal (k+0.5)*w/n
  const centres = dots.map((d) => num(d.getAttribute('cx')));
  const bandDeltas = centres.map((cx, k) => Math.abs(cx - (p.x + ((k + 0.5) * p.width) / n)));
  const lineOnlyBandCentres = centres.length === n && Math.max(...bandDeltas) <= 0.5;
  const plotDeltas = ['x', 'y', 'width', 'height'].map((key) => Math.abs(p[key] - (EXPECTED_PLOT as any)[key]));
  return {
    overlayInsideSurface,
    plainChildInsideSurface,
    maxDeltaUnits,
    dotCount: dots.length,
    overlayCount: ov.length,
    lineOnlyBandCentres,
    maxBandCentreDelta: Math.max(...bandDeltas),
    plotAreaMatchesLayoutBox: Math.max(...plotDeltas) <= 0.5,
    plotArea: p,
    expectedPlot: EXPECTED_PLOT,
    plotDeltas,
    xDomain: w.hooks.overlay.xd,
    yDomain: w.hooks.overlay.yd,
  };
}

// ---------------------------------------------------------------- case: stacks
const GROUP: Row[] = [
  { k: 'A', a: 10, b: 6 },
  { k: 'B', a: 8, b: 9 },
  { k: 'C', a: 6, b: 3 },
  { k: 'D', a: 4, b: 7 },
];
const STACK: Row[] = [
  { k: 'A', a: 10, b: 5 },
  { k: 'B', a: 8, b: -3 },
  { k: 'C', a: 6, b: 4 },
  { k: 'D', a: 4, b: -2 },
];
const AREA: Row[] = [
  { k: 'A', a: 10, b: 5 },
  { k: 'B', a: 8, b: 3 },
  { k: 'C', a: 6, b: 4 },
  { k: 'D', a: 4, b: 2 },
];
function StacksCase() {
  return (
    <>
      <Chart id="grouped" data={GROUP}>
        {xAxisBand()}
        {yAxisNum([0, 12], [0, 6, 12])}
        <Bar dataKey="a" fill="#36c" isAnimationActive={false} />
        <Bar dataKey="b" fill="#c63" isAnimationActive={false} />
        <Capture name="grouped" />
      </Chart>
      <Chart id="stacked" data={STACK} stackOffset="sign">
        {xAxisBand()}
        {yAxisNum([-5, 15], [-5, 0, 5, 10, 15])}
        <Bar dataKey="a" stackId="s" fill="#36c" isAnimationActive={false} />
        <Bar dataKey="b" stackId="s" fill="#c63" isAnimationActive={false} />
        <Capture name="stacked" />
      </Chart>
      <Chart id="areas" data={AREA} stackOffset="none">
        {xAxisBand()}
        {yAxisNum([0, 16], [0, 4, 8, 12, 16])}
        <Area dataKey="a" stackId="s" stroke="#36c" fill="#36c" isAnimationActive={false} />
        <Area dataKey="b" stackId="s" stroke="#c63" fill="#c63" isAnimationActive={false} />
        <Capture name="areas" />
      </Chart>
    </>
  );
}
// Recharts gives bars below the baseline a NEGATIVE height (y = bottom edge); normalise to top/height.
const rectOf = (r: Element) => {
  const y = num(r.getAttribute('y'));
  const h = num(r.getAttribute('height'));
  return { x: num(r.getAttribute('x')), y: Math.min(y, y + h), w: num(r.getAttribute('width')), h: Math.abs(h), rawH: h };
};
function stacks() {
  const barsOf = (id: string) =>
    q(svgOf(id), '.recharts-bar').map((g) => q(g, '.recharts-bar-rectangle path, .recharts-bar-rectangle rect').map(rectOf));
  const g = barsOf('grouped');
  const groupedDistinctX =
    g.length === 2 && g[0].length === 4 && g[1].length === 4 && g[0].every((r, i) => r.x + r.w <= g[1][i].x + 0.01 && r.w > 0 && g[1][i].w > 0);
  const s = barsOf('stacked');
  const stackedSameX = s.length === 2 && s[0].length === 4 && s[0].every((r, i) => Math.abs(r.x - s[1][i].x) < 0.01 && Math.abs(r.w - s[1][i].w) < 0.01);
  const ys = w.hooks.stacked.ys as (v: number) => number;
  const y0 = ys(0);
  // category B and D have negative b: rect must hang below the zero line (top at y0).
  const negTops = [1, 3].map((i) => s[1][i].y - y0);
  const signOffsetNegativeBelowZero = negTops.every((d) => Math.abs(d) <= 0.5) && [0, 2].every((i) => s[1][i].y + s[1][i].h <= s[0][i].y + 0.5);
  const positivesStackOnA = [0, 2].map((i) => Math.abs(s[1][i].y + s[1][i].h - s[0][i].y));
  // area stack: top of second area equals yScale(a+b)
  const ays = w.hooks.areas.ys as (v: number) => number;
  const areaPaths = q(svgOf('areas'), '.recharts-area-area').map((p) => p.getAttribute('d') ?? '');
  const sums = AREA.map((r) => (r.a as number) + (r.b as number));
  let topDelta = Infinity;
  let areaXDelta = Infinity;
  const ap = w.hooks.areas.plot;
  if (areaPaths.length === 2) {
    const pts = pathPoints(areaPaths[1]).slice(0, AREA.length);
    topDelta = Math.max(...pts.map((p, i) => Math.abs(p[1] - ays(sums[i]))));
    areaXDelta = Math.max(...pts.map((p, i) => Math.abs(p[0] - (ap.x + ((i + 0.5) * ap.width) / AREA.length))));
  }
  return {
    groupedDistinctX,
    stackedSameX,
    signOffsetNegativeBelowZero,
    negativeTopMinusZeroLine: negTops,
    positivesStackOnA,
    areaStackTopEqualsSum: topDelta <= 0.5,
    areaTopDelta: topDelta,
    areaXAtBandCentres: areaXDelta <= 0.5,
    areaXDelta,
    groupedRects: g,
    stackedRects: s,
  };
}

// ---------------------------------------------------------------- case: nulls
const NULLS: Row[] = [
  { k: 'A', a: 12, b: 4 },
  { k: 'B', a: null, b: null },
  { k: 'C', a: 18, b: 6 },
  { k: 'D', a: 20, b: 5 },
];
function NullsCase() {
  return (
    <>
      <Chart id="nline" data={NULLS}>
        {xAxisBand()}
        {yAxisNum([0, 30], [0, 10, 20, 30])}
        <Line dataKey="a" stroke="#2a6" isAnimationActive={false} connectNulls={false} />
      </Chart>
      <Chart id="nbar" data={NULLS}>
        {xAxisBand()}
        {yAxisNum([0, 30], [0, 10, 20, 30])}
        <Bar dataKey="a" fill="#36c" isAnimationActive={false} />
      </Chart>
      <Chart id="narea" data={NULLS} stackOffset="none">
        {xAxisBand()}
        {yAxisNum([0, 30], [0, 10, 20, 30])}
        <Area dataKey="a" stackId="s" stroke="#36c" fill="#36c" isAnimationActive={false} connectNulls={false} />
        <Area dataKey="b" stackId="s" stroke="#c63" fill="#c63" isAnimationActive={false} connectNulls={false} />
      </Chart>
    </>
  );
}
const moves = (d: string) => (d.match(/M/g) ?? []).length;
function nulls() {
  const linePaths = q(svgOf('nline'), 'path.recharts-line-curve').map((p) => p.getAttribute('d') ?? '');
  const lineSegments = linePaths.length ? moves(linePaths[0]) : -1;
  const rects = q(svgOf('nbar'), '.recharts-bar-rectangle').map((g) => rectOf(g.querySelector('path,rect')!));
  const barCount = rects.length;
  const zeroHeight = rects.filter((r) => r.h === 0).length;
  const barForNull = barCount === 3 && zeroHeight === 0 ? 'absent' : `count=${barCount} zeroHeight=${zeroHeight}`;
  const areaFills = q(svgOf('narea'), 'path.recharts-area-area').map((p) => p.getAttribute('d') ?? '');
  const areaMoves = areaFills.map(moves);
  const areaCurves = q(svgOf('narea'), 'path.recharts-area-curve').map((p) => moves(p.getAttribute('d') ?? ''));
  return {
    lineSegments,
    linePath: linePaths[0],
    barForNull,
    barCount,
    zeroHeight,
    stackedAreaBreak: areaMoves.length === 2 && areaMoves.every((m) => m >= 2),
    areaFillMoves: areaMoves,
    areaCurveMoves: areaCurves,
    areaFillPaths: areaFills,
  };
}

// ---------------------------------------------------------------- case: noanim
function NoAnimChart() {
  return (
    <Chart id="c" data={LINE_DATA}>
      {xAxisBand()}
      {yAxisNum([0, 30], [0, 10, 20, 30])}
      <Line dataKey="a" stroke="#2a6" isAnimationActive={false} />
      <Bar dataKey="a" fill="#36c" isAnimationActive={false} />
      <Area dataKey="a" stroke="#c63" fill="#c63" isAnimationActive={false} />
    </Chart>
  );
}
const geom = (root: ParentNode) =>
  JSON.stringify([
    q(root, 'path.recharts-line-curve').map((p) => p.getAttribute('d')),
    q(root, 'path.recharts-area-area').map((p) => p.getAttribute('d')),
    q(root, '.recharts-bar-rectangle path').map((p) => p.getAttribute('d')),
    q(root, '.recharts-line-dots circle').map((p) => p.getAttribute('cx') + ',' + p.getAttribute('cy')),
  ]);
async function firstCommitStable() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<NoAnimChart />));
  const afterCommit = geom(host);
  const pathAfterCommit = afterCommit;
  const frames: string[] = [];
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    frames.push(geom(host));
  }
  await new Promise((r) => setTimeout(r, 500));
  const pathAfter500ms = geom(host);
  const parts = JSON.parse(pathAfterCommit) as unknown[][];
  const eachGeometryNonEmpty = parts.length === 4 && parts.every((a) => a.length > 0);
  return {
    pathAfterCommit,
    pathAfter500ms,
    eachGeometryNonEmpty,
    geometryCounts: parts.map((a) => a.length),
    framesEqualFinal: frames.every((f) => f === pathAfter500ms),
  };
}

// ---------------------------------------------------------------- case: hostcss
const HOST_CSS = 'text{fill:red} path{stroke-width:5} *{font-family:serif}';
const STY = { stroke: '#123456', strokeWidth: 2, fill: '#654321', fontFamily: 'monospace', fontSize: 11, opacity: 0.9 };
const TICK_STYLE = { fill: '#0a0b0c', fontFamily: 'monospace', fontSize: 11 };
function HostCssCase() {
  return (
    <>
      <style>{HOST_CSS}</style>
      <Chart id="c" data={LINE_DATA}>
        {xAxisBand({ tick: { style: TICK_STYLE }, tickLine: { style: { stroke: '#111111', strokeWidth: 2 } }, axisLine: { style: { stroke: '#111111', strokeWidth: 2 } } })}
        {yAxisNum([0, 30], [0, 10, 20, 30], { tick: { style: TICK_STYLE } })}
        <Line dataKey="a" style={STY} stroke="#2a6" strokeWidth={2} isAnimationActive={false} dot={{ r: 4, style: { fill: '#ab12cd', strokeWidth: 2, stroke: '#ab12cd' } }} />
        <Bar dataKey="a" style={{ fill: '#36c', stroke: '#36c', strokeWidth: 2 }} isAnimationActive={false} />
        <Area dataKey="a" style={{ fill: '#c63', stroke: '#c63', strokeWidth: 2 }} isAnimationActive={false} />
        <ReferenceLine y={15} style={{ stroke: '#333333', strokeWidth: 2 }} />
      </Chart>
      <Chart id="c2" data={LINE_DATA}>
        {xAxisBand({ tick: (p: any) => <text x={p.x} y={p.y + 10} textAnchor="middle" data-spike-tick-render="1" style={TICK_STYLE}>{p.payload.value}</text> })}
        {yAxisNum([0, 30], [0, 10, 20, 30], { tick: (p: any) => <text x={p.x} y={p.y} textAnchor="end" data-spike-tick-render="1" style={TICK_STYLE}>{p.payload.value}</text> })}
        <Line dataKey="a" stroke="#2a6" isAnimationActive={false} dot={(p: any) => <circle key={p.index} cx={p.cx} cy={p.cy} r={4} data-spike-dot-render="1" style={{ fill: '#ab12cd', stroke: '#ab12cd', strokeWidth: 2 }} />} />
      </Chart>
    </>
  );
}
function hostCss() {
  const cs = (e: Element) => getComputedStyle(e);
  const near = (a: string, b: string) => a === b;
  const svg = svgOf('c');
  const rows: { name: string; forwards: boolean; survives: boolean; detail: string; props: Record<string, boolean> }[] = [];
  const check = (name: string, els: Element[], props: Record<string, string>) => {
    if (!els.length) {
      rows.push({ name, forwards: false, survives: false, detail: 'element not found', props: {} });
      return;
    }
    const keys = Object.keys(props);
    const css = (k: string) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    const forwards = els.every((e) => keys.every((k) => (e.getAttribute('style') ?? '').toLowerCase().includes(css(k))));
    const perProp = Object.fromEntries(keys.map((k) => [k, els.every((e) => near(cs(e).getPropertyValue(css(k)), props[k]))]));
    rows.push({ name, forwards, survives: keys.every((k) => perProp[k]), detail: els[0].outerHTML.slice(0, 160), props: perProp });
  };
  check('Line', q(svg, 'path.recharts-line-curve'), { strokeWidth: '2px', stroke: 'rgb(18, 52, 86)' });
  check('Line.dot', q(svg, '.recharts-line-dots circle'), { fill: 'rgb(171, 18, 205)', strokeWidth: '2px' });
  check('Bar', q(svg, '.recharts-bar-rectangle path'), { fill: 'rgb(51, 102, 204)', strokeWidth: '2px' });
  check('Area', q(svg, 'path.recharts-area-area'), { fill: 'rgb(204, 102, 51)' });
  check('Area.curve', q(svg, 'path.recharts-area-curve'), { strokeWidth: '2px' });
  check('XAxis.tick', q(svg, 'text.recharts-cartesian-axis-tick-value[orientation="bottom"]'), { fill: 'rgb(10, 11, 12)', fontFamily: 'monospace' });
  check('YAxis.tick', q(svg, 'text.recharts-cartesian-axis-tick-value[orientation="left"]'), { fill: 'rgb(10, 11, 12)', fontFamily: 'monospace' });
  check('XAxis.axisLine', q(svg, '.recharts-xAxis .recharts-cartesian-axis-line'), { strokeWidth: '2px' });
  check('XAxis.tickLine', q(svg, '.recharts-xAxis .recharts-cartesian-axis-tick-line'), { strokeWidth: '2px' });
  check('ReferenceLine', q(svg, '.recharts-reference-line-line'), { strokeWidth: '2px' });
  const svg2 = svgOf('c2');
  check('XAxis.tick(render prop)', q(svg2, '[data-spike-tick-render][text-anchor="middle"]'), { fill: 'rgb(10, 11, 12)', fontFamily: 'monospace' });
  check('YAxis.tick(render prop)', q(svg2, '[data-spike-tick-render][text-anchor="end"]'), { fill: 'rgb(10, 11, 12)', fontFamily: 'monospace' });
  check('Line.dot(render prop)', q(svg2, '[data-spike-dot-render]'), { fill: 'rgb(171, 18, 205)', strokeWidth: '2px' });
  // Negative control: an unstyled Line path in chart c2 must be hit by the host rule (path{stroke-width:5}).
  const controlEl = svg2.querySelector('path.recharts-line-curve')!;
  const hostCssBites = cs(controlEl).getPropertyValue('stroke-width') === '5px';
  const componentsForwardingStyle = rows.filter((r) => r.forwards && r.survives).map((r) => r.name);
  const nonForwarding = rows.filter((r) => !(r.forwards && r.survives)).map((r) => r.name);
  const pick = (names: string[]) => rows.filter((r) => names.includes(r.name));
  const textRows = pick(['XAxis.tick', 'YAxis.tick']);
  const lineRows = pick(['Line', 'Line.dot']);
  return {
    rows,
    hostCssBites,
    componentsForwardingStyle,
    nonForwarding,
    textFillsUnchanged: textRows.every((r) => r.props.fill === true),
    lineStrokeWidthsUnchanged: lineRows.every((r) => r.props.strokeWidth === true),
    fontFamilyUnchanged: textRows.every((r) => r.props.fontFamily === true),
  };
}

// ---------------------------------------------------------------- case: export
function ExportCase() {
  return (
    <Chart id="c" data={LINE_DATA}>
      <CartesianGrid vertical={false} />
      {xAxisBand()}
      {yAxisNum([0, 30], [0, 10, 20, 30])}
      <Area dataKey="a" stroke="#c63" fill="#c63" fillOpacity={0.2} isAnimationActive={false} />
      <Bar dataKey="a" fill="#36c" isAnimationActive={false} />
      <Line dataKey="a" stroke="#2a6" isAnimationActive={false} dot={{ r: 3 }} />
      <ReferenceLine y={15} stroke="#333" strokeDasharray="4 2" label="ref" />
      <Overlay data={LINE_DATA} field="a" />
    </Chart>
  );
}

// ---------------------------------------------------------------- mount
const CASES: Record<string, () => React.ReactElement> = {
  overlay: OverlayCase,
  stacks: StacksCase,
  nulls: NullsCase,
  noanim: () => <div />,
  hostcss: HostCssCase,
  export: ExportCase,
};
const name = new URLSearchParams(location.search).get('case') ?? 'overlay';
const Comp = CASES[name];
function Ready() {
  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => (document.body.dataset.ready = '1')));
  }, []);
  return null;
}
w.probe = {
  overlayAlignment,
  stacks,
  nulls,
  firstCommitStable,
  hostCss,
  exportProbe: (inject = false) => exportProbe(svgOf('c'), { inject }),
  inventory: () => collectInventory(Array.from(document.querySelectorAll('svg.recharts-surface'))),
};
if (name !== 'noanim') {
  createRoot(document.getElementById('root')!).render(
    <>
      <Comp />
      <Ready />
    </>,
  );
} else {
  document.body.dataset.ready = '1';
}
