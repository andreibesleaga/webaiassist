// SPDX-License-Identifier: Apache-2.0
// When and Then steps for the side panel and the Options page: buttons, questions, the status
// lines, the conversation and the confirmation dialog. "{host}" and "{origin}" in a quoted text
// stand for the page under test.
import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readLog } from '../../smoke/fake-language-model';
import { clickToolbarButton, openPanelFor } from '../../smoke/harness';
import { openOptions } from './setup.steps';
import { Then, When } from './fixtures';

const button = (name: string) => ({ name, exact: true }) as const;

When('I click the toolbar button', async ({ world }) => {
  if (!world.page) throw new Error('open a page first');
  await clickToolbarButton(await world.session(), world.page);
});

Then('the side panel is open', async ({ world }) => {
  const session = await world.session();
  await expect
    .poll(() =>
      session.worker.evaluate(
        async () =>
          (
            await chrome.runtime.getContexts({
              contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
            })
          ).length,
      ),
    )
    .toBe(1);
  // The real side panel is not a tab; a tab bound to the same page shows the same state.
  if (world.tabId === undefined) throw new Error('open a page first');
  world.panel = await openPanelFor(session, world.tabId);
  world.focusOn('panel');
});

/** Buttons whose visible name carries a count, so the feature names them by their first word. */
const BY_ID: Readonly<Record<string, string>> = { Tools: '#tools-toggle' };

/** The buttons of the card that live under "More". */
const IN_MORE = new Set(['Add WebMCP to this site', 'Forget this site', 'Export']);

/** A button as a person finds it: under "More" the disclosure is opened first. */
async function buttonNamed(page: Page, name: string): Promise<Locator> {
  if (
    IN_MORE.has(name) &&
    !(await page.locator('#more').evaluate((el) => el.hasAttribute('open')))
  ) {
    await page.click('#more-toggle');
  }
  const id = BY_ID[name];
  return id === undefined ? page.getByRole('button', button(name)) : page.locator(id);
}

When('I press {string}', async ({ world }, name: string) => {
  await (await buttonNamed(world.target(), name)).click();
});

When('I press {string} and save the file', async ({ world }, name: string) => {
  const target = world.target();
  const download = target.waitForEvent('download');
  await (await buttonNamed(target, name)).click();
  world.download = await download;
});

When('I ask {string}', async ({ world }, question: string) => {
  const panel = world.requirePanel();
  await panel.fill('#question', question);
  await panel.press('#question', 'Control+Enter');
});

/** Allows every question the panel asks until the run is over (the run has started once a
 *  question, a second line in the conversation or a disabled Send was seen). */
When('I allow what is asked until the answer ends', async ({ world }) => {
  const panel = world.requirePanel();
  let started = false;
  const settled = async (): Promise<boolean> => {
    if (await panel.locator('#confirm-title').isVisible()) {
      const title = (await panel.locator('#confirm-title').textContent()) ?? '';
      if (title.startsWith('Run the tool')) world.toolQuestions += 1;
      await panel.click('#confirm-allow');
      started = true;
      return false;
    }
    const running = await panel.locator('#send').isDisabled();
    started ||= running || (await panel.locator('#transcript li').count()) > 1;
    return started && !running;
  };
  await expect.poll(settled, { timeout: 30_000, intervals: [100] }).toBe(true);
});

When('I choose the model {string}', async ({ world }, label: string) => {
  const panel = world.requirePanel();
  // The list is filled a moment after the panel starts: wait for the model.
  const fullLabel = (): Promise<string> =>
    panel.evaluate((start) => {
      const options = [...document.querySelectorAll<HTMLOptionElement>('#model option')];
      return options.find((o) => (o.textContent ?? '').startsWith(start))?.label ?? '';
    }, label);
  await expect.poll(fullLabel, { message: `a model starting with "${label}"` }).not.toBe('');
  await panel.selectOption('#model', { label: await fullLabel() });
});

When('I press the Escape key', async ({ world }) => {
  await world.requirePanel().keyboard.press('Escape');
});

When('I open the Options page again', async ({ world }) => {
  await openOptions(world);
});

When('I choose the option {string}', async ({ world }, label: string) => {
  await world.target().getByLabel(label, { exact: true }).check();
});

When('I set the field {string} to {string}', async ({ world }, label: string, value: string) => {
  await world.target().getByLabel(label, { exact: true }).fill(value);
});

Then('the option {string} is chosen', async ({ world }, label: string) => {
  await expect(world.target().getByLabel(label, { exact: true })).toBeChecked();
});

Then('the field {string} has the value {string}', async ({ world }, label: string, v: string) => {
  await expect(world.target().getByLabel(label, { exact: true })).toHaveValue(v);
});

Then('the options status says {string}', async ({ world }, text: string) => {
  await expect(world.target().locator('#options-status')).toHaveText(text);
});

Then('the page line says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#page-status')).toHaveText(await world.fill(text));
});

Then('the page line is not shown as an error', async ({ world }) => {
  await expect(world.requirePanel().locator('#page-status')).not.toContainText('did not list');
});

Then('the model line says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#model-status')).toHaveText(text);
});

Then('the model line contains {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#model-status')).toContainText(text, {
    timeout: 30_000,
  });
});

Then('the built-in model line says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#builtin-state')).toHaveText(text);
});

Then("the model list has no entry for Chrome's built-in model", async ({ world }) => {
  await expect(world.requirePanel().locator('#model option[value="prompt-api"]')).toHaveCount(0);
});

Then('the page note says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#page-note')).toHaveText(await world.fill(text));
});

Then('the page note contains {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#page-note')).toContainText(await world.fill(text));
});

Then('the page note is empty', async ({ world }) => {
  await expect(world.requirePanel().locator('#page-note')).toHaveText('');
});

Then('the conversation shows {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#transcript')).toContainText(await world.fill(text));
});

Then('the conversation shows {string} once', async ({ world }, text: string) => {
  const transcript = world.requirePanel().locator('#transcript');
  await expect(transcript).toContainText(await world.fill(text));
  const shown = (await transcript.textContent()) ?? '';
  expect(shown.split(await world.fill(text))).toHaveLength(2);
});

Then('the tool question was asked {int} time(s)', ({ world }, times: number) => {
  expect(world.toolQuestions).toBe(times);
});

Then('the question box is usable', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#question')).toBeEnabled();
  await expect(panel.locator('#send')).toBeEnabled();
});

Then('the conversation does not show {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#transcript')).not.toContainText(text);
});

Then('the conversation is empty', async ({ world }) => {
  await expect(world.requirePanel().locator('#transcript li')).toHaveCount(0);
});

Then('the conversation shows an error', async ({ world }) => {
  await expect(world.requirePanel().locator('#transcript')).toContainText('Error:');
});

Then('the tool result is marked untrusted', async ({ world }) => {
  const marked = world.requirePanel().locator('#transcript [data-trust="untrusted"]');
  await expect(marked.first()).toBeVisible();
});

Then('a dialog titled {string} is open', async ({ world }, title: string) => {
  await expect(world.requirePanel().locator('#confirm-title')).toHaveText(await world.fill(title));
});

Then('the dialog says {string}', async ({ world }, text: string) => {
  await expect(world.requirePanel().locator('#confirm-body')).toContainText(await world.fill(text));
});

Then('no tool dialog is shown', async ({ world }) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#send')).toBeEnabled();
  await expect(panel.locator('#confirm')).not.toHaveAttribute('open', '');
});

Then('the {string} button has focus', async ({ world }, name: string) => {
  await expect(world.target().getByRole('button', button(name))).toBeFocused();
});

Then('the {string} button is hidden', async ({ world }, name: string) => {
  await expect(world.target().getByRole('button', button(name))).toBeHidden();
});

Then('the {string} button is shown', async ({ world }, name: string) => {
  await expect(world.target().getByRole('button', button(name))).toBeVisible();
});

Then('the {string} button is enabled', async ({ world }, name: string) => {
  await expect(world.target().getByRole('button', button(name))).toBeEnabled();
});

Then('the {string} button is disabled', async ({ world }, name: string) => {
  await expect(world.target().getByRole('button', button(name))).toBeDisabled();
});

Then('the help text {string} is shown', async ({ world }, title: string) => {
  const panel = world.requirePanel();
  await expect(panel.locator('#help')).toBeVisible();
  await expect(panel.getByRole('heading', { name: title })).toBeVisible();
});

Then('the help text is hidden', async ({ world }) => {
  await expect(world.requirePanel().locator('#help')).toBeHidden();
});

Then('the file is named {string}', ({ world }, name: string) => {
  expect(world.download?.suggestedFilename()).toBe(name);
});

Then('the file contains {string}', async ({ world }, text: string) => {
  const path = await world.download?.path();
  expect(path, 'the downloaded file').toBeTruthy();
  expect(readFileSync(path as string, 'utf8')).toContain(await world.fill(text));
});

const REPLY_ROOM = 4; // the runtime keeps a quarter of the window free for the reply
const CHARS_PER_TOKEN = 3; // the core's own estimate for Latin text

Then(
  'the tool list sent to the model fits the context and still names every tool',
  async ({ world }) => {
    const log = await readLog(world.requirePanel());
    const system = log.creates.at(-1)?.initialPrompts?.[0]?.content ?? '';
    const window = world.builtIn?.contextWindow ?? 0;
    expect(window).toBeGreaterThan(0);
    expect(system.length / CHARS_PER_TOKEN).toBeLessThanOrEqual(window - window / REPLY_ROOM);
    expect(system).toMatch(/\badd\(/);
    expect(system).toMatch(/\becho\(/);
    expect(system).not.toContain('inputSchema');
  },
);

Then(
  'the reply sent to the built-in model is constrained to the tools {string} and {string}',
  async ({ world }, first: string, second: string) => {
    const log = await readLog(world.requirePanel());
    expect(log.prompts[0]?.omit).toBe(true);
    expect(JSON.stringify(log.prompts[0]?.constraint)).toContain(`"enum":["${first}","${second}"]`);
  },
);

Then('the scripted built-in model was started by a click', async ({ world }) => {
  const log = await readLog(world.requirePanel());
  expect(log.creates[0]?.active).toBe(true);
});
