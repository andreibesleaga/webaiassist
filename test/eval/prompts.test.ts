// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadPrompts, parsePrompts, promptsFor } from '../../scripts/eval/prompts.ts';

const FILE = { targets: { stub: { slugs: { a: 'x', b: 'y' } } }, prompts: [] as unknown[] };
const prompt = (n: number, extra: object = {}) => ({
  n,
  text: `Read {a} then {b} (${n})`,
  tools: ['read'],
  facts: ['f'],
  scripted: '/tool read {"slug": "{a}"}',
  ...extra,
});

describe('eval prompts', () => {
  it('reads the 20 prompts of docs/eval/prompts.json', () => {
    const file = loadPrompts('docs/eval/prompts.json');
    expect(file.prompts.map((p) => p.n)).toEqual([...Array(20).keys()].map((i) => i + 1));
    expect(file.targets.live?.url).toMatch(/^https:\/\/agenticsystemcore\.com\//);
  });

  it('fills the target’s slugs and keeps the first N prompts', () => {
    const file = parsePrompts({ ...FILE, prompts: [prompt(1), prompt(2), prompt(3)] });
    const list = promptsFor(file, 'stub', 2);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      text: 'Read x then y (1)',
      scripted: '/tool read {"slug": "x"}',
    });
  });

  it('refuses a malformed file with the reason', () => {
    expect(() => parsePrompts({})).toThrow(/prompts\.json: no targets/);
    expect(() => parsePrompts({ ...FILE, prompts: [{ n: 1 }] })).toThrow(/prompt 1: text/);
    expect(() => parsePrompts({ ...FILE, prompts: [prompt(1, { tools: 'read' })] })).toThrow(
      /prompt 1: tools/,
    );
    expect(() => promptsFor(parsePrompts(FILE), 'live', 1)).toThrow(/no target "live"/);
  });
});
