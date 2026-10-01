import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { REVIEW_FILE } from './candidates';

const HEADER = '# Visual review (slice 1)\n';

/**
 * Replaces the generated block `name` of REVIEW.md (between `<!-- name:begin -->` and
 * `<!-- name:end -->`), appending it when absent. Everything outside the markers (the owner's
 * decisions live inside the candidate block, preserved by `generate.ts`) is left alone.
 */
export function replaceBlock(name: string, body: string): void {
  const begin = `<!-- ${name}:begin -->`;
  const end = `<!-- ${name}:end -->`;
  const block = `${begin}\n\n${body.trim()}\n\n${end}`;
  let text = existsSync(REVIEW_FILE) ? readFileSync(REVIEW_FILE, 'utf8') : HEADER;
  const a = text.indexOf(begin);
  const b = text.indexOf(end);
  if (a >= 0 && b > a) {
    text = text.slice(0, a) + block + text.slice(b + end.length);
  } else {
    text = `${text.trimEnd()}\n\n${block}\n`;
  }
  writeFileSync(REVIEW_FILE, text);
}
