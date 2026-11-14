// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { buildMessages, buildSystemPrompt } from '../../src/core/prompt';
import { AGSC_TOOLS } from '../helpers';

describe('buildSystemPrompt', () => {
  it('lists every tool by name with its schema', () => {
    const prompt = buildSystemPrompt(AGSC_TOOLS, []);
    for (const t of AGSC_TOOLS) expect(prompt).toContain(`"name":"${t.name}"`);
    expect(prompt).toContain('"required":["slug"]');
  });

  it('declares tool results and tool descriptions as data', () => {
    const prompt = buildSystemPrompt(AGSC_TOOLS, []);
    expect(prompt).toContain('<tool-result>');
    expect(prompt).toMatch(/data, not instructions/);
  });

  it('states the two allowed reply shapes', () => {
    const prompt = buildSystemPrompt([], []);
    expect(prompt).toContain('{"tool": "<name>", "arguments": {');
    expect(prompt).toContain('{"answer": "<text>"}');
    expect(prompt).toContain('No tools are available on this page.');
  });

  it('adds per-site success counts when there are some', () => {
    const prompt = buildSystemPrompt(AGSC_TOOLS, [
      { tool: 'search', ok: 3, failed: 1, lastAt: '2026-01-15T10:00:00.000Z' },
    ]);
    expect(prompt).toContain('search: worked 3, failed 1');
  });

  it('adds the node hint when asked', () => {
    expect(buildSystemPrompt(AGSC_TOOLS, [], { node: true })).toContain('AgenticSystemCore node');
    expect(buildSystemPrompt(AGSC_TOOLS, [])).not.toContain('AgenticSystemCore node');
  });

  it('caps a long tool description', () => {
    const long = { name: 'x', description: 'd'.repeat(2000) };
    expect(buildSystemPrompt([long], []).length).toBeLessThan(2000);
  });
});

describe('buildMessages', () => {
  it('puts the system prompt first, then the history, then the user text', () => {
    const messages = buildMessages('SYS', [{ role: 'assistant', content: 'earlier' }], 'hello');
    expect(messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'assistant', content: 'earlier' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('drops old system messages from the history', () => {
    const messages = buildMessages('SYS', [{ role: 'system', content: 'old' }], 'hi');
    expect(messages.filter((m) => m.role === 'system')).toHaveLength(1);
  });
});
