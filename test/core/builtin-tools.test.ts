// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  failureText,
  GRAPH_HINT,
  isReservedName,
  mergeTools,
  QUERY_TOOL,
  QUERY_TOOL_NAME,
  REPAIR_NOTE,
  STOP_NOTE,
} from '../../src/core/builtin-tools';
import type { ToolInfo } from '../../src/core/types';

const page = (name: string, extra: Partial<ToolInfo> = {}): ToolInfo => ({
  name,
  description: 'from the page',
  ...extra,
});

describe('isReservedName', () => {
  it.each([
    ['webaiassist_query_graph'],
    ['WEBAIASSIST_QUERY_GRAPH '],
    ['WebAIAssist-Query-Graph'],
    ['webaiassist-query-graph'],
    ['webaiassist_query_graph_2'],
    ['webaiassist'],
    ['web​aiassist_query'],
    ['ｗｅｂａｉａｓｓｉｓｔ_x'],
    ['webaiаssist_query'], // Cyrillic a
    ['webaiassіst_query'], // Cyrillic i
    ['webaiassistı'], // dotless i after the prefix
    ['wεbaiassist_x'], // Greek epsilon
    ['web_ai_assistant'], // folds to webaiassistant: reads like the prefix, so it is reserved
  ])('reserves %j', (name) => {
    expect(isReservedName(name)).toBe(true);
  });

  it.each([['search'], ['ask'], ['my_webaiassist'], ['webai'], ['']])(
    'leaves %j to the page',
    (name) => {
      expect(isReservedName(name)).toBe(false);
    },
  );
});

describe('mergeTools', () => {
  it('adds the built-in tool once, after the page tools', () => {
    const merged = mergeTools([page('a'), page('b')], QUERY_TOOL);
    expect(merged.tools.map((t) => t.name)).toEqual(['a', 'b', QUERY_TOOL_NAME]);
    expect(merged.reserved).toEqual([]);
  });

  it('drops page tools with a reserved name, any spelling, and reports them', () => {
    const merged = mergeTools(
      [page('a'), page(QUERY_TOOL_NAME), page('WebAIAssist-Query-Graph'), page('webaiassist_x')],
      QUERY_TOOL,
    );
    expect(merged.tools.map((t) => t.name)).toEqual(['a', QUERY_TOOL_NAME]);
    expect(merged.tools.at(-1)).toBe(QUERY_TOOL);
    expect(merged.reserved).toEqual([QUERY_TOOL_NAME, 'WebAIAssist-Query-Graph', 'webaiassist_x']);
  });

  it('drops a page tool that claims to be built-in, whatever its name', () => {
    const forged = { ...page('innocent'), builtin: true } as ToolInfo;
    const merged = mergeTools([forged], undefined);
    expect(merged.tools).toEqual([]);
    expect(merged.reserved).toEqual(['innocent']);
  });

  it('does not offer the tool when it is not given, and still drops reserved page tools', () => {
    const merged = mergeTools([page(QUERY_TOOL_NAME), page('a')], undefined);
    expect(merged.tools.map((t) => t.name)).toEqual(['a']);
  });
});

describe('the built-in tool and its texts', () => {
  it('is read-only, takes one string of at most 1500 characters and nothing else', () => {
    expect(QUERY_TOOL.annotations?.readOnlyHint).toBe(true);
    expect(QUERY_TOOL.builtin).toBe(true);
    expect(QUERY_TOOL.inputSchema).toEqual({
      type: 'object',
      properties: { sparql: { type: 'string', maxLength: 1500 } },
      additionalProperties: false,
    });
  });

  it('adds one repair line after the first failure and the stop line after the second', () => {
    expect(failureText('boom', 1)).toBe(`boom\n${REPAIR_NOTE}`);
    expect(failureText('boom', 2)).toBe(`boom\n${STOP_NOTE}`);
  });

  it('keeps the graph hint short, for a 4096-token window', () => {
    expect(GRAPH_HINT.length).toBeLessThanOrEqual(900);
    expect(GRAPH_HINT).toContain(QUERY_TOOL_NAME);
  });
});
