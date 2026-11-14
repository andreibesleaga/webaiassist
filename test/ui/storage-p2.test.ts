// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// Package P2, storage: persistent storage is asked once after the first successful download
// (never at install, never when nothing was downloaded), and Options shows the total size.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startOptions } from '../../src/ui/options-page';
import { byId, click, loadPage } from './dom';
import { fake } from './options-fakes';
import { fakeDeps } from './panel-fakes';
import { fakeClock, flush, open } from './site-helpers';

describe('persistent storage', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });
  afterEach(() => vi.useRealTimers());

  function withPersist(empty: boolean) {
    const deps = fakeDeps(['x']);
    if (empty) deps.store.stored = [];
    const asked: number[] = [];
    deps.persistStorage = () => {
      asked.push(1);
      return Promise.resolve(true);
    };
    return { deps, asked };
  }

  it('asks nothing when the panel opens, nor when a model that is already stored starts', async () => {
    const { deps, asked } = withPersist(false);
    await open(deps);
    expect(asked).toEqual([]);
    click('start');
    await flush();
    expect(asked).toEqual([]);
  });

  it('asks once after the first successful download, and not again after the next', async () => {
    const { deps, asked } = withPersist(true);
    await open(deps);
    click('start');
    await flush();
    expect(asked).toEqual([]);
    click('consent-ok');
    await flush();
    expect(asked).toEqual([1]);
    expect(deps.panelState.persistAsked).toBe(true);
    click('start');
    await flush();
    click('consent-ok');
    await flush();
    expect(asked).toEqual([1]);
  });

  it('does not ask again in a later panel when it was asked before', async () => {
    const { deps, asked } = withPersist(true);
    deps.panelState = { firstRunDone: true, persistAsked: true };
    await open(deps);
    click('start');
    await flush();
    click('consent-ok');
    await flush();
    expect(asked).toEqual([]);
  });

  it('survives a refusal or a missing function', async () => {
    const { deps } = withPersist(true);
    deps.persistStorage = () => Promise.reject(new Error('no'));
    await open(deps);
    click('start');
    await flush();
    click('consent-ok');
    await flush();
    expect(byId('model-status').textContent).toMatch(/^Ready/);
  });
});

describe('Options: total size of the downloaded models', () => {
  beforeEach(() => loadPage('options.html'));

  it('shows the total beside the list, and hides it when nothing is stored', async () => {
    const deps = fake();
    await startOptions(deps);
    const total = byId('model-store-total');
    expect(total.hidden).toBe(false);
    const sum = deps.store.stored.reduce((n, m) => n + m.bytes, 0);
    expect(total.textContent).toBe(`Total on this computer: ${Math.round(sum / 1_000_000)} MB`);
    deps.store.stored = [];
    await startOptions(deps);
    expect(byId('model-store-total').hidden).toBe(true);
  });
});
