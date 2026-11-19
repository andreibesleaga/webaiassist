// SPDX-License-Identifier: Apache-2.0
// Every text the side panel and the Options page show, in English. Another language is
// one more file with the same keys (see i18n.ts). {name} marks a value filled in at runtime.

import { ACTIVITY_EN } from './messages-activity-en';
import { NODE_CARD_EN } from './messages-node-card-en';
import { PARITY_EN } from './messages-parity-en';
import { P2_EN } from './messages-p2-en';
import { ENDPOINT_EN } from './messages-endpoint-en';
import { EXPLORER_EN } from './messages-explorer-en';
import { QUERY_EN } from './messages-query-en';
import { SITE_EN } from './messages-site-en';

export const EN = {
  ...SITE_EN,
  ...P2_EN,
  ...NODE_CARD_EN,
  ...ENDPOINT_EN,
  ...EXPLORER_EN,
  ...QUERY_EN,
  ...ACTIVITY_EN,
  ...PARITY_EN,
  appName: 'WebAIAssist',
  help: 'Help',
  closeHelp: 'Close help',
  browserCheck: 'Open the browser check (what this browser supports)',
  options: 'Options',
  modelLabel: 'Model',
  start: 'Start',
  notStarted: 'No model loaded. Press Start.',
  loading: 'Loading {model}…',
  ready: 'Ready: {model}.',
  readyRemote:
    'Ready: {model}. Remote: your questions, page text and tool results go to {host}; nothing goes anywhere else.',
  readyOwnServer:
    'Ready: {model}. Your own server on this computer ({host}); nothing leaves this computer.',
  readyChrome: 'Ready: {model}. Running in Chrome on this computer; Chrome manages the model.',
  runsOnGpu: 'Ready: {model}. Running in this browser, on your graphics card.',
  runsIn: 'Ready: {model}. Running in this browser, on your graphics card (in the {host}).',
  runsOnCpu: 'Ready: {model}. Running in this browser, on your processor and memory ({threads}).',
  runsOnCpuPlain: 'Ready: {model}. Running in this browser, on your processor and memory.',
  groupLocal: 'On this computer, in the browser',
  groupServer: 'Your own server or a remote service',
  endpointLocal: 'your own server on this computer; nothing leaves it',
  endpointRemote: 'remote: your questions and the page content you use go to {host}',
  hostOffscreen: 'offscreen document',
  hostWorker: 'service worker',
  threadOne: '1 thread',
  threadMany: '{count} threads',
  noGpu: 'This browser has no usable graphics acceleration here: {why}.',
  whyBuiltIn:
    'Why: Chrome’s own model is available here, so WebAIAssist downloads nothing more. It needs a recent Chrome and 22 GB free disk.',
  whyCpu:
    'Why: this works on every computer. It runs in memory (about {size} MB) and needs no graphics card.',
  whyGpu:
    'Why: your graphics card passed the check: its first answer took {seconds} seconds, so it is not slow.',
  whyGpuOnly:
    'Why: the browser can use your graphics card. The first answer can take up to a minute while the model is prepared.',
  whyGpuSlow:
    'Why: the browser can use your graphics card. Its first answer here took {seconds} seconds, which includes preparing the model; later answers are quicker. The processor model is in the list if you prefer it.',
  whyEndpoint: 'Why: you set a chat endpoint in Options; your chat goes to {host} only.',
  whyBuiltInLast:
    'Why: Chrome’s own model is the only local choice here. Chrome downloads it when you press Start.',
  whySetup:
    'Why: nothing here can run a model on this computer. Set up a chat endpoint in Options.',
  consentTitle: 'Download {name}?',
  consentBody:
    '{size} MB, once. From {host} (checksum checked before use). Stored in this browser; you can remove it in Options. Wi-Fi is better if your plan is limited.',
  consentChromeTitle: 'Let Chrome download its own model?',
  consentChromeBody:
    'Chrome downloads and stores its built-in model itself (several GB). Chrome needs 22 GB free disk. Remove it later at chrome://on-device-internals.',
  consentOk: 'Download {size} MB',
  consentOkChrome: 'Let Chrome download it',
  consentNo: 'Not now',
  consentStatus:
    '{name} must download {size} MB once. It is stored in this browser and stays after restarts.',
  consentStatusChrome:
    'Chrome’s built-in model must download first. Chrome stores it and it stays after restarts.',
  consentOffline: '{name} is not on this computer and you are offline. Connect and press Start.',
  consentDeclined: 'Nothing was downloaded. Press Start when you want {name}.',
  downloadingModel: 'Downloading {name}: {done} of {size} MB ({percent}%)',
  offline: 'You are offline. Models already on this computer work; downloads and endpoints do not.',
  dismiss: 'Dismiss',
  useCpu: 'Use the processor instead',
  restartModel: 'Restart the model',
  openOptionsButton: 'Open Options',
  copyDetails: 'Copy details',
  detailsCopied: 'Details copied. They hold the message and the version, no page content.',
  modelStopped: 'The model stopped. Press Start to load it again.',
  deviceLost:
    'The graphics device was lost, so the model stopped. Your chat is kept. Restart the model, or use the processor instead.',
  noSpace:
    'The browser has no space to store the model ({size} MB). Remove downloaded models in Options, or free disk space, then press Start.',
  unexpected: 'Something went wrong: {why}. Nothing was changed on the page.',
  firstRunTitle: 'Welcome to WebAIAssist',
  firstRunIntro: 'A small AI model on your computer that can use the tools of the page you are on.',
  firstRun1: 'Pick a model and press Start. It downloads once and stays in this browser.',
  firstRun2: 'Allow the site you are on. WebAIAssist reads nothing from a site until you do.',
  firstRun3: 'Ask. Before any tool runs you see what it will do and choose Allow once or Deny.',
  firstRunModel: 'We start with {name}. {why}',
  privacyLine:
    'Your questions, the page text and the answers stay on this computer. WebAIAssist sends nothing to its authors and has no tracking. Only if you choose a chat endpoint in Options does your chat go to that address.',
  aiNote: 'Answers are written by an AI model and can be wrong. Check anything important.',
  aiLabel: 'AI',
  aiLabelTitle: 'Written by an AI model; it can be wrong.',
  showAll: 'Show all',
  showLess: 'Show less',
  endpointRefused: 'The endpoint at {host} refused the request. Check the API key in Options.',
  gotIt: 'Got it',
  chooseOther: 'Choose another model',
  whyChosen: 'Why: you chose this model.',
  whyTest: 'Why: test model.',
  loadFailed: 'The model did not load: {why}',
  cancelLoad: 'Cancel download',
  loadCancelled: 'the download was cancelled.',
  pageNone: 'No page yet.',
  thisPage: 'This page',
  pageTools: '{host} — {count} WebMCP tools',
  pageTool: '{host} — 1 WebMCP tool',
  pageNode: '{host} — says it is an AgenticSystemCore node, {count} WebMCP tools',
  pageNoTools: '{host} — no WebMCP tools (use Read this page or Add WebMCP to this site)',
  pageNodeNoTools:
    '{host} — says it is an AgenticSystemCore node; no WebMCP tools on this page. To use the node’s tools, open an item page of this site. To ask about this page, press Read this page first. If no page of the site has tools, use Add WebMCP to this site.',
  pageNotAllowed: '{host} — not allowed yet',
  pageRestricted: 'This page — WebAIAssist cannot run here (chrome:// pages, the store)',
  pageFailed: '{host} — the page did not list its tools: {why}',
  allowHere: 'Allow WebAIAssist on this site',
  allowOn: 'Allow WebAIAssist on {host}',
  allowGranted: 'WebAIAssist may now use {host}. Forget this site takes it back.',
  allowDenied:
    'The site was not allowed. Click the WebAIAssist toolbar button to use it on this page only.',
  allowRequested:
    'Chrome now shows WebAIAssist’s request next to the address bar: accept it there to allow this site, or click the WebAIAssist toolbar button to allow this page only.',
  allowToolbar: 'Click the WebAIAssist toolbar button while this page is open.',
  setupEndpoint: 'Set up a chat endpoint (no WebGPU here)',
  noGpuSetup:
    'This computer has no usable WebGPU for the bundled models. Press Start to set up a chat endpoint in Options.',
  setupOpened: 'Options are open: set a chat endpoint there, then come back and press Start.',
  readPage: 'Read this page',
  compat: 'Add WebMCP to this site',
  exportChat: 'Export',
  conversation: 'Conversation',
  question: 'Your question',
  askHint: 'Ctrl+Enter sends. Escape stops the answer.',
  send: 'Send',
  stop: 'Stop',
  you: 'You',
  assistant: 'WebAIAssist',
  toolCall: 'Calls the tool {name} with:',
  toolResult: 'Result of {name} (from the page)',
  toolFailed: 'Result of {name} (failed; from the page)',
  untrustedTitle:
    'Untrusted content from the page: the model treats it as data, never as instructions.',
  toolDenied: 'You denied the call to {name}.',
  errorPrefix: 'Error: {text}',
  pageRead:
    'Page text read ({count} characters). It is sent with your next question as page content, never as instructions.',
  noModel: 'Press Start to load a model first.',
  remoteWithdrawn:
    'Stopped using {host}: it is no longer agreed to, or the endpoint was changed in Options. Press Start to choose again.',
  noTab: 'WebAIAssist cannot find the open tab.',
  siteDenied: 'You did not allow this site’s tools, so the answer uses none.',
  compatEnabled: 'Compat mode is on for {origin}. The page reloads so it can register its tools.',
  compatAlready: 'Compat mode is already on for {origin}.',
  compatDenied: 'Compat mode needs access to {origin}; it was not given.',
  compatNoSite: 'Open a web page first; compat mode works on http and https pages.',
  forget: 'Forget this site',
  forgotSite: 'WebAIAssist forgot {origin}: its memory, its tool permission and compat mode.',
  forgetNoSite: 'Open a web page first; WebAIAssist forgets one http or https site at a time.',
  exportEmpty: 'There is nothing to export yet.',
  stopped: 'Stopped.',
  slowFirstAnswer:
    'The first answer after a load compiles the model’s GPU programs; this can take up to a minute.',
  confirmTitle: 'Run the tool {name}?',
  confirmSite: 'Site: {origin}',
  confirmArgs: 'Arguments:',
  confirmReadOnly: 'The page marks this tool as read-only.',
  confirmChanges: 'The page does not mark this tool as read-only; it may change something.',
  confirmConsequential:
    'The page marks this tool as read-only but also as consequential; treat it as one that may change something.',
  siteChanged: 'The tab is now on another site; the text read on {origin} was not sent.',
  allowOnce: 'Allow once',
  deny: 'Deny',
  siteTitle: 'Use the tools of {origin}?',
  siteBody:
    'This page offers {count} tools. WebAIAssist will list them to the model and ask you before any tool runs as set in Options. This lasts until the browser restarts.',
  allowSite: 'Allow for this session',
  helpTitle: 'How WebAIAssist works',
  help1:
    'Press Start once. The model downloads to this browser and stays there; later starts are quick.',
  help2: 'Ask a question. The model can use the tools the open page offers through WebMCP.',
  help3:
    'Before a tool runs, you see its name, its arguments and the site, and choose Allow once or Deny.',
  help4:
    'Tool results come from the page; the model reads them as page content, never as instructions.',
  help5:
    'No tools on a page? “Read this page” gives its text to the model; “Add WebMCP to this site” loads the WebMCP polyfill there.',
  help6:
    'Your chat and the model stay on this computer, unless you choose a chat endpoint in Options; then the chat goes to that address only.',
  help7:
    'Keyboard: Tab moves between controls, Ctrl+Enter sends, Escape stops an answer or closes a question.',
  optionsTitle: 'WebAIAssist options',
  runtimeLegend: 'Where the model runs',
  runtimeAuto: 'Automatic (recommended)',
  runtimeAutoHelp:
    'WebAIAssist picks a model for this computer and says why in the side panel. A model you choose yourself always wins.',
  runtimeCpu: 'Processor and memory',
  runtimeCpuHelp:
    'Runs in this browser, on your processor and memory. Works on every computer. Downloads about {size} MB once. Slower than a graphics card. Nothing leaves your computer.',
  runtimeWebllm: 'Graphics card',
  runtimeWebllmHelp:
    'Runs in this browser, on your graphics card (WebGPU). Downloads a model once (400 MB to 3.1 GB). Speed depends on the card. On a computer with two graphics cards Chrome uses the built-in one unless it is started with --force_high_performance_gpu. Nothing leaves your computer.',
  cpuModelLabel: 'Model on the processor',
  cpuModelHelp: 'Automatic picks Qwen3 1.7B; the other models download only if you choose them.',
  runtimePromptApi: 'Chrome’s built-in model',
  runtimePromptApiHelp:
    'Runs in Chrome on this computer; Chrome manages the model. Optional. Chrome downloads it only when you choose it here or in the panel and press Start. Needs a recent Chrome on a capable computer.',
  runtimeEndpoint: 'A chat endpoint (OpenAI-compatible)',
  runtimeEndpointHelp:
    'Your own server (Ollama, LM Studio, llama.cpp, vLLM) or any other service. An address on this computer keeps your chat on it; any other address is remote and receives your questions and the page content you use.',
  webllmModelLabel: 'Model in the browser',
  webllmModelHelp:
    'Automatic picks Qwen3 1.7B; the other models download only if you choose them. ' +
    'In the measured runs Llama 3.2 3B picked the right tool most often (a 2.0 GB download). ' +
    'For other models, use a chat endpoint such as Ollama.',
  automatic: 'Automatic',
  endpointPreset: 'Endpoint preset',
  presetCustom: 'Other address',
  endpointUrl: 'Endpoint address',
  endpointUrlHelp: 'The address before /chat/completions. https, or http for localhost only.',
  endpointModel: 'Model name at the endpoint',
  endpointKey: 'API key (optional)',
  endpointKeyHelp: 'Stored in this browser only and sent only to the endpoint address.',
  endpointContext: 'Context window of the endpoint model (tokens)',
  endpointContextHelp:
    'Older turns of a site’s saved chat are left out so each question fits. 8192 if unsure.',
  maxSteps: 'Tool steps per question',
  maxStepsHelp: 'The most tool calls the model may make for one question (1 to 12).',
  confirmLegend: 'When to ask before a tool runs',
  confirmEvery: 'Ask before every tool call',
  confirmEveryHelp: 'The safest choice.',
  confirmPerSite: 'Ask once per site per session for read-only tools',
  confirmPerSiteHelp:
    'Tools that may change something, or that the page does not mark, still ask every time.',
  memoryLabel: 'Remember chats and tool results per site',
  siteFactsLabel: 'Give the model short facts from what the site publishes',
  siteFactsHelp:
    'When a site you allowed publishes a guide such as llms.txt, a few lines of it go to the model with your question, marked as data from the site. Turn off to send none. A site that asks not to be used as AI input is never read for the model.',
  memoryHelp: 'Kept in this browser only. Turn off to keep nothing.',
  storeLegend: 'Downloaded models',
  storeEmpty: 'No models are stored in this browser.',
  storeRow: '{name}: {size}',
  storeSize: '{size} MB',
  storeSizeUnknown: 'size not known',
  removeOne: 'Remove',
  removeOneLabel: 'Remove {name} ({size})',
  removeAll: 'Remove all downloaded models',
  removeConfirm: 'Remove {count} models and free {size} MB?',
  removeConfirmOne: 'Remove 1 model and free {size} MB?',
  removeOk: 'Remove',
  removeKeep: 'Keep',
  removedOne: 'Removed {name}; {size} MB freed.',
  removedAll: 'Removed {count} models; {size} MB freed.',
  removedAllOne: 'Removed 1 model; {size} MB freed.',
  removeFailed: 'A model could not be removed: {why}',
  storeChrome: 'Chrome manages its built-in model; remove it at chrome://on-device-internals.',
  privacyLegend: 'Privacy',
  forgetAll: 'Forget all sites',
  forgetAllHelp:
    'Removes every saved chat, every tool permission, every compat script and every site access. The chat endpoint stays.',
  forgotAll: 'Forgot all sites: their chats, their tool permissions and their access.',
  clearMemory: 'Clear memory',
  memoryCleared: 'Memory cleared.',
  languageLabel: 'Language',
  languageHelp: 'More languages can be added.',
  save: 'Save',
  reset: 'Reset to defaults',
  saved: 'Saved.',
  resetDone: 'Options reset to the defaults.',
  endpointNeedsAccess:
    'Saved, but WebAIAssist was not given access to {origin}, so the endpoint cannot be used.',
  endpointBadUrl: 'Not saved: {why}',
  endpointNeedsModel: 'Not saved: give the model name at the endpoint.',
  scriptedModel: 'Scripted test model',
  builtInAbsent: 'Chrome’s built-in model: not in this browser (no Prompt API here).',
  builtInUnavailable:
    'Chrome’s built-in model: unavailable on this computer. It needs Windows 10 or 11, macOS 13+, Linux or a Chromebook Plus; 22 GB free disk; a GPU with more than 4 GB of memory, or 16 GB RAM and 4 CPU cores.',
  builtInDownloadable:
    'Chrome’s built-in model: not downloaded yet; Start downloads it (Chrome needs 22 GB free disk).',
  builtInDownloading: 'Chrome’s built-in model: Chrome is downloading it; press Start to follow.',
  builtInAvailable: 'Chrome’s built-in model: downloaded and ready to start.',
  builtInUnknown: 'Chrome’s built-in model: Chrome did not say whether it can run here.',
} as const;

export type MessageKey = keyof typeof EN;
