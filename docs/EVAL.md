# Evaluation

> **In short**
>
> - This page records how well each model picks the right tool on an AgenticSystemCore node. CI tests use a scripted model and cannot measure it.
> - Graphics card, 18 Nov 2026, version 0.1.1 (llama.cpp), one laptop with two cards: the default, Qwen3 1.7B, used a tool for 10 of 10 questions on both nodes and picked the right one for 8 of 10 on the test node and 5 of 10 on the live node, on both cards. Median answer 9 to 20 s.
> - Llama 3.2 3B picked the right tool most often (live node: 8 of 10 on the NVIDIA card, 7 on the AMD one). Gemma 4 E2B answers but takes about 1 to 2.5 minutes; it stays marked slow. Chrome's built-in model, 15 Nov: a tool on 10 of 10 questions, the right one on 8.
> - Processor, after the tool-use change: Qwen3 1.7B was right on 5 of 5 prompts. Each run is five prompts, so the numbers show a direction, not a rate.
> - Real Chrome 157, 15 Nov 2026: the conformance page ran 16 of 16 cases as expected, and the panel listed the tools on 17 of Google's 18 demo pages.

How well each shipped model picks the right tool with the right arguments on an
AgenticSystemCore node, measured by one command on a computer with a GPU. The tests in CI use a
scripted model and cannot measure this.

## What is measured for each model path

| Path                    | Measured by                                                                 | State on 16 Nov 2026                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graphics card           | `npm run eval:gpu` on the maintainer's laptop (AMD gcn-5 and NVIDIA ampere) | Runs of 18 Nov 2026 with version 0.1.1: one model per run, 10 questions per node, each in a new chat; all five models on both cards. See "Results". The runs of 16 Nov 2026 (version 0.1.0, WebLLM) stay in `docs/eval/` as history.                                                                                                                      |
| Processor and memory    | `npm run eval:cpu`, headless Chromium on 16 cores                           | Three models, five prompts (three for Qwen3 1.7B): see "The processor model".                                                                                                                                                                                                                                                                             |
| Chrome's built-in model | `npm run eval:nano` in real Chrome 157 on Windows                           | Run of 15 Nov, after the profile used for earlier builds was replaced (in it the panel showed no tools at all): a tool used on 10 of 10 questions, the whole expected sequence on 8 (4 of 5 on the test node, 4 of 5 on the live node); 18 to 36 s per answer; start 14 s, later starts 3 s. Report: `docs/eval/EVAL-NANO-2026-11-15-157.0.8103.52.json`. |
| Chat endpoint           | Unit and browser tests against a fake server                                | No run against a real Ollama or LM Studio is recorded.                                                                                                                                                                                                                                                                                                    |

## Run

1. On the GPU machine: `npm ci`, `npx playwright install chromium`, then `npm run eval:gpu`
   (Playwright's Chromium, visible window: Google Chrome and Edge no longer accept the flags that
   side-load an unpacked extension, so the eval cannot run in them; the extension itself does).
   From WSL, `npm run eval:gpu:win` runs it on the Windows side, installs that Chromium there, and
   copies the report back.
2. It builds `dist-eval/` (the extension plus install-time access to `localhost`, `127.0.0.1` and
   `agenticsystemcore.com`), starts the model (Qwen3 1.7B, the one the panel picks; another with
   `--models`) and asks the prompts. **Run one model per run.** A second model in the same run
   sees the chat the first one saved for that site and copies its answers: on 18 Nov 2026 a model
   that used a tool in 10 of 10 questions alone used none after a model that had answered without
   tools.
3. Every prompt runs in a fresh panel, on a local stub of the ten AgenticSystemCore tools and,
   unless `--no-live`, on the live node. Each confirmation question is allowed and recorded.
4. Options: `--models qwen17` (the default; the others are `qwen`, `qwen35`, `llama` and `gemma4`), `--prompts 20`, `--idle 10` (minutes), `--headless`,
   `--no-live`, `--fresh-profile` (forget cached models), `--scripted` (flow check, no GPU),
   `--no-cancel-check` (skip the Cancel-during-download check, to see its effect on the GPU alone),
   `--fast-gpu` (start the browser with `--force_high_performance_gpu`; see "Two graphics cards"),
   `--keep-chat` (keep the saved chats between questions, as with Memory on).
5. Output: `docs/eval/EVAL-<date>-<chrome>.json` (it names the graphics card the panel got, as
   vendor and architecture), four screenshots in `docs/eval/screenshots/`, and the results block
   below. Exit code 2 means the panel found no WebGPU adapter.
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

### Run of 18 Nov 2026 (version 0.1.1, each question in a new chat)

`npm run eval:cpu -- --model 1.7b`, same machine (16 cores, 8 threads), headless Chromium 156,
report `docs/eval/EVAL-CPU-1.7b-2026-11-18.json`. Qwen3 1.7B downloaded (1.1 GB) and loaded in 57.2 s,
11.7 s from the stored copy. The expected tool on 4 of 5 questions (`ask`, `ask`, `search`, `search`;
the fifth expected `search` and called `links`). The first question took 138.8 s, the next four 25 to
30 s (median of all five 28 s); reply 6.2 tokens a second, prompt 9.0 (medians). The earlier runs'
answers of 47 to 137 s carried each site's saved chat ("Each question in a new chat"). Cancel during
the download answered in 73 ms and left no file.

## The 4,096-token window

Every listed model runs with a window of 4,096 tokens (`CPU_CAPABILITIES`, on the graphics card
and on the processor). `test/adapters/context-fit.test.ts` builds the
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

Runs of 18 Nov 2026, version 0.1.1, Chromium 156.0.8078.4, Windows 10.0.26300, one laptop with two
graphics cards: NVIDIA (`nvidia/ampere`, browser started with `--fast-gpu`) and AMD integrated
(`amd/gcn-5`, the browser's default). One model per run, 10 questions on the test node ("stub") and
10 on the live node, each in a new chat. Command: `npm run eval:gpu:win -- [--fast-gpu] --models <key>
--prompts 10 --idle 0 --no-cancel-check`. Reports: `docs/eval/EVAL-GPU-2026-11-18-<card>-<model>.json`.
"Median answer" is the median time from sending the question to the end of the answer.

| Card   | Model  | Target | Prompts | Tool right | First tool right | Tool used | Task done | Gate shown | Fact in answer | Hallucinated | Errors | Repeated calls | Median first token (s) | Median answer (s) |
| ------ | ------ | ------ | ------- | ---------- | ---------------- | --------- | --------- | ---------- | -------------- | ------------ | ------ | -------------- | ---------------------- | ----------------- |
| NVIDIA | qwen17 | stub   | 10      | 8          | 8                | 10 of 10  | 8         | 10 of 10   | 9 of 10        | 0            | 0      | 0              | 2.6                    | 9.2               |
| NVIDIA | qwen17 | live   | 10      | 5          | 5                | 10 of 10  | 5         | 10 of 10   | 0 of 0         | 0            | 0      | 0              | 4.15                   | 15.15             |
| NVIDIA | qwen   | stub   | 10      | 8          | 8                | 10 of 10  | 8         | 10 of 10   | 9 of 10        | 0            | 0      | 0              | 2.1                    | 6.55              |
| NVIDIA | qwen   | live   | 10      | 0          | 0                | 0 of 10   | 0         | 0 of 0     | 0 of 0         | 0            | 0      | 0              | 3.95                   | 4                 |
| NVIDIA | qwen35 | stub   | 10      | 6          | 6                | 10 of 10  | 8         | 10 of 10   | 8 of 10        | 0            | 0      | 0              | 3.85                   | 13.5              |
| NVIDIA | qwen35 | live   | 10      | 5          | 6                | 9 of 10   | 7         | 9 of 9     | 0 of 0         | 0            | 0      | 0              | 4.25                   | 21.1              |
| NVIDIA | llama  | stub   | 10      | 9          | 9                | 10 of 10  | 8         | 10 of 10   | 9 of 10        | 0            | 0      | 0              | 3.45                   | 13.65             |
| NVIDIA | llama  | live   | 10      | 8          | 8                | 10 of 10  | 8         | 10 of 10   | 0 of 0         | 0            | 0      | 0              | 3.85                   | 15.15             |
| NVIDIA | gemma4 | stub   | 10      | 6          | 6                | 10 of 10  | 6         | 10 of 10   | 7 of 10        | 0            | 0      | 0              | 22.05                  | 51.05             |
| NVIDIA | gemma4 | live   | 10      | 6          | 6                | 10 of 10  | 7         | 10 of 10   | 0 of 0         | 0            | 2      | 0              | 44.25                  | 94.35             |
| AMD    | qwen17 | stub   | 10      | 8          | 8                | 10 of 10  | 8         | 10 of 10   | 9 of 10        | 0            | 0      | 0              | 3.35                   | 13.65             |
| AMD    | qwen17 | live   | 10      | 5          | 5                | 10 of 10  | 5         | 10 of 10   | 0 of 0         | 0            | 0      | 0              | 5.65                   | 19.65             |
| AMD    | qwen   | stub   | 10      | 7          | 7                | 10 of 10  | 7         | 10 of 10   | 8 of 10        | 0            | 0      | 0              | 2.85                   | 9.95              |
| AMD    | qwen   | live   | 10      | 1          | 1                | 1 of 10   | 1         | 1 of 1     | 0 of 0         | 0            | 0      | 0              | 6.25                   | 6.65              |
| AMD    | qwen35 | stub   | 10      | 9          | 9                | 10 of 10  | 9         | 10 of 10   | 9 of 10        | 0            | 0      | 0              | 4.5                    | 15.35             |
| AMD    | qwen35 | live   | 10      | 2          | 5                | 9 of 10   | 6         | 9 of 9     | 0 of 0         | 0            | 1      | 0              | 5.15                   | 30.8              |
| AMD    | llama  | stub   | 10      | 7          | 7                | 10 of 10  | 5         | 10 of 10   | 7 of 10        | 0            | 0      | 0              | 4.95                   | 18.3              |
| AMD    | llama  | live   | 10      | 7          | 7                | 9 of 10   | 8         | 9 of 9     | 0 of 0         | 0            | 0      | 0              | 5.6                    | 16.7              |
| AMD    | gemma4 | stub   | 10      | 8          | 8                | 10 of 10  | 8         | 10 of 10   | 8 of 10        | 0            | 0      | 0              | 40.3                   | 78.5              |
| AMD    | gemma4 | live   | 10      | 5          | 6                | 9 of 10   | 6         | 9 of 9     | 0 of 0         | 0            | 3      | 0              | 57.35                  | 153.85            |

| Card   | Model  | Ready | Start (s) | Model line after Start                                                                           |
| ------ | ------ | ----- | --------- | ------------------------------------------------------------------------------------------------ |
| NVIDIA | qwen17 | yes   | 8.2       | Ready: Qwen3 1.7B. Running in this browser, on your graphics card (in the offscreen document).   |
| NVIDIA | qwen   | yes   | 7.7       | Ready: Qwen3 0.6B. Running in this browser, on your graphics card (in the offscreen document).   |
| NVIDIA | qwen35 | yes   | 10.3      | Ready: Qwen3.5 2B. Running in this browser, on your graphics card (in the offscreen document).   |
| NVIDIA | llama  | yes   | 299.7     | Ready: Llama 3.2 3B. Running in this browser, on your graphics card (in the offscreen document). |
| NVIDIA | gemma4 | yes   | 19.4      | Ready: Gemma 4 E2B. Running in this browser, on your graphics card (in the offscreen document).  |
| AMD    | qwen17 | yes   | 8.2       | Ready: Qwen3 1.7B. Running in this browser, on your graphics card (in the offscreen document).   |
| AMD    | qwen   | yes   | 6.1       | Ready: Qwen3 0.6B. Running in this browser, on your graphics card (in the offscreen document).   |
| AMD    | qwen35 | yes   | 12.3      | Ready: Qwen3.5 2B. Running in this browser, on your graphics card (in the offscreen document).   |
| AMD    | llama  | yes   | 10.8      | Ready: Llama 3.2 3B. Running in this browser, on your graphics card (in the offscreen document). |
| AMD    | gemma4 | yes   | 27.3      | Ready: Gemma 4 E2B. Running in this browser, on your graphics card (in the offscreen document).  |

"Start" counts from the press of Start to Ready, with the model already stored, except Llama 3.2 3B on
the NVIDIA card (299.7 s), whose 2.0 GB file was downloaded in that run. "Errors" are questions that
ended with an error or ran past the 5-minute limit (Gemma 4 E2B: 2 on the NVIDIA card, 3 on the AMD
one). `webaiassist_query_graph` is the extension's own graph tool: a call to it is counted as used,
not as hallucinated, but not as the expected page tool (Qwen3 1.7B chose it for 4 of the 10 live-node
questions on both cards).

Checks of a separate run with a new browser profile (NVIDIA card, Qwen3 1.7B, two questions, report `docs/eval/EVAL-GPU-2026-11-18-nvidia-checks.json`):

| Check                               | Result  | Detail                                                                                                                                                                   |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cancel stops the download           | pass    | Start usable again after 0 s; left Ready: true; weight requests after 5 s: 0                                                                                             |
| storage.local.setAccessLevel        | pass    | resolved in the service worker                                                                                                                                           |
| Hosts contacted on first Start      | review  | 8 requests seen, none to a host PRIVACY.md does not name; no model download seen (the offscreen document is not visible to Playwright): open DevTools on the first Start |
| Idle 10 min, then a question        | pass    | answered                                                                                                                                                                 |
| Corrupted cached library is refused | skipped | no cached .wasm (scripted or library served from the package)                                                                                                            |

<!-- eval-results:end -->

### The final build, 19 Nov 2026

Two changes came after the runs above: a model in the browser no longer gets the built-in graph tool on a
page that has tools of its own, and an earlier answer given without a tool is no longer given to the model
again (CHANGELOG). Re-run on the NVIDIA card, 10 questions per node (reports
`docs/eval/EVAL-GPU-2026-11-19-nvidia-<model>.json`):

| Model      | Right tool, test node | Right tool, live node | Tool used, live node | Median answer, test / live |
| ---------- | --------------------- | --------------------- | -------------------- | -------------------------- |
| Qwen3 1.7B | 8 of 10               | 5 of 10               | 10 of 10             | 10.2 s / 19.4 s            |
| Qwen3 0.6B | 7 of 10               | 0 of 10               | 0 of 10              | 7.0 s / 4.4 s              |
| Qwen3.5 2B | 7 of 10               | 5 of 10               | 8 of 10              | 12.4 s / 20.5 s            |

Qwen3 1.7B no longer calls the built-in graph tool on the live node; on the four questions where it had
called it, it called the general `ask` tool instead, so the count of the expected tool stays at 5 of 10.

**With a saved chat (Memory on).** `--keep-chat` keeps what the extension remembers of each site between
questions. Qwen3 0.6B first filled the chats with answers given without a tool
(`EVAL-GPU-2026-11-19-nvidia-qwen-saved-chat.json`); then Qwen3 1.7B asked the same questions on top of them
(`EVAL-GPU-2026-11-19-nvidia-qwen17-saved-chat.json`): the right tool on 9 of 10 test-node questions and on 5
of 10 live-node questions, as with a new chat. Before the change, with such chats, it was 1 to 4 of 10 on the
live node. Answers took longer (median 37 s and 50 s), because the earlier tool results go with each question.

### Version 0.1.0 (WebLLM), 15 and 16 Nov 2026

On the AMD card, before the change "Each question in a new chat": Qwen3 0.6B, the right tool on 8 of
10 test-node questions and 2 of 10 live-node questions, median first token 19.45 s and 26.9 s;
Qwen3.5 2B, 6 of 10 on the test node with 2 to 5 minutes an answer; Llama 3.2 3B and Gemma 4 E2B ran
past the 5-minute limit on their first question. The report is `EVAL-2026-11-16-156.0.8078.4.json`.
It merged three runs of the night of 15 to 16 Nov 2026, one browser each, because a model
that runs past the time limit leaves its browser unable to open the next page: Qwen3 0.6B and Llama
3.2 3B (`EVAL-GPU-2026-11-16-qwen-llama.json`), Qwen3.5 2B (`EVAL-GPU-2026-11-16-qwen35.json`), Gemma 4
E2B (`EVAL-GPU-2026-11-16-gemma4.json`); merged in `EVAL-2026-11-16-156.0.8078.4.json`. A row with 1
question is a model whose browser stopped after its first question. The check "Idle 10 min, then a
question" ran with Qwen3.5 2B, which needs 2 to 5 minutes per answer, so its "fail" is that model's
time limit, not a finding about the idle path. Re-run on 16 Nov 2026 with Qwen3 0.6B alone (the build
with the Stop change, a new browser profile, 2 questions per page): "Idle 10 min, then a question" passed,
the question was answered (`docs/eval/EVAL-GPU-2026-11-16-idle.json`).

## Each question in a new chat

The panel keeps one saved chat per site and gives it to the model with the next question, and the
evaluation's browser profile is kept between runs so that a model downloads once. Until 18 Nov 2026
a reload was the only "new chat", so a question on the live node came with the answers saved for
that site by older runs and by other models, and a model often copied an earlier answer that used
no tool. Since 18 Nov 2026 the evaluation empties what the extension remembers of every site before
each question (`clearMemory` in `scripts/eval/panel.ts`), in the graphics-card, processor and
built-in model evaluations alike. With it, the default model's right tool on the live node went from
1 to 4 of 10 to 5 of 10 on both cards, and Qwen3 0.6B's on the test node from 2 of 10 to 7 or 8. The
live-node numbers of earlier runs, those of version 0.1.0 included, were measured without it. A
person with memory on meets the same effect when a site's saved chat holds answers given without a
tool; **Forget this site** in the panel empties it.

## Two graphics cards

A laptop often has two graphics cards: one inside the processor and a faster separate one. A page
asks WebGPU for an adapter and the browser decides which card it gets. On the measured laptop
(Windows, Chromium 156, 18 Nov 2026) the panel got the AMD integrated card (`amd/gcn-5`) in every
run, whatever power preference the engine asked for. It got the NVIDIA card (`nvidia/ampere`) only
when the browser was started with `--force_high_performance_gpu`, which is what `--fast-gpu` does.
The extension cannot choose the card. The switch was tried in Playwright's Chromium only, not in
Google Chrome. Windows also has a graphics setting per application (Settings, System, Display,
Graphics); whether it moves the browser's WebGPU to the faster card was not tested.

## When the model fails on a GPU

**Version 0.1.1 (llama.cpp).** On 18 Nov 2026 the AMD gcn-5 card stopped on the first question of
Qwen3 1.7B (a 1.1 GB file): Windows reported `DXGI_ERROR_DEVICE_HUNG`, the browser reported "Device
lost", the engine aborted and every later question failed. Qwen3 0.6B answered on the same card.
llama.cpp's default sends a whole prompt to the card as one piece of work, which kept this card
busy for longer than its driver allows. With pieces of 64 tokens (`GPU_BATCH` in
`src/entries/shared/wllama-engine.ts`) the same model answered every question of the runs above;
wllama 3.13.0 behaved the same as 3.8.1. When an engine does end by itself, the panel says that
the model stopped and that the graphics card gave up, and the next Start loads the model again
(`test/adapters/wllama-runtime-gpu.test.ts`, `test/adapters/wllama-runtime-stop.test.ts`).

### Version 0.1.0 (WebLLM), kept as history

The script `scripts/gpu-check/run.ts` and the file `src/adapters/prefill-chunk.ts` named below
were removed with WebLLM in 0.1.1.

`node scripts/gpu-check/run.ts [--channel chrome|chromium] [--model <id>] [--words <n>] [--chunk <n>]`
ran WebLLM alone, without the extension: one load, a warm-up question, one question with a prompt
of `--words` filler words, and printed a JSON line per model with the load, warm-up and first-token
seconds (the weights came from WebLLM's own CDN; it was a diagnostic, not the no-remote-code build).
It told the extension apart from the GPU: on 13 Nov 2026 an AMD gcn-5 laptop GPU lost its device on
every prompt over a few hundred tokens, in Chrome and Chromium alike, until the prefill chunk was
small (`src/adapters/prefill-chunk.ts`, the `--chunk` option here). A GPU on which the warm-up
takes tens of seconds is one on which the first answer takes as long; the panel says so.

On 14 Nov 2026 the same laptop loaded Llama 3.2 3B (16.5 s) and then failed its first question
after 3.7 s with "Object has already been disposed", and every later one with WebLLM's "Model not
loaded" error; Qwen3 0.6B answered on the same run. WebLLM and tvmjs free their objects when the
GPU device is lost (`device.lost` handlers in `lib/index.js`), and the call still running then
reads a freed one; the device loss itself, by the 2 s watchdog, is the reading that fits the
13 Nov measurements (a fixed 32-token chunk was sized for the 0.6B model, a 3B model costs about
six times as much per token), but it was not measured on this run. In 0.1.0 the prefill chunk was one
value per model (`src/adapters/prefill-chunk.ts`: 32 for Qwen3 0.6B, 10 for
Qwen3.5 2B), scaled from the measured 32 by the weight each model reads per
token; these were estimates. The panel of 0.1.0 treated
"already been disposed" as a lost device (host restart, plain banner, model line no longer
"Ready") and a chat on an engine WebLLM no longer has as "The model stopped. Press Start to load
it again.".

## Checks the run makes

Storage access level, hosts contacted on the first Start (only those in `docs/PRIVACY.md`),
Cancel during a download, and a question after the idle wait. The check "Corrupted cached
library is refused" is always skipped since 0.1.1: the engine file is inside the package and no
model library is cached (`test/smoke/smoke.spec.ts` checks the packaged file against its pin).
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
