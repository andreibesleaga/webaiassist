// SPDX-License-Identifier: Apache-2.0
// Shared set-up of the tests of the page card and the site reading.
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { FileOutcome } from '../../src/core/site-files';
import type { Outcomes } from '../../src/core/site-facts';
import { AGSC_PROFILE } from '../../src/core/site-linkset';
import { QUIET_MS } from '../../src/ui/panel-follow';
import { startPanel, type PanelController } from '../../src/ui/panel-controller';
import { byId, click } from './dom';
import type { FakeDeps } from './panel-fakes';

export const fixture = (name: string): string =>
  readFileSync(`fixtures/site-files/${name}`, 'utf8');

export const found = (text: string, contentType = 'text/plain'): FileOutcome => ({
  state: 'found',
  text,
  cut: false,
  link: '',
  contentType,
});

/** The five files of the live node, with their content types. */
export function nodeOutcomes(): Outcomes {
  return {
    linkset: found(
      fixture('agsc-linkset.json').replaceAll(
        'https://agenticsystemcore.com',
        'https://node.example',
      ),
      `application/linkset+json; profile="${AGSC_PROFILE}"`,
    ),
    llms: found(fixture('agsc-llms.txt')),
    robots: found(fixture('agsc-robots.txt')),
    tdmrep: found(fixture('agsc-tdmrep.json'), 'application/json'),
    security: found(
      fixture('agsc-security.txt').replaceAll(
        'https://agenticsystemcore.com',
        'https://node.example',
      ),
    ),
  };
}

export const noAi = (): Outcomes => ({
  llms: found('# Guide\n> The site guide.\n## Things\n- [One](https://node.example/one)'),
  robots: found('User-agent: *\nContent-Signal: ai-input=no\n'),
});

/** Lets pending promises run; the timers stay fake. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

export function fakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
}

/** Waits for the gathered browser events to give their refresh. */
export async function afterQuiet(): Promise<void> {
  await vi.advanceTimersByTimeAsync(QUIET_MS);
  await flush();
}

export async function open(deps: FakeDeps): Promise<PanelController> {
  const panel = await startPanel(deps);
  await flush();
  return panel;
}

export async function startModel(): Promise<void> {
  click('start');
  await flush();
}

export async function ask(text: string): Promise<void> {
  byId<HTMLTextAreaElement>('question').value = text;
  byId<HTMLFormElement>('ask').requestSubmit();
  await flush();
}

export const text = (id: string): string => byId(id).textContent ?? '';
export const chips = (): string[] =>
  [...byId('site-chips').querySelectorAll('li')].map((li) => li.textContent ?? '');
