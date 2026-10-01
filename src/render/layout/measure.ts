import { NOTO_METRICS, type FontMetrics } from './noto-metrics.gen';
import type { TextMeasurer } from './types';

const REPLACEMENT = 0xfffd;
const averageCache = new Map<string, number>();

function averageAdvance(metrics: FontMetrics, weight: 400 | 600): number {
  const key = `${metrics.unitsPerEm}:${metrics.ascender}:${weight}`;
  const hit = averageCache.get(key);
  if (hit !== undefined) return hit;
  const values = Object.values(metrics.advances[weight]);
  const avg =
    values.length === 0
      ? metrics.unitsPerEm / 2
      : values.reduce((a, b) => a + b, 0) / values.length;
  averageCache.set(key, avg);
  return avg;
}

/**
 * Deterministic Node measurer from the generated Noto Sans advance tables.
 * `width = sum(advance) * size / unitsPerEm`; `ascent = 1069 * size / 1000`; `descent = 293 * size / 1000`.
 * A code point missing from the tables (outside Latin, Greek and Cyrillic, e.g. an em dash or a
 * circled digit) uses the advance of U+FFFD when the table has it, otherwise the table's average
 * advance. It is never 0, so unknown text is never measured as free.
 */
export function createNotoMeasurer(metrics: FontMetrics = NOTO_METRICS): TextMeasurer {
  return (text, font) => {
    const table = metrics.advances[font.weight];
    const fallback = table[REPLACEMENT] ?? averageAdvance(metrics, font.weight);
    let units = 0;
    for (const ch of text) {
      units += table[ch.codePointAt(0) ?? REPLACEMENT] ?? fallback;
    }
    const k = font.size / metrics.unitsPerEm;
    return {
      width: units * k,
      ascent: metrics.ascender * k,
      descent: -metrics.descender * k,
    };
  };
}

export const notoMeasurer: TextMeasurer = createNotoMeasurer();
