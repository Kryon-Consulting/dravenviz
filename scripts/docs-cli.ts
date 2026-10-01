import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain } from './gen-lib';

/**
 * `pnpm dev:docs | preview:docs | test:docs` (design section 14). The docs site is a consumer
 * template: it is staged from the packed tarball by `pnpm stage docs`, which also builds it into
 * `.stage/docs/dist`. `preview` and `test` rebuild first (`pnpm build:docs`), then serve it:
 *
 * - `dev`:     mirrors template changes into the stage and starts the Vite dev server there.
 * - `preview`: serves `.stage/docs/dist` and prints the actual URL (the port is the first free one).
 * - `test`:    starts `preview`, parses the URL from its stdout and runs `tests/docs` against it.
 */
const STAGE = path.join(ROOT, '.stage', 'docs');
const DIST = path.join(STAGE, 'dist');
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const URL_LINE = /Local:\s+(http:\/\/[^\s]+)/;

const pnpm = (args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): ChildProcess =>
  spawn('pnpm', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

/** Forwards the child's stdout and resolves with the first `Local: <url>` line. */
function waitForUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let seen = false;
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      process.stdout.write(chunk);
      if (seen) return;
      const m = URL_LINE.exec(chunk.replace(ANSI, ''));
      if (m?.[1] !== undefined) {
        seen = true;
        resolve(m[1]);
      }
    });
    child.on('exit', (code) => {
      if (!seen)
        reject(new Error(`the server exited (code ${String(code)}) before printing a URL`));
    });
  });
}

const run = (cmd: string, args: string[]): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code ?? 1));
  });

/**
 * Design section 16.1: preview and test depend on `stage docs`, which depends on `pack:local`.
 * Always run the whole chain, so a served bundle can never be older than the sources or the library.
 */
async function rebuild(): Promise<void> {
  const code = await run('pnpm', ['build:docs']);
  if (code !== 0 || !existsSync(DIST)) {
    console.error('docs: build:docs failed; not serving a stale build.');
    process.exit(code === 0 ? 1 : code);
  }
}

const startPreview = (): ChildProcess =>
  pnpm(['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4174'], STAGE, {
    FORCE_COLOR: '0',
  });

async function preview(): Promise<void> {
  await rebuild();
  const child = startPreview();
  const url = await waitForUrl(child);
  console.log(`docs preview: ${url}`);
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function dev(): Promise<void> {
  const stager = spawn('pnpm', ['exec', 'tsx', 'scripts/stage-consumer.ts', 'docs', '--watch'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    stager.stdout?.setEncoding('utf8');
    stager.stdout?.on('data', (chunk: string) => {
      process.stdout.write(chunk);
      if (chunk.includes('watching')) resolve();
    });
    stager.on('exit', (code) => reject(new Error(`stage exited with ${String(code)}`)));
  });
  const server = pnpm(['exec', 'vite', '--host', '127.0.0.1'], STAGE, { FORCE_COLOR: '0' });
  const url = await waitForUrl(server);
  console.log(`docs dev server: ${url}`);
  const stop = (): void => {
    stager.kill();
    server.kill();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function test(extra: string[]): Promise<void> {
  await rebuild();
  const server = startPreview();
  let code = 1;
  try {
    // The tests read the URL from this variable; the port is whatever Vite found free.
    process.env['DOCS_URL'] = await waitForUrl(server);
    code = await run('pnpm', [
      'exec',
      'playwright',
      'test',
      '-c',
      'tests/docs/playwright.config.ts',
      ...extra,
    ]);
  } catch (e) {
    console.error(e);
  } finally {
    server.kill();
  }
  process.exit(code);
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const jobs: Record<string, () => Promise<void>> = {
    dev,
    preview,
    test: () => test(rest),
  };
  const job = mode === undefined ? undefined : jobs[mode];
  if (job === undefined) {
    console.error('usage: docs-cli.ts <dev|preview|test>');
    process.exit(2);
  }
  job().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
