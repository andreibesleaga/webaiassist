// SPDX-License-Identifier: Apache-2.0
// Reset: settings and the agreed remote hosts go; the endpoint's host permission is given back
// (that one pattern only).
import { describe, expect, it } from 'vitest';
import {
  loadSettings,
  saveSettings,
  SETTINGS_KEY,
  DEFAULT_SETTINGS,
} from '../../src/adapters/settings';
import type { StorageAreaLike } from '../../src/adapters/settings';
import { loadPanelState, savePanelState } from '../../src/adapters/stored-panel-state';
import { resetOptions } from '../../src/ui/options-reset';

class MemoryArea implements StorageAreaLike {
  readonly data: Record<string, unknown> = {};
  get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve(key in this.data ? { [key]: this.data[key] } : {});
  }
  set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, items);
    return Promise.resolve();
  }
  remove(key: string): Promise<void> {
    delete this.data[key];
    return Promise.resolve();
  }
}

async function setup(url: string, model: string) {
  const area = new MemoryArea();
  await saveSettings(area, {
    ...DEFAULT_SETTINGS,
    runtime: 'endpoint',
    endpoint: { ...DEFAULT_SETTINGS.endpoint, url, model },
  });
  await savePanelState(area, { endpointHosts: ['api.example.com'], firstRunDone: true });
  const removed: string[][] = [];
  return { area, removed, remove: (o: string[]) => (removed.push(o), Promise.resolve(true)) };
}

describe('resetOptions', () => {
  it('clears the settings and the agreed endpoint hosts, and gives back the endpoint host only', async () => {
    const f = await setup('http://localhost:11434/v1', 'llama');
    await resetOptions({ area: f.area, removeOrigins: f.remove });
    expect(SETTINGS_KEY in f.area.data).toBe(false);
    expect((await loadSettings(f.area)).endpoint.model).toBe(DEFAULT_SETTINGS.endpoint.model);
    const state = await loadPanelState(f.area);
    expect(state.endpointHosts).toBeUndefined();
    expect(state.firstRunDone).toBe(true);
    expect(f.removed).toEqual([['http://localhost/*']]);
  });

  it('removes no permission when no endpoint was set up', async () => {
    const f = await setup('http://localhost:11434/v1', '');
    await resetOptions({ area: f.area, removeOrigins: f.remove });
    expect(f.removed).toEqual([]);
  });

  it('goes on when Chrome refuses to remove the permission', async () => {
    const f = await setup('https://api.example.com/v1', 'gpt');
    const refuse = () => Promise.reject(new Error('no'));
    await expect(resetOptions({ area: f.area, removeOrigins: refuse })).resolves.toBeUndefined();
    expect(SETTINGS_KEY in f.area.data).toBe(false);
  });
});
