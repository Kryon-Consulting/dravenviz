import { defineConfig } from 'vite';

// Vite 8 transforms TSX with Oxc (automatic JSX runtime); no React plugin is needed for the spike.
export default defineConfig({
  server: { port: 5178, strictPort: true },
});
