import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  watch,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIXTURES, specHash } from '../fixtures/index';
import { ROOT, isMain } from './gen-lib';

/**
 * `pnpm stage <docs|react|html> [--watch]` (design section 16.1). Copies a consumer template into
 * `.stage/<name>` as ordinary files (no symlinks), installs its third-party dependencies from the
 * template's lockfile, adds the packed tarball, and proves what the application resolves.
 */
const TEMPLATES = {
  docs: 'docs/site',
  react: 'examples/react',
  html: 'examples/html',
} as const;
type Name = keyof typeof TEMPLATES;

/** Template entries that are copied (files or directories). */
const COPIED = ['package.json', 'pnpm-lock.yaml', 'index.html', 'vite.config.ts', 'src', 'public'];
const REPORT_PLUGIN = 'scripts/vite-resolution-report.ts';
const WATCHED_PACKAGES = ['@draven/viz', 'react', 'react-dom', 'react-is', 'recharts'];

const run = (cmd: string, args: string[], cwd: string, capture = false): string => {
  const out = execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 256 * 1024 * 1024,
  });
  return out ?? '';
};

const sha256 = (file: string): string =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

function fail(message: string): never {
  throw new Error(`stage: ${message}`);
}

function copyTemplate(templateDir: string, stageDir: string): void {
  for (const entry of COPIED) {
    const from = path.join(templateDir, entry);
    if (!existsSync(from)) continue;
    // dereference: a symlinked source must become a real file, so Vite resolves from the stage.
    cpSync(from, path.join(stageDir, entry), { recursive: true, dereference: true });
  }
  const plugin = path.join(ROOT, REPORT_PLUGIN);
  if (existsSync(path.join(templateDir, 'vite.config.ts'))) {
    cpSync(plugin, path.join(stageDir, path.basename(REPORT_PLUGIN)), { dereference: true });
  }
}

function findTarball(): { file: string; sha256: string; version: string } {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
  };
  const file = path.join(
    ROOT,
    '.pack',
    `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`,
  );
  if (!existsSync(file))
    fail(`${path.relative(ROOT, file)} is missing; run pnpm pack:local first.`);
  const recorded = readFileSync(`${file}.sha256`, 'utf8').trim().split(/\s+/)[0];
  const actual = sha256(file);
  if (recorded !== actual) fail(`${path.basename(file)} does not match its .sha256 file.`);
  return { file, sha256: actual, version: pkg.version };
}

const majorMinor = (v: string): string => v.split('.').slice(0, 2).join('.');

function readPkgVersion(dir: string): string {
  return (JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version: string })
    .version;
}

/** The installed @draven/viz must be the tarball: same version, same bytes for every file. */
function checkInstalled(stageDir: string, tarball: ReturnType<typeof findTarball>): void {
  const installed = realpathSync(path.join(stageDir, 'node_modules', '@draven', 'viz'));
  if (readPkgVersion(installed) !== tarball.version) {
    fail(`@draven/viz in the stage is not version ${tarball.version}.`);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'dv-stage-tgz-'));
  try {
    run('tar', ['-xzf', tarball.file, '-C', tmp], ROOT);
    const unpacked = path.join(tmp, 'package');
    const want = walk(unpacked).map((f) => path.relative(unpacked, f));
    const have = walk(installed).map((f) => path.relative(installed, f));
    if (JSON.stringify([...want].sort()) !== JSON.stringify([...have].sort())) {
      fail('the installed @draven/viz file list differs from the tarball.');
    }
    for (const rel of want) {
      if (sha256(path.join(unpacked, rel)) !== sha256(path.join(installed, rel))) {
        fail(`installed @draven/viz/${rel} differs from the tarball.`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  for (const pkg of ['react', 'react-dom', 'react-is']) {
    const dir = path.join(stageDir, 'node_modules', pkg);
    if (!existsSync(dir)) fail(`${pkg} is not installed in the stage.`);
  }
  const versions = ['react', 'react-dom', 'react-is'].map((p) =>
    majorMinor(readPkgVersion(path.join(stageDir, 'node_modules', p))),
  );
  if (new Set(versions).size !== 1) {
    fail(`react, react-dom and react-is differ in major.minor (${versions.join(', ')}).`);
  }
}

interface ReportEntry {
  source: string;
  real: string;
}

const pkgNameOf = (source: string): string =>
  source.startsWith('@') ? source.split('/').slice(0, 2).join('/') : (source.split('/')[0] ?? '');

/** The package directory of a real path: everything up to `node_modules/<name>`. */
function packageDirOf(real: string, name: string): string {
  const marker = `node_modules${path.sep}${name}${path.sep}`;
  const at = real.lastIndexOf(marker);
  return at === -1 ? real : real.slice(0, at + marker.length - 1);
}

/** Fails unless every watched import resolved inside the stage and react/react-is are single. */
export function checkResolution(stageDir: string): void {
  const file = path.join(stageDir, 'resolution.json');
  if (!existsSync(file))
    fail('vite build wrote no resolution.json (is dv-resolution-report registered?).');
  const report = JSON.parse(readFileSync(file, 'utf8')) as { entries: ReportEntry[] };
  const modules = realpathSync(path.join(stageDir, 'node_modules')) + path.sep;
  const dirs = new Map<string, Set<string>>();
  for (const e of report.entries) {
    const name = pkgNameOf(e.source);
    if (!WATCHED_PACKAGES.includes(name)) continue;
    if (!e.real.startsWith(modules)) {
      fail(`"${e.source}" resolved outside ${path.relative(ROOT, modules)}: ${e.real}`);
    }
    const set = dirs.get(name) ?? new Set<string>();
    set.add(packageDirOf(e.real, name));
    dirs.set(name, set);
  }
  for (const name of WATCHED_PACKAGES) {
    if (!dirs.has(name)) fail(`${name} does not appear in the resolution report.`);
  }
  for (const name of ['react', 'react-is']) {
    const set = dirs.get(name) as Set<string>;
    if (set.size > 1) fail(`${name} resolves to more than one real path: ${[...set].join(', ')}`);
  }
}

/**
 * Static templates (no package.json): copies the template's pages and data, then every manifest
 * asset from the EXTRACTED TARBALL to its manifest `path`. Fails on an empty stage or a missing
 * or mismatching file.
 */
function stageStatic(
  templateDir: string,
  stageDir: string,
  tarball: ReturnType<typeof findTarball>,
): void {
  for (const name of readdirSync(templateDir)) {
    if (/\.(html|js|json)$/.test(name) || name === 'README.md') {
      cpSync(path.join(templateDir, name), path.join(stageDir, name), { dereference: true });
    }
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'dv-stage-tgz-'));
  try {
    run('tar', ['-xzf', tarball.file, '-C', tmp], ROOT);
    const pkg = path.join(tmp, 'package');
    const manifestFile = path.join(pkg, 'dist', 'asset-manifest.json');
    if (!existsSync(manifestFile)) fail('the tarball has no dist/asset-manifest.json.');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as {
      files: { path: string; source: string; sha256: string }[];
    };
    if (manifest.files.length === 0) fail('the asset manifest lists no files.');
    for (const f of manifest.files) {
      const from = path.join(pkg, f.source);
      if (!existsSync(from)) fail(`manifest file ${f.source} is missing from the tarball.`);
      if (sha256(from) !== f.sha256) fail(`manifest file ${f.source} does not match its sha256.`);
      const to = path.join(stageDir, f.path);
      mkdirSync(path.dirname(to), { recursive: true });
      cpSync(from, to);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (!existsSync(path.join(stageDir, 'dravenviz.browser.js'))) fail('the static stage is empty.');
  if (walk(stageDir).length < 5) fail('the static stage holds too few files.');
}

/** Docs-only inputs, copied into the stage so the site reads nothing from the repository at build time. */
const DOCS_EXAMPLES: Record<string, string> = {
  'react-main.tsx': 'examples/react/src/main.tsx',
  'html-basic.html': 'examples/html/basic.html',
  'html-basic.js': 'examples/html/basic.js',
  'dravenpdf-README.md': 'examples/dravenpdf/README.md',
};

/**
 * `stage docs` extras (design section 14): fixture JSON and an index (with canonical spec hashes)
 * under `public/fixtures/`, the font files and licence from the INSTALLED tarball under
 * `public/fonts/`, the sample PDF evidence under `public/evidence/pdf/`, and the example sources
 * under `src/examples/` for `?raw` imports. Runs after the tarball is installed, before the build.
 */
function prepareDocs(stageDir: string): void {
  const pub = path.join(stageDir, 'public');
  const fixturesDir = path.join(pub, 'fixtures');
  mkdirSync(fixturesDir, { recursive: true });
  const fileHashes = new Map<string, string>();
  const index = FIXTURES.filter((f) => f.gallery || f.id.startsWith('min-')).map((f) => {
    const text = readFileSync(path.join(ROOT, f.file), 'utf8');
    writeFileSync(path.join(fixturesDir, `${f.id}.json`), text);
    fileHashes.set(f.id, createHash('sha256').update(text).digest('hex'));
    return {
      id: f.id,
      family: f.family,
      slice: f.slice,
      gallery: f.gallery,
      specHash: specHash(JSON.parse(text)),
    };
  });
  writeFileSync(path.join(fixturesDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

  const installedFonts = path.join(stageDir, 'node_modules', '@draven', 'viz', 'assets', 'fonts');
  const fontsDir = path.join(pub, 'fonts');
  mkdirSync(fontsDir, { recursive: true });
  for (const file of ['NotoSans-Regular.woff2', 'NotoSans-SemiBold.woff2', 'OFL.txt']) {
    const from = path.join(installedFonts, file);
    if (!existsSync(from)) fail(`the installed package has no assets/fonts/${file}.`);
    cpSync(from, path.join(fontsDir, file));
  }

  const pdfDir = path.join(pub, 'evidence', 'pdf');
  mkdirSync(pdfDir, { recursive: true });
  for (const file of ['report-slice1.pdf', 'report-slice1.json']) {
    const from = path.join(ROOT, 'evidence', 'pdf', file);
    if (!existsSync(from)) fail(`evidence/pdf/${file} is missing; run pnpm test:pdf first.`);
    cpSync(from, path.join(pdfDir, file));
  }
  // The PDF records the SHA-256 of each fixture file it drew. Stale evidence must not be linked.
  const report = JSON.parse(readFileSync(path.join(pdfDir, 'report-slice1.json'), 'utf8')) as {
    instances: { fixture: string; specSha256: string }[];
  };
  for (const inst of report.instances) {
    if (fileHashes.get(inst.fixture) !== inst.specSha256) {
      fail(
        `evidence/pdf/report-slice1.json is stale for fixture ${inst.fixture}; run pnpm test:pdf.`,
      );
    }
  }

  const examplesDir = path.join(stageDir, 'src', 'examples');
  mkdirSync(examplesDir, { recursive: true });
  for (const [to, from] of Object.entries(DOCS_EXAMPLES)) {
    cpSync(path.join(ROOT, from), path.join(examplesDir, to));
  }
}

export function stage(name: Name): string {
  const templateDir = path.join(ROOT, TEMPLATES[name]);
  if (!existsSync(templateDir)) fail(`template ${TEMPLATES[name]} does not exist yet.`);
  const stageDir = path.join(ROOT, '.stage', name);
  const tarball = findTarball();
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  if (!existsSync(path.join(templateDir, 'package.json'))) {
    stageStatic(templateDir, stageDir, tarball);
    console.log(`stage ${name}: ok, static (${path.relative(ROOT, stageDir)})`);
    return stageDir;
  }
  copyTemplate(templateDir, stageDir);
  run('pnpm', ['install', '--frozen-lockfile', '--ignore-workspace'], stageDir);
  run('pnpm', ['add', '--ignore-workspace', tarball.file], stageDir);
  const listing = run(
    'pnpm',
    ['ls', '--depth', 'Infinity', '--json', '--ignore-workspace'],
    stageDir,
    true,
  );
  const installed = JSON.parse(listing) as unknown;
  writeFileSync(
    path.join(stageDir, 'installed.json'),
    `${JSON.stringify({ tarball: { file: path.basename(tarball.file), sha256: tarball.sha256 }, installed }, null, 2)}\n`,
  );
  checkInstalled(stageDir, tarball);
  if (name === 'docs') prepareDocs(stageDir);
  const pkg = JSON.parse(readFileSync(path.join(stageDir, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  if (pkg.scripts?.['build'] !== undefined) {
    run('pnpm', ['run', 'build'], stageDir);
    checkResolution(stageDir);
  }
  console.log(`stage ${name}: ok (${path.relative(ROOT, stageDir)})`);
  return stageDir;
}

/** Mirrors template changes into the stage by copying, so Vite HMR sees ordinary files. */
function mirror(name: Name, stageDir: string): void {
  const templateDir = path.join(ROOT, TEMPLATES[name]);
  const copyOne = (rel: string): void => {
    const top = rel.split(path.sep)[0] ?? '';
    if (!COPIED.includes(top)) return;
    const from = path.join(templateDir, rel);
    const to = path.join(stageDir, rel);
    if (!existsSync(from)) {
      rmSync(to, { recursive: true, force: true });
      return;
    }
    if (lstatSync(from).isDirectory()) return;
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to, { dereference: true });
  };
  watch(templateDir, { recursive: true }, (_event, rel) => {
    if (rel !== null) copyOne(rel);
  });
  console.log(`stage ${name}: watching ${TEMPLATES[name]} (Ctrl-C to stop)`);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const name = args.find((a) => !a.startsWith('--'));
  if (name === undefined || !(name in TEMPLATES)) {
    console.error('usage: stage-consumer.ts <docs|react|html> [--watch]');
    process.exit(2);
  }
  const stageDir = stage(name as Name);
  if (args.includes('--watch')) mirror(name as Name, stageDir);
}
