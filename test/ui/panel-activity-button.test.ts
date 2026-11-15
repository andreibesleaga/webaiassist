// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The "Activity log" button in the panel's More area: it works on any page, node or not.
import { beforeEach, describe, expect, it } from 'vitest';
import { answer } from '../helpers';
import { byId, click, loadPage } from './dom';
import { fakeDeps } from './panel-fakes';
import { fakeClock, open } from './site-helpers';

describe('the Activity log button', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
    fakeClock();
  });

  it('sits in the More area and is named "Activity log"', () => {
    const button = byId('open-activity');
    expect(button.closest('#more')).not.toBeNull();
    expect(button.textContent).toBe('Activity log');
  });

  it('opens the Activity view for this tab and site', async () => {
    const opened: unknown[][] = [];
    const deps = { ...fakeDeps([answer('ok')]), openActivity: (...a: unknown[]) => opened.push(a) };
    await open(deps);
    click('open-activity');
    expect(opened).toHaveLength(1);
    expect(opened[0]).toEqual([expect.any(Number), expect.stringMatching(/^https?:\/\//)]);
  });
});
