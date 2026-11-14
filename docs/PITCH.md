# WebAIAssist in one page

**Problem.** Websites are starting to describe what they can do as tools for AI agents
(WebMCP, a W3C community draft). Today those tools are used by cloud assistants: the page,
your question and the results go to someone's server, and the agent may act without asking.

**What WebAIAssist does.** It is a browser extension with a chat in the side panel. A small
model runs on your own computer: on the graphics card (WebGPU), on the processor
(llama.cpp in WebAssembly), as Chrome's built-in model, or through your own chat endpoint
(Ollama, LM Studio). The panel follows the open page: it lists the page's WebMCP tools, what
each does and whether it only reads, and what the site publishes for machines (llms.txt,
knowledge link set, API catalog, agent card, security.txt, AI policy). The model picks a tool,
and it runs only after you see the tool, the site and the arguments and press Allow once. Tool
results are marked as untrusted page content. On a page without tools, "Read this page" gives
the model the page text.

**Why it is different.**

- Local by default: questions, page text and results stay on the computer.
- The user decides every call by default; nothing runs on a page's say-so, and the only way it
  acts is a tool the page offers.
- A site that asks for no AI input (Content-Signal) gets no text sent to the model.
- No access to any site at install; access is asked one site at a time.
- Works with AgenticSystemCore nodes, whose pages offer ten tools.

**What is verified.** The behaviour is written as Gherkin scenarios
([SCENARIOS.md](SCENARIOS.md)); each is run in a headless browser, proved by a named unit test,
or listed as a hand check. Other checks: fixture replay of the ten node tools; accessibility
tests (axe-core, WCAG 2.2 AA) in light and dark; an adversarial test pass and a written security
and governance review ([THREAT-MODEL.md](THREAT-MODEL.md), [GOVERNANCE.md](GOVERNANCE.md)); a
build that refuses remote code, with the model libraries inside the package under pinned hashes.
The processor models were run for real ([EVAL.md](EVAL.md)); the graphics-card run on a laptop
GPU was partial; Chrome's built-in model is not verified yet.

**Limits.** Chromium browsers only. Few websites offer WebMCP tools yet. Small models choose
tools less reliably than large ones: in the first measured run the 0.6B processor model called no
tool; the rates are in [EVAL.md](EVAL.md). The extension cannot check what a site's tool really
does.

**Licence and links.** Apache-2.0.
Code: <https://github.com/andreibesleaga/webaiassist>.
Store: `<STORE-LINK>`.
Security model: [THREAT-MODEL.md](THREAT-MODEL.md). Privacy: [PRIVACY.md](PRIVACY.md).
