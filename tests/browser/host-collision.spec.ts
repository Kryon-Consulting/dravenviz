import { expect, test, type Page } from '@playwright/test';
import { h, openHarness } from './helpers';

const o = { width: 680, height: 320, namespace: 'x' };

// A host page declaring its own "Noto Sans" with different glyphs (Noto Serif files).
const HOST_FACE =
  '@font-face{font-family:"Noto Sans";font-weight:400;src:url(/test-fonts/NotoSerif-Regular.woff2)}' +
  '@font-face{font-family:"Noto Sans";font-weight:600;src:url(/test-fonts/NotoSerif-SemiBold.woff2)}';

async function textBoxes(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('svg[data-dravenviz-chart] text')).map((t) => {
      const b = t.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 100) / 100).join(',');
    }),
  );
}
const nums = (s: string): number[] => s.split(',').map(Number);
function expectBoxesClose(actual: string[], expected: string[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((a, i) => {
    nums(a).forEach((n, k) =>
      expect(Math.abs(n - (nums(expected[i] as string)[k] as number))).toBeLessThanOrEqual(0.5),
    );
  });
}

async function liveBoxes(page: Page, css?: string): Promise<string[]> {
  await openHarness(page);
  if (css) await page.addStyleTag({ content: css });
  await h(page).mount(['line-weekly-flow'], { ...o, namespace: 'live' });
  return textBoxes(page);
}

test('a host @font-face of the same family: mount and export use DravenViz bytes', async ({
  page,
}) => {
  await openHarness(page);
  const cleanExport = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fontMode: 'embedded',
  });
  const clean = await liveBoxes(page);

  await openHarness(page);
  await page.addStyleTag({ content: HOST_FACE });
  await h(page).mount(['line-weekly-flow'], { ...o, namespace: 'live' });
  expectBoxesClose(await textBoxes(page), clean);
  const family = await page.evaluate(
    () => getComputedStyle(document.querySelector('svg[data-dravenviz-chart] text')!).fontFamily,
  );
  expect(family).toContain('DravenViz Noto Sans');

  const hostExport = await h(page).renderToSvgWithAssets('line-weekly-flow', {
    ...o,
    fontMode: 'embedded',
  });
  expect(hostExport.svg).toBe(cleanExport.svg);
  expect(hostExport.svg).toContain('font-family="DravenViz Noto Sans, Noto Sans, sans-serif"');
  expect(hostExport.svg).toContain('@font-face{font-family:"DravenViz Noto Sans"');
});

const RULES = [
  'text{alignment-baseline:hanging}',
  'text,tspan{baseline-shift:10px}',
  'text{writing-mode:vertical-rl}',
  'text{font-variant:small-caps}',
  'text{font-feature-settings:"smcp"}',
  'text{text-transform:uppercase}',
  'text{word-spacing:20px}',
  'text{font-kerning:none}',
  'svg,svg *{alignment-baseline:hanging;baseline-shift:10px;font-variant:small-caps;word-spacing:20px;text-transform:uppercase;font-kerning:none;font-feature-settings:"smcp"}',
];

test('host text-property rules leave live text boxes unchanged', async ({ page }) => {
  const base = await liveBoxes(page);
  for (const css of RULES) {
    expectBoxesClose(await liveBoxes(page, css), base);
  }
});

test('host text-property rules leave the export unchanged', async ({ page }) => {
  await openHarness(page);
  const clean = (await h(page).renderToSvgWithAssets('line-weekly-flow', o)).svg;
  for (const css of RULES) {
    await openHarness(page);
    await page.addStyleTag({ content: css });
    expect((await h(page).renderToSvgWithAssets('line-weekly-flow', o)).svg).toBe(clean);
  }
});
