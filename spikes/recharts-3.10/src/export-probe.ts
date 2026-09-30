// First cut of design section 10 normalize + strict validate, plus the attribute inventory.
// Reads the live DOM for measurement only; product code never does this.

export type Classification = 'presentation' | 'geometry' | 'metadata' | 'passthrough' | 'unclassified';
export type Inventory = Record<string, Record<string, Record<string, Classification>>>;

const PRESENTATION = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
];
const PRESENTATION_SET = new Set(PRESENTATION);
// Metadata the normalizer removes (design section 10 step 5). Extended only from the observed inventory.
const METADATA_ALWAYS = new Set(['class', 'style', 'tabindex', 'focusable', 'cursor', 'pointer-events']);
// Tag-specific metadata observed in the inventory (renderer bookkeeping with no drawing effect). An attribute that is in
// neither this table, METADATA_ALWAYS, presentation, nor GEOMETRY_BY_TAG is 'unclassified' and is NOT stripped, so the
// strict allowlist (and the inventory test) flags it.
const METADATA_BY_TAG: Record<string, string[]> = {
  svg: [],
  g: [],
  path: ['width', 'height', 'x', 'y', 'k', 'name', 'radius'],
  circle: ['width', 'height'],
  line: ['x', 'y', 'width', 'height', 'angle', 'orientation'],
  text: ['width', 'height', 'offset', 'orientation'],
};

// Geometry attributes that are meaningful per element; the same name elsewhere (for example width/height on g,
// circle, line, text, or x/y on path) is renderer metadata that does not affect drawing.
const tagKey = (tag: string) => (tag.toLowerCase() === 'clippath' ? 'clipPath' : tag.toLowerCase());
const GEOMETRY_BY_TAG: Record<string, string[]> = {
  svg: ['width', 'height', 'viewBox', 'xmlns', 'role'],
  g: ['transform', 'clip-path', 'id'],
  path: ['d', 'transform', 'clip-path', 'id'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'transform'],
  circle: ['cx', 'cy', 'r', 'transform'],
  line: ['x1', 'y1', 'x2', 'y2', 'transform'],
  text: ['x', 'y', 'dx', 'dy', 'transform'],
  tspan: ['x', 'y', 'dx', 'dy'],
  clipPath: ['id', 'transform'],
  defs: [],
};
export function classify(tag: string, attr: string): Classification {
  if (PRESENTATION_SET.has(attr)) return 'presentation';
  if (attr.startsWith('aria-') || attr.startsWith('data-dv-')) return 'passthrough'; // allowed as-is (aria-*, data-dv-*)
  if ((GEOMETRY_BY_TAG[tagKey(tag)] ?? []).includes(attr)) return 'geometry';
  if (METADATA_ALWAYS.has(attr) || attr.startsWith('data-')) return 'metadata';
  if ((METADATA_BY_TAG[tagKey(tag)] ?? []).includes(attr)) return 'metadata';
  return 'unclassified';
}

// Elements authored by the spike harness (overlays, render-prop ticks/dots) are not Recharts output.
const isHarness = (el: Element) => Array.from(el.attributes).some((a) => a.name.startsWith('data-spike-'));

function componentKey(el: Element): string {
  const own = Array.from(el.classList).find((c) => c.startsWith('recharts-'));
  if (own) return own;
  let p = el.parentElement ?? (el.parentNode as Element | null);
  while (p && p.classList) {
    const c = Array.from(p.classList).find((x) => x.startsWith('recharts-'));
    if (c) return `${c} > ${el.tagName.toLowerCase()}`;
    p = p.parentElement ?? null;
  }
  return `(unclassed) ${el.tagName.toLowerCase()}`;
}

export function collectInventory(roots: Element[]): Inventory {
  const inv: Inventory = {};
  for (const root of roots) {
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
      if (isHarness(el)) continue;
      const tag = el.tagName;
      const key = componentKey(el);
      const t = ((inv[key] ??= {})[tag] ??= {});
      for (const a of Array.from(el.attributes)) {
        t[a.name] = classify(tag, a.name);
      }
    }
  }
  return inv;
}

const ALLOWED_ELEMENTS = new Set('svg g path rect circle ellipse line polyline polygon text tspan title desc defs clipPath linearGradient stop pattern style'.split(' '));
function attributeAllowed(tag: string, name: string): boolean {
  if (PRESENTATION_SET.has(name)) return true;
  if (name.startsWith('aria-') || name.startsWith('data-dv-')) return true;
  return (GEOMETRY_BY_TAG[tagKey(tag)] ?? []).includes(name);
}

function toHex(c: string): { color: string; opacity?: string } {
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return { color: c };
  const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  const hex = '#' + parts.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  return parts.length > 3 && parts[3] < 1 ? { color: hex, opacity: String(parts[3]) } : { color: hex };
}

function materialize(live: Element, clone: Element) {
  const cs = getComputedStyle(live);
  for (const prop of PRESENTATION) {
    let v = cs.getPropertyValue(prop).trim();
    if (!v) continue;
    if (prop === 'fill' || prop === 'stroke') {
      v = v.replace(/url\("?([^")]+)"?\)/, 'url($1)');
      const { color, opacity } = toHex(v);
      v = color;
      if (opacity) clone.setAttribute(prop + '-opacity', opacity);
    }
    if (prop === 'stroke-dasharray') v = v.replace(/px/g, '').replace(/,\s*/g, ' ');
    clone.setAttribute(prop, v);
  }
  const lc = Array.from(live.children);
  const cc = Array.from(clone.children);
  lc.forEach((l, i) => materialize(l, cc[i]));
}

function walk(el: Element, fn: (e: Element) => void) {
  fn(el);
  Array.from(el.children).forEach((c) => walk(c, fn));
}

export function exportProbe(liveSvg: SVGSVGElement, opts: { inject?: boolean } = {}) {
  const clone = liveSvg.cloneNode(true) as SVGSVGElement;
  if (opts.inject) {
    // Negative control: injected BEFORE normalize, so it must survive the strip step and reach the validator.
    const target = clone.querySelector('path') as Element;
    target.setAttribute('onclick', 'x');
    target.setAttribute('foo', '1');
  }
  // Stage 1: normalize
  materialize(liveSvg, clone); // (display:none / data-dv-interactive dropping omitted: none present in the spike chart)
  const removed: Record<string, number> = {};
  const idsSeenRaw: string[] = [];
  walk(clone, (e) => {
    const tag = e.tagName;
    for (const a of Array.from(e.attributes)) {
      const n = a.name;
      const drop =
        classify(tag, n) === 'metadata';
      if (drop) {
        e.removeAttribute(n);
        removed[`${tag}@${n}`] = (removed[`${tag}@${n}`] ?? 0) + 1;
      }
    }
    if (e.id) idsSeenRaw.push(e.id);
  });
  // Finalize step (partial): namespace ids so no renderer name survives.
  const map = new Map<string, string>();
  idsSeenRaw.forEach((id, i) => map.set(id, `dv-spike-${i + 1}`));
  walk(clone, (e) => {
    if (e.id) e.id = map.get(e.id)!;
    for (const a of Array.from(e.attributes)) {
      const v = a.value.replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${map.get(id) ?? id})`);
      if (v !== a.value) e.setAttribute(a.name, v);
    }
  });
  // Stage 2: strict allowlist validation
  const disallowedAfterNormalize: string[] = [];
  walk(clone, (e) => {
    const tag = e.tagName;
    if (!ALLOWED_ELEMENTS.has(tag)) disallowedAfterNormalize.push(`element:${tag}`);
    for (const a of Array.from(e.attributes)) {
      if (!attributeAllowed(tag, a.name)) disallowedAfterNormalize.push(`attr:${tag}@${a.name}`);
      if (/^on/i.test(a.name)) disallowedAfterNormalize.push(`event:${tag}@${a.name}`);
      if (/url\(/.test(a.value) && !/^url\(#[^)]+\)$/.test(a.value.trim())) disallowedAfterNormalize.push(`url:${tag}@${a.name}`);
      if (/url\(#/.test(a.value)) {
        const id = a.value.match(/url\(#([^)]+)\)/)![1];
        if (!clone.querySelector(`[id="${id}"]`)) disallowedAfterNormalize.push(`dangling:${tag}@${a.name}`);
      }
    }
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svg = new XMLSerializer().serializeToString(clone);
  return {
    disallowedAfterNormalize: Array.from(new Set(disallowedAfterNormalize)),
    removedMetadata: removed,
    rawIds: idsSeenRaw,
    svgLength: svg.length,
    svg,
  };
}
