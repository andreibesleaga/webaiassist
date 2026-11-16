# Manual checks

Some behaviour cannot be proved by the automated tests: it needs a real browser, a graphics card,
Chrome's own model, a screen reader or a live website. Each check below is a scenario of
`features/` with a tag that says what it needs. [SCENARIOS.md](SCENARIOS.md) lists every scenario
and its tag. Everything not listed here is run by `npm test`, `npm run test:smoke` or
`npm run test:bdd`.

Run the checks on the build you will publish: `npm run build`, then load the `dist/` folder as an
unpacked extension (`chrome://extensions`, turn on **Developer mode**, **Load unpacked**). Use a
normal Chrome window with a fresh profile, or at least no other extension that changes pages.
Note the Chrome version, the operating system and the result of each check in the evaluation log
([EVAL.md](EVAL.md)).

| Tag       | Needs                                                                          | Scenarios                                            |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `@gpu`    | A computer with WebGPU                                                         | F02.7, F02.33                                        |
| `@cpu`    | The real processor model (a 397 MB download); the browser tests use a stand-in | F02.6 (real part), F02.28, F02.34, F18.2 (real part) |
| `@nano`   | Official Google Chrome with its built-in model                                 | F02.8                                                |
| `@manual` | A person, a store listing, a live site, a screen reader or a network log       | F01.8, F10.17, F11.8, F16.10, F17.6, F19.5, F23.7    |

## `@gpu`: the graphics card model answers (F02.7)

Needs: Chrome 126 or newer with WebGPU (`chrome://gpu` shows "WebGPU: Hardware accelerated").

1. Open any page that offers WebMCP tools (the AgenticSystemCore node page, or a local page that
   calls `document.modelContext.registerTool`). Click the toolbar button, press **Allow**.
2. In the model list choose **Qwen3 0.6B** (graphics card; the same check for **Qwen3.5 2B** and, on a card with shader-f16, **Gemma 4 E2B**). Press **Start**. Agree to the download
   when the panel shows its size and source.
3. Expected: the progress bar moves; the line reads "Ready: ... Running in this browser, on your graphics card (in the offscreen
   document)". The first answer after a load can take up to a minute while the GPU programs
   compile; the panel says so.
4. Ask "What can I do here?". Expected: an answer that names a tool of the page.
5. Ask for something that needs a tool. Expected: a question "Run the tool ...?" with the site, the
   tool and its arguments; after **Allow once** the result appears and the answer uses it.
6. `npm run eval:gpu` (or `npm run eval:gpu:win` from WSL) runs 20 prompts and writes
   `docs/eval/EVAL-*.json`. It opens browser windows, so run it when the computer is free.

## `@cpu`: the processor model (F02.6, F02.28, F18.2)

The browser tests run the real runtime on a stand-in engine. The real model is checked by:

1. `npm run eval:cpu` (downloads 397 MB once; it opens no window; `-- --model 1.7b` or `-- --model qwen35-2b` runs the other two). Expected: five questions
   answered, speeds written to `docs/eval/EVAL-CPU-*.json`, and a second start of the browser on
   the same profile is ready with no download.
2. By hand: in the model list choose **Qwen3 0.6B on the processor**, press **Start**, agree to
   the download. Expected: "Ready: ... Running in this browser, on your processor and memory". Ask a question: the
   first answer takes about 40 seconds on 8 threads, later ones are faster.
3. F18.2 (real model): with the model ready, open `chrome://serviceworker-internals`, find the
   WebAIAssist worker and press **Stop**. Ask a question. Expected: an answer, no new download,
   the chat before the stop still shown.
4. On a computer with no usable WebGPU the panel offers the processor model in one click and
   says why it selected it.

## `@nano`: Chrome's built-in model (F02.8)

Needs: official Google Chrome (not Chromium, not Edge) on Windows, macOS or Linux, with the disk
space and graphics memory Chrome's page asks for
(<https://developer.chrome.com/docs/ai/prompt-api>).

1. Open `chrome://on-device-internals` and keep it open to watch the download.
2. In the side panel's DevTools console run
   `await LanguageModel.availability({expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]})`.
   Expected: `downloadable`, `downloading` or `available`. `unavailable` means Chrome refuses this
   computer: the panel then shows what Chrome reports; copy that text as the result.
3. Choose **Chrome's built-in model** and press **Start**. If Chrome must download, the line says
   so, the bar moves, and **Cancel** stops it (press **Start** again to continue).
4. Expected: "Ready: Chrome's built-in model". Ask a question. Expected: an answer with no
   "The model gave no valid action" line; a tool question goes through the confirmation.
5. Record the result in the README ("Chrome's built-in model test") and in
   [STORE-LISTING.md](STORE-LISTING.md); both must say what was found.

## `@manual`

### F01.8: the store install asks only for the listed permissions

1. Open the store listing (or the uploaded draft) and press **Add to Chrome**.
2. Expected: Chrome's dialog names only the permissions of
   [STORE-LISTING.md](STORE-LISTING.md): the side panel, the offscreen document, storage, the
   active tab and scripting. No access to any website is asked at install.

### F10.17: a live site's published files are found (R4-14)

1. Open `https://agenticsystemcore.com/specs/agentic-knowledge/` (or another site that publishes
   `llms.txt`, a knowledge link set and `security.txt`). Click the toolbar button, press **Allow**.
2. Expected within a few seconds: the card shows a chip for each file the site serves (for
   example "knowledge links", "llms.txt", "security.txt", "AI policy"), the node badge on a node,
   and the training note when the site states one.
3. Open DevTools on the page, Network tab: the file requests go to the site only, have no cookie
   and no referrer.
4. Record what the site served and what the card showed. This is a record, not a pass or fail
   test: a site may change its files.

### F11.8: a question on a live node uses its tools and knowledge (R4-14)

1. On the page of F10.17, with a model ready, ask "What can I do here?".
2. Expected: an answer that names tools of the node (for example `search` and `read`) and links
   from its knowledge. A tool question asks before it runs.

### F16.10: a screen reader announces the panel once

Needs NVDA (Windows) or VoiceOver (macOS).

1. Open the side panel with the screen reader running. Switch to another tab, press **Start**,
   ask a question.
2. Expected: the page status, the model status and each answer are read once each; the draft of an
   answer being written is not read word by word; a download is announced every ten percent.
3. Record the reader, its version and the browser.

### F17.6: a full session contacts only the listed hosts

1. Open `chrome://extensions`, turn on Developer mode, open the extension's **service worker**
   inspector and, from `chrome://inspect/#other`, the **offscreen document** inspector. Open the
   Network tab in both and tick **Preserve log**.
2. Download a model, ask three questions (one with a tool), then remove the model in Options.
3. Expected: only the hosts of [PRIVACY.md](PRIVACY.md) appear (`huggingface.co` and its download
   network `*.hf.co`, the endpoint you set if any, the open site for tools you allowed).

### F19.5: compat mode makes a page's tools appear

Use a browser or profile where `document.modelContext` does not exist (an older Chrome, or Chrome
with WebMCP off), and serve this page from `localhost` or `https`:

```html
<!doctype html>
<title>Polyfill test</title>
<script>
  if (document.modelContext) {
    document.modelContext.registerTool({
      name: 'ping',
      description: 'Return pong.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => 'pong',
    });
  }
</script>
```

1. Open the page, click the toolbar button. Expected: "No WebMCP tools".
2. Press **Add WebMCP to this site**, accept Chrome's site-access question, reload the page.
3. Expected: the card says one WebMCP tool; **Tools** lists `ping`. Ask the model to call it.
4. Press **Forget this site**. Expected: after a reload the page has no tools again.

### F25.12: the keyboard shortcut opens the panel

1. Install the build in Chrome, open any web page, press Alt+Shift+A.
2. Expected: the side panel opens and the card reads the page (the same as a toolbar click). If
   nothing happens, look at `chrome://extensions/shortcuts`: another extension may hold the key.

### F21.17: the explorer draws the two live nodes

1. Run `node scripts/check-live-graph.mjs` (needs the network; it reads both nodes with a browser
   User-Agent). Expected: for each node "digest verified", one connected piece, and the chip numbers 17
   (agenticsystemcore.com) and 70 (patterns.agenticsystemcore.com).
2. Open `https://agenticsystemcore.com/`, allow WebAIAssist on it (toolbar button), press **Graph: 17 items**.
   Expected: a tab with the picture of `https://agenticsystemcore.com/graph/` (same colours, legend, list,
   detail panel); the "Other nodes" block lists `patterns.agenticsystemcore.com`, unticked, and nothing was
   requested from it (DevTools, Network of the explorer tab).
3. Tick it and press **Read the ticked nodes**. Expected: two nodes read, the two graphs drawn together,
   and only `/.well-known/knowledge-linkset` and `/graph.jsonld` of the second node requested.
4. On `https://patterns.agenticsystemcore.com/` the chip says **Graph: 70 items**; the graph is one connected piece
   with no loose vocabulary node.

### F23.7: the conformance page and the extension in real Google Chrome

Needs Google Chrome 157 or later (the maintainer's Windows computer, from WSL).

1. `npm run eval:conformance:win -- --extension --demos`.
2. Expected: exit code 0 and the report `docs/eval/EVAL-CONFORMANCE-<date>-<chrome>.json` with
   no `fail` in the browser stage, every step of the extension stage as expected, and one row per
   demo page (tools found, listed by the panel, one read-only call asked first).
3. Record the Chrome version and file the report next to the Chromium 156 results.

## When a check fails

Write down the check id, Chrome version, operating system, what the panel said (copy the whole
line) and what you expected. A failure of a `@manual` check is a bug until shown otherwise; fix the
cause, add an automated test where one is possible, and run the check again.
