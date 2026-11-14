// SPDX-License-Identifier: Apache-2.0
// "Read this page": for a site without WebMCP tools, the panel can give the model the
// page's visible text as untrusted context. The text is read only when the user clicks,
// with chrome.scripting (activeTab or a site the user allowed), and is capped.
import { accessProblem, accessText } from './page-access';

export interface ScriptingLike {
  executeScript(injection: {
    target: { tabId: number };
    func: () => unknown;
  }): Promise<{ result?: unknown }[]>;
}

export interface PageText {
  readonly origin: string;
  readonly title: string;
  readonly text: string;
}

export const PAGE_TEXT_CAP = 20000;

/** Runs in the tab, so it must use nothing but browser globals. The text is cut there
 *  (20000 is PAGE_TEXT_CAP; a constant from outside would not reach the tab). */
export function pageSnapshot(): unknown {
  return {
    origin: location.origin,
    title: document.title.slice(0, 1000),
    text: (document.body?.innerText ?? '').slice(0, 20000),
  };
}

function isPageText(value: unknown): value is PageText {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Record<string, unknown>;
  return (
    typeof page.origin === 'string' &&
    typeof page.title === 'string' &&
    typeof page.text === 'string'
  );
}

export async function readPageText(scripting: ScriptingLike, tabId: number): Promise<PageText> {
  let results: { result?: unknown }[];
  try {
    results = await scripting.executeScript({ target: { tabId }, func: pageSnapshot });
  } catch (error) {
    throw new Error(accessText(accessProblem(error)));
  }
  const page = results[0]?.result;
  if (!isPageText(page)) throw new Error('WebAIAssist could not read the text of this page.');
  return { origin: page.origin, title: page.title, text: page.text.slice(0, PAGE_TEXT_CAP) };
}
