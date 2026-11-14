// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/core/agent-loop';
import { NOTE_AGAIN, NOTE_STOP } from '../../src/core/repeat';
import { answer, call, makeDeps } from '../helpers';

const input = { tabId: 3, origin: 'https://node.example', userText: 'Find tasks' };
const search = call('search', { query: 'tasks' });

describe('runAgent: the same call again is not run again', () => {
  it('gives the earlier result back once, with a line to answer now', async () => {
    const deps = makeDeps([search, search, answer('Two tasks.')]);
    const result = await runAgent(deps, input);
    expect(result).toMatchObject({ status: 'answered', answer: 'Two tasks.', steps: 3 });
    expect(deps.bridge.calls).toHaveLength(1);
    const messages = deps.model.requests[2]?.messages ?? [];
    expect(messages.at(-2)).toMatchObject({ role: 'tool' });
    expect(messages.at(-2)?.content).toBe(messages.at(-5)?.content);
    expect(messages.at(-1)?.role).toBe('user');
    expect(messages.at(-1)?.content).toContain('already have this result');
    expect(deps.ui.events).toContainEqual({ kind: 'note', text: NOTE_AGAIN });
  });

  it('ends the question on the next repeat with an answer built from the results', async () => {
    const deps = makeDeps([search, search, search, answer('never reached')]);
    const result = await runAgent(deps, input);
    expect(result.status).toBe('answered');
    expect(result.steps).toBe(3);
    expect(deps.model.requests).toHaveLength(3);
    expect(deps.bridge.calls).toHaveLength(1);
    expect(result.answer).toMatch(/^What the tools returned:\n\nsearch: /);
    expect(deps.ui.events.slice(-2)).toEqual([
      { kind: 'note', text: NOTE_STOP },
      { kind: 'answer', text: result.answer },
    ]);
  });

  it('keeps the page result out of the assistant turn it saves', async () => {
    const deps = makeDeps([search, search, search]);
    const result = await runAgent(deps, input);
    const saved = await deps.memory.loadChat(input.origin);
    const last = saved.at(-1);
    expect(last?.role).toBe('assistant');
    expect(last?.content).not.toContain(result.answer ?? 'x');
    expect(JSON.parse(last?.content ?? '{}')).toHaveProperty('answer');
  });

  it('treats reordered keys as the same call and other arguments as a new call', async () => {
    const one = call('explain', { key: 'k', source: 's', target: 't' });
    const same = call('explain', { target: 't', source: 's', key: 'k' });
    const other = call('explain', { key: 'k', source: 's', target: 'u' });
    const deps = makeDeps([one, same, other, answer('done')]);
    const result = await runAgent(deps, input);
    expect(result).toMatchObject({ status: 'answered', answer: 'done' });
    expect(deps.bridge.calls.map((c) => c.args)).toEqual([
      { key: 'k', source: 's', target: 't' },
      { key: 'k', source: 's', target: 'u' },
    ]);
  });

  it('counts a call that was made earlier in the question, not only the one just before', async () => {
    const read = call('read', { slug: 'a' });
    const deps = makeDeps([search, read, search, answer('ok')]);
    await runAgent(deps, input);
    expect(deps.bridge.calls.map((c) => c.name)).toEqual(['search', 'read']);
  });

  it('never asks the user again for a call it does not run', async () => {
    const propose = call('propose', { slug: 'task-1' });
    const deps = makeDeps([propose, propose, answer('ok')], { allow: true });
    await runAgent(deps, input);
    expect(deps.ui.approvals).toHaveLength(1);
    expect(deps.bridge.calls).toHaveLength(1);
  });

  it('does not remember a call the user denied: the denial rule still applies', async () => {
    const propose = call('propose', { slug: 'task-1' });
    const deps = makeDeps([propose, propose, answer('ok')], { allow: false });
    await runAgent(deps, input);
    expect(deps.ui.approvals).toHaveLength(1);
    expect(deps.bridge.calls).toHaveLength(0);
    expect(deps.ui.events.filter((e) => e.kind === 'note')).toHaveLength(0);
  });

  it('starts fresh in the next question', async () => {
    const deps = makeDeps([search, answer('a'), search, answer('b')]);
    await runAgent(deps, input);
    await runAgent(deps, input);
    expect(deps.bridge.calls).toHaveLength(2);
  });
});

describe('runAgent: a missed argument is repaired with the tool’s own fields', () => {
  it('quotes the required fields and their types in the retry', async () => {
    const deps = makeDeps([call('propose', {}), call('propose', { slug: 's' }), answer('ok')], {
      allow: true,
    });
    await runAgent(deps, input);
    const retry = deps.model.requests[1]?.messages.at(-1)?.content ?? '';
    expect(retry).toContain('not a valid action');
    expect(retry).toContain('"propose" takes: slug (string, required), agent (string)');
  });

  it('ends with a plain message that names the tool when the retry fails too', async () => {
    const deps = makeDeps([call('search', {}), call('search', { query: 5 })]);
    const result = await runAgent(deps, input);
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/^The model could not fill in the arguments for search\. /);
    expect(result.error).toContain('query (string, required)');
    expect(deps.bridge.calls).toHaveLength(0);
  });
});
