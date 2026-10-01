// Loaded by index.html as a module. DravenViz is the global from dravenviz.browser.js.
// The ready flag belongs to this integration, not to the chart renderer. On any failure the error
// is left uncaught (a page error) and the flag is never set.
const res = await fetch('charts.json');
if (!res.ok) throw new Error(`charts.json ${res.status}`);
const entries = await res.json();
const slot = (ns) => {
  const el = document.querySelector(`[data-chart-slot="${ns}"]`);
  if (el === null) throw new Error(`no chart slot for namespace ${ns}`);
  return el;
};
const targets = entries.map((e) => slot(e.namespace));
const handle = DravenViz.mountCharts(
  targets,
  entries.map((e) => e.spec),
  {
    width: 680,
    height: 320,
    theme: 'print',
    fit: 'width', // scale the 680 x 320 chart to its 178 mm frame
    namespaces: entries.map((e) => e.namespace),
    locale: 'en-US',
    timezone: 'UTC',
    assetBaseUrl: './',
  },
);
const info = await handle.ready; // a rejection propagates as an uncaught page error

// Equivalent data table for each chart, in its own container (`data-table-for`).
// Instrumentation (PDF checks only): each caption ends with a 1 pt invisible token that the
// frame's link annotation points to.
for (const e of entries) {
  const container = document.querySelector(`[data-table-for="${e.namespace}"]`);
  if (container === null) throw new Error(`no table container for namespace ${e.namespace}`);
  DravenViz.renderDataTable(container, DravenViz.validateSpec(e.spec), {
    locale: 'en-US',
    timezone: 'UTC',
  });
  const caption = container.querySelector('caption');
  if (caption === null) throw new Error(`no table caption for namespace ${e.namespace}`);
  const token = document.createElement('span');
  token.id = `dvt-${e.namespace}`;
  token.className = 'dv-token';
  token.textContent = `DVT${e.namespace}`;
  caption.appendChild(token);
}

window.__DV_READY_INFO__ = info; // read by tests/pdf/compare.ts for the browser comparison render
window.__DRAVENPDF_READY__ = true;
