import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Internal test harness only: a Vite dev server over tests/harness that imports `src/`
// directly. Never shipped and never used by consumers (they get the packed tarball only).
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../..', import.meta.url));

export const HARNESS_PORT = 4179;

export default defineConfig({
  root,
  // Serve the shipped fonts at /fonts/ and the test-only fonts at /test-fonts/.
  publicDir: false,
  plugins: [
    {
      name: 'dv-font-dirs',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url ?? '';
          const m = /^\/(fonts|test-fonts)\/([^/?#]+)(?:[?#].*)?$/.exec(url);
          if (!m) return next();
          const dir = m[1] === 'fonts' ? 'assets/fonts' : 'tests/assets/fonts';
          const name = decodeURIComponent(m[2] as string);
          const { readFile } = await import('node:fs/promises');
          try {
            const body = await readFile(`${repo}${dir}/${name}`);
            res.setHeader(
              'Content-Type',
              name.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream',
            );
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
          } catch {
            res.statusCode = 404;
            res.end('not found');
          }
        });
      },
    },
  ],
  server: {
    port: HARNESS_PORT,
    strictPort: true,
    host: '127.0.0.1',
    fs: { allow: [repo] },
  },
});
