import { defaultFontAssets, loadFonts } from '../../src/render/fonts/load';
import {
  __resetFontRegistry,
  assertSameOriginOrRelative,
  fontRegistry,
} from '../../src/render/fonts/registry';

const notYet = (task: string) => (): never => {
  throw new Error(`not implemented until ${task}`);
};

export const harness = {
  loadFonts,
  defaultFontAssets,
  assertSameOriginOrRelative,
  fontRegistry,
  __resetFontRegistry,
  mount: notYet('Task 12/13'),
  exportSvg: notYet('Task 12/13'),
  counts: notYet('Task 12/13'),
};

declare global {
  interface Window {
    __h: typeof harness;
  }
}

window.__h = harness;
