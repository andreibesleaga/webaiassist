// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { ACTIVITY_CAP_BYTES, overflow } from '../../src/core/activity-cap';

const entry = (id: string, bytes: number) => ({ id, bytes });

describe('overflow', () => {
  it('removes nothing while the log fits', () => {
    expect(overflow([entry('a', 10), entry('b', 10)], 20)).toEqual([]);
  });

  it('removes the oldest entries first, only as many as needed', () => {
    expect(overflow([entry('a', 10), entry('b', 10), entry('c', 10)], 25)).toEqual(['a']);
    expect(overflow([entry('a', 10), entry('b', 10), entry('c', 10)], 12)).toEqual(['a', 'b']);
  });

  it('never removes the newest entry, even when it alone is over the cap', () => {
    expect(overflow([entry('a', 10), entry('b', 100)], 20)).toEqual(['a']);
    expect(overflow([entry('only', 100)], 20)).toEqual([]);
  });

  it('has a documented default cap', () => {
    expect(ACTIVITY_CAP_BYTES).toBe(8 * 1024 * 1024);
    expect(overflow([entry('a', ACTIVITY_CAP_BYTES), entry('b', 1)])).toEqual(['a']);
  });
});
