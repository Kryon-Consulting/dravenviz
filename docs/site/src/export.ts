import { renderToSvgWithAssets, type ExportOptions, type SvgExport } from '@draven/viz/print';
import { strToU8, zipSync } from 'fflate';
import { hex } from './fixtures';

export type FontMode = 'embedded' | 'external';

export interface RenderSettings {
  theme: 'light' | 'dark' | 'print';
  width: number;
  height: number;
  locale: string;
  timezone: string;
}

const exportOptions = (s: RenderSettings, fontMode: FontMode): ExportOptions => ({
  width: s.width,
  height: s.height,
  theme: s.theme,
  locale: s.locale,
  timezone: s.timezone,
  fontMode,
});

/** Awaits renderer readiness and returns the standalone SVG of the validated spec. */
export const exportSvg = (spec: unknown, s: RenderSettings, mode: FontMode): Promise<SvgExport> =>
  renderToSvgWithAssets(spec, exportOptions(s, mode));

const README = `DravenViz chart export (external fonts)

chart.svg references its fonts as fonts/<file>.woff2. Keep the fonts/ folder next to chart.svg,
exactly as in this archive; if it is moved or renamed the text falls back to a system font.
OFL.txt is the licence of the Noto Sans font files (SIL Open Font License 1.1).

For a single portable file with the fonts embedded, download the SVG with "Embedded fonts".
`;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** chart.svg, the exact fonts listed in `SvgExport.fonts` under fonts/, the licence and a README. */
export async function buildFontZip(exported: SvgExport): Promise<Blob> {
  const files: Record<string, Uint8Array> = {
    'chart.svg': strToU8(exported.svg),
    'README.txt': strToU8(README),
  };
  for (const font of exported.fonts) {
    const bytes = await fetchBytes(font.sourceUrl);
    if ((await sha256Hex(bytes)) !== font.sha256) {
      throw new Error(`${font.fileName} does not match the hash the exporter reported.`);
    }
    files[`fonts/${font.fileName}`] = bytes;
  }
  files['OFL.txt'] = await fetchBytes('fonts/OFL.txt');
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

/** Object URLs created by `saveBlob` that are not revoked yet; the page revokes them on unload. */
const pending = new Set<string>();
window.addEventListener('pagehide', () => {
  for (const url of pending) URL.revokeObjectURL(url);
  pending.clear();
});

/** Downloads a blob, then revokes its object URL after the click has been handled. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  pending.add(url);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    pending.delete(url);
  }, 500);
}
