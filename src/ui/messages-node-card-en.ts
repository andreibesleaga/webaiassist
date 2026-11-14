// SPDX-License-Identifier: Apache-2.0
// Texts of the node card, the first-run help screens and the developer "Copy report".
// Part of the English dictionary (messages-en.ts).

export const NODE_CARD_EN = {
  nodeCardHeading: 'AgenticSystemCore node, spec {version}',
  nodeCardHeadingNoVersion: 'AgenticSystemCore node',
  startNodeSummary: 'Start your own node',
  startNodeIntro:
    'Needs Node 22.13 or later and git. Run this in a working folder, with your notes in a folder named my-notes. It only runs on your computer.',
  startNodeCopy: 'Copy command',
  startNodeCopied: 'Command copied.',
  startNodeMore: 'More at the AgenticSystemCore site',
  starterCompose: 'Compose a harness for my task',
  starterExplain:
    'Explain why two items on this node are linked: say whether a link holds between them and why.',
  helpNoToolsTitle: 'This site has no tools',
  helpNoToolsWhat:
    'Tools are actions a site offers to an assistant, such as a search or a form. This site offers none, so the assistant cannot look anything up on it or do anything on it.',
  helpNoToolsStill:
    'You can still chat with the model. It answers from what it already knows and sees nothing from this page.',
  helpNoToolsDemo: 'Open the demo page, which offers tools',
  helpFlagTitle: 'Chrome needs the WebMCP switch',
  helpFlagWhat:
    'WebMCP is a W3C Community Group draft that lets a page offer tools to an assistant. Chrome keeps it behind a switch that is off until you turn it on.',
  helpFlagAddress: 'Switch address (Chrome does not let an extension open it):',
  helpFlagCopy: 'Copy address',
  helpFlagCopied: 'Address copied.',
  helpFlagStep1: 'Open a new tab, paste the address into the address bar and press Enter.',
  helpFlagStep2: 'Set the WebMCP switch to Enabled.',
  helpFlagStep3:
    'Restart Chrome (the Relaunch button at the bottom of that page does it), then open this page again.',
  reportButton: 'Copy report',
  reportPreview:
    'This is exactly what will be copied: tool names, titles and descriptions of the open page, and nothing else. It is informational, not a score or a certification.',
  reportCopy: 'Copy this report',
  reportCopied: 'Report copied.',
  reportNoPage: 'Open a page first: there is no page to report on.',
  reportFailed: 'Could not copy the report: {why}',
} as const;
