import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The slice-1 visual references (Task 19). Each one is a candidate until the owner approves it in
 * `REVIEW.md` (design D4); `baselines/approved/<id>.png` holds the approved ones, and nothing
 * else ever writes there.
 */
export type ThemeName = 'light' | 'dark' | 'print';

export interface Candidate {
  /** Stable id: `<fixture>@<theme>`. The owner approves or rejects by this id. */
  id: string;
  fixture: string;
  theme: ThemeName;
}

const c = (fixture: string, theme: ThemeName): Candidate => ({
  id: `${fixture}@${theme}`,
  fixture,
  theme,
});

export const CANDIDATES: readonly Candidate[] = [
  c('line-weekly-flow', 'light'),
  c('line-weekly-flow', 'dark'),
  c('line-weekly-flow', 'print'),
  c('line-thinned-annotation', 'print'),
  c('line-singleton', 'print'),
  c('line-all-equal', 'print'),
  c('line-measured-zero', 'print'),
  c('line-all-missing', 'print'),
  c('line-fixed-domain-clipped', 'print'),
  c('line-estimated-monotone', 'light'),
  c('line-estimated-monotone', 'print'),
  c('line-category-labels-wrap', 'print'),
  c('line-category-labels-rotate', 'print'),
  c('line-category-labels-thin', 'print'),
];

export const WIDTH = 680;
export const HEIGHT = 320;
/** Device pixels per logical unit of every candidate PNG. */
export const SCALE = 2;

export const VISUAL_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(VISUAL_DIR, '..', '..');
export const CANDIDATE_DIR = path.join(VISUAL_DIR, 'baselines', 'candidates');
export const APPROVED_DIR = path.join(VISUAL_DIR, 'baselines', 'approved');
export const REVIEW_FILE = path.join(VISUAL_DIR, 'REVIEW.md');
export const EVIDENCE_DIR = path.join(ROOT, 'evidence', 'visual');

/**
 * The decision recorded in REVIEW.md for `id` (`pending`, `approved by <owner> on <date>` or
 * `changes requested`). Anything unreadable counts as pending.
 */
export function decisionOf(id: string): string {
  let text: string;
  try {
    text = readFileSync(REVIEW_FILE, 'utf8');
  } catch {
    return 'pending';
  }
  const start = text.indexOf(`### ${id}\n`);
  if (start < 0) return 'pending';
  const rest = text.slice(start + id.length + 5);
  const next = rest.search(/^### /m);
  const section = next < 0 ? rest : rest.slice(0, next);
  return /^- \*\*Decision:\*\* `?(.+?)`?\s*$/m.exec(section)?.[1] ?? 'pending';
}
