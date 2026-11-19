// SPDX-License-Identifier: Apache-2.0
// Chrome's locale file, written by the build from the typed dictionary (src/ui/messages-en.ts).
// The dictionary stays the one source of the interface texts: its keys are type-checked and the
// panel reads it directly (src/ui/i18n.ts). _locales/en/messages.json is the same texts in the
// format Chrome and translators expect, plus the three manifest texts Chrome itself shows (the
// description, the title of the toolbar button and the name of its keyboard shortcut). {name} placeholders are WebAIAssist's own
// and are left as they are. Another language is one more dictionary and one more folder.

/** Chrome accepts letters, digits, "_" and "@" in a message name; "@@" names are its own. */
const NAME = /^[A-Za-z0-9_@]+$/;
const STORE_DESCRIPTION_MAX = 132;

function checkNames(names) {
  const seen = new Map();
  for (const name of names) {
    if (!NAME.test(name) || name.startsWith('@@')) {
      throw new Error(`locale: "${name}" is not a message name Chrome accepts`);
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      throw new Error(`locale: "${seen.get(lower)}" and "${name}" differ only in case`);
    }
    seen.set(lower, name);
  }
}

/** Chrome reads a single dollar sign as the start of a placeholder; two stand for one. */
const escapeDollar = (text) => text.split('$').join('$'.repeat(2));

/** The content of _locales/<language>/messages.json: the manifest texts, then the dictionary. */
export function chromeMessages(dictionary, manifestTexts) {
  if (manifestTexts.extDescription.length > STORE_DESCRIPTION_MAX) {
    throw new Error(`locale: the description must be at most ${STORE_DESCRIPTION_MAX} characters`);
  }
  const all = { ...manifestTexts, ...dictionary };
  checkNames(Object.keys(all));
  return Object.fromEntries(
    Object.entries(all).map(([name, text]) => [name, { message: escapeDollar(text) }]),
  );
}

/** A copy of the manifest whose description, button title and shortcut name come from the locale file, and those texts. */
export function localiseManifest(manifest) {
  const command = manifest.commands?._execute_action;
  const texts = {
    extDescription: manifest.description,
    extActionTitle: manifest.action.default_title,
    ...(command?.description ? { extCommandTitle: command.description } : {}),
  };
  const localised = {
    ...manifest,
    default_locale: 'en',
    description: '__MSG_extDescription__',
    action: { ...manifest.action, default_title: '__MSG_extActionTitle__' },
    ...(command?.description
      ? {
          commands: {
            ...manifest.commands,
            _execute_action: { ...command, description: '__MSG_extCommandTitle__' },
          },
        }
      : {}),
  };
  return { manifest: localised, texts };
}
