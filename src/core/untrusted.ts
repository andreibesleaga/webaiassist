// SPDX-License-Identifier: Apache-2.0
// Tool results are data from the page. They are fenced so the model can tell them from
// instructions, capped in length, and cleaned (sanitize.ts): every `<` is escaped, so the
// text cannot close the fence early or write the model's own turn markers.
import { cleanPageText, quoteName } from './sanitize';

export const RESULT_CAP = 4000;

/** The fence name for page text from "read this page". */
export const PAGE_TEXT_TOOL = 'read-this-page';

function cap(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n[cut: ${text.length - limit} more characters]`;
}

export function wrapUntrusted(toolName: string, text: string, limit: number = RESULT_CAP): string {
  const body = cleanPageText(cap(text, limit));
  return `<tool-result tool="${quoteName(toolName)}" trust="untrusted">\n${body}\n</tool-result>`;
}

const SAVED_FENCE = /^<tool-result tool="[^"<>]*" trust="untrusted">\n([\s\S]*)\n<\/tool-result>$/;
/** The fence name for a saved result that came back without a valid fence. */
const SAVED_TOOL = 'saved-result';

/**
 * A tool message from the saved chat as the model should see it. A result saved by this
 * extension is already fenced and comes back unchanged; anything else (an older save, a
 * changed store, a forged fence) is cleaned and fenced again as untrusted data.
 */
export function fenceSavedResult(content: string): string {
  const body = SAVED_FENCE.exec(content)?.[1];
  if (body !== undefined && cleanPageText(body) === body) return content;
  return wrapUntrusted(SAVED_TOOL, content);
}
