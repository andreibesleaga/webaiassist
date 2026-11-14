// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  accessProblem,
  accessText,
  NOT_ALLOWED_TEXT,
  RESTRICTED_TEXT,
} from '../../src/adapters/page-access';

describe('accessProblem', () => {
  it('names the pages no extension may script', () => {
    for (const message of [
      'Cannot access a chrome:// URL',
      'Cannot access a chrome-extension:// URL of different extension',
      'The extensions gallery cannot be scripted.',
      'Frame with ID 0 is showing error page',
      'Cannot access a devtools:// URL',
    ]) {
      expect(accessProblem(new Error(message))).toBe('restricted');
    }
  });

  it('treats every other refusal as a site the user has not allowed yet', () => {
    const message =
      'Cannot access contents of the page. Extension manifest must request permission to access the respective host.';
    expect(accessProblem(new Error(message))).toBe('denied');
    expect(accessProblem('odd value')).toBe('denied');
  });

  it('says what to do in each case', () => {
    expect(accessText('denied')).toBe(NOT_ALLOWED_TEXT);
    expect(accessText('restricted')).toBe(RESTRICTED_TEXT);
    expect(NOT_ALLOWED_TEXT).toMatch(/Allow/);
    expect(NOT_ALLOWED_TEXT).toMatch(/toolbar button/);
    expect(RESTRICTED_TEXT).toMatch(/chrome:\/\//);
  });
});
