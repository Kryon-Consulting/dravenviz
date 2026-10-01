import { DravenVizError } from '../../core/index';
import type { FontFormat, ResolvedFontSet } from '../fonts/registry';
import { idPrefix, rewriteIds } from './ids';
import { MATERIALIZED_PROPERTIES } from './recharts-metadata';
import { SVG_NS } from './validate';

export interface SvgFontFile {
  family: string;
  weight: 400 | 600;
  /** Basename of the source url. */
  fileName: string;
  /** As written in the SVG (`fontHrefPrefix + fileName`). */
  href: string;
  sourceUrl: string;
  sha256: string;
  bytes: number;
}

export interface SvgExport {
  svg: string;
  fonts: SvgFontFile[];
}

export interface FinalizeContext {
  namespace: string;
  chartId: string;
  title: string;
  desc: string;
  fonts: ResolvedFontSet;
  fontMode: 'external' | 'embedded';
  fontHrefPrefix: string;
}

/** Attributes whose numbers are rounded to 2 decimals. Ids, colors, urls and names are never touched. */
const NUMERIC = new Set([
  'x',
  'y',
  'dx',
  'dy',
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
  'd',
  'points',
  'transform',
  'viewBox',
  'stroke-width',
  'stroke-dasharray',
  'font-size',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'letter-spacing',
  'offset',
  'stop-opacity',
  'gradientTransform',
  'patternTransform',
]);
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

export const roundNumber = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};

export function roundNumbers(value: string): string {
  return value.replace(NUMBER, (m) => {
    const n = Number(m);
    return Number.isFinite(n) ? roundNumber(n) : m;
  });
}

const MIME: Record<FontFormat, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  truetype: 'font/ttf',
};

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const cssString = (s: string): string =>
  `"${s.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, ' ')}"`;
const canonicalFamily = (v: string): string =>
  v
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .join(',');
/** A plain run of identifiers needs no quotes; anything else is quoted. */
const familyName = (family: string): string =>
  /^[A-Za-z][A-Za-z0-9_-]*(?: [A-Za-z][A-Za-z0-9_-]*)*$/.test(family) ? family : cssString(family);
/** Internal (collision-proof) family first, then the declared family, then sans-serif. */
const familyList = (fonts: ResolvedFontSet): string =>
  `${familyName(fonts.cssFamily)}, ${familyName(fonts.family)}, sans-serif`;

function fontStyles(
  doc: Document,
  ctx: FinalizeContext,
): { elements: Element[]; files: SvgFontFile[] } {
  const elements: Element[] = [];
  const files: SvgFontFile[] = [];
  for (const face of ctx.fonts.faces) {
    const href = `${ctx.fontHrefPrefix}${face.fileName}`;
    const src =
      ctx.fontMode === 'embedded'
        ? `data:${MIME[face.format]};base64,${base64(face.buffer)}`
        : href;
    const style = doc.createElementNS(SVG_NS, 'style');
    style.textContent =
      `@font-face{font-family:${cssString(ctx.fonts.cssFamily)};font-style:normal;font-weight:${face.weight};` +
      `src:url(${cssString(src)}) format(${cssString(face.format)});}`;
    if (ctx.fontMode === 'embedded') style.setAttribute('data-dv-font-sha256', face.sha256);
    elements.push(style);
    files.push({
      family: ctx.fonts.family,
      weight: face.weight,
      fileName: face.fileName,
      href,
      sourceUrl: face.url,
      sha256: face.sha256,
      bytes: face.bytes,
    });
  }
  return { elements, files };
}

const escapeText = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, '&quot;');

/** Deterministic serializer: attributes sorted by name, `xmlns` first on the root. */
function serialize(el: Element, isRoot: boolean): string {
  const attrs = Array.from(el.attributes)
    .map((a) => [a.name, a.value] as const)
    .filter(([n]) => n !== 'xmlns')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([n, v]) => ` ${n}="${escapeAttr(v)}"`);
  const head = `${el.localName}${isRoot ? ` xmlns="${SVG_NS}"` : ''}${attrs.join('')}`;
  if (el.childNodes.length === 0) return `<${head}/>`;
  let body = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 1) body += serialize(node as Element, false);
    else if (node.nodeType === 3) body += escapeText(node.nodeValue ?? '');
  }
  return `<${head}>${body}</${el.localName}>`;
}

/**
 * Finalize (design section 10, stage 3). Mutates the normalized, validated clone: root attributes,
 * title and desc, font rules, ids rewritten to `<namespace>-<chartId>-<n>`, numbers rounded to 2
 * decimals. Serializes with sorted attributes, so the same inputs give the same bytes.
 */
export function finalizeSvg(el: SVGSVGElement, ctx: FinalizeContext): SvgExport {
  const doc = el.ownerDocument;
  const [, , vw = NaN, vh = NaN] = (el.getAttribute('viewBox') ?? '')
    .trim()
    .split(/\s+/)
    .map(Number);
  const width = Number.isFinite(vw) ? vw : Number(el.getAttribute('width'));
  const height = Number.isFinite(vh) ? vh : Number(el.getAttribute('height'));

  const family = familyList(ctx.fonts);
  const wanted = canonicalFamily(family);
  for (const node of el.querySelectorAll('[font-family]')) {
    if (canonicalFamily(node.getAttribute('font-family') ?? '') === wanted) {
      node.removeAttribute('font-family');
    }
  }
  el.setAttribute('font-family', family);
  el.setAttribute('viewBox', `0 0 ${roundNumber(width)} ${roundNumber(height)}`);
  el.setAttribute('width', String(width));
  el.setAttribute('height', String(height));
  el.setAttribute('role', 'img');
  // The root states every inherited property, so nothing depends on a host page or viewer default.
  for (const prop of MATERIALIZED_PROPERTIES) {
    if (prop !== 'opacity' && !el.hasAttribute(prop)) {
      throw new DravenVizError('EXPORT_FAILED', `The root element has no computed ${prop}.`, {
        chartId: ctx.chartId,
        issues: [{ rule: 'svg-root-property', path: '/svg', message: prop }],
      });
    }
  }

  const { elements: styles, files } = fontStyles(doc, ctx);
  const title = doc.createElementNS(SVG_NS, 'title');
  title.setAttribute('id', '__dv-title');
  title.textContent = ctx.title;
  const lead: Element[] = [title];
  const labelled = ['__dv-title'];
  if (ctx.desc !== '') {
    const desc = doc.createElementNS(SVG_NS, 'desc');
    desc.setAttribute('id', '__dv-desc');
    desc.textContent = ctx.desc;
    lead.push(desc);
    labelled.push('__dv-desc');
  }
  el.setAttribute('aria-labelledby', labelled.join(' '));
  el.prepend(...lead, ...styles);

  rewriteIds(el, idPrefix(ctx.namespace, ctx.chartId));

  for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
    for (const attr of Array.from(node.attributes)) {
      if (NUMERIC.has(attr.name)) {
        const rounded = roundNumbers(attr.value);
        if (rounded !== attr.value) node.setAttribute(attr.name, rounded);
      }
    }
  }
  return { svg: serialize(el, true), fonts: files };
}
