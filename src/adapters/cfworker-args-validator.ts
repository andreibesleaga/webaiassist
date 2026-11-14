// SPDX-License-Identifier: Apache-2.0
// ArgsValidator adapter on @cfworker/json-schema, a JSON Schema validator that interprets
// the schema instead of generating code. Tool schemas arrive from the page at runtime, and
// Manifest V3 extension pages forbid `new Function`, so this is the validator the extension
// uses; Ajv (ajv-args-validator.ts) stays for Node and the tests. Dialect: 2020-12.
// Shared rules (risky patterns, message form): args-checks.ts.
import { Validator } from '@cfworker/json-schema';
import type { ArgsValidator, ValidationResult } from '../core/ports/args-validator';
import type { JsonSchema } from '../core/types';
import { errorLine, hasRiskyPattern, RISKY_PATTERN } from './args-checks';

/** The property a `required` message names ('Instance does not have required property "x".'). */
const MISSING = /required property "([^"]*)"/;

export class CfWorkerArgsValidator implements ArgsValidator {
  private readonly cache = new WeakMap<JsonSchema, Validator>();

  validate(schema: JsonSchema, value: unknown): ValidationResult {
    if (hasRiskyPattern(schema)) return { ok: false, errors: [RISKY_PATTERN] };
    try {
      const result = this.validatorFor(schema).validate(value);
      if (result.valid) return { ok: true };
      // The library lists the failing keyword at each level; path and keyword only.
      const errors = result.errors.map((e) =>
        errorLine(e.instanceLocation, e.keyword, MISSING.exec(e.error)?.[1]),
      );
      return { ok: false, errors };
    } catch {
      // The library's message can quote the schema, which is page text.
      return { ok: false, errors: ['the tool schema could not be used'] };
    }
  }

  private validatorFor(schema: JsonSchema): Validator {
    let validator = this.cache.get(schema);
    if (!validator) {
      validator = new Validator(schema, '2020-12', false);
      this.cache.set(schema, validator);
    }
    return validator;
  }
}
