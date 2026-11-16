# SPDX-License-Identifier: Apache-2.0
Feature: The tools list
  The card lists what the page's WebMCP tools are and what each one does, in words the person
  can read, and marks which ones only read and which ones may change something.

  @smoke
  Scenario: The tools list shows name, purpose and a read or change mark for every tool
    Given WebAIAssist is installed
    And a page with two WebMCP tools is open
    And the side panel is open on that page
    When I press "Tools"
    Then the list shows "add" marked as may change something
    And the list shows "echo" marked as reads
    And each tool shows the first sentence of its description

  @smoke
  Scenario: The tools button separates reads from changes
    Given the side panel is open on a page with two WebMCP tools
    Then the tools button says "Tools (2): 1 read, 1 may change something"
    And the page line says "{host} — 2 WebMCP tools"

  @smoke
  Scenario: A tool whose description carries hidden or instruction-like text is not offered
    Given a page registers a tool whose description contains a turn marker
    Then the tools list shows that tool as not offered to the model, with the reason
    And the model is not told about it

  # test: test/core/sanitize.test.ts, test/security-review/core-review.test.ts
  # req: LLM01-3, ASI02-2
  @unit
  Scenario: A tool is listed only when its name and schema strings are clean
    Given tool names and schemas with markers, hidden characters or an over-long name
    Then they are left out of the list the model sees

  # test: test/adapters/page-bridge-main.test.ts
  # req: ASI02-2
  @unit
  Scenario: A tool name used twice is neither listed nor run
    Given a page that registers two tools with the same name
    Then neither is listed and neither can be called

  # test: test/adapters/webmcp-reader.test.ts
  @unit
  Scenario: The tools come from document.modelContext, or navigator.modelContext when that is all there is
    Given a page that offers WebMCP through either object
    Then its tools are listed

  @smoke
  Scenario: A long tool list scrolls inside the card and does not push the chat away
    Given a page with thirty WebMCP tools
    When I press "Tools"
    Then the list scrolls inside the card and the question box stays in view
