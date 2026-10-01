import { DravenVizError } from '../../core/index';
import {
  MATERIALIZED_PROPERTIES,
  isRechartsMetadata,
  type MaterializedProperty,
} from './recharts-metadata';

/**
 * Normalize (design section 10, stage 1). Works on a deep clone of the live `<svg>` and walks the
 * clone and the live tree together, because only the live element has a computed style. Returns the
 * detached clone.
 */

/** Containers whose content is never painted directly: their `display` is not a reason to drop them. */
const NOT_RENDERED = new Set([
  'defs',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'pattern',
  'mask',
  'marker',
  'symbol',
  'stop',
  'title',
  'desc',
  'style',
  'metadata',
]);

/** Inherited in CSS, so a child's value may be pruned when its parent's final value is identical. */
const INHERITED: ReadonlySet<MaterializedProperty> = new Set<MaterializedProperty>([
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'letter-spacing',
  'font-style',
]);

type Values = Partial<Record<MaterializedProperty, string>>;

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
}

/** `rgb()`/`rgba()` to `#rrggbb` plus alpha. Anything else (`none`, `url(...)`, a keyword) is left as is. */
function parseColor(value: string): { color: string; alpha: number } {
  const m = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (m === null) return { color: value, alpha: 1 };
  const parts = (m[1] as string)
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((p) => (p.endsWith('%') ? (Number.parseFloat(p) / 100) * 255 : Number.parseFloat(p)));
  const [r = 0, g = 0, b = 0] = parts;
  const raw = (m[1] as string).split(/[\s,/]+/).filter(Boolean)[3];
  let alpha = 1;
  if (raw !== undefined)
    alpha = raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
  return { color: `#${hex2(r)}${hex2(g)}${hex2(b)}`, alpha: Number.isFinite(alpha) ? alpha : 1 };
}

function paint(value: string): string {
  // `url("#p")` becomes `url(#p)`: a local reference, checked later against the ids in this SVG.
  return value.replace(/url\(\s*["']?([^"')]*)["']?\s*\)/g, 'url($1)');
}

function lengthless(value: string): string {
  return value
    .replace(/px\b/g, '')
    .replace(/\s*,\s*/g, ' ')
    .trim();
}

/** Effective computed values of the materialized properties, in the form written as attributes. */
function effectiveValues(live: Element): Values {
  const cs = getComputedStyle(live);
  const read = (p: string): string => cs.getPropertyValue(p).trim();
  const out: Values = {};
  for (const prop of MATERIALIZED_PROPERTIES) {
    const v = read(prop);
    if (v !== '') out[prop] = v;
  }
  for (const [prop, op] of [
    ['fill', 'fill-opacity'],
    ['stroke', 'stroke-opacity'],
  ] as const) {
    const raw = out[prop];
    if (raw === undefined) continue;
    const { color, alpha } = parseColor(paint(raw));
    out[prop] = color;
    if (alpha < 1) out[op] = String(Number.parseFloat(out[op] ?? '1') * alpha);
  }
  if (out['stroke-width'] !== undefined) out['stroke-width'] = lengthless(out['stroke-width']);
  if (out['font-size'] !== undefined) out['font-size'] = lengthless(out['font-size']);
  if (out['letter-spacing'] !== undefined)
    out['letter-spacing'] = lengthless(out['letter-spacing']);
  if (out['stroke-dasharray'] !== undefined)
    out['stroke-dasharray'] = lengthless(out['stroke-dasharray']);
  return out;
}

function isDropped(live: Element, inNotRendered: boolean): boolean {
  if (live.hasAttribute('data-dv-interactive')) return true;
  if (NOT_RENDERED.has(live.localName) || inNotRendered) return false;
  const cs = getComputedStyle(live);
  if (cs.display === 'none') return true;
  return cs.visibility === 'hidden' || cs.visibility === 'collapse';
}

/** Step 1 and 2: drop non-graphic subtrees, then write the effective computed values. */
function materialize(live: Element, clone: Element, inNotRendered: boolean): void {
  const tag = clone.localName;
  if (tag !== 'title' && tag !== 'desc' && tag !== 'style') {
    for (const [prop, value] of Object.entries(effectiveValues(live)))
      clone.setAttribute(prop, value);
  }
  const liveKids = Array.from(live.children);
  const cloneKids = Array.from(clone.children);
  const nowNotRendered = inNotRendered || NOT_RENDERED.has(tag);
  liveKids.forEach((l, i) => {
    const c = cloneKids[i] as Element;
    if (isDropped(l, nowNotRendered)) c.remove();
    else materialize(l, c, nowNotRendered);
  });
}

/**
 * Step 3: prune an attribute only when the export tree's own inheritance yields the same value.
 * Runs top-down over the clone. `dominant-baseline` is treated cautiously (pruned only when it is
 * `auto` under an `auto` parent), because whether it inherits differs between specifications.
 */
function prune(el: Element, inherited: Values, isRoot: boolean): void {
  const next: Values = { ...inherited };
  for (const prop of MATERIALIZED_PROPERTIES) {
    const value = el.getAttribute(prop);
    if (value === null) continue;
    if (INHERITED.has(prop)) {
      if (!isRoot && inherited[prop] === value) el.removeAttribute(prop);
      else next[prop] = value;
    } else if (prop === 'opacity') {
      if (value === '1') el.removeAttribute(prop);
    } else if (prop === 'dominant-baseline') {
      if (!isRoot && value === 'auto' && (inherited[prop] ?? 'auto') === 'auto') {
        el.removeAttribute(prop);
      } else next[prop] = value;
    }
  }
  for (const child of Array.from(el.children)) prune(child, next, false);
}

/** Step 5: remove renderer metadata. Unknown attributes are kept, so validation fails on them. */
function stripMetadata(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (isRechartsMetadata(el.localName, attr.name)) el.removeAttribute(attr.name);
  }
  for (const child of Array.from(el.children)) stripMetadata(child);
}

/** Only finalize may add a `<style>` (the font rules); one in the live SVG could restyle the export. */
function rejectStyleElements(el: Element, path: string): void {
  const counts = new Map<string, number>();
  for (const child of Array.from(el.children)) {
    const n = (counts.get(child.localName) ?? 0) + 1;
    counts.set(child.localName, n);
    const here = `${path}/${child.localName}[${n}]`;
    if (child.localName === 'style') {
      const message = 'A <style> element in the chart is not allowed; only export adds font rules.';
      throw new DravenVizError('EXPORT_FAILED', message, {
        path: here,
        issues: [{ rule: 'svg-disallowed-element', path: here, message }],
      });
    }
    rejectStyleElements(child, here);
  }
}

export function normalizeSvg(live: SVGSVGElement): SVGSVGElement {
  const clone = live.cloneNode(true) as SVGSVGElement;
  rejectStyleElements(clone, '/svg');
  materialize(live, clone, false);
  // Step 6: Recharts' own title and desc go; finalize adds DravenViz's.
  for (const child of Array.from(clone.children)) {
    if (child.localName === 'title' || child.localName === 'desc') child.remove();
  }
  prune(clone, {}, true);
  stripMetadata(clone);
  return clone;
}
