// SPDX-License-Identifier: Apache-2.0
// True for a message or port from one of this extension's own pages (side panel, Options,
// offscreen document, the spike page in a tab), false for content scripts in web pages.

export function fromExtensionPage(sender: chrome.runtime.MessageSender | undefined): boolean {
  if (sender?.id !== chrome.runtime.id) return false;
  return sender.url?.startsWith(chrome.runtime.getURL('')) === true;
}
