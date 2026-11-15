// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { formsByTool, sensitiveKinds } from '../../src/adapters/form-tools';

const page = (html: string): Document => {
  document.body.innerHTML = html;
  return document;
};

describe('formsByTool', () => {
  it('says whether a form tool waits for Submit (no toolautosubmit) or is submitted by the browser', () => {
    const forms = formsByTool(
      page(`<form toolname="wait" tooldescription="d"><input name="q"></form>
            <form toolname="auto" tooldescription="d" toolautosubmit><input name="q"></form>
            <form id="plain"><input name="q"></form>`),
    );
    expect(forms.get('wait')).toEqual({ autosubmit: false, sensitive: [] });
    expect(forms.get('auto')).toEqual({ autosubmit: true, sensitive: [] });
    expect([...forms.keys()]).toEqual(['wait', 'auto']);
  });

  it('uses the first form of a name', () => {
    const forms = formsByTool(
      page(`<form toolname="a" toolautosubmit></form><form toolname="a"></form>`),
    );
    expect(forms.get('a')?.autosubmit).toBe(true);
  });
});

describe('sensitiveKinds: password, payment and personal-data fields', () => {
  const kinds = (inner: string) => {
    const doc = page(`<form toolname="f">${inner}</form>`);
    const form = doc.querySelector('form');
    if (!form) throw new Error('no form');
    return sensitiveKinds(form);
  };

  it('finds a password field by type and by autocomplete', () => {
    expect(kinds('<input type="password" name="x">')).toEqual(['password']);
    expect(kinds('<input autocomplete="new-password" name="x">')).toEqual(['password']);
  });

  it('finds payment fields by autocomplete word and by name', () => {
    expect(kinds('<input autocomplete="cc-number">')).toEqual(['payment']);
    expect(kinds('<input name="card_number">')).toEqual(['payment']);
    expect(kinds('<input name="cvv">')).toEqual(['payment']);
    expect(kinds('<input id="iban">')).toEqual(['payment']);
  });

  it('finds personal data by type, autocomplete and name', () => {
    expect(kinds('<input type="email" name="x">')).toEqual(['personal']);
    expect(kinds('<input type="tel" name="x">')).toEqual(['personal']);
    expect(kinds('<input autocomplete="given-name" name="x">')).toEqual(['personal']);
    expect(kinds('<input name="ssn">')).toEqual(['personal']);
    expect(kinds('<textarea name="home_address"></textarea>')).toEqual(['personal']);
  });

  it('lists each kind once, in a fixed order, and nothing for an ordinary form', () => {
    expect(
      kinds('<input type="email"><input type="password"><input name="card"><input type="tel">'),
    ).toEqual(['password', 'payment', 'personal']);
    expect(kinds('<input name="q"><select name="size"></select>')).toEqual([]);
  });
});
