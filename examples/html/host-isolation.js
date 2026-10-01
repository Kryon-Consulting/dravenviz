// Loaded by host-isolation.html after the page's own React 18 and the DravenViz bundle.
// The page's React stays untouched: DravenViz bundles its own private React 19.
const hostRoot = window.ReactDOM.createRoot(document.getElementById('host-react'));
hostRoot.render(
  window.React.createElement('p', { id: 'host-react-text' }, `Host React ${window.React.version}`),
);

fetch('charts.json')
  .then((response) => {
    if (!response.ok) throw new Error(`charts.json: HTTP ${response.status}`);
    return response.json();
  })
  .then((specs) => {
    // The same spec twice: only the namespaces keep the two instances apart.
    const handle = window.DravenViz.mountCharts(
      [document.getElementById('chart-a'), document.getElementById('chart-b')],
      [specs[0], specs[0]],
      { width: 680, height: 320, namespaces: ['a', 'b'] },
    );
    return handle.ready;
  })
  .then(() => {
    window.__ready = true;
  })
  .catch((error) => {
    setTimeout(() => {
      throw error;
    });
  });
