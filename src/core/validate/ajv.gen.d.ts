// GENERATED — do not edit. Source: scripts/gen-validator.ts.
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
