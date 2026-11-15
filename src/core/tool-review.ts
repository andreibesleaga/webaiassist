// SPDX-License-Identifier: Apache-2.0
// The tool security review: every tool is checked, when it arrives, against the written rules
// in docs/TOOL-REVIEW.md. A tool with a finding is marked in the list and in the question, and
// is never run without a question, in any confirmation mode (gate.ts mustAsk). The rules only
// read the definition the page gave (name, title, description, fields, hints); they run no
// page code and make no request. The findings are ids and short fixed words: the texts the
// user reads are in src/ui/messages-parity-en.ts. A finding is a reason to look twice, not
// proof of harm, and a clean review is not proof of safety (docs/TOOL-REVIEW.md, "Gaps").
import { sameTool } from './gate';
import { hasHiddenCharacters } from './sanitize';
import type { ToolFlag, ToolInfo } from './types';

export type FlagId =
  | 'hidden-characters'
  | 'instructions'
  | 'names-other-tool'
  | 'look-alike'
  | 'link'
  | 'encoded'
  | 'read-only-contradicted'
  | 'oversized'
  | 'changed';

/** Limits that keep a hostile definition from costing time: text read per string and in all. */
const TEXT_CAP = 12_000;
const MAX_TEXTS = 300;
const DEPTH_CAP = 8;
const DESCRIPTION_LIMIT = 2000;
const NAME_LIMIT = 64;
const SCHEMA_LIMIT = 8000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every string value of a schema (keys excluded), bounded in depth and number. */
function schemaTexts(value: unknown, out: string[], depth = 0): void {
  if (out.length >= MAX_TEXTS || depth > DEPTH_CAP) return;
  if (typeof value === 'string') out.push(value.slice(0, TEXT_CAP));
  else if (Array.isArray(value)) value.forEach((item) => schemaTexts(item, out, depth + 1));
  else if (isRecord(value))
    Object.values(value).forEach((item) => schemaTexts(item, out, depth + 1));
}

/** The texts a page wrote for a tool: title, description, and the strings of its fields. */
function textsOf(tool: ToolInfo): string[] {
  const out = [tool.title ?? '', tool.description.slice(0, TEXT_CAP)];
  schemaTexts(tool.inputSchema, out);
  return out;
}

const matchesAny = (texts: readonly string[], rules: readonly RegExp[]): boolean =>
  texts.some((text) => rules.some((rule) => rule.test(text)));

/** Rule 2: sentences that address the model, not the user of the tool. */
const INSTRUCTIONS: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:instructions?|rules?|prompts?|guidelines?|above|previous|prior)\b/i,
  /\b(?:do not|don't|never)\s+(?:tell|inform|mention|show|reveal|let)\b[^.\n]{0,30}\b(?:user|human|person|owner)\b/i,
  /\b(?:always|first|immediately)\s+(?:call|run|use|invoke|execute)\b/i,
  /\bbefore\s+(?:answering|replying|responding|using\s+any\s+other\s+tool)\b/i,
  /\bwithout\s+(?:asking|telling|informing|confirmation|permission)\b/i,
  /\b(?:send|post|forward|upload|leak|exfiltrate)\b[^.\n]{0,40}\b(?:conversation|chat|history|messages?|password|secrets?|credentials?|api key)\b/i,
  /\b(?:system prompt|developer message|your instructions|new instructions?)\b/i,
  /\byou are now\b/i,
];

/** Rule 5: web addresses, markdown links, data and script addresses. */
const LINKS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]{1,15}:\/\/\S/i,
  /\bwww\.[a-z0-9]/i,
  /\]\(/,
  /\bdata:[a-z]+\/[a-z0-9.+-]+[;,]/i,
  /\bjavascript:/i,
];

/** Rule 6: long base64 or hex runs, percent, \u and numeric-entity escapes, decoders. */
const ENCODED: readonly RegExp[] = [
  /[A-Za-z0-9+/]{40,}={0,2}/,
  /\b[0-9a-f]{32,}\b/i,
  /(?:%[0-9a-f]{2}){4,}/i,
  /(?:\\u[0-9a-f]{4}){3,}/i,
  /(?:&#x?[0-9a-f]{1,6};){3,}/i,
  /\b(?:atob|btoa|fromCharCode|eval)\s*\(/,
];

/** Rule 7: words in a name that say the tool changes something. */
const CHANGE_VERBS = new Set(
  (
    'delete remove drop destroy erase wipe purge send publish pay purchase buy checkout ' +
    'transfer withdraw submit create add update set write save edit insert cancel approve reject ' +
    'reset grant revoke invite share upload email notify reserve subscribe unsubscribe'
  ).split(' '),
);
const SECRET_FIELD = /^(?:password|passwd|passphrase|cvv|cvc|iban|ssn|cardnumber|creditcard)/;

/** Rule 4: words a look-alike name imitates. */
const SENSITIVE_WORDS = (
  'delete remove pay paypal payment password login logout transfer send purchase checkout ' +
  'account admin bank wallet submit order buy confirm approve'
).split(' ');

/** Confusable characters brought to one form: I, l, 1, | -> l; O, 0 -> o; rn -> m; vv -> w. */
export function skeleton(text: string): string {
  let out = '';
  for (const char of text) {
    if ('Il1|'.includes(char)) out += 'l';
    else if ('O0'.includes(char)) out += 'o';
    else out += char.toLowerCase();
  }
  return out.replace(/rn/g, 'm').replace(/vv/g, 'w');
}

const SENSITIVE_SKELETONS = new Map(SENSITIVE_WORDS.map((word) => [skeleton(word), word]));

/** The sensitive word a name imitates (written differently from it), if any. */
function imitatedWord(name: string): string | undefined {
  for (const word of name.split(/[_.-]+/)) {
    const sensitive = SENSITIVE_SKELETONS.get(skeleton(word));
    if (sensitive !== undefined && word.toLowerCase() !== skeleton(word)) return sensitive;
  }
  return undefined;
}

/** Two tools of one page whose names differ only in case or confusable characters. */
function collides(name: string, peers: readonly ToolInfo[]): boolean {
  return peers.some(
    (peer) =>
      peer.name !== name &&
      (peer.name.toLowerCase() === name.toLowerCase() || skeleton(peer.name) === skeleton(name)),
  );
}

function lookAlike(tool: ToolInfo, peers: readonly ToolInfo[]): ToolFlag | undefined {
  const word = imitatedWord(tool.name);
  if (word !== undefined) return { id: 'look-alike', detail: word };
  return collides(tool.name, peers) ? { id: 'look-alike' } : undefined;
}

const words = (name: string): string[] =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z]+/);

const readOnly = (tool: ToolInfo): boolean => tool.annotations?.readOnlyHint === true;

/** The word of the name, or the secret field, that contradicts a read-only mark. */
function contradiction(tool: ToolInfo): string | undefined {
  if (!readOnly(tool)) return undefined;
  const verb = [...words(tool.name), ...words(tool.title ?? '')]
    .map((word) => (word.endsWith('s') ? word.slice(0, -1) : word))
    .find((word) => CHANGE_VERBS.has(word));
  if (verb !== undefined) return verb;
  const fields = isRecord(tool.inputSchema?.properties)
    ? Object.keys(tool.inputSchema.properties)
    : [];
  return fields
    .map((f) => f.toLowerCase().replace(/[^a-z]/g, ''))
    .find((f) => SECRET_FIELD.test(f));
}

const CALL_WORDS =
  /\b(?:call|run|use|invoke|execute|trigger)\s+(?:the\s+)?(?:tool\s+)?[`'"]?([A-Za-z0-9_.-]{2,128})/gi;

/** A text that tells the model to call another tool of this page, by name. */
function namedOtherTool(tool: ToolInfo, peers: readonly ToolInfo[]): string | undefined {
  const names = new Set(peers.map((peer) => peer.name));
  for (const text of textsOf(tool)) {
    for (const found of text.matchAll(CALL_WORDS)) {
      const name = (found[1] ?? '').replace(/[.-]+$/, '');
      if (name !== tool.name && names.has(name)) return name;
    }
  }
  return undefined;
}

const schemaSize = (tool: ToolInfo): number => JSON.stringify(tool.inputSchema ?? {}).length;

const oversized = (tool: ToolInfo): boolean =>
  tool.description.length > DESCRIPTION_LIMIT ||
  tool.name.length > NAME_LIMIT ||
  schemaSize(tool) > SCHEMA_LIMIT;

/** The findings of one tool among `peers` (the tools of its page), in a fixed order. */
export function reviewTool(tool: ToolInfo, peers: readonly ToolInfo[]): ToolFlag[] {
  const texts = textsOf(tool);
  const contradicted = contradiction(tool);
  const other = namedOtherTool(tool, peers);
  const alike = lookAlike(tool, peers);
  const flags: (ToolFlag | undefined)[] = [
    hasHiddenCharacters(`${tool.title ?? ''}${tool.description}`)
      ? { id: 'hidden-characters' }
      : undefined,
    matchesAny(texts, INSTRUCTIONS) ? { id: 'instructions' } : undefined,
    other === undefined ? undefined : { id: 'names-other-tool', detail: other },
    alike,
    matchesAny(texts, LINKS) ? { id: 'link' } : undefined,
    matchesAny(texts, ENCODED) ? { id: 'encoded' } : undefined,
    contradicted === undefined ? undefined : { id: 'read-only-contradicted', detail: contradicted },
    oversized(tool) ? { id: 'oversized' } : undefined,
  ];
  return flags.filter((flag): flag is ToolFlag => flag !== undefined);
}

/**
 * Rule 9: remembers the first definition of each tool of each site (for this panel only, at
 * most `cap` tools) and names the tools whose definition is not that one any more.
 */
export class DefinitionLedger {
  private readonly first = new Map<string, ToolInfo>();

  constructor(private readonly cap = 2000) {}

  get size(): number {
    return this.first.size;
  }

  changed(origin: string, tools: readonly ToolInfo[]): Set<string> {
    const out = new Set<string>();
    for (const tool of tools) {
      const key = `${origin}\n${tool.name}`;
      const known = this.first.get(key);
      if (known === undefined) {
        if (this.first.size < this.cap) this.first.set(key, tool);
      } else if (!sameTool(known, tool)) out.add(tool.name);
    }
    return out;
  }
}

/** A copy of the tool without any `review`: a page cannot write the review. */
function withoutReview(tool: ToolInfo): ToolInfo {
  const { review: _ignored, ...rest } = tool;
  return rest;
}

/**
 * The tools of one page with their findings written on them (`review`), nothing else changed.
 * A tool without a finding is returned as it is. The ledger, when given, adds rule 9.
 */
export function reviewTools(
  tools: readonly ToolInfo[],
  origin: string,
  ledger?: DefinitionLedger,
): ToolInfo[] {
  const changed = ledger?.changed(origin, tools) ?? new Set<string>();
  return tools.map((tool) => {
    const flags = reviewTool(tool, tools);
    if (changed.has(tool.name)) flags.push({ id: 'changed' });
    if (flags.length > 0) return { ...withoutReview(tool), review: flags };
    return tool.review === undefined ? tool : withoutReview(tool);
  });
}
