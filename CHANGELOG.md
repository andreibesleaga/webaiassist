# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] - not yet released

First release. The date is set when the tag is made (docs/ENGINEERING.md, "Release").

### Added

- **Side panel**: a chat with a local AI model that uses the WebMCP tools of the open page.
  Streaming answers, Stop, a step limit (1 to 12, default 6), Export as Markdown (it says it was
  written by an AI model and names the model and where it ran), Help and a welcome screen,
  keyboard use (Ctrl+Enter, Escape), light and dark themes, no library, font or image from
  outside the package.
- **Four model paths** behind one `ModelRuntime` port:
  - the graphics card: WebLLM (`@mlc-ai/web-llm` 0.2.86), Qwen3 0.6B, Llama 3.2 3B, Qwen3.5 2B and
    Gemma 4 E2B (listed only when the graphics card has `shader-f16`), in a Worker
    of the offscreen document (or in the service worker when the offscreen document has no
    WebGPU);
  - the processor: llama.cpp in WebAssembly (`@wllama/wllama` 3.8.1), Qwen3 0.6B, Qwen3 1.7B and
    Qwen3.5 2B as GGUF
    files with a recorded size and SHA-256, checked after the download, stored once, Chrome 137 or
    newer;
  - Chrome's built-in model (Prompt API), with its context window read from Chrome, a compact tool
    list, replies constrained to the action schema, and a plain reason for each state;
  - an OpenAI-compatible chat endpoint (Ollama and LM Studio presets; `https`, or `http` on
    `localhost` and `127.0.0.1` only; no redirects, replies capped at 1 MB).

  One model is in memory at a time. The model libraries and the llama.cpp engine ship inside the
  package, pinned by SHA-256; only weights download, from fixed Hugging Face addresses.

- **Default model by measurement**: Chrome's built-in model when ready; the graphics card when its
  first answer was not slow (20 seconds); the processor model; then an endpoint. The panel says
  why in one sentence. A model the user chooses is kept. Options has **Automatic**.
- **Consent before a download**: size, source and place of storage are shown, and nothing downloads
  before **Download**. Options lists the downloaded models with sizes and removes one or all.
  **Forget all sites** clears everything kept per site.
- **Where each model runs is stated everywhere**: the model list has two groups ("On this computer,
  in the browser" and "Your own server or a remote service"), every label and the model line after
  Start say whether the model runs in this browser on the graphics card, in this browser on the
  processor and memory, in Chrome on this computer, on your own server on this computer, or on a
  remote service (then also where the chat goes), and Options says the same.
- **Per-model prefill chunk** for the graphics-card models (a bigger model prefills in shorter
  chunks, so one chunk stays under the graphics driver's time limit), and plain handling of a
  model that is gone: a lost device, or an engine WebLLM no longer has loaded, stops the model
  line saying "Ready" and shows plain words.
- **Page card that follows the browser**: it refreshes by itself when the tab, window, address,
  title or the page's tools change, and shows the site, an access badge (No page, Cannot run here,
  Not allowed yet, Allowed, Blocked by the site), each WebMCP tool with the page's own words and
  "reads" or "changes", and a More menu (Add WebMCP, Forget, Export). A tool with no hint counts as
  "changes".
- **Site information**: for a site the user allowed, a fixed list of public files is read from the
  same site (`llms.txt`, `llms-full.txt`, the knowledge link set, API catalog, agent card,
  `security.txt`, the AI policy of `robots.txt`, TDMRep) and the page's JSON-LD. Same origin, GET,
  no cookies, no redirects, 5 and 10 second limits, size caps, at most eight files. Shown as
  published by the site; a few short facts go to the model as untrusted data (Options can turn
  this off). A site that sends `Content-Signal: ai-input=no` gets no site text sent to the model
  and no **Read this page**, unless the user chooses **Use on this tab anyway** (local model only).
- **AgenticSystemCore node mode**: a site that says it is a node is shown as saying so, and the
  model gets a short hint on the roles of the ten node tools.
- **Scope of action**: only the open page's own WebMCP tools, through the confirmation gate (tool,
  site, arguments; Allow once or Deny; once per site per session only for read-only tools, in
  Options). The tool is checked again before the call and after the question.
- **Agent loop**: one action per reply, one repair try that names the tool's fields, a call
  identical to an earlier one is not run again, untrusted-data fence for tool results, a run bound
  to the tab and site it started on.
- **Options page**: where the model runs, model per path, endpoint, confirmation mode, step limit,
  memory (and Clear memory), site facts, language, Reset to defaults. Settings are versioned and
  checked on read.
- **Compat mode** (the `@w3c/webmcp-polyfill` 0.1.0 on the user's click) and **Forget this site**.
- **Tests**: unit tests (Vitest), fixture replay of the ten node tools, adversarial and review
  tests, document checks, browser tests of the built extension in Chromium (Playwright; scripted
  model, fake processor engine, fake `LanguageModel`), axe-core accessibility checks in light and
  dark, and the behaviour as Gherkin in `features/` run by `npm run test:bdd`. Every scenario is
  run, proved by a named unit test, or tagged for a person (`docs/SCENARIOS.md`).
- **Evaluation**: `npm run eval:gpu` (20 prompts, two models, report in `docs/eval/`) and
  `npm run eval:cpu` (the real processor models, headless).
- **Release checks**: `npm run verify:release`, a build check that no code can be fetched from
  outside the package, a zip content test, and `webaiassist-<version>.zip`.
- **CI**: `test.yml` and `release.yml` (actions pinned by commit SHA), Dependabot for same-major
  updates at least 14 days old.
- **Documents**: README, architecture, engineering, threat model, privacy, governance, accessibility,
  scenarios, manual checks, evaluation, browsers, sources, store listing and runbook, pitch and
  video script.

- **More of what a node and a site publish** (package P2): the chip "matches the node's own list"
  from the SHA-256 digests in the link set (a file that differs is marked and not given to the
  model); bundle version, hash, date, item counts and ledger head; the page's own `<link rel>`
  rows; Dataset, licence, creator and date from the page's JSON-LD; the sustainability file as the
  ninth site file (the cap was eight); every Content-Signal value and group of `robots.txt`;
  peer chips and three starter questions on a node; a plain reason when a page shows no tools
  (this browser has no WebMCP, or the page registers none).
- **Keyboard shortcut** Alt+Shift+A for the toolbar button (manifest `commands`, no permission).
- **Copy diagnostics** with a preview, in Options and in the panel.
- **Storage**: persistent storage asked once after the first download; total size in Options.

### Security

- Manifest V3 with five install permissions (`sidePanel`, `offscreen`, `storage`, `activeTab`,
  `scripting`), no install-time host access, optional host access one site at a time, no declared
  content scripts, no `web_accessible_resources`, no `externally_connectable`.
- A frame inside a page cannot make the page bridge run a tool: the bridge answers only its own
  window, and each reply goes on the channel of its own request.
- A tool call is refused when the page changes the tool while the user decides.
- One sanitiser for page text the model sees: invisible characters and every turn-marker shape
  removed; a tool whose name, description or schema holds one is not offered; a tool name with
  white space or a control character is not offered.
- A tool schema `pattern` that could freeze the panel is refused before it runs.
- Saved tool results are fenced as untrusted again when they come back from the saved chat.
- A stopped answer calls no tool afterwards.
- `chrome.storage.local` (endpoint, key) is closed to content scripts; the key is hidden in exports.
- The model files are checked: libraries and tokenizers by pinned SHA-256, processor weights by size
  and SHA-256 before they load.
- Export escapes Markdown, so no remote image loads from the file.
- "Use on this tab anyway" does not hold once a remote endpoint is started.
- Results of a site's own tools still reach the model when the site asks for no AI input; the panel
  and `docs/PRIVACY.md` say so.

### Known limits

- Chrome's built-in model is not verified on a real computer: the first hand test did not start it.
- The graphics-card path was run on a laptop GPU (slow first answer; long prompts needed a
  smaller prefill chunk); Llama 3.2 3B lost the GPU device on its first question there (the chunk
  is now per model, not yet measured), and Qwen3.5 2B and Gemma 4 E2B are not run on a graphics card yet.
- The 0.6B processor model called no tool in the first measured run; the 1.7B model did, at 47 to
  116 seconds a question; Qwen3.5 2B called a tool first in four of five, at 153 to 256 seconds a question.
- WebMCP is a draft standard.

[0.1.0]: https://github.com/andreibesleaga/webaiassist/releases/tag/v0.1.0
