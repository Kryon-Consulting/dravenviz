import { compile } from 'json-schema-to-typescript';
import {
  HEADER_LINE,
  SCHEMA_PATH,
  isMain,
  outRoot,
  readSchemaText,
  writeGenerated,
} from './gen-lib';

const OUTPUT = 'src/core/spec/types.gen.ts';

const BANNER = `// ${HEADER_LINE} Source: ${SCHEMA_PATH}. Regenerate with \`pnpm gen\`.\n// Produced by json-schema-to-typescript; \`pnpm check:drift\` fails if this file is stale.`;

export async function generateTypes(): Promise<Record<string, string>> {
  const schema = JSON.parse(readSchemaText()) as object;
  const text = await compile(schema, 'VizSpec', {
    bannerComment: BANNER,
    unreachableDefinitions: true,
    strictIndexSignatures: true,
    additionalProperties: false,
    // Plain arrays: bounds stay in the schema; tuple unions for maxItems 16 would be noise.
    maxItems: -1,
    cwd: process.cwd(),
    // Keep the output stable under `prettier --check` with the repo's own settings.
    style: { singleQuote: true, printWidth: 100, trailingComma: 'all' },
  });
  return { [OUTPUT]: text };
}

if (isMain(import.meta.url)) {
  writeGenerated(outRoot(process.argv), await generateTypes());
}
