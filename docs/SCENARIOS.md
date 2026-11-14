# Scenarios

The behaviour of the first public version is written as Gherkin in `features/` (one file per
area, plain user language). This page is the traceability table: every scenario, its tags, the
test that proves it and its status. The table between the markers is generated: run
`npm run scenarios` after you change a feature file, and `npm run check:scenarios` (part of
`npm run verify`) fails when it is stale or a rule is broken.

## Tags

| Tag                              | Meaning                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `@smoke`                         | Runs headless in the built extension with the scripted model: `npm run test:bdd`.             |
| `@unit`                          | Proved by the unit test named in the `# test:` comment above the scenario.                    |
| `@cpu`                           | Needs a real run of the CPU and memory model.                                                 |
| `@gpu`                           | Needs a graphics card: the GPU evaluation on the maintainer's computer.                       |
| `@nano`                          | Needs Chrome's built-in model: checked by hand in Chrome.                                     |
| `@manual`                        | Checked by hand (store, screen reader, live site, network log).                               |
| `@pending-wp1` to `@pending-wp7` | The behaviour is built by a later work package; the scenario is written but does not run yet. |

A scenario runs in `npm run test:bdd` when it is `@smoke` and has no `@pending-wp` tag.
A `# req:` comment lists the requirement rows it covers (OWASP, NIST, EU AI Act, Chrome Web
Store and the discovery reader rules). Scenario ids are `F<file number>.<position>`: add new
scenarios at the end of a file so ids stay stable.

## Status: no scenario is pending

Every scenario is run by `npm run test:bdd`, proved by a named unit test, or tagged for hand or
hardware with the reason below. A test fails the build if a `@pending-wp` tag comes back
(`test/scripts/scenarios.test.ts`). The checks a person runs are in
[MANUAL-CHECKS.md](MANUAL-CHECKS.md).

Scenarios that are not run automatically, and why:

| Id            | Tag       | Reason                                                                                                                                 |
| ------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F01.8         | `@manual` | Needs the Chrome Web Store dialog.                                                                                                     |
| F02.7         | `@gpu`    | Needs a graphics card; `npm run eval:gpu` runs it.                                                                                     |
| F02.8         | `@nano`   | Needs official Chrome with its built-in model; headless Chromium has none (the browser tests use a stand-in for the API).              |
| F02.28        | `@cpu`    | Downloads the real 397 MB model; `npm run eval:cpu` runs it.                                                                           |
| F10.17, F11.8 | `@manual` | Use the live AgenticSystemCore site, which changes; recorded, not pass or fail.                                                        |
| F16.10        | `@manual` | Needs a screen reader.                                                                                                                 |
| F17.6         | `@manual` | Needs a network log of a real session with a real model.                                                                               |
| F19.5         | `@manual` | The test browser always has native WebMCP, so compat mode cannot be told apart from no compat mode; it needs a browser without WebMCP. |

Scenarios whose wording changed when they stopped being pending:

- F13.5 "The page does not answer": a tool call to a page that closed fails with "The page did not
  answer" and the person can ask again (unit tests). A "Try again" button in the chat is not built.
- F18.1 and F18.2 run in the browser tests with the service worker stopped through Chrome's
  DevTools protocol. F18.2 now says what is true: a processor model that is ready answers after the
  worker restarts, with no new download (the offscreen document keeps the model, so the panel has
  no "Preparing" state to show).

<!-- prettier-ignore-start -->
<!-- scenarios:start -->

### Count per tag

| Tag | Scenarios |
|---|---|
| @smoke | 108 |
| @unit | 129 |
| @gpu | 2 |
| @cpu | 4 |
| @nano | 1 |
| @manual | 7 |
| all | 249 |
| run by `npm run test:bdd` now | 108 |

### Every scenario

| Id | Area | Scenario | Tags | Test | Status |
|---|---|---|---|---|---|
| F01.1 | Install and first run | The toolbar button opens the side panel and lets WebAIAssist use that page | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.2 | Install and first run | The first run shows a welcome screen with the steps, the model and the privacy line | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.3 | Install and first run | "Got it" hides the welcome screen and it stays hidden after a restart | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.4 | Install and first run | Help shows the welcome screen again | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.5 | Install and first run | Help opens and closes, and the focus goes back to the Help button | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.6 | Install and first run | Before a model is started the panel says so, and a question gets the same hint | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.7 | Install and first run | The panel says that answers come from an AI model and can be wrong | @smoke | `features/01-install-and-first-run.feature` | npm run test:bdd |
| F01.8 | Install and first run | Installing from the Chrome Web Store asks only for the permissions the listing names | @manual | `features/01-install-and-first-run.feature` | manual check |
| F01.9 | Install and first run | The package asks for no website access at install | @unit | `test/scripts/check-zip.test.ts`, `test/security-review/dist-review.test.ts` | unit test |
| F02.1 | Choosing a model | A ready model is named in the model line | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.2 | Choosing a model | With a working graphics card and no processor model the panel selects the small bundled model | @unit | `test/ui/model-picker.test.ts` | unit test |
| F02.3 | Choosing a model | Without WebGPU and without the processor model the panel falls back to the endpoint, then Chrome's built-in model | @unit | `test/ui/default-model.test.ts` | unit test |
| F02.4 | Choosing a model | The default is chosen by measurement and the panel says why | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.5 | Choosing a model | The order is Chrome's built-in model, the CPU model, the graphics card, then an endpoint | @unit | `test/ui/default-model.test.ts` | unit test |
| F02.6 | Choosing a model | The CPU and memory model answers a question on a computer without a graphics card | @smoke @cpu | `features/02-choosing-a-model.feature` | npm run test:bdd, CPU run |
| F02.7 | Choosing a model | The graphics card model answers a question on a computer with WebGPU | @gpu | `features/02-choosing-a-model.feature` | maintainer or eval, GPU |
| F02.8 | Choosing a model | Chrome's built-in model answers a question in Chrome | @nano | `features/02-choosing-a-model.feature` | maintainer, Chrome built-in model |
| F02.9 | Choosing a model | Chrome's built-in model is unavailable here, and the panel says what Chrome said | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.10 | Choosing a model | This browser has no built-in model at all | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.11 | Choosing a model | Each state Chrome reports for its built-in model has its own plain line | @unit | `test/adapters/prompt-api-state.test.ts`, `test/ui/builtin-state.test.ts` | unit test |
| F02.12 | Choosing a model | Chrome's built-in model is fitted to a small context with a compact tool list | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.13 | Choosing a model | The built-in model is asked for its reply as JSON that matches the action schema | @unit | `test/adapters/prompt-api-questions.test.ts`, `test/core/action.test.ts` | unit test |
| F02.14 | Choosing a model | The built-in model is asked for its reply as JSON that names only the page's tools | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.15 | Choosing a model | Chrome's download starts from the click, shows progress, and Cancel stops it | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.16 | Choosing a model | A download that fails on the network says what to check | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.17 | Choosing a model | Each state Chrome reports while the model loads has a plain reason | @unit | `test/adapters/prompt-api-runtime.test.ts`, `test/adapters/prompt-api-state.test.ts` | unit test |
| F02.18 | Choosing a model | The size of the context is read from Chrome, with a fallback | @unit | `test/adapters/prompt-api-runtime.test.ts` | unit test |
| F02.19 | Choosing a model | A question that is too long for the window loses its oldest turns once | @unit | `test/adapters/prompt-api-questions.test.ts`, `test/adapters/prompt-api-fit.test.ts` | unit test |
| F02.20 | Choosing a model | Closing the panel or switching model lets the built-in model go | @unit | `test/adapters/prompt-api-questions.test.ts`, `test/ui/panel-switch.test.ts` | unit test |
| F02.21 | Choosing a model | A chat endpoint on this computer is used and the chat goes to that address only | @unit | `test/adapters/endpoint-runtime.test.ts`, `test/ui/options-page.test.ts` | unit test |
| F02.22 | Choosing a model | An endpoint that refuses the request is reported with its status | @unit | `test/adapters/endpoint-runtime.test.ts` | unit test |
| F02.23 | Choosing a model | A refused endpoint shows an error banner with the next step | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.24 | Choosing a model | An endpoint that does not answer in time is reported | @unit | `test/adapters/endpoint-runtime.test.ts` | unit test |
| F02.25 | Choosing a model | With no usable graphics card and no other model, Start opens Options | @unit | `test/ui/panel-access.test.ts` | unit test |
| F02.26 | Choosing a model | No graphics card: the error offers the processor model in one click | @smoke | `features/02-choosing-a-model.feature` | npm run test:bdd |
| F02.27 | Choosing a model | Switching model while one is ready releases the old one and starts the new one | @unit | `test/ui/panel-switch.test.ts` | unit test |
| F02.28 | Choosing a model | The real processor model answers on the stub node and starts again from the stored copy | @cpu | `features/02-choosing-a-model.feature` | CPU run |
| F02.29 | Choosing a model | Qwen3.5 2B and Gemma 4 E2B are in the model list, on the graphics card | @unit | `test/ui/model-picker.test.ts`, `test/adapters/models.test.ts` | unit test |
| F02.30 | Choosing a model | Gemma 4 E2B is hidden when the graphics card lacks shader-f16 | @unit | `test/ui/model-picker.test.ts`, `test/ui/options-page.test.ts` | unit test |
| F02.31 | Choosing a model | The newer graphics-card models ask before their first download | @unit | `test/ui/panel-consent.test.ts` | unit test |
| F02.32 | Choosing a model | A question on the AgenticSystemCore node fits the 4096-token window of every listed model | @unit | `test/adapters/context-fit.test.ts` | unit test |
| F02.33 | Choosing a model | Qwen3.5 2B and Gemma 4 E2B load and answer on the graphics card | @gpu | `features/02-choosing-a-model.feature` | maintainer or eval, GPU |
| F02.34 | Choosing a model | The real Qwen3.5 2B file answers on the stub node on the processor | @cpu | `features/02-choosing-a-model.feature` | CPU run |
| F02.35 | Choosing a model | The model list is in two groups and every entry says where it runs | @unit | `test/ui/model-picker.test.ts`, `test/ui/panel-model-groups.test.ts` | unit test |
| F02.36 | Choosing a model | A chat endpoint says from its address whether the chat leaves the computer | @unit | `test/ui/model-picker.test.ts`, `test/adapters/endpoint-runtime.test.ts` | unit test |
| F02.37 | Choosing a model | After Start the model line says where the model runs | @unit | `test/ui/panel-controller.test.ts`, `test/ui/panel-cpu.test.ts`, `test/ui/panel-privacy.test.ts` | unit test |
| F02.38 | Choosing a model | Options says for each place to run the model where it runs | @unit | `test/ui/options-models.test.ts` | unit test |
| F03.1 | Download, consent, progress, cancel, cache and removal | Before any weights download the panel shows the size and the source and waits | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.2 | Download, consent, progress, cancel, cache and removal | "Not now" changes nothing | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.3 | Download, consent, progress, cancel, cache and removal | Agreeing starts the download and shows progress | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.4 | Download, consent, progress, cancel, cache and removal | Cancel stops a download at once and Start continues it | @unit | `test/adapters/prompt-api-runtime.test.ts`, `test/ui/panel-safety.test.ts`, `test/ui/panel-controller.test.ts` | unit test |
| F03.5 | Download, consent, progress, cancel, cache and removal | A downloaded file that does not match its checksum is deleted and not used | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.6 | Download, consent, progress, cancel, cache and removal | A download that stops half way keeps no partial file as a model | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.7 | Download, consent, progress, cancel, cache and removal | A model on this computer starts without a new download | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.8 | Download, consent, progress, cancel, cache and removal | Options lists the downloaded models with their sizes and removes one or all | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.9 | Download, consent, progress, cancel, cache and removal | Storage refused or disk full gives a plain message and a way out | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.10 | Download, consent, progress, cancel, cache and removal | Out of memory on the CPU model names the next step | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.11 | Download, consent, progress, cancel, cache and removal | Model libraries are inside the package and match their recorded checksums | @unit | `test/security-review/dist-review.test.ts` | unit test |
| F03.12 | Download, consent, progress, cancel, cache and removal | The model library inside the package loads and matches its pin | @smoke | `features/03-download-consent-and-storage.feature` | npm run test:bdd |
| F03.13 | Download, consent, progress, cancel, cache and removal | The WebGPU model downloads only from its fixed address | @unit | `test/security-review/dist-review.test.ts`, `test/adapters/webllm-app-config.test.ts` | unit test |
| F03.14 | Download, consent, progress, cancel, cache and removal | Cancel ends the download of a processor model at once and keeps no partial file | @unit | `test/adapters/wllama-runtime.test.ts` | unit test |
| F03.15 | Download, consent, progress, cancel, cache and removal | The processor runtime loads only the models in its list, each from a fixed address with a recorded SHA-256 | @unit | `test/adapters/wllama-runtime.test.ts`, `test/adapters/cpu-models.test.ts` | unit test |
| F03.16 | Download, consent, progress, cancel, cache and removal | A stored copy that was checked once starts without a download and without a new hash | @unit | `test/adapters/wllama-runtime.test.ts` | unit test |
| F04.1 | The page card and following the browser | The page line names the site and counts its WebMCP tools | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.2 | The page card and following the browser | A page without WebMCP tools is a plain state with a next step | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.3 | The page card and following the browser | A browser page cannot be used and says so | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.4 | The page card and following the browser | With no page the panel says to open one | @unit | `test/ui/page-status.test.ts` | unit test |
| F04.5 | The page card and following the browser | A page that cannot list its tools shows why, in one line | @unit | `test/ui/page-status.test.ts` | unit test |
| F04.6 | The page card and following the browser | Switching to another tab updates the card within a moment | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.7 | The page card and following the browser | Switching to a site that is not allowed shows only its name and the Allow button | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.8 | The page card and following the browser | The card refreshes when the page finishes loading or its address changes in place | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.9 | The page card and following the browser | The card follows the focused window | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.10 | The page card and following the browser | A tool the page registers later raises the count | @smoke | `features/04-page-card-and-following-the-browser.feature` | npm run test:bdd |
| F04.11 | The page card and following the browser | A page that changes in a loop causes one refresh and no repeated file reads | @unit | `test/ui/panel-follow.test.ts` | unit test |
| F05.1 | Allowing and forgetting a site | A page that is not allowed yet shows one line and an Allow button, and nothing is read | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F05.2 | Allowing and forgetting a site | Allow asks Chrome, and the toolbar button is the other way in | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F05.3 | Allowing and forgetting a site | Allow names the site in Chrome's request and refuses a site that is not a plain web address | @unit | `test/ui/panel-access.test.ts`, `test/adapters/site-access.test.ts` | unit test |
| F05.4 | Allowing and forgetting a site | Denying the site request gives a plain message and keeps the chat usable | @unit | `test/ui/panel-access.test.ts` | unit test |
| F05.5 | Allowing and forgetting a site | The first question on a site asks once for its tools, per session | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F05.6 | Allowing and forgetting a site | Denying the site means the answer uses no tools | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F05.7 | Allowing and forgetting a site | Forgetting a site takes back its tool permission, and the next question asks again | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F05.8 | Allowing and forgetting a site | Forgetting a site removes its memory, its permission and its compatibility mode | @unit | `test/adapters/forget-site.test.ts`, `test/ui/panel-privacy.test.ts` | unit test |
| F05.9 | Allowing and forgetting a site | Forgetting needs a plain web address and changes nothing otherwise | @unit | `test/adapters/forget-site.test.ts`, `test/ui/panel-privacy.test.ts` | unit test |
| F05.10 | Allowing and forgetting a site | Options can forget all sites at once | @smoke | `features/05-allowing-and-forgetting-a-site.feature` | npm run test:bdd |
| F06.1 | The tools list | The tools list shows name, purpose and a read or change mark for every tool | @smoke | `features/06-the-tools-list.feature` | npm run test:bdd |
| F06.2 | The tools list | The tools button separates reads from changes | @smoke | `features/06-the-tools-list.feature` | npm run test:bdd |
| F06.3 | The tools list | A tool whose description carries hidden or instruction-like text is not offered | @smoke | `features/06-the-tools-list.feature` | npm run test:bdd |
| F06.4 | The tools list | A tool is listed only when its name and schema strings are clean | @unit | `test/core/sanitize.test.ts`, `test/security-review/core-review.test.ts` | unit test |
| F06.5 | The tools list | A tool name used twice is neither listed nor run | @unit | `test/adapters/page-bridge-main.test.ts` | unit test |
| F06.6 | The tools list | The tools come from document.modelContext, or navigator.modelContext when that is all there is | @unit | `test/adapters/webmcp-reader.test.ts` | unit test |
| F06.7 | The tools list | A long tool list scrolls inside the card and does not push the chat away | @smoke | `features/06-the-tools-list.feature` | npm run test:bdd |
| F07.1 | Asking with tools that read and tools that change | A question that needs a tool shows the confirmation with site, tool and arguments | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.2 | Asking with tools that read and tools that change | A tool the page marks read-only still asks in the default mode, and says it is read-only | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.3 | Asking with tools that read and tools that change | A tool that may change something carries a warning in the confirmation | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.4 | Asking with tools that read and tools that change | A tool that may change something is marked with a sign as well as a colour | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.5 | Asking with tools that read and tools that change | Deny does not run the tool and the chat says so | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.6 | Asking with tools that read and tools that change | After a denial the model is told that the call was denied | @unit | `test/core/agent-loop-safety.test.ts` | unit test |
| F07.7 | Asking with tools that read and tools that change | Once per site, read-only tools run without asking and tools that change still ask | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.8 | Asking with tools that read and tools that change | A tool the page marks read-only and consequential is treated as one that changes things | @unit | `test/core/gate.test.ts`, `test/security-review/panel-review.test.ts` | unit test |
| F07.9 | Asking with tools that read and tools that change | A tool that changed after it was listed is refused | @unit | `test/core/agent-loop-safety.test.ts` | unit test |
| F07.10 | Asking with tools that read and tools that change | A run stays on the site it started on; leaving the site ends it before anything is asked | @unit | `test/core/agent-loop-safety.test.ts` | unit test |
| F07.11 | Asking with tools that read and tools that change | A call waiting in a dialog is denied when the tab moves to another site | @smoke | `features/07-asking-with-tools.feature` | npm run test:bdd |
| F07.12 | Asking with tools that read and tools that change | Only the page's own tools can run: no navigation, no form filling, no downloads | @unit | `test/scripts/check-dist.test.ts`, `test/adapters/page-bridge-main.test.ts` | unit test |
| F08.1 | Stop, step limit and the repeated-call stop | Stop and Escape end a running answer and the chat stays usable | @unit | `test/ui/panel-controller.test.ts` | unit test |
| F08.2 | Stop, step limit and the repeated-call stop | Escape in the confirmation dialog denies the call | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.3 | Stop, step limit and the repeated-call stop | Stop is disabled when nothing is running | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.4 | Stop, step limit and the repeated-call stop | The step limit ends a run that keeps calling tools | @unit | `test/core/agent-loop.test.ts` | unit test |
| F08.5 | Stop, step limit and the repeated-call stop | The step limit shows its message and how to raise it | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.6 | Stop, step limit and the repeated-call stop | A tool call the model repeats is not run again, and a second repeat ends the question | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.7 | Stop, step limit and the repeated-call stop | A malformed reply gets one repair try, then a visible error | @unit | `test/core/agent-loop-safety.test.ts` | unit test |
| F08.8 | Stop, step limit and the repeated-call stop | A call to a tool the page does not have gets one repair try and no confirmation | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.9 | Stop, step limit and the repeated-call stop | Arguments the tool does not accept get one automatic retry, then a message | @smoke | `features/08-stop-step-limit-and-repeated-call.feature` | npm run test:bdd |
| F08.10 | Stop, step limit and the repeated-call stop | The settings clamp the step limit between 1 and 12 | @unit | `test/adapters/settings.test.ts` | unit test |
| F08.11 | Stop, step limit and the repeated-call stop | A repeated call gets the earlier result once, then ends the question with an answer from the results | @unit | `test/core/agent-loop-repeat.test.ts`, `test/core/repeat.test.ts` | unit test |
| F08.12 | Stop, step limit and the repeated-call stop | The retry after a missed argument quotes the fields the tool takes | @unit | `test/core/agent-loop-repeat.test.ts`, `test/core/tool-signature.test.ts` | unit test |
| F09.1 | Untrusted page content and injected instructions | A tool result is shown as page content and marked untrusted | @smoke | `features/09-untrusted-content.feature` | npm run test:bdd |
| F09.2 | Untrusted page content and injected instructions | Text that tries to close the data fence or to start a new turn cannot do so | @unit | `test/security/adversarial-core.test.ts`, `test/core/untrusted.test.ts` | unit test |
| F09.3 | Untrusted page content and injected instructions | Hidden characters in page text are removed for the model and shown as escapes to the person | @unit | `test/core/sanitize.test.ts`, `test/security-review/recheck-review.test.ts` | unit test |
| F09.4 | Untrusted page content and injected instructions | Injected text cannot make a consequential call without the confirmation | @unit | `test/security/adversarial-core.test.ts`, `test/core/agent-loop-safety.test.ts` | unit test |
| F09.5 | Untrusted page content and injected instructions | Messages between the parts are checked against their schema and their sender | @unit | `test/security/adversarial-bridge.test.ts`, `test/protocol/validate.test.ts` | unit test |
| F09.6 | Untrusted page content and injected instructions | A tool result is shown as plain text, never as HTML | @unit | `test/ui/panel-ui.test.ts` | unit test |
| F09.7 | Untrusted page content and injected instructions | A page whose tool returns markup and turn markers is shown as text and answered as data | @smoke | `features/09-untrusted-content.feature` | npm run test:bdd |
| F10.1 | What a site publishes besides WebMCP | Nothing is fetched from a site before it is allowed | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.2 | What a site publishes besides WebMCP | Only files of the site's own address are read, and links to other hosts are not followed | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.3 | What a site publishes besides WebMCP | Reads send no cookies, follow no redirect and keep no cache | @unit | `test/adapters/site-page-scripts.test.ts` | unit test |
| F10.4 | What a site publishes besides WebMCP | A site with llms.txt shows a chip for it and the text is available to the model, labelled | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.5 | What a site publishes besides WebMCP | Each known kind of site file is recognised and shown | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.6 | What a site publishes besides WebMCP | A missing file that comes back as an HTML page is not a file | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.7 | What a site publishes besides WebMCP | A file over the size cap is cut or ignored, and a stalled file ends at the time limit | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.8 | What a site publishes besides WebMCP | At most eight files are read per page load | @unit | `test/core/site-files.test.ts`, `test/adapters/site-files.test.ts` | unit test |
| F10.9 | What a site publishes besides WebMCP | A site file that is missing, unreadable or too large leaves no chip and no error | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.10 | What a site publishes besides WebMCP | A site file that contains instructions is only data, and adds no tool | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.11 | What a site publishes besides WebMCP | Every item from a site file is labelled with its source | @unit | `test/ui/panel-site.test.ts`, `test/core/site-facts.test.ts` | unit test |
| F10.12 | What a site publishes besides WebMCP | A site that signals "no AI input" shows it, and nothing from the site reaches the model | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.13 | What a site publishes besides WebMCP | The signal rules are decided in one place | @unit | `test/core/site-small-readers.test.ts` | unit test |
| F10.14 | What a site publishes besides WebMCP | A rights reservation for training is not a ban on reading | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.15 | What a site publishes besides WebMCP | Nothing from site files is stored, and it is cleared on navigation and on Forget | @unit | `test/core/agent-loop-site.test.ts`, `test/ui/panel-site.test.ts` | unit test |
| F10.16 | What a site publishes besides WebMCP | The reader works on a page whose own security policy forbids connections | @smoke | `features/10-site-information.feature` | npm run test:bdd |
| F10.17 | What a site publishes besides WebMCP | On the live AgenticSystemCore site the files are found as published | @manual | `features/10-site-information.feature` | manual check |
| F10.18 | What a site publishes besides WebMCP | Each file read ends after 5 seconds and all reads of a page load after 10 | @unit | `test/adapters/site-files.test.ts`, `test/adapters/site-page-scripts.test.ts` | unit test |
| F11.1 | AgenticSystemCore node mode | A page that registers the ten node tools, or links its linkset, is a node | @unit | `test/core/node-mode.test.ts`, `test/ui/page-status.test.ts` | unit test |
| F11.2 | AgenticSystemCore node mode | A page with only some of the names and no linkset is not a node | @unit | `test/core/node-mode.test.ts` | unit test |
| F11.3 | AgenticSystemCore node mode | The node hint is added to the model's instructions only in node mode | @unit | `test/core/agent-loop.test.ts`, `test/core/prompt.test.ts` | unit test |
| F11.4 | AgenticSystemCore node mode | Questions recorded on a real node replay with the same tool calls | @unit | `test/replay/agsc-replay.test.ts` | unit test |
| F11.5 | AgenticSystemCore node mode | A linkset whose anchor is another site does not make the page a node | @unit | `test/core/site-facts.test.ts`, `test/ui/panel-site.test.ts` | unit test |
| F11.6 | AgenticSystemCore node mode | A node page shows the node badge and chips for its knowledge files | @smoke | `features/11-agentic-system-core-node-mode.feature` | npm run test:bdd |
| F11.7 | AgenticSystemCore node mode | A node page with no tools on this page says where to look | @smoke | `features/11-agentic-system-core-node-mode.feature` | npm run test:bdd |
| F11.8 | AgenticSystemCore node mode | On the live node a question is answered with its tools and knowledge links | @manual | `features/11-agentic-system-core-node-mode.feature` | manual check |
| F12.1 | Read this page on a page without WebMCP | Read this page puts the page text in the chat as untrusted content | @smoke | `features/12-read-this-page.feature` | npm run test:bdd |
| F12.2 | Read this page on a page without WebMCP | A question after reading is answered, and the page text is used once | @smoke | `features/12-read-this-page.feature` | npm run test:bdd |
| F12.3 | Read this page on a page without WebMCP | Page text read on one site is not sent when the question is on another | @unit | `test/ui/panel-safety.test.ts`, `test/ui/panel-controller.test.ts` | unit test |
| F12.4 | Read this page on a page without WebMCP | The page text is cut at a fixed size, and a page that cannot be scripted says how to allow it | @unit | `test/adapters/page-reader.test.ts` | unit test |
| F12.5 | Read this page on a page without WebMCP | A site that says "no AI input" is not read by Read this page | @smoke | `features/12-read-this-page.feature` | npm run test:bdd |
| F13.1 | Errors and offline use | Lost graphics device is reported with a way forward | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.2 | Errors and offline use | No model loaded: the question gets the same hint and nothing runs | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.3 | Errors and offline use | A tool that throws becomes a failed result the model can see | @unit | `test/core/agent-loop.test.ts` | unit test |
| F13.4 | Errors and offline use | A tool that fails on the page shows a failed result and the answer goes on | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.5 | Errors and offline use | The page does not answer | @unit | `test/adapters/tool-router.test.ts`, `test/core/agent-loop-safety.test.ts` | unit test |
| F13.6 | Errors and offline use | A full context drops the oldest saved turns, never the question or the run's own results | @unit | `test/core/history.test.ts`, `test/core/agent-loop-safety.test.ts` | unit test |
| F13.7 | Errors and offline use | Offline, a note says what still works | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.8 | Errors and offline use | Offline with no model on this computer, Start explains | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.9 | Errors and offline use | An unexpected error offers to copy its details, without page content | @smoke | `features/13-errors-and-offline.feature` | npm run test:bdd |
| F13.10 | Errors and offline use | A model that fails to load shows why, and Start can be pressed again | @unit | `test/ui/panel-controller.test.ts` | unit test |
| F13.11 | Errors and offline use | A graphics device lost while answering stops the model line saying "Ready" and shows no library text | @unit | `test/ui/panel-problems.test.ts`, `test/adapters/model-errors.test.ts`, `test/adapters/model-host.test.ts` | unit test |
| F13.12 | Errors and offline use | A chat on an engine that is no longer loaded says the model stopped, and Start loads it again | @unit | `test/adapters/webllm-runtime.test.ts`, `test/ui/panel-problems.test.ts` | unit test |
| F13.13 | Errors and offline use | A bigger model prefills in shorter chunks, so one chunk stays under the graphics driver's time limit | @unit | `test/adapters/prefill-chunk.test.ts` | unit test |
| F14.1 | Memory, export and forget | Memory keeps the chat and the tool counts of each site, across restarts | @unit | `test/adapters/indexeddb-memory.test.ts` | unit test |
| F14.2 | Memory, export and forget | With Memory off nothing is kept | @unit | `test/adapters/no-memory.test.ts` | unit test |
| F14.3 | Memory, export and forget | Clear memory in Options says so | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.4 | Memory, export and forget | Export with nothing to export says so | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.5 | Memory, export and forget | Export writes the chat as a Markdown file with site, time and model | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.6 | Memory, export and forget | Export leaves out the endpoint key and values of secret-looking arguments | @unit | `test/security/adversarial-export.test.ts`, `test/ui/panel-privacy.test.ts` | unit test |
| F14.7 | Memory, export and forget | Export cannot be steered: links, images and HTML in answers are escaped | @unit | `test/core/export.test.ts` | unit test |
| F14.8 | Memory, export and forget | The exported file says it was written by a local AI model | @unit | `test/core/export.test.ts` | unit test |
| F14.9 | Memory, export and forget | Saved tool results are fenced as untrusted when they come back into a prompt | @unit | `test/core/agent-loop-saved.test.ts` | unit test |
| F14.10 | Memory, export and forget | Going back to a site shows its saved chat again, with Memory on | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.11 | Memory, export and forget | With Memory off, the empty chat says that chats are not kept | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.12 | Memory, export and forget | Another site during an answer stops it, and a note says why | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F14.13 | Memory, export and forget | Another page of the same site does not stop the answer | @smoke | `features/14-memory-export-and-forget.feature` | npm run test:bdd |
| F15.1 | Options | Saving the options says "Saved." | @smoke | `features/15-options.feature` | npm run test:bdd |
| F15.2 | Options | Reset restores the defaults | @smoke | `features/15-options.feature` | npm run test:bdd |
| F15.3 | Options | A saved choice comes back when Options is opened again | @smoke | `features/15-options.feature` | npm run test:bdd |
| F15.4 | Options | A plain http endpoint on another computer, or an endpoint without a model name, is refused | @unit | `test/ui/options-page.test.ts`, `test/adapters/endpoint-runtime.test.ts` | unit test |
| F15.5 | Options | Saving an endpoint asks Chrome for access to that address only | @unit | `test/ui/options-page.test.ts` | unit test |
| F15.6 | Options | Missing or foreign values in the stored settings fall back to safe defaults | @unit | `test/adapters/settings.test.ts` | unit test |
| F15.7 | Options | The endpoint key never appears in the model's instructions | @unit | `test/ui/panel-privacy.test.ts` | unit test |
| F15.8 | Options | Options offers the CPU model and its size, the graphics card model, and Chrome's built-in model | @smoke | `features/15-options.feature` | npm run test:bdd |
| F16.1 | Keyboard-only and screen-reader use | The side panel has no accessibility violations at rest, with Help and in dark mode | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.2 | Keyboard-only and screen-reader use | The Options page has no accessibility violations | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.3 | Keyboard-only and screen-reader use | The panel fits 320 pixels without sideways scrolling | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.4 | Keyboard-only and screen-reader use | Tab reaches every control in order, each with a visible focus ring | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.5 | Keyboard-only and screen-reader use | The confirmation dialog is accessible, puts focus on Deny and keeps Tab inside | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.6 | Keyboard-only and screen-reader use | The status lines are live regions and the conversation is a log | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.7 | Keyboard-only and screen-reader use | Errors are announced once in an alert, and download progress every ten percent only | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.8 | Keyboard-only and screen-reader use | A finished answer is read once, and the streaming draft is hidden from screen readers | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.9 | Keyboard-only and screen-reader use | Reduced motion turns off animation, and 200 percent zoom loses no text | @smoke | `features/16-keyboard-and-screen-reader.feature` | npm run test:bdd |
| F16.10 | Keyboard-only and screen-reader use | A screen reader announces the page status, the model status and each answer once | @manual | `features/16-keyboard-and-screen-reader.feature` | manual check |
| F17.1 | Privacy: which hosts are contacted | A whole session with the scripted model contacts no host except the page's own | @smoke | `features/17-privacy.feature` | npm run test:bdd |
| F17.2 | Privacy: which hosts are contacted | Every host named in the code is in the privacy page | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F17.3 | Privacy: which hosts are contacted | Before page text goes to a remote endpoint the panel says so | @unit | `test/ui/panel-privacy.test.ts` | unit test |
| F17.4 | Privacy: which hosts are contacted | No script or model library comes from the web | @smoke | `features/17-privacy.feature` | npm run test:bdd |
| F17.5 | Privacy: which hosts are contacted | The package has no remote code, no eval, and the policy allows only its own scripts and wasm | @unit | `test/scripts/check-remote-code.test.ts`, `test/security-review/dist-review.test.ts` | unit test |
| F17.6 | Privacy: which hosts are contacted | A network log of a full session on the maintainer's computer shows only the recorded model hosts | @manual | `features/17-privacy.feature` | manual check |
| F17.7 | Privacy: which hosts are contacted | Dependencies are pinned and the workflows pin every action to a commit | @unit | `test/scripts/workflows.test.ts` | unit test |
| F18.1 | The background worker restarts | After the worker restarts the chat is kept and the tools are listed again | @smoke | `features/18-service-worker-restart.feature` | npm run test:bdd |
| F18.2 | The background worker restarts | A processor model that is ready still answers after the worker restarts, with no new download | @smoke @cpu | `features/18-service-worker-restart.feature` | npm run test:bdd, CPU run |
| F18.3 | The background worker restarts | The model runs in the offscreen document first, then in the worker, and the panel says where | @unit | `test/adapters/host-choice.test.ts`, `test/ui/panel-controller.test.ts` | unit test |
| F18.4 | The background worker restarts | Site grants live in session storage and a value that is not a list is ignored | @unit | `test/adapters/session-site-grants.test.ts` | unit test |
| F19.1 | Compatibility mode | The click asks for the site, registers the polyfill at document start, then reloads the page | @unit | `test/adapters/compat-mode.test.ts`, `test/ui/panel-controller.test.ts` | unit test |
| F19.2 | Compatibility mode | Compat mode is not turned on twice, and a refused site changes nothing | @unit | `test/adapters/compat-mode.test.ts` | unit test |
| F19.3 | Compatibility mode | Compat mode accepts one exact http or https site and nothing wider | @unit | `test/adapters/compat-mode.test.ts`, `test/security-review/host-review.test.ts` | unit test |
| F19.4 | Compatibility mode | Without a web page, compat mode says to open one | @smoke | `features/19-compatibility-mode.feature` | npm run test:bdd |
| F19.5 | Compatibility mode | After compat mode a page without WebMCP shows tools registered by the polyfill | @manual | `features/19-compatibility-mode.feature` | manual check |
| F19.6 | Compatibility mode | Forgetting the site removes the polyfill registration and the site access | @unit | `test/adapters/compat-mode.test.ts` | unit test |
| F20.1 | Security and governance requirements that can be observed | The adversarial suites pass: injection, hint lies, oversize results, wrong senders | @unit | `test/security/adversarial-core.test.ts`, `test/security/adversarial-bridge.test.ts` | unit test |
| F20.2 | Security and governance requirements that can be observed | Page text, tool results and replies are capped, and the run has a step cap | @unit | `test/core/untrusted.test.ts`, `test/core/agent-loop.test.ts` | unit test |
| F20.3 | Security and governance requirements that can be observed | The endpoint reply is limited in size and time, refuses redirects, and sends the key only to its address | @unit | `test/security-review/endpoint-review.test.ts`, `test/adapters/endpoint-runtime.test.ts` | unit test |
| F20.4 | Security and governance requirements that can be observed | No source file writes HTML into a page: no innerHTML, outerHTML or insertAdjacentHTML | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.5 | Security and governance requirements that can be observed | The manifest permissions equal the documented list | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.6 | Security and governance requirements that can be observed | The governance documents exist and the docs name every dependency and model | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.7 | Security and governance requirements that can be observed | The store listing and the README state the limits | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.8 | Security and governance requirements that can be observed | A governance note states the roles and that high-risk uses are out of scope | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.9 | Security and governance requirements that can be observed | The message that carries a site file has a schema and the same checks as the others | @unit | `test/protocol/site-messages.test.ts` | unit test |
| F20.10 | Security and governance requirements that can be observed | Closing the panel ends any run | @unit | `test/core/agent-loop-closed.test.ts`, `test/ui/panel-switch.test.ts` | unit test |
| F20.11 | Security and governance requirements that can be observed | The threat model lists the residual risks and SECURITY.md says how to report a problem | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.12 | Security and governance requirements that can be observed | Every host an extension page may contact is in the privacy page, and the policy decision is recorded | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F20.13 | Security and governance requirements that can be observed | A frame inside the page cannot make the page bridge run a tool | @unit | `test/adapters/page-bridge-main.test.ts`, `test/security/adversarial-bridge.test.ts` | unit test |
| F20.14 | Security and governance requirements that can be observed | "Use on this tab anyway" does not carry over to a remote endpoint | @unit | `test/ui/panel-policy.test.ts` | unit test |
| F20.15 | Security and governance requirements that can be observed | A site that says it is a node is shown as saying so, and no hint vouches for its tools | @unit | `test/core/node-mode.test.ts`, `test/ui/panel-site.test.ts`, `test/ui/page-status.test.ts` | unit test |
| F20.16 | Security and governance requirements that can be observed | A tool name with a line break is not listed, so it cannot write a line of the prompt | @unit | `test/core/sanitize.test.ts`, `test/core/compact-prompt.test.ts` | unit test |
| F20.17 | Security and governance requirements that can be observed | For a site that asks for no AI input the panel says which parts are held back | @unit | `test/ui/panel-policy.test.ts`, `test/security-review/docs-review.test.ts` | unit test |
| F20.18 | Security and governance requirements that can be observed | The export is marked as AI-generated in a front-matter block and names the endpoint host when one wrote it | @unit | `test/core/export.test.ts`, `test/ui/panel-export.test.ts` | unit test |
| F20.19 | Security and governance requirements that can be observed | The privacy and governance texts state the saved tool results, the toolbar reads and the per-site exception | @unit | `test/security-review/docs-review.test.ts` | unit test |
| F25.1 | The node's own list, more site facts, the shortcut, diagnostics and storage | Files that match the node's own list get the chip "matches the node's own list" | @unit | `test/ui/panel-node-extras.test.ts`, `test/core/site-node-extras.test.ts` | unit test |
| F25.2 | The node's own list, more site facts, the shortcut, diagnostics and storage | A file that does not match the node's own list is marked and not given to the model | @unit | `test/ui/panel-node-extras.test.ts`, `test/core/site-node-extras.test.ts` | unit test |
| F25.3 | The node's own list, more site facts, the shortcut, diagnostics and storage | The digest is computed over the raw bytes of a body that was read whole | @unit | `test/adapters/site-page-scripts.test.ts` | unit test |
| F25.4 | The node's own list, more site facts, the shortcut, diagnostics and storage | The card shows the node's bundle, item counts and ledger head | @unit | `test/ui/panel-node-extras.test.ts` | unit test |
| F25.5 | The node's own list, more site facts, the shortcut, diagnostics and storage | The page's own link rows and richer JSON-LD are shown as text, same site only | @unit | `test/ui/panel-node-extras.test.ts`, `test/core/site-node-extras.test.ts` | unit test |
| F25.6 | The node's own list, more site facts, the shortcut, diagnostics and storage | The sustainability file is the ninth site file and its signature is only "present" | @unit | `test/ui/panel-node-extras.test.ts`, `test/core/site-node-extras.test.ts`, `test/core/site-files.test.ts` | unit test |
| F25.7 | The node's own list, more site facts, the shortcut, diagnostics and storage | Every Content-Signal value and group of robots.txt is shown, and only the "*" group decides | @unit | `test/ui/panel-node-extras.test.ts`, `test/core/site-node-extras.test.ts` | unit test |
| F25.8 | The node's own list, more site facts, the shortcut, diagnostics and storage | A node shows three starter questions that fill the box and send nothing | @unit | `test/ui/panel-node-extras.test.ts` | unit test |
| F25.9 | The node's own list, more site facts, the shortcut, diagnostics and storage | The node's declared peer is shown as a text chip and is not fetched | @unit | `test/ui/panel-node-extras.test.ts` | unit test |
| F25.10 | The node's own list, more site facts, the shortcut, diagnostics and storage | The status line says why a page has no tools | @unit | `test/ui/page-status.test.ts`, `test/adapters/page-bridge-main.test.ts` | unit test |
| F25.11 | The node's own list, more site facts, the shortcut, diagnostics and storage | The manifest declares one shortcut, for the toolbar button, and no permission | @unit | `test/scripts/manifest-shortcut.test.ts`, `test/scripts/check-dist.test.ts` | unit test |
| F25.12 | The node's own list, more site facts, the shortcut, diagnostics and storage | The shortcut opens the side panel like the toolbar button | @manual | `features/25-node-extras-shortcut-diagnostics-storage.feature` | manual check |
| F25.13 | The node's own list, more site facts, the shortcut, diagnostics and storage | Copy diagnostics shows what it copies, then copies exactly that on a second click | @unit | `test/ui/diagnostics.test.ts`, `test/core/diagnostics.test.ts` | unit test |
| F25.14 | The node's own list, more site facts, the shortcut, diagnostics and storage | Diagnostics hold no page text, no address and no key | @unit | `test/ui/diagnostics.test.ts`, `test/core/diagnostics.test.ts` | unit test |
| F25.15 | The node's own list, more site facts, the shortcut, diagnostics and storage | Persistent storage is asked once, after the first successful download | @unit | `test/ui/storage-p2.test.ts` | unit test |
| F25.16 | The node's own list, more site facts, the shortcut, diagnostics and storage | Options shows the total size of the downloaded models | @unit | `test/ui/storage-p2.test.ts` | unit test |

### Requirement rows

| Requirement | Scenarios |
|---|---|
| ASI01-1 | F07.6, F09.2, F09.4, F20.1 |
| ASI02-1 | F07.9, F20.1 |
| ASI02-2 | F06.4, F06.5 |
| ASI03-1 | F05.1, F20.3 |
| ASI03-2 | F19.3 |
| ASI04-1 | F17.5 |
| ASI04-2 | F10.10 |
| ASI05-1 | F17.5 |
| ASI06-1 | F14.9 |
| ASI07-1 | F09.5, F20.13 |
| ASI07-2 | F20.9 |
| ASI08-1 | F10.9 |
| ASI09-1 | F07.4 |
| ASI09-2 | F10.11, F20.15 |
| ASI10-1 | F08.1, F20.10 |
| CWS-1 | F17.4 |
| CWS-10 | F01.1, F05.1 |
| CWS-11 | F04.6, F04.7, F10.1 |
| CWS-2 | F01.9, F20.5 |
| CWS-3 | F01.9 |
| CWS-4 | F17.2, F20.19 |
| CWS-5 | F03.1 |
| CWS-6 | F17.1 |
| CWS-7 | F20.7 |
| CWS-8 | F17.5 |
| CWS-9 | F20.12 |
| EU-1 | F01.2 |
| EU-2 | F14.5, F14.8, F20.18 |
| EU-3 | F01.2 |
| EU-5 | F20.8 |
| LLM01-1 | F09.1, F09.2 |
| LLM01-2 | F09.3 |
| LLM01-3 | F06.4, F20.16 |
| LLM01-4 | F10.10 |
| LLM01-5 | F14.9 |
| LLM02-1 | F17.1 |
| LLM02-2 | F14.5, F14.6 |
| LLM02-3 | F17.3 |
| LLM02-4 | F10.2 |
| LLM03-1 | F17.5 |
| LLM03-2 | F17.7 |
| LLM03-3 | F03.1, F03.5 |
| LLM03-4 | F17.2 |
| LLM05-1 | F09.6, F14.7, F20.4 |
| LLM05-2 | F09.5 |
| LLM05-3 | F10.2 |
| LLM06-1 | F05.5, F07.1, F07.5, F20.1, F20.13 |
| LLM06-2 | F07.12, F20.5 |
| LLM06-3 | F07.1 |
| LLM06-4 | F07.10 |
| LLM07-1 | F15.7 |
| LLM09-1 | F01.7 |
| LLM09-2 | F09.1 |
| LLM10-1 | F08.4, F08.6, F08.11, F15.3, F20.2, F20.3 |
| LLM10-2 | F10.7, F10.8, F10.18 |
| LLM10-3 | F04.11 |
| NIST-600-CF | F01.7 |
| NIST-600-DP | F17.1, F20.19 |
| NIST-600-HAI | F01.7 |
| NIST-600-II | F10.11 |
| NIST-600-IP | F10.12, F20.17 |
| NIST-600-IS | F20.13, F20.14 |
| NIST-600-VC | F20.6 |
| NIST-GV-1 | F20.6 |
| NIST-ME-1 | F20.1 |
| NIST-ME-2 | F02.4 |
| NIST-MG-1 | F20.11 |
| NIST-MG-2 | F03.8, F05.7, F05.10, F08.1 |
| NIST-MP-1 | F20.6 |
| NIST-MP-2 | F20.7 |
| R4-1 | F10.1 |
| R4-10 | F10.12, F10.13, F10.14, F20.14, F20.17 |
| R4-11 | F10.9 |
| R4-12 | F10.15 |
| R4-13 | F10.16 |
| R4-14 | F10.17 |
| R4-2 | F10.2 |
| R4-3 | F10.3 |
| R4-4 | F10.18 |
| R4-5 | F10.6 |
| R4-6 | F10.7 |
| R4-7 | F10.4, F11.6 |
| R4-8 | F11.5 |
| R4-9 | F10.10 |

<!-- scenarios:end -->
<!-- prettier-ignore-end -->
