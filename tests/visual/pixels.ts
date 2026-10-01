import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { INCLUDE_AA, THRESHOLD } from './tolerances';

export interface PixelDiff {
  width: number;
  height: number;
  mismatched: number;
  ratio: number;
  /** PNG of the diff (differing pixels in red). */
  diff: Buffer;
}

/** pixelmatch at the design section 16.2 settings (threshold 0.1, `includeAA: false`). */
export function diffPng(a: Buffer, b: Buffer): PixelDiff {
  const x = PNG.sync.read(a);
  const y = PNG.sync.read(b);
  if (x.width !== y.width || x.height !== y.height) {
    throw new Error(`size mismatch: ${x.width}x${x.height} vs ${y.width}x${y.height}`);
  }
  const out = { width: x.width, height: x.height, data: Buffer.alloc(x.data.length) };
  const mismatched = pixelmatch(x.data, y.data, out.data, x.width, x.height, {
    threshold: THRESHOLD,
    includeAA: INCLUDE_AA,
  });
  return {
    width: x.width,
    height: x.height,
    mismatched,
    ratio: mismatched / (x.width * x.height),
    diff: PNG.sync.write(out),
  };
}
