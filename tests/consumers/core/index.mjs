import { readFileSync } from 'node:fs';
import { InvalidSpecError, validateSpec } from '@draven/viz';

// Copied from fixtures/ by tests/package/run.ts.
const read = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

const spec = validateSpec(read('min-line.json'));
console.log(`valid ${spec.id}`);

try {
  validateSpec(read('invalid-unknown-field.json'));
  console.log('unexpected: the invalid spec passed');
  process.exitCode = 1;
} catch (error) {
  if (!(error instanceof InvalidSpecError)) throw error;
  console.log(`invalid rule=${error.rule} path=${error.path}`);
}
