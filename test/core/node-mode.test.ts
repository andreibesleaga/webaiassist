// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { AGSC_TOOL_NAMES, isAgscNode, NODE_HINT, NODE_HINT_SHORT } from '../../src/core/node-mode';
import { AGSC_TOOLS } from '../helpers';

describe('isAgscNode', () => {
  it('lists the ten tool names of a node page', () => {
    expect([...AGSC_TOOL_NAMES].sort()).toEqual(AGSC_TOOLS.map((t) => t.name).sort());
  });

  it('is true when the page links to its knowledge linkset', () => {
    expect(isAgscNode({ linkset: true, toolNames: [] })).toBe(true);
  });

  it('is true when the page registers all ten tools, in any order', () => {
    const names = [...AGSC_TOOL_NAMES].reverse();
    expect(isAgscNode({ linkset: false, toolNames: names })).toBe(true);
  });

  it('is false for a page with only some of the names and no linkset', () => {
    const names = AGSC_TOOL_NAMES.slice(0, 9);
    expect(isAgscNode({ linkset: false, toolNames: names })).toBe(false);
    expect(isAgscNode({ toolNames: ['search', 'read'] })).toBe(false);
  });

  it('has a hint that names the roles of propose and remember', () => {
    expect(NODE_HINT).toMatch(/AgenticSystemCore node/);
    expect(NODE_HINT).toMatch(/propose.*remember|remember.*propose/s);
  });

  it('does not vouch for the page: no claim that its tools are harmless (audit L1)', () => {
    for (const hint of [NODE_HINT, NODE_HINT_SHORT]) {
      expect(hint).not.toMatch(/write nothing|harmless|safe/i);
      expect(hint).toMatch(/says it is an AgenticSystemCore node/);
    }
  });
});
