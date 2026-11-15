# Tool security review

Every tool of the open page is read against nine written rules when it arrives. A tool with a
finding is marked **check** in the tools list, shows its reasons in the list, in the detail view and in
the question before a call, and is **always asked about**, in every confirmation mode. The review
reads only what the page wrote about the tool (name, title, description, field names and texts, the
hints). It runs no page code and makes no request. A finding is a reason to look twice, not proof of
harm, and a clean review is not proof of safety.

Code: `src/core/tool-review.ts` (rules, ledger), `src/core/tool-review-text.ts` (the sentence for each
finding), `src/core/tool-offer.ts` (what the model is offered), `src/core/gate.ts` (`mustAsk`).
Tests: `test/core/tool-review.test.ts` (each rule has samples it flags and samples it must leave
alone), `test/core/agent-loop-review.test.ts` (the gate), `test/core/review-flags.test.ts` (the developer
report), `test/ui/panel-tool-marks.test.ts`, `test/ui/panel-confirm-review.test.ts`, and the browser test
`test/smoke/review.spec.ts` on the page `test/smoke/review-page.html` (one tool for each rule).

## The nine rules

| Rule id                  | What it looks for                                                                                                                               | Why                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `hidden-characters`      | Zero-width, bidirectional-control and tag characters in the title or description.                                                               | They hide text from you that the model reads.            |
| `instructions`           | Sentences that give orders to the model ("ignore the instructions", "do not tell the user", "always call", "without asking", "send the chat").  | A description should describe, not command.              |
| `names-other-tool`       | A description or field text that tells the model to call another tool of the same page by its name.                                             | One tool steering the call of another.                   |
| `look-alike`             | A name that imitates a sensitive word (`paypa1`, `account_deIete`) or differs from another tool of the page only in case or confusable letters. | A tool that hopes to be taken for another.               |
| `link`                   | Web addresses, markdown links, `data:` and `javascript:` addresses.                                                                             | A description is not a place for links.                  |
| `encoded`                | Long base64 or hex runs, percent, `\u` and numeric-entity escapes, decoder calls.                                                               | Text the reviewer cannot read.                           |
| `read-only-contradicted` | A tool marked read-only whose name or title has a verb that changes something (`delete`, `send`, `pay` ...) or whose fields are secrets.        | The mark lowers the questions asked; it must be true.    |
| `oversized`              | A description over 2,000 characters, a name over 64, a field schema over 8,000.                                                                 | Room to hide instructions.                               |
| `changed`                | A tool whose name, description, fields or hints differ from the first definition this panel saw on that site.                                   | A page that behaves well first and swaps the tool later. |

The review is bounded in time and size: each text is cut at 12,000 characters, at most 300 texts are
read, and the field schema is read to a depth of 8.

## What a finding changes

- The tools list and the detail view mark the tool **check** and give each reason in plain words.
- The question before a call starts with "Look twice before you allow" and the reasons.
- `mustAsk`: the tool is asked about even with "ask only for tools that change something", and a tool that
  changed after it was listed is refused (it was already so).
- The review is written by WebAIAssist into the tool (`review`); a page cannot send one: it is removed from
  every tool the page lists.
- The developer report ("Copy report") lists every finding in its "Security review flags" section.

Other tool facts that belong with the review:

- A tool with the page's `debugging` hint is listed for you, marked **for developers**, and is not offered to
  the model. You can still run it by hand.
- A tool the page marks `consequentialHint` is asked about **twice**: "Run the tool X?", then "Are you sure
  about X?". Only that mark brings the second question.
- A form tool says "The page waits for you to press Submit" (or that the browser submits it) and warns about
  password, payment and personal fields.
- A tool of a same-origin frame is neither listed nor run, and cannot shadow a tool of the top window.

## Comparison with OWASP

Read on 14 Nov 2026 (see [SOURCES.md](SOURCES.md), section 24). The reviews cover what a browser extension
can see: the definition of a tool. Other parts of each list are about training, retrieval, servers or
identity and are not in the reach of this extension.

OWASP Top 10 for LLM Applications 2025 ([genai.owasp.org/llm-top-10](https://genai.owasp.org/llm-top-10/)):

| OWASP item                               | What WebAIAssist does                                                                                                                          | Gap                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| LLM01 Prompt Injection                   | Rules `instructions`, `hidden-characters`, `encoded`, `names-other-tool`; all page text is fenced as untrusted data; turn markers are refused. | The rules catch known shapes; a calm, honest-looking instruction is not seen. |
| LLM03 Supply Chain                       | `changed` flags a tool that is not the one first seen; `look-alike` flags imitation.                                                           | A first definition that is already hostile is judged by the rules only.       |
| LLM05 Improper Output Handling           | Results are shown as text, never as HTML; the model's call is checked against the tool's own fields before it is asked.                        | Results of tools are not reviewed for instructions.                           |
| LLM06 Excessive Agency                   | Only the open page's own tools; every call confirmed; `consequentialHint` asked twice; flagged tools always asked; no new permission.          | The page decides what its tool does; the extension cannot see inside it.      |
| LLM02, LLM04, LLM07, LLM08, LLM09, LLM10 | Not in scope of a tool review (no training, retrieval or hidden prompt of the page; the step limit bounds consumption).                        | A flood of 150 tools is listed, not flagged.                                  |

OWASP Top 10 for Agentic Applications 2026 (published 9 Dec 2025,
[genai.owasp.org](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)):

| OWASP item                           | What WebAIAssist does                                                                                                               | Gap                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ASI01 Agent Goal Hijack              | `instructions`, `hidden-characters`, `names-other-tool`; the user's question before every call.                                     | A small model can still be steered in its answer (not in its calls). |
| ASI02 Tool Misuse and Exploitation   | `look-alike` (tool name impersonation), `read-only-contradicted`, `changed` (tool poisoning), arguments checked against the schema. | The tool's own code is not read.                                     |
| ASI09 Human-Agent Trust Exploitation | The question shows the exact tool, site and raw arguments with hidden characters revealed; reasons in plain words.                  | The user can still press Allow.                                      |

The titles of the agentic list are those of its ASI items as published by the project and quoted by secondary
pages; the project's own page read on the day gave the date but not the list (SOURCES.md, section 24).

## Comparison with WebMCP Explorer

WebMCP Explorer (github.com/CorsenAI/webmcp-explorer) states thirteen rule families (WMCP-SEC-001 to 013). Its
README names these topics: prompt-injection indicators, hidden or look-alike characters, consequential
actions without hints, read-only claims contradicted by the source code, declarative forms that submit hidden
business fields, untrusted content, `exposedTo` lists and frames, text beyond Chrome's budgets, and changes in
registered contracts. The individual rule texts were not read.

| Explorer topic                              | In WebAIAssist                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Prompt-injection indicators                 | `instructions`, `names-other-tool`, `link`, `encoded`.                                                 |
| Hidden or look-alike characters             | `hidden-characters`, `look-alike`; a tool whose name or fields carry them is dropped (`listableTool`). |
| Consequential actions without hints         | A tool with no `readOnlyHint` counts as one that changes something and is asked about; no flag.        |
| Read-only claims contradicted by the source | `read-only-contradicted` reads the name, title and field names only, not the page's code.              |
| Declarative forms that submit hidden fields | Not checked; forms say they wait for Submit and warn about sensitive fields.                           |
| Untrusted content                           | `untrustedContentHint` is shown as "page content"; all results are fenced as untrusted.                |
| `exposedTo` lists and frames                | Frames: tools of another window than the page's own are neither listed nor run.                        |
| Text beyond Chrome's budgets                | `oversized`.                                                                                           |
| Changes in registered contracts             | `changed`.                                                                                             |

## Gaps (stated plainly)

- Rule `read-only-contradicted` reads the name, the title and field names, not the description verbs and not
  the code. A tool called `list_orders` is not flagged; a destructive tool called `tidy` marked read-only is.
- Verbs in the list are words: `reject` or `remove` in the name of a read-only tool is flagged even when the tool
  is harmless (the conformance page has two such tools; they are asked about).
- There is no check of meaning: an honest-looking description that lies is not seen.
- A flood (150 tools) is listed, not flagged.
- A tool with a turn marker or a hidden character in its **name or fields** is dropped by `listableTool`:
  it is neither listed nor marked.
- The model still sees the description of a flagged tool. Withholding the description of a tool flagged
  `instructions` from the model was not built (suggestion).
- Results of tools are not reviewed here; they are fenced as untrusted data.
- `changed` remembers definitions for this panel only (at most 2,000 tools); a new panel starts again.
- The review is in English; the word lists are English.
