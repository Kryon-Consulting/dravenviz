import { realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * `dv-resolution-report` (design section 16.1). During `vite build` it records the resolved real
 * path of every import of `@draven/viz*`, `react`, `react-dom`, `react-is` and `recharts` into
 * `resolution.json` in the Vite root. `scripts/stage-consumer.ts` reads that file and fails when any
 * path lies outside the stage's `node_modules`. The file is copied into each stage next to its
 * `vite.config.ts`, so it imports nothing from the repository.
 */
const WATCHED = ['@draven/viz', 'react', 'react-dom', 'react-is', 'recharts'];

interface Entry {
  source: string;
  importer: string | null;
  resolved: string;
  real: string;
}

const packageOf = (source: string): string =>
  source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : (source.split('/')[0] ?? '');

export function resolutionReport(): Plugin {
  let root = process.cwd();
  const entries = new Map<string, Entry>();
  return {
    name: 'dv-resolution-report',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async resolveId(source, importer, options) {
      if (
        source.startsWith('.') ||
        source.startsWith('\0') ||
        !WATCHED.includes(packageOf(source))
      ) {
        return null;
      }
      const result = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (result && !result.external) {
        const resolved = result.id.replace(/[?#].*$/, '');
        let real = resolved;
        try {
          real = realpathSync(resolved);
        } catch {
          // keep the unresolved path; the stage check rejects it
        }
        entries.set(`${source}\u0000${real}`, {
          source,
          importer: importer ?? null,
          resolved,
          real,
        });
      }
      return result;
    },
    closeBundle() {
      const list = [...entries.values()].sort((a, b) =>
        a.source === b.source ? a.real.localeCompare(b.real) : a.source.localeCompare(b.source),
      );
      writeFileSync(
        path.join(root, 'resolution.json'),
        `${JSON.stringify({ root, entries: list }, null, 2)}\n`,
      );
    },
  };
}
