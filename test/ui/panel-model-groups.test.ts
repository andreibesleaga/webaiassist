// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
// The model list of the side panel is drawn as two groups, by where the model runs.
import { beforeEach, describe, expect, it } from 'vitest';
import { startPanel } from '../../src/ui/panel-controller';
import { answer } from '../helpers';
import { loadPage } from './dom';
import { fakeDeps } from './panel-fakes';

const groupLabels = (): string[] =>
  [...document.querySelectorAll<HTMLOptGroupElement>('#model optgroup')].map((g) => g.label);

describe('the model list as groups', () => {
  beforeEach(() => {
    loadPage('sidepanel.html');
  });

  it('draws on this computer, and your own server or a remote service', async () => {
    const deps = fakeDeps([answer('hi')]);
    deps.settings = {
      ...deps.settings,
      endpoint: { ...deps.settings.endpoint, url: 'https://api.example.com/v1', model: 'big' },
    };
    await startPanel(deps);
    expect(groupLabels()).toEqual([
      'On this computer, in the browser',
      'Your own server or a remote service',
    ]);
    const groups = [...document.querySelectorAll<HTMLOptGroupElement>('#model optgroup')];
    expect([...groups[1]!.querySelectorAll('option')].map((o) => o.value)).toEqual(['endpoint']);
    expect(groups[0]!.querySelectorAll('option').length).toBeGreaterThanOrEqual(4);
  });

  it('shows the set-up entry in the second group while there is no endpoint', async () => {
    await startPanel(fakeDeps([answer('hi')]));
    expect(groupLabels()).toEqual([
      'On this computer, in the browser',
      'Your own server or a remote service',
    ]);
  });
});
