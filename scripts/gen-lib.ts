import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SCHEMA_PATH = 'schema/viz-spec-v1.schema.json';

/** Repo-relative paths of every file `pnpm gen` writes. */
export const GENERATED_FILES = [
  'src/core/spec/types.gen.ts',
  'src/core/validate/ajv.gen.js',
  'src/core/validate/ajv.gen.d.ts',
  'src/core/validate/allowed.gen.ts',
] as const;

export const HEADER_LINE = 'GENERATED — do not edit.';

export function readSchemaText(): string {
  return readFileSync(path.join(ROOT, SCHEMA_PATH), 'utf8');
}

/** `--out <dir>` lets check-drift generate into a scratch tree instead of the repo. */
export function outRoot(argv: string[]): string {
  const i = argv.indexOf('--out');
  const dir = i >= 0 ? argv[i + 1] : undefined;
  if (i >= 0 && !dir) throw new Error('--out needs a directory');
  return dir ? path.resolve(dir) : ROOT;
}

export function writeGenerated(root: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    console.log(`wrote ${rel}`);
  }
}

/** True when the module is the process entry point (so importing it has no side effects). */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  return entry !== undefined && metaUrl === pathToFileURL(entry).href;
}
