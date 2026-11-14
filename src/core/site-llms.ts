// SPDX-License-Identifier: Apache-2.0
// Reads /llms.txt (llmstxt.org) line by line. No Markdown engine: the text is never turned
// into HTML, only split into a title, a summary, the provenance comment and sections of links.
// A link that is not https is kept as text without an address.

export interface LlmsLink {
  readonly text: string;
  /** Only an https address; anything else is left out. */
  readonly url?: string;
  readonly note?: string;
}

export interface LlmsSection {
  readonly name: string;
  readonly links: readonly LlmsLink[];
}

export interface Llms {
  readonly title: string;
  readonly summary?: string;
  /** From the `<!-- agsc:provenance` comment of an AgenticSystemCore node. */
  readonly provenance: Readonly<Record<string, string>>;
  readonly sections: readonly LlmsSection[];
  readonly linkCount: number;
}

const MAX_SECTIONS = 40;
const MAX_LINKS = 400;
const PROVENANCE_KEYS = [
  'bundle',
  'license',
  'terms',
  'spec_version',
  'bundle_version',
  'generated_at',
  'assistance',
];
const LINK = /^[-*]\s+\[([^\]]{1,200})\]\(([^)\s]{1,500})\)(?::\s*(.{0,300}))?/;

interface Draft {
  title?: string;
  summary?: string;
  inComment: boolean;
  provenance: Record<string, string>;
  sections: { name: string; links: LlmsLink[] }[];
  linkCount: number;
}

function link(line: string): LlmsLink | undefined {
  const match = LINK.exec(line);
  if (!match) return undefined;
  const [, text = '', url = '', note] = match;
  const out: { text: string; url?: string; note?: string } = { text };
  if (/^https:\/\//i.test(url)) out.url = url;
  if (note) out.note = note.trim();
  return out;
}

function comment(draft: Draft, line: string): boolean {
  if (!draft.inComment) {
    if (!/^<!--\s*agsc:provenance/.test(line)) return false;
    draft.inComment = !line.includes('-->');
    return true;
  }
  if (line.includes('-->')) draft.inComment = false;
  const at = line.indexOf(':');
  const key = line.slice(0, at).trim();
  if (at > 0 && PROVENANCE_KEYS.includes(key))
    draft.provenance[key] = line
      .slice(at + 1)
      .trim()
      .slice(0, 300);
  return true;
}

function addSection(draft: Draft, line: string): void {
  if (draft.sections.length < MAX_SECTIONS) {
    draft.sections.push({ name: line.slice(3).trim().slice(0, 100), links: [] });
  }
}

function addLink(draft: Draft, line: string): void {
  const last = draft.sections.at(-1);
  const item = link(line);
  if (!last || !item || draft.linkCount >= MAX_LINKS) return;
  last.links.push(item);
  draft.linkCount += 1;
}

function addLine(draft: Draft, line: string): void {
  if (comment(draft, line)) return;
  if (line.startsWith('# ')) draft.title ??= line.slice(2).trim().slice(0, 200);
  else if (line.startsWith('> ')) draft.summary ??= line.slice(2).trim().slice(0, 600);
  else if (line.startsWith('## ')) addSection(draft, line);
  else addLink(draft, line);
}

/** The parsed file, or undefined when it has no title line (not usable). */
export function parseLlms(text: string): Llms | undefined {
  const draft: Draft = { inComment: false, provenance: {}, sections: [], linkCount: 0 };
  for (const raw of text.split(/\r?\n/)) addLine(draft, raw.trim());
  if (draft.title === undefined || draft.title === '') return undefined;
  return {
    title: draft.title,
    ...(draft.summary === undefined ? {} : { summary: draft.summary }),
    provenance: draft.provenance,
    sections: draft.sections,
    linkCount: draft.linkCount,
  };
}
