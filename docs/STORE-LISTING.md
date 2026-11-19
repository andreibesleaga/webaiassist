# Chrome Web Store listing

> **In short**
>
> - This page holds the text and images for the Chrome Web Store listing. Each quote block is the content of one field.
> - Still open: the store link, the privacy policy URL and the demo node URL.
> - The description says WebMCP is a draft, not a W3C Standard, that answers can be wrong, and that starting a model downloads 400 MB to 3.1 GB after you agree.
> - Measured on one laptop with two graphics cards (version 0.1.1), the default model, Qwen3 1.7B, had the whole expected tool sequence right in 8 of 10 test-node questions and 5 of 10 live-node questions on both cards.
> - Each run is a few questions, so the tables show a direction, not a rate. Host access is optional and never granted at install.

The text and images for the WebAIAssist listing. Each quote block is the content of one field:
paste it without the leading `>` and without the angle brackets around links.

## To be filled after the final runs

Nothing below is guessed. These items stay open until the runs are done and recorded in
`docs/eval/`:

- [x] **The default-model line.** Decided 16 Nov 2026 from the runs, changed for 0.1.1 on 18 Nov 2026: Chrome's
      built-in model when it is ready, otherwise Qwen3 1.7B on the graphics card, otherwise Qwen3 1.7B on the
      processor. The description does not name a model.
- [x] **The graphics-card numbers.** Runs of 18 Nov 2026, version 0.1.1, two cards (table below).
- [x] **The built-in model re-run** after the last change: run of 15 Nov 2026 (table below).
- [x] **The data-type answer** on the Privacy tab: "Website content" (decided 16 Nov 2026; see Data usage below).
- [x] **Privacy policy URL** `https://agenticsystemcore.com/webaiassist/privacy/` and **demo node URL**
      `https://agenticsystemcore.com/concepts/harness/`, as submitted on 16 Nov 2026.
- [x] **Store link**: published 17 Nov 2026, version 0.1.0 (item ID `mekikidmpikblfalilhckiadncbjfppi`):
      <https://chromewebstore.google.com/detail/webaiassist/mekikidmpikblfalilhckiadncbjfppi>; the README links it.
- [x] **Screenshots** from a real run of 16 Nov 2026: five files `docs/store/screenshot-*-1280x800.png` (see Images).

## Store listing tab

**Name** (the manifest `name`, 74 of 75 characters; the store reads the title from the package):

> WebAIAssist - Browser AI for WebMCP websites and the agentic knowledge web

The short name, which Chrome shows where space is tight, stays `WebAIAssist`.

**Summary** (the manifest description, 116 of 132 characters):

> A local AI model in your side panel that uses the WebMCP tools of the open page. Works with AgenticSystemCore nodes.

**Category:** Productivity, then the closest sub-category the dashboard offers for tools.

**Language:** English

**Description:**

This is the text as submitted on 16 Nov 2026 (the maintainer's wording in the dashboard), with two facts
changed for 0.1.1: "WebGPU and WebAssembly" (was "WebGPU and WebLLM") and the download sizes "400 MB to
3.1 GB" (was "350 MB to 2.8 GB").

> WebAIAssist puts an AI inside your browser's side panel, with no server to install, and lets it use the tools a web page offers. By default, before any call runs, you see what it will do and press Allow or Deny.
>
> The AI runs on your computer: on the graphics card, on the processor, or as Chrome's own built-in one. What you type stays in this browser, except the arguments of a tool call you allow, which go to the page that offers the tool, and the chat when you set up a chat server.
>
> Sites can offer tools through WebMCP, a specification that lets a page describe what it can do, such as a search or a form. WebAIAssist lists them with what the page says each does and whether it only reads. By default, for each call you see the name, the site and the exact arguments.
>
> It also reads what a site publishes about itself: llms.txt, a knowledge link set, robots.txt, security.txt and a few other files. The panel shows them. A site that asks for no AI input gets none of its page text or files sent, unless you press Use on this tab anyway (a model in the browser only). For a node of the AgenticSystemCore project, a card shows its version and graph, and you can run read-only SPARQL queries over it.
>
> Before you start:
>
> Chrome keeps WebMCP behind a switch. Open chrome://flags/#enable-webmcp-testing, choose Enabled and relaunch. Without it, sites' tools do not appear. WebGPU and WebAssembly allow AI models to run locally in user's browser. WebMCP is a draft, not yet a W3C Standard. It may change. Needs Chrome or another Chromium browser. The first LLM model start downloads ~ 400 MB to 3.1 GB, after you agree to use in browser, or you can use a local (eg: ollama), or remote server model, via an OpenAI-style address (eg: OpenRouter).
>
> Answers can be wrong. Small models often miss the right tool, so check what matters.
> No account, no analytics. No access to any site at install; you allow one site at a time.
>
> Works also with AgenticSystemCore, by the same author. Open source, Apache-2.0: <https://github.com/andreibesleaga/webaiassist>

**Word counts of the description.** 369 words. After function words are left out, the most used
words are: page 5, browser 5, site 5, AI 4, use 4, allow 4. The test
`test/security-review/docs-review.test.ts` fails when any word is used more than five times.

## Measured results

Every number below is in a file of `docs/eval/` or in [EVAL.md](EVAL.md). One run of five questions
shows a direction, not a rate. "Test node" is a local copy of the ten tools of an
AgenticSystemCore node; "live node" is agenticsystemcore.com on the day. "Whole sequence right" means
the tools called, in order, equal the expected ones. "A tool used" counts questions where any tool was
called. Small models miss the right tool; the tables say how often.

### In the browser, on the graphics card

Hardware: one Windows laptop (build 10.0.26300) with two graphics cards, NVIDIA (`nvidia/ampere`) and
AMD integrated (`amd/gcn-5`); Chromium 156.0.8078.4; version 0.1.1. Runs of 18 Nov 2026, one model per
run, 10 questions per node, each question in a new chat (`docs/eval/EVAL-GPU-2026-11-18-<card>-<model>.json`;
[EVAL.md](EVAL.md) says why each question starts a new chat). Command:
`npm run eval:gpu -- [--fast-gpu] --models <key> --prompts 10 --idle 0 --no-cancel-check`. Only Qwen3 1.7B is
picked by default; Gemma 4 E2B is marked "slow: may stall on a laptop graphics card" in the list.

| Model                | Whole sequence right, NVIDIA: test node / live node | Whole sequence right, AMD: test node / live node | Median answer, NVIDIA: test / live | Median answer, AMD: test / live |
| -------------------- | --------------------------------------------------- | ------------------------------------------------ | ---------------------------------- | ------------------------------- |
| Qwen3 1.7B (default) | 8 / 5 of 10 (a tool used: 10 and 10 of 10)          | 8 / 5 of 10 (a tool used: 10 and 10 of 10)       | 9.2 s / 15.2 s                     | 13.7 s / 19.7 s                 |
| Qwen3 0.6B           | 8 / 0 of 10 (a tool used: 10 and 0 of 10)           | 7 / 1 of 10 (a tool used: 10 and 1 of 10)        | 6.6 s / 4.0 s                      | 10.0 s / 6.7 s                  |
| Qwen3.5 2B           | 6 / 5 of 10                                         | 9 / 2 of 10                                      | 13.5 s / 21.1 s                    | 15.4 s / 30.8 s                 |
| Llama 3.2 3B         | 9 / 8 of 10                                         | 7 / 7 of 10                                      | 13.7 s / 15.2 s                    | 18.3 s / 16.7 s                 |
| Gemma 4 E2B (slow)   | 6 / 6 of 10 (2 questions over the 5-minute limit)   | 8 / 5 of 10 (3 over the limit)                   | 51.1 s / 94.4 s                    | 78.5 s / 153.9 s                |

Version 0.1.0 (WebLLM, AMD card, 16 Nov 2026, before each question started a new chat): Qwen3 0.6B 8 of
10 on the test node and 2 of 10 on the live node; Llama 3.2 3B and Gemma 4 E2B ran past the 5-minute
limit on their first question.

### In the browser, on the processor and memory

Hardware: 16 cores (8 threads used), Linux under WSL2, headless Chromium 156.0.8078.4; memory not
recorded. Test node, five questions, after the tool-use change
(`docs/eval/EVAL-CPU-<model>-P1-AFTER-2026-11-14.json`). Command:
`npm run eval:cpu -- --model 0.6b --prompts 5` (also `--model 1.7b` and `--model qwen35-2b`).

| Model                                                       | Load, first download / stored copy | Whole sequence right | First tool right | A tool used | Median answer                   | Median reply speed  |
| ----------------------------------------------------------- | ---------------------------------- | -------------------- | ---------------- | ----------- | ------------------------------- | ------------------- |
| Qwen3 0.6B                                                  | 27.1 s (397 MB) / 9.1 s            | 2 of 5               | 2 of 5           | 2 of 5      | 35.6 s                          | 7.9 tokens a second |
| Qwen3 1.7B                                                  | 66.5 s (1.1 GB) / 15.8 s           | 5 of 5               | 5 of 5           | 5 of 5      | 136.7 s                         | 4.5 tokens a second |
| Qwen3 1.7B, 0.1.1, 18 Nov 2026, each question in a new chat | 57.2 s (1.1 GB) / 11.7 s           | 4 of 5               | 4 of 5           | 5 of 5      | 28.0 s (first question 138.8 s) | 6.2 tokens a second |
| Qwen3.5 2B                                                  | 77.0 s (1.3 GB) / 19.9 s           | 2 of 5               | 3 of 5           | 5 of 5      | 187.6 s                         | 4.1 tokens a second |

The reply speed is the median of the speeds llama.cpp reported over all steps of the five questions.

### Chrome's built-in model

Hardware: Windows 10 (build 10.0.26300), real Google Chrome 157.0.8103.52; the report does not
record the processor, graphics card or memory. Run of 15 Nov 2026, after the tool-use change:
`docs/eval/EVAL-NANO-2026-11-15-157.0.8103.52.json`. Command: `npm run eval:nano` (from WSL:
`npm run eval:nano:win`).

| Node      | A tool used | Whole sequence right | Fact in the answer | Answer time                   |
| --------- | ----------- | -------------------- | ------------------ | ----------------------------- |
| Test node | 5 of 5      | 4 of 5               | 3 of 5             | 17.8 to 36.0 s, median 19.0 s |
| Live node | 5 of 5      | 4 of 5               | not scored         | 24.2 to 36.3 s, median 30.6 s |

Start took 14 s the first time in the run and 3.1 s the second time; the first download from the
click took 300 s in the run of 14 Nov ([EVAL.md](EVAL.md)).

Chrome's built-in model test: measured on a real computer on 15 Nov 2026 (Chrome 157, Windows): the
model used a tool in 5 of 5 questions on the test node and in 5 of 5 on the live node, the whole
expected sequence in 4 of 5 on each,
and an answer took 18 to 36 s. It stays optional.

### Your own server, or a remote service (chat endpoint)

Five questions on the test node through the real endpoint code, in Node (no browser), on 14 Nov 2026.
Hardware of the computer that ran the local server: not recorded. Command (the key is read from the
environment, never printed):
`WEBAIASSIST_ENDPOINT_URL=<address> WEBAIASSIST_ENDPOINT_MODEL=<name> npm run eval:endpoint`.

| Endpoint                                                                                                                               | Whole sequence right                          | Median answer | Price returned for the five questions |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------- | ------------------------------------- |
| Ollama on `localhost:11434`, `gemma3:4b`                                                                                               | 4 of 5                                        | 7.8 s         | none (local)                          |
| OpenRouter, `meta-llama/llama-3.1-8b-instruct`                                                                                         | 3 of 5                                        | 3.6 s         | 0.0003 USD                            |
| Three larger hosted models through OpenRouter (names in `docs/eval/EVAL-ENDPOINT-openrouter.ai-*.json`), run after the tool-use change | 4 to 5 of 5; a valid tool path in 5 of 5 each | 6.3 to 16.4 s | 0.02 to 0.16 USD                      |

A remote service receives the questions, the page's tool list, tool results and any page text read.

## How the counts were made

The test in `test/security-review/docs-review.test.ts` ("the store description does not repeat a word
more than five times") reads the quote block after **Description:**, lower-cases it, splits it into
words and leaves out a fixed list of function words ("a", "the", "and", "you", "no", "what" and
similar). Every other word is counted as written. Run it with `npx vitest run
test/security-review/docs-review.test.ts`.

## Images

**Images** (sizes from <https://developer.chrome.com/docs/webstore/images>, read 12 Nov 2026):

| Image                       | Size       | What it shows                                                                                                                                                           |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store icon                  | 128 × 128  | `static/icons/icon-128.png` (96 × 96 artwork with 16 px padding, as the store asks)                                                                                     |
| Screenshot 1                | 1280 × 800 | `docs/store/screenshot-1-node-answer-1280x800.png`: a node page with the panel open, "10 WebMCP tools", the card and an answer of Chrome's built-in model               |
| Screenshot 2                | 1280 × 800 | `docs/store/screenshot-2-site-tools-question-1280x800.png`: the question "Use the tools of this site?" (Deny, Allow for this session) over the tool list with its marks |
| Screenshot 3                | 1280 × 800 | `docs/store/screenshot-3-question-before-a-call-1280x800.png`: the question before a call (tool, site, arguments, Deny and Allow once)                                  |
| Screenshot 4                | 1280 × 800 | `docs/store/screenshot-4-another-site-tool-call-1280x800.png`: a public WebMCP demo page (flight search), 4 tools and a tool call, with a chat endpoint                 |
| Screenshot 5                | 1280 × 800 | `docs/store/screenshot-5-answer-with-sources-1280x800.png`: an answer built from the node's tools, with what the site publishes listed above it                         |
| Small promo tile (optional) | 440 × 280  | The icon and the name on a plain background (`docs/store/promo-small-440x280.png`)                                                                                      |

The five files are from the maintainer's hand test of 16 Nov 2026 (Chrome 157, Windows), scaled to 1280 × 800
with the browser's tab column cut off. To retake: a normal Chrome window, no personal tabs, bookmarks or
account picture visible. `npm run screenshots` makes headless stand-ins in `docs/eval/screenshots/`
with the suffix `-headless`; they show the design but not a real model, so the store images are the
ones from a real run.

## Privacy tab

**Single purpose:**

> A side-panel assistant that answers questions about the open web page with a local AI model,
> using the page's own WebMCP tools after the user allows each call.

**Permission justifications:**

| Permission                                                                       | Justification                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidePanel`                                                                      | The chat is shown in the browser side panel.                                                                                                                                                                                                                                                                                                                                                                                  |
| `offscreen`                                                                      | One hidden extension page starts a Worker that runs the local AI model (with WebGPU, or on the processor with WebAssembly), so the model keeps running when the panel closes (reason `WORKERS`).                                                                                                                                                                                                                              |
| `storage`                                                                        | Keeps the Options and the list of sites the user allowed in `chrome.storage.local`, and the sites allowed in this browser session in `chrome.storage.session`.                                                                                                                                                                                                                                                                |
| `activeTab`                                                                      | After the user clicks the toolbar button, the extension reads the open tab's WebMCP tools, or its text when the user presses "Read this page".                                                                                                                                                                                                                                                                                |
| `scripting`                                                                      | Adds the two small scripts that list and call the page's WebMCP tools, reads the page text on request, and registers the polyfill in compat mode; and, for a site the user allowed, reads that site's own public files (`llms.txt`, `robots.txt`, `security.txt` and a few well-known files) with a plain same-origin GET and no cookies, and the page's own title and structured data. No new permission is needed for this. |
| Optional host access (`https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`) | Never granted at install. Asked for one site when the user presses Allow in the side panel for that site, turns on compat mode for it, or saves a chat endpoint address (for example Ollama on localhost); the endpoint's host is used for the chat only.                                                                                                                                                                     |

**Remote code:** No, I am not using remote code. The JavaScript and the two WebAssembly files (the
llama.cpp engine that runs the models, and the Oxigraph query engine) are inside the package. The
extension downloads model weights (data files) from huggingface.co; they are not code.

**Data usage:** declare "Website content": the page text the user asks it to read and the results of
the tools the user allows go to the model the user chose. That model is in the browser or in Chrome
unless the user sets up a remote chat endpoint; then they go to the address the user entered, together with the questions the user types and the API key
the user saved for that address. Nothing is sent to the developer. Tick all three certifications (no sale of data, no use unrelated to the single purpose, no use
for creditworthiness or lending).

**Website content (disclosure):** the extension reads the open page's WebMCP tools, a short list of
the site's public files and, when the user presses "Read this page", the page text. It uses them only
to answer the user's question, shows them to the user, and passes them only to the model the user
chose: in this browser, in Chrome, or at the chat address the user set. It does not sell them, does
not use them for advertising or credit decisions, and does not send them to the developer. What
leaves the computer, and when, is in the privacy policy and in
[WHAT-THE-EXTENSION-READS.md](WHAT-THE-EXTENSION-READS.md).

**Privacy policy URL:** `https://agenticsystemcore.com/webaiassist/privacy/`: the public page that mirrors `docs/PRIVACY.md`,
`https://agenticsystemcore.com/webaiassist/privacy/`. It must be live before the submission; it carries the
Limited Use statement the store asks for.

## Test instructions tab

> 0. Turn on WebMCP in Chrome: open `chrome://flags/#enable-webmcp-testing`, choose Enabled and
>    relaunch. Without it, no site shows tools.
> 1. Click the toolbar button to open the side panel and press Start. The panel shows the size
>    and the source of the model and waits for Download; the model then downloads once from
>    huggingface.co (1.1 GB for the default, Qwen3 1.7B; 397 MB for the smallest, Qwen3 0.6B).
> 2. Open `https://agenticsystemcore.com/concepts/harness/` (a page that offers WebMCP tools) and ask "Find items about review".
>    The panel asks to use the site's tools, then asks before each tool call.
> 3. On a page without WebMCP, press "Read this page" and ask about it.
>    Without WebGPU, choose "Qwen3 0.6B on the processor" in the model list (a 397 MB download,
>    Chrome 137 or newer), or "Chrome's built-in model" when Chrome offers it.
