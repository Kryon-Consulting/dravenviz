import type { ReactElement } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { snippets } from '../snippets';

const MATRIX: [string, string][] = [
  ['Node (develop/build)', '22.22 pinned via .nvmrc; engines >=20.19 for core validation in Node'],
  ['pnpm', '10.33.0'],
  ['TypeScript (dev)', '6.0.x; declarations tested with consumer TS 5.4 and 6.0'],
  [
    'React (peer)',
    '18.3.x and 19.x (tested 18.3.1 and 19.3.0), with react-dom and react-is at the same major.minor; the browser bundle embeds React, ReactDOM and react-is 19.3.0',
  ],
  ['Recharts', '3.10.1 exact'],
  [
    'Browsers',
    'Verified: Chromium 141 (automated). Provisional, not yet verified: Chrome/Edge >= 120, Firefox >= 121, Safari >= 17',
  ],
  ['Python (examples)', '3.12 via uv'],
  ['DravenPDF', 'commit 7a249e0'],
  ['Test browser', 'Chromium 141.0.7390.37 (Playwright 1.56.1, revision 1194)'],
  ['Font', 'Noto Sans v2.015, weights 400/600'],
];

export function Start(): ReactElement {
  return (
    <article className="prose">
      <h1>Start here</h1>
      <p>
        DravenViz (<code>@draven/viz</code>) turns one chart JSON document into an interactive React
        chart, a plain-HTML chart, a standalone SVG and, through DravenPDF, a PDF page. This slice
        draws Cartesian line charts; the other chart families validate but are not drawn yet.{' '}
        <a href="#/playground">Open the playground</a> to try a chart.
      </p>

      <h2>Environment</h2>
      <table aria-label="Environment matrix">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Supported / pinned</th>
          </tr>
        </thead>
        <tbody>
          {MATRIX.map(([item, value]) => (
            <tr key={item}>
              <th scope="row">{item}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Install</h2>
      <p>
        The package is private and never published. Every consumer, including this site, installs it
        from the packed tarball. Exact sequence from a clean checkout:
      </p>
      <CodeBlock id="install" label="Clean checkout" text={snippets.install} />
      <CodeBlock id="consumer" label="In your application" text={snippets.consumer} />

      <h2>First React chart</h2>
      <p>
        <code>validateSpec</code> checks the JSON and returns the typed spec; <code>Chart</code>{' '}
        draws it. This is <code>examples/react/src/main.tsx</code>. Staging it proves that its
        imports resolve from the packed tarball. <code>pnpm test:package</code> additionally installs
        the tarball with <code>npm</code> into clean React 18.3.1 and React 19.3.0 apps (the same
        chart, built with Vite) and checks in Chromium that the chart is ready and{' '}
        <code>onReady</code> is called. The example file itself is not run by that test.
      </p>
      <CodeBlock id="react" label="examples/react/src/main.tsx" text={snippets.react} />

      <h2>Plain HTML chart</h2>
      <p>
        No bundler and no framework: load the browser bundle and the stylesheet, then call{' '}
        <code>DravenViz.mountCharts</code>. The page and its script come from{' '}
        <code>examples/html</code>; the files the page loads are the ones listed in the
        package&apos;s <code>dist/asset-manifest.json</code>.
      </p>
      <CodeBlock id="html-page" label="examples/html/basic.html" text={snippets.htmlPage} />
      <CodeBlock id="html-script" label="examples/html/basic.js" text={snippets.htmlScript} />
      <p>
        For print and report layouts that size charts to a container, pass{' '}
        <code>fit: &quot;width&quot;</code> in the mount options: the chart scales to its
        container&apos;s width with the aspect ratio kept, and its logical layout (and the SVG{' '}
        <code>viewBox</code>) does not change.
      </p>

      <h2>Python to DravenPDF</h2>
      <p>
        A backend sends ordinary chart JSON and a document page to DravenPDF; Chromium runs the
        packed DravenViz bundle and the PDF comes back. Python never draws a chart. This section is
        copied from <code>examples/dravenpdf/README.md</code>; <code>pnpm test:pdf</code> produces
        the sample report that the playground links to.
      </p>
      <CodeBlock id="dravenpdf" label="examples/dravenpdf/README.md" text={snippets.dravenpdf} />

      <h2>What needs a DOM</h2>
      <ul>
        <li>
          <strong>No DOM needed:</strong> <code>@draven/viz</code> (validation, themes, the data
          table model). It imports in Node and loads neither React nor Recharts.
        </li>
        <li>
          <strong>A browser DOM is needed</strong> for everything that draws:{' '}
          <code>@draven/viz/react</code> <code>Chart</code> (the first server render is an empty
          placeholder; the chart appears after mount), <code>mountCharts</code>,{' '}
          <code>renderToSvg</code> and <code>renderToSvgWithAssets</code> (they mount the chart
          offscreen, wait for fonts and layout, then serialize it). Server-side and Node export are
          not supported. <code>DataTable</code> renders on the server.
        </li>
      </ul>

      <h2>Troubleshooting</h2>
      <h3>Several React roots on one page</h3>
      <p>
        In multi-root and hydrated React pages, pass React&apos;s <code>identifierPrefix</code> to
        each root, or give every <code>&lt;Chart&gt;</code> its own <code>namespace</code> prop. Two
        charts with the same namespace and chart id are rejected as a duplicate embedding. A chart
        in that error state recovers on its next prop change, not automatically when the other
        instance unmounts.
      </p>
      <h3>Fonts fail to load on a plain-http page (FONT_LOAD_FAILED)</h3>
      <p>
        DravenViz hashes every font file with Web Crypto, which browsers expose only in a secure
        context. Serve the page over HTTPS or from <code>localhost</code>. A page on a plain-http
        intranet host fails with <code>FONT_LOAD_FAILED</code> and a message that names this
        requirement. A page opened from <code>file://</code> is not supported: font URLs must be
        relative or same-origin http(s), so it fails with <code>INVALID_OPTIONS</code>.
      </p>
      <h3>Charts mounted while hidden (ZERO_SIZE)</h3>
      <p>
        A numeric <code>width</code> creates no resize observer. If the host was hidden (for example
        in a closed tab or <code>display: none</code>) when the chart mounted, the mount is rejected
        with <code>ZERO_SIZE</code>: render it again once the host is visible.{' '}
        <code>width=&quot;100%&quot;</code> follows the container and recovers by itself.
      </p>
      <h3>LAYOUT_ERROR at 1200 x 320 and 178 mm</h3>
      <p>
        The label-rotate and label-thin fixtures at 1200 x 320 printed at 178 mm report{' '}
        <code>LAYOUT_ERROR</code>. That is expected: printed labels must stay at least 9 pt, so the
        text scales up with the printed width and the plot area becomes too short. Increase the
        height, shorten the labels or use a narrower logical width.
      </p>
      <h3>Fonts and host pages</h3>
      <p>
        DravenViz registers its fonts under the internal family{' '}
        <code>&quot;DravenViz Noto Sans&quot;</code>, so a host page&apos;s own{' '}
        <code>&quot;Noto Sans&quot;</code> <code>@font-face</code> rules do not collide with it.
        Standalone SVG files either embed the fonts (portable single file) or reference a{' '}
        <code>fonts/</code> folder that must stay next to the SVG.
      </p>
    </article>
  );
}
