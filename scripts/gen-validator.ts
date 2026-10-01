import { readFileSync } from 'node:fs';
import { build, type Plugin } from 'esbuild';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import {
  HEADER_LINE,
  ROOT,
  SCHEMA_PATH,
  isMain,
  outRoot,
  readSchemaText,
  writeGenerated,
} from './gen-lib';

const OUT_JS = 'src/core/validate/ajv.gen.js';
const OUT_DTS = 'src/core/validate/ajv.gen.d.ts';

const BANNER = `// ${HEADER_LINE} Source: ${SCHEMA_PATH} via scripts/gen-validator.ts.\n// Ajv standalone validator with its runtime helpers inlined; no "ajv" import remains.`;

const DTS = `// ${HEADER_LINE} Source: scripts/gen-validator.ts.
import type { VizSpec } from '../spec/types.gen';

/** One Ajv validation error, as produced by the standalone validator. */
export interface AjvError {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, unknown>;
  propertyName?: string;
  message?: string;
}

/**
 * Structural validation against viz-spec-v1.schema.json. On failure "errors" lists every
 * violation (allErrors); on success it is null. Cross-field rules are not checked here.
 */
export interface SchemaValidate {
  (input: unknown): input is VizSpec;
  errors?: AjvError[] | null;
}

export const schemaValidate: SchemaValidate;
export default schemaValidate;
`;

/**
 * ajv's ucs2length helper carries a `.code` string naming `require("ajv/...")`, used only when Ajv
 * itself compiles code at runtime. It is dead in a standalone bundle and would leave a misleading
 * ajv reference in the output, so it is dropped while bundling.
 */
const dropRuntimeRequireString: Plugin = {
  name: 'drop-ajv-runtime-require-string',
  setup(b) {
    b.onLoad({ filter: /ajv[\\/]dist[\\/]runtime[\\/]ucs2length\.js$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      const stripped = source.replace(/^ucs2length\.code = .*;$/m, '');
      if (stripped === source) throw new Error('ucs2length.code assignment not found');
      return { contents: stripped, loader: 'js' };
    });
  },
};

export async function generateValidator(): Promise<Record<string, string>> {
  const schema = JSON.parse(readSchemaText()) as { $id: string };
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
    discriminator: true,
    code: { source: true, esm: true },
  });
  // Annotation-only keywords: `extends` and `tsType` steer json-schema-to-typescript.
  ajv.addKeyword('extends');
  ajv.addKeyword('tsType');
  ajv.addSchema(schema);
  const standalone = standaloneCode(ajv, { schemaValidate: schema.$id });

  // The standalone module requires ajv's runtime helpers; bundle them in so no `ajv` import remains.
  const result = await build({
    stdin: {
      contents: standalone,
      resolveDir: ROOT,
      sourcefile: 'ajv-standalone.js',
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    plugins: [dropRuntimeRequireString],
    write: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('esbuild produced no output');
  return { [OUT_JS]: `${BANNER}\n${output.text}`, [OUT_DTS]: DTS };
}

if (isMain(import.meta.url)) {
  writeGenerated(outRoot(process.argv), await generateValidator());
}
