import { DravenVizError } from '../../core/index';
import type { TextMeasurer } from './types';

/** A CSS font-family value: a list or already-quoted name is used as given; a bare name is quoted. */
function cssFamily(family: string): string {
  if (/[,'"]/.test(family)) return family;
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Browser measurer on canvas `measureText`. Call it only after the bundled font has been
 * verified as loaded (design section 9). Browser only: never import this from `index.ts`.
 * Throws `DravenVizError('RENDER_FAILED')` when no 2D canvas is available (font loading problems
 * are `FONT_LOAD_FAILED`, reported by the font verification step, not here).
 */
export function createCanvasMeasurer(family: string): TextMeasurer {
  const ctx =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (ctx === null) {
    throw new DravenVizError(
      'RENDER_FAILED',
      'A 2D canvas context is unavailable for text measurement.',
    );
  }
  const css = cssFamily(family);
  return (text, font) => {
    ctx.font = `${font.weight} ${font.size}px ${css}`;
    const m = ctx.measureText(text);
    return {
      width: m.width,
      ascent: m.fontBoundingBoxAscent,
      descent: m.fontBoundingBoxDescent,
    };
  };
}
