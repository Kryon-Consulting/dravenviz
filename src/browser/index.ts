/**
 * Browser bundle entry (design section 3). `scripts/build-browser.ts` wraps this in an IIFE that
 * assigns `window.DravenViz`. React, ReactDOM and react-is are bundled inside and are never read
 * from or written to the page's globals.
 */
export { InvalidSpecError, toDataTable, validateSpec, version } from '../core/index';
export { mountCharts, renderDataTable, renderToSvg, renderToSvgWithAssets } from '../print/index';
