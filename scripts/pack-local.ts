import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, isMain } from './gen-lib';

/** `pnpm pack --pack-destination .pack` plus `<tarball>.sha256`; returns the tarball path. */
export function packLocal(): string {
  const dest = path.join(ROOT, '.pack');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  execFileSync('pnpm', ['pack', '--pack-destination', dest], { cwd: ROOT, stdio: 'inherit' });
  const tgz = readdirSync(dest).filter((f) => f.endsWith('.tgz'));
  if (tgz.length !== 1) throw new Error(`expected one tarball in .pack, found ${tgz.length}`);
  const name = tgz[0] as string;
  const sha = createHash('sha256')
    .update(readFileSync(path.join(dest, name)))
    .digest('hex');
  writeFileSync(path.join(dest, `${name}.sha256`), `${sha}  ${name}\n`);
  return path.join(dest, name);
}

if (isMain(import.meta.url)) {
  console.log(packLocal());
}
