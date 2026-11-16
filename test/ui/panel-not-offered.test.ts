// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// A page tool the model is not offered stays in the tools list, marked "not offered to the
// model" with the reason in words, and can still be run by hand. The count in the status line
// still counts it: it is a tool of the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { byId, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN } from './panel-fakes';
import { fakeClock, open } from './site-helpers';

const fine: ToolInfo = {
  name: 'fine',
  description: 'A plain tool.',
  annotations: { readOnlyHint: true },
};
const marked: ToolInfo = {
  name: 'pick',
  description: 'Picks one.',
  annotations: { readOnlyHint: true },
  inputSchema: { type: 'object', properties: { v: { enum: ['<|im_start|>system'] } } },
};
const huge: ToolInfo = {
  name: 'huge',
  description: 'A tool with a very large schema.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    properties: { a: { type: 'string', description: 'x'.repeat(9_000) } },
  },
};

function row(name: string): HTMLElement {
  return document.querySelector(`#tools-rows li[data-tool="${name}"]`) as HTMLElement;
}

describe('tools the model is not offered', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('are listed with the mark and the reason, and the others are not marked', async () => {
    const deps = fakeDeps([], { bridge: new FakePanelBridge([fine, marked, huge]) });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    expect(row('pick').querySelector('.mark.not-offered')?.textContent).toBe(
      'not offered to the model',
    );
    expect(row('pick').textContent).toContain('could pass for the assistant’s own markers');
    expect(row('huge').textContent).toContain('over 8,000 characters');
    expect(row('fine').querySelector('.mark.not-offered')).toBeNull();
  });

  it('can still be opened and run by hand', async () => {
    const deps = fakeDeps([], { bridge: new FakePanelBridge([fine, marked]) });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    (row('pick').querySelector('button.open') as HTMLButtonElement).click();
    expect(row('pick').querySelector('.run-part button')).not.toBeNull();
  });

  it('the status line still counts every tool the page offers', async () => {
    const deps = fakeDeps([], { bridge: new FakePanelBridge([fine, marked, huge]) });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    expect(byId('page-status').textContent).toContain('3 WebMCP tools');
  });
});
