import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_SPECIFIER =
  /(?:\bimport\s+(?:[^'"();]*?\sfrom\s+)?|\bexport\s+[^'"();]*?\sfrom\s+|\bimport\s*\(\s*)(['"])([^'"\n]+)\1/g;

export interface ImportOffender {
  file: string;
  specifier: string;
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Source files under `dir` (repo-relative or absolute), as repo-relative POSIX paths. */
export function listFiles(dir: string): string[] {
  const abs = path.resolve(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (SOURCE_FILE.test(entry)) out.push(toPosix(path.relative(ROOT, full)));
    }
  };
  walk(abs);
  return out;
}

function importsOf(file: string): string[] {
  const text = readFileSync(path.resolve(ROOT, file), 'utf8');
  return [...text.matchAll(IMPORT_SPECIFIER)].map((m) => m[2] as string);
}

/** Repo-relative target of a relative specifier; bare specifiers are returned unchanged. */
function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith('.')) return specifier;
  return toPosix(path.normalize(path.join(path.dirname(file), specifier)));
}

/** Imports under `dir` whose specifier, or resolved relative target, matches any pattern. */
export function scanImports(dir: string, patterns: RegExp[]): ImportOffender[] {
  const offenders: ImportOffender[] = [];
  for (const file of listFiles(dir)) {
    for (const specifier of importsOf(file)) {
      const target = resolveSpecifier(file, specifier);
      if (patterns.some((re) => re.test(specifier) || re.test(target))) {
        offenders.push({ file, specifier });
      }
    }
  }
  return offenders;
}

/** Files under `dir` that import `moduleName` or one of its subpaths. */
export function filesImporting(dir: string, moduleName: string): string[] {
  return listFiles(dir).filter((file) =>
    importsOf(file).some((s) => s === moduleName || s.startsWith(`${moduleName}/`)),
  );
}

/** Lines under `dir` matching `pattern`, as `file:line: text`. */
export function grep(dir: string, pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of listFiles(dir)) {
    readFileSync(path.resolve(ROOT, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  return hits;
}
