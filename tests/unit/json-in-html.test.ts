import { describe, expect, test } from 'vitest';
import { escapeJsonForHtml } from '../../examples/html/json-in-html.js';

describe('escapeJsonForHtml', () => {
  const nasty = '</script><!-- & > \u2028 \u2029 -->';

  test('output contains none of the dangerous characters', () => {
    const out = escapeJsonForHtml({ title: nasty });
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
  });

  test('parses back to the original value', () => {
    const value = { title: nasty, n: [1, null, 2.5], nested: { 'a<b': true } };
    expect(JSON.parse(escapeJsonForHtml(value))).toEqual(value);
  });

  test('escapes with lowercase unicode escapes', () => {
    expect(escapeJsonForHtml('<>&\u2028\u2029')).toBe('"\\u003c\\u003e\\u0026\\u2028\\u2029"');
  });
});
