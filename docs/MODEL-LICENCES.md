# Model licences

> **In short**
>
> - This page has one row for every model the extension offers. The weights are not part of the extension; they download once, on your click.
> - The licence of a model is the publisher's, not this project's. The extension's own licence is Apache-2.0.
> - Licences are what the publisher states on its Hugging Face page, read on 14 Nov 2026. Where none is stated, the row says so and none is inferred.
> - The three processor models show Apache-2.0. Several of the graphics-card files state no licence.
> - The extension cannot decide whether a licence fits your use. Read it before you rely on a model.

One row for every model the extension offers. The weights are not part of the extension: they
download once, on your click, from the address in the row. The licence of a model is the
publisher's, not this project's. The extension's own licence is Apache-2.0 ([LICENSE](../LICENSE));
the libraries it ships are in [NOTICE](../NOTICE).

The licence column is what the publisher of the file states on its Hugging Face page, read on
14 Nov 2026 (`https://huggingface.co/api/models/<repository>`). Where the publisher states none,
the row says "no licence stated by the publisher", and the base model's licence is named in its own
column, as the base model's own statement, not as the licence of the file. The extension cannot
decide for you whether a licence fits your use: read it before you rely on a model.

## Models in the browser, on the graphics card (MLC format, run by WebLLM)

Source: `https://huggingface.co/mlc-ai/<name>` at the pinned revision below. The pinned revision was
also the newest one on 14 Nov 2026.

| Model (id in the extension)                                                 | Pinned revision                            | Licence stated by the publisher of this file (mlc-ai)                                                                                                          | Base model and its licence (the base model's own statement)                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qwen3 0.6B (`Qwen3-0.6B-q4f16_1-MLC`)                                       | `8c14ce481d4c692769976ad52afea453a102df19` | no licence stated by the publisher                                                                                                                             | `Qwen/Qwen3-0.6B` (named on the file's page): Apache-2.0                                                                                                                                            |
| Llama 3.2 3B (`Llama-3.2-3B-Instruct-q4f16_1-MLC`; marked slow in the list) | `1e80abf71e3d17cd564e2d2b63caa15cb226018e` | no licence stated by the publisher                                                                                                                             | `meta-llama/Llama-3.2-3B-Instruct` (named on the file's page): the page's licence tag is `llama3.2` (the Llama 3.2 Community License). The licence text sits behind a login and was not read today. |
| Qwen3.5 2B (`Qwen3.5-2B-q4f16_1-MLC`)                                       | `dd74e9c8a20c4546df85c844103bff87b6dcacad` | no licence stated by the publisher; the page has no description and does not name a base model                                                                 | `Qwen/Qwen3.5-2B`: Apache-2.0 (its page's tag and `LICENSE` file). The link between the two is the model name only; the mlc-ai page does not state it.                                              |
| Gemma 4 E2B (`gemma-4-E2B-it-q4f16_1-MLC`; marked slow in the list)         | `633df598b7a473759367855273c63912c9e2bc9a` | Apache-2.0 (page tag `license:apache-2.0`; the page links to `https://ai.google.dev/gemma/docs/gemma_4_license`, whose title is "Apache License 2.0 \| Gemma") | `google/gemma-4-E2B-it`: Apache-2.0 (same tag and link)                                                                                                                                             |

The compiled model libraries (`.wasm` files, one per model) come from
`https://github.com/mlc-ai/binary-mlc-llm-libs` at commit `00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0`
(`web-llm-models/v0_2_86/base`), pinned by size and SHA-256 in `scripts/model-libs.json`. That
repository has no licence file at that commit and GitHub reports none. The project that builds
them, `mlc-ai/mlc-llm`, is Apache-2.0. The libraries ship inside the extension, and their own licence is not stated
in that repository; [NOTICE](../NOTICE) says the same.

## Models in the browser, on the processor and memory (GGUF, run by wllama and llama.cpp)

Source: `https://huggingface.co/unsloth/<name>-GGUF` at the pinned commit. Size and SHA-256 are
checked after the download. The pinned commit was also the newest one on 14 Nov 2026.

| Model (id in the extension)      | Pinned commit                              | File                     | Licence stated by the publisher of this file (unsloth)            | Base model and its licence (its own statement) |
| -------------------------------- | ------------------------------------------ | ------------------------ | ----------------------------------------------------------------- | ---------------------------------------------- |
| Qwen3 0.6B (`qwen3-0.6b-q4_k_m`) | `50968a4468ef4233ed78cd7c3de230dd1d61a56b` | `Qwen3-0.6B-Q4_K_M.gguf` | Apache-2.0 (page tag; licence link to the `Qwen/Qwen3-0.6B` file) | `Qwen/Qwen3-0.6B`: Apache-2.0                  |
| Qwen3 1.7B (`qwen3-1.7b-q4_k_m`) | `d7f544eead698dbd1f15126ef60b45a1e1933222` | `Qwen3-1.7B-Q4_K_M.gguf` | Apache-2.0 (same kind of statement)                               | `Qwen/Qwen3-1.7B`: Apache-2.0                  |
| Qwen3.5 2B (`qwen3.5-2b-q4_k_m`) | `f6d5376be1edb4d416d56da11e5397a961aca8ae` | `Qwen3.5-2B-Q4_K_M.gguf` | Apache-2.0 (same kind of statement)                               | `Qwen/Qwen3.5-2B`: Apache-2.0                  |

## Chrome's built-in model

Gemini Nano, offered through Chrome's Prompt API. The extension does not download, ship or choose
it. Chrome does, under Google's terms; see `chrome://on-device-internals` and Chrome's own pages.
No licence is stated here because the extension is not the distributor.

## Your own server or a remote service

The presets (Ollama, LM Studio, OpenRouter, other address) name no model. The model is the one you
type, under its own terms and, for a remote service, the service's terms.

## How this table was made

For each repository: `GET https://huggingface.co/api/models/<repository>` on 14 Nov 2026; the
fields `sha`, `tags` (`license:...`) and `cardData` (`license`, `license_link`, `base_model`) were
read, and for the mlc-ai repositories their `README.md`. No licence was inferred when none was
stated. Re-read the pages before each release; a publisher may change a statement.
