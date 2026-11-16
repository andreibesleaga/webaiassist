# WebMCP conformance page

> **In short**
>
> - This is a plain static page with sixteen cases (c01 to c16) that exercise a browser's WebMCP interface on `document.modelContext`.
> - It sends nothing anywhere, holds no analytics and does not depend on any browser extension.
> - Serve the folder with any static server and open `index.html`. A result is `pass`, `fail` or `unsupported`; `unsupported` means the browser lacks that part and is not a failure.
> - Chrome 157 needs `--enable-features=WebMCP`; Chromium 156 accepts `--enable-features=WebMCPTesting`.

A plain static page that exercises the WebMCP interface of a browser on `document.modelContext`.
It sends nothing anywhere, holds no analytics and is independent of any browser extension. Every
address in it is relative, so the folder works at the root of a test server and under a sub-path
of a static host such as GitHub Pages.

## What it covers

Sixteen cases, `c01` to `c16`, each in its own file under `cases/`:

| Case | Covers                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| c01  | registering, removing (by `AbortSignal`) and registering the same name again                                    |
| c02  | `getTools()`, `fromOrigins`, and the fields of a listed tool                                                    |
| c03  | result forms: string, JSON text, object, empty, null after a navigation                                         |
| c04  | `toolchange`, `ontoolactivated`, `ontoolcancel`                                                                 |
| c05  | every annotation (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging`), combinations, none |
| c06  | input schemas of each JSON type, required and optional, `oneOf`, none                                           |
| c07  | thrown errors, rejected promises, duplicate names, unknown tools                                                |
| c08  | cancelling a call                                                                                               |
| c09  | slow tools (2 s, 30 s honouring the signal, 30 s ignoring it)                                                   |
| c10  | large results (1 KB, 100 KB, 1 MB, deep nesting)                                                                |
| c11  | forms that become tools, with their attributes, including a form that waits for Submit                          |
| c12  | tools added after the page loads                                                                                |
| c13  | a tool that removes itself while its call runs                                                                  |
| c14  | same-origin and cross-origin frames                                                                             |
| c15  | hostile definitions: injected instructions, hidden text, look-alike names, 150 tools                            |
| c16  | a tool named like `webaiassist_query_graph`                                                                     |

`expect.json` is the single source of the cases: the tools each case registers, the result its
own check may end with, and the steps an extension run takes. The tests and the real-Chrome runs
all read it.

## Open it

Serve the folder with any static server and open `index.html`.

- `index.html` registers nothing and shows the cases and a **Run all checks** button.
- `index.html?case=c07` registers only the tools of case c07.
- `index.html?case=all` registers the tools of every case (more than 200).
- Add `&mode=self` to run the page's own checks on load; `window.__conformance.done` turns true and
  `window.__conformance.report()` returns the results as JSON.
- Add `&other=<address of a second host>/` (the same folder at another host) to test the
  cross-origin frame of c14.

A result is `pass`, `fail`, or `unsupported`. `unsupported` means the browser lacks that part of
the interface and the detail says which; it is not a failure.

Chrome 157 needs `--enable-features=WebMCP` (or the flag `chrome://flags/#enable-webmcp-testing`);
Chromium 156 accepts `--enable-features=WebMCPTesting`.

## Run the tests

From the root of the repository:

```sh
npm run build:smoke
npx playwright test test/smoke/conformance-browser.spec.ts   # the page alone
npx playwright test test/smoke/conformance.spec.ts           # the built extension, scripted model
npm run eval:conformance -- --extension --demos              # real Google Chrome
```

## Publish it

Copy the folder as it is. Nothing in it names a repository path.
