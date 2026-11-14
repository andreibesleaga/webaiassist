// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { NoMemory } from '../../src/adapters/no-memory';
import { InMemoryMemory } from '../../src/fakes/in-memory-memory';

describe('NoMemory (memory turned off in Options)', () => {
  it('keeps nothing', async () => {
    const memory = new NoMemory();
    await memory.recordToolResult('https://a.example', 'search', true, '2026-01-15T10:00:00.000Z');
    await memory.saveChat('https://a.example', [{ role: 'user', content: 'hi' }]);
    expect(await memory.history('https://a.example')).toEqual([]);
    expect(await memory.loadChat('https://a.example')).toEqual([]);
    await expect(memory.clear()).resolves.toBeUndefined();
  });
});

describe('InMemoryMemory.clear', () => {
  it('clears one site, or every site', async () => {
    const memory = new InMemoryMemory();
    await memory.recordToolResult('https://a.example', 's', true, 't');
    await memory.recordToolResult('https://b.example', 's', true, 't');
    await memory.saveChat('https://a.example', [{ role: 'user', content: 'x' }]);
    await memory.clear('https://a.example');
    expect(await memory.history('https://a.example')).toEqual([]);
    expect(await memory.loadChat('https://a.example')).toEqual([]);
    expect(await memory.history('https://b.example')).toHaveLength(1);
    await memory.clear();
    expect(await memory.history('https://b.example')).toEqual([]);
  });
});
