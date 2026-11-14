# SPDX-License-Identifier: Apache-2.0
Feature: Stop, step limit and the repeated-call stop
  An answer can always be stopped. A model that loops is ended by a step limit and by a
  repeated-call check, with a message that says what happened.

  # test: test/ui/panel-controller.test.ts
  # req: ASI10-1, NIST-MG-2
  @unit
  Scenario: Stop and Escape end a running answer and the chat stays usable
    Given an answer is running
    When I press "Stop" or the Escape key
    Then the answer ends with "Stopped."
    And the question box and "Send" are usable again

  @smoke
  Scenario: Escape in the confirmation dialog denies the call
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 2, "b": 3}'
    And I press "Allow for this session"
    Then a dialog titled "Run the tool add?" is open
    When I press the Escape key
    Then the conversation shows "You denied the call to add."

  @smoke
  Scenario: Stop is disabled when nothing is running
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    Then the "Stop" button is disabled

  # req: LLM10-1
  # test: test/core/agent-loop.test.ts
  @unit
  Scenario: The step limit ends a run that keeps calling tools
    Given the model asks for a tool at every step
    Then the run stops at the step limit of 6, or at the smaller limit in Options

  @smoke
  Scenario: The step limit shows its message and how to raise it
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/loop echo {"text": "x"}'
    And I allow what is asked until the answer ends
    Then the conversation shows "The assistant stopped after 6 tool steps (the limit in Options)."

  # req: LLM10-1
  @smoke
  Scenario: A tool call the model repeats is not run again, and a second repeat ends the question
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/repeat add {"a": 2, "b": 3}'
    And I allow what is asked until the answer ends
    Then the conversation shows "The assistant repeated a tool call it had already made."
    And the conversation shows "The assistant repeated a tool call again and was stopped."
    And the conversation shows "What the tools returned:"
    And the conversation shows "add: 5" once
    And the tool question was asked 1 time

  # test: test/core/agent-loop-safety.test.ts
  @unit
  Scenario: A malformed reply gets one repair try, then a visible error
    Given the model replies with text that is not an action
    Then the model is asked once to repair it
    And a second malformed reply ends the run with a visible error

  @smoke
  Scenario: A call to a tool the page does not have gets one repair try and no confirmation
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool nosuchtool {}'
    Then the conversation shows 'unknown tool "nosuchtool"'
    And no tool dialog is shown

  @smoke
  Scenario: Arguments the tool does not accept get one automatic retry, then a message
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": "x"}'
    And I allow what is asked until the answer ends
    Then the conversation shows "The model could not fill in the arguments for add."
    And the conversation shows "a (number, required), b (number, required)"
    And no tool dialog is shown

  # test: test/adapters/settings.test.ts
  @unit
  Scenario: The settings clamp the step limit between 1 and 12
    Given Options with the step limit 40
    Then the saved limit is 12

  # test: test/core/agent-loop-repeat.test.ts, test/core/repeat.test.ts
  # req: LLM10-1
  @unit
  Scenario: A repeated call gets the earlier result once, then ends the question with an answer from the results
    Given the model asks for a call it already made in this question
    Then the call is not run again and the confirmation is not asked again
    And the first time the model is given the earlier result and told to answer now
    And the second time the question ends with an answer built from the results and a plain note

  # test: test/core/agent-loop-repeat.test.ts, test/core/tool-signature.test.ts
  @unit
  Scenario: The retry after a missed argument quotes the fields the tool takes
    Given the model calls a tool without a required argument
    Then the retry names the tool's required fields and their types
    And a second miss ends with a message that names the tool and its fields
