// SPDX-License-Identifier: Apache-2.0
// Texts of the node's own list of digests, the node dashboard, the page's link rows, the
// sustainability file, the robots.txt signals, the starter prompts and the peer chips.
// Part of the English dictionary (messages-en.ts).

export const P2_EN = {
  chipDigestMatch: "matches the node's own list",
  chipDigestTitle:
    'The files read from this node match the digests in its own knowledge links (bundle {version}, generated {date}). Both come from the node itself, so this shows the files are unchanged since the node published its list, not who wrote them.',
  chipSustainability: 'sustainability data',
  chipPeer: 'peer: {host}',
  chipPeerTitle:
    'Another site this node names as its peer. Shown only: WebAIAssist does not open or read it.',
  factDigestMismatch: "{file} does not match the node's own list; it is not given to the model.",
  factBundle: 'Bundle {parts}',
  factItems: 'Items: {counts}',
  factLedger: 'Ledger head: {head}',
  factPageLinks: 'Links the page declares: {rows}',
  factPageMore: 'Page data: {parts}',
  factPageDistributions: '{count} distributions',
  factPageLicence: 'licence {licence}',
  factPageCreator: 'by {creator}',
  factSustain: 'Sustainability data: {values}',
  factSustainSigned: 'signature present, not checked',
  factSignal: 'robots.txt, {agents}: {values}',
  factSignalMore: 'robots.txt: {count} more groups not shown',
  pageNoWebmcp:
    '{host} — this browser has no WebMCP (turn on chrome://flags/#enable-webmcp-testing and relaunch Chrome; or use Read this page or Add WebMCP to this site)',
  pageNoToolsRegistered:
    '{host} — no WebMCP tools: this page registers none (use Read this page or Add WebMCP to this site)',
  diagnostics: 'Copy diagnostics',
  diagnosticsCopy: 'Copy this text',
  diagnosticsHost: 'Include the host of the open site',
  diagnosticsPreview: 'Exactly what will be copied',
  diagnosticsHelp:
    'Shows what would be copied before anything is: versions, the model, the graphics adapter and the last error. No page text, no keys, nothing is sent anywhere.',
  diagnosticsCopied: 'Diagnostics copied. Nothing was sent anywhere.',
  diagnosticsFailed: 'Could not copy: {why}',
  diagBrowserUnknown: 'unknown',
  diagWhereGpu: 'in this browser, on the graphics card',
  diagWhereCpu: 'in this browser, on the processor and memory',
  diagWhereChrome: "in Chrome (Chrome's built-in model)",
  diagWhereEndpoint: 'on a chat endpoint (its address is not copied)',
  diagWebmcpPresent: 'present, {count} tools',
  diagWebmcpNoBrowser: 'not in this browser',
  diagWebmcpNoPage: 'no page',
  diagWebmcpUnknown: 'unknown',
  diagWebmcpNotHere: 'not checked here (open the panel on a page)',
  storeTotal: 'Total on this computer: {size} MB',
  startersLabel: 'Questions to start with',
  starterBrief: 'Give me a brief of the main items on this node.',
  starterSearch: 'Search this node for how to publish a node.',
} as const;
