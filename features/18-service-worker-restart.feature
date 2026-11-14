# SPDX-License-Identifier: Apache-2.0
Feature: The background worker restarts
  Chrome stops an idle extension worker and starts it again. The person should not notice.

  @smoke
  Scenario: After the worker restarts the chat is kept and the tools are listed again
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 1, "b": 1}'
    And I press "Allow for this session"
    And I press "Allow once"
    Then the conversation shows "The tool said: 2"
    When the background worker is stopped
    And I ask '/tool add {"a": 2, "b": 3}'
    And I press "Allow once"
    Then the conversation shows "The tool said: 5"
    And the conversation shows "The tool said: 2"
    And the page line says "{host} — 2 WebMCP tools"

  @smoke @cpu
  Scenario: A processor model that is ready still answers after the worker restarts, with no new download
    Given a page with two WebMCP tools is open
    And the side panel is open on that page
    And the CPU model was downloaded earlier
    When the background worker is stopped
    Then a question gets an answer without the graphics card being used
    And no download was made since the worker stopped

  # test: test/adapters/host-choice.test.ts, test/ui/panel-controller.test.ts
  @unit
  Scenario: The model runs in the offscreen document first, then in the worker, and the panel says where
    Given the host probe results
    Then the offscreen document is chosen first, and the model line says where the model runs

  # test: test/adapters/session-site-grants.test.ts
  @unit
  Scenario: Site grants live in session storage and a value that is not a list is ignored
    Given a stored value that is not a list of origins
    Then no site is allowed by it
