// SPDX-License-Identifier: Apache-2.0
import type { JsonSchema } from '../types';

export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Port: checks tool arguments against the tool's inputSchema.
 * The default adapter is Ajv (src/adapters/ajv-args-validator.ts).
 */
export interface ArgsValidator {
  validate(schema: JsonSchema, value: unknown): ValidationResult;
}
