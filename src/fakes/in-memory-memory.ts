// SPDX-License-Identifier: Apache-2.0
import type { Memory, ToolStat } from '../core/ports/memory';
import type { ChatMessage } from '../core/types';

/** Memory kept in two Maps; the same behaviour as the IndexedDB adapter. */
export class InMemoryMemory implements Memory {
  private readonly stats = new Map<string, ToolStat>();
  private readonly chats = new Map<string, readonly ChatMessage[]>();

  recordToolResult(origin: string, tool: string, ok: boolean, at: string): Promise<void> {
    const key = JSON.stringify([origin, tool]);
    const old = this.stats.get(key) ?? { tool, ok: 0, failed: 0, lastAt: at };
    this.stats.set(key, {
      tool,
      ok: old.ok + (ok ? 1 : 0),
      failed: old.failed + (ok ? 0 : 1),
      lastAt: at,
    });
    return Promise.resolve();
  }

  history(origin: string): Promise<readonly ToolStat[]> {
    const rows = [...this.stats.entries()]
      .filter(([key]) => (JSON.parse(key) as string[])[0] === origin)
      .map(([, stat]) => stat)
      .sort((a, b) => a.tool.localeCompare(b.tool));
    return Promise.resolve(rows);
  }

  saveChat(origin: string, messages: readonly ChatMessage[]): Promise<void> {
    this.chats.set(origin, [...messages]);
    return Promise.resolve();
  }

  loadChat(origin: string): Promise<readonly ChatMessage[]> {
    return Promise.resolve(this.chats.get(origin) ?? []);
  }

  clear(origin?: string): Promise<void> {
    if (origin === undefined) {
      this.stats.clear();
      this.chats.clear();
      return Promise.resolve();
    }
    this.chats.delete(origin);
    for (const key of [...this.stats.keys()]) {
      if ((JSON.parse(key) as string[])[0] === origin) this.stats.delete(key);
    }
    return Promise.resolve();
  }
}
