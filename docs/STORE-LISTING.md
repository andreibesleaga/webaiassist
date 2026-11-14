# Chrome Web Store listing

The text and images for the WebAIAssist listing. Each quote block is the content of one field:
paste it without the leading `>` and without the angle brackets around links;
[STORE-RUNBOOK.md](STORE-RUNBOOK.md) says where each one goes.

## Store listing tab

**Name:** WebAIAssist

**Summary** (the manifest description, 116 of 132 characters):

> A local AI model in your side panel that uses the WebMCP tools of the open page. Works with AgenticSystemCore nodes.

**Category:** Productivity, then the closest sub-category the dashboard offers for tools.

**Language:** English

**Description:**

> WebAIAssist puts a chat in the browser side panel. The AI model runs on your own computer:
> on the graphics card (WebGPU) or on the processor, with no account. Nothing you ask is sent
> to a server.
>
> The panel follows the page you are on. A card at the top shows the site, whether WebAIAssist
> may work on it, the tools the page offers through WebMCP (what each does, and whether it only
> reads or may change something), and what the site publishes for machines: llms.txt, a
> knowledge link set, an API catalog, an agent card, security.txt and its AI policy. These are
> read only from the site you allowed, with a plain request and no cookies. A site that asks for
> no AI input (Content-Signal in robots.txt) gets no text sent to the model.
>
> The model can use the page's own WebMCP tools, for example to search the site or read one of
> its pages. It does nothing else on the page. Before a tool runs, you see its name, the site and
> the exact arguments, and you choose Allow once or Deny.
>
> On any other page, press "Read this page" and ask about its text.
>
> How to start: click the toolbar button and press Start. The panel has picked a model for your
> computer and says why. It shows what it will download (about 350 MB for the smallest, up to
> 1.8 GB) and where from, and downloads nothing until you agree. It downloads once; Options lists
> the models and removes them. Then ask.
>
> - Models in the browser: Qwen3 0.6B, Llama 3.2 3B, Qwen3.5 2B and Gemma 4 E2B on the graphics
>   card (WebGPU; Gemma 4 E2B only on a graphics card with the shader-f16 feature), or Qwen3 0.6B,
>   Qwen3 1.7B and Qwen3.5 2B on the processor (slower, no graphics card needed, Chrome 137 or newer).
>   Their program code ships inside the extension; only the model weights download, from
>   huggingface.co.
> - Optional: Chrome's built-in model, or your own chat endpoint (Ollama, LM Studio, or any
>   OpenAI-compatible address).
> - Works with AgenticSystemCore nodes, whose pages offer ten tools.
> - No account, no analytics. No access to any site at install; you grant it one site at a
>   time.
> - Open source, Apache-2.0: <https://github.com/andreibesleaga/webaiassist>
>
> Needs a Chromium browser. WebMCP is a draft web standard; Chrome offers it in recent versions.
> Small models choose tools less reliably than large ones, and answers can be wrong: they come
> from an AI model. Chrome's built-in model test: measured on a real computer on 14 Nov 2026 (Chrome 157, Windows): the model used a tool in 5 of 5 questions on the test node and in 1 of 5 on the live node, and an answer took 15 to 42 s. It stays optional.

**Images** (sizes from <https://developer.chrome.com/docs/webstore/images>, read 12 Nov 2026):

| Image                       | Size       | What it shows                                                                                   |
| --------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Store icon                  | 128 × 128  | `static/icons/icon-128.png` (96 × 96 artwork with 16 px padding, as the store asks)             |
| Screenshot 1                | 1280 × 800 | An AgenticSystemCore node page with the side panel open, a question and the answer using a tool |
| Screenshot 2                | 1280 × 800 | The confirmation question: tool name, site, arguments, Allow once and Deny                      |
| Screenshot 3                | 1280 × 800 | The panel during the first Start, with the download progress bar                                |
| Screenshot 4 (optional)     | 1280 × 800 | The Options page                                                                                |
| Small promo tile (optional) | 440 × 280  | The icon and the name on a plain background                                                     |

Capture the screenshots in a normal Chrome window at 1280 × 800, with no personal tabs,
bookmarks or account picture visible. `npm run screenshots` makes headless stand-ins of the panel
and the Options page (light theme, scripted model, test page) in `docs/eval/screenshots/` with
the suffix `-headless`; they show the design but not a real model, so the store images are the
ones from a GPU run.

The side panel and the Options page were redesigned in November 2026 (card with the site, an
access badge and the page's tools; light and dark themes; no new permission, host or manifest key).
The listing text does not change.

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

**Privacy policy URL:** `<PRIVACY-POLICY-URL>`: the public link to `docs/PRIVACY.md` in the
repository, for example
`https://github.com/andreibesleaga/webaiassist/blob/main/docs/PRIVACY.md`.

## Test instructions tab

> 1. Click the toolbar button to open the side panel and press Start. The panel shows the size
>    and the source of the model and waits for Download; the model then downloads once from
>    huggingface.co (about 350 MB for the smallest).
> 2. Open `<DEMO-NODE-URL>` (a page that offers WebMCP tools) and ask "Find items about review".
>    The panel asks to use the site's tools, then asks before each tool call.
> 3. On a page without WebMCP, press "Read this page" and ask about it.
>    Without WebGPU, choose "Qwen3 0.6B on the processor" in the model list (a 397 MB download,
>    Chrome 137 or newer), or "Chrome's built-in model" when Chrome offers it.
