import { effectivePt, type Theme } from '../../core/index';

export const PRINT_MIN_PT = { title: 12, label: 9, caption: 8 } as const;

/**
 * `max(1, max over title/label/caption of minPt / effectivePt(themeSize))`. Layout never scales
 * text down. Rounded up at 1e-6 so floating error cannot leave an effective size just under its minimum.
 */
export function computeFontScale(
  theme: Theme,
  width: number,
  printWidthMm: number | undefined,
): number {
  if (printWidthMm === undefined) return 1;
  let scale = 1;
  for (const key of ['title', 'label', 'caption'] as const) {
    scale = Math.max(scale, PRINT_MIN_PT[key] / effectivePt(theme.text[key], width, printWidthMm));
  }
  return Math.ceil(scale * 1e6) / 1e6;
}

export function scaledEffectivePt(
  theme: Theme,
  width: number,
  printWidthMm: number,
  fontScale: number,
): { title: number; label: number; caption: number } {
  return {
    title: effectivePt(theme.text.title * fontScale, width, printWidthMm),
    label: effectivePt(theme.text.label * fontScale, width, printWidthMm),
    caption: effectivePt(theme.text.caption * fontScale, width, printWidthMm),
  };
}
