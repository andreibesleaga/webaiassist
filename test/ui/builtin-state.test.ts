// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import type { BuiltInState } from '../../src/adapters/prompt-api-state';
import { startPanel } from '../../src/ui/panel-controller';
import { answer } from '../helpers';
import { byId, loadPage, tick } from './dom';
import { fakeDeps } from './panel-fakes';

async function panelWith(state: BuiltInState, promptApi = state !== 'absent') {
  const deps = fakeDeps([answer('hi')]);
  deps.env = { promptApi, scripted: false, webgpu: true };
  const panel = await startPanel({ ...deps, builtInState: () => Promise.resolve(state) });
  await tick();
  return { deps, panel };
}

function choose(value: string): void {
  const select = byId<HTMLSelectElement>('model');
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('the line about Chrome’s built-in model', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('says when this browser has no Prompt API', async () => {
    await panelWith('absent');
    expect(byId('builtin-state').textContent).toBe(
      'Chrome’s built-in model: not in this browser (no Prompt API here).',
    );
  });

  it('names the requirements when Chrome says unavailable', async () => {
    await panelWith('unavailable');
    expect(byId('builtin-state').textContent).toMatch(/unavailable on this computer.*22 GB/);
  });

  it('shows the state in the model line when the built-in model is chosen', async () => {
    await panelWith('downloadable');
    choose('prompt-api');
    await tick();
    expect(byId('model-status').textContent).toMatch(/not downloaded yet; Start downloads it/);
    choose('webllm:qwen3-0.6b-q4_k_m');
    await tick();
    expect(byId('model-status').textContent).toBe('No model loaded. Press Start.');
  });

  it('leaves the line empty when the panel has no way to ask', async () => {
    const deps = fakeDeps([answer('hi')]);
    await startPanel(deps);
    expect(byId('builtin-state').textContent).toBe('');
  });
});
