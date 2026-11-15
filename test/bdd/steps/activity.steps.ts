// SPDX-License-Identifier: Apache-2.0
// Steps of features/27-activity-log.feature: the Activity log button in the panel's More area and
// the Activity view of the explorer page it opens.
import { expect, type Page } from '@playwright/test';
import type { World } from '../world';
import { Then, When } from './fixtures';

const views = new WeakMap<World, Page>();

function viewOf(world: World): Page {
  const view = views.get(world);
  if (!view) throw new Error('open the Activity log first');
  return view;
}

When('I open the Activity log from the More area', async ({ world }) => {
  const panel = world.requirePanel();
  await panel.click('#more-toggle');
  const opened = (await world.session()).context.waitForEvent('page');
  await panel.click('#open-activity');
  const view = await opened;
  await view.waitForLoadState('domcontentloaded');
  views.set(world, view);
});

Then(
  'the Activity view lists a question that used the tool {string}',
  async ({ world }, tool: string) => {
    const log = viewOf(world).getByRole('log', { name: /activity/i });
    await expect(log).toContainText(tool);
  },
);

Then('the Activity view has the Activity tab and no other tab', async ({ world }) => {
  const view = viewOf(world);
  await expect(view.getByRole('tab')).toHaveCount(1);
  await expect(view.getByRole('tab', { name: 'Activity' })).toBeVisible();
  await expect(view.getByRole('log', { name: /activity/i })).toBeVisible();
});
