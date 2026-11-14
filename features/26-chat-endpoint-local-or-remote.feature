# SPDX-License-Identifier: Apache-2.0
Feature: A chat endpoint, on this computer or remote
  Options can send the chat to any OpenAI-compatible address: Ollama or LM Studio on this
  computer, or a remote service such as OpenRouter. A remote service is used only after a
  one-time question, and the API key stays in this browser.

  # test: test/ui/panel-remote-consent.test.ts
  @unit
  Scenario: The model list leads to the endpoint set-up while none is set
    Given no chat endpoint is set
    Then the second group of the model list offers "Use your own server or a remote service…"
    And pressing Start opens Options and loads nothing

  # test: test/ui/panel-remote-consent.test.ts
  @unit
  Scenario: Options offers Ollama, LM Studio, OpenRouter and Other address
    Given the Options page is open
    Then the endpoint presets are Ollama, LM Studio, OpenRouter and Other address
    And saving an OpenRouter endpoint asks Chrome for access to openrouter.ai from the Save click

  # test: test/ui/panel-remote-consent.test.ts
  @unit
  Scenario: A remote endpoint asks once, per host, before anything is sent
    Given a remote chat endpoint is set and Start is pressed
    Then the panel says where the model runs, what is sent to that host and that it may charge
    And nothing is sent before "Use this service"
    And "Not now" sends nothing and asks again next time
    And after "Use this service" the same host asks nothing, and another host asks again

  # test: test/ui/panel-remote-consent.test.ts
  @unit
  Scenario: An endpoint on this computer never shows the question
    Given the chat endpoint is http://localhost:11434/v1 or http://127.0.0.1:1234/v1
    When I press Start
    Then no question is shown and the model loads

  # test: test/adapters/endpoint-usage.test.ts
  @unit
  Scenario: The endpoint's token counts and price are read, streamed or not
    Given the service ends its reply with a usage object
    Then the runtime reports the prompt tokens, completion tokens and the price when there is one
    And it sends no header that identifies the user or the app

  # test: test/security/endpoint-key-leaks.test.ts
  # test: test/adapters/endpoint-usage.test.ts
  @unit
  Scenario: A service that echoes the API key in an error cannot show it
    Given the service answers an error that contains the API key
    Then the key is not in the panel, the export, the saved chat or any log
    And the service's text is cut to one short line
