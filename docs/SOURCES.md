# Sources

Primary sources read for the design, with the date each was fetched. Facts that change often are re-checked before each release.

## 1. WebMCP specification and repository

- URLs: <https://webmachinelearning.github.io/webmcp/>, <https://github.com/webmachinelearning/webmcp>, <https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md>
- Fetched 12 Nov 2026.
- The spec is a Draft Community Group Report dated 11 November 2026 (Web Machine Learning Community Group). It is not a W3C Standard and is not on the Standards Track. The repository page shows 179 commits but no latest-commit date.
- Entry point is `document.modelContext`, defined by a partial interface on `Document`. The spec text does not mention `navigator.modelContext`. `provideContext` does not appear in the spec or the repository page.
- Interface (`[Exposed=Window, SecureContext] interface ModelContext : EventTarget`): `registerTool(ModelContextTool tool, optional options)` returns `Promise<undefined>`; `getTools(optional options)` returns `Promise<sequence<RegisteredTool>>`; `executeTool(RegisteredTool tool, optional object inputObject, optional options)` returns `Promise<DOMString>` (the stringified result). Event handler attributes: `ontoolchange`, `ontoolactivated`, `ontoolcancel`. The activated and cancel events expose a read-only `toolName`.
- `executeTool` takes the `RegisteredTool` object returned by `getTools`, not a tool name.
- `registerTool` options: `signal` (aborting it unregisters the tool) and `exposedTo` (list of origins). `getTools` option: `fromOrigins`; by default only same-origin documents are included. `executeTool` option: `signal`.
- Tool descriptor (`ModelContextTool`): required `name`, `description`, `execute`; optional `title`, `inputSchema` (object), `outputSchema` (object), `annotations`.
- Annotations: `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging`; all default to false.
- `getTools()` entries (`RegisteredTool`) do not include `execute`. They carry `name`, `title` (empty string if unset), `description`, `window`, `origin`, `annotations`, and `inputSchema` / `outputSchema` as parsed JavaScript objects (undefined when not provided), not strings.
- Permissions Policy feature name is `tools`, default allowlist `'self'`. It gates `registerTool()`, `getTools()` and `executeTool()`.
- `executeTool` rejects with `NotFoundError` when the origin does not match, the tool name is not in the target document's tool map, or the tool is not exposed to the caller's origin.
- JSON Schema: the spec cites JSON Schema 2020-12 core as a normative reference but no body text ties `inputSchema` to a draft; the IDL types it only as `object`.
- Implementation status: Chrome origin trial live in Chrome 149; local development flag `about:flags#enable-webmcp-testing` (the Chrome article writes `chrome://flags/#enable-webmcp-testing`); Edge origin trial live in Edge 150; Brave experimental in Leo AI chat; Firefox and Safari have standards-position issues only. The repository also holds `continuations-explainer.md`, `declarative-api-explainer.md`, `security-privacy-questionnaire.md` and `docs/service-workers.md`.

Difference from earlier notes: none. The shape `navigator.modelContext.registerTool` plus `provideContext` is not current; the current shape is `document.modelContext` with `registerTool`, `getTools`, `executeTool` and no `provideContext`.

## 2. Chrome WebMCP article

- URL: <https://developer.chrome.com/docs/ai/webmcp>
- Fetched 12 Nov 2026.
- "Chrome Extensions can query and execute WebMCP tools with content scripts."
- The article names two example extensions: an agentic one that uses a local Node server, and a tool inspector that needs a Gemini API key.
- Flag `chrome://flags/#prompt-api-tool-use` enables a client-side option with the Prompt API; the page says it needs no API keys and data stays on the device.
- Flag `chrome://flags/#enable-webmcp-testing` is for local development: set to Enabled and relaunch.
- "Join the WebMCP origin trial from Chrome 149."
- Both the imperative API (JavaScript tool definitions) and the declarative API (annotated HTML forms) are gated by the `tools` Permissions Policy. The article does not name the entry-point object.

Difference from earlier notes: none.

## 3. Chrome Prompt API

- URL: <https://developer.chrome.com/docs/ai/prompt-api>
- Fetched 12 Nov 2026.
- Global name is `LanguageModel`. `availability()` takes the same options as `prompt()`; the page names `downloading` and `unavailable` and tests `available !== 'unavailable'`; it does not list the full set of return values.
- `LanguageModel.params()` is available only in Chrome Extensions and returns `defaultTopK`, `maxTopK`, `defaultTemperature`, `maxTemperature` (example: 3, 128, 1, 2).
- `create()` options: `signal`, `monitor` (download progress), `initialPrompts`, `expectedInputs`, `expectedOutputs` (languages en, ja, es, de, fr), `temperature` and `topK` (extensions only; give both or neither), `samplingMode` (web only, origin trial).
- Tool use is not documented on this page; the words tool, tools and function calling do not appear.
- Versions: Prompt API in extensions from Chrome 138; on the web Chrome 148; sampling parameters in extensions Chrome 148.
- Hardware: Windows 10 or 11, macOS 13 or later, Linux, ChromeOS on Chromebook Plus; at least 22 GB free on the profile volume; strictly more than 4 GB VRAM; 16 GB RAM or more and 4 CPU cores or more; unmetered network for the first download only. The model is removed if free space falls below 10 GB.

Difference from earlier notes: none found; tool use remains undocumented here and is reachable only through the flag described in topic 2.

Read again on 13 Nov 2026 (page updated 21 Oct 2026, and the explainer at github.com/webmachinelearning/prompt-api) for the built-in model runtime:

- Session size: `contextWindow`, `contextUsage` and `measureContextUsage()`; the older names `inputQuota`, `inputUsage`, `measureInputUsage()` are deprecated. On overflow the oldest non-system prompt pair is dropped; an input that cannot fit rejects with `QuotaExceededError` carrying `requested` and `contextWindow`.
- `prompt()` and `promptStreaming()` take `responseConstraint` (a JSON Schema) and `omitResponseConstraintInput`; with the latter the schema does not count against the window.
- Not from Chrome's page, from forum and blog reports (marked reported in the code and the panel): a window of about 9,216 tokens; `create()` starts the download only with user activation; the model needs the official Chrome build and is removed after 30 days without use. The code reads the window at run time and hard-codes none of these.

## 4. WebLLM

- URLs: <https://github.com/mlc-ai/web-llm>, <https://registry.npmjs.org/@mlc-ai/web-llm/latest>, <https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts>, <https://github.com/mlc-ai/web-llm/tree/main/examples>
- Fetched 12 Nov 2026.
- npm latest is 0.2.88, licence Apache-2.0.
- README API names: `CreateMLCEngine`, `CreateWebWorkerMLCEngine` (returns a `WebWorkerMLCEngine`), `CreateServiceWorkerMLCEngine`, and `ServiceWorkerMLCEngineHandler`. `CreateExtensionServiceWorkerMLCEngine` and an extension handler are not mentioned in the README.
- Function calling is described as work in progress: `tools` and `tool_choice` have preliminary support, and manual function calling without those fields is available. In `config.ts` the `functionCallingModelIds` list contains only Hermes models.
- Examples folder (28 entries): abort-reload, cache-usage, chrome-extension-webgpu-service-worker, chrome-extension, embeddings, function-calling, get-started-latency-breakdown, get-started-web-worker, get-started, integrity-verification, json-mode, json-schema, logit-processor, multi-models, multi-round-chat, next-simple-chat, qwen3, resumable-generation, seed-to-reproduce, service-worker, simple-chat-js, simple-chat-ts, simple-chat-upload, streaming, structural-tag-tool-use, subgroups-usage, text-completion, vision-model.
- Extension examples: `examples/chrome-extension` (no persistent background) and `examples/chrome-extension-webgpu-service-worker` (a service worker keeps the engine in the background).
- Model records in `config.ts`: `Llama-3.2-3B-Instruct-q4f16_1-MLC` has `vram_required_MB` 2263.69, context window 4096, `low_resource_required` true. `Qwen3-0.6B-q4f16_1-MLC` has 1403.34, context window 4096, `low_resource_required` true. Other Qwen3 0.6B ids: `-q4f32_1-MLC` 1924.98, `-q0f16-MLC` 2220.38, `-q0f32-MLC` 3843.25. Other Qwen3 sizes listed: 1.7B, 4B, 8B (q4f16_1 and q4f32_1).

Difference from earlier notes: none, apart from the exact version and the missing extension-specific engine factory; the extension example folders are the reference for extension wiring.

## 5. Offscreen documents

- URL: <https://developer.chrome.com/docs/extensions/reference/api/offscreen>
- Fetched 12 Nov 2026.
- `Reason` values: TESTING, AUDIO_PLAYBACK, IFRAME_SCRIPTING, DOM_SCRAPING, BLOBS, DOM_PARSER, USER_MEDIA, DISPLAY_MEDIA, WEB_RTC, CLIPBOARD, LOCAL_STORAGE, WORKERS, BATTERY_STATUS, MATCH_MEDIA, GEOLOCATION.
- `WORKERS` is present ("the document needs to spawn workers"). No reason mentions machine learning, inference or WebGPU.
- An extension can have only one open offscreen document at a time; with split-mode incognito, the normal and incognito profiles can each have one.
- Lifetime: AUDIO_PLAYBACK closes the document after 30 seconds without audio; other reasons set no lifetime limit. `closeDocument()` closes it.
- Only the `runtime` extension API is available. Offscreen documents cannot be focused and `opener` is always null.
- Versions: the API is listed from Chrome 109; `runtime.getContexts()` needs Chrome 116; `hasDocument()` needs Chrome 150.

Difference from earlier notes: none.

## 6. Manifest content security policy

- URL: <https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy>
- Fetched 12 Nov 2026.
- Enforced minimum for `extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`. "The `extension_pages` policy cannot be relaxed beyond this minimum value."
- `'unsafe-eval'` is not allowed; adding it causes an install-time error.
- `'wasm-unsafe-eval'` is part of the minimum, so WebAssembly runs. The default policy `script-src 'self'; object-src 'self';` disables WebAssembly and inline script.
- Other script sources cannot be added; only local scripts and objects from the package load.
- Sandbox pages have a lenient default policy that permits `'unsafe-inline'` and `'unsafe-eval'`, but they have no access to extension APIs.

Difference from earlier notes: none.

## 7. Ajv and Content Security Policy

- URLs: <https://ajv.js.org/security.html>, <https://ajv.js.org/standalone.html>
- Fetched 12 Nov 2026.
- Browser use with CSP requires `script-src` to include `'unsafe-eval'`, which the page says "is NOT recommended in a secure CSP".
- The standalone page states one benefit is to "avoid dynamic code evaluation with Function constructor (used for schema compilation)" when the page Content Security Policy prohibits it.
- Documented alternative: compile schemas ahead of time with the CLI or in build code; the output is a JavaScript file that exports validation functions usable without initialising Ajv.
- The security page does not itself use the words `new Function`; the standalone page names the Function constructor.

Difference from earlier notes: none.

## 8. Chrome Web Store policies

- URLs: <https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines>, <https://developer.chrome.com/docs/webstore/program-policies/permissions>
- Fetched 12 Nov 2026.
- Single purpose: "An extension must have a single purpose that is narrow and easy to understand."
- Permissions: "Request access to the narrowest permissions necessary to implement your Product's features or services."
- Where several permissions could work, the developer must request the one with the least access to data or functionality.
- Permissions must not be requested for features that do not exist yet.
- The permissions page does not mention host permissions.

Difference from earlier notes: none.

## 9. WebMCP polyfill

- URLs: <https://registry.npmjs.org/@w3c/webmcp-polyfill/latest>, <https://github.com/w3c-oss/webmcp-polyfill>
- Fetched 12 Nov 2026.
- Version 0.1.0, licence Apache-2.0, description "A polyfill for WebMCP", dependency `webmcp-types` ^0.1.9.
- Repository: `w3c-oss/webmcp-polyfill`, 26 commits shown, no releases listed.
- The README installs `document.modelContext` ("It installs `document.modelContext` as soon as it runs") and never mentions `navigator.modelContext`. Neither entry point replaces a native `document.modelContext`, even a partial one.

Difference from earlier notes: none.

## 10. MCP tool schema

- URLs: <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>, <https://modelcontextprotocol.io/specification/2026-07-28/server/tools>, <https://modelcontextprotocol.io/specification/versioning>
- Fetched 12 Nov 2026.
- The versioning page states the current protocol version is 2026-07-28. 2025-11-25 is an earlier revision.
- Tool fields in both revisions: `name`, `title` (optional), `description`, `icons` (optional), `inputSchema`, `outputSchema` (optional), `annotations` (optional). The 2025-11-25 page also lists `execution.taskSupport`; the 2026-07-28 page instead adds an `x-mcp-header` property annotation.
- `inputSchema` and `outputSchema` default to JSON Schema 2020-12 when no `$schema` is present; draft-07 is shown as an explicit alternative. `inputSchema` must be an object schema, not null. For no parameters the recommended form is `{ "type": "object", "additionalProperties": false }`.
- Clients must treat annotations as untrusted unless they come from trusted servers.
- Tool names: 1 to 128 characters, letters, digits, underscore, hyphen, dot.
- The tools pages do not list the individual annotation property names, and the schema page was cut off before `ToolAnnotations`. The names (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`) are therefore listed under "Not verified".

Difference from earlier notes: the newest revision is 2026-07-28 rather than 2025-11-25; tool fields are otherwise unchanged.

## 11. WCAG 2.2

- URL: <https://www.w3.org/TR/WCAG22/>
- Fetched 12 Nov 2026.
- Status: W3C Recommendation, dated 12 December 2024.
- The latest-version link is <https://www.w3.org/TR/WCAG22/>; the dated release is <https://www.w3.org/TR/2024/REC-WCAG22-20241212/>.

Difference from earlier notes: none.

## 12. Checked locally

- Date: 12 Nov 2026.
- Chromium 156.0.8078.4 (Playwright 1.64.1) has `document.modelContext` only with
  `--enable-features=WebMCPTesting`; the feature name was read from the Chromium binary next to
  the flag name `enable-webmcp-testing`. With it, `registerTool`, `getTools` and `executeTool`
  work on `http://127.0.0.1`, `getTools()` entries carry `name`, `title` (empty when unset),
  `description`, `origin` and `inputSchema`, and no `annotations` key when none were given.
- The maintainer's run on Windows 10, Chrome 157, AMD gcn-5 found WebGPU with `shader-f16` in the page,
  the service worker and the offscreen document, and native `document.modelContext`
  ([SPIKE.md](SPIKE.md)).
- WebLLM is pinned to 0.2.86 (11 Oct 2026), the newest release at least two weeks old on 12 Nov.
  Its `prebuiltAppConfig` has `Qwen3-0.6B-q4f16_1-MLC` and `Llama-3.2-3B-Instruct-q4f16_1-MLC`,
  with weights on `huggingface.co/mlc-ai` and model libraries on
  `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs`. `extra_body.enable_thinking` exists for
  Qwen3. Its bundle contains no `eval` and no `new Function`.
- `@w3c/webmcp-polyfill` 0.1.0 (3 Nov 2026) exports `installWebMCP()`, which does nothing when
  `document.modelContext` already exists.

## 13. Release-candidate checks (12 Nov 2026)

- Remote code: <https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements>: "the full functionality of an extension must be easily discernible from its submitted code"; external resources "must not contain any logic". <https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code>: "Remotely hosted code, or RHC, is what the Chrome Web Store calls anything that is executed by the browser that is loaded from someplace other than the extension's own files. Things like JavaScript and WASM." It "does not include data or things like JSON or CSS". Decision: the model libraries ship inside the package (two on 12 Nov, four from 14 Nov 2026).
- Model libraries: WebLLM 0.2.86 loads them from `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_86/base/`. The only commit touching that folder is `00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0` (11 Oct 2026, "Rebuild v0_2_86 with current TVM and add Gemma 4"). Files, sizes and SHA-256 in `scripts/model-libs.json`; the files at `main` had the same hashes on 12 Nov 2026. WebLLM's `ModelRecord.integrity.model_lib` takes an SRI hash and checks it before running the library (`lib/integrity.d.ts`).
- Weights: Hugging Face API, `mlc-ai/Qwen3-0.6B-q4f16_1-MLC` sha `8c14ce481d4c692769976ad52afea453a102df19` (last modified 18 Apr 2026), `mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC` sha `1e80abf71e3d17cd564e2d2b63caa15cb226018e` (7 Sep 2025); both `resolve/<sha>/mlc-chat-config.json` URLs answered.
- Store images: <https://developer.chrome.com/docs/webstore/images>: a 128 × 128 icon in the zip; at least one 1280 × 800 or 640 × 400 screenshot; small promo tile 440 × 280 optional.
- Store pages for the runbook and the browser pages: listed with dates in [STORE-RUNBOOK.md](STORE-RUNBOOK.md) and [BROWSERS.md](BROWSERS.md).
- Ollama allowed origins: `envconfig/config.go` on `main` lists localhost origins and `app://`, `file://`, `tauri://`, `vscode-webview://`, `vscode-file://`, plus `OLLAMA_ORIGINS`; no `chrome-extension://`.
- GitHub Actions pins (release dates from the GitHub API): `actions/checkout` v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1` (17 Jul 2026), `actions/setup-node` v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1` (8 Oct 2026), `actions/cache` v6.1.0 `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (23 Jun 2026).
- Dependabot: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>: `cooldown.default-days`; `ignore` with `update-types: version-update:semver-major`.
- `fflate` 0.8.3 (16 May 2026), used to write and read the release zip.

## 14. Test tooling added for the scenarios (13 Nov 2026)

- `playwright-bdd` 9.2.1 (6 Sep 2026, MIT; <https://github.com/vitalets/playwright-bdd>): runs the Gherkin
  files of `features/` as Playwright tests, so the steps use the same browser set-up as the smoke tests.
  Chosen over `@cucumber/cucumber` because it needs no second runner. It is the newest stable release
  at least two weeks old (9.3.x and 10.x on npm are beta or next builds). Peer dependency
  `@playwright/test` >= 1.44 (the repository has 1.64.1). It is a development dependency: nothing of it
  is in the extension. Its own dependencies are the Cucumber Gherkin parser and expression packages (MIT)
  and a few small helpers (`commander`, `cli-table3`, `mime-types`, `tinyglobby`), all pinned by
  `package-lock.json`.

## 15. wllama (llama.cpp in WebAssembly) and the processor models (14 Nov 2026)

- `@wllama/wllama` 3.8.1 (2 Oct 2026, MIT; <https://github.com/ngxson/wllama>), exact pin, the
  newest release at least two weeks old on 13 Nov 2026. It bundles llama.cpp `b11364-46ca246`.
  Nothing replaces it (no earlier CPU runtime). Version 3.13.0 (8 Nov 2026) is younger than two
  weeks; same-major bump from 22 Nov 2026. No dependencies. Read: `npm view`, the package files
  (`esm/index.js`, `esm/*.d.ts`), its README.
- The package has no `exports` and its `main` points to a file that is not there; the extension
  imports `@wllama/wllama/esm/index.js` (the built module with its type files).
- The engine file `esm/wasm/wllama.wasm` is 8,763,949 bytes, SHA-256
  `551f13439366eff11e057b1b91fe46a7fdac29d56d67372d4c5f19a549dfe70c`. The build copies it to
  `model-libs/wllama.wasm` after checking size and hash (`scripts/model-libs.json`, key
  `runtimes`), and `scripts/check-dist.mjs` checks it byte for byte in `dist/`.
- The bundle has two addresses of wllama's compatibility build on `cdn.jsdelivr.net`, used only
  after `setCompat`, which the extension never calls. The build replaces them
  (`wllamaNoRemote` in `scripts/model-libs.mjs`) and fails if the package no longer has exactly two.
- Models (Hugging Face, GGUF, Q4_K_M; address pinned to one commit; size and SHA-256 read from the
  Hugging Face API on 13 Nov 2026 and checked after the download; the file was downloaded and its
  SHA-256 computed on 14 Nov 2026 for the 0.6B model):

  | Model                     | Repository at commit                                                 | File                     | Bytes         | SHA-256                                                            | Licence    |
  | ------------------------- | -------------------------------------------------------------------- | ------------------------ | ------------- | ------------------------------------------------------------------ | ---------- |
  | Qwen3 0.6B (default)      | `unsloth/Qwen3-0.6B-GGUF` `50968a4468ef4233ed78cd7c3de230dd1d61a56b` | `Qwen3-0.6B-Q4_K_M.gguf` | 396,705,472   | `ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a` | Apache-2.0 |
  | Qwen3 1.7B (alternative)  | `unsloth/Qwen3-1.7B-GGUF` `d7f544eead698dbd1f15126ef60b45a1e1933222` | `Qwen3-1.7B-Q4_K_M.gguf` | 1,107,409,472 | `b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897` | Apache-2.0 |
  | Qwen3.5 2B (added 14 Nov) | `unsloth/Qwen3.5-2B-GGUF` `f6d5376be1edb4d416d56da11e5397a961aca8ae` | `Qwen3.5-2B-Q4_K_M.gguf` | 1,280,835,840 | `aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223` | Apache-2.0 |

  The weights are never inside the package; the user's Start downloads them. The panel's model label
  names the size, the memory and the licence (Apache-2.0).

- Not offered, with the reason: Llama 3.2 1B (Llama Community Licence), Gemma 3 (Gemma Terms of
  Use), LFM2.5 (LFM Open Licence), SmolLM2 1.7B (weaker at tools, 8k window), Gemma 3 270M (too
  small for tools), Qwen3.5 0.8B (not yet run through wllama 3.8.1 here), Gemma 4 E2B on the
  processor (its GGUF files are 2.8 GB or more; section 17).
- Measured on 14 Nov 2026, Chromium 156 headless, 16 cores (8 threads used): see
  `docs/eval/EVAL-CPU-0.6b-2026-11-13.json` and the notes of the night. Qwen3's sampling settings for
  replies without reasoning text (temperature 0.7, top-p 0.8, top-k 20) are from the model card.

## 17. Qwen3.5 2B and Gemma 4 E2B (graphics card) and Qwen3.5 2B (processor), read on 14 Nov 2026

- **Qwen3.5 2B, graphics card.** WebLLM 0.2.86's record (`lib/index.js`): `Qwen3.5-2B-q4f16_1-MLC`, library `Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm`, `vram_required_MB` 2245.44, `low_resource_required` false, no `required_features`, `overrides` `context_window_size` 4096 and `max_history_size` 1 (the model keeps a recurrent state; WebLLM keeps one past turn in it). Weights: `https://huggingface.co/api/models/mlc-ai/Qwen3.5-2B-q4f16_1-MLC`, sha `dd74e9c8a20c4546df85c844103bff87b6dcacad` (last modified 29 Mar 2026), 39 files, 1,082,564,401 bytes in all. WebLLM fetches `tensor-cache.json`, the 31 weight shards, `mlc-chat-config.json` and `tokenizer.json`: 1,072,298,012 bytes (the figure the download question shows). SHA-256 of `mlc-chat-config.json` `43577b6de9a4c62cf0fe9c5ee57bc52ebb2fc487c64a21bf78d62431186b4b01` and of `tokenizer.json` `5f9e4d4901a92b997e463c1f46055088b6cca5ca61a6522d1b9f64c4bb81cb42` (the file's LFS object id), both at that revision.
- **Gemma 4 E2B, graphics card only.** Record: `gemma-4-E2B-it-q4f16_1-MLC`, library `gemma-4-E2B-it-q4f16_1_cs512-webgpu.wasm`, `model_manifest` `mlc-model-manifest.json`, `buffer_size_required_bytes` 201,326,592, `vram_required_MB` 3387.37, `low_resource_required` false, `required_features` `["shader-f16"]`, context window 4096. Weights: `mlc-ai/gemma-4-E2B-it-q4f16_1-MLC`, sha `633df598b7a473759367855273c63912c9e2bc9a` (last modified 11 Oct 2026), 94 files, 2,831,045,154 bytes in all; WebLLM fetches the manifest, `tensor-cache.json`, 84 shards, `mlc-chat-config.json` and `tokenizer.json`: 2,830,391,017 bytes. SHA-256 of `mlc-chat-config.json` `7dfac96b8fccab749f888fcecf9540e3a138e6c7e72df2623df280a65a658025`, of `tokenizer.json` `cc8d3a0ce36466ccc1278bf987df5f71db1719b9ca6b4118264f45cb627bfe0f`. The model has no processor entry: its GGUF files are 2.8 GB or more.
- **What WebLLM fetches because of `model_manifest`, and what can be pinned** (`lib/index.js`, `reloadInternal`): the manifest is fetched from the model's address with `fetchWithCache` and parsed (`schema` `mlc.model-package`; it names `mlc-chat-config.json`, `tensor-cache.json` and the chat task). `integrity.config` is checked on the chat config the manifest names, `integrity.tokenizer` on `tokenizer.json`, `integrity.model_lib` on the library. **Not covered:** the manifest itself (SHA-256 `d81d77f9bff4c8271499b10c3dc2ce3a1abbf4df0c42442c289f541fd2abcf7a`, 1,060 bytes), `tensor-cache.json` and the weight shards. They come from the commit-pinned address, whose content does not change, and are not hash-checked by WebLLM. The model-removal code of WebLLM deletes the manifest as well.
- **Libraries.** `Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm` 7,176,151 bytes, SHA-256 `49cc4a96680ea6dad173f48ad90e219ac5f59f7b4bab61ac0029c94385720a2c`; `gemma-4-E2B-it-q4f16_1_cs512-webgpu.wasm` 11,805,413 bytes, SHA-256 `22a0ca1327b6b5d3cf9d0afd27dabfbdb12f5d6e1e0c407ff951402dec36671d`; both from commit `00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0` of `mlc-ai/binary-mlc-llm-libs` (`web-llm-models/v0_2_86/base/`, the same commit as the first two); the files at `main` had the same hashes on 14 Nov 2026; the first two files were re-hashed the same day.
- **Licences.** Qwen3.5 2B: the card of the base model `Qwen/Qwen3.5-2B` (sha `15852e8c16360a2fea060d615a32b45270f8a8fc`, 2 Mar 2026) says `license: apache-2.0`, link <https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/LICENSE>. The MLC repository `mlc-ai/Qwen3.5-2B-q4f16_1-MLC` has **no model card and no licence tag**; its licence is taken from the base model, as for the other MLC repositories (the Qwen3 0.6B one names only its base model). Open point for the owner. Gemma 4 E2B: the card of `mlc-ai/gemma-4-E2B-it-q4f16_1-MLC` says `license: apache-2.0` (licence link <https://ai.google.dev/gemma/docs/gemma_4_license>; the page is the Apache License 2.0 text) and so does the base model `google/gemma-4-E2B-it` (sha `4adf15748de9e1a0097b6274cee9c15836c41c37`, 3 Nov 2026).
- **Qwen3.5 2B, processor.** `unsloth/Qwen3.5-2B-GGUF` at commit `f6d5376be1edb4d416d56da11e5397a961aca8ae` (last modified 2 Mar 2026), file `Qwen3.5-2B-Q4_K_M.gguf`, 1,280,835,840 bytes, SHA-256 (the file's LFS object id from `https://huggingface.co/api/models/unsloth/Qwen3.5-2B-GGUF/tree/f6d5376be1edb4d416d56da11e5397a961aca8ae`) `aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223`; card `license: apache-2.0`, link as above. The repository also holds the vision projector files (668 MB and up); they are not used.
- **Context window.** Both MLC repositories say a window of 4096 tokens through WebLLM's record; the Gemma card says 4,096 tokens with a prefill chunk of 512. The proof that the request fits is `test/adapters/context-fit.test.ts`.

## 16. Runtime dependencies (every package that ships in the extension)

All are pinned to an exact version in `package.json` and `package-lock.json`. Versions and licences
read from `node_modules` and `npm view` on 14 Nov 2026.

| Package                 | Version | Licence    | Used for                                                                                                          |
| ----------------------- | ------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `@mlc-ai/web-llm`       | 0.2.86  | Apache-2.0 | The graphics-card models (section 4)                                                                              |
| `@wllama/wllama`        | 3.8.1   | MIT        | The processor models (section 15)                                                                                 |
| `@w3c/webmcp-polyfill`  | 0.1.0   | MIT        | Compat mode (section 9)                                                                                           |
| `@cfworker/json-schema` | 4.1.1   | MIT        | Checks tool arguments against the tool's schema in the extension, without generating code (published 31 Jan 2025) |
| `ajv`                   | 8.20.0  | MIT        | The same check in Node and in tests, and the build-time message validators (section 7)                            |
| `idb`                   | 8.0.4   | ISC        | A small promise wrapper over IndexedDB for the chat memory (published 6 Oct 2026)                                 |
| `force-graph`           | 1.52.0  | MIT        | The 2D drawing library of the graph explorer (section 20); published 28 Sep 2026                                  |

The models are listed in sections 4 (graphics card), 15 (processor) and 3 (Chrome's built-in model,
which Chrome downloads itself).

## 17. What a site publishes: the files the panel reads (13 Nov 2026)

Read for the research note of 13 Nov 2026; the reader's list is `src/core/site-files.ts`. Recheck the
text of each before quoting it.

| File                             | Defined by                                                                                             | Read as                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `/llms.txt`, `/llms-full.txt`    | llms.txt v2, <https://llmstxt.org/> (modified 10 Aug 2026); `llms-full.txt` is a convention, not in it | Title, summary, sections and link names; the full file is never sent |
| `/.well-known/knowledge-linkset` | The AgenticSystemCore node format (linkset with a node profile); RFC 9264 linksets                     | Node badge, specification version, link names                        |
| `/.well-known/api-catalog`       | RFC 9727, <https://www.rfc-editor.org/rfc/rfc9727>                                                     | API names and documentation links, as text                           |
| `/.well-known/agent-card.json`   | A2A Agent Card                                                                                         | Name and description, as text                                        |
| `/.well-known/security.txt`      | RFC 9116, <https://www.rfc-editor.org/rfc/rfc9116>                                                     | Contact, policy and expiry, as text; never to the model by default   |
| `/robots.txt`                    | RFC 9309; Content Signals, <https://contentsignals.org/>                                               | Only the `Content-Signal` line of the `*` group: the AI policy       |
| `/.well-known/tdmrep.json`       | TDM Reservation Protocol                                                                               | Whether training is reserved                                         |
| JSON-LD in the open page         | schema.org structured data                                                                             | A few labelled facts                                                 |

Not read, with the reason: the MCP server card (its path is not settled on 13 Nov 2026) and the
skills index named by a node's link set (its address would come from a file).

### 17a. Package P2 additions (14 Nov 2026)

| What                                                                                                                                                                              | Source                                                                                                                                                                                                                                                                               | Read        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `/.well-known/sustainability-data`, members `provider`, `measurement-method`, `period`, `energy-consumption`, `carbon-footprint`, `signed` (a file may also be a list of records) | The owner's Internet-Draft `draft-besleaga-sustainability-wellknown` (-12, source in `rfc-sustainability-wellknown/`, read only) and the live file of `https://agenticsystemcore.com/.well-known/sustainability-data` (saved as `fixtures/site-files/agsc-sustainability-data.json`) | 14 Nov 2026 |
| `digest: ["sha-256=:BASE64:"]`                                                                                                                                                    | RFC 9530 Digest Fields, <https://www.rfc-editor.org/rfc/rfc9530>; the live linkset (digest of `llms.txt` recomputed and equal)                                                                                                                                                       | 14 Nov 2026 |
| `_execute_action`, `suggested_key` rules                                                                                                                                          | <https://developer.chrome.com/docs/extensions/reference/api/commands> (a shortcut needs Ctrl or Alt; no separate permission; the page implies, but does not state, that the shortcut runs the `action.onClicked` handler: checked by hand, see MANUAL-CHECKS)                        | 14 Nov 2026 |
| Extension storage, quota, eviction, `persist()`, `unlimitedStorage`                                                                                                               | <https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies> (says nothing about updates, uninstall or OPFS)                                                                                                                                                  | 14 Nov 2026 |
| Measured Chrome built-in model results                                                                                                                                            | `docs/eval/EVAL-NANO-2026-11-14-157.0.8103.52.json`                                                                                                                                                                                                                                  | 14 Nov 2026 |

## 18. Security and governance texts the audit used (13 Nov 2026)

OWASP Top 10 for LLM Applications 2025; OWASP Top 10 for Agentic Applications 2026 (list taken from
secondary pages on the day: re-read the official PDF at release); NIST AI RMF 1.0 (26 Jan 2023) and
AI 600-1, the Generative AI Profile (July 2024); EU AI Act Article 50 (applies from 2 Aug 2026 per the
page read); the Chrome Web Store program policies. Each requirement row is named in a `# req:` comment
above the scenarios of `features/` that prove it ([SCENARIOS.md](SCENARIOS.md)); the controls are in
[THREAT-MODEL.md](THREAT-MODEL.md) and [GOVERNANCE.md](GOVERNANCE.md). The Article 50 mapping was not
read by a lawyer: whether the product is a "provider" in the sense of the Act is for its publisher to
decide.

## 19. OpenRouter API (14 Nov 2026)

- URLs: <https://openrouter.ai/docs/api-reference/overview.md>, <https://openrouter.ai/docs/api-reference/streaming.md>, <https://openrouter.ai/docs/cookbook/administration/usage-accounting.md>, <https://openrouter.ai/api/v1/models> (prices). Read 14 Nov 2026.
- Base address `https://openrouter.ai/api/v1`; chat completions are `POST /api/v1/chat/completions`, OpenAI-compatible, `Authorization: Bearer <key>`; the connection check uses `GET /api/v1/models`.
- Streaming: server-sent events, `data: {json}` lines ended by `data: [DONE]`; keep-alive comments such as `: OPENROUTER PROCESSING` must be skipped (the parser ignores lines that do not start with `data:`). An error during a stream arrives as a data event with an `error` object and `finish_reason: "error"`.
- Usage: every Chat Completions stream ends with a chunk, just before `[DONE]`, that has one content-free choice and a `usage` object (`prompt_tokens`, `completion_tokens`, `total_tokens`, and `cost` in credits, which are US dollars, plus `cost_details`). The page says `stream_options.include_usage` and `usage: {include: true}` are deprecated and have no effect: usage is always sent. WebAIAssist still sends `stream_options.include_usage` for the other OpenAI-compatible servers (Ollama 0.40.7 and LM Studio report usage only when asked).
- Optional headers `HTTP-Referer` and `X-OpenRouter-Title` (`X-Title` also accepted) only identify the app on openrouter.ai rankings. They are optional and are not sent.
- Price check for the evaluation: `meta-llama/llama-3.1-8b-instruct` at 0.02 USD per million prompt tokens and 0.04 per million completion tokens (`/api/v1/models`, 14 Nov 2026).

## 21. WebMCP conformance page (14 Nov 2026)

- Chrome documentation, each URL answered HTTP 200 on 14 Nov 2026:
  <https://developer.chrome.com/docs/ai/webmcp/imperative-api>,
  <https://developer.chrome.com/docs/ai/webmcp/declarative-api>,
  <https://developer.chrome.com/docs/ai/webmcp/secure-tools>.
- Specification: <https://webmachinelearning.github.io/webmcp/> (200 on 14 Nov 2026).
- Interface facts: `webaiassist-notes/day-2/PARITY-2026-11-14.md` section 4 (owner's notes).
- Google's demo pages: <https://googlechromelabs.github.io/webmcp-tools/demos/> (list from the
  repository README, 14 Nov 2026); no code of them is copied.
- Behaviour of Chromium 156.0.8078.4 measured locally on 14 Nov 2026 by the conformance suite.
- No new library: Playwright and Vitest were already used.

## Not verified

- MCP `ToolAnnotations` property names: neither tools page lists them and the schema page was truncated before that section.
- Latest commit date of the WebMCP repository and of the polyfill repository: not shown on the pages fetched.
- Full set of `LanguageModel.availability()` return values: the Prompt API page names only `downloading` and `unavailable`; the explainer lists `unavailable`, `downloadable`, `downloading`, `available`, which the panel handles.
- Which JSON Schema draft WebMCP `inputSchema` uses: the spec does not say; only the 2020-12 reference is listed.
- The second half of the WebMCP spec (characters beyond 100000 in the main page) was read only for a targeted search on schema, `navigator.modelContext` and `provideContext`.
- WebLLM latest GitHub release: the Releases section is empty; only the npm version was read.
- Web page fetches are summarised by a small model, so quoted wording should be rechecked against the source before it is cited in a paper or a store listing.

## 20. The graph explorer (14 Nov 2026)

The explorer tab runs the code of the AgenticSystemCore.com explorer, copied unchanged.

| What                                                       | Source                                                                                                                                                                                                                            | Pinned by                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `graph-data.js`, `graph-explorer.js`, `graph-explorer.css` | `assets/` of the repository `AgenticSystemCore.com` (the owner's own code, Apache-2.0), commit `152733b50412d9f3fa7a8a48024b4f419ea03a8e`, read on 14 Nov 2026                                                                    | `third_party/agsc-explorer/PINS.json`: size and SHA-256 of each file                 |
| the explorer's markup                                      | the block of `www/graph/index.html` that holds the explorer, without its two 3D attributes                                                                                                                                        | `PINS.json` (its own hash and the hash of the site's block)                          |
| `force-graph` 1.52.0                                       | npm, `dist/force-graph.min.js` (173,081 bytes, SHA-256 `f59db59ba92ff5a76ed93d7a4d77a703b176260e5d9cd29f4f8eb4f6c369a629`); byte for byte the file `assets/vendor/force-graph-1.52.0.min.js` of the site, compared on 14 Nov 2026 | `PINS.json`; the build copies it from `node_modules` and stops when the hash differs |
| recorded node files                                        | `fixtures/graph/`: linkset, `graph.jsonld` (and the main node's `chunks.jsonl`) of both nodes, read with a normal browser User-Agent on 14 Nov 2026; every digest in the linksets matches the bytes                               | `fixtures/graph/README.md`                                                           |

`node scripts/sync-agsc-explorer.mjs <path of AgenticSystemCore.com>` copies the files again and rewrites
`PINS.json`; `test/ui/agsc-explorer-pins.test.ts` fails when a copy differs from its pin (and, with
`AGSC_SITE_REPO` set to the site repository, when the pins are older than the site).

Licences of `force-graph` 1.52.0 and of the 30 packages `npm install` added with it (read from
`package-lock.json` and each package's `LICENSE` on 14 Nov 2026). Their code is in the one file
`force-graph.min.js`; the 3D library is not shipped.

| Licence      | Packages                                                                                                                                                                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT          | `force-graph` 1.52.0, `@tweenjs/tween.js` 25.0.0, `accessor-fn` 1.5.3, `bezier-js` 6.1.4, `canvas-color-tracker` 1.3.2, `d3-binarytree` 1.0.2, `d3-force-3d` 3.0.6, `d3-octree` 1.1.0, `float-tooltip` 1.8.0, `index-array-by` 1.4.2, `kapsule` 1.16.3, `lodash-es` 4.18.1, `preact` 11.2.0, `tinycolor2` 1.6.0                    |
| ISC          | `d3-array` 3.2.5, `d3-color` 3.1.1, `d3-dispatch` 3.0.2, `d3-drag` 3.0.1, `d3-format` 3.1.3, `d3-interpolate` 3.0.2, `d3-quadtree` 3.0.2, `d3-scale` 4.0.3, `d3-scale-chromatic` 3.1.1, `d3-selection` 3.0.1, `d3-time` 3.1.1, `d3-time-format` 4.1.1, `d3-timer` 3.0.2, `d3-transition` 3.0.2, `d3-zoom` 3.0.1, `internmap` 2.0.3 |
| BSD-3-Clause | `d3-ease` 3.0.2                                                                                                                                                                                                                                                                                                                    |

Findings of the read, so the next reader need not repeat it: `force-graph.min.js` contains the string `innerHTML`
(the bundled d3 `selection.html()` and preact's `__html` support) and no `eval` or `new Function`;
the explorer never gives the library HTML: it sets `nodeLabel(() => '')` and `linkLabel(() => '')` and draws names as canvas text.
`graph-data.js` and `graph-explorer.js` contain none of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
`eval` or `new Function` (`test/security/explorer-no-html-sink.test.ts`). `npm install` adds 31 packages for
`force-graph`, not 14 as the design note counted; only `force-graph.min.js` ships.

## 22. Query and semantic tools (14 Nov 2026)

The Query tab and the model's built-in graph tool run the query code of the AgenticSystemCore engine, copied
unchanged, over the SPARQL engine Oxigraph.

| What                                                           | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Pinned by                                                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.js`, `engine.js`, `view.js`, `ontology-questions.json` | repository `agentic-system-core`, tag `v1.1.0` (commit `ec7a67ff7efa2aa42f83bb018596af37112384ea`; the files are the same at `87f446719cc1df3a0064b23e245207542275a066`), paths `src/distribution/query/*.js` and `docs/ontology-questions.json`, read on 14 Nov 2026. The owner's own code (Apache-2.0 AND CC0-1.0).                                                                                                                                       | `third_party/agsc-query/PINS.json`: size and SHA-256 of each file; the build stops on a difference                                                                               |
| `oxigraph` 0.5.13                                              | npm, MIT OR Apache-2.0, published 22 Oct 2026 (23 days before; passes the two-week rule), unpacked 8,796,868 bytes, no dependencies. `web.js` 50,946 bytes SHA-256 `210c42fbba2915f668386f3285d28218db5865267e95b5403b82150431931f7c`; `web_bg.wasm` 4,324,920 bytes SHA-256 `75e3f0f4de67921e88e3f6d587b2a8e7aa822abbe3a3b79873f2b97f20d52c24`; both byte for byte the files the site ships (`www/query/vendor/oxigraph-0.5.13/`), compared on 14 Nov 2026 | `PINS.json` (web.js) and `scripts/model-libs.json` (the wasm, copied to `model-libs/oxigraph.wasm`, checked on every build, accepted by `check-remote-code` as a pinned runtime) |
| recorded node files                                            | `fixtures/graph/asc-graph.nq` (74,431 bytes), `pat-graph.nq` (540,434 bytes) and `asc-ontology.ttl` (21,768 bytes), copied from the site repositories' `www/` on 14 Nov 2026; each digest equals the one in the node's linkset (`fixtures/graph/README.md`)                                                                                                                                                                                                 | the linkset fixtures                                                                                                                                                             |

Notes for the next reader:

- **Two-week rule.** The engine files were published with agentic-system-core 1.1.0 on 13 Nov 2026, one day before
  they were copied. They are the owner's own files and have run on the site since 13 Nov; the exception is recorded
  here and is to be looked at again on 27 Nov 2026. A later 1.1.x that exports `query/*` could replace the copy.
- `node scripts/sync-agsc-query.mjs <path of agentic-system-core>` copies the files again from the tag and rewrites
  `PINS.json`; `test/third-party/agsc-query-pins.test.ts` fails when a copy differs from its pin (and, with
  `AGSC_ENGINE_REPO` set, when a pin differs from the tag).
- `engine.js` also holds `queryWorkerMain`, the loader of the site's own worker, which reads an address with
  `fetch`. It is in the bundle and is never called: WebAIAssist hands bytes to the worker instead
  (`test/security/query-read-only-no-network.test.ts` checks that no file of ours names it).
- The copied files are CommonJS, and the package has `"type": "module"`. `third_party/agsc-query/package.json`
  (`"type": "commonjs"`, the only file there that is not a copy) lets Node load them; esbuild bundles them as
  they are; Vitest reads them through `test/helpers/agsc-query/` and an alias in `vitest.config.ts`.
- The engine refuses INSERT, DELETE, LOAD, CLEAR, CREATE, DROP, COPY, MOVE, ADD and SERVICE (also `SERVICE SILENT`)
  by its own tokenizer before Oxigraph sees the text (`test/query/worker-core.test.ts` runs ten such queries).
- Licence texts: the npm package holds no licence file; NOTICE names the licence (MIT OR Apache-2.0) and the
  repository. This is a gap to close with the licence audit of the dependencies (the same as for the other packages).
