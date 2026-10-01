/**
 * The Recharts attribute inventory as a checked-in constant (design section 10, normalize step 5).
 * It is built from `spikes/recharts-3.10/attribute-inventory.json`; `tests/unit/recharts-metadata.test.ts`
 * fails when an attribute in that inventory is not classified here. An attribute that is in none of
 * the tables is NOT stripped by the normalizer: it reaches strict validation and fails the export.
 */

export type AttributeClass =
  'presentation' | 'geometry' | 'metadata' | 'passthrough' | 'unclassified';

/**
 * Properties materialized from computed style onto every element (design section 10, step 2).
 * `letter-spacing` and `font-style` are an addition to the section 10 list: DravenViz text carries
 * them inline, so a standalone file renders text the same way only if they are written out.
 */
export const MATERIALIZED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'font-style',
] as const;

export type MaterializedProperty = (typeof MATERIALIZED_PROPERTIES)[number];

/** Presentation attributes the strict allowlist accepts on every element. */
export const RECHARTS_PRESENTATION_ATTRIBUTES: ReadonlySet<string> = new Set(
  MATERIALIZED_PROPERTIES,
);

/** Removed from every element whatever its tag. `data-*` other than `data-dv-*` is handled by prefix. */
const METADATA_ALWAYS = ['class', 'style', 'tabindex', 'focusable', 'cursor', 'pointer-events'];

/**
 * Renderer bookkeeping with no drawing effect, per tag, taken from the observed inventory.
 * The same names are real geometry elsewhere (`width`/`height` on `rect` and `svg`, `x`/`y` on
 * `rect` and `text`), which is why this table is per tag.
 */
export const RECHARTS_METADATA_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  path: ['width', 'height', 'x', 'y', 'k', 'name', 'radius'],
  circle: ['width', 'height'],
  line: ['x', 'y', 'width', 'height', 'angle', 'orientation'],
  text: ['width', 'height', 'offset', 'orientation'],
};

/** Every attribute name that is renderer metadata on at least one tag. */
export const RECHARTS_METADATA_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...METADATA_ALWAYS,
  ...Object.values(RECHARTS_METADATA_BY_TAG).flat(),
]);

/** Geometry (and structural) attributes that are real per element. */
export const GEOMETRY_BY_TAG: Readonly<Record<string, readonly string[]>> = {
  svg: ['width', 'height', 'viewBox'],
  g: [],
  path: ['d'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  text: ['x', 'y', 'dx', 'dy'],
  tspan: ['x', 'y', 'dx', 'dy'],
  title: [],
  desc: [],
  defs: [],
  clipPath: ['clipPathUnits'],
  linearGradient: ['x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform', 'spreadMethod'],
  stop: ['offset', 'stop-color', 'stop-opacity'],
  pattern: [
    'x',
    'y',
    'width',
    'height',
    'viewBox',
    'patternUnits',
    'patternContentUnits',
    'patternTransform',
  ],
  style: [],
};

/** Allowed on every element: structural attributes shared by all of them (design section 10). */
export const GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set([
  'id',
  'clip-path',
  'transform',
  'role',
  'xmlns',
]);

export const isPassthrough = (name: string): boolean =>
  name.startsWith('aria-') || name.startsWith('data-dv-');

/** `data-dv-render-id` changes on every mount; keeping it would make exports non-deterministic. */
export const NEVER_EXPORTED = new Set(['data-dv-render-id']);

export function isRechartsMetadata(tag: string, name: string): boolean {
  if (NEVER_EXPORTED.has(name)) return true;
  if (isPassthrough(name)) return false;
  if (METADATA_ALWAYS.includes(name) || name.startsWith('data-')) return true;
  return (RECHARTS_METADATA_BY_TAG[tag] ?? []).includes(name);
}

export function isGeometry(tag: string, name: string): boolean {
  return GLOBAL_ATTRIBUTES.has(name) || (GEOMETRY_BY_TAG[tag] ?? []).includes(name);
}

/** Same order as the spike probe. The inventory test pins this against the recorded classes. */
export function classifyAttribute(tag: string, name: string): AttributeClass {
  if (RECHARTS_PRESENTATION_ATTRIBUTES.has(name)) return 'presentation';
  if (isPassthrough(name) && !NEVER_EXPORTED.has(name)) return 'passthrough';
  if (isGeometry(tag, name)) return 'geometry';
  if (isRechartsMetadata(tag, name)) return 'metadata';
  return 'unclassified';
}
