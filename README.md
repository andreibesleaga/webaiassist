# WebAIAssist

A chat in your browser's side panel, with a small AI model that runs on your own computer.
It can use the tools a web page offers through [WebMCP](https://webmachinelearning.github.io/webmcp/), and asks you before each one runs.

## Install

From the Chrome Web Store: `<STORE-LINK>` (listing under review), then **Add to Chrome**.

Or load the release zip yourself:

1. Download `webaiassist-0.1.0.zip` from the
   [releases page](https://github.com/andreibesleaga/webaiassist/releases) and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and pick the unzipped folder.

## First run

1. Open a web page and click the WebAIAssist button in the toolbar. The side panel opens and
   WebAIAssist may use that page. If you open the side panel another way (Chrome's side panel
   menu), press **Allow** at the top of the panel once per site.
2. Press **Start**. The panel has already picked a model for this computer and says why in one
   sentence under the model list. Before the first download it shows the size and the address the
   model comes from, and downloads nothing until you press **Download**.
3. Ask a question about the open page.

The card at the top of the panel follows the tab in front. It shows the site, whether
WebAIAssist may work on it, the page's WebMCP tools (each with what it does and whether it only
reads or may change something), and what the site publishes for machines. With no tools it says
`— no WebMCP tools`.

## Four ways to run the model

| Path                    | Runs on                                                                                                                                                                        | Picked by itself when                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Chrome's built-in model | In Chrome on this computer: Chrome's own model (Gemini Nano)                                                                                                                   | Chrome reports it ready. Also as a last resort before an endpoint. Measured on a real computer on 14 Nov 2026 (see Limits). |
| Graphics card           | In this browser, on your graphics card (WebLLM on WebGPU): Qwen3 0.6B, Llama 3.2 3B, Qwen3.5 2B or Gemma 4 E2B                                                                 | Its first answer on this computer took 20 seconds or less, or the processor path cannot run here.                           |
| Processor and memory    | In this browser, on your processor and memory (llama.cpp in WebAssembly): Qwen3 0.6B, Qwen3 1.7B or Qwen3.5 2B                                                                 | Otherwise, on Chrome 137 or newer.                                                                                          |
| Chat endpoint           | Your own server on this computer (localhost, 127.0.0.1) or a remote service: any OpenAI-compatible address (a remote address gets your questions and the page content you use) | You set it up in Options and nothing better is available. Questions then go to that address.                                |

A model you choose yourself is kept. Details are under [Other runtimes](#other-runtimes).

## Works with

- Any website that offers WebMCP tools.
- AgenticSystemCore nodes: pages published with the engine offer ten tools, and the panel marks
  the site as a node.
- Any other page, through **Read this page**: the model gets the page text to answer from.

## What it can do, and what it cannot

- It can call only the WebMCP tools that the open page registers itself, one call at a time.
  Each call is shown first (tool, site, arguments) and runs only after you press **Allow once**.
  The default asks for every call; the Options setting "once per site per session" skips the
  question only for tools the page marks read-only.
- The extension itself does not navigate, click, fill in forms, download files or read other
  sites for the model. The only way it acts on a page is a tool the page offers, and it has no
  access to a site until you allow that site.
- What a tool does is the page's code, which the extension cannot check.

## What it reads from a site

For a site you allowed, the panel reads a fixed list of public files with a plain GET from the
same site: `llms.txt`, `llms-full.txt`, `/.well-known/knowledge-linkset`, the API catalog, the
agent card, `security.txt`, `robots.txt`, TDMRep and `/.well-known/sustainability-data`, plus the
page's own JSON-LD and `<link rel>` rows. On a node the card also shows the bundle version, date,
item counts and ledger head from the node's link set, and the chip "matches the node's own list" when
the files read match the digests in it (the same site publishes both, so this shows the files
are unchanged since the node published its list, not who wrote them). A file that does not match
is not given to the model. Each is size
limited, shown as published by the site, and (unless you turn it off in Options) given to the
model in short form, only as untrusted data.

On a node that publishes a knowledge linkset with counts, the card shows **Graph: N items**. One press
opens a tab with the graph explorer of the AgenticSystemCore site (2D), drawn in your browser from the node's
`graph.jsonld`, checked against the digest in its linkset. Other nodes it names are read only after you tick
them and press **Read the ticked nodes** (see [docs/PRIVACY.md](docs/PRIVACY.md)).

The same tab has **Query**, **Vocabulary** and **Page data**. Query is a text box for a read-only SPARQL query
(SELECT or ASK) over the node's `graph.nq`, with Run, Stop, a table of up to 200 rows and the ten example
questions of the AgenticSystemCore vocabulary; it runs in your browser with Oxigraph (WebAssembly, in the package)
and sends nothing. An update or a `SERVICE` clause is refused. On a node, the model has one built-in tool,
`webaiassist_query_graph`, for counts, lists and links that the page's tools cannot give; the same engine
answers it, and no page tool can take its name.

A site that says it wants no AI input (`Content-Signal: ai-input=no` in `robots.txt`) gets no
text sent to the model and no **Read this page**. The results of the site's own tools still go
to the model, because you asked for them. **Use on this tab anyway** overrides this for the
local model on that tab; it is not offered with a chat endpoint.

---

## Shortcut, diagnostics and storage

- **Keyboard shortcut**: Alt+Shift+A opens the side panel (Chrome may leave it unset if another
  extension has it; change it at `chrome://extensions/shortcuts`). It does what the toolbar button
  does.
- **Copy diagnostics** (Options, and More in the panel): shows what it will copy, then copies it
  on a second click: versions, model, graphics adapter, built-in model state, WebMCP on the tab
  and the last error. No page text, no keys, nothing sent anywhere.
- **Node card and help screens**: on an AgenticSystemCore node the card is headed "AgenticSystemCore
  node, spec VERSION" (the version is the node's own), with the command to start your own node
  as text to copy and one link to the AgenticSystemCore site. Four starter questions fill the
  box and send nothing ("Compose a harness for my task" only when the page has `compose`). A page
  with no tools, and a Chrome without the WebMCP switch, each get a plain help screen; the switch
  address `chrome://flags/#enable-webmcp-testing` is shown as text to copy, because an extension
  cannot open it.
- **Copy report** (More in the panel, for developers): a Markdown note about the open page's
  tools: name, title, read-only mark, schema and annotation problems, and a "Security review
  flags" section that stays empty until its rules are connected (`src/core/review-flags.ts`). It
  names the WebMCP draft date it was checked against (13 Nov 2026) and is informational, not a
  score or a certification. Preview first, copy on the second click; tool names, titles and
  descriptions only, nothing sent anywhere.
- **Downloaded models**: after the first successful download the panel asks Chrome once to keep
  them (`navigator.storage.persist()`; Chrome decides). Options shows their total size. What an
  update does to them is in [docs/PRIVACY.md](docs/PRIVACY.md).

## Options

**Options** in the panel opens one page. Each option has a short explanation beside it.

- **Where the model runs**: Automatic (default), processor and memory, graphics card, Chrome's
  built-in model, or a chat endpoint.
- **Model on the processor / in the browser**: which Qwen, Llama or Gemma model that path uses.
- **Endpoint**: Ollama, LM Studio or OpenRouter preset, or any other address; model name; optional API key.
- **When to ask before a tool**: before every call (default), or once per site per session for
  tools the page marks read-only.
- **Tool steps per question**: 1 to 12 (default 6).
- **Memory**: on or off, and **Clear memory**.
- **Give the model short facts from what the site publishes**: on by default.
- **Downloaded models**: the list with sizes, and removal of one or all.
- **Forget all sites**: clears what is kept for every site at once.
- **Language**: English.
- **Reset to defaults** restores all of them.

## Other runtimes

Use one when the computer has no usable graphics card, or to run a larger model.

**Qwen3 on the processor.** Choose **Qwen3 0.6B on the processor** (397 MB download, about 0.8 GB
of memory) or **Qwen3 1.7B on the processor** (1.1 GB, about 1.5 GB) in the model list. It runs
llama.cpp in WebAssembly inside the extension, with no graphics card, and needs Chrome 137 or
newer (the list shows it only then). It is slower than the graphics card: on 8 threads of a 16-core
computer the 0.6B model writes about 11 tokens a second and the 1.7B model about 6, and the first
question takes about 40 seconds (0.6B) or 2 minutes (1.7B) because it reads the instructions and
the tool list. Small models call the page's tools less reliably than large ones: in the first
measured run the 0.6B model answered all five questions without calling a tool, the 1.7B model
called one each time ([docs/EVAL.md](docs/EVAL.md)). The downloaded file is checked against a recorded SHA-256 and deleted if it
differs; a second Start uses the stored copy with no download.

**Qwen3.5 2B and Gemma 4 E2B.** Qwen3.5 2B is in the list twice: on the graphics card (about 1.1 GB
download, about 2.3 GB of graphics memory) and on the processor (1.3 GB download, about 1.7 GB of
memory). On the processor it loaded and answered all five measured questions, about twice as
slowly as Qwen3 1.7B (3 to 4 tokens a second, 2.5 to 4 minutes a question), and called a tool
first in four of the five ([docs/EVAL.md](docs/EVAL.md)). Gemma 4 E2B runs on the graphics card
only (2.8 GB download, about 3.4 GB of graphics memory) and is listed only when the graphics card
reports the WebGPU feature `shader-f16`; neither the graphics-card run of Qwen3.5 2B nor that of
Gemma 4 E2B is measured yet. Both are Apache-2.0. Neither is ever picked by itself. A graphics
card with little memory or a slow one can lose its device on a larger model; the panel then says
the model stopped and offers to restart it or to use the processor.

**Which model is selected, and the question before a download.** A model you choose is kept.
Until you choose, the panel picks one and says why in one sentence under the list: Chrome's
built-in model when Chrome has it ready, the graphics card when its first answer on this
computer took 20 seconds or less, otherwise the processor model. Before the first download of any
model the panel shows its size and where it comes from and waits for **Download**. Options lists
the downloaded models with their sizes and removes them, and **Forget all sites** clears every
site at once.

**Chrome's built-in model.** Chrome downloads its own model only when you choose it in the
panel's model list or in Options. WebAIAssist picks it by itself only when Chrome already has it
ready, and as a last resort before an endpoint. [Chrome's page](https://developer.chrome.com/docs/ai/prompt-api)
lists the hardware it needs; it also needs the official Google Chrome build, not Chromium. Its
window is small, so the panel gives it a shorter tool list. Without WebGPU, without the
processor path and without Chrome's model, the model list offers
**Set up a chat endpoint**, and Start opens Options.

**Ollama.**

1. Install Ollama, run `ollama pull qwen3:0.6b`, and start Ollama with the environment
   variable `OLLAMA_ORIGINS=chrome-extension://*` (Ollama refuses extensions without it).
2. In Options choose **A chat endpoint**, preset **Ollama**, model `qwen3:0.6b`.
3. Save. Chrome asks once for access to `localhost`.

**LM Studio.**

1. Load a model in LM Studio and start its local server (port 1234).
2. In Options choose **A chat endpoint**, preset **LM Studio**, and the model's name.
3. Save. Chrome asks once for access to `localhost`.

**OpenRouter (or another remote service).**

1. Create an API key at the service and note a model name (OpenRouter: `vendor/model`, for example
   `meta-llama/llama-3.1-8b-instruct`).
2. In Options choose **A chat endpoint**, preset **OpenRouter** (or **Other address** with the
   service's `https` address), the model name and the key. The model list also offers
   **Use your own server or a remote service…** while no endpoint is set; it opens Options.
3. Save. Chrome asks for access to that one host, from the Save click.
4. Press Start. Before the first use of a remote host the panel says where the model runs, that your
   questions, the page's tool list, tool results and any page text you read go to that host, and that
   the service may charge for it, and waits for **Use this service**. A different host asks again; an
   address on this computer never asks. A site that asks for no AI input is never sent to a remote
   endpoint. The key stays in this browser; no app name or referrer is sent.

An endpoint address must use `https`, or plain `http` on `localhost` or `127.0.0.1` only.

## WebMCP in your browser

A site that uses WebMCP turns it on for its visitors in Chrome 149 and later (Chrome's origin
trial), so usually there is nothing to set. If the panel says a page has no WebMCP tools on a
site you know has them, either turn on **WebMCP for testing** at
`chrome://flags/#enable-webmcp-testing` and relaunch Chrome, or press
**Add WebMCP to this site** in the panel (compat mode: it loads the WebMCP polyfill on that
site, after you allow access to it). Other browsers: [docs/BROWSERS.md](docs/BROWSERS.md).

## Privacy

With the model in the browser or Chrome's built-in model, your questions, the page text and
the tool results stay on your computer. The model weights download once from huggingface.co and Hugging Face's download network
(`*.hf.co`; every host is listed in [docs/PRIVACY.md](docs/PRIVACY.md)).
With a chat endpoint, the conversation goes to the address you set and nowhere else. There is
no account and no analytics. Details: [docs/PRIVACY.md](docs/PRIVACY.md).

**Forget this site** in the panel removes what WebAIAssist keeps about the open site.

## Limits

- Chromium browsers only (Chrome 124 or later; the processor models need Chrome 137).
- WebMCP is a draft standard; its shape may still change.
- Answers can be wrong: they come from an AI model. Check anything that matters.
- Chrome's built-in model test: measured on a real computer on 14 Nov 2026 (Chrome 157, Windows). The download, started from the click, took 300 s; later starts took 3 to 14 s. The model used a tool in 5 of 5 questions on the test node and in 1 of 5 on the live node, and an answer took 15 to 42 s (report: docs/eval/EVAL-NANO-2026-11-14-157.0.8103.52.json). It stays optional. Small models choose tools less reliably than large ones.
- A page has tools only if its own scripts register them through WebMCP.
- The model in the browser needs WebGPU. Llama 3.2 3B and Qwen3.5 2B need about 2.3 GB of
  graphics memory, Gemma 4 E2B about 3.4 GB; Gemma 4 E2B is listed only when the graphics card
  reports the WebGPU feature `shader-f16`, and it is not offered on the processor.
  The first answer after a load compiles the model's GPU programs, which takes up to a minute on
  a slow GPU; the panel says so while it waits. Long prompts run in short pieces, so a slow GPU's
  watchdog does not cut the model off.
- Small models pick tools less reliably than large ones; [docs/EVAL.md](docs/EVAL.md) records
  the measured rate.
- The extension asks before tool calls, but it cannot check what a page's tool really does.
  [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md) lists what it protects against and what it
  does not.

## Troubleshooting

- **No model loaded**: press **Start** and wait for the progress bar.
- **The model did not load, or no WebGPU**: use a Qwen model on the processor, Chrome's
  built-in model or an endpoint.
- **The processor model says it needs memory**: close other tabs, or choose the 0.6B model.
- **The model stopped with a lost GPU device**: the model host restarts itself; press **Start**
  again. If it repeats, the computer's GPU is too slow for the model: choose Chrome's built-in
  model or an endpoint.
- **No WebMCP tools**: see [WebMCP in your browser](#webmcp-in-your-browser), or **Read this page**.
- **Not allowed yet**: press **Allow** at the top of the panel and accept Chrome's request, or
  click the toolbar button on the page. `chrome://` pages and the Chrome Web Store are closed to
  extensions.
- **Endpoint fails or answers 403**: is Ollama or LM Studio running? Ollama needs `OLLAMA_ORIGINS`.
- **Wrong tool, or "no valid action"**: try Llama 3.2 3B, or ask more directly.
- **What does this browser support?** Load the development build (`npm run build:smoke`, folder
  `dist-smoke`), then **Help**, **Open the browser check** ([docs/SPIKE.md](docs/SPIKE.md)).

## Add WebMCP tools to your own site

A page registers a tool with `document.modelContext.registerTool()`. WebAIAssist lists it,
and calls it after the user allows:

```js
await document.modelContext?.registerTool({
  name: 'add',
  description: 'Add two numbers and return the sum.',
  inputSchema: {
    type: 'object',
    properties: { a: { type: 'number' }, b: { type: 'number' } },
    required: ['a', 'b'],
  },
  annotations: { readOnlyHint: true },
  execute: ({ a, b }) => String(a + b),
});
```

Mark a tool `readOnlyHint: true` only when it changes nothing. The
[WebMCP specification](https://webmachinelearning.github.io/webmcp/) has the full API.

## For developers

You need Node.js 24 and npm.

```sh
npm ci
npx playwright install chromium   # once, for the browser tests
npm run verify:release            # all checks, the build, webaiassist-<version>.zip, browser tests
```

What the tests prove, and how to run each part:

| Command              | What it runs                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm test`           | Unit tests (Vitest): core, adapters, UI logic, message schemas, adversarial and review tests, the docs.  |
| `npm run test:smoke` | The built extension in headless Chromium with a scripted model: a full question, accessibility (axe).    |
| `npm run test:bdd`   | The Gherkin scenarios of `features/` that run in that browser. `docs/SCENARIOS.md` lists every scenario. |
| `npm run eval:cpu`   | The real processor model in headless Chromium (downloads 397 MB once). Not part of the gate.             |
| `npm run eval:gpu`   | The model evaluation on a computer with a GPU (see [docs/EVAL.md](docs/EVAL.md)); opens browser windows. |

No test uses a real model, the live network or the real clock, except the two `eval` commands.
Scenarios tagged `@gpu`, `@nano` and `@manual` are checked by a person
([docs/MANUAL-CHECKS.md](docs/MANUAL-CHECKS.md)); the `@cpu` one is `npm run eval:cpu`. If the browser tests say
"Executable doesn't exist", run `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium`.

[docs/ENGINEERING.md](docs/ENGINEERING.md) has every command, the CI workflows and the
release steps. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the design.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): parts of the extension, message flow,
  confirmation gate, permissions.
- [docs/THREAT-MODEL.md](docs/THREAT-MODEL.md): threats, controls and the tests that prove them.
- [docs/PRIVACY.md](docs/PRIVACY.md): what leaves the computer and what is stored.
- [docs/A11Y.md](docs/A11Y.md): accessibility checks and results.
- [docs/SCENARIOS.md](docs/SCENARIOS.md): every scenario of `features/`, its tags, its test and
  its status.
- [docs/EVAL.md](docs/EVAL.md): the 20-prompt evaluation of the models (`npm run eval:gpu`, `npm run eval:cpu`) and its results.
- [docs/BROWSERS.md](docs/BROWSERS.md): Chrome, Edge, Brave, Opera and Vivaldi.
- [docs/ENGINEERING.md](docs/ENGINEERING.md): build, test, CI, release, updates.
- [docs/STORE-LISTING.md](docs/STORE-LISTING.md) and
  [docs/STORE-RUNBOOK.md](docs/STORE-RUNBOOK.md): the Chrome Web Store text and steps.
- [docs/PITCH.md](docs/PITCH.md) and [docs/VIDEO-SCRIPT.md](docs/VIDEO-SCRIPT.md): the one-page
  description and the demo video script.
- [docs/SPIKE.md](docs/SPIKE.md): the browser check and its recorded results.
- [docs/SOURCES.md](docs/SOURCES.md): specifications and pages the design relies on.
- [docs/GOVERNANCE.md](docs/GOVERNANCE.md): the roles and the uses that are not offered.
- [docs/MANUAL-CHECKS.md](docs/MANUAL-CHECKS.md): the checks a person runs in a real browser.
- [SECURITY.md](SECURITY.md): how to report a vulnerability.
- [CHANGELOG.md](CHANGELOG.md): changes.

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

AgenticSystemCore™ is a trademark of Andrei N. Besleaga. WebAIAssist is a separate project by the
same author; it is not part of AgenticSystemCore.

## Check WebMCP in your browser

The [`conformance/`](conformance/README.md) folder is a plain page that tests the WebMCP interface
of any browser, with or without this extension, and sends nothing anywhere. The same folder is the
test suite for the extension's own handling of page tools.
