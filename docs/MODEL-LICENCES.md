# Model licences

> **In short**
>
> - This page has one row for every model the extension offers. The weights are not part of the extension; they download once, on your click.
> - The licence of a model is the publisher's, not this project's. The extension's own licence is Apache-2.0.
> - Licences are what the publisher of each file states on its Hugging Face page, read on 18 Nov 2026. Every file listed states one.
> - Four files show Apache-2.0. Llama 3.2 3B is under the Llama 3.2 Community License.
> - The extension cannot decide whether a licence fits your use. Read it before you rely on a model.

One row for every model the extension offers. The weights are not part of the extension: they
download once, on your click, from the address in the row. The licence of a model is the
publisher's, not this project's. The extension's own licence is Apache-2.0 ([LICENSE](../LICENSE));
the libraries it ships are in [NOTICE](../NOTICE).

The licence column is what the publisher of the file states on its Hugging Face page, read on
18 Nov 2026 (`https://huggingface.co/api/models/<repository>`). The base model's licence is named in
its own column, as the base model's own statement. The extension cannot decide for you whether a
licence fits your use: read it before you rely on a model.

## Models in the browser (GGUF, run by wllama and llama.cpp)

One engine runs every model in the browser: llama.cpp in WebAssembly (`@wllama/wllama`, MIT), on
the processor and memory, or with every layer on the graphics card through WebGPU. The engine file
ships inside the extension under the package's MIT licence ([NOTICE](../NOTICE)). The extension
ships no other compiled model code.

Source: `https://huggingface.co/unsloth/<name>-GGUF` at the pinned commit. Size and SHA-256 are
checked after the download; a file that differs is deleted and never loaded. The Gemma 4 E2B file
is larger than the browser hashes in one call (2 GiB), so it is checked in three pieces of 1 GiB
whose SHA-256 values were computed from a download with the published SHA-256. The pinned commit was
also the newest one on the day it was read (the first three on 14 Nov 2026, the last two on
18 Nov 2026). A model offered both ways is one file: it downloads once.

| Model (id in the extension)                   | Offered on               | Pinned commit                              | File                                | Licence stated by the publisher of this file (unsloth)            | Base model and its licence (its own statement)                                                     |
| --------------------------------------------- | ------------------------ | ------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Qwen3 0.6B (`qwen3-0.6b-q4_k_m`)              | graphics card, processor | `50968a4468ef4233ed78cd7c3de230dd1d61a56b` | `Qwen3-0.6B-Q4_K_M.gguf`            | Apache-2.0 (page tag; licence link to the `Qwen/Qwen3-0.6B` file) | `Qwen/Qwen3-0.6B`: Apache-2.0                                                                      |
| Qwen3 1.7B (`qwen3-1.7b-q4_k_m`)              | graphics card, processor | `d7f544eead698dbd1f15126ef60b45a1e1933222` | `Qwen3-1.7B-Q4_K_M.gguf`            | Apache-2.0 (same kind of statement)                               | `Qwen/Qwen3-1.7B`: Apache-2.0                                                                      |
| Qwen3.5 2B (`qwen3.5-2b-q4_k_m`)              | graphics card, processor | `f6d5376be1edb4d416d56da11e5397a961aca8ae` | `Qwen3.5-2B-Q4_K_M.gguf`            | Apache-2.0 (same kind of statement)                               | `Qwen/Qwen3.5-2B`: Apache-2.0                                                                      |
| Llama 3.2 3B (`llama-3.2-3b-instruct-q4_k_m`) | graphics card            | `e7d0997e49c9cb00d88b4c1a6a16aa894b0bbc31` | `Llama-3.2-3B-Instruct-Q4_K_M.gguf` | `llama3.2` (page tag: the Llama 3.2 Community License)            | `meta-llama/Llama-3.2-3B-Instruct`: `llama3.2`. The licence text sits behind a login there.        |
| Gemma 4 E2B (`gemma-4-e2b-it-q4_k_m`; slow)   | graphics card            | `0314792d7f1f7e229411f620751375812bb9faf2` | `gemma-4-E2B-it-Q4_K_M.gguf`        | Apache-2.0 (page tag)                                             | `google/gemma-4-E2B-it`: Apache-2.0 (its tag; it links `ai.google.dev/gemma/docs/gemma_4_license`) |

Version 0.1.0 ran the graphics-card models with another engine (WebLLM) and shipped four compiled
model libraries from `https://github.com/mlc-ai/binary-mlc-llm-libs`, a repository that states no
licence. Version 0.1.1 removed that engine and those files; a saved choice of one of its four models
selects the same model in the list above.

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
