// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The side panel's safety rules added in the security fix round: Cancel for a model
// download, read page text bound to its tab and site, honest read-only wording.
import { beforeEach, describe, expect, it } from 'vitest';
import type { LoadProgress } from '../../src/core/ports/model-runtime';
import type { CancelSignal } from '../../src/core/types';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { t } from '../../src/ui/i18n';
import { startPanel } from '../../src/ui/panel-controller';
import { PanelUI } from '../../src/ui/panel-ui';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

/** A model whose download waits until it is cancelled. */
class SlowModel extends FakeModelRuntime {
  override load(_id: string, _p: (p: LoadProgress) => void, signal?: CancelSignal) {
    return new Promise<void>((_resolve, reject) => {
      (signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')));
    });
  }
}

beforeEach(() => {
  loadPage('sidepanel.html');
});

describe('side panel: model download', () => {
  it('shows Cancel only while a model loads, and Cancel stops the download', async () => {
    const deps = fakeDeps([]);
    deps.model = new SlowModel([]);
    await startPanel(deps);
    const cancel = byId<HTMLButtonElement>('cancel-load');
    expect(cancel.hidden).toBe(true);
    click('start');
    await settle();
    expect(cancel.hidden).toBe(false);
    expect(byId<HTMLButtonElement>('start').disabled).toBe(true);
    click('cancel-load');
    await settle();
    expect(cancel.hidden).toBe(true);
    expect(byId<HTMLButtonElement>('start').disabled).toBe(false);
    expect(byId('model-status').textContent).toBe(t('loadFailed', { why: t('loadCancelled') }));
  });
});

describe('side panel: read page text', () => {
  it('is used on the same tab and site, once', async () => {
    const deps = fakeDeps([answer('ok')]);
    const model = new FakeModelRuntime([answer('ok')]);
    deps.model = model;
    deps.grants.origins.add(ORIGIN);
    deps.readPage = () => Promise.resolve({ origin: ORIGIN, title: 'T', text: 'code 551204' });
    await startPanel(deps);
    click('start');
    await settle();
    click('read-page');
    await settle();
    for (const question of ['first?', 'second?']) {
      byId<HTMLTextAreaElement>('question').value = question;
      byId<HTMLFormElement>('ask').requestSubmit();
      await settle();
    }
    const texts = model.requests.map((r) => r.messages.map((m) => m.content).join('\n'));
    expect(texts[0]).toContain('551204');
    expect(texts[1]).not.toContain('551204');
  });

  it('is dropped, with a note, when it was read on another site than the question’s', async () => {
    const deps = fakeDeps([]);
    const model = new FakeModelRuntime([answer('ok')]);
    deps.model = model;
    deps.grants.origins.add(ORIGIN);
    deps.readPage = () =>
      Promise.resolve({ origin: 'https://mail.example', title: 'Mail', text: 'code 551204' });
    await startPanel(deps);
    click('start');
    await settle();
    click('read-page');
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'what now?';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    const sent = (model.requests[0]?.messages ?? []).map((m) => m.content).join('\n');
    expect(sent).not.toContain('551204');
    expect(byId('page-note').textContent).toBe(
      t('siteChanged', { origin: 'https://mail.example' }),
    );
  });
});

describe('side panel: the tool question', () => {
  it('calls a tool read-only only when the gate treats it as read-only', async () => {
    const ui = new PanelUI(document);
    const ask = async (annotations: object) => {
      const answered = ui.confirmToolCall({
        tool: { name: 'x', description: '', annotations },
        args: {},
        origin: ORIGIN,
      });
      const body = byId('confirm-body').textContent ?? '';
      ui.cancelDialog();
      await answered;
      return body;
    };
    expect(await ask({ readOnlyHint: true })).toContain(t('confirmReadOnly'));
    expect(await ask({ readOnlyHint: true, consequentialHint: true })).toContain(
      t('confirmConsequential'),
    );
    expect(await ask({})).toContain(t('confirmChanges'));
  });
});
