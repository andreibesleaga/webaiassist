// SPDX-License-Identifier: Apache-2.0
// The starting text of the "run it by hand" box (the tool detail view): a JSON object with the
// tool's required fields, each with an empty value of its type. It only helps typing; the user's
// text is checked against the schema before anything is asked or run.
import type { JsonSchema } from './types';

const MAX_FIELDS = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const EMPTY: Readonly<Record<string, unknown>> = {
  string: '',
  number: 0,
  integer: 0,
  boolean: false,
  array: [],
  object: {},
};

function emptyValue(property: unknown): unknown {
  if (!isRecord(property)) return null;
  const choices = property.enum;
  if (Array.isArray(choices) && choices.length > 0) return choices[0];
  const type = typeof property.type === 'string' ? property.type : '';
  return type in EMPTY ? EMPTY[type] : null;
}

export function argsTemplate(schema: JsonSchema | undefined): string {
  const properties = schema?.properties;
  const required = Array.isArray(schema?.required) ? schema.required : [];
  const out: Record<string, unknown> = {};
  if (isRecord(properties)) {
    for (const name of required) {
      if (typeof name !== 'string' || name === '__proto__' || !(name in properties)) continue;
      if (Object.keys(out).length >= MAX_FIELDS) break;
      out[name] = emptyValue(properties[name]);
    }
  }
  return JSON.stringify(out, null, 2);
}
