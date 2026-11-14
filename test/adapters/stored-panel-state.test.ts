// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { StorageAreaLike } from '../../src/adapters/settings';
import {
  loadPanelState,
  normalizePanelState,
  PANEL_STATE_KEY,
  savePanelState,
} from '../../src/adapters/stored-panel-state';

class MemoryArea implements StorageAreaLike {
  readonly data: Record<string, unknown> = {};
  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve(key in this.data ? { [key]: this.data[key] } : {});
  }
  set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, JSON.parse(JSON.stringify(items)));
    return Promise.resolve();
  }
  remove(key: string): Promise<void> {
    delete this.data[key];
    return Promise.resolve();
  }
}

describe('stored panel state', () => {
  it('starts with the first run not done and no measurement', async () => {
    expect(await loadPanelState(new MemoryArea())).toEqual({ firstRunDone: false });
  });

  it('keeps what was saved, and a later save changes only what it names', async () => {
    const area = new MemoryArea();
    await savePanelState(area, { firstRunDone: true });
    await savePanelState(area, { gpu: { key: 'amd/gcn-5', firstAnswerMs: 40_000 } });
    expect(await loadPanelState(area)).toEqual({
      firstRunDone: true,
      gpu: { key: 'amd/gcn-5', firstAnswerMs: 40_000 },
    });
    expect(Object.keys(area.data)).toEqual([PANEL_STATE_KEY]);
  });

  it('replaces values it does not know', () => {
    expect(normalizePanelState('x')).toEqual({ firstRunDone: false });
    expect(
      normalizePanelState({ firstRunDone: 'yes', gpu: { key: 5, firstAnswerMs: -1 }, extra: 1 }),
    ).toEqual({ firstRunDone: false });
    expect(normalizePanelState({ gpu: { key: 'a/b', firstAnswerMs: Number.NaN } })).toEqual({
      firstRunDone: false,
    });
    expect(normalizePanelState({ gpu: { key: 'a/b', firstAnswerMs: 12.4 } }).gpu).toEqual({
      key: 'a/b',
      firstAnswerMs: 12,
    });
  });

  it('keeps the hosts of remote endpoints the user agreed to, and nothing else', () => {
    expect(
      normalizePanelState({ endpointHosts: ['openrouter.ai', 'openrouter.ai', 5, 'llm.example'] }),
    ).toEqual({ firstRunDone: false, endpointHosts: ['openrouter.ai', 'llm.example'] });
    expect(normalizePanelState({ endpointHosts: 'openrouter.ai' })).toEqual({
      firstRunDone: false,
    });
  });
});
