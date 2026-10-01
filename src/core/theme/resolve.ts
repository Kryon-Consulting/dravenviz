import { DravenVizError } from '../errors';
import { dark } from './dark';
import { light } from './light';
import { print } from './print-theme';
import type { Theme, ThemeName, ThemeOverrides } from './tokens';

type Node =
  | { t: 'obj'; keys: Record<string, Node>; required?: readonly string[] | undefined }
  | { t: 'rec'; value: Node }
  | { t: 'arr'; min: number; max: number; item: Node }
  | { t: 'hex' }
  | { t: 'num'; min: number; max: number; exclusiveMin?: boolean }
  | { t: 'str'; max: number }
  | { t: 'semver' }
  | { t: 'enum'; values: readonly (string | number)[] };

const hex: Node = { t: 'hex' };
const size = (min = 0, max = 1000, exclusiveMin = true): Node => ({
  t: 'num',
  min,
  max,
  exclusiveMin,
});
const obj = (keys: Record<string, Node>, required?: readonly string[]): Node => ({
  t: 'obj',
  keys,
  required,
});
const str: Node = { t: 'str', max: 120 };
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'none'] as const;
const PATTERNS = ['none', 'diagonal', 'dots', 'crosshatch'] as const;
const DASHES = ['solid', 'dashed', 'dotted'] as const;

const THEME_NODE = obj({
  version: { t: 'semver' },
  font: obj({
    family: { t: 'str', max: 200 },
    weights: obj({ regular: { t: 'enum', values: [400] }, strong: { t: 'enum', values: [600] } }),
  }),
  text: obj({
    title: size(1, 200),
    label: size(1, 200),
    caption: size(1, 200),
    lineHeight: size(1, 3, false),
  }),
  color: obj({
    background: hex,
    text: hex,
    mutedText: hex,
    axis: hex,
    grid: hex,
    focus: hex,
    missing: hex,
    threshold: hex,
    annotation: hex,
  }),
  palette: { t: 'arr', min: 8, max: 8, item: hex },
  roles: {
    t: 'rec',
    value: obj(
      {
        color: hex,
        pattern: { t: 'enum', values: PATTERNS },
        shape: { t: 'enum', values: SHAPES },
      },
      ['color'],
    ),
  },
  seriesStyles: {
    t: 'arr',
    min: 8,
    max: 8,
    item: obj(
      {
        dash: { t: 'enum', values: DASHES },
        shape: { t: 'enum', values: SHAPES },
        pattern: { t: 'enum', values: PATTERNS },
      },
      ['dash', 'shape', 'pattern'],
    ),
  },
  sequential: { t: 'arr', min: 2, max: 11, item: hex },
  diverging: { t: 'arr', min: 3, max: 11, item: hex },
  spacing: obj({
    padding: size(0, 500, false),
    legendGap: size(0, 500, false),
    titleGap: size(0, 500, false),
    barGap: size(0, 1, false),
    groupGap: size(0, 1, false),
  }),
  stroke: obj({
    line: size(0, 50),
    axis: size(0, 50),
    grid: size(0, 50),
    reference: size(0, 50),
    sliceBorder: size(0, 50),
  }),
  marker: obj({ size: size(0, 100), hollowStroke: size(0, 50) }),
  strings: obj({
    unavailable: str,
    notMeasured: str,
    noData: str,
    incomplete: str,
    target: str,
    clipped: str,
  }),
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const esc = (k: string): string => k.replace(/~/g, '~0').replace(/\//g, '~1');
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, message: string): never {
  throw new DravenVizError('INVALID_OPTIONS', `Invalid theme at ${path || '/'}: ${message}`, {
    path,
  });
}

/** Validate and deep-copy `value` against `node`, enforcing required keys. */
function check(node: Node, value: unknown, path: string): unknown {
  switch (node.t) {
    case 'hex':
      if (typeof value !== 'string' || !HEX.test(value)) fail(path, 'expected a #RRGGBB color.');
      return value;
    case 'num':
      if (typeof value !== 'number' || !Number.isFinite(value))
        fail(path, 'expected a finite number.');
      if (value > node.max || value < node.min || (node.exclusiveMin && value === node.min))
        fail(
          path,
          `expected a number ${node.exclusiveMin ? '>' : '>='} ${node.min} and <= ${node.max}.`,
        );
      return value;
    case 'str':
      if (typeof value !== 'string' || value.length === 0 || value.length > node.max)
        fail(path, `expected a non-empty string of at most ${node.max} characters.`);
      return value;
    case 'semver':
      if (typeof value !== 'string' || !SEMVER.test(value)) fail(path, 'expected a semver string.');
      return value;
    case 'enum':
      if (!node.values.includes(value as string | number))
        fail(path, `expected one of ${node.values.map(String).join(', ')}.`);
      return value;
    case 'arr': {
      if (!Array.isArray(value)) fail(path, 'expected an array.');
      if (value.length < node.min || value.length > node.max)
        fail(
          path,
          node.min === node.max
            ? `expected exactly ${node.min} entries.`
            : `expected ${node.min} to ${node.max} entries.`,
        );
      return value.map((v, i) => check(node.item, v, `${path}/${i}`));
    }
    case 'rec': {
      if (!isPlain(value)) fail(path, 'expected an object.');
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(value)) {
        if (k === '__proto__') fail(`${path}/${esc(k)}`, 'reserved key.');
        out[k] = check(node.value, value[k], `${path}/${esc(k)}`);
      }
      return out;
    }
    case 'obj': {
      if (!isPlain(value)) fail(path, 'expected an object.');
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(value)) {
        if (!has(node.keys, k)) fail(`${path}/${esc(k)}`, 'unknown key.');
        if (value[k] === undefined) continue;
        out[k] = check(node.keys[k]!, value[k], `${path}/${esc(k)}`);
      }
      for (const k of node.required ?? []) if (!has(out, k)) fail(`${path}/${esc(k)}`, 'required.');
      return out;
    }
  }
}

/** Merge validated overrides onto `base` (an already-valid value). */
function merge(node: Node, base: unknown, ov: unknown, path: string): unknown {
  if (node.t === 'obj' && !node.required) {
    if (!isPlain(ov)) fail(path, 'expected an object.');
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k of Object.keys(ov)) {
      if (!has(node.keys, k)) fail(`${path}/${esc(k)}`, 'unknown key.');
      if (ov[k] === undefined) continue;
      out[k] = merge(node.keys[k]!, out[k], ov[k], `${path}/${esc(k)}`);
    }
    return out;
  }
  if (node.t === 'rec') {
    // Roles merge by key; each role entry is replaced whole.
    if (!isPlain(ov)) fail(path, 'expected an object.');
    return { ...(base as Record<string, unknown>), ...(check(node, ov, path) as object) };
  }
  return check(node, ov, path);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

function fromBody(name: string, theme: Theme): Theme {
  const { name: _n, ...body } = theme;
  void _n;
  const checked = check(THEME_NODE, body, '') as Omit<Theme, 'name'>;
  return deepFreeze({ name, ...checked });
}

export const themes: Readonly<Record<ThemeName, Theme>> = Object.freeze({
  light: fromBody('light', light),
  dark: fromBody('dark', dark),
  print: fromBody('print', print),
});

/**
 * Resolve a built-in theme name or a full theme, plus optional typed overrides, into a deep-frozen
 * theme. Inputs are never mutated. Unknown keys, bad colors and out-of-range numbers throw
 * `INVALID_OPTIONS` with a JSON-Pointer `path`. Arrays are replaced whole.
 */
export function resolveTheme(base: ThemeName | Theme, overrides?: ThemeOverrides): Theme {
  let baseTheme: Theme;
  if (typeof base === 'string') {
    if (!has(themes, base)) fail('', `unknown theme name.`);
    baseTheme = themes[base];
  } else {
    if (!isPlain(base) || typeof base.name !== 'string' || base.name.length === 0)
      fail('/name', 'expected a non-empty string.');
    baseTheme = fromBody(base.name, base);
  }
  if (overrides === undefined) return baseTheme;
  const { name: _n, ...body } = baseTheme;
  void _n;
  const merged = merge(THEME_NODE, body, overrides, '') as Omit<Theme, 'name'>;
  return deepFreeze({ name: baseTheme.name, ...merged });
}

/**
 * Effective printed size in pt of a logical size after an aspect-preserving width fit:
 * `logicalSize * (printWidthMm / 25.4 * 72) / viewBoxWidth` (about 504.57 / viewBoxWidth at 178 mm).
 */
export function effectivePt(
  logicalSize: number,
  viewBoxWidth: number,
  printWidthMm: number,
): number {
  const pos = (v: number): boolean => Number.isFinite(v) && v > 0;
  if (!pos(logicalSize) || !pos(viewBoxWidth) || !pos(printWidthMm))
    throw new DravenVizError(
      'INVALID_OPTIONS',
      'effectivePt requires positive finite sizes and widths.',
    );
  return (logicalSize * ((printWidthMm / 25.4) * 72)) / viewBoxWidth;
}
