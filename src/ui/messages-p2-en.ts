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
  startersLabel: 'Questions to start with',
  starterBrief: 'Give me a brief of the main items on this node.',
  starterSearch: 'Search this node for how to publish a node.',
  starterExplain: 'Explain this rule code from the node: AGSC-06-08',
} as const;
