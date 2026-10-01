import { rmSync } from 'node:fs';
// The committed measurements.json and attribute-inventory.json are regenerated from scratch on every run; output is sorted
// and deterministic, so a clean re-run leaves no diff.
export default function globalSetup() {
  rmSync('measurements.json', { force: true });
  rmSync('attribute-inventory.json', { force: true });
}
