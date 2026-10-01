import { DravenVizError } from '../core/index';
import type { Box, LaidOutChart } from './layout/types';
import type { MarkManifest } from './model/types';

/** What the overlay probe must report for the commit to match layout and the model. */
export interface CommitExpectations {
  plot: Box;
  xDomain: { kind: 'category'; keys: string[] } | { kind: 'numeric'; domain: [number, number] };
  yDomains: Record<string, [number, number]>;
}

export function expectationsOf(laid: LaidOutChart): CommitExpectations {
  const x = laid.model.x;
  return {
    plot: laid.boxes.plot,
    xDomain:
      x.type === 'category'
        ? { kind: 'category', keys: [...x.keys] }
        : { kind: 'numeric', domain: [x.domain[0], x.domain[1]] },
    yDomains: Object.fromEntries(laid.model.yAxes.map((a) => [a.id, a.domain])),
  };
}

const PLOT_TOLERANCE = 0.5;
const GEOMETRY_ATTRIBUTES = [
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
] as const;
const DRAWABLE = 'path,circle,rect,line,polygon,polyline,ellipse,text';

function fail(svg: Element, rule: string, message: string): never {
  const chartId = svg.getAttribute('data-dravenviz-chart');
  throw new DravenVizError('RENDER_FAILED', message, {
    ...(chartId === null ? {} : { chartId }),
    issues: [{ rule, path: '', message }],
  });
}

/** True when `el` is something that paints: a non-empty path, shape or text outside `<defs>`. */
function paints(el: Element): boolean {
  if (el.closest('defs,clipPath') !== null) return false;
  if (el.localName === 'path') return (el.getAttribute('d') ?? '').trim() !== '';
  return true;
}

/** Number of `data-dv-item` children of the group `key` that actually painted something. */
function drawnItems(svg: SVGSVGElement, key: string): number | undefined {
  let group: Element | undefined;
  for (const el of svg.querySelectorAll('[data-dv-mark]')) {
    if (el.getAttribute('data-dv-mark') === key) {
      group = el;
      break;
    }
  }
  if (group === undefined) return undefined;
  let n = 0;
  for (const item of group.querySelectorAll('[data-dv-item]')) {
    if (Array.from(item.querySelectorAll(DRAWABLE)).some(paints)) n += 1;
  }
  return n;
}

function checkFinite(svg: SVGSVGElement): void {
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const name of GEOMETRY_ATTRIBUTES) {
      const v = el.getAttribute(name);
      if (v === null || v.trim() === '') continue;
      if (!Number.isFinite(Number(v))) {
        fail(svg, 'non-finite-geometry', `A drawn element has a non-finite "${name}" value.`);
      }
    }
    for (const name of ['d', 'points', 'transform']) {
      const v = el.getAttribute(name);
      if (v !== null && /NaN|Infinity/.test(v)) {
        fail(svg, 'non-finite-geometry', `A drawn element has a non-finite "${name}" value.`);
      }
    }
  }
}

const sameNumbers = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length &&
  a.every((v, i) => Math.abs(v - (b[i] as number)) <= 1e-6 * Math.max(1, Math.abs(v)));

function parseDomain(el: Element | null): unknown {
  if (el === null) return undefined;
  try {
    return JSON.parse(el.getAttribute('data-dv-domain') ?? 'null');
  } catch {
    return undefined;
  }
}

function checkProbe(svg: SVGSVGElement, expected: CommitExpectations): void {
  const probe = svg.querySelector('[data-dv-probe]');
  if (probe === null) fail(svg, 'probe-missing', 'The geometry probe was not rendered.');
  const plot = (probe.getAttribute('data-dv-plot') ?? '').split(' ').map(Number);
  const want = expected.plot;
  const wantList = [want.x, want.y, want.width, want.height];
  if (
    plot.length !== 4 ||
    plot.some((v, i) => !(Math.abs(v - (wantList[i] as number)) <= PLOT_TOLERANCE))
  ) {
    fail(
      svg,
      'plot-mismatch',
      'The plot area the chart library computed differs from the layout plot box by more than 0.5 units.',
    );
  }
  const xd = parseDomain(probe.querySelector('[data-dv-probe-x]'));
  const wantX = expected.xDomain;
  const xOk =
    Array.isArray(xd) &&
    (wantX.kind === 'category'
      ? xd.length === wantX.keys.length && xd.every((v, i) => v === wantX.keys[i])
      : sameNumbers(xd as number[], wantX.domain));
  if (!xOk) fail(svg, 'domain-mismatch', 'The x axis domain differs from the model domain.');
  for (const [id, domain] of Object.entries(expected.yDomains)) {
    let got: unknown;
    for (const el of probe.querySelectorAll('[data-dv-probe-y]')) {
      if (el.getAttribute('data-dv-probe-y') === id) got = parseDomain(el);
    }
    if (!Array.isArray(got) || !sameNumbers(got as number[], domain)) {
      fail(svg, 'domain-mismatch', `The domain of y axis "${id}" differs from the model domain.`);
    }
  }
}

/**
 * Verifies a committed chart against the model's expected-mark manifest (design section 9,
 * step 5). Throws `RENDER_FAILED` naming the failing check as the issue rule. Zero-area marks are
 * not failures: a flat line has a zero-height box and a measured-zero bar has zero height. Only a
 * missing mark, a stale render, a non-finite coordinate, or a geometry mismatch fails.
 */
export function verifyCommitted(
  svg: SVGSVGElement,
  manifest: MarkManifest,
  renderId: number,
  width: number,
  height: number,
  expected?: CommitExpectations,
): void {
  if (svg.getAttribute('data-dv-render-id') !== String(renderId)) {
    fail(svg, 'stale-render', 'The committed chart belongs to a different render.');
  }
  const box = (svg.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number);
  if (box.length !== 4 || box[0] !== 0 || box[1] !== 0 || box[2] !== width || box[3] !== height) {
    fail(svg, 'viewbox-mismatch', `The viewBox is not "0 0 ${width} ${height}".`);
  }
  for (const group of manifest.groups) {
    const drawn = drawnItems(svg, group.key);
    if (drawn === undefined) {
      fail(svg, 'missing-mark', `The expected mark group "${group.key}" is missing.`);
    }
    if (drawn !== group.count) {
      fail(
        svg,
        'mark-count-mismatch',
        `The mark group "${group.key}" drew ${drawn} of ${group.count} expected elements.`,
      );
    }
  }
  checkFinite(svg);
  if (expected !== undefined) checkProbe(svg, expected);
}
