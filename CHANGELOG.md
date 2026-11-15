# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.0] - not yet released

First release. The date is set when the tag is made (docs/ENGINEERING.md, "Release").

### Added

- **Tool security review and parity features**: nine written rules read each tool's definition (hidden
  characters, orders to the AI, a call to another tool, look-alike names, links, encoded text, a read-only mark
  that the name contradicts, oversized text, a definition changed since first seen); a tool with a finding is
  marked "check", shows its reasons in the list, the detail view and the question, and is always asked about
  ([docs/TOOL-REVIEW.md](docs/TOOL-REVIEW.md)). A tool detail view with every hint, its fields and its reasons;
  "Run it by hand" through the same questions; a second question for a tool the page marks as consequential;
  form tools say that the page waits for you to press Submit and warn about password, payment and personal
  fields; tools with the `debugging` hint are listed as "for developers" and are not offered to the model; a number
  on the toolbar icon counts the tools of a site you allowed; "Copy report" lists the review's findings. Stop now
  reaches the tool that runs on the page, a result of nothing reads as one plain sentence, a same-origin frame's
  tools are neither listed nor run, and a call whose page navigated is not sent again. The built-in graph tool
  asks before each call in "ask for every call".

- **Node card, help screens and Copy report**: node card heading from the node's own link set
  and a "Start your own node" command to copy; a fourth starter ("Compose a harness for my task")
  and an `explain` starter that asks why two items are linked; help screens for "This site has no
  tools" and "Chrome needs the WebMCP switch"; a developer "Copy report" of the open page's tools
  with a "Security review flags" hook (`reviewFlags`, empty for now).

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
- **Chat endpoint, local or remote**: an OpenRouter preset and "Other address"; the model list
  offers "Use your own server or a remote service…" while no endpoint is set; a one-time question
  per host before a remote service is first used (where the model runs, what is sent, that it may
  charge; nothing is sent before **Use this service**; never for `localhost`); the endpoint
  runtime reads token counts and the price from the streamed reply (`onUsage` on the chat
  request); a service's error text is cut and scrubbed of the API key; `npm run eval:endpoint`
  runs five questions against any endpoint (address, model and key from the environment only).

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
- **Graph explorer tab**: on a node whose linkset gives counts, the card shows "Graph: N items"; one
  press opens `explorer.html` with the 2D graph explorer of the AgenticSystemCore site (its code copied
  unchanged into `third_party/agsc-explorer/` and pinned by SHA-256, with `force-graph` 1.52.0). The node's
  linkset, `graph.jsonld` and chunks are read through the tab with a new fixed list and a `site/graph-file`
  message; the graph must match the SHA-256 digest in the linkset or it is not drawn; other nodes are read only
  after you tick them and press a button (https, public name, three fixed paths, no redirect, 2 MiB). No new
  permission and no `web_accessible_resources`.
- **Activity log**: one entry per question, kept only in this browser (IndexedDB, at most 8 MiB):
  site, model, where it ran, tokens (marked "estimated" when the runtime gave no count), price when
  the service reports one, times, the tool calls with your answer to each, and context numbers. The
  question, the arguments and the results are kept only with the "Include content" switch (off at
  the start). The explorer page gains an **Activity** tab (totals per day and in all, filters by site,
  model and day, Export JSON, Export CSV, Clear with a question inside the page, and Run again of a past
  tool call through the usual question); a button **Activity log** in the panel's More area opens it on
  any page, with no node needed. The calls of the built-in graph tool are logged too. Forget this site
  and Forget all sites remove the entries.
- **Query and semantic tools**: the explorer tab gains **Query** (a text box, Run, Stop, a result table
  built as text, ten example questions with "Put in editor"), **Vocabulary** (classes and properties from the
  node's vocabulary file, in a store of its own) and **Page data** (the open page's JSON-LD as text). The
  query engine is Oxigraph 0.5.13 (WebAssembly, `model-libs/oxigraph.wasm`, pinned) in a Worker; its read-only
  rules are the query files of agentic-system-core 1.1.0, copied unchanged into `third_party/agsc-query/` and
  pinned by SHA-256 (an update, `SERVICE` and a graph over 200,000 statements are refused; 10 seconds in the
  tab, 8 seconds for the model; nothing leaves the computer). The model gets one built-in tool,
  `webaiassist_query_graph` (port `GraphQuery`), listed apart from the page's tools; a page tool whose name
  is, or reads like, a name of WebAIAssist is not offered and is marked on the card. The zip limit is now
  12 MiB (the query engine is 1.5 MB compressed). No new permission and no `web_accessible_resources`.

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
- **WebMCP conformance page and suite** (`conformance/`): a plain static page with sixteen cases
  that exercise every part of the WebMCP interface (registering, listing, running, annotations,
  schemas, errors, cancelling, slow and large results, form tools, late and removed tools, frames,
  hostile definitions), one `expect.json` as their single source, browser-only and extension
  tests, and `npm run eval:conformance` (and `:win`) for real Google Chrome, with an optional
  stage on Google's official demo pages. The evaluation build made with `--demos` adds the one
  host `googlechromelabs.github.io`; the release build keeps no install-time host.

- **The model uses the page's tools** (package P1). On a page with tools both prompts now say
  that the model cannot see the site and must call a tool first for anything about it; that site
  files are background and never the source of an answer; that read-only tools come first and a
  tool that changes something is used only when the user asked for that action (the tool list
  is split the same way); and that the first sufficient result ends the question. After a tool
  result the loop adds one line (not saved with the chat) that lets the model answer at once, and
  the site files come with a line that says they are not an answer. For a window of 4096 tokens or
  less the site text is cut to 2,400 characters, so a site that fills every piece still fits. The
  question "Use the tools of this site?" is now asked when a tool is first about to be used, not
  before a question that needs no tool. The evaluation scores "First tool right" and "Tool used"
  beside "Tool right".

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

- Chrome's built-in model was measured on 14 Nov 2026 (Chrome 157, Windows): a tool in 5 of 5 questions on the test node and 1 of 5 on the live node, 15 to 42 s an answer. The first hand test, before that, did not start it.
- The graphics-card path was run on a laptop GPU (slow first answer; long prompts needed a
  smaller prefill chunk); Llama 3.2 3B lost the GPU device on its first question there (the chunk
  is now per model, not yet measured), and Qwen3.5 2B and Gemma 4 E2B are not run on a graphics card yet.
- The 0.6B processor model called no tool in the first measured run; the 1.7B model did, at 47 to
  116 seconds a question; Qwen3.5 2B called a tool first in four of five, at 153 to 256 seconds a question.
- WebMCP is a draft standard.

[0.1.0]: https://github.com/andreibesleaga/webaiassist/releases/tag/v0.1.0
