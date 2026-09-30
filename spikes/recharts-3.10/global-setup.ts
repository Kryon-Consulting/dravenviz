import { rmSync } from 'node:fs';
export default function globalSetup() {
  rmSync('measurements.json', { force: true });
  rmSync('attribute-inventory.json', { force: true });
}
