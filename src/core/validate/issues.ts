import { parseTime } from '../format/time';
import type { AjvError } from './ajv.gen.js';
import { ALLOWED_FIELDS, type AllowedNode } from './allowed.gen';

export interface ValidationIssue {
  /** Stable rule id, e.g. "bar-domain-excludes-data" or "schema-additionalProperties". */
  rule: string;
  /** JSON Pointer to the offending value (or to the missing/unknown field). */
  path: string;
  /** Corrective: what is wrong and what to change. Never contains data values. */
  message: string;
}

export const MAX_ISSUES = 50;

/** Collects issues, capped at MAX_ISSUES. Rules check `full` to stop early. */
export class IssueSink {
  readonly issues: ValidationIssue[] = [];

  get full(): boolean {
    return this.issues.length >= MAX_ISSUES;
  }

  add(rule: string, path: string, message: string): void {
    if (!this.full) this.issues.push({ rule, path, message });
  }
}

const escapeSegment = (s: string | number): string =>
  String(s).replace(/~/g, '~0').replace(/\//g, '~1');

/** Build a JSON Pointer from segments: `ptr('series', 0, 'id')` is `/series/0/id`. */
export function ptr(...segments: (string | number)[]): string {
  return segments.map((s) => '/' + escapeSegment(s)).join('');
}

const unescapeSegment = (s: string): string => s.replace(/~1/g, '/').replace(/~0/g, '~');

function valueAt(root: unknown, pointer: string): unknown {
  let cur: unknown = root;
  if (pointer === '') return cur;
  for (const raw of pointer.slice(1).split('/')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[unescapeSegment(raw)];
  }
  return cur;
}

/** Field names the schema allows on the object at `base`, following discriminators in the data. */
function allowedFields(input: unknown, base: string): string[] | undefined {
  let node: AllowedNode | undefined = ALLOWED_FIELDS;
  let data: unknown = input;
  const pick = (n: AllowedNode | undefined): AllowedNode | undefined => {
    if (!n?.tag) return n;
    const t = (data as Record<string, unknown> | null)?.[n.tag];
    return typeof t === 'string' ? n.variants?.[t] : undefined;
  };
  const segments = base === '' ? [] : base.slice(1).split('/').map(unescapeSegment);
  for (const seg of segments) {
    node = pick(node);
    if (!node) return undefined;
    node = Array.isArray(data) ? node.items : (node.props?.[seg] ?? node.values);
    data =
      data !== null && typeof data === 'object'
        ? (data as Record<string, unknown>)[seg]
        : undefined;
  }
  return pick(node)?.keys;
}

const jsType = (v: unknown): string =>
  v === null
    ? 'null'
    : Array.isArray(v)
      ? 'array'
      : typeof v === 'number' && !Number.isFinite(v)
        ? 'non-finite number'
        : typeof v;

/** A bounded rendering (JSON escapes any control characters) of a caller-supplied tag, for "unknown value" messages. */
const shown = (v: unknown): string =>
  typeof v === 'string' ? JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v) : typeof v;

/** Schema array caps that are protection limits (design section 6), by instance path. */
const LIMIT_PATHS: Record<string, string | undefined> = {
  '/series': 'series-count',
  '/xAxis/categories': 'bar-categories',
  '/xAxis/labels': 'bar-categories',
  '/slices': 'donut-slices',
  '/referenceLines': 'reference-line-count',
  '/annotations': 'annotation-count',
  '/items': 'progress-items',
};

const TAG_ALLOWED: Record<string, string> = {
  kind: 'cartesian, donut, heatmap, progress',
  scale: 'category, linear, time',
  policy: 'include-zero, fit, fixed',
};

const list = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v));

function patternMessage(schemaPath: string): string {
  if (/\$defs\/Id\//.test(schemaPath))
    return "Use an id that starts with a letter, then letters, digits, '_' or '-', at most 64 characters.";
  if (/\$defs\/Color\//.test(schemaPath)) return 'Use a color written as #RRGGBB (six hex digits).';
  if (
    /\$defs\/(Text|MultilineText)\//.test(schemaPath) ||
    /properties\/(title|description|caption)\//.test(schemaPath)
  )
    return 'Remove control characters (and unpaired surrogates) from this text; only description, caption and detail may contain newlines.';
  if (/\$defs\/Currency|currency/.test(schemaPath))
    return 'Use a 3 letter upper-case ISO 4217 code such as USD.';
  return 'Change this value to match the format described by the schema.';
}

/** Ajv `keyword`-specific rewriting. Returns undefined to drop the error. */
function mapOne(e: AjvError, input: unknown): ValidationIssue | undefined {
  const base = e.instancePath;
  const p = e.params;
  const at = base === '' ? 'the chart' : `'${base}'`;
  switch (e.keyword) {
    case 'if':
      return undefined;
    case 'required': {
      const name = String(p.missingProperty);
      return {
        rule: 'schema-required',
        path: base + ptr(name),
        message: `Add the required field '${name}' to ${at}.`,
      };
    }
    case 'additionalProperties': {
      const name = String(p.additionalProperty);
      const allowed = allowedFields(input, base);
      return {
        rule: 'schema-additionalProperties',
        path: base + ptr(name),
        message: `Remove unknown field '${name}' from ${at}, or fix its spelling${
          allowed ? ` (allowed: ${allowed.join(', ')})` : ''
        }.`,
      };
    }
    case 'propertyNames': {
      const name = String(p.propertyName);
      return {
        rule: 'schema-propertyNames',
        path: base + ptr(name),
        message: `Rename the key '${name}' in ${at}: keys must start with a letter, then letters, digits, '_' or '-', at most 64 characters.`,
      };
    }
    case 'discriminator': {
      const tag = String(p.tag);
      const allowed = TAG_ALLOWED[tag] ?? '';
      const path = base + ptr(tag);
      if (p.error === 'tag') {
        return {
          rule: 'schema-discriminator',
          path,
          message: `'${tag}' is missing or not a string; set it to one of: ${allowed}.`,
        };
      }
      return {
        rule: 'schema-discriminator',
        path,
        message: `Unknown value ${shown(p.tagValue)} for '${tag}'; allowed: ${allowed}.`,
      };
    }
    case 'type': {
      const v = valueAt(input, base);
      if (typeof v === 'number' && !Number.isFinite(v)) {
        return {
          rule: 'non-finite-number',
          path: base,
          message:
            'Replace this non-finite number (Infinity or NaN, for example from 1e400) with a finite number, or null where a value may be missing.',
        };
      }
      return {
        rule: 'schema-type',
        path: base,
        message: `Expected ${Array.isArray(p.type) ? p.type.join(' or ') : String(p.type)} but found ${jsType(v)}; fix the type of this value.`,
      };
    }
    case 'enum':
      return {
        rule: 'schema-enum',
        path: base,
        message: `Use one of: ${list(p.allowedValues)}.`,
      };
    case 'const':
      return {
        rule: 'schema-const',
        path: base,
        message: `Set this to exactly ${JSON.stringify(p.allowedValue)}.`,
      };
    case 'pattern': {
      if (/\$defs\/IsoTime\//.test(e.schemaPath)) {
        const v = valueAt(input, base);
        const r = parseTime(typeof v === 'string' ? v : '');
        if (!r.ok) return { rule: r.rule, path: base, message: r.message };
      }
      return { rule: 'schema-pattern', path: base, message: patternMessage(e.schemaPath) };
    }
    case 'minLength':
    case 'maxLength':
      return {
        rule: `schema-${e.keyword}`,
        path: base,
        message:
          e.keyword === 'minLength'
            ? `Provide at least ${String(p.limit)} character(s) of text.`
            : `Shorten this text to at most ${String(p.limit)} characters.`,
      };
    case 'minItems':
      return {
        rule: 'schema-minItems',
        path: base,
        message: `Provide at least ${String(p.limit)} item(s) in this list.`,
      };
    case 'maxItems':
      if (base === '/yAxes') {
        return {
          rule: 'too-many-axes',
          path: base,
          message: `A chart has at most ${String(p.limit)} y axes; remove the extra axes or move the series to one of the two.`,
        };
      }
      if (LIMIT_PATHS[base] !== undefined) {
        return {
          rule: LIMIT_PATHS[base],
          path: base,
          message: `This list has more than the limit of ${String(p.limit)} entries; reduce it or split the chart.`,
        };
      }
      return {
        rule: 'schema-maxItems',
        path: base,
        message: `Reduce this list to at most ${String(p.limit)} item(s).`,
      };
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum': {
      const cmp = { minimum: '>=', maximum: '<=', exclusiveMinimum: '>', exclusiveMaximum: '<' }[
        e.keyword
      ];
      return {
        rule: `schema-${e.keyword}`,
        path: base,
        message: `Use a number ${cmp} ${String(p.limit)}.`,
      };
    }
    default:
      return {
        rule: `schema-${e.keyword}`,
        path: base,
        message: `${e.message ?? 'Value does not satisfy the schema'}; correct this value to match the schema.`,
      };
  }
}

/** Convert Ajv errors to ValidationIssues: rewritten messages, noise removed, de-duplicated. */
export function mapAjvErrors(errors: readonly AjvError[], input: unknown): ValidationIssue[] {
  const nameErrorPaths = new Set(
    errors.filter((e) => e.keyword === 'propertyNames').map((e) => e.instancePath),
  );
  // A non-finite number fails every branch of a union; report it once, by name.
  const nonFinitePaths = new Set(
    errors
      .filter((e) => {
        const v = e.keyword === 'type' ? valueAt(input, e.instancePath) : undefined;
        return typeof v === 'number' && !Number.isFinite(v);
      })
      .map((e) => e.instancePath),
  );
  // Raw anyOf/oneOf text is dropped when a more specific error exists at or below that path.
  const hasSpecific = (e: AjvError): boolean =>
    errors.some(
      (o) =>
        o !== e &&
        o.keyword !== 'anyOf' &&
        o.keyword !== 'oneOf' &&
        (o.instancePath === e.instancePath || o.instancePath.startsWith(e.instancePath + '/')),
    );
  const seen = new Set<string>();
  const out: ValidationIssue[] = [];
  for (const raw of errors) {
    let e = raw;
    if ((e.keyword === 'anyOf' || e.keyword === 'oneOf') && hasSpecific(e)) continue;
    if (nonFinitePaths.has(e.instancePath) && e.keyword !== 'additionalProperties') {
      e = { ...e, keyword: 'type' };
    }
    // propertyNames re-reports its failing key as a pattern error on the parent object.
    if (
      e.keyword !== 'propertyNames' &&
      nameErrorPaths.has(e.instancePath) &&
      e.keyword === 'pattern'
    )
      continue;
    const issue = mapOne(e, input);
    if (!issue) continue;
    const key = `${issue.rule}\u0000${issue.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}
