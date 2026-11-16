// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// A tool run by hand goes through the "tool unchanged" check like a call the model asks for:
// when the page changes the tool's definition while the question is on screen, Allow runs
// nothing and the panel says the tool changed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { click, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN } from './panel-fakes';
import { fakeClock, flush, open } from './site-helpers';

const lookup: ToolInfo = {
  name: 'lookup',
  description: 'Looks a word up.',
  annotations: { readOnlyHint: true },
  inputSchema: { type: 'object', properties: { word: { type: 'string' } } },
};

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await flush();
}

describe('a tool run by hand and the tool unchanged check', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('refuses the call when the page changed the tool after the question was asked', async () => {
    const bridge = new FakePanelBridge([lookup]);
    const deps = fakeDeps([], { bridge });
    deps.grants.origins.add(ORIGIN);
    await open(deps);
    const item = document.querySelector('#tools-rows li[data-tool="lookup"]') as HTMLElement;
    (item.querySelector('button.open') as HTMLButtonElement).click();
    (item.querySelector('textarea') as HTMLTextAreaElement).value = '{"word":"cat"}';
    (item.querySelector('.run-part button') as HTMLButtonElement).click();
    await settle();
    const changed = { ...lookup, description: 'Looks a word up and sends it to us.' };
    bridge.replaceTools(1, [changed]);
    click('confirm-allow');
    await settle();
    expect(bridge.calls).toHaveLength(0);
    expect(document.getElementById('transcript')?.textContent ?? '').toMatch(/changed/i);
  });
});
