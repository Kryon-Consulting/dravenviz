import { expect, test } from 'vitest';
import { DravenVizError } from '../../src/core/index';
import { validateSvg } from '../../src/render/svg/validate';

const NS = 'xmlns="http://www.w3.org/2000/svg"';

function parse(inner: string, rootAttrs = ''): SVGSVGElement {
  const doc = new DOMParser().parseFromString(
    `<svg ${NS} viewBox="0 0 10 10" ${rootAttrs}>${inner}</svg>`,
    'image/svg+xml',
  );
  return doc.documentElement as unknown as SVGSVGElement;
}

function failure(el: SVGSVGElement): DravenVizError {
  try {
    validateSvg(el);
  } catch (e) {
    expect(e).toBeInstanceOf(DravenVizError);
    return e as DravenVizError;
  }
  throw new Error('expected validateSvg to throw');
}

const rule = (e: DravenVizError): string | undefined => e.issues?.[0]?.rule;

test('a clean tree passes', () => {
  const el = parse(
    '<defs><clipPath id="c"><rect x="0" y="0" width="5" height="5"/></clipPath></defs>' +
      '<g transform="translate(1 2)" clip-path="url(#c)"><path d="M0 0L1 1" fill="#000000" stroke-width="2" data-dv-mark="m"/>' +
      '<text x="1" y="2" font-style="normal" letter-spacing="normal" aria-label="a">t</text></g>',
  );
  expect(() => validateSvg(el)).not.toThrow();
});

test('an event attribute fails with its path', () => {
  const e = failure(parse('<g/><g/><g><path d="M0 0" onclick="x()"/></g>'));
  expect(e.code).toBe('EXPORT_FAILED');
  expect(rule(e)).toBe('svg-event-attribute');
  expect(e.path).toBe('/svg/g[3]/path[1]@onclick');
});

test('foreignObject fails', () => {
  const e = failure(parse('<foreignObject width="1" height="1"/>'));
  expect(e.code).toBe('EXPORT_FAILED');
  expect(rule(e)).toBe('svg-foreign-object');
  expect(e.path).toBe('/svg/foreignObject[1]');
});

test('script fails', () => {
  const e = failure(parse('<script>alert(1)</script>'));
  expect(rule(e)).toBe('svg-script');
});

test('animation elements fail', () => {
  for (const tag of ['animate', 'set', 'animateTransform', 'animateMotion']) {
    expect(rule(failure(parse(`<path d="M0 0"><${tag}/></path>`))), tag).toBe('svg-animation');
  }
});

test('a use element pointing at another origin fails as an external reference', () => {
  const e = failure(parse('<use href="https://x"/>'));
  expect(rule(e)).toBe('svg-external-reference');
  expect(e.path).toBe('/svg/use[1]@href');
});

test('xlink:href to another origin fails as an external reference', () => {
  expect(
    rule(
      failure(
        parse('<g><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="//x/y.svg#a"/></g>'),
      ),
    ),
  ).toBe('svg-external-reference');
});

test('a url() to another origin fails', () => {
  const e = failure(parse('<rect x="0" y="0" width="1" height="1" fill="url(https://x#a)"/>'));
  expect(rule(e)).toBe('svg-external-reference');
  expect(e.path).toBe('/svg/rect[1]@fill');
});

test('url(#missing) fails as a dangling reference', () => {
  const e = failure(parse('<rect x="0" y="0" width="1" height="1" fill="url(#missing)"/>'));
  expect(rule(e)).toBe('svg-dangling-reference');
});

test('url(#id) with a target passes', () => {
  const el = parse(
    '<defs><pattern id="p" width="2" height="2"><rect width="1" height="1"/></pattern></defs><rect width="1" height="1" fill="url(#p)"/>',
  );
  expect(() => validateSvg(el)).not.toThrow();
});

test('aria-labelledby with a missing id fails as a dangling reference', () => {
  const e = failure(parse('<title id="t">x</title>', 'aria-labelledby="t nope"'));
  expect(rule(e)).toBe('svg-dangling-reference');
});

test('a class attribute that survives normalization is a disallowed attribute', () => {
  // Normalization strips `class`; this hand-built tree skips it to prove the stage order.
  const e = failure(parse('<g class="recharts-layer"/>'));
  expect(rule(e)).toBe('svg-disallowed-attribute');
  expect(e.path).toBe('/svg/g[1]@class');
});

test('an unknown attribute and an unknown element fail, nothing is silently stripped', () => {
  expect(rule(failure(parse('<path d="M0 0" foo="1"/>')))).toBe('svg-disallowed-attribute');
  expect(rule(failure(parse('<image width="1" height="1"/>')))).toBe('svg-disallowed-element');
  expect(rule(failure(parse('<filter id="f"/>')))).toBe('svg-disallowed-element');
});

test('an element outside the SVG namespace fails', () => {
  const el = parse('<g><div xmlns="http://www.w3.org/1999/xhtml">x</div></g>');
  expect(rule(failure(el))).toBe('svg-disallowed-element');
});

test('a style attribute fails', () => {
  expect(rule(failure(parse('<g style="fill:red"/>')))).toBe('svg-disallowed-attribute');
});

test('width and height are not geometry on a g element', () => {
  expect(rule(failure(parse('<g width="1"/>')))).toBe('svg-disallowed-attribute');
});

test('a style element may not import or reference another origin', () => {
  expect(rule(failure(parse('<style>@import url(https://x/y.css);</style>')))).toBe(
    'svg-external-reference',
  );
});
