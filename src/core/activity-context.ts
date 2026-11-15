// SPDX-License-Identifier: Apache-2.0
// Sizes for the activity log: bytes of a text and the estimated split of a request's tokens.
import { estimateTokens } from './history';
import type { ContextUse } from './ports/activity-log';
import { SITE_BACKGROUND } from './tool-rules';
import type { ChatMessage } from './types';
import { PAGE_TEXT_TOOL } from './untrusted';

/** Where the tool list starts in the system message (prompt.ts and compact-prompt.ts). */
const TOOL_LIST_START = /\n(?:Tools on this page|No tools are available|Tools, as name)/;

/** Size in UTF-8 bytes. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Estimated tokens of one request by part. The system message is split at the tool list. */
export function contextUse(messages: readonly ChatMessage[], reply: string): ContextUse {
  let instructions = 0;
  let tools = 0;
  let site = 0;
  let chat = 0;
  for (const message of messages) {
    if (message.role === 'system') {
      const at = message.content.search(TOOL_LIST_START);
      const rest = at < 0 ? '' : message.content.slice(at);
      instructions += estimateTokens(at < 0 ? message.content : message.content.slice(0, at));
      tools += rest === '' ? 0 : estimateTokens(rest);
    } else if (message.role === 'tool' && isSiteText(message.content)) {
      site += estimateTokens(message.content);
    } else {
      chat += estimateTokens(message.content);
    }
  }
  return { instructions, tools, site, chat, reply: estimateTokens(reply) };
}

/** The site files and the page text the user asked to read, as the loop gives them. */
function isSiteText(content: string): boolean {
  return content.startsWith(SITE_BACKGROUND) || content.includes(`tool="${PAGE_TEXT_TOOL}"`);
}
