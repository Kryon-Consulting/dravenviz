import { execFileSync, spawnSync } from 'node:child_process';
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
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { checkResolution } from '../../scripts/stage-consumer';
import { ROOT } from '../../scripts/gen-lib';

/**
 * `pnpm test:package` (design section 16.1): clean consumers of the packed tarball. Each consumer is
 * copied to `os.tmpdir()/dravenviz-consumer-*` (outside the repository) and gets the library with a
 * plain `npm install <tarball>`. Needs `pnpm pack:local` first (the package script runs it) and
 * registry access.
 */
const TARBALL = path.join(ROOT, '.pack', 'draven-viz-0.1.0.tgz');
const INSTALL_TIMEOUT = 600_000;
const LOADED = 'DV_LOAD ';

interface Consumer {
  name: 'react18' | 'react19' | 'core';
  /** Pinned packages installed together with the tarball. */
  deps: string[];
  react?: string;
}

const REACT_DEPS = (v: string): string[] => [
  `react@${v}`,
  `react-dom@${v}`,
  `react-is@${v}`,
  'vite@8.3.1',
];
const CONSUMERS: Consumer[] = [
  { name: 'core', deps: [] },
  { name: 'react18', deps: REACT_DEPS('18.3.1'), react: '18.3.1' },
  { name: 'react19', deps: REACT_DEPS('19.3.0'), react: '19.3.0' },
];

let failures = 0;
const created: string[] = [];

async function check(label: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ok    ${label}`);
  } catch (e) {
    failures += 1;
    console.log(
      `  FAIL  ${label}\n        ${(e instanceof Error ? e.message : String(e)).replace(/\n/g, '\n        ')}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Runs a command quietly; its output is shown only when it fails. */
function sh(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): string {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: INSTALL_TIMEOUT,
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, ...env },
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    throw new Error(
      `${cmd} ${args.join(' ')} failed\n${err.stdout ?? ''}${err.stderr ?? err.message}`,
      { cause: e },
    );
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

/** Every directory anywhere under node_modules/ that is the package `name` (one per physical copy). */
function copiesOf(nodeModules: string, name: string): string[] {
  const found: string[] = [];
  const visit = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const full = path.join(dir, e.name);
      if (e.name === name && path.basename(dir) === 'node_modules') found.push(full);
      if (e.name === 'node_modules' || e.name.startsWith('@')) visit(full);
      else if (existsSync(path.join(full, 'node_modules'))) visit(path.join(full, 'node_modules'));
    }
  };
  visit(nodeModules);
  return found;
}

const versionOf = (dir: string): string =>
  (JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version: string }).version;
const majorMinor = (v: string): string => v.split('.').slice(0, 2).join('.');

function extractTarball(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dravenviz-package-'));
  created.push(dir);
  sh('tar', ['-xzf', TARBALL, '-C', dir], ROOT);
  return path.join(dir, 'package');
}

function prepare(c: Consumer): string {
  const dir = mkdtempSync(path.join(tmpdir(), `dravenviz-consumer-${c.name}-`));
  created.push(dir);
  cpSync(path.join(ROOT, 'tests', 'consumers', c.name), dir, {
    recursive: true,
    dereference: true,
  });
  // The fixtures are the repository's own files, so the consumers cannot drift from them.
  const fixtures = path.join(dir, 'fixtures');
  mkdirSync(fixtures);
  cpSync(path.join(ROOT, 'fixtures/valid/min-line.json'), path.join(fixtures, 'min-line.json'));
  cpSync(
    path.join(ROOT, 'fixtures/invalid/invalid-unknown-field.json'),
    path.join(fixtures, 'invalid-unknown-field.json'),
  );
  sh('npm', ['install', '--no-audit', '--no-fund', '--no-progress', TARBALL, ...c.deps], dir);
  return dir;
}

function checkInstall(c: Consumer, dir: string): Promise<void> {
  return check(`${c.name}: @draven/viz is a real directory with no symlinks`, () => {
    const viz = path.join(dir, 'node_modules', '@draven', 'viz');
    assert(
      lstatSync(viz).isDirectory() && !lstatSync(viz).isSymbolicLink(),
      `${viz} is not a real directory`,
    );
    for (const entry of [viz, ...walk(viz)]) {
      assert(!lstatSync(entry).isSymbolicLink(), `symlink inside the package: ${entry}`);
    }
    assert(versionOf(viz) === '0.1.0', `@draven/viz is ${versionOf(viz)}, not 0.1.0`);
  });
}

async function checkReactTree(c: Consumer, dir: string): Promise<void> {
  const nm = path.join(dir, 'node_modules');
  await check(
    `${c.name}: react, react-dom, react-is pinned, same major.minor, one copy each`,
    () => {
      const v = (p: string): string => versionOf(path.join(nm, p));
      assert(v('react') === c.react, `react is ${v('react')}, wanted ${c.react}`);
      assert(v('react-dom') === c.react, `react-dom is ${v('react-dom')}, wanted ${c.react}`);
      assert(
        majorMinor(v('react-is')) === majorMinor(v('react')),
        `react-is ${v('react-is')} vs react ${v('react')}`,
      );
      const ls = JSON.parse(
        (() => {
          try {
            return sh('npm', ['ls', 'react', 'react-is', '--all', '--json'], dir);
          } catch (e) {
            throw new Error(`npm ls reports a problem: ${(e as Error).message}`, { cause: e });
          }
        })(),
      ) as { problems?: string[]; dependencies?: Record<string, unknown> };
      assert(ls.problems === undefined, `npm ls problems: ${JSON.stringify(ls.problems)}`);
      const versions: Record<string, Set<string>> = { react: new Set(), 'react-is': new Set() };
      const visit = (deps: Record<string, unknown> | undefined): void => {
        for (const [name, node] of Object.entries(deps ?? {})) {
          const n = node as { version?: string; dependencies?: Record<string, unknown> };
          if (versions[name] !== undefined && n.version !== undefined)
            versions[name].add(n.version);
          visit(n.dependencies);
        }
      };
      visit(ls.dependencies);
      for (const name of ['react', 'react-is']) {
        assert(
          versions[name]?.size === 1,
          `npm ls lists ${name} at ${[...(versions[name] ?? [])].join(', ')}`,
        );
        const copies = copiesOf(nm, name);
        assert(
          copies.length === 1,
          `${name} has ${copies.length} copies on disk: ${copies.join(', ')}`,
        );
      }
    },
  );
  await check(`${c.name}: recharts resolves the same react-is as the application`, () => {
    const top = createRequire(path.join(dir, 'package.json')).resolve('react-is');
    const rechartsRoot = realpathSync(path.join(nm, 'recharts'));
    const inner = createRequire(path.join(rechartsRoot, 'package.json')).resolve('react-is');
    assert(
      realpathSync(top) === realpathSync(inner),
      `recharts resolves ${inner}, the application ${top}`,
    );
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

function serve(root: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(
      /^\/+/,
      '',
    );
    const file = path.join(root, rel === '' ? 'index.html' : rel);
    if (!file.startsWith(root + path.sep) || !existsSync(file) || !lstatSync(file).isFile()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }),
    ),
  );
}

async function checkReactBuildAndRun(c: Consumer, dir: string): Promise<void> {
  await check(`${c.name}: vite build resolves everything from the consumer's node_modules`, () => {
    cpSync(
      path.join(ROOT, 'scripts/vite-resolution-report.ts'),
      path.join(dir, 'vite-resolution-report.ts'),
    );
    // The chart's default font URLs are page-relative `fonts/*`: serve the package's own font files.
    const fonts = path.join(dir, 'node_modules/@draven/viz/assets/fonts');
    cpSync(fonts, path.join(dir, 'public', 'fonts'), { recursive: true });
    sh('npm', ['run', 'build', '--silent'], dir);
    checkResolution(dir);
  });
  await check(`${c.name}: Playwright smoke test (chart ready, onReady called)`, async () => {
    const { server, origin } = await serve(path.join(dir, 'dist'));
    const executablePath = process.env['PW_CHROMIUM_PATH'];
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    try {
      const page = await browser.newPage();
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning')
          problems.push(`console ${m.type()}: ${m.text()}`);
      });
      page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : (problems.push(`foreign request: ${route.request().url()}`), route.abort()),
      );
      await page.goto(origin);
      await page.waitForFunction(
        () => (window as unknown as { __dv: { ready: boolean } }).__dv.ready === true,
        undefined,
        { timeout: 15_000 },
      );
      const state = await page.evaluate(
        () =>
          (
            window as unknown as {
              __dv: { readyCalls: number; info: { chartId: string }; errors: string[] };
            }
          ).__dv,
      );
      assert(state.readyCalls === 1, `onReady was called ${state.readyCalls} times`);
      assert(state.info.chartId === 'min-line', `onReady reported chart ${state.info.chartId}`);
      assert(state.errors.length === 0, `onError: ${state.errors.join('; ')}`);
      // min-line has a null between two values: two isolated points, drawn as markers, no line.
      const svg = page.locator('[data-dravenviz-chart="min-line"] svg');
      const markers = await svg.locator('circle').count();
      assert(markers === 2, `the chart SVG has ${markers} point markers, expected 2`);
      assert(
        (await svg.locator('title').textContent()) === 'Daily total',
        'the SVG title is wrong',
      );
      assert(problems.length === 0, problems.join('\n'));
    } finally {
      await browser.close();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
}

async function checkCore(c: Consumer, dir: string): Promise<void> {
  const trace = pathToFileURL(path.join(ROOT, 'tests/dist/register-trace.mjs')).href;
  const run = spawnSync(process.execPath, ['--import', trace, 'index.mjs'], {
    cwd: dir,
    encoding: 'utf8',
  });
  await check(
    `${c.name}: node index.mjs validates min-line and names the rule and path of an invalid spec`,
    () => {
      const expected = JSON.parse(
        readFileSync(
          path.join(ROOT, 'fixtures/invalid/invalid-unknown-field.expected.json'),
          'utf8',
        ),
      ) as { rule: string; path: string };
      assert(run.status === 0, `index.mjs exited ${run.status}\n${run.stdout}${run.stderr}`);
      const lines = run.stdout.split('\n');
      assert(lines.includes('valid min-line'), `stdout: ${run.stdout}`);
      assert(
        lines.includes(`invalid rule=${expected.rule} path=${expected.path}`),
        `stdout: ${run.stdout}`,
      );
    },
  );
  await check(`${c.name}: the Node loader trace shows neither react nor recharts`, () => {
    const loaded = run.stderr
      .split('\n')
      .filter((l) => l.startsWith(LOADED))
      .map((l) => l.slice(LOADED.length));
    assert(
      loaded.some((u) => u.endsWith('/node_modules/@draven/viz/dist/core/index.js')),
      'the core entry was not loaded from node_modules',
    );
    const heavy = loaded.filter((u) =>
      /\/node_modules\/(?:react|react-dom|react-is|recharts)\/|\/dist\/(?:react|print)\//.test(u),
    );
    assert(heavy.length === 0, `loaded: ${heavy.join(', ')}`);
  });
}

function printResolved(c: Consumer, dir: string): void {
  const nm = path.join(dir, 'node_modules');
  const names = [
    '@draven/viz',
    'recharts',
    ...(c.react ? ['react', 'react-dom', 'react-is', 'vite'] : []),
  ];
  console.log(`  resolved: ${names.map((n) => `${n}@${versionOf(path.join(nm, n))}`).join(' ')}`);
}

async function main(): Promise<void> {
  if (!existsSync(TARBALL))
    throw new Error(`${path.relative(ROOT, TARBALL)} is missing; run pnpm pack:local.`);

  for (const c of CONSUMERS) {
    console.log(`\n${c.name}`);
    const dir = prepare(c);
    await checkInstall(c, dir);
    printResolved(c, dir);
    if (c.react !== undefined) {
      await checkReactTree(c, dir);
      await checkReactBuildAndRun(c, dir);
    } else {
      await checkCore(c, dir);
    }
  }

  console.log('\npackage lint');
  await check('publint passes', () => {
    sh('pnpm', ['exec', 'publint', '--strict', '.'], ROOT);
  });
  // The package is ESM-only by design ("type": "module", `import` conditions only; no CommonJS or
  // node10 resolution is claimed), hence the esm-only profile. `./styles.css` and `./browser` (a
  // classic-script bundle) are assets, not typed modules. Every other entry point is checked in full.
  await check('attw --pack passes (esm-only profile, asset entry points excluded)', () => {
    sh(
      'pnpm',
      [
        'exec',
        'attw',
        '--pack',
        '.',
        '--profile',
        'esm-only',
        '--exclude-entrypoints',
        './styles.css',
        './browser',
      ],
      ROOT,
    );
  });

  console.log('\nplain HTML (tests/browser/html-examples.spec.ts against the extracted tarball)');
  const extracted = extractTarball();
  await check('basic.html, host-isolation.html and the failing-mount page behave', () => {
    sh(
      'pnpm',
      ['exec', 'playwright', 'test', 'tests/browser/html-examples.spec.ts', '--reporter=line'],
      ROOT,
      {
        DV_PACKAGE_ROOT: extracted,
      },
    );
  });
}

try {
  await main();
} catch (e) {
  failures += 1;
  console.error(e instanceof Error ? e.message : e);
}
if (failures === 0) {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
  console.log('\ntest:package: all checks passed');
} else {
  console.error(
    `\ntest:package: ${failures} check(s) failed. Kept for inspection:\n  ${created.join('\n  ')}`,
  );
  process.exit(1);
}
