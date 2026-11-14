// SPDX-License-Identifier: Apache-2.0
// Shared set-up of the Options page tests: a fake dependency set and small helpers.
import { DEFAULT_SETTINGS, type Settings } from '../../src/adapters/settings';
import type { OptionsDeps } from '../../src/ui/options-page';
import { byId, tick } from './dom';
import { FakeStore } from './panel-fakes';

export interface Fake extends OptionsDeps {
  stored: Settings;
  readonly requested: string[];
  granted: boolean;
  cleared: number;
  readonly store: FakeStore;
  forgotten: number;
}

export function fake(stored: Settings = DEFAULT_SETTINGS): Fake {
  const deps: Fake = {
    doc: document,
    stored,
    requested: [],
    granted: true,
    cleared: 0,
    forgotten: 0,
    store: new FakeStore(),
    forgetAll: () => {
      deps.forgotten += 1;
      return Promise.resolve();
    },
    load: () => Promise.resolve(deps.stored),
    save: (s) => {
      deps.stored = s;
      return Promise.resolve(s);
    },
    reset: () => {
      deps.stored = DEFAULT_SETTINGS;
      return Promise.resolve();
    },
    requestOrigin: (origin) => {
      deps.requested.push(origin);
      return Promise.resolve(deps.granted);
    },
    clearMemory: () => {
      deps.cleared += 1;
      return Promise.resolve();
    },
  };
  return deps;
}

export const input = (id: string) => byId<HTMLInputElement>(id);
export const select = (id: string) => byId<HTMLSelectElement>(id);

export async function save(): Promise<void> {
  byId<HTMLFormElement>('options').requestSubmit();
  for (let i = 0; i < 5; i += 1) await tick();
}

export function choose(id: string, value: string): void {
  select(id).value = value;
  select(id).dispatchEvent(new Event('change'));
}
