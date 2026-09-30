import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Workers restart after a failing test, so measurements and the inventory are merged through files.
const readJson = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {});
const record = (key: string, value: unknown) => {
  const all = readJson('measurements.json');
  all[key] = value;
  writeFileSync('measurements.json', JSON.stringify(all, null, 2) + '\n');
};
const sortObj = (o: any): any =>
  o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortObj(o[k])])) : o;
async function open(page: Page, c: string) {
  await page.goto(`/?case=${c}`);
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
}
async function inv(page: Page) {
  const seen = await page.evaluate(() => (window as any).probe.inventory());
  const all = readJson('attribute-inventory.json');
  for (const [k, tags] of Object.entries<any>(seen))
    for (const [t, attrs] of Object.entries<any>(tags)) Object.assign(((all[k] ??= {})[t] ??= {}), attrs);
  writeFileSync('attribute-inventory.json', JSON.stringify(sortObj(all), null, 2) + '\n');
}

test('1 overlay children render inside surface and align with marks', async ({ page }) => {
  await open(page, 'overlay');
  const r = await page.evaluate(() => (window as any).probe.overlayAlignment());
  record('1', r);
  await inv(page);
  expect(r.overlayInsideSurface).toBe(true);
  expect(r.maxDeltaUnits).toBeLessThanOrEqual(0.5); // hook-scaled circle vs Line dot centres
  expect(r.lineOnlyBandCentres).toBe(true); // explicit scale="band": centre k at (k+0.5)*w/n
  expect(r.plotAreaMatchesLayoutBox).toBe(true); // usePlotArea() == margins + explicit axis sizes
});
test('2 grouped bars side by side; stackId bars/areas share band', async ({ page }) => {
  await open(page, 'stacks');
  const r = await page.evaluate(() => (window as any).probe.stacks());
  record('2', r);
  await inv(page);
  expect(r.groupedDistinctX).toBe(true);
  expect(r.stackedSameX).toBe(true); // same x and width per category
  expect(r.signOffsetNegativeBelowZero).toBe(true);
  expect(r.areaStackTopEqualsSum).toBe(true);
});
test('3 null members create gaps', async ({ page }) => {
  await open(page, 'nulls');
  const r = await page.evaluate(() => (window as any).probe.nulls());
  record('3', r);
  await inv(page);
  expect(r.lineSegments).toBe(2); // [12,null,18,20] -> 2 path moves
  expect(r.barForNull).toBe('absent'); // no rect, not a 0-height rect
  expect(r.stackedAreaBreak).toBe(true);
});
test('4 first commit has final geometry with animation off', async ({ page }) => {
  await open(page, 'noanim');
  const r = await page.evaluate(() => (window as any).probe.firstCommitStable());
  record('4', { ...r, pathAfterCommit: r.pathAfterCommit.length, pathAfter500ms: r.pathAfter500ms.length });
  expect(r.committedNonEmpty).toBe(true);
  expect(r.pathAfterCommit).toBe(r.pathAfter500ms);
});
test('6 inline style props resist host CSS', async ({ page }) => {
  await open(page, 'hostcss');
  const r = await page.evaluate(() => (window as any).probe.hostCss());
  record('6', r);
  await inv(page);
  expect(r.hostCssBites).toBe(true); // negative control: host CSS does restyle an unstyled element
  expect(r.componentsForwardingStyle).toEqual(expect.arrayContaining(['Line', 'XAxis.tick', 'YAxis.tick']));
  expect(r.textFillsUnchanged && r.lineStrokeWidthsUnchanged && r.fontFamilyUnchanged).toBe(true);
});
test('5 real chart survives normalize + strict allowlist', async ({ page }) => {
  await open(page, 'export');
  const r = await page.evaluate(() => (window as any).probe.exportProbe());
  record('5', { ...r, svg: undefined });
  await inv(page);
  expect(r.disallowedAfterNormalize).toEqual([]);
  expect(r.svg).not.toMatch(/class=|style=|recharts/);
});
