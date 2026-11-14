// SPDX-License-Identifier: Apache-2.0
// Memory adapter on IndexedDB (through the `idb` wrapper). One database per extension,
// shared by the side panel, the service worker and the offscreen document.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Memory, ToolStat } from '../core/ports/memory';
import type { ChatMessage } from '../core/types';

interface StatRow extends ToolStat {
  readonly origin: string;
}

interface MemorySchema extends DBSchema {
  chats: { key: string; value: { origin: string; messages: ChatMessage[] } };
  toolStats: { key: [string, string]; value: StatRow; indexes: { byOrigin: string } };
}

const VERSION = 1;

function upgrade(db: IDBPDatabase<MemorySchema>): void {
  db.createObjectStore('chats', { keyPath: 'origin' });
  const stats = db.createObjectStore('toolStats', { keyPath: ['origin', 'tool'] });
  stats.createIndex('byOrigin', 'origin');
}

class IndexedDbMemory implements Memory {
  constructor(private readonly db: IDBPDatabase<MemorySchema>) {}

  async recordToolResult(origin: string, tool: string, ok: boolean, at: string): Promise<void> {
    const tx = this.db.transaction('toolStats', 'readwrite');
    const old = await tx.store.get([origin, tool]);
    await tx.store.put({
      origin,
      tool,
      ok: (old?.ok ?? 0) + (ok ? 1 : 0),
      failed: (old?.failed ?? 0) + (ok ? 0 : 1),
      lastAt: at,
    });
    await tx.done;
  }

  async history(origin: string): Promise<readonly ToolStat[]> {
    const rows = await this.db.getAllFromIndex('toolStats', 'byOrigin', origin);
    return rows
      .map(({ tool, ok, failed, lastAt }) => ({ tool, ok, failed, lastAt }))
      .sort((a, b) => a.tool.localeCompare(b.tool));
  }

  async saveChat(origin: string, messages: readonly ChatMessage[]): Promise<void> {
    await this.db.put('chats', { origin, messages: [...messages] });
  }

  async loadChat(origin: string): Promise<readonly ChatMessage[]> {
    return (await this.db.get('chats', origin))?.messages ?? [];
  }

  async clear(origin?: string): Promise<void> {
    const tx = this.db.transaction(['chats', 'toolStats'], 'readwrite');
    if (origin === undefined) {
      await Promise.all([tx.objectStore('chats').clear(), tx.objectStore('toolStats').clear()]);
    } else {
      const stats = tx.objectStore('toolStats');
      const keys = await stats.index('byOrigin').getAllKeys(origin);
      await Promise.all([
        tx.objectStore('chats').delete(origin),
        ...keys.map((k) => stats.delete(k)),
      ]);
    }
    await tx.done;
  }
}

export async function openIndexedDbMemory(name = 'webaiassist'): Promise<Memory> {
  const db = await openDB<MemorySchema>(name, VERSION, { upgrade });
  return new IndexedDbMemory(db);
}
