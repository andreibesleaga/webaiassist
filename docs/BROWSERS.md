# Browser support

WebAIAssist is a Manifest V3 extension for Chromium-based desktop browsers only. Firefox and
Safari are not supported. The extension uses `chrome.sidePanel` and an offscreen document.
Firefox and Safari use different extension APIs, and no vendor page read for this file lists
`chrome.sidePanel` for them. All pages below were read on 12 Nov 2026. Minimum version is
Chrome 126 (compat mode's polyfill uses `URL.parse`).

## What was tested

- Chrome 157 on Windows 10 (AMD gcn-5 laptop GPU), by the maintainer, 12 and 13 Nov 2026: with
  the spike page, WebGPU with `shader-f16` worked in the page, the service worker and the
  offscreen document, and `document.modelContext` was present. With the extension on
  `agenticsystemcore.com`, the graphics-card model ran, with a first answer of about 40
  seconds (the GPU programs compile on it). Chrome's built-in model did not start in the first
  hand test. It was measured on 14 Nov 2026 in Chrome 157.0.8103.52 on Windows: the download from
  the click took 300 s, later starts 3 to 14 s, a tool was used in 5 of 5 questions on the test node
  and 1 of 5 on the live node, and an answer took 15 to 42 s
  (`docs/eval/EVAL-NANO-2026-11-14-157.0.8103.52.json`, [EVAL.md](EVAL.md)).
- Headless Chromium 156 (Playwright 1.64.1, `--enable-features=WebMCPTesting`), in the automated
  smoke, scenario and accessibility tests, and in `npm run eval:cpu`, which ran the real processor
  models (llama.cpp in WebAssembly, 8 threads) on Linux under WSL: [EVAL.md](EVAL.md).
- Edge, Brave, Opera and Vivaldi: not tested.

## Which model paths a browser can offer

| Path                    | Needs                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Graphics card (WebLLM)  | WebGPU, in the offscreen document or the service worker (Chrome 126 or later).                                   |
| Processor (llama.cpp)   | WebAssembly promise integration and 64-bit memory: Chrome 137 or later.                                          |
| Chrome's built-in model | The Prompt API in the official Chrome build (Chrome 138 or later for extensions), and the hardware Chrome lists. |
| Chat endpoint           | Any Chromium browser; Ollama needs `OLLAMA_ORIGINS=chrome-extension://*`.                                        |

The panel checks the processor path's needs and hides that choice where they are missing. With no
WebGPU it shows a plain error and **Use the processor instead**.

## Chrome

- Side panel: the `chrome.sidePanel` reference lists Chrome 114 as the baseline
  (<https://developer.chrome.com/docs/extensions/reference/api/sidePanel>, read 12 Nov 2026).
- WebMCP: the Chrome page says to join the origin trial from Chrome 149. For local development
  set `chrome://flags/#enable-webmcp-testing` to Enabled and relaunch
  (<https://developer.chrome.com/docs/ai/webmcp>, read 12 Nov 2026). That page does not mention
  `document.modelContext`.
- Prompt API: documented for Chrome extensions from Chrome 138. Desktop only: Windows 10 or 11,
  macOS 13+, Linux, ChromeOS on Chromebook Plus. Needs 22 GB free disk and a GPU with more than
  4 GB VRAM or 16 GB RAM with 4 cores
  (<https://developer.chrome.com/docs/ai/prompt-api>, read 12 Nov 2026). The page does not say
  it is Chrome-only. It names no other browser.
- WebGPU: Chrome 113 on Windows, macOS and ChromeOS; Linux not yet
  (<https://developer.chrome.com/docs/web-platform/webgpu/overview>, read 12 Nov 2026).

## Edge

- Store: Edge can add Chrome Web Store extensions. A dialog may ask to allow extensions from
  other stores; click Allow, then **Add extension**
  (<https://support.microsoft.com/en-us/microsoft-edge/add-turn-off-or-remove-extensions-in-microsoft-edge-9c0ec68c-2fbc-2f2c-9ff0-bdc76f46b026>,
  read 12 Nov 2026).
- Load unpacked: open the Extensions management page, turn on **Developer mode**, click
  **Load unpacked**, select the folder with `manifest.json`
  (<https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading>,
  read 12 Nov 2026). The address `edge://extensions` was not stated on that page.
- Side panel: Microsoft lists `sidePanel` as supported on Windows, Linux and Mac, and calls it the
  sidebar. A known issue: the sidebar does not reopen when you return to a tab where it was open
  (<https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support> and
  <https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar>,
  read 12 Nov 2026).
- Offscreen: listed as supported for MV3 (api-support page).
- Built-in model: Edge has its own Prompt API as a developer preview in Canary and Dev from
  version 138.0.3309.2, behind the flag **Prompt API for on-device language model**. It uses
  Phi-4-mini, and Aion-1.0-Instruct from 150.0.4070 behind another flag
  (<https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api>, read 12 Nov 2026).
  It is not in stable Edge per that page. Whether WebAIAssist's Prompt API runtime works there is
  untested.
- WebMCP: no Microsoft page found. The WebMCP specification repository lists an Edge origin
  trial from Edge 150 ([SOURCES.md](SOURCES.md), section 1).
- WebGPU: not mentioned on the Chrome WebGPU page; no Edge page read. Not documented.

## Brave

- Store, load unpacked, side panel, WebGPU, WebMCP, built-in model: not documented. Brave's help
  article on extensions returned HTTP 403 and could not be read. Brave is Chromium-based, but
  that was not confirmed from a Brave page.

## Opera

- Load unpacked: Opera's developer page says to open `opera:extensions`, enable Developer Mode and
  choose "Load Unpacked Extension" (<https://help.opera.com/en/extensions/basics/>, read 12 Nov 2026).
- Opera's help says it is based on Chromium and that Chrome extensions may work
  (<https://help.opera.com/en/extensions/>, read 12 Nov 2026).
- The "Install Chrome Extensions" add-on: the Opera pages read do not mention it, and its add-on
  page returned HTTP 404. Not verified.
- Side panel, WebGPU, WebMCP, built-in model: not documented.

## Vivaldi

- Store: click **Add to Vivaldi** on the Chrome Web Store page. If the button is missing, enable
  the Web Store option under Settings > Privacy and Security > Google Extensions.
- Load unpacked: open `vivaldi://extensions` (or Ctrl+Shift+E), turn on Developer mode, choose
  Load unpacked (<https://help.vivaldi.com/desktop/customizing-vivaldi/extensions/>, read 12 Nov 2026).
- Side panel, WebGPU, WebMCP, built-in model: not documented.

## Summary table

"Not documented" means no vendor page was found today. It does not mean unsupported.

| Browser | Install from store      | Load unpacked                 | Side panel     | WebGPU                             | WebMCP                                      | Built-in model                      | Tested by us                                                                                                                  |
| ------- | ----------------------- | ----------------------------- | -------------- | ---------------------------------- | ------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chrome  | Yes (home store)        | `chrome://extensions`         | Yes, from 114  | Yes, from 113 (not Linux per page) | Origin trial from 149; flag for development | Prompt API, extensions from 138     | Chrome 157 (maintainer, Windows 10: spike page; built-in model measured 14 Nov 2026); headless Chromium 156 (automated tests) |
| Edge    | Yes, allow other stores | Developer mode, Load unpacked | Yes (sidebar)  | Not documented                     | Not documented                              | Prompt API preview, Canary/Dev only | Not tested                                                                                                                    |
| Brave   | Not documented          | Not documented                | Not documented | Not documented                     | Not documented                              | Not documented                      | Not tested                                                                                                                    |
| Opera   | Add-on not verified     | `opera:extensions`            | Not documented | Not documented                     | Not documented                              | Not documented                      | Not tested                                                                                                                    |
| Vivaldi | Yes, Add to Vivaldi     | `vivaldi://extensions`        | Not documented | Not documented                     | Not documented                              | Not documented                      | Not tested                                                                                                                    |

## WebMCP conformance

`conformance/` tests the WebMCP interface of a browser; `npm run eval:conformance` runs it in
Google Chrome (see [EVAL.md](EVAL.md)). Measured in Playwright's Chromium 156.0.8078.4 with
`--enable-features=WebMCPTesting` on 14 Nov 2026: `document.modelContext` has `registerTool`,
`getTools`, `executeTool` and the three event handlers, and no `unregisterTool`; tool names other
than letters, digits, underscore, hyphen and dot are refused with `InvalidStateError`; input is
not checked against `inputSchema`; an empty result comes back as "Operation succeeded"; declarative
form tools work (`toolname`, `tooldescription`, `toolautosubmit`, `SubmitEvent.agentInvoked`).
Chrome 157 results: not recorded yet.
