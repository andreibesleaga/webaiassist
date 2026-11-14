# SPDX-License-Identifier: Apache-2.0
Feature: Node card, first-run help screens and the developer report
  On an AgenticSystemCore node the card names the node and its spec version, and shows how to
  start your own. A page with no tools and a Chrome without the WebMCP switch each get a plain
  help screen. Developers can copy a report about the open page's tools.

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: The node card is headed with the node's own spec version
    Given a node whose knowledge links state spec 1.1.0
    Then the card is headed "AgenticSystemCore node, spec 1.1.0"
    And no conformance level is shown unless the node states one

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: Start your own node shows the command as text to copy
    Given an AgenticSystemCore node is open
    Then the card shows the install command as text with a Copy command button
    And its only link goes to the AgenticSystemCore site

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: Compose is offered as a starter only when the page has the compose tool
    Given a node with and without the compose tool
    Then "Compose a harness for my task" is offered only with it, and a click fills the box and sends nothing

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: The explain starter asks why two items are linked
    Given a node with the explain tool
    Then the starter asks why two items are linked, not about a rule code

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: A page with no tools gets the help screen "This site has no tools"
    Given a page that registers no tools in a Chrome that has WebMCP
    Then the screen says what that means, that the chat still works, and links to the demo page

  # test: test/ui/node-card.test.ts
  @unit
  Scenario: Chrome without the WebMCP switch gets the help screen with the address to copy
    Given a Chrome that has no WebMCP
    Then the screen shows chrome://flags/#enable-webmcp-testing as text with a Copy address button
    And it gives three numbered steps ending with restarting Chrome, and no chrome:// link

  # test: test/ui/node-card.test.ts, test/core/tool-report.test.ts
  @unit
  Scenario: Copy report shows a preview first and copies on the second click
    Given a page with tools
    When I press Copy report
    Then I see the Markdown report and nothing is copied
    And pressing again copies exactly that text

  # test: test/core/tool-report.test.ts
  @unit
  Scenario: The report lists tools, problems and the review hook, and is informational
    Given tools with a missing description, a missing schema and a bad annotation
    Then the report names each problem, has an empty "Security review flags" section
    And states the WebMCP draft date 13 Nov 2026 and that it is informational, not a score or a certification

  # test: test/core/tool-report.test.ts
  @unit
  Scenario: The report holds no page text beyond tool names, titles and descriptions
    Given a tool whose text holds hidden characters
    Then the report shows them made visible and holds no address
