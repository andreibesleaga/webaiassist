// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Independent security review, 12 Nov 2026: what the side panel shows and carries between
// sites. A failing test here is an open finding of the review (see the report).
import { beforeEach, describe, expect, it } from 'vitest';
import type { ToolInfo } from '../../src/core/types';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { t } from '../../src/ui/i18n';
import { startPanel } from '../../src/ui/panel-controller';
import { PanelUI } from '../../src/ui/panel-ui';
import { AGSC_TOOLS, answer } from '../helpers';
import { byId, click, loadPage, tick } from '../ui/dom';
import { fakeDeps, ORIGIN } from '../ui/panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

async function askTool(tool: ToolInfo, args: Record<string, unknown> = {}) {
  const ui = new PanelUI(document);
  const answered = ui.confirmToolCall({ tool, args, origin: ORIGIN });
  const shown = {
    title: byId('confirm-title').textContent ?? '',
    body: byId('confirm-body').textContent ?? '',
  };
  ui.cancelDialog();
  expect(await answered).toBe(false);
  return shown;
}

describe('finding: the tool question can mislead', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('does not call a tool read-only when the page also marks it consequential', async () => {
    const tool = {
      name: 'pay',
      description: 'Pays.',
      annotations: { readOnlyHint: true, consequentialHint: true },
    };
    const { body } = await askTool(tool);
    expect(body).not.toContain(t('confirmReadOnly'));
  });

  it('shows direction overrides and invisible characters in names and arguments', async () => {
    const tool = { name: 'search\u202Edrowssap_teser', description: 'Search.' };
    const { title, body } = await askTool(tool, { to: 'alice\u200B@bank.example' });
    expect(title).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    expect(body).not.toMatch(/[\u200B-\u200D\u2060\uFEFF]/);
  });
});

describe('finding: page text read on one site goes with the next question on another', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('drops the read text when the page’s origin changed before the question', async () => {
    const deps = fakeDeps([]);
    const model = new FakeModelRuntime([answer('ok')]);
    deps.model = model;
    deps.readPage = () =>
      Promise.resolve({ origin: ORIGIN, title: 'Mail', text: 'Your reset code is 551204.' });
    await startPanel(deps);
    click('start');
    await settle();
    click('read-page');
    await settle();
    // The same tab now shows another site (navigation), which the user allowed earlier.
    deps.bridge.pageResult = { origin: 'https://other.example', linkset: false, tools: AGSC_TOOLS };
    deps.grants.origins.add('https://other.example');
    byId<HTMLTextAreaElement>('question').value = 'What can I do here?';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    const sent = (model.requests[0]?.messages ?? []).map((m) => m.content).join('\n');
    expect(model.requests).toHaveLength(1);
    expect(sent).not.toContain('551204');
  });
});
