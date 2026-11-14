# SPDX-License-Identifier: Apache-2.0
Feature: The model uses the tools of the page
  The assistant cannot see the site by itself. On a page with tools, its instructions say so:
  a question about the site needs a tool, site files are background only, read-only tools come
  first, and the first sufficient result ends the question. None of this loosens a confirmation.

  # test: test/core/prompt-tool-rules.test.ts
  @unit
  Scenario: The instructions tell the model it cannot see the site and must call a tool first
    Given a page with tools
    When the instructions for the model are built, in full or in the short form
    Then they say that the model cannot see the site and must call a tool first for anything about it
    And they say that site files are background and never the source of an answer
    And they say that a greeting needs no tool
    And a page with no tools gets none of these rules

  # test: test/core/prompt-tool-rules.test.ts
  @unit
  Scenario: Read-only tools come first and the others are used only when the user asked
    Given a page with tools of which some are not marked read-only
    When the instructions for the model are built
    Then the read-only tools are listed first
    And the other tools follow under a line that says to use them only when the user asked for that action

  # test: test/core/agent-loop-tool-use.test.ts
  @unit
  Scenario: A tool result is followed by a line that lets the model answer at once
    Given the model has called a tool and the result is back
    When the model is asked again
    Then the request ends with one line saying to answer now if the result is enough
    And that line is not saved with the chat
    And a refused call adds no such line

  # test: test/core/agent-loop-tool-use.test.ts, test/core/agent-loop-site.test.ts
  @unit
  Scenario: The site files are introduced as background, not as an answer
    Given the site published files that are passed to the model
    When the question is sent
    Then the files come with a line that says they are not an answer and a tool should be called

  # test: test/adapters/context-fit.test.ts, test/core/site-facts.test.ts
  @unit
  Scenario: A site that fills every piece of site text still fits a window of 4096 tokens
    Given a site whose published files fill every piece of site text to its limit
    When the model has a window of 4096 tokens or less
    Then the site text is cut to a smaller limit than for a large window
    And the request, the reserve for the reply and room for a tool result fit

  # test: test/core/agent-loop-site-gate.test.ts, test/core/site-consent.test.ts, test/ui/panel-controller.test.ts
  @unit
  Scenario: The site question comes when a tool is first about to be used
    Given a page with tools on a site that is not allowed yet
    When I ask a question that the model answers without a tool
    Then no question about the site is asked
    When I ask a question that makes the model call a tool
    Then "Use the tools of {origin}?" is asked before "Run the tool …?"
    And after Deny no tool runs and the page note says the site's tools were not allowed

  # test: test/eval/score.test.ts, test/eval/report.test.ts
  @unit
  Scenario: The evaluation scores the first tool and "a tool was used" beside the exact sequence
    Given an evaluation run in which the model called "ask" and then "read" for a question that expects "ask"
    When the run is scored
    Then "Tool right" is 0, "First tool right" is 1 and "Tool used" is 1
