// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeModelRuntime } from '../../src/fakes/fake-model-runtime';
import { startPanel } from '../../src/ui/panel-controller';
import { answer } from '../helpers';
import { byId, click, loadPage, tick } from './dom';
import { fakeDeps } from './panel-fakes';

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await tick();
}

describe('side panel: the processor model', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it.each([
    ['cpu:4', '4 threads'],
    ['cpu:1', '1 thread'],
  ])('says the processor model runs in memory, with its threads (%s)', async (where, threads) => {
    const deps = fakeDeps([answer('hi')]);
    deps.model = Object.assign(new FakeModelRuntime([]), { where: () => where });
    await startPanel(deps);
    click('start');
    await settle();
    expect(byId('model-status').textContent).toMatch(
      new RegExp(
        `^Ready: .*\\. Running in this browser, on your processor and memory \\(${threads}\\)\\.$`,
      ),
    );
  });
});
