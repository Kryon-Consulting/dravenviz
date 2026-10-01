/* eslint-disable @typescript-eslint/no-explicit-any -- tests navigate fixture JSON dynamically */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixture as catalogLoad } from '../../../fixtures/index';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export function read(repoRelative: string): string {
  return readFileSync(path.join(ROOT, repoRelative), 'utf8');
}

export function readJson(repoRelative: string): any {
  return JSON.parse(read(repoRelative));
}

/** A catalogued fixture by id, e.g. `loadFixture('min-line')` (see fixtures/index.ts). */
export function loadFixture(id: string): any {
  return catalogLoad(id);
}
