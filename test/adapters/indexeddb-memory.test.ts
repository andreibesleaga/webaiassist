// SPDX-License-Identifier: Apache-2.0
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openIndexedDbMemory } from '../../src/adapters/indexeddb-memory';

const A = 'https://a.example';
const B = 'https://b.example';
const T1 = '2026-01-15T10:00:00.000Z';
const T2 = '2026-01-15T11:00:00.000Z';

describe('IndexedDB memory adapter', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('starts empty', async () => {
    const memory = await openIndexedDbMemory();
    expect(await memory.history(A)).toEqual([]);
    expect(await memory.loadChat(A)).toEqual([]);
  });

  it('counts successes and failures per site and tool', async () => {
    const memory = await openIndexedDbMemory();
    await memory.recordToolResult(A, 'search', true, T1);
    await memory.recordToolResult(A, 'search', false, T2);
    await memory.recordToolResult(A, 'read', true, T1);
    await memory.recordToolResult(B, 'search', true, T1);
    expect(await memory.history(A)).toEqual([
      { tool: 'read', ok: 1, failed: 0, lastAt: T1 },
      { tool: 'search', ok: 1, failed: 1, lastAt: T2 },
    ]);
    expect(await memory.history(B)).toEqual([{ tool: 'search', ok: 1, failed: 0, lastAt: T1 }]);
  });

  it('saves and loads the chat of one site, replacing the old one', async () => {
    const memory = await openIndexedDbMemory();
    await memory.saveChat(A, [{ role: 'user', content: 'first' }]);
    await memory.saveChat(A, [{ role: 'user', content: 'second' }]);
    expect(await memory.loadChat(A)).toEqual([{ role: 'user', content: 'second' }]);
    expect(await memory.loadChat(B)).toEqual([]);
  });

  it('keeps data across a reopen of the same database', async () => {
    const first = await openIndexedDbMemory('webaiassist-test');
    await first.recordToolResult(A, 'search', true, T1);
    const second = await openIndexedDbMemory('webaiassist-test');
    expect(await second.history(A)).toHaveLength(1);
  });

  it('clears one site, or every site', async () => {
    const memory = await openIndexedDbMemory();
    await memory.recordToolResult(A, 'search', true, T1);
    await memory.recordToolResult(B, 'search', true, T1);
    await memory.saveChat(A, [{ role: 'user', content: 'hi' }]);
    await memory.clear(A);
    expect(await memory.history(A)).toEqual([]);
    expect(await memory.loadChat(A)).toEqual([]);
    expect(await memory.history(B)).toHaveLength(1);
    await memory.clear();
    expect(await memory.history(B)).toEqual([]);
  });
});
