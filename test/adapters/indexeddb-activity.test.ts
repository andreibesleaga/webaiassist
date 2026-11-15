// SPDX-License-Identifier: Apache-2.0
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openIndexedDbActivity } from '../../src/adapters/indexeddb-activity';
import { record } from '../helpers-activity';

const A = 'https://a.example';
const B = 'https://b.example';

describe('IndexedDB activity log', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('starts empty, with "include content" off', async () => {
    const log = await openIndexedDbActivity();
    expect(await log.list()).toEqual([]);
    expect(await log.includeContent()).toBe(false);
  });

  it('keeps entries and lists them oldest first', async () => {
    const log = await openIndexedDbActivity();
    await log.append(record({ id: 'b', at: '2026-01-15T11:00:00.000Z' }));
    await log.append(record({ id: 'a', at: '2026-01-15T10:00:00.000Z' }));
    expect((await log.list()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('remembers the "include content" choice', async () => {
    const log = await openIndexedDbActivity();
    await log.setIncludeContent(true);
    expect(await (await openIndexedDbActivity()).includeContent()).toBe(true);
    await log.setIncludeContent(false);
    expect(await log.includeContent()).toBe(false);
  });

  it('forgets one site and leaves the others', async () => {
    const log = await openIndexedDbActivity();
    await log.append(record({ id: 'a', origin: A }));
    await log.append(record({ id: 'b', origin: B }));
    await log.forgetSite(A);
    expect((await log.list()).map((r) => r.id)).toEqual(['b']);
  });

  it('clears every entry but keeps the "include content" choice', async () => {
    const log = await openIndexedDbActivity();
    await log.setIncludeContent(true);
    await log.append(record({ id: 'a' }));
    await log.clear();
    expect(await log.list()).toEqual([]);
    expect(await log.includeContent()).toBe(true);
  });

  it('removes the oldest entries when the cap is passed, never the newest', async () => {
    const log = await openIndexedDbActivity('test-cap', 2500);
    for (const [id, hour] of [
      ['a', 10],
      ['b', 11],
      ['c', 12],
    ] as const) {
      await log.append(record({ id, at: `2026-01-15T${hour}:00:00.000Z`, bytes: 1000 }));
    }
    expect((await log.list()).map((r) => r.id)).toEqual(['b', 'c']);
    await log.append(record({ id: 'big', at: '2026-01-15T13:00:00.000Z', bytes: 9000 }));
    expect((await log.list()).map((r) => r.id)).toEqual(['big']);
  });
});
