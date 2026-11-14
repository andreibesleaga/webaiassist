// SPDX-License-Identifier: Apache-2.0
// Memory adapter for "memory off" in Options: records nothing and remembers nothing.
import type { Memory, ToolStat } from '../core/ports/memory';
import type { ChatMessage } from '../core/types';

export class NoMemory implements Memory {
  recordToolResult(_origin: string, _tool: string, _ok: boolean, _at: string): Promise<void> {
    return Promise.resolve();
  }

  history(_origin: string): Promise<readonly ToolStat[]> {
    return Promise.resolve([]);
  }

  saveChat(_origin: string, _messages: readonly ChatMessage[]): Promise<void> {
    return Promise.resolve();
  }

  loadChat(_origin: string): Promise<readonly ChatMessage[]> {
    return Promise.resolve([]);
  }

  clear(_origin?: string): Promise<void> {
    return Promise.resolve();
  }
}
