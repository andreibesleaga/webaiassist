// SPDX-License-Identifier: Apache-2.0
// The built-in graph tool in the real loop, watched by the activity log: the call is recorded as a
// built-in call, with no question, the query text as its argument (kept only with "include content"),
// and nothing of the page bridge. No change of the loop or of builtin-step.ts is needed: the loop
// already shows the call and its result, and the wrapper records those events.
import { describe, expect, it } from 'vitest';
import { QuestionTrace } from '../../src/core/activity-trace';
import { traceUi } from '../../src/core/activity-wrap';
import { runAgent } from '../../src/core/agent-loop';
import { QUERY_TOOL_NAME } from '../../src/core/builtin-tools';
import type { GraphQuery } from '../../src/core/ports/graph-query';
import { answer, call, makeDeps } from '../helpers';

const SPARQL = 'SELECT (COUNT(*) AS ?n) WHERE { ?s a ?c }';
const graph: GraphQuery = {
  available: () => Promise.resolve(true),
  summary: () => Promise.resolve({ ok: true, text: 'summary' }),
  run: () => Promise.resolve({ ok: true, text: '?n\n"13"' }),
};

async function watched(includeContent: boolean) {
  const trace = new QuestionTrace(
    {
      origin: 'https://node.example',
      model: 'm',
      place: 'gpu',
      windowTokens: 4096,
      text: 'How many?',
      includeContent,
    },
    { nowMs: () => 0, nowIso: () => '2026-01-15T10:00:00.000Z' },
    () => 'id',
  );
  const base = makeDeps([call(QUERY_TOOL_NAME, { sparql: SPARQL }), answer('13')]);
  const deps = { ...base, ui: traceUi(base.ui, trace), builtin: graph };
  const input = {
    tabId: 7,
    origin: 'https://node.example',
    userText: 'How many?',
    graphQuery: true,
  };
  await runAgent(deps, input);
  return { record: trace.build({ status: 'answered', steps: 2 }), base };
}

describe('the built-in query tool in the activity log', () => {
  it('is recorded as a built-in call that asked nothing, with the argument name and size', async () => {
    const { record, base } = await watched(false);
    expect(record.tools).toHaveLength(1);
    expect(record.tools[0]).toMatchObject({
      name: QUERY_TOOL_NAME,
      builtin: true,
      asked: false,
      decision: 'not-asked',
      argNames: ['sparql'],
      ok: true,
    });
    expect(record.tools[0]?.args).toBeUndefined();
    expect(base.bridge.calls).toEqual([]);
  });

  it('keeps the query text as the argument, and the rows, only with include content', async () => {
    const { record } = await watched(true);
    expect(record.tools[0]?.args).toEqual({ sparql: SPARQL });
    expect(record.tools[0]?.result).toContain('13');
  });
});
