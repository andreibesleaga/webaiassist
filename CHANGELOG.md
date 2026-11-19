# Changelog

> **In short**
>
> - Version 0.1.1 moves the graphics-card models to the same engine as the processor models (llama.cpp, MIT) and removes WebLLM and four compiled model libraries whose repository states no licence. Released on 19 Nov 2026.
> - Version 0.1.0 is the first release, of 16 Nov 2026; on the [Chrome Web Store](https://chromewebstore.google.com/detail/webaiassist/mekikidmpikblfalilhckiadncbjfppi) since 17 Nov 2026.
> - It adds a side panel where a local AI model uses the page's WebMCP tools, through four model paths: graphics card, processor, Chrome's built-in model and a chat endpoint.
> - Every tool call goes through a confirmation (Allow once or Deny). The manifest has five install permissions and no install-time host access.
> - Measured on one laptop with two graphics cards (0.1.1, 18 Nov 2026): the default, Qwen3 1.7B, picked the right tool in 8 of 10 test-node questions and 5 of 10 on the live node, on both cards.
> - WebMCP is a draft (a Community Group report, not a W3C Standard), and other computers are not measured.

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-11-19

One engine for every model in the browser. Version 0.1.0 ran the graphics-card models with WebLLM and
shipped four compiled model libraries from a repository that states no licence. This version removes
both. Nothing else in the extension changes: the permissions, the confirmation before every tool
call, Chrome's built-in model, the processor models and chat endpoints work as before.

### Changed

- **The graphics-card models run on llama.cpp** (`@wllama/wllama`, MIT), the engine that already ran the
  processor models, with every layer on the graphics card through WebGPU. The package holds one engine
  file for models and no compiled model library.
- **Every model file has a licence stated by its publisher**: Apache-2.0 for Qwen3 0.6B, Qwen3 1.7B,
  Qwen3.5 2B and Gemma 4 E2B, the Llama 3.2 Community License for Llama 3.2 3B
  ([docs/MODEL-LICENCES.md](docs/MODEL-LICENCES.md)). Each is one GGUF file at a fixed commit, checked
  against its recorded size and SHA-256 before use. The one file above 2 GB (Gemma 4 E2B, 3.1 GB) is
  checked in pieces of 1 GB, because the browser's SHA-256 takes at most 2 GB in one call.
- **A model offered on the graphics card and on the processor is one file**: it downloads once and is
  listed once in Options.
- **A saved choice from 0.1.0 selects the same model**: the four graphics-card models of 0.1.0 keep
  their place in the list under new ids.
- **The models in the browser need Chrome 137 or later**, on the graphics card too (0.1.0: Chrome 126 for
  the graphics card). In an older browser the list offers Chrome's built-in model and chat endpoints.
- **The chat takes at least half of the panel's height**, and its lower edge can be dragged to make it
  taller or shorter. When that is more than the panel has, the panel scrolls as a page and the question
  box stays at the lower edge. The page card above it takes at most 30 % of the height (was 40 %).
- **The package is smaller**: the zip is about 4.6 MB (0.1.0: about 11.5 MB).
- **Llama 3.2 3B is no longer marked slow.** On the new engine it answered in a median of 14 to 18 seconds
  and picked the right tool most often (live node: 8 of 10 on the NVIDIA card, 7 on the AMD one). It is still
  never picked by itself. Gemma 4 E2B stays marked slow (1 to 2.5 minutes an answer).
- **The model evaluations start each question in a new chat** (`npm run eval:gpu`, `npm run eval:cpu`,
  `npm run eval:nano`): they empty the saved
  chats first. Before, a question saw the answers that earlier runs and other models had saved for the
  site, which lowered the live-node numbers of the 0.1.0 runs ([docs/EVAL.md](docs/EVAL.md)).

### Added

- **A model in the browser uses the page's own tools first.** On a node page that offers tools, the
  graphics-card and processor models no longer get the built-in graph tool beside them: in the runs of
  18 Nov 2026 Qwen3 1.7B chose it for 4 of 10 live-node questions that a page tool answers. Chrome's
  built-in model and chat endpoints keep it; a page with no tools of its own still gets it. With the
  change Qwen3 1.7B used a page tool for 10 of 10 live-node questions; it picked the expected one for 5
  of 10, as before, and the general `ask` tool for most of the others.
- **An earlier answer given without a tool is not given to the model again.** With Memory on, a site's
  saved exchanges that used a tool (or page text read on request) still go with the next question; one
  answered without a tool is left out of what the model is given, and stays in the saved chat and the
  transcript. Small models copied such answers and stopped calling tools. Measured on 19 Nov 2026 with Qwen3 1.7B and a site chat full of such answers: the
  right tool on the live node in 5 of 10 questions, as with a new chat (1 to 4 of 10 before this change).
- **Qwen3 1.7B on the graphics card, now the default.** In the runs of 18 Nov 2026 it used a tool for every
  question and picked the right one for 8 of 10 on the test node and 5 of 10 on the live node, on both cards
  of the measured laptop, with a median answer of 9 to 20 seconds.
- **A model that ends by itself says so**: when the engine stops (the graphics card gave up, or memory ran
  out), the panel says to press Start again, and the next Start loads the model again.
- **The files of the old engine are removed once after the update**, so they do not keep taking disk space
  (they could be several gigabytes).
- **Page text read for an earlier question stays with that question** when the saved chat is given to
  the model: it now follows the question instead of being cut off when that question comes first, also
  when the saved chat is cut to its newest 200 messages at that point. A follow-up question therefore
  gets the page text you read before, from the saved chat (in 0.1.0 a page text that stood first was
  dropped from the saved chat at the next question).
- **The store title says what the extension is**: "WebAIAssist - Browser AI for WebMCP websites and the
  agentic knowledge web". The short name, the panel and the toolbar button still say WebAIAssist.
- **The docs say which model path did best and how to use the faster graphics card**: README, "Which one
  did best" and "Use the faster graphics card"; [docs/EVAL.md](docs/EVAL.md), "Which path did best". The
  switch `--force_high_performance_gpu` was checked in Google Chrome 157. Options names it and says that
  Llama 3.2 3B picked the right tool most often.
- **A graphics-card model that fails to load says why in graphics terms**: too little graphics memory, or
  a graphics device that gave up (the model host then starts again with a fresh device).
- **The name of the keyboard shortcut is in the language file**, with the other texts Chrome shows.

### Removed

- **WebLLM and the four compiled model libraries.** The service worker no longer hosts a model: the
  engine runs in a Worker of the offscreen document only.

### Known limits

- On a laptop with two graphics cards the browser gives pages the integrated one, whatever they ask for
  (measured 18 Nov 2026, Windows, Chromium 156: AMD integrated by default; NVIDIA only when the browser was
  started with `--force_high_performance_gpu`). The extension cannot choose the card.
- The engine sends work to the graphics card in pieces of 64 tokens. With llama.cpp's default the
  1.1 GB model made the graphics driver give up on its first question on the measured AMD card.
- The measured numbers are in [docs/EVAL.md](docs/EVAL.md): one laptop, two graphics cards.
- WebMCP is a draft (a Community Group report), not a W3C Standard.

## [0.1.0] - 2026-11-16

First release. Sent to the Chrome Web Store for review on the same day.

### Added

- **Stop ends a model that does not stop**: when a graphics-card model is still running five seconds after
  Stop, its engine is ended and the panel says to press Start again (a model that runs in a Worker is terminated;
  one on the page's main thread cannot be, and the next Start waits for it). A model too
  slow for the graphics card could otherwise keep the browser's graphics process busy for minutes.
- **The agreed remote hosts are read when the question is due**, not when the panel opened: after "Forget
  all" or "Reset to defaults" an open panel asks again before it uses a remote chat service, and a remote
  model that was already started is let go before the next question.
- **Reset to defaults keeps the host access of a site you allowed**, when the chat endpoint is on the same host.
- **A node page without tools says what to do next**: open an item page of the site for the node's tools, or
  press Read this page to ask about the open page (the old line put both in a bracket).
- **A forgotten site in an open tab**: the page scripts left in a tab whose site was forgotten are no longer
  asked for its tools; the panel shows Allow again.
- **The Activity page** has one heading and no longer shows the graph page's sentence about a node's files.
- **Default models from the measured runs** (15 and 16 Nov 2026): Chrome's built-in model when Chrome has it
  ready; otherwise Qwen3 0.6B on the graphics card whenever the browser can use it (a slow first answer is named in
  the reason line); otherwise Qwen3 1.7B on the processor. Llama 3.2 3B and Gemma 4 E2B stay in the graphics-card list, each marked "slow: may stall on
  a laptop graphics card" and never picked by default: on the measured graphics card both ran past five minutes on
  their first question.
- **A page that registers its tools late**: when the first list of a page is empty, the panel lists it again
  after one and after three seconds; the toolbar number is read again as soon as you allow or forget a site.
  Before, both could stay at "no tools" until the page changed something (seen on the first case of the
  conformance page in Chrome 157).
- **Build checks in the release gate**: `npm run test:dist` runs the checks of the built package and the
  privacy host scan after the build and the zip, and fails when the build is missing, so CI no longer skips them.
- **Release workflow in two jobs**: the build runs with read access only; the job that creates the release runs
  no installed code and attests the zip's build provenance (`gh attestation verify`).
- **Locale file**: the build writes `_locales/en/messages.json` from the typed English dictionary, and the
  description and the toolbar button title in the manifest come from it (`default_locale: en`), so another
  language is one more dictionary and one more folder.
- **Tool security review and parity features**: nine written rules read each tool's definition (hidden
  characters, orders to the AI, a call to another tool, look-alike names, links, encoded text, a read-only mark
  that the name contradicts, oversized text, a definition changed since first seen); a tool with a finding is
  marked "check", shows its reasons in the list, the detail view and the question, and is always asked about
  ([docs/TOOL-REVIEW.md](docs/TOOL-REVIEW.md)). A tool detail view with every hint, its fields and its reasons;
  "Run it by hand" through the same questions, written to the activity log as an entry with no model; a second question for a tool the page marks as consequential;
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
  - the graphics card: WebLLM (`@mlc-ai/web-llm` 0.2.86), Qwen3 0.6B, Qwen3.5 2B, Llama 3.2 3B and Gemma 4 E2B, in a Worker
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
- **Activity log keeps less**: with "Include content" off, a failed tool call is stored as failed, without its
  error text; argument names are always stored, argument values only with "Include content".
- **Sites you allowed are a list**: kept in `chrome.storage.local`, apart from Chrome's host access. Saving a
  chat endpoint gives access to that host for the chat only; the toolbar number, the automatic tool listing and
  the nine file reads happen only on allowed sites. Forget this site and Forget all sites remove sites from the list.
- **Forget all sites and Reset** also clear the list of remote endpoint hosts you agreed to; Reset also removes the
  endpoint's host access.
- **Forget this site**: the panel neither lists nor calls that site's tools until you allow it again, even in tabs
  already open.
- **Run again** in the Activity view asks the same question as the side panel (full arguments, hidden characters
  shown, review findings, hints, form lines, a second question for a consequential tool) and runs only when the site
  is allowed in this session; never with redacted or removed arguments.
- **Tools not offered to the model are listed**: a tool with text that could pass for the assistant's own markers,
  hidden characters, or a field schema over 8,000 characters is listed with the reason and can be run by hand; the
  tool list given to the model is capped at 24,000 characters, and tools beyond it are listed as not offered.
- **"Tool unchanged" check** also compares the tool's title and form flags.
- **Chat endpoint limits**: 15 seconds for the first connection, a reply stops after 60 seconds without data, and an
  error body is read only up to 2 KB.
- **Copy details** removes web addresses and the API key from the error text.
- **CSV export** puts an apostrophe before a cell that starts with `=`, `+`, `-`, `@`, a tab, a carriage return or a
  line feed.
- **Minimum Chrome version is 126** (compat mode's polyfill uses `URL.parse`).

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
- The tool list and the results of a site's own tools still reach the model when the site asks for no AI input
  (its page text and files do not); the panel and `docs/PRIVACY.md` say so.

### Known limits

- Chrome's built-in model was measured on 15 Nov 2026 (Chrome 157, Windows): a tool in 5 of 5 questions on each node, the whole expected sequence in 4 of 5, 18 to 36 s an answer.
- The graphics-card path was run on one laptop GPU (AMD gcn-5) on 16 Nov 2026: Qwen3 0.6B picked the right
  tool in 8 of 10 test-node questions but 2 of 10 on the live node; Qwen3.5 2B in 6 of 10, at 2 to 5 minutes a
  question; Llama 3.2 3B and Gemma 4 E2B ran past five minutes on their first question and stopped the browser
  (both are marked slow in the list). Other graphics cards are not measured. When the engine runs on the page's
  main thread and not in a Worker (a graphics card the Worker cannot reach), Stop cannot end it at once.
- The 0.6B processor model called no tool in the first measured run; the 1.7B model did, at 47 to
  116 seconds a question; Qwen3.5 2B, in its first run, called the expected tool first in four of five, at 153 to 256 seconds a question.
- WebMCP is a draft (a Community Group report), not a W3C Standard.

[0.1.1]: https://github.com/andreibesleaga/webaiassist/releases/tag/v0.1.1
[0.1.0]: https://github.com/andreibesleaga/webaiassist/releases/tag/v0.1.0
