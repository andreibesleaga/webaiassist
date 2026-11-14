# SPDX-License-Identifier: Apache-2.0
Feature: Asking with tools that read and tools that change
  The model can call only the tools the open page offers. Every call goes through a
  confirmation that shows the site, the tool and its arguments. The person can allow once or deny.

  # req: LLM06-1, LLM06-3
  @smoke
  Scenario: A question that needs a tool shows the confirmation with site, tool and arguments
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 2, "b": 3}'
    And I press "Allow for this session"
    Then a dialog titled "Run the tool add?" is open
    And the dialog says "Site: {origin}"
    And the dialog says '"a": 2'
    And the "Deny" button has focus
    When I press "Allow once"
    Then the conversation shows "The tool said: 5"
    And the tool result is marked untrusted

  @smoke
  Scenario: A tool the page marks read-only still asks in the default mode, and says it is read-only
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool echo {"text": "hi"}'
    And I press "Allow for this session"
    Then a dialog titled "Run the tool echo?" is open
    And the dialog says "The page marks this tool as read-only."
    When I press "Allow once"
    Then the conversation shows "The tool said: hi"

  @smoke
  Scenario: A tool that may change something carries a warning in the confirmation
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 1, "b": 2}'
    And I press "Allow for this session"
    Then the dialog says "may change something"

  # req: ASI09-1
  @smoke
  Scenario: A tool that may change something is marked with a sign as well as a colour
    Given a confirmation for a tool that may change something is open
    Then the dialog shows a warning sign next to the warning text

  # req: LLM06-1
  @smoke
  Scenario: Deny does not run the tool and the chat says so
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool add {"a": 2, "b": 3}'
    And I press "Allow for this session"
    And I press "Deny"
    Then the conversation shows "You denied the call to add."
    And the conversation does not show "The tool said: 5"

  # test: test/core/agent-loop-safety.test.ts
  # req: ASI01-1
  @unit
  Scenario: After a denial the model is told that the call was denied
    Given the model asks for a tool and the person denies
    Then the model sees that the call was denied

  @smoke
  Scenario: Once per site, read-only tools run without asking and tools that change still ask
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the option "Ask once per site per session for read-only tools" is saved
    And the side panel is open on that page
    And the scripted model is ready
    When I ask '/tool echo {"text": "quiet"}'
    And I press "Allow for this session"
    Then the conversation shows "The tool said: quiet"
    And no tool dialog is shown
    When I ask '/tool add {"a": 1, "b": 1}'
    Then a dialog titled "Run the tool add?" is open

  # test: test/core/gate.test.ts, test/security-review/panel-review.test.ts
  @unit
  Scenario: A tool the page marks read-only and consequential is treated as one that changes things
    Given a tool with both hints
    Then the confirmation asks and does not call it read-only

  # req: ASI02-1
  # test: test/core/agent-loop-safety.test.ts
  @unit
  Scenario: A tool that changed after it was listed is refused
    Given the page changes a tool between the listing and the call
    Then the call is refused

  # test: test/core/agent-loop-safety.test.ts
  # req: LLM06-4
  @unit
  Scenario: A run stays on the site it started on; leaving the site ends it before anything is asked
    Given the tab leaves the site while the person decides
    Then the call is refused and nothing is run

  @smoke
  Scenario: A call waiting in a dialog is denied when the tab moves to another site
    Given a tool confirmation is open
    When the tab moves to another site
    Then the dialog closes and the call is denied
    And the chat says "The tab is now on another site; the call to add was not run."

  # req: LLM06-2
  # test: test/scripts/check-dist.test.ts, test/adapters/page-bridge-main.test.ts
  @unit
  Scenario: Only the page's own tools can run: no navigation, no form filling, no downloads
    Given the release package
    Then the manifest lists exactly the documented permissions, and none is for tabs, downloads or navigation
    And a tool of another origin is neither listed nor run
