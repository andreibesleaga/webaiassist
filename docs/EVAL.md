# Evaluation

How well each shipped model picks the right tool with the right arguments on an
AgenticSystemCore node, measured by one command on a computer with a GPU. The tests in CI use a
scripted model and cannot measure this.

## What is measured for each model path

| Path                    | Measured by                                               | State on 16 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graphics card           | `npm run eval:gpu` on the maintainer's laptop (AMD gcn-5) | Run of 16 Nov, 10 questions per page: Qwen3 0.6B used a tool on 10 of 10 test questions, the right one on 8, about 19 s to the first token; on the live node the right tool on 2 of 10. Qwen3.5 2B: the right tool on 6 of 10, 2 to 5 minutes per answer, 3 over the 5-minute limit. Llama 3.2 3B and Gemma 4 E2B loaded and then ran past the limit on their first question, which also stopped that browser. See the results block below. |
| Processor and memory    | `npm run eval:cpu`, headless Chromium on 16 cores         | Three models, five prompts (three for Qwen3 1.7B): see "The processor model".                                                                                                                                                                                                                                                                                                                                                               |
| Chrome's built-in model | `npm run eval:nano` in real Chrome 157 on Windows         | Run of 15 Nov, after the profile used for earlier builds was replaced (in it the panel showed no tools at all): a tool used on 10 of 10 questions, the right one on 8 (5 of 5 on the test node, 3 of 5 on the live node); 7 to 36 s per answer; start 14 s, later starts 3 s. Report: `docs/eval/EVAL-NANO-2026-11-15-157.0.8103.52.json`.                                                                                                  |
| Chat endpoint           | Unit and browser tests against a fake server              | No run against a real Ollama or LM Studio is recorded.                                                                                                                                                                                                                                                                                                                                                                                      |

## Run

1. On the GPU machine: `npm ci`, `npx playwright install chromium`, then `npm run eval:gpu`
   (Playwright's Chromium, visible window: Google Chrome and Edge no longer accept the flags that
   side-load an unpacked extension, so the eval cannot run in them; the extension itself does).
   From WSL, `npm run eval:gpu:win` runs it on the Windows side, installs that Chromium there, and
   copies the report back.
2. It builds `dist-eval/` (the extension plus install-time access to `localhost`, `127.0.0.1` and
   `agenticsystemcore.com`), starts each model (by default Qwen3 0.6B and Llama 3.2 3B; Qwen3.5 2B
   and Gemma 4 E2B with `--models`) and asks the prompts.
3. Every prompt runs in a fresh panel, on a local stub of the ten AgenticSystemCore tools and,
   unless `--no-live`, on the live node. Each confirmation question is allowed and recorded.
4. Options: `--models qwen,llama` (the default; the others are `qwen35` for Qwen3.5 2B and
   `gemma4` for Gemma 4 E2B, which needs a graphics card with `shader-f16`), `--prompts 20`, `--idle 10` (minutes), `--headless`,
   `--no-live`, `--fresh-profile` (forget cached models), `--scripted` (flow check, no GPU),
   `--no-cancel-check` (skip the Cancel-during-download check, to see its effect on the GPU alone).
5. Output: `docs/eval/EVAL-<date>-<chrome>.json`, four screenshots in `docs/eval/screenshots/`,
   and the results block below. Exit code 2 means the panel found no WebGPU adapter.
6. Do by hand what a program cannot see: Edge, Brave, Opera and Vivaldi sideload, a screen
   reader, and Chrome's own site-access request from the toolbar.

## The processor model

`npm run eval:cpu` is the same idea for the CPU runtime: Playwright's headless Chromium with the
eval build, the real llama.cpp engine and the real default model (Qwen3 0.6B, 397 MB, downloaded
from Hugging Face on the first run, so it needs the network and is not part of the gate;
`-- --model 1.7b` or `-- --model qwen35-2b` runs the other two). It
asks the first five prompts on the stub node through the panel and allows every question, then
starts the browser again on the same profile to measure the start from the stored copy. The
report is `docs/eval/EVAL-CPU-<model>-<date>.json`: load time, the progress texts (a download or not),
and per prompt the answer, the tools called, the total time, and the speed of the prompt and of
the reply that llama.cpp reports. The speed lines come from a timing record the engine keeps in
`localStorage` in the smoke and eval builds only. `WEBAIASSIST_EVAL_PROFILE` keeps the browser
profile in a folder you choose, so the model can stay downloaded between runs.

Result of the first runs (14 Nov 2026, Chromium 156, 16 cores, 8 threads, stub node):

| Model      | Load from download | Load from the stored copy | Reply speed     | Prompt speed  | Tool called right (of 5, 3)                                                  |
| ---------- | ------------------ | ------------------------- | --------------- | ------------- | ---------------------------------------------------------------------------- |
| Qwen3 0.6B | 35.6 s (397 MB)    | 7.7 s                     | 10.5-11.3 tok/s | 18-24 tok/s   | 0 of 5 (answered directly)                                                   |
| Qwen3 1.7B | 60.9 s (1.1 GB)    | 14.4 s                    | 5.4-5.9 tok/s   | 8.3-9.8 tok/s | 2 of 3 (`ask`, `search`, `search`; the expected were `ask`, `ask`, `search`) |

Cancel during the download answered in 43 ms and left no file in the cache. The first question
sends about 900 tokens (rules and the ten tool descriptions); later questions of the same chat
reuse that part (45 to 70 new tokens). Temperature 0.2 instead of 0.7 changed nothing for the
0.6B model (five of five answered without a tool). The answers of the 0.6B model name items the
page does not have, because it never asked the page.

Qwen3.5 2B (14 Nov 2026, same machine and settings, `npm run eval:cpu -- --model qwen35-2b`,
report `docs/eval/EVAL-CPU-qwen35-2b-2026-11-14.json`): it loads with the 4096-token window and
answers all five prompts.

| Model      | Load from download | Load from the stored copy | Reply speed   | Prompt speed  | Time to answer a question |
| ---------- | ------------------ | ------------------------- | ------------- | ------------- | ------------------------- |
| Qwen3.5 2B | 85.8 s (1.3 GB)    | 19.4 s                    | 3.1-4.7 tok/s | 5.1-7.2 tok/s | 153-256 s                 |

- Tool called right: by the scorer's exact match (the tools called, in order, equal the expected
  ones) 0 of 5, because every question also called `read` after its first tool. The first tool was
  the expected one in 4 of 5 (`ask`, `ask`, `search`, `search`; the fifth expected `search` and
  called `ask`). The confirmation question was shown before every call (5 of 5), the expected fact
  was in the answer (5 of 5), no tool the page does not offer was named, and one call was
  refused as a repeat (prompt 1).
- Tokens the first question of each prompt sent, counted by llama.cpp: 783 to 1,278 of the 4,096
  (954, 949, 783, 1,033, 1,278); later steps of a question added 89 to 123 tokens.
- It is about twice as slow as Qwen3 1.7B (reply 5.4-5.9 tok/s, 47 to 116 s a question); the
  panel's label says "slower than Qwen3 1.7B". Cancel during the download answered in 77 ms and
  left no file. One sample of the browser's main process while the model was in memory showed
  1.7 GB resident (`top`), which is the memory the label gives.

## The 4,096-token window

Every listed model runs with a window of 4,096 tokens (WebLLM's record for the four graphics-card
models, `CPU_CAPABILITIES` for the processor ones). `test/adapters/context-fit.test.ts` builds the
request the loop sends for the live AgenticSystemCore node (the rules and node hint, its ten tools
as the page lists them, the site files the node publishes, the question) with each model's
capabilities and counts it with the loop's own estimate (`estimateTokens`, three Latin characters
a token, which counts high): 1,856 estimated tokens, leaving 1,728 after the 512 kept for the
reply. llama.cpp counted 783 to 1,278 real tokens for the first question on the stub node
(Qwen3.5 2B above; Qwen3 1.7B 915). **Not proved:** a site that fills every piece of site
context to its cap (about 8,900 characters, 2,966 estimated tokens) would bring the same request
to 4,357 estimated tokens, 770 above what fits; the estimate errs high, but the panel does not
shrink the site facts for a 4,096 window (it does for Chrome's built-in model).

## A chat endpoint, local or remote

`npm run eval:endpoint` asks five questions of `docs/eval/prompts.json` through the real
`EndpointRuntime` (streaming on) with the agent loop and the ten tools of the stub node, in Node
(no browser). It reads only these environment variables:

| Variable                       | Meaning                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `WEBAIASSIST_ENDPOINT_URL`     | The address before `/chat/completions`, for example `https://openrouter.ai/api/v1`                                              |
| `WEBAIASSIST_ENDPOINT_MODEL`   | The model name at that service, for example `meta-llama/llama-3.1-8b-instruct`                                                  |
| `WEBAIASSIST_ENDPOINT_KEY`     | The API key. Required for a remote address (the script stops, with no network call, when it is empty); optional for `localhost` |
| `WEBAIASSIST_ENDPOINT_CONTEXT` | Optional context window in tokens (default 8192)                                                                                |

Example with the key kept in a file outside the repository (the key is read into the one command and
never printed; the script removes it from anything it prints):

```bash
WEBAIASSIST_ENDPOINT_KEY=$(grep '^OPENROUTER_API_KEY=' ~/work/.env | cut -d= -f2-) \
WEBAIASSIST_ENDPOINT_URL=https://openrouter.ai/api/v1 \
WEBAIASSIST_ENDPOINT_MODEL=meta-llama/llama-3.1-8b-instruct \
npm run eval:endpoint
```

For each question the report (`docs/eval/EVAL-ENDPOINT-<host>-<date>.json`) holds the tools used (and
whether they are the expected ones), the seconds, the number of model calls and the prompt and
completion tokens and the price the service returned, added up over the question. A paid service
charges for the run: five questions of about 2,000 tokens each cost well under 0.01 USD on a small
model. It is not part of the gate; unit and browser tests use a fake server only.

Ollama needs `OLLAMA_ORIGINS=chrome-extension://*` for the extension; this script runs in Node and
needs no setting.

### Run of 14 Nov 2026

| Endpoint                                       | Tool right | Median answer (s) | Prompt tokens | Completion tokens | Price returned   |
| ---------------------------------------------- | ---------- | ----------------- | ------------- | ----------------- | ---------------- |
| Ollama `localhost:11434`, `gemma3:4b`          | 4 of 5     | 7.8               | 9,492         | 250               | none (local)     |
| OpenRouter, `meta-llama/llama-3.1-8b-instruct` | 3 of 5     | 3.6               | 14,188        | 394               | 0.0003 USD total |

One question per run is a model's choice of tools, not a fault of the endpoint: the small models
picked a different tool than expected on one or two questions, and the OpenRouter model hit the step
limit on question 3 (six tool steps). The reports are `docs/eval/EVAL-ENDPOINT-localhost-2026-11-14.json` and
`docs/eval/EVAL-ENDPOINT-openrouter.ai-2026-11-14.json`.

## Questions

The 20 prompts, their expected tools and facts are in `docs/eval/prompts.json`.

## Scoring

Automatic, per prompt and model: the tools called in order against the expected ones, the
confirmation question before each call, an expected fact in the answer (stub node only), tools the
page does not offer, repeated calls (how many times the loop declined to run a call the model had
already made in that question; the summary counts the prompts with at least one), and the seconds
to the first token and in total. Argument quality is read from the report's rows by hand.

Three tool columns, from strict to loose: "Tool right" (the whole tool sequence equals the expected one), "First tool right" (the first tool equals the first expected one; for a prompt that expects no tool, none was called) and "Tool used" (any tool was called; counted only over prompts that expect a tool). A model that calls `ask` and then `read` for a question that expects `ask` is not "Tool right" but is "First tool right". A fourth column, "Task done", is the one a user cares about: a valid tool path (the expected first tool or another one that `prompts.json` lists under `accept`, every further expected tool, no changing tool that was not asked for), an answer with no error, and, on the test node, the expected fact in the answer. Extra read-only calls do not fail it.

### Tool use before and after the tool-use change (14 Nov 2026, processor, stub node, 5 prompts)

Same five prompts, same machine (`npm run eval:cpu -- --model <key> --prompts 5`), the build
before and after the change that tells the model it cannot see the site and must call a tool
first (CHANGELOG, "The model uses the page's tools"). Reports: `docs/eval/EVAL-CPU-<key>-P1-BEFORE-2026-11-14.json`
and `...-P1-AFTER-...json`. One run of five prompts each: the numbers show a direction, not a rate.

| Model             | Whole sequence right | First tool right | A tool was used | Tool sequences after the change                            |
| ----------------- | -------------------- | ---------------- | --------------- | ---------------------------------------------------------- |
| Qwen3 0.6B before | 0 of 5               | 0 of 5           | 0 of 5          | none in all five                                           |
| Qwen3 0.6B after  | 2 of 5               | 2 of 5           | 2 of 5          | ask; none; none; search; none                              |
| Qwen3 1.7B before | 4 of 5               | 4 of 5           | 5 of 5          | explain; ask; search; search; search                       |
| Qwen3 1.7B after  | 5 of 5               | 5 of 5           | 5 of 5          | ask; ask; search; search; search                           |
| Qwen3.5 2B before | 0 of 5               | 2 of 5           | 2 of 5          | none; none; search, read, brief; search, read, brief; none |
| Qwen3.5 2B after  | 2 of 5               | 3 of 5           | 5 of 5          | search; compose; search; search; search, read, read        |

## Results

<!-- eval-results:start -->

Last run: 2026-11-16, Chrome 156.0.8078.4, win32 10.0.26300; WebGPU adapter: yes; report `docs/eval/EVAL-2026-11-16-156.0.8078.4.json`.

| Model  | Target | Prompts | Tool right | First tool right | Tool used | Task done | Gate shown | Fact in answer | Hallucinated | Errors | Repeated calls | Median first token (s) |
| ------ | ------ | ------- | ---------- | ---------------- | --------- | --------- | ---------- | -------------- | ------------ | ------ | -------------- | ---------------------- |
| qwen   | stub   | 10      | 8          | 9                | 10 of 10  | 5         | 10 of 10   | 6 of 10        | 0            | 0      | 0              | 19.45                  |
| qwen   | live   | 10      | 2          | 2                | 9 of 10   | 2         | 9 of 9     | 0 of 0         | 5            | 0      | 6              | 26.9                   |
| llama  | stub   | 1       | 0          | 0                | 0 of 1    | 0         | 0 of 0     | 0 of 1         | 0            | 1      | 0              | -                      |
| qwen35 | stub   | 10      | 6          | 6                | 10 of 10  | 6         | 10 of 10   | 7 of 10        | 0            | 3      | 0              | 138.65                 |
| qwen35 | live   | 1       | 1          | 1                | 1 of 1    | 0         | 1 of 1     | 0 of 0         | 0            | 1      | 0              | 170.4                  |
| gemma4 | stub   | 1       | 0          | 0                | 0 of 1    | 0         | 0 of 0     | 0 of 1         | 0            | 1      | 0              | -                      |
| gemma4 | live   | 1       | 0          | 0                | 0 of 1    | 0         | 0 of 0     | 0 of 0         | 0            | 1      | 0              | -                      |

| Model  | Ready | Start (s) | Model line after Start                                                                           |
| ------ | ----- | --------- | ------------------------------------------------------------------------------------------------ |
| qwen   | yes   | 4.1       | Ready: Qwen3 0.6B. Running in this browser, on your graphics card (in the offscreen document).   |
| llama  | yes   | 290.8     | Ready: Llama 3.2 3B. Running in this browser, on your graphics card (in the offscreen document). |
| qwen35 | yes   | 10.9      | Ready: Qwen3.5 2B. Running in this browser, on your graphics card (in the offscreen document).   |
| gemma4 | yes   | 21.2      | Ready: Gemma 4 E2B. Running in this browser, on your graphics card (in the offscreen document).  |

| Check                               | Result  | Detail                                                                                                                                                                    |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel stops the download           | pass    | Start usable again after 0 s; left Ready: true; weight requests after 5 s: 0                                                                                              |
| storage.local.setAccessLevel        | pass    | resolved in the service worker                                                                                                                                            |
| Hosts contacted on first Start      | review  | 10 requests seen, none to a host PRIVACY.md does not name; no model download seen (the offscreen document is not visible to Playwright): open DevTools on the first Start |
| Idle 10 min, then a question        | fail    | no answer after the idle wait                                                                                                                                             |
| Corrupted cached library is refused | skipped | no cached .wasm (scripted or library served from the package)                                                                                                             |

<!-- eval-results:end -->

The block above merges three runs of the night of 15 to 16 Nov 2026, one browser each, because a model
that runs past the time limit leaves its browser unable to open the next page: Qwen3 0.6B and Llama
3.2 3B (`EVAL-GPU-2026-11-16-qwen-llama.json`), Qwen3.5 2B (`EVAL-GPU-2026-11-16-qwen35.json`), Gemma 4
E2B (`EVAL-GPU-2026-11-16-gemma4.json`); merged in `EVAL-2026-11-16-156.0.8078.4.json`. A row with 1
question is a model whose browser stopped after its first question. The check "Idle 10 min, then a
question" ran with Qwen3.5 2B, which needs 2 to 5 minutes per answer, so its "fail" is that model's
time limit, not a finding about the idle path; it was not re-run with a faster model.

## When the model fails on a GPU

`node scripts/gpu-check/run.ts [--channel chrome|chromium] [--model <id>] [--words <n>] [--chunk <n>]`
runs WebLLM alone, without the extension: one load, a warm-up question, one question with a prompt
of `--words` filler words, and prints a JSON line per model with the load, warm-up and first-token
seconds (the weights come from WebLLM's own CDN; it is a diagnostic, not the no-remote-code build).
It tells the extension apart from the GPU: on 13 Nov 2026 an AMD gcn-5 laptop GPU lost its device on
every prompt over a few hundred tokens, in Chrome and Chromium alike, until the prefill chunk was
small (`src/adapters/prefill-chunk.ts`, the `--chunk` option here). A GPU on which the warm-up
takes tens of seconds is one on which the first answer takes as long; the panel says so.

On 14 Nov 2026 the same laptop loaded Llama 3.2 3B (16.5 s) and then failed its first question
after 3.7 s with "Object has already been disposed", and every later one with WebLLM's "Model not
loaded" error; Qwen3 0.6B answered on the same run. WebLLM and tvmjs free their objects when the
GPU device is lost (`device.lost` handlers in `lib/index.js`), and the call still running then
reads a freed one; the device loss itself, by the 2 s watchdog, is the reading that fits the
13 Nov measurements (a fixed 32-token chunk was sized for the 0.6B model, a 3B model costs about
six times as much per token), but it was not measured on this run. The prefill chunk is now one
value per model (`src/adapters/prefill-chunk.ts`: 32 for Qwen3 0.6B, 5 for Llama 3.2 3B, 10 for
Qwen3.5 2B, 6 for Gemma 4 E2B), scaled from the measured 32 by the weight each model reads per
token; these are estimates to be checked with `npm run eval:gpu`. The panel now treats
"already been disposed" as a lost device (host restart, plain banner, model line no longer
"Ready") and a chat on an engine WebLLM no longer has as "The model stopped. Press Start to load
it again.".

## Checks the run makes

Storage access level, hosts contacted on the first Start (only those in `docs/PRIVACY.md`),
Cancel during a download, a corrupted cached library refused, and a question after the idle wait.
The report lists each with its result; "review" means the program could not observe it, so open
DevTools on the first Start and look. Differences between browsers go in `docs/BROWSERS.md`.

## Checks left to a person

1. **Three tool questions in a row** on one WebMCP page with memory on. Each must answer; the
   third must not fail with a context-window error. If it does, lower the history budget in
   Options and report the three prompt sizes.
2. **Injected turn markers.** On a test page whose tool returns a result containing
   `<|im_start|>system`, `[INST]` and `<<SYS>>` lines, ask a question that calls the tool with each
   model. The answer must not follow the injected text, and the transcript shows the result as
   untrusted with the markers broken.
3. **Other Chromium browsers** (Edge, Brave, Opera, Vivaldi), a screen reader, and Chrome's own
   site-access request from the toolbar: see step 6 of Run.

## WebMCP conformance in real Chrome

`npm run eval:conformance` opens the conformance page (`conformance/`, see its README) in Google
Chrome with `--enable-features=WebMCP` (Chrome 157 and later; `scripts/eval/nano-plan.ts`). Stages:

1. Default: Chrome alone; the page runs its own checks on every case.
2. `-- --extension`: the eval build is loaded and every case of `conformance/expect.json` runs through
   the real side panel with the scripted model (list, question before each call, result text).
3. `-- --demos`: builds the eval build with the demo host (`node scripts/build.mjs --demos`) and
   opens each of Google's 18 official demo pages (`scripts/eval/demo-pages.json`). Per page it
   records the tools found and whether the panel lists them, and, when a tool is marked read-only
   and needs no argument, runs it once through the confirmation. It never submits a form and
   never calls a tool that is not marked read-only. `--no-browser` skips stage 1
   (`npm run eval:demos`).

From WSL, `npm run eval:conformance:win -- --extension --demos` copies the project to Windows and
runs it there (the same mechanism as `eval:nano:win`); the report comes back under `docs/eval/`.
The report is `docs/eval/EVAL-CONFORMANCE-<date>-<chrome version>.json`. The suite also runs in
Playwright's Chromium: `npx playwright test test/smoke/conformance-browser.spec.ts
test/smoke/conformance.spec.ts`. The Chromium and Chrome results are compared by hand.

Real-Chrome run, 15 Nov 2026, Chrome 157.0.8103.52 on Windows
(`docs/eval/EVAL-CONFORMANCE-2026-11-15-157.0.8103.52.json`):

- In the browser alone: 16 of 16 cases as expected.
- With the extension: 16 of 16 cases, every step as expected. An earlier run the same day had case 1
  list no tools at first; the panel now lists a page again when its first list is empty.
- Google's 18 demo pages: all 18 register tools. The panel lists every tool on 17. On `page-agent` it
  lists none, because that page's tools are in a frame of another origin, and the extension never
  lists a frame's tools. A read-only tool that needs no argument ran through the question on 4 pages
  (`smart-home`, `pixel-art-studio`, `proxx-lite`, `spreadsheet`); nothing else was called.
- The earlier run the same day missed tools on two pages: `add_topping` and `remove_topping` (an emoji
  with its presentation character in an enum) and `draw_svg` (example SVG markup in a field
  description). Both are offered now (see "Tools not offered to the model" in TOOL-REVIEW.md).
