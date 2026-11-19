# SPDX-License-Identifier: Apache-2.0
Feature: Errors and offline use
  Every error says what happened and what the person can do next, leaves the conversation
  intact and keeps the question box usable.

  @smoke
  Scenario: Lost graphics device is reported with a way forward
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask "/lost"
    Then an error banner says "The graphics device was lost"
    And it offers "Restart the model" and "Use the processor instead"
    And the conversation shows "/lost"

  @smoke
  Scenario: No model loaded: the question gets the same hint and nothing runs
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I ask "Hello"
    Then the conversation shows "Press Start to load a model first."
    And no tool dialog is shown

  # test: test/core/agent-loop.test.ts
  @unit
  Scenario: A tool that throws becomes a failed result the model can see
    Given a tool that throws
    Then the chat shows a failed tool result and the model sees the error

  @smoke
  Scenario: A tool that fails on the page shows a failed result and the answer goes on
    Given WebAIAssist is installed
    And a page whose tool "boom" always throws is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool boom {}'
    And I allow what is asked until the answer ends
    Then the conversation shows "Result of boom (failed; from the page)"
    And the conversation shows "The tool said: "
    And the question box is usable

  # test: test/adapters/tool-router.test.ts, test/core/agent-loop-safety.test.ts
  @unit
  Scenario: The page does not answer
    Given the page closes while a tool call is waiting
    Then the tool call fails with "The page did not answer" and the person can ask again

  # test: test/core/history.test.ts, test/core/agent-loop-safety.test.ts
  @unit
  Scenario: A full context drops the oldest saved turns, never the question or the run's own results
    Given a saved chat longer than the model's context window
    Then the oldest turns are left out and the newest are kept

  @smoke
  Scenario: Offline, a note says what still works
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When the browser goes offline
    Then a note says "You are offline. Models already on this computer work; downloads and endpoints do not."
    When I ask "Hello"
    Then the conversation shows "Scripted reply to: Hello"

  @smoke
  Scenario: Offline with no model on this computer, Start explains
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model is not on this computer
    And the browser is offline
    When I press "Start"
    Then the consent block says the model is not on this computer and that the person is offline

  @smoke
  Scenario: An unexpected error offers to copy its details, without page content
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    And something unexpected fails
    Then the banner says "Something went wrong" and "Nothing was changed on the page"
    When I press "Copy details"
    Then the copied text holds the message and the version and no page content

  # test: test/ui/panel-controller.test.ts
  @unit
  Scenario: A model that fails to load shows why, and Start can be pressed again
    Given the model cannot be created
    Then the model line says "The model did not load:" with the reason
    And "Start" is enabled

  # test: test/ui/panel-problems.test.ts, test/adapters/model-errors.test.ts, test/adapters/model-host.test.ts
  @unit
  Scenario: A graphics device lost while answering stops the model line saying "Ready" and shows no library text
    Given a graphics-card model is ready
    When the engine fails with "Object has already been disposed", which follows a lost graphics device
    Then the banner says the graphics device was lost and offers "Restart the model"
    And the model line says "The model stopped. Press Start to load it again."
    And the chat shows plain words, not the library's sentence
    And the model host restarts to get a new device

  # test: test/adapters/wllama-runtime-stop.test.ts, test/ui/panel-problems.test.ts
  @unit
  Scenario: A chat on an engine that is no longer loaded says the model stopped, and Start loads it again
    Given a graphics-card model is ready
    When the engine has crashed or the reply does not end after Stop
    Then the message is "The model stopped. Press Start to load it again." and not the engine's own sentence
    And the model line no longer says "Ready"
    And pressing "Start" loads the model again instead of answering "Ready" at once

  # test: test/adapters/wllama-runtime-stop.test.ts
  @unit
  Scenario: A reply that does not end after Stop releases the engine
    Given a graphics-card model is answering
    When the person presses Stop and the reply has not ended after 5 seconds
    Then the engine is released and no model is loaded
    And the chat ends with "The model stopped. Press Start to load it again."
