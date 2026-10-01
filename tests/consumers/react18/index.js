import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { validateSpec } from '@draven/viz';
import { Chart } from '@draven/viz/react';
import '@draven/viz/styles.css';
// Copied from fixtures/valid by tests/package/run.ts.
import minLine from './fixtures/min-line.json';

// The driver's Playwright smoke test reads this record.
const state = { ready: false, readyCalls: 0, info: null, errors: [] };
window.__dv = state;

const spec = validateSpec(minLine);

createRoot(document.getElementById('root')).render(
  createElement(Chart, {
    spec,
    height: 320,
    onReady: (info) => {
      state.readyCalls += 1;
      state.info = info;
      state.ready = true;
    },
    onError: (error) => state.errors.push(String(error && error.message)),
  }),
);
