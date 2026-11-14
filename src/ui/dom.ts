// SPDX-License-Identifier: Apache-2.0
// Small DOM helpers. Text always goes in through textContent, never as HTML.

export function byId<T extends HTMLElement = HTMLElement>(doc: Document, id: string): T {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`WebAIAssist: the page has no #${id}`);
  return element as T;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className !== undefined) node.className = className;
  return node;
}
