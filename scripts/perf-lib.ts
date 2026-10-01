import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { ROOT } from './gen-lib';

/** Shared by `measure-size.ts` and `measure-latency.ts` (design section 18). */
export const TARBALL = path.join(ROOT, '.pack', 'draven-viz-0.1.0.tgz');
export const EVIDENCE = path.join(ROOT, 'evidence', 'perf');
export const WARMUP = 5;
export const SAMPLES = 30;

/** Nearest-rank percentile: the value at rank ceil(p/100 * n) of the sorted samples. */
export function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1] as number;
}

export const round = (n: number, digits = 1): number => Number(n.toFixed(digits));

/** The extracted tarball (a consumer's view of the package) in a fresh temp directory. */
export function extractTarball(): { dir: string; pkg: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dv-perf-'));
  execFileSync('tar', ['-xzf', TARBALL, '-C', dir]);
  return {
    dir,
    pkg: path.join(dir, 'package'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

interface Manifest {
  files: { path: string; source: string; sha256: string; bytes: number; role: string }[];
}

export function readManifest(pkg: string): Manifest {
  return JSON.parse(readFileSync(path.join(pkg, 'dist/asset-manifest.json'), 'utf8')) as Manifest;
}

export interface PerfSite {
  origin: string;
  close: () => Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
};

/**
 * Serves what a consumer copies from the tarball (the manifest files at their `path`), plus
 * `perf.html` and the fixture as `perf-spec.json`. No cache, so every fresh load fetches everything.
 */
export async function serveSite(pkg: string, spec: unknown): Promise<PerfSite> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dv-perf-site-'));
  for (const f of readManifest(pkg).files) {
    mkdirSync(path.dirname(path.join(dir, f.path)), { recursive: true });
    copyFileSync(path.join(pkg, f.source), path.join(dir, f.path));
  }
  copyFileSync(path.join(ROOT, 'tests/harness/perf.html'), path.join(dir, 'perf.html'));
  const files = new Map<string, Buffer>();
  const add = (rel: string, body: Buffer): void => void files.set(`/${rel}`, body);
  for (const f of readManifest(pkg).files) add(f.path, readFileSync(path.join(dir, f.path)));
  add('perf.html', readFileSync(path.join(dir, 'perf.html')));
  add('perf-spec.json', Buffer.from(JSON.stringify(spec)));
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const body = files.get(url.pathname);
    if (!body) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', TYPES[path.extname(url.pathname)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      await new Promise<void>((r) => server.close(() => r()));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function launchChromium(): Promise<Browser> {
  const executablePath = process.env['PW_CHROMIUM_PATH'];
  return chromium.launch(executablePath ? { executablePath } : {});
}

const pkgVersion = (name: string): string =>
  (JSON.parse(readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version; // prettier-ignore

function osName(): string {
  try {
    const m = /^PRETTY_NAME="?([^"\n]+)"?/m.exec(readFileSync('/etc/os-release', 'utf8'));
    if (m) return `${m[1]} (kernel ${os.release()})`;
  } catch {
    // fall through
  }
  return `${os.type()} ${os.release()}`;
}

export function machine(chromiumVersion: string): Record<string, unknown> {
  const fontDir = path.join(ROOT, 'assets/fonts');
  return {
    cpu: os.cpus()[0]?.model ?? 'unknown',
    cores: os.cpus().length,
    ramBytes: os.totalmem(),
    os: osName(),
    node: process.version,
    chromium: chromiumVersion,
    recharts: pkgVersion('recharts'),
    react: pkgVersion('react'),
    reactDom: pkgVersion('react-dom'),
    fontDir: path.relative(ROOT, fontDir),
  };
}
