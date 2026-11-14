// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { webmcpSection } from '../../src/spike/webmcp-check';
import { AGSC_TOOLS } from '../helpers';

/** A stub of the draft's ModelContext: a Map of registered tools. */
function fakeContext(options: { refuse?: string } = {}) {
  const tools = new Map<string, Record<string, unknown>>();
  return {
    registerTool(tool: Record<string, unknown>) {
      if (tool.name === options.refuse)
        throw Object.assign(new Error('refused'), { name: 'InvalidStateError' });
      tools.set(String(tool.name), tool);
    },
    getTools() {
      return Promise.resolve(
        [...tools.values()].map(({ execute: _execute, ...rest }) => ({
          ...rest,
          origin: 'https://stub.example',
        })),
      );
    },
    async executeTool(tool: { name: string }, input?: object) {
      const found = tools.get(tool.name);
      if (!found) throw Object.assign(new Error('no tool'), { name: 'NotFoundError' });
      return JSON.stringify(await (found.execute as (a?: object) => Promise<unknown>)(input));
    },
  };
}

const value = (rows: readonly (readonly [string, string])[], label: string): string | undefined =>
  rows.find(([l]) => l === label)?.[1];

describe('webmcpSection', () => {
  it('says how to turn WebMCP on when no entry point exists', async () => {
    const section = await webmcpSection({}, {}, AGSC_TOOLS);
    expect(section.title).toBe('WebMCP');
    expect(value(section.rows, 'entry point')).toBe(
      'none (turn on chrome://flags/#enable-webmcp-testing)',
    );
    expect(section.rows).toHaveLength(1);
  });

  it('registers the ten stub tools, reads them back and runs search', async () => {
    const section = await webmcpSection({ modelContext: fakeContext() }, {}, AGSC_TOOLS);
    expect(value(section.rows, 'entry point')).toBe('document.modelContext');
    expect(value(section.rows, 'members')).toBe('registerTool, getTools, executeTool');
    expect(value(section.rows, 'tools before the stub')).toBe('0');
    expect(value(section.rows, 'stub registered')).toBe('10 of 10');
    expect(value(section.rows, 'tools after the stub')).toBe(
      '10: ask, brief, check, compose, explain, links, propose, read, remember, search',
    );
    expect(value(section.rows, 'inputSchema kinds')).toBe('object x10');
    expect(value(section.rows, 'hints seen')).toBe(
      'consequentialHint, readOnlyHint, untrustedContentHint',
    );
    expect(value(section.rows, 'origin')).toBe('https://stub.example');
    expect(value(section.rows, 'executeTool(search)')).toMatch(
      /^string: \{"body":\{"args":\{"query":"handoff"\}/,
    );
  });

  it('lists refused registrations and reads navigator.modelContext as a fallback', async () => {
    const section = await webmcpSection(
      {},
      { modelContext: fakeContext({ refuse: 'propose' }) },
      AGSC_TOOLS,
    );
    expect(value(section.rows, 'entry point')).toBe('navigator.modelContext');
    expect(value(section.rows, 'stub registered')).toBe('9 of 10');
    expect(value(section.rows, 'refused propose')).toBe('InvalidStateError: refused');
  });

  it('reports read and execute errors', async () => {
    const ctx = { getTools: () => Promise.reject(new Error('blocked')) };
    const section = await webmcpSection({ modelContext: ctx }, {}, AGSC_TOOLS);
    expect(value(section.rows, 'tools before the stub')).toBe('error: Error: blocked');
    expect(value(section.rows, 'stub registered')).toBe('0 of 10');
    expect(value(section.rows, 'tools after the stub')).toBe('error: Error: blocked');
    expect(value(section.rows, 'executeTool(search)')).toBe('not run (search is not listed)');
  });
});
