# HTML examples

Plain-HTML pages that use the browser bundle. They load `dravenviz.browser.js` and a separate
`charts.json` (never inline chart data), call `DravenViz.mountCharts` with explicit namespaces `a`
and `b`, and set `window.__ready = true` once `ready` resolves. When `ready` rejects, the page
throws an uncaught error and never sets the flag.

- `basic.html`: two charts from `charts.json`.
- `host-isolation.html`: the host page loads its own React 18, applies hostile (non-`!important`)
  CSS and mounts the same spec twice. The charts ignore the CSS, and `window.React` stays 18.x.
- `json-in-html.js`: `escapeJsonForHtml`, for the rare case where chart JSON must be embedded in a
  `<script type="application/json">` element. It escapes `<`, `>`, `&`, U+2028 and U+2029.

## Running

The pages expect the files of `dist/asset-manifest.json`, each at its `path`, next to them:
`dravenviz.browser.js`, `dravenviz.css`, `fonts/NotoSans-*.woff2`. `tests/browser/html-examples.spec.ts`
builds exactly that directory in a temp folder (plus local React 18 UMD files for the isolation page)
and serves it under `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'
'unsafe-inline'; font-src 'self'`, with every non-origin request aborted.

## Embedding JSON in HTML

```html
<script type="application/json" id="charts">
  [{"schemaVersion":1,"id":"x", ...}]   <!-- produced by escapeJsonForHtml -->
</script>
<script>
  const specs = JSON.parse(document.getElementById('charts').textContent);
</script>
```

Under a strict CSP the reading script must be an external file; the JSON element itself is data
and needs no CSP allowance.
