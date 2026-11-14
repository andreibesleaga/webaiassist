# SPDX-License-Identifier: Apache-2.0
Feature: Options
  One page with every setting, each with a short explanation. Save says so; Reset restores the
  defaults; a bad endpoint is refused with a reason and saves nothing.

  @smoke
  Scenario: Saving the options says "Saved."
    Given WebAIAssist is installed
    And the Options page is open
    When I press "Save"
    Then the options status says "Saved."

  @smoke
  Scenario: Reset restores the defaults
    Given WebAIAssist is installed
    And the Options page is open
    When I set the field "Tool steps per question" to "3"
    And I press "Save"
    And I press "Reset to defaults"
    Then the options status says "Options reset to the defaults."
    And the field "Tool steps per question" has the value "6"

  # req: LLM10-1
  @smoke
  Scenario: A saved choice comes back when Options is opened again
    Given WebAIAssist is installed
    And the Options page is open
    When I choose the option "Ask once per site per session for read-only tools"
    And I set the field "Tool steps per question" to "4"
    And I press "Save"
    And I open the Options page again
    Then the option "Ask once per site per session for read-only tools" is chosen
    And the field "Tool steps per question" has the value "4"

  # test: test/ui/options-page.test.ts, test/adapters/endpoint-runtime.test.ts
  @unit
  Scenario: A plain http endpoint on another computer, or an endpoint without a model name, is refused
    Given the endpoint "http://example.org/v1"
    Then Options says "Not saved:" with the reason, and saves nothing
    Given the endpoint "http://localhost:11434/v1" and no model name
    Then Options says "Not saved: give the model name at the endpoint."

  # test: test/ui/options-page.test.ts
  @unit
  Scenario: Saving an endpoint asks Chrome for access to that address only
    Given an endpoint on localhost
    When I press "Save"
    Then Chrome is asked for access to that one address
    And when it is refused, Options says that the endpoint cannot be used

  # test: test/adapters/settings.test.ts
  @unit
  Scenario: Missing or foreign values in the stored settings fall back to safe defaults
    Given stored settings with an unknown model and a step limit of 99
    Then the defaults are used for them and the step limit is 12

  # req: LLM07-1
  # test: test/ui/panel-privacy.test.ts
  @unit
  Scenario: The endpoint key never appears in the model's instructions
    Given an endpoint key in the settings
    Then the system prompt does not contain it

  @smoke
  Scenario: Options offers the CPU model and its size, the graphics card model, and Chrome's built-in model
    Given WebAIAssist is installed
    And the Options page is open
    Then the choices "Processor and memory", "Graphics card" and "Chrome's built-in model" are listed with a line each
    And the line under "Processor and memory" says "Downloads about 397 MB once"
