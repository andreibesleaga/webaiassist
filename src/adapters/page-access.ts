// SPDX-License-Identifier: Apache-2.0
// Why the page scripts could not be added to a tab, read from the browser's refusal:
// a page no extension may script (chrome:// pages, the Chrome Web Store, an error page), or
// a site the user has not allowed yet (no activeTab grant and no host permission).

export type AccessProblem = 'denied' | 'restricted';

export const NOT_ALLOWED_TEXT =
  'WebAIAssist is not allowed on this page yet. Press Allow at the top of the panel, or click ' +
  'the WebAIAssist toolbar button while the page is open.';
export const RESTRICTED_TEXT =
  'WebAIAssist cannot run on this page (chrome:// pages, the Chrome Web Store).';

/** Chrome's refusals for pages that no extension may script, whatever the user allows. */
const RESTRICTED =
  /chrome:\/\/|chrome-extension:\/\/|chrome-untrusted:\/\/|edge:\/\/|devtools:\/\/|about:|view-source:|cannot be scripted|error page/i;

export function accessProblem(error: unknown): AccessProblem {
  const message = error instanceof Error ? error.message : String(error);
  return RESTRICTED.test(message) ? 'restricted' : 'denied';
}

export function accessText(problem: AccessProblem): string {
  return problem === 'restricted' ? RESTRICTED_TEXT : NOT_ALLOWED_TEXT;
}
