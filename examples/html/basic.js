// Loaded by basic.html. A classic script (no inline code) so the page works under a strict CSP.
const hosts = [document.getElementById('chart-a'), document.getElementById('chart-b')];

fetch('charts.json')
  .then((response) => {
    if (!response.ok) throw new Error(`charts.json: HTTP ${response.status}`);
    return response.json();
  })
  .then((specs) => {
    const handle = window.DravenViz.mountCharts(hosts, specs, {
      width: 680,
      height: 320,
      namespaces: ['a', 'b'],
    });
    return handle.ready;
  })
  .then(() => {
    window.__ready = true;
  })
  .catch((error) => {
    // An uncaught error (a page error) is the failure signal; __ready is never set.
    setTimeout(() => {
      throw error;
    });
  });
