// SPDX-License-Identifier: Apache-2.0
// Steps of the model choice, consent, storage and error scenarios (features 02, 03, 05, 13, 15):
// the "Why" line, the question before a download, the list of downloaded models in Options, the
// error banner, the offline note and "Forget all sites".
import { expect, type Page } from '@playwright/test';
import { Given, Then, When } from './fixtures';
import { chooseCpu } from './setup.steps';

const button = (name: string) => ({ name, exact: true }) as const;
const text = (page: Page, selector: string): Promise<string> => page.locator(selector).innerText();

/** The stored files of the fake processor engine (the smoke build's model disk). */
const storedFiles = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('webaiassist.fake-cpu-disk');
    return raw ? Object.keys((JSON.parse(raw) as { disk: object }).disk) : [];
  });

interface Facts {
  lines: string[];
  facts: { cancelShown: boolean; progress: number }[];
}

const watched = (page: Page): Promise<Facts> =>
  page.evaluate(() => {
    const w = window as unknown as { __modelLines?: string[]; __modelFacts?: Facts['facts'] };
    return { lines: w.__modelLines ?? [], facts: w.__modelFacts ?? [] };
  });

// ---- the default model and its reason ------------------------------------------------------

Then(
  'the "Why" line under the model list gives one reason for the default model',
  async ({ world }) => {
    const why = world.requirePanel().locator('#model-why');
    await expect(why).toHaveText(/^Why: [^\n]{20,}$/);
    await expect(why).not.toContainText('you chose');
  },
);

Then('choosing another model changes the line to {string}', async ({ world }, line: string) => {
  const panel = world.requirePanel();
  const other = await panel.locator('#model').evaluate((select: HTMLSelectElement) => {
    const options = [...select.options].filter((o) => o.value !== select.value);
    return options[0]?.value ?? '';
  });
  await panel.selectOption('#model', other);
  await expect(panel.locator('#model-why')).toHaveText(line);
});

// ---- no graphics card ------------------------------------------------------------------------

Given('this computer has no usable WebGPU', async ({ world }) => {
  const adapter = await world
    .requirePanel()
    .evaluate(async () => (await navigator.gpu?.requestAdapter()) != null);
  expect(adapter, 'this scenario needs a browser without a WebGPU adapter').toBe(false);
});

When('I press {string} with the graphics card model selected', async ({ world }, name: string) => {
  const panel = world.requirePanel();
  await panel.selectOption('#model', 'webllm:qwen3-0.6b-q4_k_m');
  await panel.getByRole('button', button(name)).click();
});

Then(
  'an error says that this browser has no usable graphics acceleration and why',
  async ({ world }) => {
    await expect(world.requirePanel().locator('#error-text')).toContainText(
      'This browser has no usable graphics acceleration here:',
    );
  },
);

Then('the error offers {string}', async ({ world }, name: string) => {
  await expect(
    world.requirePanel().locator('#error-banner').getByRole('button', button(name)),
  ).toBeVisible();
});

Then('the CPU model is selected', async ({ world }) => {
  await expect(world.requirePanel().locator('#model')).toHaveValue(/^cpu:/);
});

// ---- the question before a download ------------------------------------------------------------

Given('the CPU model is not on this computer', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu');
  expect(await storedFiles(world.requirePanel())).toEqual([]);
});

Given('the consent block is shown', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu');
  const panel = world.requirePanel();
  await panel.click('#start');
  await expect(panel.locator('#consent')).toBeVisible();
});

Then(
  'a consent block says the model must download once, with its size in MB and its source host',
  async ({ world }) => {
    const panel = world.requirePanel();
    await expect(panel.locator('#consent')).toBeVisible();
    await expect(panel.locator('#model-status')).toContainText('must download 1 MB once');
    await expect(panel.locator('#consent-body')).toContainText('1 MB, once. From huggingface.co');
    await expect(panel.locator('#consent-body')).toContainText('Stored in this browser');
  },
);

Then('no download has started', async ({ world }) => {
  const panel = world.requirePanel();
  expect((await watched(panel)).lines.some((l) => l.startsWith('Downloading'))).toBe(false);
  expect(await storedFiles(panel)).toEqual([]);
});

Then('{string} is disabled until I answer', async ({ world }, name: string) => {
  await expect(world.requirePanel().getByRole('button', button(name))).toBeDisabled();
});

Then('the consent block is hidden', async ({ world }) => {
  await expect(world.requirePanel().locator('#consent')).toBeHidden();
});

Then('the focus is back on {string}', async ({ world }, name: string) => {
  await expect(world.requirePanel().getByRole('button', button(name))).toBeFocused();
});

Then('nothing was downloaded or stored', async ({ world }) => {
  const panel = world.requirePanel();
  expect((await watched(panel)).lines.some((l) => l.startsWith('Downloading'))).toBe(false);
  expect(await storedFiles(panel)).toEqual([]);
  await expect(panel.locator('#model-status')).toHaveText('No model loaded. Press Start.');
});

Then('the progress bar shows how much of the model has arrived', async ({ world }) => {
  const panel = world.requirePanel();
  await expect
    .poll(async () => (await watched(panel)).facts.some((f) => f.progress > 0 && f.progress < 1))
    .toBe(true);
});

Then(
  'the model line says "Downloading" with the megabytes done and the percent',
  async ({ world }) => {
    const panel = world.requirePanel();
    await expect
      .poll(async () =>
        (await watched(panel)).lines.some((l) =>
          /^Downloading .+: \d+ of \d+ MB \(\d+%\)$/.test(l),
        ),
      )
      .toBe(true);
  },
);

Then('{string} is shown', async ({ world }, name: string) => {
  const panel = world.requirePanel();
  await expect
    .poll(async () => {
      const { lines, facts } = await watched(panel);
      return lines.some((l, i) => l.startsWith('Downloading') && facts[i]?.cancelShown === true);
    })
    .toBe(true);
  expect(name).toBe('Cancel download');
});

// ---- storage refused ----------------------------------------------------------------------------

Given('the browser has no space to store the model', async ({ world }) => {
  await chooseCpu(world, 'cpu:smoke-cpu-full');
});

Then('the panel says the browser has no space, with the size needed', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#model-status')).toContainText(
    'The browser has no space to store Smoke CPU model that needs a free disk (1 MB)',
  );
  await expect(panel.locator('#error-text')).toContainText('(1 MB)');
});

Then('it points to {string} in Options', async ({ world }, name: string) => {
  await expect(world.requirePanel().locator('#error-banner')).toContainText(`${name} in Options`);
  await expect(
    world.requirePanel().locator('#error-banner').getByRole('button', button('Open Options')),
  ).toBeVisible();
});

// ---- the list of downloaded models in Options -----------------------------------------------------

Then('the list of downloaded models shows {string}', async ({ world }, row: string) => {
  await expect(world.target().locator('#model-store')).toContainText(row);
});

Then('the removal question says {string}', async ({ world }, question: string) => {
  await expect(world.target().locator('#remove-confirm-text')).toHaveText(question);
});

Then(
  'the list of downloaded models is empty and says {string}',
  async ({ world }, status: string) => {
    const options = world.target();
    await expect(options.locator('#model-store li')).toHaveCount(0);
    await expect(options.locator('#model-store-empty')).toBeVisible();
    await expect(options.locator('#options-status')).toHaveText(status);
  },
);

Then('the next Start asks for consent again', async ({ world }) => {
  world.focusOn('panel');
  const panel = world.requirePanel();
  await panel.click('#start');
  await expect(panel.locator('#consent')).toBeVisible();
  expect(await storedFiles(panel)).toEqual([]);
});

// ---- Options: the choices ---------------------------------------------------------------------------

/** The page writes a typographic apostrophe; the feature text a plain one. */
const typographic = (label: string): string => label.replaceAll("'", '’');

Then(
  'the choices {string}, {string} and {string} are listed with a line each',
  async ({ world }, first: string, second: string, third: string) => {
    const options = world.target();
    for (const label of [first, second, third]) {
      const radio = options.getByLabel(typographic(label), { exact: true });
      await expect(radio).toBeVisible();
      const help = await radio.getAttribute('aria-describedby');
      expect((await text(options, `#${help}`)).length).toBeGreaterThan(20);
    }
  },
);

Then('the line under {string} says {string}', async ({ world }, label: string, line: string) => {
  const options = world.target();
  const help = await options.getByLabel(label, { exact: true }).getAttribute('aria-describedby');
  await expect(options.locator(`#${help}`)).toContainText(line);
});
