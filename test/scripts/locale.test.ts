// SPDX-License-Identifier: Apache-2.0
// The build writes Chrome's locale file (_locales/en/messages.json) from the typed dictionary
// in src/ui/messages-en.ts, and makes the manifest texts Chrome shows localisable.
import { describe, expect, it } from 'vitest';
import { chromeMessages, localiseManifest } from '../../scripts/locale.mjs';
import { EN } from '../../src/ui/messages-en';

const TEXTS = { extDescription: 'A local AI model.', extActionTitle: 'Open WebAIAssist' };

describe('chromeMessages', () => {
  it('gives every text of the dictionary and of the manifest as { message }', () => {
    expect(chromeMessages({ start: 'Start' }, TEXTS)).toEqual({
      extDescription: { message: 'A local AI model.' },
      extActionTitle: { message: 'Open WebAIAssist' },
      start: { message: 'Start' },
    });
  });

  it('doubles a dollar sign, which Chrome otherwise reads as a placeholder', () => {
    const one = '$';
    const file = chromeMessages({ price: `${one}{amount}` }, TEXTS);
    expect(file.price).toEqual({ message: `${one}${one}{amount}` });
  });

  it('refuses a name Chrome does not accept', () => {
    expect(() => chromeMessages({ 'bad-name': 'x' }, TEXTS)).toThrow(/bad-name/);
    expect(() => chromeMessages({ '@@ui_locale': 'x' }, TEXTS)).toThrow(/@@ui_locale/);
  });

  it('refuses two names that differ only in case, which Chrome treats as one', () => {
    expect(() => chromeMessages({ runNow: 'a', RunNow: 'b' }, TEXTS)).toThrow(/runNow.*RunNow/);
  });

  it('refuses a store description over 132 characters', () => {
    const long = { ...TEXTS, extDescription: 'd'.repeat(133) };
    expect(() => chromeMessages({}, long)).toThrow(/132/);
  });

  it('accepts the whole English dictionary', () => {
    const file = chromeMessages(EN, TEXTS);
    expect(Object.keys(file)).toHaveLength(Object.keys(EN).length + 2);
    expect(file.appName).toEqual({ message: 'WebAIAssist' });
  });
});

describe('localiseManifest', () => {
  const manifest = {
    name: 'WebAIAssist',
    description: 'A local AI model.',
    action: { default_title: 'Open WebAIAssist', default_icon: { '16': 'icons/icon-16.png' } },
  };

  it('keeps the name, and points the description and the button title at the locale file', () => {
    const { manifest: out, texts } = localiseManifest(manifest);
    expect(out).toMatchObject({
      name: 'WebAIAssist',
      default_locale: 'en',
      description: '__MSG_extDescription__',
      action: {
        default_title: '__MSG_extActionTitle__',
        default_icon: { '16': 'icons/icon-16.png' },
      },
    });
    expect(texts).toEqual(TEXTS);
  });

  it('leaves the manifest it was given unchanged', () => {
    localiseManifest(manifest);
    expect(manifest.description).toBe('A local AI model.');
  });
});
