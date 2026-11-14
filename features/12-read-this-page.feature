# SPDX-License-Identifier: Apache-2.0
Feature: Read this page on a page without WebMCP
  A page that offers no tools can still be asked about: its text is read once, shown in the
  chat as page content, and sent with the next question as data.

  @smoke
  Scenario: Read this page puts the page text in the chat as untrusted content
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    When I press "Read this page"
    Then the page note contains "Page text read ("
    And the conversation shows "Result of read-this-page"
    And the tool result is marked untrusted

  @smoke
  Scenario: A question after reading is answered, and the page text is used once
    Given WebAIAssist is installed
    And a page without WebMCP tools is open
    And the side panel is open on that page
    And the scripted model is ready
    When I press "Read this page"
    And I ask "What is this page about?"
    Then the conversation shows "Scripted reply to: What is this page about?"
    And no tool dialog is shown

  # test: test/ui/panel-safety.test.ts, test/ui/panel-controller.test.ts
  @unit
  Scenario: Page text read on one site is not sent when the question is on another
    Given page text was read on one site
    When the tab moves to another site and I ask a question
    Then the text is dropped, with the note that it was not sent

  # test: test/adapters/page-reader.test.ts
  @unit
  Scenario: The page text is cut at a fixed size, and a page that cannot be scripted says how to allow it
    Given a very long page, and a page the extension may not script
    Then the text is capped, and the message says how to give access

  @smoke
  Scenario: A site that says "no AI input" is not read by Read this page
    Given a site whose robots.txt says ai-input=no
    And the side panel is open on that site
    Then the page line says that the site asks that AI does not use its content as input
    And "Read this page" is not offered
