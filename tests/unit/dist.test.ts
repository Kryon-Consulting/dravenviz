import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

// These tests inspect build output: run `pnpm build && pnpm pack:local` first.
const ROOT = process.cwd();
const dist = (p: string): string => join(ROOT, 'dist', p);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

interface ManifestFile {
  path: string;
  source: string;
  sha256: string;
  bytes: number;
  role: string;
}
interface Manifest {
  manifestVersion: number;
  package: string;
  version: string;
  files: ManifestFile[];
}

const manifest = (): Manifest =>
  JSON.parse(readFileSync(dist('asset-manifest.json'), 'utf8')) as Manifest;

describe('declarations', () => {
  test('exist for the three entries', () => {
    for (const entry of ['core', 'react', 'print']) {
      expect(existsSync(dist(`${entry}/index.d.ts`)), entry).toBe(true);
      expect(existsSync(dist(`${entry}/index.js`)), entry).toBe(true);
    }
  });

  test('mention no recharts', () => {
    const dts = walk(dist('')).filter((f) => f.endsWith('.d.ts'));
    expect(dts.length).toBeGreaterThan(0);
    for (const f of dts) expect(readFileSync(f, 'utf8'), f).not.toMatch(/recharts/i);
  });
});

describe('authored code', () => {
  test('compiled library modules contain no eval, new Function or innerHTML', () => {
    // The IIFE browser bundle is not scanned: ReactDOM legitimately has an innerHTML code path.
    const js = ['core', 'react', 'print']
      .flatMap((d) => walk(dist(d)))
      .concat(
        readdirSync(dist(''))
          .filter((f) => /^chunk-.*\.js$/.test(f))
          .map((f) => dist(f)),
      )
      .filter((f) => f.endsWith('.js'));
    expect(js.length).toBeGreaterThan(3);
    for (const f of js) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /\beval\(|new Function\(|innerHTML|dangerouslySetInnerHTML/,
      );
    }
  });
});

describe('asset manifest', () => {
  test('has the section 13 shape', () => {
    const m = manifest();
    expect(m.manifestVersion).toBe(1);
    expect(m.package).toBe('@draven/viz');
    expect(m.version).toBe('0.1.0');
    const paths = m.files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'dravenviz.browser.js',
        'dravenviz.css',
        'fonts/NotoSans-Regular.woff2',
        'fonts/NotoSans-SemiBold.woff2',
        'fonts/noto-sans.css',
        'fonts/OFL.txt',
        'schema/viz-spec-v1.schema.json',
      ]),
    );
    expect(m.files.find((f) => f.path === 'dravenviz.browser.js')?.role).toBe('script');
    expect(m.files.find((f) => f.path === 'fonts/OFL.txt')?.role).toBe('license');
    expect(m.files.find((f) => f.path === 'fonts/NotoSans-Regular.woff2')?.role).toBe('font');
  });

  test('every entry exists with a matching sha256 and size', () => {
    for (const f of manifest().files) {
      const file = join(ROOT, f.source);
      expect(existsSync(file), f.source).toBe(true);
      const bytes = readFileSync(file);
      expect(createHash('sha256').update(bytes).digest('hex'), f.source).toBe(f.sha256);
      expect(bytes.length, f.source).toBe(f.bytes);
    }
  });

  test('the browser bundle assigns window.DravenViz and keeps the page React untouched', () => {
    const src = readFileSync(dist('dravenviz.browser.js'), 'utf8');
    expect(src).toMatch(/DravenViz/);
    expect(src).not.toMatch(/window\.React\b|window\.ReactDOM\b|globalThis\.React\b/);
  });
});

describe('packed tarball', () => {
  const tgz = join(ROOT, '.pack', 'draven-viz-0.1.0.tgz');
  const list = (): string[] =>
    execFileSync('tar', ['-tzf', tgz], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map((p) => p.replace(/^package\//, ''));

  test('includes the shipped files', () => {
    const files = list();
    for (const needle of [
      'dist/core/index.js',
      'dist/core/index.d.ts',
      'dist/react/index.js',
      'dist/print/index.js',
      'dist/dravenviz.browser.js',
      'dist/dravenviz.css',
      'dist/asset-manifest.json',
      'schema/viz-spec-v1.schema.json',
      'assets/fonts/NotoSans-Regular.woff2',
      'README.md',
      'CHANGELOG.md',
      'THIRD_PARTY_NOTICES.md',
      'package.json',
    ]) {
      expect(files, needle).toContain(needle);
    }
  });

  test('excludes docs, spikes, tests, fixtures, examples, scripts and tooling', () => {
    const files = list();
    for (const banned of [
      'docs/',
      'spikes/',
      'tests/',
      'fixtures/',
      'examples/',
      'scripts/',
      '.superpowers/',
      '.stage/',
      'src/',
    ]) {
      expect(
        files.filter((f) => f.startsWith(banned)),
        banned,
      ).toEqual([]);
    }
  });

  test('has a matching .sha256 file', () => {
    const recorded = readFileSync(`${tgz}.sha256`, 'utf8').trim().split(/\s+/)[0];
    expect(recorded).toBe(createHash('sha256').update(readFileSync(tgz)).digest('hex'));
    expect(statSync(tgz).size).toBeGreaterThan(1000);
    expect(relative(ROOT, tgz)).toBe('.pack/draven-viz-0.1.0.tgz');
  });
});
