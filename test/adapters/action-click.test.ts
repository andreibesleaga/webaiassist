// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { onActionClick, type ActionDeps } from '../../src/adapters/action-click';

function deps(options: { inject?: Error; open?: Error; notify?: Error } = {}) {
  const calls: string[] = [];
  const warnings: string[] = [];
  const d: ActionDeps = {
    openPanel: (windowId) => {
      calls.push(`open ${windowId}`);
      return options.open ? Promise.reject(options.open) : Promise.resolve();
    },
    inject: (tabId) => {
      calls.push(`inject ${tabId}`);
      return options.inject ? Promise.reject(options.inject) : Promise.resolve();
    },
    notifyPanel: () => {
      calls.push('notify');
      return options.notify ? Promise.reject(options.notify) : Promise.resolve();
    },
    warn: (text) => warnings.push(text),
  };
  return { d, calls, warnings };
}

describe('onActionClick', () => {
  it('opens the panel at once (inside the click), then adds the page scripts and tells the panel', async () => {
    const { d, calls } = deps();
    const done = onActionClick(d, { id: 7, windowId: 3 });
    expect(calls).toEqual(['open 3', 'inject 7']);
    await done;
    expect(calls).toEqual(['open 3', 'inject 7', 'notify']);
  });

  it('only opens the panel when the tab has no id', async () => {
    const { d, calls } = deps();
    await onActionClick(d, { windowId: 3 });
    expect(calls).toEqual(['open 3']);
  });

  it('does not tell the panel when the page cannot be scripted, and never throws', async () => {
    const { d, calls, warnings } = deps({
      inject: new Error('Cannot access a chrome:// URL'),
      open: new Error('no window'),
    });
    await onActionClick(d, { id: 7, windowId: 3 });
    expect(calls).toEqual(['open 3', 'inject 7']);
    expect(warnings).toHaveLength(2);
  });

  it('stays quiet when no panel listens yet', async () => {
    const { d, warnings } = deps({ notify: new Error('Receiving end does not exist.') });
    await onActionClick(d, { id: 7, windowId: 3 });
    expect(warnings).toEqual([]);
  });
});
