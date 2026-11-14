// SPDX-License-Identifier: Apache-2.0
// The fields a tool takes, in one short line for the model: "slug (string, required), agent
// (string)". Used when the model's arguments did not fit the schema, so the retry shows what
// the tool needs. Names come from the page: they are reduced to plain name characters and capped; types are
// only the JSON Schema type words.
import { quoteName } from './sanitize';
import type { ToolInfo } from './types';

const MAX_FIELDS = 8;
const NAME_CAP = 32;
const LINE_CAP = 300;
/** The only type words quoted back: a page cannot put its own text in a turn of the chat. */
const TYPE_NAMES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);

type Record_ = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record_ =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const known = (type: unknown): type is string => typeof type === 'string' && TYPE_NAMES.has(type);

function listedType(type: unknown): string {
  const words = (Array.isArray(type) ? type : [type]).filter(known);
  return words.length > 0 ? words.join('|') : 'any';
}

/** The type of a property: "one of N values" for an enum, its type words, or "any". The enum
 *  values themselves stay in the tool list the model already has. */
function typeText(schema: unknown, nested = false): string {
  if (!isRecord(schema)) return 'any';
  if (Array.isArray(schema.enum)) return `one of ${schema.enum.length} values`;
  if (schema.type !== 'array') return listedType(schema.type);
  const item = nested ? 'any' : typeText(schema.items, true);
  return item === 'any' ? 'array' : `${item}[]`;
}

const names = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

interface Field {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  /** Short enum values as "a|b|c", for the compact tool list; absent otherwise. */
  readonly choices?: string;
}

const MAX_CHOICES = 6;
const CHOICES_CAP = 40;

/** The values of a short enum of strings and numbers; enum text is free of markers because
 *  listableTool checked every string of the schema before a tool is listed. */
function choicesOf(schema: unknown): string | undefined {
  if (!isRecord(schema) || !Array.isArray(schema.enum)) return undefined;
  const values: unknown[] = schema.enum;
  if (values.length > MAX_CHOICES) return undefined;
  if (!values.every((v) => typeof v === 'string' || typeof v === 'number')) return undefined;
  const text = values.join('|');
  return text.length <= CHOICES_CAP ? text : undefined;
}

function fieldsOf(schema: Record_ | undefined): Field[] {
  const properties = isRecord(schema?.properties) ? schema.properties : {};
  const required = names(schema?.required);
  const optional = Object.keys(properties).filter((name) => !required.includes(name));
  return [...required, ...optional].map((name) => {
    const choices = choicesOf(properties[name]);
    return {
      name,
      type: typeText(properties[name]),
      required: required.includes(name),
      ...(choices === undefined ? {} : { choices }),
    };
  });
}

function fieldText(field: Field): string {
  return `${quoteName(field.name).slice(0, NAME_CAP)} (${field.type}${field.required ? ', required' : ''})`;
}

export function describeArguments(tool: ToolInfo): string {
  const fields = fieldsOf(tool.inputSchema);
  if (fields.length === 0) return 'no fields';
  const shown = fields.slice(0, MAX_FIELDS).map(fieldText).join(', ');
  const rest = fields.length - MAX_FIELDS;
  const line = rest > 0 ? `${shown}, and ${rest} more` : shown;
  return line.length > LINE_CAP ? `${line.slice(0, LINE_CAP - 1)}…` : line;
}

const COMPACT_FIELDS = 6;

/** The arguments in the compact tool list: "slug*:string, agent:string" (* = required). */
export function compactArguments(tool: ToolInfo): string {
  const fields = fieldsOf(tool.inputSchema);
  const shown = fields.slice(0, COMPACT_FIELDS).map((f) => {
    const name = quoteName(f.name).slice(0, NAME_CAP);
    return `${name}${f.required ? '*' : ''}:${f.choices ?? f.type}`;
  });
  const rest = fields.length - COMPACT_FIELDS;
  return rest > 0 ? [...shown, `+${rest} more`].join(', ') : shown.join(', ');
}
