import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// Copied next to this file by `pnpm stage docs` (scripts/vite-resolution-report.ts).
import { resolutionReport } from './vite-resolution-report.ts';

export default defineConfig({
  // Relative asset URLs, so the build works from any path and the playground's `fonts/` lookups
  // resolve next to index.html.
  base: './',
  build: {
    rolldownOptions: {
      output: {
        // Split the editor and the library out of the app chunk so no chunk passes the size warning.
        codeSplitting: {
          groups: [
            {
              name: 'codemirror',
              test: /node_modules[\\/]@codemirror|node_modules[\\/]@lezer|node_modules[\\/]codemirror/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-is|scheduler)[\\/]/,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor|es-toolkit|immer|redux|reselect|react-redux|@reduxjs|decimal\.js-light|tiny-invariant|use-sync-external-store)[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), resolutionReport()],
  resolve: {
    // One copy of React, ReactDOM and react-is, resolved from this directory's node_modules.
    dedupe: ['react', 'react-dom', 'react-is'],
    preserveSymlinks: false,
  },
});
