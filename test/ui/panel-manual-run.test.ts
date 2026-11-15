// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Run a tool by hand from its detail view: the same gates as a call the model asks for (the
// question about the site, the tool unchanged check, the question about the call), no model
// needed, and the arguments are checked against the tool's fields before anything is asked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { call } from '../helpers';
import { byId, click, loadPage } from './dom';
import { fakeDeps, FakePanelBridge, ORIGIN, type FakeDeps } from './panel-fakes';
import { ask, fakeClock, flush, open, startModel } from './site-helpers';

const lookup: ToolInfo = {
  name: 'lookup',
  description: 'Looks a word up.',
  annotations: { readOnlyHint: true },
  inputSchema: {
    type: 'object',
    required: ['word'],
    properties: { word: { type: 'string' } },
    additionalProperties: false,
  },
};
const dev: ToolInfo = {
  name: 'dev_dump',
  description: 'Dumps the state.',
  annotations: { readOnlyHint: true, debugging: true },
};

async function panel(tools: ToolInfo[], allowed = true): Promise<FakeDeps> {
  const deps = fakeDeps([], { bridge: new FakePanelBridge(tools) });
  if (allowed) deps.grants.origins.add(ORIGIN);
  await open(deps);
  return deps;
}

function detail(name: string): {
  box: HTMLTextAreaElement;
  run: HTMLButtonElement;
  line: HTMLElement;
} {
  const item = document.querySelector(`#tools-rows li[data-tool="${name}"]`) as HTMLElement;
  if (!item.querySelector('.detail'))
    (item.querySelector('button.open') as HTMLButtonElement).click();
  return {
    box: item.querySelector('textarea') as HTMLTextAreaElement,
    run: item.querySelector('.run-part button') as HTMLButtonElement,
    line: item.querySelector('.run-line') as HTMLElement,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await flush();
}

describe('run a tool by hand', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  it('starts the box with the required fields', async () => {
    await panel([lookup]);
    expect(JSON.parse(detail('lookup').box.value)).toEqual({ word: '' });
  });

  it('asks the question first, then calls the page and shows the result as the page’s', async () => {
    const deps = await panel([lookup]);
    const view = detail('lookup');
    view.box.value = '{"word":"cat"}';
    view.run.click();
    await settle();
    expect(byId('confirm-title').textContent).toBe('Run the tool lookup?');
    expect(deps.bridge.calls).toHaveLength(0);
    click('confirm-allow');
    await settle();
    expect(deps.bridge.calls).toEqual([
      expect.objectContaining({ name: 'lookup', args: { word: 'cat' } }),
    ]);
    expect(byId('transcript').textContent).toContain('Result of lookup (from the page)');
  });

  it('asks even for a read-only tool in every mode, and Deny runs nothing', async () => {
    const deps = await panel([lookup]);
    deps.settings = { ...deps.settings, confirmMode: 'per-site' };
    const view = detail('lookup');
    view.box.value = '{"word":"cat"}';
    view.run.click();
    await settle();
    expect(byId<HTMLDialogElement>('confirm').open).toBe(true);
    click('confirm-deny');
    await settle();
    expect(deps.bridge.calls).toHaveLength(0);
  });

  it('asks about the site first when it is not allowed yet, and a No stops there', async () => {
    const deps = await panel([lookup], false);
    const view = detail('lookup');
    view.box.value = '{"word":"cat"}';
    view.run.click();
    await settle();
    expect(byId('confirm-title').textContent).toBe(`Use the tools of ${ORIGIN}?`);
    click('confirm-deny');
    await settle();
    expect(deps.bridge.calls).toHaveLength(0);
  });

  it('says what is wrong with arguments that are not JSON, not an object, or do not fit', async () => {
    const deps = await panel([lookup]);
    const view = detail('lookup');
    for (const [text, part] of [
      ['{nope', 'not valid JSON'],
      ['[1]', 'must be a JSON object'],
      ['{"word":5}', 'do not fit the tool'],
      ['{}', 'do not fit the tool'],
    ] as const) {
      view.box.value = text;
      view.run.click();
      await settle();
      expect(view.line.textContent).toContain(part);
    }
    expect(byId<HTMLDialogElement>('confirm').open).toBe(false);
    expect(deps.bridge.calls).toHaveLength(0);
  });

  it('can run a tool marked for developers, which the model is never offered', async () => {
    const deps = await panel([lookup, dev]);
    const view = detail('dev_dump');
    view.run.click();
    await settle();
    expect(byId('confirm-title').textContent).toBe('Run the tool dev_dump?');
    click('confirm-allow');
    await settle();
    expect(deps.bridge.calls.map((c) => c.name)).toEqual(['dev_dump']);
  });

  it('refuses while an answer is running', async () => {
    const deps = fakeDeps([call('lookup', { word: 'a' })], {
      bridge: new FakePanelBridge([lookup]),
    });
    await open(deps);
    await startModel();
    await ask('find it');
    expect(byId('confirm-title').textContent).toContain('Use the tools of');
    const view = detail('lookup');
    view.box.value = '{"word":"cat"}';
    view.run.click();
    await settle();
    expect(view.line.textContent).toContain('Press Stop first');
    click('confirm-deny');
  });

  it('keeps the open detail and the typed text through a redraw', async () => {
    const deps = fakeDeps([], { bridge: new FakePanelBridge([lookup]) });
    const controller = await open(deps);
    detail('lookup').box.value = '{"word":"typed"}';
    await controller.refresh();
    await settle();
    const item = document.querySelector('#tools-rows li[data-tool="lookup"]') as HTMLElement;
    expect(item.querySelector('.detail')).not.toBeNull();
    expect(item.querySelector('textarea')?.value).toBe('{"word":"typed"}');
  });
});
