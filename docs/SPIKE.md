# Browser check (spike)

> **In short**
>
> - The spike is a check page for a real computer with a real GPU, run before the model runtime is built.
> - It answers three questions: where WebGPU works, whether Chrome's built-in model is available, and whether a page can register WebMCP tools and run them.
> - It downloads no model, sends nothing anywhere, and takes about 15 minutes. It needs the development build `dist-smoke`; the release build does not contain it.
> - Result of 12 Nov 2026 (Windows 10, AMD gcn-5, Chrome 157): WebGPU worked in the page, service worker and offscreen document; 10 of 10 stub tools were read back.
> - The model host chosen was the offscreen document. Chrome's built-in model reported "downloadable".

The spike page answers three questions on a real computer with a real GPU, before the model
runtime is built:

1. Where does WebGPU work: on a normal page, in the extension's service worker, in its offscreen
   document? The model runs in the first of these that works, in that order of preference:
   offscreen document, service worker, side panel page.
2. Is Chrome's built-in model (the Prompt API, `LanguageModel`) available, and does Chrome accept
   a `tools` option?
3. Can a page register WebMCP tools and can they be read back and run? The page registers ten
   stub tools with the names, schemas and annotations of an AgenticSystemCore node, reads them
   with `getTools()` and runs `search` with `executeTool()`.

The page downloads no model and sends nothing anywhere. It takes about 15 minutes.

## What you need

- A Windows or macOS computer with a GPU and Chrome stable. WebGPU on Linux Chrome is not yet
  generally available, so a Linux or WSL machine does not answer question 1.
- The development build, folder `dist-smoke` (`npm ci && npm run build:smoke`), copied to that
  computer. The release build (`dist`) does not contain the spike page.
- Node.js 24 on that computer only for step 6.

## Procedure

1. Note the Chrome version from `chrome://version`.
2. Open `chrome://flags`, set **WebMCP for testing** (`#enable-webmcp-testing`) to Enabled. If
   your Chrome lists `#prompt-api-tool-use`, set it to Enabled too. Relaunch Chrome. Do not turn
   on any "unsafe WebGPU" flag: the check must show what a normal user has.
3. Open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick the
   `dist-smoke` folder. WebAIAssist appears in the list.
4. Click the WebAIAssist toolbar button (pin it from the puzzle-piece menu if it is hidden). The
   side panel opens. Click **Help**, then **Open the browser check**.
5. On the page, click **Run the checks**, wait for the report, click **Copy the report** and paste
   it into a text file named `report-extension.txt`.
6. Run the same page as an ordinary web page: in the project folder run `npm run spike:serve`,
   open <http://localhost:8080/>, run the checks and save the report as `report-web.txt`. Stop the
   server with Ctrl+C.
7. If any WebGPU section says `adapter  no`, open `chrome://gpu`, find the WebGPU line under
   "Graphics Feature Status" and copy it.
8. Fill one row of the results table below, and keep both report files with it.

## Reading the report

- `WebGPU (...)`: `adapter  yes` means a model can run there. `shader-f16  yes` allows the faster
  f16 models. `maxBufferSize` and `maxStorageBufferBindingSize` limit the largest model.
- `WebGPU (service worker)` and `WebGPU (offscreen document)` say `skipped` on the web page; that
  is expected.
- `Prompt API`: `availability()` is `available`, `downloadable`, `downloading` or `unavailable`.
  The `session` line (context window, `clone`, `measureContextUsage`) is read only when the
  model is already `available`; the spike never starts a download.
- `WebMCP`: `entry point  none` means the flag is off or this Chrome lacks WebMCP.
  `stub registered  10 of 10` and `tools after the stub  10: ...` mean the registry works.
  `executeTool(search)` shows the start of the result string, or the error.

## Results

| Date        | OS and GPU            | Chrome version | Opened from                           | WebGPU page / worker / offscreen | shader-f16      | Prompt API   | Tools option | WebMCP entry point      | Stub tools read back | executeTool(search)                  | Host chosen                                     |
| ----------- | --------------------- | -------------- | ------------------------------------- | -------------------------------- | --------------- | ------------ | ------------ | ----------------------- | -------------------- | ------------------------------------ | ----------------------------------------------- |
| 12 Nov 2026 | Windows 10, AMD gcn-5 | 157.0.0.0      | Extension and `http://localhost:8080` | yes / yes / yes                  | yes (all three) | downloadable | not tried    | `document.modelContext` | 10 of 10             | returned the untrusted-marked string | Offscreen document (service worker as fallback) |

All three contexts reported the same adapter: maxBufferSize 2147483648,
maxStorageBufferBindingSize 2147483644, maxComputeWorkgroupStorageSize 32768,
maxComputeInvocationsPerWorkgroup 1024, no fallback adapter. Both shipped models fit these limits.
