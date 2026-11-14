// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { countEffects, toolRow, toolRows, visible } from '../../src/core/tool-card';
import type { ToolInfo } from '../../src/core/types';

const tool = (
  name: string,
  description: string,
  annotations?: ToolInfo['annotations'],
): ToolInfo => ({
  name,
  description,
  ...(annotations ? { annotations } : {}),
});

describe('toolRow', () => {
  it('says "reads" only for a read-only tool that is not consequential', () => {
    expect(toolRow(tool('a', 'x', { readOnlyHint: true })).effect).toBe('reads');
    expect(toolRow(tool('a', 'x', { readOnlyHint: true, consequentialHint: true })).effect).toBe(
      'changes',
    );
    expect(toolRow(tool('a', 'x', { readOnlyHint: false })).effect).toBe('changes');
  });

  it('counts a tool with no hints as one that changes something, and marks it unmarked', () => {
    const row = toolRow(tool('a', 'x'));
    expect(row.effect).toBe('changes');
    expect(row.unmarked).toBe(true);
    expect(toolRow(tool('a', 'x', { readOnlyHint: false })).unmarked).toBe(false);
  });

  it('keeps the first sentence on one line, cut at 90 characters', () => {
    expect(toolRow(tool('a', 'Adds two numbers. Then it does more things.')).summary).toBe(
      'Adds two numbers.',
    );
    const long = toolRow(tool('a', 'w'.repeat(300)));
    expect(long.summary).toHaveLength(90);
    expect(long.summary.endsWith('…')).toBe(true);
    expect(long.detail).toHaveLength(200);
  });

  it('shows hidden and control characters instead of hiding them', () => {
    const row = toolRow(tool('ad‮d', 'read​ me\u0007 now'));
    expect(row.name).toBe('ad[U+202E]d');
    expect(row.summary).toBe('read[U+200B] me[U+0007] now');
    expect(visible('tab\tline\nbreak')).toBe('tab\tline\nbreak');
  });

  it('cuts a long name at 64 characters', () => {
    expect(toolRow(tool('n'.repeat(200), 'x')).name).toHaveLength(64);
  });

  it('notes that results are page content when the page says so', () => {
    expect(toolRow(tool('a', 'x', { untrustedContentHint: true })).pageContent).toBe(true);
    expect(toolRow(tool('a', 'x')).pageContent).toBe(false);
  });
});

describe('toolRows', () => {
  const tools = [
    tool('write', 'w', { readOnlyHint: false }),
    tool('zed', 'z', { readOnlyHint: true }),
    tool('alpha', 'a', { readOnlyHint: true }),
    tool('unknown', 'u'),
  ];

  it('lists reads first, then changes, then by name', () => {
    expect(toolRows(tools).map((row) => row.name)).toEqual(['alpha', 'zed', 'unknown', 'write']);
  });

  it('counts reads and changes', () => {
    expect(countEffects(toolRows(tools))).toEqual({ reads: 2, changes: 2 });
    expect(countEffects([])).toEqual({ reads: 0, changes: 0 });
  });
});
