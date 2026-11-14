// SPDX-License-Identifier: Apache-2.0
// The texts of the chat endpoint, local or remote: the model-list entry that leads to its
// set-up, the one-time question before a remote service is first used, and the Options hints.
// Part of the English dictionary (messages-en.ts).

export const ENDPOINT_EN = {
  setupEndpointOwn: 'Use your own server or a remote service…',
  whySetupOwn:
    'Why: this entry opens Options, where you set a server on this computer or a remote service. Nothing is sent anywhere before you do.',
  remoteTitle: 'Use {host} for your questions?',
  remoteBody:
    'The model does not run on this computer; it runs at {host}. Your questions, the page’s tool list, tool results and any page text you read are sent to {host}, and the service may charge for it. Nothing is sent before you press Use this service. You are asked again for any other address.',
  remoteOk: 'Use this service',
  remoteStatus: 'Nothing is sent to {host} until you answer.',
  endpointModelHelp:
    'The name the service uses: for example qwen3:0.6b on Ollama, or vendor/model on OpenRouter. A remote service may charge for each question.',
} as const;
