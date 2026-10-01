import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { build, type Metafile } from 'esbuild';
import { ROOT, isMain } from './gen-lib';

export const BROWSER_OUT = 'dist/dravenviz.browser.js';
export const CSS_SRC = 'src/styles/dravenviz.css';
export const CSS_OUT = 'dist/dravenviz.css';

/**
 * Bundles `src/browser/index.ts` into the IIFE that assigns `window.DravenViz` (design section 3).
 * React, ReactDOM, react-is and Recharts are bundled inside, so the page's own React is never read
 * or written. With `write: false` nothing touches disk; the notices generator uses that to walk
 * the metafile inputs.
 */
export async function bundleBrowser(write: boolean): Promise<Metafile> {
  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: ['src/browser/index.ts'],
    outfile: BROWSER_OUT,
    bundle: true,
    format: 'iife',
    globalName: 'DravenViz',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'linked',
    define: { 'process.env.NODE_ENV': '"production"' },
    metafile: true,
    write,
    logLevel: 'warning',
  });
  return result.metafile;
}

/** `dist/dravenviz.css` is the scoped source stylesheet, copied verbatim. */
export function buildCss(): void {
  mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  copyFileSync(path.join(ROOT, CSS_SRC), path.join(ROOT, CSS_OUT));
}

if (isMain(import.meta.url)) {
  await bundleBrowser(true);
  buildCss();
}
