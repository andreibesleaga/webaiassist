// SPDX-License-Identifier: Apache-2.0
// The rules that make a model call the page's tools (package P1): it cannot see the site, so a
// question about the site needs a tool; site files are background; read-only tools first; answer
// from the first sufficient result. Both prompts (full and compact) carry them, within budget.
import { describe, expect, it } from 'vitest';
import { buildCompactPrompt, compactBudget } from '../../src/core/compact-prompt';
import { estimateTokens } from '../../src/core/history';
import { buildSystemPrompt } from '../../src/core/prompt';
import { AGSC_TOOLS, tool } from '../helpers';
import type { ToolInfo } from '../../src/core/types';

const opts = { budgetTokens: compactBudget(9216), question: 'What does this site say about X?' };
const full = (tools: readonly ToolInfo[] = AGSC_TOOLS) =>
  buildSystemPrompt(tools, [], { node: true });
const compact = (tools: readonly ToolInfo[] = AGSC_TOOLS) =>
  buildCompactPrompt(tools, { ...opts, node: true });

const RULES: readonly [string, RegExp][] = [
  ['the model cannot see the site', /cannot see (the|this) (open )?(page|site)/i],
  ['call a tool first for anything about the site', /call a tool first/i],
  ['site files are background, never the source of an answer', /background/i],
  ['read-only tools first', /read-only/i],
  ['a tool that is not read-only only on request', /only when the user (asked|asks)/i],
  ['answer from the first sufficient result', /(first|one) (result|tool result)|as soon as/i],
  ['a greeting needs no tool', /greeting/i],
];

describe.each([
  ['full', full],
  ['compact', compact],
])('the %s prompt on a page with tools', (_name, build) => {
  it.each(RULES)('says: %s', (_label, pattern) => {
    expect(build()).toMatch(pattern);
  });

  it('puts the tool rules after the tool list, last before the question', () => {
    const prompt = build();
    expect(prompt.search(/call a tool first/i)).toBeGreaterThan(prompt.lastIndexOf('search'));
  });

  it('states no tool rule on a page with no tools (there is nothing to call)', () => {
    const prompt = build([]);
    expect(prompt).not.toMatch(/call a tool first/i);
    expect(prompt).toContain('No tools are available');
  });
});

describe('tools that are not read-only', () => {
  const plain: ToolInfo = { name: 'buy', description: 'Buy it.', inputSchema: { type: 'object' } };

  it('are listed after the read-only ones, under their own heading, in the full prompt', () => {
    const prompt = full([tool('propose'), tool('search'), plain, tool('read')]);
    const heading = prompt.indexOf('Tools not marked read-only');
    expect(heading).toBeGreaterThan(0);
    for (const readOnly of ['search', 'read']) {
      expect(prompt.indexOf(`"name":"${readOnly}"`)).toBeLessThan(heading);
    }
    for (const other of ['propose', 'buy']) {
      expect(prompt.indexOf(`"name":"${other}"`)).toBeGreaterThan(heading);
    }
  });

  it('have no second heading when every tool is read-only', () => {
    expect(full([tool('search'), tool('read')])).not.toContain('Tools not marked read-only');
  });

  it('are marked in the compact prompt, and come after read-only tools of equal rank', () => {
    const prompt = buildCompactPrompt([tool('propose'), plain, tool('search'), tool('read')], {
      ...opts,
      question: 'zzz',
      node: true,
    });
    expect(prompt).toMatch(/- propose\(.*\) \[changes things\]:/);
    expect(prompt).toMatch(/- buy\(.*\) \[changes things\]:/);
    expect(prompt).toMatch(/- search\(.*\) \[read-only\]:/);
    const order = ['search', 'read', 'propose', 'buy'].map((n) => prompt.indexOf(`- ${n}(`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('the budgets', () => {
  it('the compact prompt for the ten node tools stays inside its share of Chrome’s window', () => {
    expect(estimateTokens(compact())).toBeLessThanOrEqual(compactBudget(9216));
  });

  it('the compact prompt still fits a small window, with every tool named', () => {
    const budget = compactBudget(4096);
    const prompt = buildCompactPrompt(AGSC_TOOLS, { ...opts, budgetTokens: budget, node: true });
    for (const t of AGSC_TOOLS) expect(prompt).toContain(t.name);
  });

  it('the full prompt for the ten node tools stays under 1700 estimated tokens', () => {
    expect(estimateTokens(full())).toBeLessThan(1700);
  });
});

describe('the example call', () => {
  const EXAMPLE = /Example: .*\{"tool":"ask","arguments":\{"question":"…"\}\}/;

  it('shows one call of a real read-only tool of the page with its first required text field', () => {
    expect(full()).toMatch(EXAMPLE);
    expect(compact()).toMatch(EXAMPLE);
  });

  it('is absent when no read-only tool takes a required text field', () => {
    const none: ToolInfo = { name: 'go', description: 'Go.', inputSchema: { type: 'object' } };
    expect(full([none, tool('propose')])).not.toContain('Example:');
    expect(compact([none])).not.toContain('Example:');
  });

  it('never names a tool or a field that is not a plain name', () => {
    const odd: ToolInfo = {
      name: 'ok',
      description: 'Fine.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { 'bad field': { type: 'string' } },
        required: ['bad field'],
      },
    };
    expect(full([odd])).not.toContain('Example:');
  });
});
