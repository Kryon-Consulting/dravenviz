/**
 * Serializes a value for a `<script type="application/json">` element (design section 12).
 * `<`, `>`, `&`, U+2028 and U+2029 become `\uXXXX` escapes, so the text can neither close the
 * script element, open a comment, nor break a JavaScript line. `JSON.parse` of the element's
 * text gives back the original value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeJsonForHtml(value) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
