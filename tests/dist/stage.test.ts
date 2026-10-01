import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';

// Needs `pnpm build && pnpm pack:local` first. `pnpm stage react` installs from the registry.
const ROOT = process.cwd();
const STAGE = join(ROOT, '.stage', 'react');
const TGZ = join(ROOT, '.pack', 'draven-viz-0.1.0.tgz');
const INSTALL_TIMEOUT = 600_000;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

interface ResolvedEntry {
  source: string;
  importer?: string;
  resolved: string;
  real: string;
}

beforeAll(() => {
  for (const name of ['react', 'html']) {
    execFileSync('pnpm', ['stage', name], { cwd: ROOT, stdio: 'pipe', timeout: INSTALL_TIMEOUT });
  }
}, INSTALL_TIMEOUT + 10_000);

describe('pnpm stage react', () => {
  test('the staged sources are regular files, not symlinks', () => {
    const src = join(STAGE, 'src');
    const files = walk(src);
    expect(files.length).toBeGreaterThan(0);
    for (const f of [...files, join(STAGE, 'package.json'), join(STAGE, 'vite.config.ts')]) {
      expect(lstatSync(f).isSymbolicLink(), f).toBe(false);
      expect(lstatSync(f).isFile(), f).toBe(true);
    }
  });

  test('the template package.json never lists @draven/viz', () => {
    const tpl = readFileSync(join(ROOT, 'examples/react/package.json'), 'utf8');
    const lock = readFileSync(join(ROOT, 'examples/react/pnpm-lock.yaml'), 'utf8');
    expect(tpl).not.toMatch(/@draven\/viz/);
    expect(lock).not.toMatch(/@draven\/viz/);
  });

  test('the resolution report points only inside the stage node_modules', () => {
    const report = JSON.parse(readFileSync(join(STAGE, 'resolution.json'), 'utf8')) as {
      entries: ResolvedEntry[];
    };
    const stageModules = realpathSync(join(STAGE, 'node_modules')) + sep;
    const names = new Set<string>();
    expect(report.entries.length).toBeGreaterThan(0);
    for (const e of report.entries) {
      expect(e.real.startsWith(stageModules), `${e.source} -> ${e.real}`).toBe(true);
      names.add(
        e.source.startsWith('@')
          ? e.source.split('/').slice(0, 2).join('/')
          : e.source.split('/')[0]!,
      );
    }
    for (const pkg of ['@draven/viz', 'react', 'react-dom', 'recharts', 'react-is']) {
      expect(names.has(pkg), `${pkg} appears in the report`).toBe(true);
    }
    const realDirs = (pkg: string): Set<string> =>
      new Set(
        report.entries
          .filter((e) => e.source === pkg || e.source.startsWith(`${pkg}/`))
          .map((e) => e.real.replace(new RegExp(`(node_modules\\${sep}${pkg}\\${sep}).*$`), '$1')),
      );
    expect(realDirs('react').size).toBe(1);
    expect(realDirs('react-is').size).toBe(1);
  });

  test('the installed @draven/viz is the tarball: version and file hashes', () => {
    const installed = join(STAGE, 'node_modules', '@draven', 'viz');
    const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(pkg.version).toBe('0.1.0');
    const tmp = mkdtempSync(join(tmpdir(), 'dv-tgz-'));
    execFileSync('tar', ['-xzf', TGZ, '-C', tmp]);
    const unpacked = join(tmp, 'package');
    const hash = (f: string): string => createHash('sha256').update(readFileSync(f)).digest('hex');
    const want = walk(unpacked).map((f) => f.slice(unpacked.length + 1));
    expect(want.length).toBeGreaterThan(10);
    for (const rel of want) {
      expect(existsSync(join(installed, rel)), rel).toBe(true);
      expect(hash(join(installed, rel)), rel).toBe(hash(join(unpacked, rel)));
    }
    const have = walk(realpathSync(installed)).map((f) =>
      f.slice(realpathSync(installed).length + 1),
    );
    expect(have.sort()).toEqual(want.sort());
  });

  test('installed.json records one react, react-dom and react-is of the same major.minor', () => {
    const doc = JSON.parse(readFileSync(join(STAGE, 'installed.json'), 'utf8')) as {
      installed: unknown;
    };
    const found: Record<string, Set<string>> = {};
    const visit = (deps: unknown): void => {
      for (const [name, node] of Object.entries((deps ?? {}) as Record<string, unknown>)) {
        const n = node as { version?: string; path?: string; dependencies?: unknown };
        if (['react', 'react-dom', 'react-is'].includes(name) && n.path !== undefined) {
          (found[name] ??= new Set()).add(n.path);
          (found[`${name}@v`] ??= new Set()).add(n.version ?? '');
        }
        visit(n.dependencies);
      }
    };
    for (const root of doc.installed as { dependencies?: unknown }[]) visit(root.dependencies);
    for (const name of ['react', 'react-dom', 'react-is']) {
      expect([...(found[name] ?? [])].length, `${name} real paths`).toBe(1);
      expect([...(found[`${name}@v`] ?? [])].length, `${name} versions`).toBe(1);
    }
    const mm = ['react', 'react-dom', 'react-is'].map((n) =>
      [...(found[`${n}@v`] as Set<string>)][0]!.split('.').slice(0, 2).join('.'),
    );
    expect(new Set(mm).size).toBe(1);
  });
});

describe('pnpm stage html', () => {
  test('holds the example files and the manifest assets with matching sha256', () => {
    const dir = join(ROOT, '.stage', 'html');
    const manifest = JSON.parse(
      readFileSync(join(ROOT, 'dist/asset-manifest.json'), 'utf8'),
    ) as { files: { path: string; sha256: string }[] };
    for (const f of ['basic.html', 'host-isolation.html', 'charts.json']) {
      expect(existsSync(join(dir, f)), f).toBe(true);
      expect(lstatSync(join(dir, f)).isSymbolicLink(), f).toBe(false);
    }
    expect(manifest.files.length).toBeGreaterThan(5);
    for (const f of manifest.files) {
      const file = join(dir, f.path);
      expect(existsSync(file), f.path).toBe(true);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex'), f.path).toBe(f.sha256);
    }
    expect(existsSync(join(dir, 'dravenviz.browser.js'))).toBe(true);
  });
});
