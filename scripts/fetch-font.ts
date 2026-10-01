/**
 * Fetches the pinned Noto Sans (shipped) and Noto Serif (test fixture) releases, verifies the zip
 * SHA-256, extracts the static unhinted TTFs, compresses them to WOFF2 and writes the committed
 * outputs: fonts, OFL.txt, PROVENANCE.md, noto-sans.css and the generated advance-width tables.
 *
 * Run once, commit the outputs: `NODE_USE_ENV_PROXY=1 pnpm tsx scripts/fetch-font.ts`
 * (NODE_USE_ENV_PROXY makes Node's fetch honour HTTPS_PROXY; set NODE_EXTRA_CA_CERTS to a CA bundle
 * if the proxy needs one. TLS verification is never disabled.) CI never downloads fonts.
 *
 * Zip extraction uses the system `unzip` (Info-ZIP): it only reads a SHA-256-verified archive.
 * The Noto Serif zip hash is recorded in tests/assets/fonts/PROVENANCE.md on first fetch and
 * verified against that record on every later run.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import * as prettier from 'prettier';
import wawoff2 from 'wawoff2';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/notofonts/latin-greek-cyrillic';
const WEIGHTS = { Regular: 400, SemiBold: 600 } as const;
type Style = keyof typeof WEIGHTS;

interface Family {
  name: 'NotoSans' | 'NotoSerif';
  tag: string;
  /** Annotated tag object SHA (git ls-remote). */
  tagObject: string;
  /** Commit the tag points to. */
  commit: string;
  /** Known zip hash, or null to record it on first fetch. */
  zipSha256: string | null;
  outDir: string;
  metricsFile: string;
  metricsExport: string;
  shipped: boolean;
}

const FAMILIES: Family[] = [
  {
    name: 'NotoSans',
    tag: 'NotoSans-v2.015',
    tagObject: '0aabc14885f9edaf467f05a2499a1a00c09f0b56',
    commit: 'c4a321e123e4d4ff315f57f4e0adf294fe3a95be',
    zipSha256: '0c34df072a3fa7efbb7cbf34950e1f971a4447cffe365d3a359e2d4089b958f5',
    outDir: 'assets/fonts',
    metricsFile: 'src/render/layout/noto-metrics.gen.ts',
    metricsExport: 'NOTO_METRICS',
    shipped: true,
  },
  {
    name: 'NotoSerif',
    tag: 'NotoSerif-v2.015',
    tagObject: '1eee5de7230d240118f8ad8d1e5fe4c91acae943',
    commit: 'c4a321e123e4d4ff315f57f4e0adf294fe3a95be',
    zipSha256: null,
    outDir: 'tests/assets/fonts',
    metricsFile: 'tests/assets/fonts/noto-serif-metrics.gen.ts',
    metricsExport: 'NOTO_SERIF_METRICS',
    shipped: false,
  },
];

/**
 * U+0020-U+024F (Basic Latin to Latin Extended-B), en and em dash (U+2013-U+2014), ellipsis
 * (U+2026), Greek and Coptic, Cyrillic. Noto Sans has no circled digits (U+2460-U+2473), so notes
 * use parenthesised numerals instead.
 */
const RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x24f],
  [0x2013, 0x2014],
  [0x2026, 0x2026],
  [0x370, 0x3ff],
  [0x400, 0x4ff],
];

const sha256 = (b: Buffer | Uint8Array): string => createHash('sha256').update(b).digest('hex');
const abs = (rel: string): string => path.join(ROOT, rel);

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function unzipFile(zipPath: string, member: string): Buffer {
  return execFileSync('unzip', ['-p', zipPath, member], { maxBuffer: 64 * 1024 * 1024 });
}

/** Zip hash recorded by an earlier run: the `| zip | ... | <sha256> |` row of PROVENANCE.md. */
function recordedZipHash(provenancePath: string): string | null {
  if (!existsSync(provenancePath)) return null;
  const m = /^\|\s*zip\s*\|.*\|\s*`?([0-9a-f]{64})`?\s*\|\s*$/m.exec(
    readFileSync(provenancePath, 'utf8'),
  );
  return m?.[1] ?? null;
}

interface Metrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  advances: Record<400 | 600, Record<number, number>>;
}

function measure(ttfs: Record<Style, Buffer>): Metrics {
  const advances: Metrics['advances'] = { 400: {}, 600: {} };
  let head: Pick<Metrics, 'unitsPerEm' | 'ascender' | 'descender'> | undefined;
  for (const style of Object.keys(WEIGHTS) as Style[]) {
    const font = fontkit.create(ttfs[style]) as fontkit.Font;
    // hhea metrics are shared by the two static instances; assert it instead of assuming.
    const h = { unitsPerEm: font.unitsPerEm, ascender: font.ascent, descender: font.descent };
    if (head && JSON.stringify(head) !== JSON.stringify(h))
      throw new Error('vertical metrics differ');
    head = h;
    for (const [lo, hi] of RANGES)
      for (let cp = lo; cp <= hi; cp++) {
        if (!font.hasGlyphForCodePoint(cp)) continue;
        advances[WEIGHTS[style]][cp] = font.glyphForCodePoint(cp).advanceWidth;
      }
  }
  if (!head) throw new Error('no fonts measured');
  return { ...head, advances };
}

async function writeMetrics(f: Family, m: Metrics): Promise<void> {
  const advances = (w: 400 | 600): string =>
    Object.keys(m.advances[w])
      .map(Number)
      .sort((a, b) => a - b)
      .map((cp) => `${cp}: ${m.advances[w][cp]}`)
      .join(', ');
  const src = `// GENERATED by scripts/fetch-font.ts from ${f.tag} (tag object ${f.tagObject}, commit ${f.commit}). Do not edit.
// Advance widths (font units, hmtx) for U+0020-U+024F, U+2013-U+2014, U+2026, Greek and Cyrillic; keys sorted.
export interface FontMetrics {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  advances: Record<400 | 600, Record<number, number>>;
}

export const ${f.metricsExport}: FontMetrics = {
  unitsPerEm: ${m.unitsPerEm},
  ascender: ${m.ascender},
  descender: ${m.descender},
  advances: {
    400: { ${advances(400)} },
    600: { ${advances(600)} },
  },
};
`;
  const config = (await prettier.resolveConfig(abs(f.metricsFile))) ?? {};
  const formatted = await prettier.format(src, { ...config, filepath: abs(f.metricsFile) });
  mkdirSync(path.dirname(abs(f.metricsFile)), { recursive: true });
  writeFileSync(abs(f.metricsFile), formatted);
}

const CSS = `/* Noto Sans v2.015 (SIL OFL 1.1). See PROVENANCE.md and OFL.txt. */
@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url('NotoSans-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Noto Sans';
  font-style: normal;
  font-weight: 600;
  font-display: block;
  src: url('NotoSans-SemiBold.woff2') format('woff2');
}
`;

async function processFamily(f: Family, scratch: string): Promise<void> {
  const outDir = abs(f.outDir);
  const provenancePath = path.join(outDir, 'PROVENANCE.md');
  const expected = f.zipSha256 ?? recordedZipHash(provenancePath);
  const url = `${REPO}/releases/download/${f.tag}/${f.tag}.zip`;
  const zipPath = path.join(scratch, `${f.tag}.zip`);
  const zip = await download(url);
  const zipHash = sha256(zip);
  try {
    if (expected && zipHash !== expected)
      throw new Error(`${f.tag}.zip SHA-256 mismatch: expected ${expected}, got ${zipHash}`);
    writeFileSync(zipPath, zip);
    console.log(`${f.tag}.zip ${zipHash} ${expected ? 'verified' : 'RECORDED (first fetch)'}`);

    const ttfs = {} as Record<Style, Buffer>;
    const woffs = {} as Record<Style, Buffer>;
    const ttfRows: string[] = [];
    mkdirSync(outDir, { recursive: true });
    for (const style of Object.keys(WEIGHTS) as Style[]) {
      const member = `${f.name}/unhinted/ttf/${f.name}-${style}.ttf`;
      ttfs[style] = unzipFile(zipPath, member);
      woffs[style] = Buffer.from(await wawoff2.compress(ttfs[style]));
      writeFileSync(path.join(outDir, `${f.name}-${style}.woff2`), woffs[style]);
      ttfRows.push(`| \`${member}\` | ${sha256(ttfs[style])} |`);
    }
    const ofl = unzipFile(zipPath, 'OFL.txt');
    if (!/SIL OPEN FONT LICENSE Version 1\.1/.test(ofl.toString('utf8')))
      throw new Error('OFL.txt in the zip is not OFL-1.1');
    writeFileSync(path.join(outDir, 'OFL.txt'), ofl);
    if (f.shipped) writeFileSync(path.join(outDir, 'noto-sans.css'), CSS);

    const shipped: Array<[string, Buffer]> = [
      [`${f.name}-Regular.woff2`, woffs.Regular],
      [`${f.name}-SemiBold.woff2`, woffs.SemiBold],
      ['OFL.txt', ofl],
      ...(f.shipped ? ([['noto-sans.css', Buffer.from(CSS)]] as Array<[string, Buffer]>) : []),
    ];
    shipped.sort((a, b) => a[0].localeCompare(b[0]));
    const md = `# ${f.name} provenance

Source: ${REPO}
Tag: \`${f.tag}\`
Tag object: \`${f.tagObject}\`
Tag commit: \`${f.commit}\`
Zip URL: ${url}
Licence: SIL Open Font License 1.1 (OFL.txt, taken from the zip)
${f.shipped ? 'Role: default font shipped with the package (design D12).' : 'Role: test fixture for custom-font tests only; not shipped.'}

Produced by \`scripts/fetch-font.ts\`. WOFF2 files are the static unhinted TTF instances compressed
with wawoff2. Advance widths in the generated metrics file come from the TTF \`hmtx\` table.

## Source archive and TTFs

| zip | url | sha256 |
| --- | --- | --- |
| zip | ${url} | ${zipHash} |

| zip_path | sha256 |
| --- | --- |
${ttfRows.join('\n')}

## Committed files

| file | sha256 |
| --- | --- |
${shipped.map(([n, b]) => `| ${n} | ${sha256(b)} |`).join('\n')}
`;
    const config = (await prettier.resolveConfig(provenancePath)) ?? {};
    writeFileSync(
      provenancePath,
      await prettier.format(md, { ...config, filepath: provenancePath }),
    );
    await writeMetrics(f, measure(ttfs));
  } finally {
    rmSync(zipPath, { force: true });
  }
}

async function main(): Promise<void> {
  const scratch = mkdtempSync(path.join(tmpdir(), 'dravenviz-fonts-'));
  try {
    for (const f of FAMILIES) await processFamily(f, scratch);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
