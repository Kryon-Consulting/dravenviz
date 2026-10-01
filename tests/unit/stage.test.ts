import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { checkResolution } from '../../scripts/stage-consumer';

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
  execFileSync('pnpm', ['stage', 'react'], { cwd: ROOT, stdio: 'pipe', timeout: INSTALL_TIMEOUT });
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
    const installed = JSON.parse(readFileSync(join(STAGE, 'installed.json'), 'utf8')) as unknown;
    expect(JSON.stringify(installed)).toContain('"@draven/viz"');
  });
});

describe('checkResolution', () => {
  const fake = (entries: { source: string; real: string }[]): string => {
    const dir = mkdtempSync(join(tmpdir(), 'dv-fake-stage-'));
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'resolution.json'), JSON.stringify({ entries }));
    return dir;
  };

  test('rejects a watched package resolved outside the stage node_modules', () => {
    const dir = fake([{ source: 'react', real: '/repo/node_modules/react/index.js' }]);
    expect(() => checkResolution(dir)).toThrow(/outside/);
  });

  test('rejects react resolving to two real paths inside the stage', () => {
    const root = mkdtempSync(join(tmpdir(), 'dv-fake-stage-'));
    mkdirSync(join(root, 'node_modules'));
    const nm = join(realpathSync(root), 'node_modules');
    writeFileSync(
      join(root, 'resolution.json'),
      JSON.stringify({
        entries: [
          { source: 'react', real: join(nm, 'a', 'node_modules', 'react', 'index.js') },
          {
            source: 'react/jsx-runtime',
            real: join(nm, 'b', 'node_modules', 'react', 'jsx-runtime.js'),
          },
          { source: 'react-is', real: join(nm, 'react-is', 'index.js') },
        ],
      }),
    );
    expect(() => checkResolution(root)).toThrow(/more than one real path/);
  });
});
