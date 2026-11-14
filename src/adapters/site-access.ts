// SPDX-License-Identifier: Apache-2.0
// "Allow WebAIAssist on this site", from the side panel's Allow button. The panel knows a
// tab's site only when it may already read the tab, so there are two routes:
// - site known: chrome.permissions.request for that one origin (an optional host permission
//   in the manifest). It must be the first call inside the click, to keep the user gesture.
// - site not known (the usual case before any grant): chrome.permissions.addHostAccessRequest
//   for the tab (Chrome 133+). Chrome shows the request in its toolbar, naming the site; the
//   user accepts it there, which grants that site's origin (permissions.onAdded fires).
// A browser without host-access requests is told to use the toolbar button (activeTab).
import { sitePattern } from './compat-mode';

export interface SiteAccessDeps {
  request(origins: string[]): Promise<boolean>;
  addHostAccessRequest?: (request: { tabId: number }) => Promise<void>;
}

export type AllowResult = 'granted' | 'denied' | 'requested' | 'toolbar';

export function allowSite(
  deps: SiteAccessDeps,
  page: { readonly tabId: number; readonly origin?: string },
): Promise<AllowResult> {
  if (page.origin !== undefined) {
    const pattern = sitePattern(page.origin);
    return deps.request([pattern]).then((granted) => (granted ? 'granted' : 'denied'));
  }
  if (deps.addHostAccessRequest) {
    return deps.addHostAccessRequest({ tabId: page.tabId }).then(() => 'requested');
  }
  return Promise.resolve('toolbar');
}
