import { DravenVizError } from '../../core/index';
import {
  GEOMETRY_BY_TAG,
  GLOBAL_ATTRIBUTES,
  RECHARTS_PRESENTATION_ATTRIBUTES,
  isPassthrough,
} from './recharts-metadata';

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Elements the standalone SVG may contain (design section 10, stage 2). */
export const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set(
  'svg g path rect circle ellipse line polyline polygon text tspan title desc defs clipPath linearGradient stop pattern style'.split(
    ' ',
  ),
);

export const RULE = {
  element: 'svg-disallowed-element',
  attribute: 'svg-disallowed-attribute',
  event: 'svg-event-attribute',
  foreignObject: 'svg-foreign-object',
  script: 'svg-script',
  animation: 'svg-animation',
  external: 'svg-external-reference',
  dangling: 'svg-dangling-reference',
  duplicateId: 'svg-duplicate-id',
} as const;

const ANIMATION = new Set([
  'animate',
  'animatemotion',
  'animatetransform',
  'animatecolor',
  'set',
  'mpath',
]);
const HREF = /(^|:)href$/i;
const URL_CALL = /url\(\s*([^)]*?)\s*\)/gi;

function fail(rule: string, path: string, message: string): never {
  throw new DravenVizError('EXPORT_FAILED', message, {
    path,
    issues: [{ rule, path, message }],
  });
}

function pathOf(el: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    const parent = n.parentElement;
    if (parent === null) {
      parts.unshift(n.localName);
      break;
    }
    const same = Array.from(parent.children).filter((c) => c.localName === n?.localName);
    parts.unshift(`${n.localName}[${same.indexOf(n) + 1}]`);
  }
  return `/${parts.join('/')}`;
}

function unquote(v: string): string {
  return v.replace(/^["']|["']$/g, '');
}

function isLocalRef(v: string): boolean {
  return /^#[^\s#"'()]+$/.test(v);
}

function attributeAllowed(tag: string, name: string): boolean {
  if (RECHARTS_PRESENTATION_ATTRIBUTES.has(name) || GLOBAL_ATTRIBUTES.has(name)) return true;
  if (isPassthrough(name)) return true;
  return (GEOMETRY_BY_TAG[tag] ?? []).includes(name);
}

/**
 * Strict allowlist validation (design section 10, stage 2). Nothing is stripped here: any element or
 * attribute that is not allowed after normalization throws `EXPORT_FAILED` with a `rule` and the
 * element path, such as `/svg/g[2]/path[1]@onclick`. Works on any DOM (it is unit-tested in JSDOM).
 */
export function validateSvg(root: SVGSVGElement): void {
  const ids = new Set<string>();
  const all = [root as Element, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id === null) continue;
    if (ids.has(id))
      fail(RULE.duplicateId, `${pathOf(el)}@id`, `The id "${id}" is used more than once.`);
    ids.add(id);
  }
  const checkLocal = (id: string, path: string): void => {
    if (!ids.has(id)) {
      fail(RULE.dangling, path, `The reference to "#${id}" points at no element in this SVG.`);
    }
  };

  for (const el of all) {
    const tag = el.localName;
    const where = pathOf(el);
    const lower = tag.toLowerCase();
    if (lower === 'foreignobject') fail(RULE.foreignObject, where, 'foreignObject is not allowed.');
    if (lower === 'script') fail(RULE.script, where, 'script is not allowed.');
    if (ANIMATION.has(lower)) fail(RULE.animation, where, `${tag} (animation) is not allowed.`);

    const attrs = Array.from(el.attributes).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const attr of attrs) {
      const at = `${where}@${attr.name}`;
      if (/^on/i.test(attr.name)) fail(RULE.event, at, 'Event attributes are not allowed.');
      if (HREF.test(attr.name) && !isLocalRef(attr.value.trim())) {
        fail(RULE.external, at, 'href may only point at a local #id.');
      }
      for (const m of attr.value.matchAll(URL_CALL)) {
        if (!isLocalRef(unquote((m[1] ?? '').trim()))) {
          fail(RULE.external, at, 'url() may only point at a local #id.');
        }
      }
    }

    if (el.namespaceURI !== SVG_NS || !ALLOWED_ELEMENTS.has(tag)) {
      fail(RULE.element, where, `Element <${tag}> is not allowed in an exported SVG.`);
    }
    if (tag === 'style') {
      const text = el.textContent ?? '';
      if (/@import/i.test(text) || /url\(\s*["']?\s*(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)/i.test(text)) {
        fail(RULE.external, where, 'A style element may not import or reference another origin.');
      }
    }
    for (const attr of attrs) {
      if (!attributeAllowed(tag, attr.name)) {
        fail(
          RULE.attribute,
          `${where}@${attr.name}`,
          `Attribute "${attr.name}" is not allowed on <${tag}> in an exported SVG.`,
        );
      }
    }

    for (const attr of attrs) {
      const at = `${where}@${attr.name}`;
      for (const m of attr.value.matchAll(URL_CALL))
        checkLocal(unquote((m[1] ?? '').trim()).slice(1), at);
      if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') {
        for (const id of attr.value.split(/\s+/).filter(Boolean)) checkLocal(id, at);
      }
    }
  }
}
