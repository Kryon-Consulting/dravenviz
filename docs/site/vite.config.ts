import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// Copied next to this file by `pnpm stage docs` (scripts/vite-resolution-report.ts).
import { resolutionReport } from './vite-resolution-report.ts';

export default defineConfig({
  // Relative asset URLs, so the build works from any path and the playground's `fonts/` lookups
  // resolve next to index.html.
  base: './',
  plugins: [react(), resolutionReport()],
  resolve: {
    // One copy of React, ReactDOM and react-is, resolved from this directory's node_modules.
    dedupe: ['react', 'react-dom', 'react-is'],
    preserveSymlinks: false,
  },
});
