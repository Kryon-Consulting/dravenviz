# DravenViz

`@draven/viz` is a standalone TypeScript chart library for reports that must look the same on
screen and in print. This package is private and unlicensed (`UNLICENSED`); it is never published.
This README covers the slice-1 subset: line charts.

## Install

Consumers install the packed tarball produced by `pnpm pack:local`:

```bash
npm install ./draven-viz-0.1.0.tgz
```

### React peers

`react`, `react-dom` and `react-is` are optional peers (`^18.3.0 || ^19.0.0`). Install all three at
the same major.minor, because Recharts requires `react-is` to match `react`:

```bash
# React 18
npm install react@18.3.1 react-dom@18.3.1 react-is@18.3.1
# React 19
npm install react@19.3.0 react-dom@19.3.0 react-is@19.3.0
```

Exactly one copy of each must exist in `node_modules`. Core-only consumers
(`import { validateSpec } from '@draven/viz'`) need none of them.

## Minimal React example

```tsx
import { Chart } from '@draven/viz/react';
import '@draven/viz/styles.css';

export function Report({ spec }: { spec: unknown }) {
  return <Chart spec={spec} height={320} />;
}
```

Every chart gets a hashed default namespace from `useId()`. Two charts with the same spec `id` in
the same document and the same namespace fail with a duplicate-embedding error. When a page holds
several React roots (islands, micro-frontends), give each root a distinct `identifierPrefix` in
`createRoot(el, { identifierPrefix: 'a' })`, or pass an explicit `namespace` prop to each chart.

## Minimal HTML example

Copy the files listed in `asset-manifest.json` (use each entry's `path` as the destination) next
to your page, then:

```html
<link rel="stylesheet" href="dravenviz.css" />
<div id="chart" style="width: 680px; height: 320px"></div>
<script src="dravenviz.browser.js"></script>
<script src="main.js"></script>
```

```js
// main.js
fetch('charts.json')
  .then((r) => r.json())
  .then((specs) =>
    window.DravenViz.mountCharts([document.getElementById('chart')], [specs[0]], {
      width: 680,
      height: 320,
      namespaces: ['a'],
    }),
  )
  .then((handle) => handle.ready)
  .then(() => {
    window.__ready = true;
  });
```

The browser bundle bundles its own React, so it never reads or writes the page's `window.React`.
Complete pages are in `examples/html/` (`basic.html`, `host-isolation.html`).

### Chart JSON inside HTML

Prefer a separate `charts.json` file. If you must embed JSON in a page, put it in
`<script type="application/json">` and escape `<`, `>`, `&`, U+2028 and U+2029:

```js
const escapeJsonForHtml = (value) =>
  JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
```

## DOM requirements

Rendering needs a real browser DOM: `document.fonts` and `FontFace`, a 2D canvas for text
measurement, `ResizeObserver` (for `width="100%"`), `requestAnimationFrame` and `crypto.subtle`.
Importing the package, including `@draven/viz/react`, touches none of these; server rendering emits
only a placeholder `div.dravenviz-root`. The host element must be rendered (not `display: none`) and
sized when the chart mounts. Fonts are loaded from `assetBaseUrl` (default: `fonts/` next to the
page); only relative or same-origin URLs are allowed, and no request leaves the origin.

The page must be a secure context, because font files are hashed with `crypto.subtle`: serve it
over HTTPS or from `localhost`. A page on a plain-http intranet host, or opened from `file://`,
fails with `FONT_LOAD_FAILED` and a message that names this requirement.

## Scripts

`pnpm build`, `pnpm pack:local`, `pnpm stage <react|docs|html>`, `pnpm test`, `pnpm test:browser`.
`pnpm test:browser` runs both Playwright projects. The gating command is
`pnpm exec playwright test --project=browser`; the `visual` project fails with `pending owner
review` until the baselines are approved in `tests/visual/REVIEW.md`.
