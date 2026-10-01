import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export interface ProvenanceEntry {
  file: string;
  sha256: string;
}

export function read(repoRelative: string): string {
  return readFileSync(path.join(ROOT, repoRelative), 'utf8');
}

export function sha256File(repoRelative: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(ROOT, repoRelative)))
    .digest('hex');
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim().replace(/^`|`$/g, ''));

/**
 * Rows of every markdown table in a PROVENANCE.md whose header has both a `file` and a
 * `sha256` column. Tables without a `file` column (the upstream zip/TTF table) are skipped.
 */
export function readProvenance(repoRelative: string): ProvenanceEntry[] {
  const lines = read(repoRelative).split(/\r?\n/);
  const out: ProvenanceEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim().startsWith('|')) continue;
    const header = cells(line);
    const fileCol = header.indexOf('file');
    const shaCol = header.indexOf('sha256');
    const isTableStart = !(lines[i - 1] ?? '').trim().startsWith('|');
    if (!isTableStart || fileCol < 0 || shaCol < 0) continue;
    for (let j = i + 2; j < lines.length && (lines[j] ?? '').trim().startsWith('|'); j++) {
      const row = cells(lines[j] ?? '');
      const file = row[fileCol];
      const sha256 = row[shaCol];
      if (file && sha256) out.push({ file, sha256 });
    }
  }
  return out;
}
