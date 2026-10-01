/** Fixture catalog written by `pnpm stage docs` into public/fixtures/. */
export interface FixtureInfo {
  id: string;
  family: string;
  slice: number;
  gallery: boolean;
  specHash: string;
}

export async function loadFixtureIndex(): Promise<FixtureInfo[]> {
  const res = await fetch('fixtures/index.json');
  if (!res.ok) throw new Error(`fixtures/index.json: HTTP ${res.status}`);
  const all = (await res.json()) as FixtureInfo[];
  // Slice-1 gallery fixtures, plus the minimal fixtures of kinds this slice cannot draw yet
  // (they show the `not-implemented-in-slice` error).
  return all.filter(
    (f) => (f.gallery && f.slice === 1) || (f.id.startsWith('min-') && f.slice > 1),
  );
}

export async function loadFixtureText(id: string): Promise<string> {
  const res = await fetch(`fixtures/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`fixtures/${id}.json: HTTP ${res.status}`);
  return res.text();
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

/** SHA-256 (hex) of the canonical JSON: keys sorted at every depth, no whitespace. */
export async function specHash(spec: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(spec));
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}

export const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
