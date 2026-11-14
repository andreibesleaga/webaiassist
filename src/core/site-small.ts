// SPDX-License-Identifier: Apache-2.0
// Readers for three small site files: the A2A agent card, security.txt (RFC 9116) and the
// TDMRep reservation file. Each keeps only the few text members it shows. No address in them
// is ever fetched or used; the extension does not speak A2A and sends no mail.
import { parseAddress } from './site-url';

export interface AgentCard {
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly skills: readonly string[];
}

const MAX_SKILLS = 10;
type Entry = Record<string, unknown>;
const isEntry = (value: unknown): value is Entry =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const cut = (value: unknown, limit: number): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, limit) : undefined;

function json(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function skillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value.map((skill) => (isEntry(skill) ? cut(skill.name, 60) : undefined));
  return names.filter((name): name is string => name !== undefined).slice(0, MAX_SKILLS);
}

/** The card's name, description, version and skill names; undefined when it has no name. */
export function parseAgentCard(raw: string): AgentCard | undefined {
  const card = json(raw);
  const name = isEntry(card) ? cut(card.name, 100) : undefined;
  if (!isEntry(card) || name === undefined) return undefined;
  const description = cut(card.description, 400);
  const version = cut(card.version, 40);
  return {
    name,
    skills: skillNames(card.skills),
    ...(description === undefined ? {} : { description }),
    ...(version === undefined ? {} : { version }),
  };
}

export interface SecurityTxt {
  /** Shown as text; never opened and never mailed. */
  readonly contacts: readonly string[];
  readonly policy?: string;
  readonly expires?: string;
  /** True when `Expires` is in the past; undefined when it is missing or unreadable. */
  readonly expired?: boolean;
}

const MAX_LINES = 1000;
const MAX_FIELD = 2048;

function fieldsOf(raw: string): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const line of raw.split(/\r?\n/).slice(0, MAX_LINES)) {
    if (line.startsWith('-----BEGIN PGP SIGNATURE')) break;
    const at = line.indexOf(':');
    if (line.startsWith('#') || at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const list = fields.get(key) ?? [];
    list.push(
      line
        .slice(at + 1)
        .trim()
        .slice(0, MAX_FIELD),
    );
    fields.set(key, list);
  }
  return fields;
}

function expiry(
  value: string | undefined,
  nowMs: number,
): Pick<SecurityTxt, 'expires' | 'expired'> {
  const time = value === undefined ? Number.NaN : Date.parse(value);
  if (Number.isNaN(time)) return {};
  return { expires: new Date(time).toISOString(), expired: time < nowMs };
}

/** Contact, Policy and Expires; undefined when Canonical names another site or no Contact is given. */
export function parseSecurityTxt(
  raw: string,
  origin: string,
  nowMs: number,
): SecurityTxt | undefined {
  const fields = fieldsOf(raw);
  const canonical = fields.get('canonical') ?? [];
  if (canonical.length > 0 && !canonical.some((c) => parseAddress(c)?.origin === origin))
    return undefined;
  const contacts = (fields.get('contact') ?? []).slice(0, 3);
  if (contacts.length === 0) return undefined;
  const policy = fields.get('policy')?.[0];
  return { contacts, ...(policy ? { policy } : {}), ...expiry(fields.get('expires')?.[0], nowMs) };
}

/** True when the first matching entry of a TDMRep file reserves rights for `path`. */
export function tdmReserved(raw: string, path: string): boolean | undefined {
  const rules = json(raw);
  if (!Array.isArray(rules)) return undefined;
  for (const rule of rules) {
    if (!isEntry(rule) || typeof rule.location !== 'string') continue;
    const value = rule['tdm-reservation'];
    const covers = rule.location === '/' || path.startsWith(rule.location);
    if (covers && (value === 0 || value === 1)) return value === 1;
  }
  return undefined;
}
