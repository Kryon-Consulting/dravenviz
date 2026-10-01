import { DravenVizError, InvalidSpecError } from '../errors';
import type { VizSpec } from '../spec/index';
import { schemaValidate } from './ajv.gen.js';
import { IssueSink, type ValidationIssue, mapAjvErrors } from './issues';
import { type Limits, checkLimits, resolveLimits } from './limits';
import { checkCartesian } from './semantic/cartesian';
import { checkDonut } from './semantic/donut';
import { checkHeatmap } from './semantic/heatmap';
import { checkProgress } from './semantic/progress';

export { DEFAULT_LIMITS, type Limits } from './limits';
export type { ValidationIssue } from './issues';

// Not in the no-DOM lib; provided by every supported runtime (Node >= 17, browsers).
declare function structuredClone<T>(value: T): T;

/** Rule id of the options check made when mounting several charts (design section 6). */
export const DUPLICATE_CHART_EMBEDDING = 'duplicate-chart-embedding';

export interface ValidateOptions {
  /** May only lower the defaults. */
  limits?: Partial<Limits>;
}

/** UTF-8 byte length of a string, without allocating. */
function utf8Length(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function readChartId(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const id = (input as { id?: unknown }).id;
  return typeof id === 'string' && ID_PATTERN.test(id) ? id : undefined;
}

function runSemantic(spec: VizSpec, sink: IssueSink): void {
  switch (spec.kind) {
    case 'cartesian':
      return checkCartesian(spec, sink);
    case 'donut':
      return checkDonut(spec, sink);
    case 'heatmap':
      return checkHeatmap(spec, sink);
    case 'progress':
      return checkProgress(spec, sink);
  }
}

function fail(
  issues: readonly ValidationIssue[],
  code: 'INVALID_SPEC' | 'LIMIT_EXCEEDED',
  input: unknown,
): never {
  const chartId = readChartId(input);
  throw new InvalidSpecError(issues, { code, ...(chartId === undefined ? {} : { chartId }) });
}

/**
 * Validate an unknown value as a chart spec. Order: serialized size, schema (all errors),
 * semantic rules, limits. Returns a deep-frozen structured clone; the input is never mutated.
 * Throws `InvalidSpecError`, or `DravenVizError` with code `INVALID_OPTIONS` for bad options.
 */
export function validateSpec(input: unknown, options?: ValidateOptions): VizSpec {
  if (options !== undefined && (options === null || typeof options !== 'object')) {
    throw new DravenVizError('INVALID_OPTIONS', 'Validation options must be an object.');
  }
  const limits = resolveLimits(options?.limits);

  // 1. Size of the serialized input.
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    fail(
      [
        {
          rule: 'not-json',
          path: '',
          message:
            'The spec must be plain JSON data: remove circular references, BigInt values and custom toJSON methods.',
        },
      ],
      'INVALID_SPEC',
      undefined,
    );
  }
  if (json !== undefined && utf8Length(json) > limits.jsonBytes) {
    fail(
      [
        {
          rule: 'json-bytes',
          path: '',
          message: `The serialized spec is larger than ${limits.jsonBytes} bytes; reduce the data or split the chart.`,
        },
      ],
      'LIMIT_EXCEEDED',
      input,
    );
  }

  // Work on a private copy so later changes (or getters) in the caller's object cannot matter.
  let spec: unknown;
  try {
    spec = structuredClone(input);
  } catch {
    return fail(
      [
        {
          rule: 'not-json',
          path: '',
          message:
            'The spec must be plain JSON data: remove functions, symbols and class instances.',
        },
      ],
      'INVALID_SPEC',
      undefined,
    );
  }

  // 2. Schema.
  if (!schemaValidate(spec)) {
    const issues = mapAjvErrors(schemaValidate.errors ?? [], spec).slice(0, 50);
    return fail(
      issues.length > 0
        ? issues
        : [{ rule: 'schema', path: '', message: 'The spec does not match the schema.' }],
      'INVALID_SPEC',
      spec,
    );
  }

  // 3. Semantic rules.
  const sink = new IssueSink();
  runSemantic(spec, sink);
  if (sink.issues.length > 0) fail(sink.issues, 'INVALID_SPEC', spec);

  // 4. Limits.
  checkLimits(spec, limits, sink);
  if (sink.issues.length > 0) fail(sink.issues, 'LIMIT_EXCEEDED', spec);

  return deepFreeze(spec);
}

/** Like `validateSpec` but reports spec problems as a value. Bad options still throw. */
export function isValidSpec(
  input: unknown,
  options?: ValidateOptions,
): { ok: true; spec: VizSpec } | { ok: false; errors: ValidationIssue[] } {
  try {
    return { ok: true, spec: validateSpec(input, options) };
  } catch (e) {
    if (e instanceof InvalidSpecError) return { ok: false, errors: [...e.issues] };
    throw e;
  }
}
