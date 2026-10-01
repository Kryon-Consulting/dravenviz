import type { TextMeasurer } from './types';

/**
 * Browser measurer on canvas `measureText`. Call it only after the bundled font has been
 * verified as loaded (design section 9). Browser only: never import this from `index.ts`.
 */
export function createCanvasMeasurer(family: string): TextMeasurer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D canvas context unavailable for text measurement.');
  return (text, font) => {
    ctx.font = `${font.weight} ${font.size}px ${family}`;
    const m = ctx.measureText(text);
    return {
      width: m.width,
      ascent: m.fontBoundingBoxAscent,
      descent: m.fontBoundingBoxDescent,
    };
  };
}
