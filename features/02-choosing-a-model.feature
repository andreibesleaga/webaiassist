# SPDX-License-Identifier: Apache-2.0
Feature: Choosing a model
  Four ways to run a model: the graphics card (WebGPU), the processor and memory (WebAssembly),
  Chrome's built-in model, or a chat endpoint. The panel picks one by measurement, says why,
  and explains every "not available" state in plain words with a next step.

  @smoke
  Scenario: A ready model is named in the model line
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Scripted test model"
    And I press "Start"
    Then the model line says "Ready: Scripted test model."

  # test: test/ui/model-picker.test.ts
  @unit
  Scenario: With a working graphics card the panel selects the small bundled model, even when the processor model could run
    Given this computer has a working WebGPU adapter
    Then the model list selects the small bundled model
    And Chrome's built-in model and the endpoint are not selected by themselves

  # test: test/ui/default-model.test.ts
  @unit
  Scenario: Without WebGPU and without the processor model the panel falls back to the endpoint, then Chrome's built-in model
    Given this computer has no usable WebGPU and cannot run the processor model
    Then the model list selects the endpoint when one is set, else Chrome's built-in model when Chrome offers it
    And otherwise it offers "Set up a chat endpoint"

  # req: NIST-ME-2
  @smoke
  Scenario: The default is chosen by measurement and the panel says why
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the "Why" line under the model list gives one reason for the default model
    And choosing another model changes the line to "Why: you chose this model."

  # test: test/ui/default-model.test.ts, test/ui/panel-model.test.ts
  @unit
  Scenario: The order is Chrome's built-in model, the graphics card, the processor model, then an endpoint
    Given Chrome reports its built-in model as available
    Then it is the default
    Given Chrome's built-in model is absent and the graphics card passes the warm-up check
    Then the graphics card model is the default
    Given Chrome's built-in model is absent and the graphics card was measured slow
    Then the graphics card model is still the default, and the "Why" line gives the measured seconds and names the processor model as an option
    Given Chrome's built-in model is absent and the graphics card was never measured
    Then the graphics card model is the default
    Given Chrome's built-in model is absent and this computer has no usable WebGPU
    Then the processor model Qwen3 1.7B is the default

  @smoke @cpu
  Scenario: The CPU and memory model answers a question on a computer without a graphics card
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model is downloaded
    When I press "Start"
    Then the model line says "Ready: " followed by the model name and "Running in this browser, on your processor and memory"
    And a question gets an answer without the graphics card being used

  @gpu
  Scenario: The graphics card model answers a question on a computer with WebGPU
    Given the graphics card passes the check
    When I press "Start"
    Then the model line says it runs "on the graphics card"
    And a question about the page gets an answer that names a page tool

  @nano
  Scenario: Chrome's built-in model answers a question in Chrome
    Given Chrome reports its built-in model as available or downloadable
    When I choose "Chrome's built-in model" and press "Start"
    Then Chrome downloads its model if it must, and the progress is shown
    And the model line says "Ready" with "in Chrome"
    And a question gets an answer, and a tool call goes through the confirmation

  @smoke
  Scenario: Chrome's built-in model is unavailable here, and the panel says what Chrome said
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Chrome's built-in model"
    Then the model line contains "22 GB free disk"
    When I press "Start"
    Then the model line contains "The model did not load:"
    And the model line contains "Chrome's state: unavailable"
    And the "Start" button is enabled

  @smoke
  Scenario: This browser has no built-in model at all
    Given WebAIAssist is installed
    And this browser has no built-in model
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I press "Help"
    Then the built-in model line says "Chrome’s built-in model: not in this browser (no Prompt API here)."
    And the model list has no entry for Chrome's built-in model

  # test: test/adapters/prompt-api-state.test.ts, test/ui/builtin-state.test.ts
  @unit
  Scenario Outline: Each state Chrome reports for its built-in model has its own plain line
    Given Chrome reports the state "<state>"
    Then the built-in model line gives the text for "<state>"

    Examples:
      | state        |
      | unavailable  |
      | downloadable |
      | downloading  |
      | available    |

  @smoke
  Scenario: Chrome's built-in model is fitted to a small context with a compact tool list
    Given WebAIAssist is installed
    And the scripted built-in model reports a context of 1024 tokens
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Chrome's built-in model"
    And I press "Start"
    Then the model line contains "Ready"
    When I ask "What can I do here?"
    And I allow what is asked until the answer ends
    Then the tool list sent to the model fits the context and still names every tool

  # test: test/adapters/prompt-api-questions.test.ts, test/core/action.test.ts
  @unit
  Scenario: The built-in model is asked for its reply as JSON that matches the action schema
    Given the built-in model runtime
    When a question needs a tool
    Then the request carries a response constraint with the action schema
    And the schema allows only the tools the page offers

  @smoke
  Scenario: The built-in model is asked for its reply as JSON that names only the page's tools
    Given WebAIAssist is installed
    And the scripted built-in model reports a context of 9216 tokens
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Chrome's built-in model"
    And I press "Start"
    And I ask "What can I do here?"
    And I allow what is asked until the answer ends
    Then the reply sent to the built-in model is constrained to the tools "add" and "echo"

  @smoke
  Scenario: Chrome's download starts from the click, shows progress, and Cancel stops it
    Given WebAIAssist is installed
    And the scripted built-in model must download and the download never ends
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Chrome's built-in model"
    And I press "Start"
    And I agree to the download
    Then the model line contains "is preparing it"
    And the scripted built-in model was started by a click
    When I press "Cancel download"
    Then the model line contains "cancelled"
    And the "Start" button is enabled

  @smoke
  Scenario: A download that fails on the network says what to check
    Given WebAIAssist is installed
    And the scripted built-in model must download and the network fails
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I choose the model "Chrome's built-in model"
    And I press "Start"
    And I agree to the download
    Then the model line contains "The download did not finish"
    And the model line contains "press Start again"
    And the "Start" button is enabled

  # test: test/adapters/prompt-api-runtime.test.ts, test/adapters/prompt-api-state.test.ts
  @unit
  Scenario Outline: Each state Chrome reports while the model loads has a plain reason
    Given Chrome reports the state "<state>" while the model loads
    Then the progress line gives the reason for "<state>"
    And the load is not ended by that state

    Examples:
      | state        |
      | unavailable  |
      | downloadable |
      | downloading  |
      | available    |

  # test: test/adapters/prompt-api-runtime.test.ts
  @unit
  Scenario: The size of the context is read from Chrome, with a fallback
    Given the built-in model runtime has loaded a session
    Then the context is the session's window, or the older quota, or 4096 tokens

  # test: test/adapters/prompt-api-questions.test.ts, test/adapters/prompt-api-fit.test.ts
  @unit
  Scenario: A question that is too long for the window loses its oldest turns once
    Given Chrome says the input is over the window
    Then the oldest earlier turns are dropped once and the question is asked again
    And a question that still does not fit is named with its size

  # test: test/adapters/prompt-api-questions.test.ts, test/ui/panel-switch.test.ts
  @unit
  Scenario: Closing the panel or switching model lets the built-in model go
    Given a built-in model session is answering
    When the panel is closed or another model is started
    Then the session is destroyed

  # test: test/adapters/endpoint-runtime.test.ts, test/ui/options-page.test.ts
  @unit
  Scenario: A chat endpoint on this computer is used and the chat goes to that address only
    Given the endpoint "http://localhost:11434/v1" with the model "qwen3:0.6b" is saved in Options
    When a question is asked
    Then the only address contacted is that endpoint

  # test: test/adapters/endpoint-runtime.test.ts
  @unit
  Scenario: An endpoint that refuses the request is reported with its status
    Given the endpoint answers 401
    When I press "Start"
    Then the model line says "The endpoint answered 401."
    And an endpoint that answers 403 also names the Ollama setting OLLAMA_ORIGINS

  @smoke
  Scenario: A refused endpoint shows an error banner with the next step
    Given the endpoint answers 401
    When I press "Start"
    Then the banner says that the endpoint refused the request and to check the API key in Options

  # test: test/adapters/endpoint-runtime.test.ts
  @unit
  Scenario: An endpoint that does not answer in time is reported
    Given the endpoint does not answer within the time limit
    When I press "Start"
    Then the model line says that the endpoint did not answer in time, and the chat is kept

  # test: test/ui/panel-access.test.ts
  @unit
  Scenario: With no usable graphics card and no other model, Start opens Options
    Given this computer has no usable WebGPU and Chrome has no built-in model
    When I press "Start"
    Then the Options page opens and no model is loaded

  @smoke
  Scenario: No graphics card: the error offers the processor model in one click
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And this computer has no usable WebGPU
    When I press "Start" with the graphics card model selected
    Then an error says that this browser has no usable graphics acceleration and why
    And the error offers "Use the processor instead"
    When I press "Use the processor instead"
    Then the CPU model is selected

  # test: test/ui/panel-switch.test.ts
  @unit
  Scenario: Switching model while one is ready releases the old one and starts the new one
    Given a model is ready
    When I choose another model and press "Start"
    Then the old model is released and the new model is loaded

  # Run by `npm run eval:cpu` (headless Chromium, the real model; it needs the network once).
  @cpu
  Scenario: The real processor model answers on the stub node and starts again from the stored copy
    Given the real Qwen3 0.6B file is downloaded once through the panel
    When five questions are asked on the stub node
    Then each one gets an answer and the speed of the prompt and of the reply is recorded
    When the browser is started again on the same profile and Start is pressed
    Then the model is ready without a download

  # test: test/ui/model-picker.test.ts, test/adapters/models.test.ts
  @unit
  Scenario: Qwen3.5 2B, Llama 3.2 3B and Gemma 4 E2B are in the model list, on the graphics card
    Given this computer has a working WebGPU adapter that reports "shader-f16"
    Then the model list has "Qwen3 0.6B", "Qwen3.5 2B", "Llama 3.2 3B" and "Gemma 4 E2B" on the graphics card, in that order
    And "Qwen3.5 2B" is also listed for the processor
    And none of the other three is selected by itself: the default stays the small bundled model

  # test: test/adapters/models.test.ts, test/ui/model-picker.test.ts
  @unit
  Scenario: Llama 3.2 3B and Gemma 4 E2B are marked slow and are never a default
    Given this computer has a working WebGPU adapter that reports "shader-f16"
    Then the labels of "Llama 3.2 3B" and "Gemma 4 E2B" in the model list say "slow: may stall on a laptop graphics card"
    And the labels of "Qwen3 0.6B" and "Qwen3.5 2B" do not say it
    And neither of the two is the default model on any computer

  # test: test/ui/model-picker.test.ts, test/ui/options-page.test.ts
  @unit
  Scenario: Gemma 4 E2B is hidden when the graphics card lacks shader-f16
    Given the WebGPU adapter of this computer does not report "shader-f16"
    Then the model list of the panel and the graphics-card list in Options do not offer "Gemma 4 E2B"
    And a saved choice of "Gemma 4 E2B" falls back to the default model

  # test: test/ui/panel-consent.test.ts
  @unit
  Scenario Outline: The newer graphics-card models ask before their first download
    Given "<model>" is chosen and is not stored in this browser
    When I press "Start"
    Then the question names "<model>", "<size>" and huggingface.co, and nothing downloads before I press "Download"

    Examples:
      | model       | size    |
      | Qwen3.5 2B  | 1072 MB |
      | Gemma 4 E2B | 2830 MB |

  # test: test/adapters/context-fit.test.ts
  @unit
  Scenario: A question on the AgenticSystemCore node fits the 4096-token window of every listed model
    Given the node's ten tools and the site files it published
    Then the request the loop builds, with the room kept for the reply, fits in 4096 tokens for every model in the list
    And at least 1000 tokens stay free for a tool result

  # Run by `npm run eval:gpu -- --models qwen35,gemma4` on a computer with a graphics card.
  @gpu
  Scenario: Qwen3.5 2B and Gemma 4 E2B load and answer on the graphics card
    Given the graphics card passes the check, and for Gemma 4 E2B reports "shader-f16"
    When the model is chosen and "Start" is pressed
    Then the model line says it runs "on the graphics card"
    And a question about the page gets an answer that names a page tool

  # Run by `npm run eval:cpu -- --model qwen35-2b` (headless Chromium, the real model; it needs the network once).
  @cpu
  Scenario: The real Qwen3.5 2B file answers on the stub node on the processor
    Given the real Qwen3.5 2B file is downloaded once through the panel
    When the questions are asked on the stub node
    Then each one gets an answer and the speed of the prompt and of the reply is recorded

  # test: test/ui/model-picker.test.ts, test/ui/panel-model-groups.test.ts
  @unit
  Scenario: The model list is in two groups and every entry says where it runs
    Given a computer with a graphics card, the processor model, Chrome's built-in model and a saved endpoint
    Then the list has the group "On this computer, in the browser" and the group "Your own server or a remote service"
    And a graphics-card model says "in this browser, on your graphics card"
    And a processor model says "in this browser, on your processor and memory"
    And Chrome's built-in model says "in Chrome on this computer"
    And no empty group is drawn

  # test: test/ui/model-picker.test.ts, test/adapters/endpoint-runtime.test.ts
  @unit
  Scenario Outline: A chat endpoint says from its address whether the chat leaves the computer
    Given the saved endpoint address is "<address>"
    Then its entry in the model list ends with "<words>"

    Examples:
      | address                     | words                                                                                         |
      | http://localhost:11434/v1   | (your own server on this computer; nothing leaves it)                                         |
      | http://127.0.0.1:1234/v1    | (your own server on this computer; nothing leaves it)                                         |
      | https://api.example.com/v1  | (remote: your questions and the page content you use go to api.example.com)                   |

  # test: test/ui/panel-controller.test.ts, test/ui/panel-cpu.test.ts, test/ui/panel-privacy.test.ts
  @unit
  Scenario: After Start the model line says where the model runs
    Given a model is started
    Then a graphics-card model's line says "Running in this browser, on your graphics card"
    And a processor model's line says "Running in this browser, on your processor and memory"
    And a server on this computer says "Your own server on this computer" and "nothing leaves this computer"
    And a remote endpoint says "Remote:" and names the host the questions go to

  # test: test/ui/options-models.test.ts
  @unit
  Scenario: Options says for each place to run the model where it runs
    Given the Options page is open
    Then the graphics card, processor, Chrome's built-in model and endpoint options each say where the model runs
    And the endpoint option says that an address on this computer keeps the chat on it and any other address is remote
