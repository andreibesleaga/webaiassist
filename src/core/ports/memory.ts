// SPDX-License-Identifier: Apache-2.0
import type { ChatMessage } from '../types';

/** How often one tool worked on one site. */
export interface ToolStat {
  readonly tool: string;
  readonly ok: number;
  readonly failed: number;
  readonly lastAt: string;
}

/** Port: what the extension remembers per site (origin). */
export interface Memory {
  recordToolResult(origin: string, tool: string, ok: boolean, at: string): Promise<void>;
  history(origin: string): Promise<readonly ToolStat[]>;
  saveChat(origin: string, messages: readonly ChatMessage[]): Promise<void>;
  loadChat(origin: string): Promise<readonly ChatMessage[]>;
  /** Forgets one site, or every site when `origin` is left out. */
  clear(origin?: string): Promise<void>;
}
