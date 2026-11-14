# Engineering

How to build, test, release and update WebAIAssist. Everything here runs from the repository
alone.

## Requirements

- Node.js 24 (`.nvmrc`) and npm. `.npmrc` sets exact versions and strict engines.
- For the browser tests: `npx playwright install chromium` once. If a test says "Executable doesn't exist", the installed Playwright wants a Chromium build the shared browser folder lacks: run `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium` (the variable keeps Playwright from deleting other projects' browsers), or point `PLAYWRIGHT_BROWSERS_PATH` at a folder inside the project, for example `node_modules/.cache/ms-playwright`.
- Network on the first build only: it fetches the four model libraries into `vendor/model-libs/`
  (about 32 MB, not in git). Later builds use that copy and check its SHA-256 every time. The
  llama.cpp engine (`wllama.wasm`) comes from `node_modules/@wllama/wllama` and is checked the
  same way.

## Commands

| Command                       | What it does                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                      | Installs the exact versions from `package-lock.json`.                                                                                                                                                                                                                                                                                     |
| `npm run verify`              | ESLint, Prettier, both type checks, the core-import rule, the scenario check, unit tests with coverage (core at least 90 %), markdownlint.                                                                                                                                                                                                |
| `npm test`                    | Unit tests (Vitest) with no coverage report. `npm run test:coverage` adds the report and the core threshold.                                                                                                                                                                                                                              |
| `npm run typecheck`           | `tsc -p tsconfig.json`.                                                                                                                                                                                                                                                                                                                   |
| `npm run lint`                | ESLint (no warnings allowed) and Prettier check. `npm run format` rewrites the files.                                                                                                                                                                                                                                                     |
| `npm run lint:md`             | markdownlint over the Markdown files.                                                                                                                                                                                                                                                                                                     |
| `npm run check:core-boundary` | Compiles `src/core` without DOM types and lints it: no browser API, no adapter import.                                                                                                                                                                                                                                                    |
| `npm run gen:validators`      | Regenerates the compiled message validators (`src/protocol`) from the JSON schemas.                                                                                                                                                                                                                                                       |
| `npm run build`               | Builds `dist/` and checks it (`scripts/check-dist.mjs`).                                                                                                                                                                                                                                                                                  |
| `npm run zip`                 | Packs `dist/` into `webaiassist-<version>.zip`, the same bytes for the same build.                                                                                                                                                                                                                                                        |
| `npm run check:zip`           | Content test of the zip (`scripts/check-zip.mjs`).                                                                                                                                                                                                                                                                                        |
| `npm run test:smoke`          | Builds `dist-smoke/` and runs the browser tests in `test/smoke/` (smoke and accessibility).                                                                                                                                                                                                                                               |
| `npm run test:bdd`            | Builds `dist-smoke/` and runs the Gherkin scenarios of `features/` that are tagged `@smoke` (`test/bdd/`).                                                                                                                                                                                                                                |
| `npm run screenshots`         | Builds `dist-smoke/` and takes four headless screenshots (scripted model, test page) into `docs/eval/screenshots/*-headless.png`. The real ones come from `npm run eval:gpu`.                                                                                                                                                             |
| `npm run scenarios`           | Rewrites the table in [SCENARIOS.md](SCENARIOS.md) from `features/`. `npm run check:scenarios` fails when it is stale.                                                                                                                                                                                                                    |
| `npm run verify:release`      | All of the above, in that order. Green means the zip can be released.                                                                                                                                                                                                                                                                     |
| `npm run icons`               | Renders `static/icons/icon.svg` to the four PNG sizes. Run after changing the SVG.                                                                                                                                                                                                                                                        |
| `npm run build:smoke`         | Builds the development build `dist-smoke/`: scripted test model, fake processor engine with four test models, `?tab=` override, browser check (spike) page.                                                                                                                                                                               |
| `npm run eval:cpu`            | Builds `dist-eval/` and runs the real processor model (llama.cpp; `--model 0.6b`, `1.7b` or `qwen35-2b`, default `0.6b`) in headless Chromium: five prompts on the stub node, then a second start from the stored copy. Needs the network once (397 MB to 1.3 GB). Writes `docs/eval/EVAL-CPU-<model>-<date>.json`. Not part of the gate. |
| `npm run build:eval`          | Builds `dist-eval/` (the extension plus install-time access to `localhost`, `127.0.0.1` and `agenticsystemcore.com`) and checks it.                                                                                                                                                                                                       |
| `npm run eval:gpu`            | Builds `dist-eval/` and runs the model evaluation on a computer with a GPU: visible browser windows, 20 prompts, the models of `--models` (default `qwen,llama`; also `qwen35`, `gemma4`), a report in `docs/eval/`. Not part of the gate. See [EVAL.md](EVAL.md).                                                                        |
| `npm run eval:gpu:win`        | From WSL: runs the same evaluation on the Windows side and copies the report back.                                                                                                                                                                                                                                                        |
| `npm run eval:nano`           | Chrome's built-in model for real, in Google Chrome. Writes `docs/eval/EVAL-NANO-<date>-<version>.json`. Not part of the gate.                                                                                                                                                                                                             |
| `npm run eval:nano:win`       | From WSL: the same on the Windows side.                                                                                                                                                                                                                                                                                                   |
| `npm run eval:endpoint`       | Five questions through the real endpoint runtime against the address, model and key of `WEBAIASSIST_ENDPOINT_URL`, `_MODEL` and `_KEY` (environment only). Opt-in, uses the network, not part of the gate. See [EVAL.md](EVAL.md).                                                                                                        |
| `npm run promo`               | Renders the store tiles and the link-preview card into `docs/store/`.                                                                                                                                                                                                                                                                     |
| `npm run spike:serve`         | Serves the browser check page of `dist-smoke/` on <http://localhost:8080> (run `npm run build:smoke` first).                                                                                                                                                                                                                              |

If no browser can start, the browser tests fail and say how to install Chromium. On a machine
without one, `WEBAIASSIST_ALLOW_NO_BROWSER=1 npm run test:smoke` skips them instead; never use it
for a release.

## What the build checks refuse

`scripts/check-dist.mjs` (every build) and `scripts/check-zip.mjs` (the zip) fail on:

- a permission, host permission or CSP other than the documented ones; declared content
  scripts; `web_accessible_resources`; `externally_connectable`; no 128-pixel icon;
- `eval`, `new Function`, a remote `<script>`, the scripted test model (release build);
- anything of the development build in the release build or the zip: a `spike/` file, the
  link to it, or code that reads the `?tab=` override (`checkDevOnly`);
- remote code: any mention of `raw.githubusercontent.com`, a remote `.wasm` URL, a remote
  `import()` or `importScripts()` (`scripts/check-remote-code.mjs`);
- a model library that is missing, changed (size or SHA-256), or not pinned;
- in the zip only: a file that is not in `dist/`, a missing file, a source map or
  source-map comment, a version other than `package.json`, more than 10 MiB (the 0.1.0 zip is 9.7 MB, 9.3 MiB).

## Tests

- `test/core`, `test/adapters`, `test/ui`, `test/protocol`, `test/spike`: unit tests (Vitest, jsdom
  for UI). The four model paths are tested against fakes: `wllama-runtime*.test.ts` (processor,
  fake engine), `prompt-api-*.test.ts` (Chrome's built-in model, fake `LanguageModel`),
  `endpoint-runtime.test.ts`, and the WebLLM adapter with a fake engine. `default-model.test.ts`
  holds the order in which the panel picks a default.
- `test/replay`: the ten AgenticSystemCore tools through the whole message path.
- `test/security` and `test/security-review`: the adversarial pass of
  [THREAT-MODEL.md](THREAT-MODEL.md) and the review tests of the audit (forged frames, tool
  changes during the question, turn markers, endpoint rules, saved results fenced again).
  `docs-review.test.ts` and `docs-agree.test.ts` check the documents against the manifest, the
  dependencies, the models and the commands, so a document cannot drift from the code.
- `test/scripts`: the build, zip, remote-code, workflow, scenario and release-notes checks.
- `test/eval`: the scoring and the plan of the evaluation scripts.
- `test/smoke`: the built extension in headless Chromium with the WebMCP testing feature, local
  pages (two tools, no tools, a throwing tool, a tool result with turn markers, thirty tools, an
  AgenticSystemCore node page), site files served by the test server (including a `robots.txt`
  with `Content-Signal: ai-input=no`), a fake `LanguageModel` for Chrome's built-in model
  (`test/smoke/fake-language-model.ts`), and the scripted test model, which exists only
  in `dist-smoke/`. The scripted model reads `/tool name {json}` (one call, then an answer with
  the result), `/loop name {json}` (a call at every step, each with a new `step` argument) and
  `/repeat name {json}` (the same call every time); asked to repair a reply it sends the same
  call again. Results of the accessibility part are in [A11Y.md](A11Y.md).
- `features/` and `test/bdd`: the behaviour in Gherkin, one file per area, and the steps that
  run the `@smoke` scenarios in the same browser set-up as `test/smoke` (Playwright with
  `playwright-bdd`). Every scenario, its test and its status are in [SCENARIOS.md](SCENARIOS.md).
  To add a step, see "Scenarios" below.

Tests use fixed past dates and no network. A real model never runs in these tests; the
evaluations with real models are `npm run eval:cpu` and `npm run eval:gpu` ([EVAL.md](EVAL.md)),
and Chrome's built-in model is checked by hand ([MANUAL-CHECKS.md](MANUAL-CHECKS.md)).

## Scenarios

The behaviour of the first public version is written in `features/*.feature` (Gherkin, plain
language). A scenario has tags: `@smoke` (runs in `npm run test:bdd`), `@unit` (proved by the test
named in a `# test:` comment above it), `@gpu`, `@cpu`, `@nano`, `@manual`, and
`@pending-wp1` to `@pending-wp7` while a later work package still builds the behaviour (none is
pending now, and a test keeps it so; see [MANUAL-CHECKS.md](MANUAL-CHECKS.md)). A
`# req:` comment lists the requirement rows it covers. The rules are in
[SCENARIOS.md](SCENARIOS.md) and are checked by `npm run check:scenarios`.

- To add a scenario: write it at the end of the right feature file with a kind tag, then
  `npm run scenarios`. Use the phrases of the existing steps (`test/bdd/steps/*.steps.ts`);
  `npx bddgen -c playwright.bdd.config.ts` lists any phrase that has no step.
- To build a scenario that is waiting for a later package: write its steps, delete its `@pending-wp` tag, run
  `npm run scenarios` and `npm run test:bdd`.
- Steps reuse `test/smoke/harness.ts`. A new test page goes into `test/smoke/` and the server
  list in the harness. Text in a step may use `{host}` and `{origin}` for the page under test.

## CI

- `.github/workflows/test.yml`: on each push to `main` and each pull request. Installs, audits
  the runtime dependencies (`npm audit --omit=dev`), caches the Playwright browser and the model
  libraries, installs Chromium, runs `npm run verify:release`. No GPU.
- `.github/workflows/release.yml`: on a tag `v*`. Checks that the tag equals the version in
  `package.json`, runs `npm run verify:release`, and creates the GitHub release with the
  CHANGELOG section as its text and the zip and its `.sha256` file attached. It does not upload
  to the Chrome Web Store.
- Every action is pinned to a full commit SHA with its version in a comment;
  `test/scripts/workflows.test.ts` enforces this and the permissions.
- `.github/dependabot.yml`: npm and GitHub Actions, weekly, same-major updates only, versions at
  least 14 days old.
- Keep a dated log of every CI change outside the code: a workflow turned on or off, each
  failure with its cause and fix, each held-back or breaking update, each Dependabot or
  code-scanning change.

## Release

1. Update `CHANGELOG.md`: the items of the release sit under `## [x.y.z] - not yet released`; put the release date there (`## [x.y.z] - YYYY-MM-DD`), and open the next version's section above it for later changes.
2. Run `npm version x.y.z --no-git-tag-version`: it sets the version in `package.json` and
   `package-lock.json`; the build copies it into the manifest.
3. Run `npm run verify:release` on a clean checkout.
4. Commit, then push a tag `vx.y.z`. `release.yml` creates the GitHub release with the zip.
5. Upload the same zip to the Chrome Web Store: [STORE-RUNBOOK.md](STORE-RUNBOOK.md).

## Updates

- Dependencies: exact pins, same major version, published at least 14 days earlier. Check
  the date with `npm view <package> time --json`. A major update is a recorded decision with a
  reason. The one exception today is `@w3c/webmcp-polyfill` 0.1.0, its only version.
- WebLLM (`@mlc-ai/web-llm`): a new version usually brings new model libraries.
  1. Find the library folder the new version uses (`modelVersion` in
     `node_modules/@mlc-ai/web-llm/lib/index.js`) and the commit of
     `mlc-ai/binary-mlc-llm-libs` that holds it.
  2. Update `scripts/model-libs.json`: the `source` commit, each file name, its size and
     SHA-256 (`sha256sum` of a file downloaded from that commit).
  3. Delete `vendor/model-libs/` and run `npm run build`: it fetches the new files and checks
     them.
  4. If the build says WebLLM's remote library prefix was not found once, read how the new
     version builds library URLs and update `scripts/model-libs.mjs`.
  5. Check the Hugging Face revisions in `src/adapters/webllm-app-config.ts` (the model
     repository's commit list) and run a real model by hand ([EVAL.md](EVAL.md)).
- WebMCP: the specification is a draft. Re-read it before each release and record the date in
  [SOURCES.md](SOURCES.md).
