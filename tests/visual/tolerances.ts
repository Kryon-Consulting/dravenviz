import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The calibrated comparison tolerances of design section 16.2, read from `tolerances.json` (the one
 * place `pnpm visual:calibrate` writes; `REVIEW.md` records the same numbers for the owner).
 * Ratios are fractions of the crop's pixels (0.005 = 0.5 %).
 */
export const THRESHOLD = 0.1;
export const INCLUDE_AA = false;
/** Design section 16.2: a cross-path ratio is never allowed above this; investigate instead. */
export const CROSS_PATH_CAP = 0.01;

export interface Tolerances {
  threshold: number;
  includeAA: boolean;
  /** Browser vs browser, repeat renders: max observed + 0.05 pp. */
  sameBrowser: number;
  /** PDF crop vs PDF crop, repeat renders: max observed + 0.05 pp. */
  samePdf: number;
  /** Standalone SVG vs live browser render: max observed + 0.1 pp. */
  crossSvgBrowser: number;
  /** Rasterized PDF crop vs browser render: max observed + 0.1 pp. */
  crossPdfBrowser: number;
}

export const TOLERANCES_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'tolerances.json',
);

export function loadTolerances(): Tolerances {
  const raw = JSON.parse(readFileSync(TOLERANCES_FILE, 'utf8')) as { tolerances?: Tolerances };
  if (raw.tolerances === undefined)
    throw new Error('tolerances.json has no "tolerances"; run pnpm visual:calibrate');
  return raw.tolerances;
}
