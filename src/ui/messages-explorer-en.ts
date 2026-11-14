// SPDX-License-Identifier: Apache-2.0
// The texts of the "Graph: N items" chip and of the explorer tab (explorer.html). Part of the
// English dictionary (messages-en.ts). The explorer's own controls are the site's code and
// speak English only; every text WebAIAssist adds around it is here.

export const EXPLORER_EN = {
  graphChip: 'Graph: {count} items',
  graphChipOne: 'Graph: 1 item',
  graphChipTitle:
    'Open this node’s knowledge graph in a new tab. The count is from the node’s link set ({parts}); WebAIAssist has not checked it.',
  explorerPageTitle: 'WebAIAssist graph explorer',
  explorerHeading: 'Graph of {host}',
  explorerSkip: 'Skip to the list of nodes',
  explorerTabs: 'Explorer sections',
  explorerTabGraph: 'Graph',
  explorerNeedsLink:
    'This page opens from the Graph button in the WebAIAssist panel. Open a page of the node, allow WebAIAssist on it, and press the Graph button.',
  explorerNotANode:
    'This site does not publish a knowledge link set that WebAIAssist could read, so there is no graph to show.',
  explorerNotStandard:
    'This node does not publish its graph at the standard place, so WebAIAssist shows nothing. It reads only /graph.jsonld.',
  explorerNote:
    'Drawn in your browser from the files this node publishes. WebAIAssist has not checked what they say.',
  peersHeading: 'Other nodes',
  peersIntro:
    'This node names {count} other nodes. Reading a node sends a plain request for up to three published files to its address. That node sees your IP address and that a browser asked. Nothing is read until you tick a node and press the button.',
  peersRead: 'Read the ticked nodes',
  peersListLabel: 'Nodes named by this node',
  peersWhyInvalid: 'not an address',
  peersWhyNotHttps: 'not https',
  peersWhyUserInfo: 'has a user name',
  peersWhyPort: 'not the usual port',
  peersWhyIp: 'an IP address',
  peersWhyLocal: 'a local name',
  peersWhyNoDot: 'not a public name',
} as const;
