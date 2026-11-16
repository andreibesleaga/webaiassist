// SPDX-License-Identifier: Apache-2.0
// One sanitiser for every text that comes from the page before it reaches the model. A page
// must not be able to write the model's own turn markers (`<|im_start|>`, `<|eot_id|>`,
// `[INST]`, `<start_of_turn>`, `</tool-result>` ...) or hide text with invisible characters.
// Only those shapes change: other characters stay as the page wrote them, so a value the
// model copies from a tool result back into a call still matches the page's schema. Tool
// names and the schema values the model copies are not rewritten at all: a tool whose name or
// such a value holds a marker or an invisible character is not offered to the model
// (listableTool); descriptions and titles inside a schema are cleaned (modelSchema).
import type { ToolInfo } from './types';

/**
 * Invisible or blank-looking characters that hide or reorder text, as code point ranges: soft
 * hyphen, combining grapheme joiner, bidi controls, zero-width characters, variation selectors
 * and the Unicode tag characters (U+E0000 to U+E007F), which can spell out hidden text.
 */
const INVISIBLE: readonly (readonly [number, number])[] = [
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x061c, 0x061c],
  [0x115f, 0x1160],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xe0000, 0xe007f],
  [0xe0100, 0xe01ef],
];

const isInvisible = (code: number): boolean =>
  INVISIBLE.some(([first, last]) => code >= first && code <= last);

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const KEYCAP_BASE = /[0-9#*]/;
const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const ZWJ = 0x200d;

/**
 * Emoji are written with characters that are invisible on their own: a presentation selector
 * (U+FE0E, U+FE0F) right after an emoji or a keycap digit, and a zero-width joiner between two
 * emoji. Those stay; they cannot spell hidden text. Anywhere else, or two in a row, they are
 * hidden characters. `chars` is the text as code points, `i` the position of the character.
 */
const isEmoji = (char: string | undefined): boolean => PICTOGRAPHIC.test(char ?? '');

function selectorAfterEmoji(before: string | undefined): boolean {
  return isEmoji(before) || KEYCAP_BASE.test(before ?? '');
}

function joinerBetweenEmoji(chars: readonly string[], i: number): boolean {
  const before = chars[i - 1];
  const joined = isEmoji(before) || (before === '\uFE0F' && isEmoji(chars[i - 2]));
  return joined && isEmoji(chars[i + 1]);
}

function partOfEmoji(chars: readonly string[], i: number): boolean {
  const code = chars[i]?.codePointAt(0) ?? 0;
  if (code === VS15 || code === VS16) return selectorAfterEmoji(chars[i - 1]);
  return code === ZWJ && joinerBetweenEmoji(chars, i);
}

/** True for a character at `i` that hides text (see partOfEmoji for the emoji exceptions). */
const hiddenAt = (chars: readonly string[], i: number): boolean =>
  isInvisible(chars[i]?.codePointAt(0) ?? 0) && !partOfEmoji(chars, i);

/** "<" and its full-width and small-form look-alikes; the same for "|", ">", "/" and brackets. */
const LT = '[<\\uFF1C\\uFE64]';
const PIPE = '[|\\uFF5C]';
const GT = '[>\\uFF1E\\uFE65]';
const SLASH = '[/\\uFF0F]';

/** `<|`, `|>` and `</` in any of their forms: a space is put between the two characters. */
const PAIRS = [
  new RegExp(`(${LT})(${PIPE})`, 'g'),
  new RegExp(`(${PIPE})(${GT})`, 'g'),
  new RegExp(`(${LT})(${SLASH})`, 'g'),
];

/** `<` opening a template tag (`<s>`, `<<SYS>>`, `<start_of_turn>`, `<tool-result` ...). */
const TAG_OPEN = new RegExp(
  `(${LT})(?=${LT}|(?:s|sys|inst|start_of_turn|end_of_turn|tool[-_]?(?:result|call|response)|` +
    'think|im_start|im_end|bos|eos|system|user|assistant)\\b)',
  'gi',
);

/** Bracket markers (Mistral, Llama 2 families): `[INST]`, `[/INST]`, `[SYSTEM_PROMPT]` ... */
const BRACKET_MARKER = new RegExp(
  '[[\\uFF3B](\\/?)(INST|SYS|SYSTEM_PROMPT|AVAILABLE_TOOLS|TOOL_CALLS|TOOL_RESULTS)[\\]\\uFF3D]',
  'gi',
);

const NAME_CAP = 64;

/** C0 and C1 control characters, except tab, line feed and carriage return. */
function isControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false;
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

function dropHidden(text: string): string {
  const chars = [...text];
  return chars
    .filter((char, i) => !isControl(char.codePointAt(0) ?? 0) && !hiddenAt(chars, i))
    .join('');
}

function breakMarkers(text: string): string {
  const paired = PAIRS.reduce((out, pair) => out.replace(pair, '$1 $2'), text);
  return paired.replace(TAG_OPEN, '$1 ').replace(BRACKET_MARKER, '($1$2)');
}

/**
 * Page text made safe to show the model: control and invisible characters removed (so they
 * cannot split a marker either), and every turn-marker shape broken by a space or turned into
 * parentheses. Every other character is kept.
 */
export function cleanPageText(text: string): string {
  return breakMarkers(dropHidden(text));
}

/** True when the text holds an invisible or control character (tab and line breaks excepted). */
export const hasHiddenCharacters = (text: string): boolean => dropHidden(text) !== text;

/** True when the text holds a turn-marker shape or an invisible or control character. */
export function unsafePageText(text: string): boolean {
  const visible = dropHidden(text);
  return visible !== text || breakMarkers(visible) !== visible;
}

/** Schema keywords whose text is prose for the reader, never a value the model copies. */
const PROSE_KEYS = new Set(['description', 'title', '$comment']);
/** Keywords whose value maps names (property names and the like) to sub-schemas. */
const NAME_MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions']);

type Json = unknown;

/** Every string of a schema the model may copy back (keys, enum, const, default ...): not the prose. */
const isProse = (key: string, item: Json, names: boolean): boolean =>
  !names && PROSE_KEYS.has(key) && typeof item === 'string';

function exactStrings(value: Json, out: string[] = [], names = false): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => exactStrings(item, out));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value as Record<string, Json>)) {
      out.push(key);
      if (!isProse(key, item, names)) exactStrings(item, out, !names && NAME_MAPS.has(key));
    }
  }
  return out;
}

function cleanSchema(value: Json, names: boolean): Json {
  if (Array.isArray(value)) return value.map((item) => cleanSchema(item, false));
  if (typeof value !== 'object' || value === null) return value;
  const entries = Object.entries(value as Record<string, Json>).map(([key, item]) => {
    if (!names && PROSE_KEYS.has(key) && typeof item === 'string')
      return [key, cleanPageText(item)];
    return [key, cleanSchema(item, !names && NAME_MAPS.has(key))];
  });
  return Object.fromEntries(entries);
}

/**
 * The schema as the model is given it: descriptions and titles inside it cleaned like any page
 * text (a field description may show example markup such as `</svg>`), every value the model must
 * copy exactly (names, enum, const, default, examples) as the page wrote it.
 */
export function modelSchema(schema: Json): Json {
  return cleanSchema(schema, false);
}

/**
 * A tool the model may see and call: its name has no white space or control character (a name
 * with a line feed would write a free line into the compact prompt), and its name and every schema string (property names, enum,
 * const, default, examples ...) are free of markers and hidden characters, and so is the
 * description apart from invisible characters, which the prompt drops.
 */
export function listableTool(tool: ToolInfo): boolean {
  if (/[\s\p{Cc}\p{Zl}\p{Zp}]/u.test(tool.name)) return false;
  if (exactStrings([tool.name, tool.inputSchema ?? {}]).some(unsafePageText)) return false;
  const description = dropHidden(tool.description);
  return breakMarkers(description) === description;
}

/** A tool name as the extension quotes it back: safe characters only, at most 64. */
export function quoteName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, NAME_CAP);
}

/** For the UI: invisible characters shown as visible escapes such as [U+202E]. */
export function revealInvisible(text: string): string {
  const chars = [...text];
  return chars
    .map((char, i) => {
      const code = char.codePointAt(0) ?? 0;
      return hiddenAt(chars, i) ? `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]` : char;
    })
    .join('');
}
