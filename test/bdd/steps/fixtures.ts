// SPDX-License-Identifier: Apache-2.0
// The Playwright test instance of the BDD steps: each scenario gets one World that starts the
// browser with the extension lazily and closes it afterwards.
import { createBdd, test as base } from 'playwright-bdd';
import { World } from '../world';

export const test = base.extend<{ world: World }>({
  // eslint-disable-next-line no-empty-pattern
  world: async ({}, use) => {
    const world = new World();
    await use(world);
    await world.close();
  },
});

export const { Given, When, Then } = createBdd(test);
