// SPDX-License-Identifier: Apache-2.0
// Loop changes that make a model use tools and stop after a sufficient result (package P1):
// the site files are introduced as background, and a result is followed by one short line.
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { AFTER_RESULT, SITE_BACKGROUND } from '../../src/core/tool-rules';
import { answer, call, makeDeps } from '../helpers';

const base = { tabId: 3, origin: 'https://node.example', userText: 'What does this site say?' };
const FACTS = '<tool-result tool="site-file__llms.txt" trust="untrusted">\nGuide\n</tool-result>';

describe('runAgent: site files are background', () => {
  it('introduces them with a line that says they are not an answer', async () => {
    const deps = makeDeps([answer('A site.')]);
    await runAgent(deps, { ...base, siteContext: FACTS });
    const messages = deps.model.requests[0]?.messages ?? [];
    expect(messages.at(-2)).toEqual({ role: 'tool', content: `${SITE_BACKGROUND}\n${FACTS}` });
    expect(messages.at(-1)).toEqual({ role: 'user', content: base.userText });
  });
});

describe('runAgent: a result is followed by one line that lets the model answer', () => {
  const lastTwo = (deps: ReturnType<typeof makeDeps>, request: number) =>
    (deps.model.requests[request]?.messages ?? []).slice(-2);

  it('puts the line right after the tool result, as the loop’s own text', async () => {
    const deps = makeDeps([call('search', { query: 'a' }), answer('Found.')]);
    await runAgent(deps, base);
    const [result, line] = lastTwo(deps, 1);
    expect(result?.role).toBe('tool');
    expect(line).toEqual({ role: 'user', content: AFTER_RESULT });
  });

  it('keeps only the newest such line when more tools run', async () => {
    const deps = makeDeps([
      call('search', { query: 'a' }),
      call('read', { slug: 'x' }),
      answer('Done.'),
    ]);
    await runAgent(deps, base);
    const third = deps.model.requests[2]?.messages ?? [];
    expect(third.filter((m) => m.content === AFTER_RESULT)).toHaveLength(1);
    expect(third.at(-1)?.content).toBe(AFTER_RESULT);
  });

  it('is not saved with the chat', async () => {
    const deps = makeDeps([call('search', { query: 'a' }), answer('Found.')]);
    await runAgent(deps, base);
    const saved = await deps.memory.loadChat(base.origin);
    expect(JSON.stringify(saved)).not.toContain(AFTER_RESULT);
    expect(saved.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
  });

  it('is not added after a refused call (there is no result to answer from)', async () => {
    const deps = makeDeps([call('propose', { slug: 'a' }), answer('Not done.')], { allow: false });
    await runAgent(deps, base);
    const messages = deps.model.requests[1]?.messages ?? [];
    expect(messages.some((m) => m.content === AFTER_RESULT)).toBe(false);
  });
});
