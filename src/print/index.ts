/**
 * `@draven/viz/print`: batch mounting for print and the data table DOM renderer. Slice 1 also
 * lands here the option types and `FontAsset` (design section 3); `renderToSvg` arrives in Task 13.
 */
export { mountCharts, type MountHandle, type ReadyInfo } from './mount';
export type { FontAsset, MountOptions, RenderOptions } from './options';
export { renderDataTable, type RenderDataTableOptions } from './table-dom';
