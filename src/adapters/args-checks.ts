// SPDX-License-Identifier: Apache-2.0
// Rules both ArgsValidator adapters share. (1) A tool schema comes from the page, and the
// side panel runs its `pattern` regular expressions on its own thread: a pattern that can
// backtrack for minutes (nested quantifiers such as `^(a+)+$`) would freeze the panel and its
// Stop button, so such a schema is refused before any pattern runs. (2) Validator messages go
// back to the model in a repair turn: they give the path and the keyword only, never text
// from the schema (an `enum` value or a `pattern` is page text).
import { quoteName } from '../core/sanitize';
import type { JsonSchema } from '../core/types';

export const MAX_PATTERN_LENGTH = 200;
export const RISKY_PATTERN =
  'the tool schema has a pattern WebAIAssist does not run (too long or nested repetition)';

/** Back-references can make any engine backtrack. */
const BACKREFERENCE = /\\[1-9]|\\k</;
/** Three quantified atoms in a row (`a*a*a*`, `\d+\s?\d+`) backtrack polynomially. */
const MAX_QUANTIFIED_RUN = 3;

/** One open group while scanning: does anything inside it repeat or offer alternatives? */
interface Group {
  repeats: boolean;
  choice: boolean;
}

/** Scanner state: open groups (paren depth), the group just closed, quantified atoms in a row. */
interface Scan {
  readonly groups: Group[];
  closed: Group | undefined;
  run: number;
  quantified: boolean;
}

/** Index after the character class that starts at `i` (`[...]`, escapes inside). */
function classEnd(pattern: string, i: number): number {
  let j = i + 1;
  while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1;
  return j + 1;
}

/** Index after a quantifier at `i`: `+`, `*`, `?` or `{n,m}`, with a lazy or possessive mark. */
function quantifierEnd(pattern: string, i: number): number {
  let j = pattern[i] === '{' ? pattern.indexOf('}', i) + 1 || pattern.length : i + 1;
  if (pattern[j] === '?' || pattern[j] === '+') j += 1;
  return j;
}

/** Index after `(` and its prefix: `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<name>`. */
function groupStart(pattern: string, i: number): number {
  if (pattern[i + 1] !== '?') return i + 1;
  if (pattern[i + 2] === '<' && /[A-Za-z]/.test(pattern[i + 3] ?? '')) {
    return pattern.indexOf('>', i) + 1 || pattern.length;
  }
  return i + (pattern[i + 2] === '<' ? 4 : 3);
}

function atom(scan: Scan): void {
  if (!scan.quantified) scan.run = 0;
  scan.quantified = false;
  scan.closed = undefined;
}

/** A quantifier: true when it makes the pattern risky. */
function quantifier(scan: Scan, char: string): boolean {
  const closed = scan.closed;
  const top = scan.groups.at(-1);
  if (top) top.repeats = true;
  scan.run += 1;
  scan.quantified = true;
  scan.closed = undefined;
  const repeatedGroup = closed !== undefined && char !== '?';
  return (repeatedGroup && (closed.repeats || closed.choice)) || scan.run >= MAX_QUANTIFIED_RUN;
}

function closeGroup(scan: Scan): void {
  const group = scan.groups.pop() ?? { repeats: false, choice: false };
  const parent = scan.groups.at(-1);
  if (parent && group.repeats) parent.repeats = true;
  atom(scan);
  scan.closed = group;
}

/** One step of the scan at `i`; returns the next index, or -1 when the pattern is risky. */
function step(pattern: string, i: number, scan: Scan): number {
  const char = pattern[i] ?? '';
  if ('+*?{'.includes(char)) return quantifier(scan, char) ? -1 : quantifierEnd(pattern, i);
  if (char === '(') {
    atom(scan);
    scan.groups.push({ repeats: false, choice: false });
    return groupStart(pattern, i);
  }
  if (char === ')') return (closeGroup(scan), i + 1);
  if (char === '|') {
    const top = scan.groups.at(-1);
    if (top) top.choice = true;
    scan.run = 0;
    scan.quantified = false;
    return i + 1;
  }
  atom(scan);
  if (char === '[') return classEnd(pattern, i);
  return i + (char === '\\' ? 2 : 1);
}

/**
 * True for a pattern the extension will not run: too long, a back-reference, a repeated group
 * that contains a quantifier or alternatives at any depth (`(a+)+`, `((a+))+`, `(a+b?)+`,
 * `(a|aa)+`), or three quantified atoms in a row. Groups are tracked by paren depth.
 */
export function riskyPattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH || BACKREFERENCE.test(pattern)) return true;
  const scan: Scan = { groups: [], closed: undefined, run: 0, quantified: false };
  for (let i = 0; i < pattern.length;) {
    i = step(pattern, i, scan);
    if (i < 0) return true;
  }
  return false;
}

/** The patterns a schema would run: `pattern` values and `patternProperties` keys. */
function patternsOf(value: unknown, out: string[]): string[] {
  if (Array.isArray(value)) value.forEach((item) => patternsOf(item, out));
  if (typeof value !== 'object' || value === null) return out;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'pattern' && typeof item === 'string') out.push(item);
    if (key === 'patternProperties' && typeof item === 'object' && item !== null) {
      out.push(...Object.keys(item));
    }
    patternsOf(item, out);
  }
  return out;
}

/** True when the schema holds a pattern the extension will not run. */
export function hasRiskyPattern(schema: JsonSchema): boolean {
  return patternsOf(schema, []).some(riskyPattern);
}

/** One validator message: where, which keyword, and for `required` the missing name. */
export function errorLine(path: string, keyword: string, missing?: string): string {
  const where = path === '' || path === '#' ? '(arguments)' : quoteName(path);
  const name = missing === undefined ? '' : ` (missing "${quoteName(missing)}")`;
  return `${where} fails "${quoteName(keyword)}"${name}`;
}
