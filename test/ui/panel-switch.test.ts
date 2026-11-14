// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { startPanel } from '../../src/ui/panel-controller';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps, ORIGIN, type FakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

describe('the panel changes or closes a model', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('lets the model go and stops a load when the panel is closed', async () => {
    const model = new FakeModelRuntime([]);
    let unloads = 0;
    model.unload = () => {
      unloads += 1;
      return Promise.resolve();
    };
    const deps = fakeDeps([]);
    deps.model = model;
    await startPanel(deps);
    click('start');
    await settle();
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    expect(unloads).toBe(1);
  });

  it('releases the model that is ready before it loads the one chosen next', async () => {
    const order: string[] = [];
    const first = new FakeModelRuntime([]);
    first.unload = () => {
      order.push('unload first');
      return Promise.resolve();
    };
    const second = new FakeModelRuntime([]);
    second.load = () => {
      order.push('load second');
      return Promise.resolve();
    };
    const deps = fakeDeps([]);
    deps.model = first;
    await startPanel(deps);
    click('start');
    await settle();
    deps.model = second;
    byId<HTMLSelectElement>('model').value = 'webllm:Llama-3.2-3B-Instruct-q4f16_1-MLC';
    click('start');
    await settle();
    expect(order).toEqual(['unload first', 'load second']);
    expect(byId('model-status').textContent).toMatch(/^Ready: Llama 3\.2 3B/);
  });

  describe('switching to another model', () => {
    async function twoStarts(second: string): Promise<{ order: string[]; deps: FakeDeps }> {
      const order: string[] = [];
      const deps = fakeDeps([]);
      deps.env = { promptApi: true, scripted: false };
      const old = new FakeModelRuntime([]);
      old.unload = () => {
        order.push('unload old');
        return new Promise<void>(() => undefined); // a slow unload that never ends
      };
      const next = new FakeModelRuntime([]);
      next.load = () => {
        order.push('load next');
        return Promise.resolve();
      };
      deps.model = old;
      await startPanel(deps);
      byId<HTMLSelectElement>('model').value = 'webllm:Qwen3-0.6B-q4f16_1-MLC';
      click('start');
      await settle();
      deps.model = next;
      byId<HTMLSelectElement>('model').value = second;
      click('start');
      await settle();
      return { order, deps };
    }

    it('calls Chrome’s create() from the click, before the old model is let go', async () => {
      const { order } = await twoStarts('prompt-api');
      expect(order).toEqual(['load next', 'unload old']);
      expect(byId('model-status').textContent).toMatch(/^Ready: /);
    });

    it('lets the old graphics model go first for another graphics model', async () => {
      const { order } = await twoStarts('webllm:Llama-3.2-3B-Instruct-q4f16_1-MLC');
      expect(order).toEqual(['unload old']); // the new model waits for the memory to be free
    });
  });

  it('stops an answer that is running when the panel is closed (F20.10)', async () => {
    const model = new FakeModelRuntime([]);
    let signal: AbortSignal | undefined;
    model.chat = (request) => {
      signal = request.signal as AbortSignal | undefined;
      return new Promise<string>(() => undefined);
    };
    const deps = fakeDeps([]);
    deps.model = model;
    deps.grants.origins.add(ORIGIN);
    await startPanel(deps);
    click('start');
    await settle();
    byId<HTMLTextAreaElement>('question').value = 'What can I do here?';
    byId<HTMLFormElement>('ask').requestSubmit();
    await settle();
    expect(signal?.aborted).toBe(false);
    window.dispatchEvent(new Event('pagehide'));
    expect(signal?.aborted).toBe(true);
  });
});
