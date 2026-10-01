import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { validateSpec } from '@draven/viz';
import { Chart } from '@draven/viz/react';
import '@draven/viz/styles.css';

const spec = validateSpec({
  schemaVersion: 1,
  id: 'daily-total',
  kind: 'cartesian',
  title: 'Daily total',
  xAxis: { id: 'day', scale: 'time' },
  yAxes: [{ id: 'v', label: 'Total', unit: 'count' }],
  series: [
    {
      id: 't',
      label: 'Total',
      mark: 'line',
      yAxisId: 'v',
      points: [
        { id: 'a', x: '2026-07-01', value: 3 },
        { id: 'b', x: '2026-07-02', value: null },
        { id: 'c', x: '2026-07-03', value: 5 },
      ],
    },
  ],
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Chart spec={spec} height={320} />
  </StrictMode>,
);
