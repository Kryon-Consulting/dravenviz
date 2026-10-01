import { defineConfig } from 'vite';
// Copied next to this file by tests/package/run.ts (scripts/vite-resolution-report.ts).
import { resolutionReport } from './vite-resolution-report.ts';

export default defineConfig({
  plugins: [resolutionReport()],
  resolve: { dedupe: ['react', 'react-dom', 'react-is'], preserveSymlinks: false },
});
