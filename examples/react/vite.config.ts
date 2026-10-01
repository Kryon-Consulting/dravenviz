import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// Copied next to this file by `pnpm stage react` (scripts/vite-resolution-report.ts).
import { resolutionReport } from './vite-resolution-report.ts';

export default defineConfig({
  plugins: [react(), resolutionReport()],
  resolve: {
    // One copy of React, ReactDOM and react-is, resolved from this directory's node_modules.
    dedupe: ['react', 'react-dom', 'react-is'],
    preserveSymlinks: false,
  },
});
