// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The panel gives the model its built-in graph tool only on an AgenticSystemCore node whose graph.nq the
// linkset names, that did not ask for no AI input; the call is answered by the graph port, not the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_TOOL_NAME } from '../../src/core/builtin-tools';
import type { GraphQuery } from '../../src/core/ports/graph-query';
import { AGSC_TOOLS, answer, call } from '../helpers';
import { loadPage } from './dom';
import { fakeDeps, FakePanelBridge, FakeSite, ORIGIN, type FakeDeps } from './panel-fakes';
import { ask, fakeClock, flush, noAi, nodeOutcomes, open, startModel, text } from './site-helpers';

function graph(available = true): GraphQuery & { runs: string[] } {
  const runs: string[] = [];
  return {
    runs,
    available: () => Promise.resolve(available),
    summary: () => Promise.resolve({ ok: true, text: 'summary' }),
    run: (_scope, sparql) => {
      runs.push(sparql);
      return Promise.resolve({ ok: true, text: '?n\n"13"' });
    },
  };
}

async function node(
  replies: string[],
  options: {
    port?: GraphQuery;
    outcomes?: ReturnType<typeof nodeOutcomes>;
    linkset?: boolean;
  } = {},
): Promise<FakeDeps> {
  const site = new FakeSite();
  site.outcomes = options.outcomes ?? nodeOutcomes();
  const deps = fakeDeps(replies, {
    site,
    bridge: new FakePanelBridge(AGSC_TOOLS, options.linkset ?? true),
  });
  deps.grants.origins.add(ORIGIN);
  const withPort: FakeDeps = { ...deps, ...(options.port ? { graphQuery: options.port } : {}) };
  await open(withPort);
  await startModel();
  return withPort;
}

/** The system prompt of the first request; fails when the model got no request at all. */
const system = (deps: FakeDeps): string => {
  const model = deps.model as unknown as { requests: { messages: { content: string }[] }[] };
  const first = model.requests[0];
  if (!first) throw new Error('the model got no request');
  return first.messages[0]?.content ?? '';
};

async function asked(question: string): Promise<void> {
  await ask(question);
  for (let i = 0; i < 5; i += 1) await flush();
}

beforeEach(() => {
  loadPage('sidepanel.html');
  fakeClock();
});
afterEach(() => vi.useRealTimers());

describe('the built-in graph tool in the panel', () => {
  it('is offered on a node, listed apart, and a call is answered by the graph port', async () => {
    const port = graph();
    const deps = await node([call(QUERY_TOOL_NAME, { sparql: 'ASK { ?s ?p ?o }' }), answer('13')], {
      port,
    });
    await asked('How many concepts?');
    expect(system(deps)).toContain('Built-in tool (written by WebAIAssist, not by the page):');
    expect(port.runs).toEqual(['ASK { ?s ?p ?o }']);
    expect(deps.bridge.calls).toEqual([]);
    expect(text('transcript')).toContain('13');
  });

  it('is not offered on a page that is not a node', async () => {
    const port = graph();
    const deps = await node([answer('x')], { port, linkset: false, outcomes: {} });
    // A page without the node's ten tools and without a linkset
    deps.bridge.pageResult = { origin: 'https://node.example', linkset: false, tools: [] };
    await asked('hello');
    expect(system(deps)).not.toContain(QUERY_TOOL_NAME);
  });

  it('is not offered when the site asked for no AI input', async () => {
    const deps = await node([answer('x')], {
      port: graph(),
      outcomes: { ...nodeOutcomes(), ...noAi() },
    });
    await asked('hello');
    expect(system(deps)).not.toContain(QUERY_TOOL_NAME);
  });

  it('is not offered when the node does not name its graph', async () => {
    const none = await node([answer('x')], { port: graph(false) });
    await asked('hello');
    expect(system(none)).not.toContain(QUERY_TOOL_NAME);
  });

  it('is not offered when the panel has no graph reader', async () => {
    const none = await node([answer('x')]);
    await asked('hello');
    expect(system(none)).not.toContain(QUERY_TOOL_NAME);
  });
});
