# Privacy

WebAIAssist has no account, no analytics, no crash reports and no server of its own.

## What leaves your computer

| When                                                                          | What is sent                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | To                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You press Start with a model in the browser                                   | Requests for the model weights and their small configuration files. Nothing about you, the page or the chat; the host sees your IP address and the model asked for. The model library (program code) is inside the extension and is never downloaded.                                                                                                                                                                                                                                   | `huggingface.co` (the `mlc-ai` repositories, one fixed revision per model), which redirects the large files to Hugging Face's download network under `hf.co` (see below). Once per model. |
| You press Start with a model on the processor                                 | The same: requests for one model file (`.gguf`) from one fixed address (the `unsloth` repositories, one commit each; size and SHA-256 are checked after the download). Nothing about you, the page or the chat. The engine (program code) is inside the extension.                                                                                                                                                                                                                      | `huggingface.co`, which redirects the large file to `*.hf.co`. Once per model.                                                                                                            |
| You use Chrome's built-in model                                               | Nothing from WebAIAssist: no request, to any host. Chrome downloads and runs its own model under Google's terms, and the prompt stays in the browser.                                                                                                                                                                                                                                                                                                                                   | Chrome                                                                                                                                                                                    |
| You choose a chat endpoint in Options                                         | The whole conversation for each question: the instructions, the page's tool list, tool results, page text you read, the short facts from the site's published files (Options can turn them off), your questions, and the API key if set.                                                                                                                                                                                                                                                | The endpoint address you set, and nowhere else                                                                                                                                            |
| You allow a site and open a page of it, or click the toolbar button on a page | Up to eight requests to that site only, for its public files: `/.well-known/knowledge-linkset`, `/llms.txt`, `/robots.txt`, `/.well-known/tdmrep.json`, `/.well-known/security.txt`, `/.well-known/api-catalog`, `/.well-known/agent-card.json`, `/llms-full.txt`. GET only, no cookies, no referrer. The card lists what was found. A toolbar click on a page (Chrome's `activeTab`) starts the same reads for that tab, without Allow, until the tab closes or moves to another site. | Only that site, and only for the files listed                                                                                                                                             |
| A site asks for no AI input (`Content-Signal: ai-input=no`)                   | Nothing of the site's text or files goes to the model. Results of the site's own tools still go to the model you chose, and to an endpoint if that is the model.                                                                                                                                                                                                                                                                                                                        | The model you chose                                                                                                                                                                       |
| A tool runs on a page                                                         | Whatever that page's own tool code sends. WebAIAssist passes the arguments you saw and allowed; the page decides what its tool does.                                                                                                                                                                                                                                                                                                                                                    | The page's site                                                                                                                                                                           |

With a model in the browser or Chrome's built-in model, no page text, chat or tool result leaves
your computer.

## Every host the extension can reach

The code of the release package can contact these hosts, and no others:

| Host                                                                 | When                                                                                                                     | Why                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `huggingface.co`                                                     | Start with a model in the browser or on the processor, until it is cached                                                | The model's configuration, tokenizer and weights. Small files come from `huggingface.co` itself (it redirects to its own `/api/resolve-cache/` address).                                                                                                                                               |
| Hugging Face's download network, `*.hf.co`                           | The same download                                                                                                        | `huggingface.co` redirects large files (the tokenizer, the weight shards) there. On 12 Nov 2026 the host was `us.aws.cdn.hf.co`; Hugging Face picks the host by region and may change it (earlier names include `cas-bridge.xethub.hf.co` and `cdn-lfs.hf.co`). The request carries no data about you. |
| The endpoint address you set (the presets: `localhost`, `127.0.0.1`) | A question, with a chat endpoint chosen in Options                                                                       | The conversation, as described above. Redirects are refused, so it goes to that address only.                                                                                                                                                                                                          |
| Chrome (built-in model)                                              | You choose Chrome's built-in model and press Start                                                                       | Chrome downloads its model itself. WebAIAssist makes no request and has no address for it.                                                                                                                                                                                                             |
| The open page's own site                                             | A tool you allowed runs, or you open a page of an allowed site or click the toolbar button on it (the eight files above) | The page's own tool code decides what it sends.                                                                                                                                                                                                                                                        |

Chrome's built-in model is downloaded by Chrome, not by WebAIAssist. Other web addresses in the
bundles are never fetched: `github.com` is a base address the schema validator uses to name
schemas, `webgpureport.org` is part of an error message, `www.w3.org` is in a code comment,
`w3id.org` and `www.rfc-editor.org` are names the extension compares a site's published files
with (it never requests them), and WebLLM's own model list names `huggingface.co` repositories of models this extension does not
offer.

## What is stored, and where

| What                                                                                                                                                                   | Where                                                 | How long                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Options, including the endpoint address, model name and API key                                                                                                        | `chrome.storage.local` in this browser profile        | Until you change them, press Reset to defaults, or remove the extension. The key is not encrypted.                |
| Sites whose tools you allowed                                                                                                                                          | `chrome.storage.session`                              | Until the browser restarts                                                                                        |
| Chat per site, with the tool results and the page text you read with Read this page (up to 4000 characters per read), and how often each tool worked per site (memory) | The extension's IndexedDB                             | Until you press Clear memory in Options or remove the extension. Nothing is kept when memory is off.              |
| Model weights                                                                                                                                                          | The extension's Cache Storage (WebLLM's cache)        | Until you remove them in Options (Downloaded models) or remove the extension                                      |
| Model file of the processor model                                                                                                                                      | The extension's private file storage (wllama's cache) | Until you remove it in Options (Downloaded models) or remove the extension                                        |
| Whether the welcome screen was dismissed, and how long the first answer of your graphics card took                                                                     | `chrome.storage.local`                                | Until you remove the extension; the time is a number with the adapter's name, used only to pick the default model |
| Compat mode for a site                                                                                                                                                 | A content script registered for that site             | Until the browser restarts                                                                                        |
| Access to a site (compat mode, endpoint)                                                                                                                               | Chrome's permission list for the extension            | Until you remove it in `chrome://extensions`, under the extension's site access                                   |

## Downloaded models

Before the first download of any model weights the panel shows the size, the host they come from
and that they are stored in this browser, and downloads nothing until you press Download. The
Options page lists what is stored, with sizes, and removes one model or all. Chrome's own model is
managed by Chrome (`chrome://on-device-internals`).

## Forget all sites

**Forget all sites** in Options removes every saved chat and tool count, every "use the tools of
this site" answer, every compat script and every site access you granted, except the address of
your chat endpoint. **Forget this site** (below) does the same for the open site.

## Forget this site

**Forget this site** in the panel removes, for the open site: its chat and tool counts, the
"use the tools of this site" answer of this session, compat mode, and the site access you
granted. Clear memory in Options removes the chat and counts of every site.

## Export

**Export** in the panel saves the conversation as a Markdown file on your computer, only when you
press it. It starts with a short block that marks the text as AI-generated (`ai-generated: true`, the extension version, the model and where it ran) and says so in a sentence: a local model, or the endpoint host when an endpoint wrote the answers. It contains your questions, the answers, the tool calls and the tool results (marked as
untrusted page content). Argument values whose names look like secrets (password, token, API key,
auth, bearer, private key, session, cookie, credential) are replaced with `[redacted]`, and so is
the endpoint API key wherever it appears, even in text you typed.

## A remote chat endpoint (OpenRouter and similar)

- **Where the model runs.** The OpenRouter preset is `https://openrouter.ai/api/v1`; any other
  `https` address works the same way. An address on this computer (`localhost`, `127.0.0.1`) keeps the chat on
  it. Any other address is a remote service: the model runs there, and your questions, the
  page's tool list, tool results and any page text you read go to that host. The service may
  charge for it and may keep what it receives under its own terms; WebAIAssist cannot see or change
  that.
- **One question first.** Before a remote host is used for the first time, the panel says so in
  plain words and waits for **Use this service**. Nothing is sent before. The answer is kept per
  host in `chrome.storage.local` (the list of hosts you agreed to); a different host asks again.
  An address on this computer never asks. A site that asks for no AI input is never offered to a
  remote endpoint.
- **Access.** Saving a remote address asks Chrome, from the Save click, for access to that one host
  (an optional permission; it is not granted at install).
- **What is sent besides the chat.** Only `Authorization: Bearer <key>` (when you set a key) and
  `Content-Type`. No app name, referrer or other identifying header is sent. The request asks the
  service to include token counts (`stream_options.include_usage`).
- **The key** stays in `chrome.storage.local`, unencrypted. It is never in the export, the saved
  chat, an error text or a log; a service's error text is cut to 200 characters and has the key
  and bearer-shaped strings removed before it is shown.
- **What is read back.** The reply text, and the token counts and price the service reports for
  the call (kept in memory for the activity log; nothing is sent anywhere).
