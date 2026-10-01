/* eslint-disable @typescript-eslint/no-explicit-any -- tests navigate fixture JSON dynamically */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function read(repoRelative: string): string {
  return readFileSync(path.join(ROOT, repoRelative), 'utf8');
}

export function readJson(repoRelative: string): any {
  return JSON.parse(read(repoRelative));
}

/** A fixture under fixtures/valid by id, e.g. `loadFixture('min-line')`. */
export function loadFixture(id: string): any {
  return readJson(`fixtures/valid/${id}.json`);
}
