// SPDX-License-Identifier: Apache-2.0
// ArgsValidator adapter on Ajv (JSON Schema 2020-12, the dialect WebMCP and MCP cite).
// Ajv compiles each schema to code with `new Function`. That works in Node and in
// pages whose CSP allows 'unsafe-eval'; Manifest V3 extension pages forbid it, so the
// extension needs a CSP-safe validator in that context (see docs/ARCHITECTURE.md).
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020';
import type { ArgsValidator, ValidationResult } from '../core/ports/args-validator';
import type { JsonSchema } from '../core/types';
import { errorLine, hasRiskyPattern, RISKY_PATTERN } from './args-checks';

type Compiled = { readonly validate: ValidateFunction } | { readonly error: string };

export class AjvArgsValidator implements ArgsValidator {
  private readonly ajv = new Ajv2020({ allErrors: true, strict: false });
  private readonly cache = new WeakMap<JsonSchema, Compiled>();

  validate(schema: JsonSchema, value: unknown): ValidationResult {
    if (hasRiskyPattern(schema)) return { ok: false, errors: [RISKY_PATTERN] };
    const compiled = this.compile(schema);
    if ('error' in compiled) return { ok: false, errors: [compiled.error] };
    if (compiled.validate(value)) return { ok: true };
    // Path and keyword only (args-checks.ts); `required` also names the missing property.
    const errors = (compiled.validate.errors ?? []).map((e) => {
      const missing: unknown = e.params.missingProperty;
      return errorLine(
        e.instancePath,
        e.keyword,
        typeof missing === 'string' ? missing : undefined,
      );
    });
    return { ok: false, errors };
  }

  private compile(schema: JsonSchema): Compiled {
    const cached = this.cache.get(schema);
    if (cached) return cached;
    const compiled = this.tryCompile(schema);
    this.cache.set(schema, compiled);
    return compiled;
  }

  private tryCompile(schema: JsonSchema): Compiled {
    try {
      return { validate: this.ajv.compile(schema) };
    } catch {
      // Ajv's message can quote the schema, which is page text.
      return { error: 'the tool schema could not be compiled' };
    }
  }
}
