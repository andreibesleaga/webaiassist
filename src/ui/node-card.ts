// SPDX-License-Identifier: Apache-2.0
// The node card (heading from the node's own link set, "Start your own node") and the two
// first-run help screens ("This site has no tools", "Chrome needs the WebMCP switch"). Every
// text is our own wording; the only value from the node is its spec version, set as text.
// Nothing here fetches or opens an address: the command and the switch address are shown as
// text to copy, and the one link goes to the constant below.
import { visible } from '../core/tool-card';
import { byId, element } from './dom';
import { t } from './i18n';

/** The demo page. Changes to the GitHub Pages demo at release. */
export const DEMO_ADDRESS = 'https://agenticsystemcore.com/';

/** From the README of agentic-system-core 1.1.0 ("On a folder of your own Markdown notes"). */
export const START_NODE_COMMAND = [
  'npm install agentic-system-core',
  'export PATH="$PWD/node_modules/.bin:$PATH"',
  'cd my-notes && agsc init',
].join('\n');

/** Chrome does not let an extension open chrome:// addresses, so it is shown as text to copy. */
export const FLAG_ADDRESS = 'chrome://flags/#enable-webmcp-testing';

export type CopyText = (text: string, done: string) => void;
export type HelpKind = 'no-tools' | 'flag';

/** Which help screen a page needs: a browser without WebMCP, or a page that registers no tools. */
export function helpKindFor(info: {
  readonly tools: readonly unknown[];
  readonly webmcp?: boolean;
}): HelpKind | undefined {
  if (info.webmcp === false) return 'flag';
  return info.tools.length === 0 ? 'no-tools' : undefined;
}

function copyButton(doc: Document, id: string, label: string, onClick: () => void) {
  const button = element(doc, 'button', label);
  button.type = 'button';
  button.id = id;
  button.addEventListener('click', onClick);
  return button;
}

function demoLink(doc: Document, label: string): HTMLAnchorElement {
  const link = element(doc, 'a', label);
  link.href = DEMO_ADDRESS;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function startNode(doc: Document, copy: CopyText): HTMLDetailsElement {
  const details = element(doc, 'details');
  const command = element(doc, 'pre', START_NODE_COMMAND, 'diag');
  command.id = 'start-node-command';
  details.append(
    element(doc, 'summary', t('startNodeSummary')),
    element(doc, 'p', t('startNodeIntro'), 'hint'),
    command,
    copyButton(doc, 'start-node-copy', t('startNodeCopy'), () =>
      copy(START_NODE_COMMAND, t('startNodeCopied')),
    ),
    element(doc, 'p', undefined, 'hint'),
  );
  details.lastElementChild?.append(demoLink(doc, t('startNodeMore')));
  return details;
}

/** The card of an AgenticSystemCore node; hidden on any other page. */
export function renderNodeCard(
  doc: Document,
  node: { readonly specVersion?: string } | undefined,
  copy: CopyText,
): void {
  const card = byId(doc, 'node-card');
  card.hidden = node === undefined;
  if (node === undefined) return card.replaceChildren();
  const title =
    node.specVersion === undefined
      ? t('nodeCardHeadingNoVersion')
      : t('nodeCardHeading', { version: visible(node.specVersion) });
  const heading = element(doc, 'h3', title);
  heading.id = 'node-card-title';
  card.replaceChildren(heading, startNode(doc, copy));
}

function noToolsScreen(doc: Document): Node[] {
  const link = element(doc, 'p');
  link.append(demoLink(doc, t('helpNoToolsDemo')));
  return [element(doc, 'p', t('helpNoToolsWhat')), element(doc, 'p', t('helpNoToolsStill')), link];
}

function flagScreen(doc: Document, copy: CopyText): Node[] {
  const address = element(doc, 'code', FLAG_ADDRESS);
  address.id = 'flag-address';
  const steps = element(doc, 'ol');
  for (const key of ['helpFlagStep1', 'helpFlagStep2', 'helpFlagStep3'] as const) {
    steps.append(element(doc, 'li', t(key)));
  }
  return [
    element(doc, 'p', t('helpFlagWhat')),
    element(doc, 'p', t('helpFlagAddress'), 'hint'),
    address,
    copyButton(doc, 'flag-copy', t('helpFlagCopy'), () => copy(FLAG_ADDRESS, t('helpFlagCopied'))),
    steps,
  ];
}

/** Shows one help screen in the chat area, or none (undefined). */
export function renderHelp(doc: Document, kind: HelpKind | undefined, copy: CopyText): void {
  const screen = byId(doc, 'help-screen');
  screen.hidden = kind === undefined;
  if (kind === undefined) return screen.replaceChildren();
  const heading = element(doc, 'h3', t(kind === 'flag' ? 'helpFlagTitle' : 'helpNoToolsTitle'));
  heading.id = 'help-screen-title';
  screen.setAttribute('aria-labelledby', 'help-screen-title');
  screen.replaceChildren(
    heading,
    ...(kind === 'flag' ? flagScreen(doc, copy) : noToolsScreen(doc)),
  );
}
