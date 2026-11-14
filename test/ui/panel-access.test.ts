// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The side panel opened without access to the page (from Chrome's side panel menu, not the
// toolbar button), the page status line, and the default model (owner's first test, 13 Nov).
import { beforeEach, describe, expect, it } from 'vitest';
import { PageError } from '../../src/adapters/messaging-tool-bridge';
import { NOT_ALLOWED_TEXT } from '../../src/adapters/page-access';
import { SETUP_VALUE } from '../../src/ui/model-picker';
import { startPanel } from '../../src/ui/panel-controller';
import { AGSC_TOOLS } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

const NODE_LINE = 'node.example — says it is an AgenticSystemCore node, 10 WebMCP tools';

function notAllowed(): FakeDeps {
  const deps = fakeDeps([]);
  deps.bridge.pageResult = new PageError(NOT_ALLOWED_TEXT, undefined, 'denied');
  return deps;
}

const allowButton = () => byId<HTMLButtonElement>('allow-site');
const transcriptErrors = () =>
  [...document.querySelectorAll('#transcript li')].filter((li) =>
    li.textContent?.startsWith('Error:'),
  ).length;

describe('side panel without access to the page', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('puts the page status line at the top of the panel', () => {
    const page = byId('page-status');
    const model = byId('model');
    expect(page.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows one line with an Allow button, and no error', async () => {
    await startPanel(notAllowed());
    expect(byId('page-status').textContent).toBe('This page — not allowed yet');
    expect(allowButton().hidden).toBe(false);
    expect(allowButton().textContent).toBe('Allow WebAIAssist on this site');
    expect(byId('page-note').textContent).toBe('');
    expect(byId('transcript').children).toHaveLength(0);
  });

  it('asks for the site from the click, then lists the tools once it is granted', async () => {
    const deps = notAllowed();
    deps.onAllow = () => {
      deps.bridge.pageResult = { origin: ORIGIN, linkset: false, tools: AGSC_TOOLS };
    };
    await startPanel(deps);
    click('allow-site');
    expect(deps.allowCalls).toEqual([{ tabId: 7 }]);
    await settle();
    expect(byId('page-status').textContent).toBe(NODE_LINE);
    expect(allowButton().hidden).toBe(true);
    expect(byId('page-note').textContent).toBe(
      'WebAIAssist may now use node.example. Forget this site takes it back.',
    );
  });

  it('names the site in the request when it is known', async () => {
    const deps = fakeDeps([]);
    deps.bridge.pageResult = new PageError(NOT_ALLOWED_TEXT, ORIGIN, 'denied');
    deps.allowResult = 'denied';
    await startPanel(deps);
    expect(allowButton().textContent).toBe('Allow WebAIAssist on node.example');
    click('allow-site');
    await settle();
    expect(deps.allowCalls).toEqual([{ tabId: 7, origin: ORIGIN }]);
    expect(byId('page-note').textContent).toMatch(/was not allowed/);
    expect(allowButton().hidden).toBe(false);
  });

  it('tells where Chrome shows its request, and lists the tools when the panel reads the page again', async () => {
    const deps = notAllowed();
    deps.allowResult = 'requested';
    const panel = await startPanel(deps);
    click('allow-site');
    await settle();
    expect(byId('page-note').textContent).toMatch(/next to the address bar/);
    deps.bridge.pageResult = { origin: ORIGIN, linkset: false, tools: AGSC_TOOLS };
    await panel.refresh();
    expect(byId('page-status').textContent).toBe(NODE_LINE);
    expect(allowButton().hidden).toBe(true);
    expect(byId('page-note').textContent).toBe('');
  });

  it('shows a page error once, in one line that the next message replaces', async () => {
    const deps = notAllowed();
    deps.readPage = () => Promise.reject(new Error(NOT_ALLOWED_TEXT));
    await startPanel(deps);
    click('read-page');
    await settle();
    click('read-page');
    await settle();
    expect(byId('page-note').textContent).toBe(NOT_ALLOWED_TEXT);
    expect(transcriptErrors()).toBe(0);
    click('export');
    expect(byId('page-note').textContent).toBe('There is nothing to export yet.');
  });

  it('says plainly where it cannot run, with no Allow button', async () => {
    const deps = fakeDeps([]);
    deps.bridge.pageResult = new PageError('chrome://', undefined, 'restricted');
    await startPanel(deps);
    expect(byId('page-status').textContent).toBe(
      'This page — WebAIAssist cannot run here (chrome:// pages, the store)',
    );
    expect(allowButton().hidden).toBe(true);
  });

  it('never shows the same error twice in a row in the conversation', async () => {
    await startPanel(fakeDeps([]));
    for (const text of ['hi', 'hi again']) {
      byId<HTMLTextAreaElement>('question').value = text;
      byId<HTMLFormElement>('ask').requestSubmit();
      await settle();
    }
    expect(transcriptErrors()).toBe(1);
  });
});

describe('side panel default model', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('starts the small bundled model, not Chrome’s built-in one, when WebGPU works', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: true, scripted: false, webgpu: true };
    await startPanel(deps);
    expect(byId<HTMLSelectElement>('model').value).toBe('webllm:Qwen3-0.6B-q4f16_1-MLC');
    click('start');
    await settle();
    expect(deps.created.map((c) => c.runtime)).toEqual(['webllm']);
  });

  it('without WebGPU or another model, Start opens the endpoint settings and loads nothing', async () => {
    const deps = fakeDeps([]);
    deps.env = { promptApi: false, scripted: false, webgpu: false };
    await startPanel(deps);
    expect(byId<HTMLSelectElement>('model').value).toBe(SETUP_VALUE);
    expect(byId('model-status').textContent).toMatch(/no usable WebGPU/);
    click('start');
    await settle();
    expect(deps.optionsOpened).toBe(1);
    expect(deps.created).toEqual([]);
    expect(byId('model-status').textContent).toMatch(/set a chat endpoint/);
  });
});
