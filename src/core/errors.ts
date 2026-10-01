import type { ValidationIssue } from './validate/issues';

/** Stable machine-readable error codes (design section 9). */
export type ErrorCode =
  | 'INVALID_SPEC'
  | 'INVALID_OPTIONS'
  | 'LIMIT_EXCEEDED'
  | 'FONT_LOAD_FAILED'
  | 'ASSET_LOAD_FAILED'
  | 'ZERO_SIZE'
  | 'LAYOUT_ERROR'
  | 'RENDER_FAILED'
  | 'TIMEOUT'
  | 'DISPOSED'
  | 'EXPORT_FAILED';

export interface DravenVizErrorOptions {
  chartId?: string;
  path?: string;
  issues?: readonly ValidationIssue[];
  cause?: unknown;
}

/** Base class of every error DravenViz throws or reports. Messages never include data values. */
export class DravenVizError extends Error {
  readonly code: ErrorCode;
  readonly chartId?: string;
  readonly path?: string;
  readonly issues?: readonly ValidationIssue[];

  constructor(code: ErrorCode, message: string, options: DravenVizErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DravenVizError';
    this.code = code;
    if (options.chartId !== undefined) this.chartId = options.chartId;
    if (options.path !== undefined) this.path = options.path;
    if (options.issues !== undefined) this.issues = options.issues;
  }
}

export interface InvalidSpecErrorOptions {
  /** `LIMIT_EXCEEDED` for protection limits; default `INVALID_SPEC`. */
  code?: 'INVALID_SPEC' | 'LIMIT_EXCEEDED';
  chartId?: string;
}

/** Thrown by `validateSpec`. `rule`, `path` and `message` come from the first issue. */
export class InvalidSpecError extends DravenVizError {
  readonly rule: string;
  declare readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[], options: InvalidSpecErrorOptions = {}) {
    const first = issues[0] ?? {
      rule: 'invalid-spec',
      path: '',
      message: 'The chart specification is invalid.',
    };
    super(options.code ?? 'INVALID_SPEC', first.message, {
      path: first.path,
      issues: Object.freeze([...issues]),
      ...(options.chartId === undefined ? {} : { chartId: options.chartId }),
    });
    this.name = 'InvalidSpecError';
    this.rule = first.rule;
  }
}
