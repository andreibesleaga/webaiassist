# Chrome Web Store listing

The text and images for the WebAIAssist listing. Each quote block is the content of one field:
paste it without the leading `>` and without the angle brackets around links.

## To be filled after the final runs

Nothing below is guessed. These items stay open until the runs are done and recorded in
`docs/eval/`:

- [ ] **The default-model line.** The listing does not say which model starts first, because the
      final choice is made from the final runs (graphics card, processor, Chrome's built-in model).
- [ ] **The graphics-card numbers.** The table "In the browser, on the graphics card" has only one
      model measured (Qwen3 0.6B, before the tool-use change). Llama 3.2 3B lost the graphics device
      on its first question. Qwen3.5 2B and Gemma 4 E2B have not run on a graphics card. Command:
      `npm run eval:gpu -- --models qwen,llama,qwen35,gemma4` (from WSL: `npm run eval:gpu:win`).
- [ ] **The built-in model re-run** after the last change: `npm run eval:nano`.
- [ ] **Placeholders**: `<STORE-LINK>`, `<PRIVACY-POLICY-URL>`, `<DEMO-NODE-URL>`.
- [ ] **Screenshot 1** from a real run (see Images).

## Store listing tab

**Name:** WebAIAssist

**Summary** (the manifest description, 116 of 132 characters):

> A local AI model in your side panel that uses the WebMCP tools of the open page. Works with AgenticSystemCore nodes.

**Category:** Productivity, then the closest sub-category the dashboard offers for tools.

**Language:** English

**Description:**

> WebAIAssist puts an AI inside your browser's side panel, with no server to install, and lets it use the tools a web page offers. Before any call runs, you see what it will do and press Allow once or Deny.
>
> The AI runs on your computer: on the graphics card, on the processor, or as Chrome's own built-in one. What you type stays here, unless you set up a chat server yourself; then it goes to that address and nowhere else.
>
> Sites can offer tools through WebMCP, a draft that lets a page describe what it can do, such as a search or a form. WebAIAssist lists them with what each does and whether it only reads. For each call you see the name, the site and the exact arguments.
>
> It also reads what a site publishes about itself: llms.txt, a knowledge link set, robots.txt, security.txt and a few other files. The panel shows them. A site that asks for no AI input gets no text sent. For a node of the AgenticSystemCore project, a card shows its version and graph, and you can run read-only SPARQL queries over it.
>
> Before you start:
>
> - Chrome keeps WebMCP behind a switch. Open chrome://flags/#enable-webmcp-testing, choose Enabled and relaunch. Without it, sites' tools do not appear.
> - WebMCP is a draft of 13 Nov 2026, not a W3C Standard. It may change.
> - Needs Chrome or another Chromium browser. The first start downloads 350 MB to 2.8 GB, after you agree.
> - Answers can be wrong. Small models often miss the right tool, so check what matters.
>
> No account, no analytics. No access to any site at install; you allow one site at a time.
>
> Works with AgenticSystemCore, by the same author. Open source, Apache-2.0: <https://github.com/andreibesleaga/webaiassist>

**Word counts of the description.** 293 words. After function words are left out, the most used
words are: site 5, tools 3, WebMCP 3, AI 3, Chrome 3, WebAIAssist 3, server 2, panel 2. The word
"model" is used once ("models" once more; it was used 11 times in the earlier text). The test
`test/security-review/docs-review.test.ts` fails when any word is used more than five times.

## Measured results

Every number below is in a file of `docs/eval/` or in [EVAL.md](EVAL.md). One run of five questions
shows a direction, not a rate. "Test node" is a local copy of the ten tools of an
AgenticSystemCore node; "live node" is agenticsystemcore.com on the day. "Whole sequence right" means
the tools called, in order, equal the expected ones. "A tool used" counts questions where any tool was
called. Small models miss the right tool; the tables say how often.

### In the browser, on the graphics card

Hardware: Windows 10 (build 10.0.26300), AMD gcn-5 laptop GPU, Chromium 156.0.8078.4 (run of
14 Nov 2026, `docs/eval/EVAL-2026-11-14-156.0.8078.4.json`). This run is from before the tool-use
change. Command: `npm run eval:gpu`.

| Model        | Test node: whole sequence right                               | Live node: whole sequence right   | Median answer, test node / live node | Median first token, test node / live node |
| ------------ | ------------------------------------------------------------- | --------------------------------- | ------------------------------------ | ----------------------------------------- |
| Qwen3 0.6B   | 2 of 5                                                        | 0 of 5                            | 17.5 s / 38.9 s                      | 8.8 s / 21.7 s                            |
| Llama 3.2 3B | Lost the graphics device on its first question; 5 errors of 5 | Same                              | not measured                         | not measured                              |
| Qwen3.5 2B   | to be filled after the final runs                             | to be filled after the final runs | to be filled after the final runs    | to be filled after the final runs         |
| Gemma 4 E2B  | to be filled after the final runs                             | to be filled after the final runs | to be filled after the final runs    | to be filled after the final runs         |

### In the browser, on the processor and memory

Hardware: 16 cores (8 threads used), Linux under WSL2, headless Chromium 156.0.8078.4; memory not
recorded. Test node, five questions, after the tool-use change
(`docs/eval/EVAL-CPU-<model>-P1-AFTER-2026-11-14.json`). Command:
`npm run eval:cpu -- --model 0.6b --prompts 5` (also `--model 1.7b` and `--model qwen35-2b`).

| Model      | Load, first download / stored copy | Whole sequence right | First tool right | A tool used | Median answer | Median reply speed  |
| ---------- | ---------------------------------- | -------------------- | ---------------- | ----------- | ------------- | ------------------- |
| Qwen3 0.6B | 27.1 s (397 MB) / 9.1 s            | 2 of 5               | 2 of 5           | 2 of 5      | 35.6 s        | 7.9 tokens a second |
| Qwen3 1.7B | 66.5 s (1.1 GB) / 15.8 s           | 5 of 5               | 5 of 5           | 5 of 5      | 136.7 s       | 4.5 tokens a second |
| Qwen3.5 2B | 77.0 s (1.3 GB) / 19.9 s           | 2 of 5               | 3 of 5           | 5 of 5      | 187.6 s       | 4.1 tokens a second |

The reply speed is the median of the speeds llama.cpp reported over all steps of the five questions.

### Chrome's built-in model

Hardware: Windows 10 (build 10.0.26300), real Google Chrome 157.0.8103.52; the report does not
record the processor, graphics card or memory. Report:
`docs/eval/EVAL-NANO-2026-11-14-157.0.8103.52.json`. Command: `npm run eval:nano` (from WSL:
`npm run eval:nano:win`).

| Node      | A tool used | Whole sequence right | Fact in the answer | Answer time                   |
| --------- | ----------- | -------------------- | ------------------ | ----------------------------- |
| Test node | 5 of 5      | 4 of 5               | 5 of 5             | 15.3 to 31.3 s, median 17.9 s |
| Live node | 1 of 5      | 1 of 5               | not scored         | 17.2 to 42.0 s, median 21.8 s |

Start took 14.4 s the first time in the run and 3.1 s the second time; the first download from the
click took 300 s ([EVAL.md](EVAL.md)).

Chrome's built-in model test: measured on a real computer on 14 Nov 2026 (Chrome 157, Windows): the
model used a tool in 5 of 5 questions on the test node and in 1 of 5 on the live node, and an answer
took 15 to 42 s. It stays optional.

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

| Image                       | Size       | What it shows                                                                                                              |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Store icon                  | 128 × 128  | `static/icons/icon-128.png` (96 × 96 artwork with 16 px padding, as the store asks)                                        |
| Screenshot 1                | 1280 × 800 | The confirmation (tool, site, arguments, Allow once and Deny) over an AgenticSystemCore node page, with the answer visible |
| Screenshot 2                | 1280 × 800 | A node page with the side panel open: the card, a question and the answer that used a tool                                 |
| Screenshot 3                | 1280 × 800 | The panel during the first start, with the download size and source and the progress bar                                   |
| Screenshot 4 (optional)     | 1280 × 800 | The Options page                                                                                                           |
| Small promo tile (optional) | 440 × 280  | The icon and the name on a plain background (`docs/store/promo-small-440x280.png`)                                         |

Capture the screenshots in a normal Chrome window at 1280 × 800, with no personal tabs, bookmarks or
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
| `storage`                                                                        | Keeps the Options in `chrome.storage.local`, and the sites the user allowed in this browser session in `chrome.storage.session`.                                                                                                                                                                                                                                                                                              |
| `activeTab`                                                                      | After the user clicks the toolbar button, the extension reads the open tab's WebMCP tools, or its text when the user presses "Read this page".                                                                                                                                                                                                                                                                                |
| `scripting`                                                                      | Adds the two small scripts that list and call the page's WebMCP tools, reads the page text on request, and registers the polyfill in compat mode; and, for a site the user allowed, reads that site's own public files (`llms.txt`, `robots.txt`, `security.txt` and a few well-known files) with a plain same-origin GET and no cookies, and the page's own title and structured data. No new permission is needed for this. |
| Optional host access (`https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`) | Never granted at install. Asked for one site when the user presses Allow in the side panel for that site, turns on compat mode for it, or saves a chat endpoint address (for example Ollama on localhost).                                                                                                                                                                                                                    |

**Remote code:** No, I am not using remote code. The JavaScript and the WebAssembly model
libraries are all inside the package. The extension downloads model weights (data files) from
huggingface.co; they are not code.

**Data usage:** the extension collects none of the listed data types. Page content and chat are
handled on the user's computer and are not sent to the developer or any third party. When the
user sets a chat endpoint, the conversation goes only to the address the user entered.
Tick all three certifications (no sale of data, no use unrelated to the single purpose, no use
for creditworthiness or lending).

**Website content (disclosure):** the extension reads the open page's WebMCP tools, a short list of
the site's public files and, when the user presses "Read this page", the page text. It uses them only
to answer the user's question, shows them to the user, and passes them only to the model the user
chose: in this browser, in Chrome, or at the chat address the user set. It does not sell them, does
not use them for advertising or credit decisions, and does not send them to the developer. What
leaves the computer, and when, is in the privacy policy and in
[WHAT-THE-EXTENSION-READS.md](WHAT-THE-EXTENSION-READS.md).

**Privacy policy URL:** `<PRIVACY-POLICY-URL>`: the public link to `docs/PRIVACY.md` in the
repository, for example
`https://github.com/andreibesleaga/webaiassist/blob/main/docs/PRIVACY.md`.

## Test instructions tab

> 0. Turn on WebMCP in Chrome: open `chrome://flags/#enable-webmcp-testing`, choose Enabled and
>    relaunch. Without it, no site shows tools.
> 1. Click the toolbar button to open the side panel and press Start. The panel shows the size
>    and the source of the model and waits for Download; the model then downloads once from
>    huggingface.co (about 350 MB for the smallest).
> 2. Open `<DEMO-NODE-URL>` (a page that offers WebMCP tools) and ask "Find items about review".
>    The panel asks to use the site's tools, then asks before each tool call.
> 3. On a page without WebMCP, press "Read this page" and ask about it.
>    Without WebGPU, choose "Qwen3 0.6B on the processor" in the model list (a 397 MB download,
>    Chrome 137 or newer), or "Chrome's built-in model" when Chrome offers it.
